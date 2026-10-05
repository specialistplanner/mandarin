import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addLessonRecord,
  createUnitRecord,
  reorderLessonRecord,
  setClassPlanningPosition,
  updateLessonRecord,
} from "../lib/domain.ts";
import { appRouteHash, parseAppRoute, sameAppRoute } from "../lib/app-route.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { deriveTeachingWeek } from "../lib/week-planner.ts";

const releaseWeek = new Date(2026, 8, 2, 12);

function classEntry(planner, classId = "5e") {
  return deriveTeachingWeek(planner, releaseWeek, releaseWeek)
    .days.flatMap((day) => day.entries)
    .find((entry) => entry.specialistClass?.id === classId);
}

function protectedState(planner) {
  return structuredClone({
    progressBaselines: planner.progressBaselines,
    progressCheckpoints: planner.progressCheckpoints,
    teachingSessions: planner.teachingSessions,
    yearLevels: planner.yearLevels,
    timetableSessions: planner.timetableSessions,
  });
}

test("Phase C planning changes one class through the authoritative classProgress pointer only", () => {
  const before = freshSamplePlanner();
  const protectedBefore = protectedState(before);
  const peerBefore = structuredClone(before.classProgress["5c"]);
  const current = before.classProgress["5e"];
  const nextLesson = before.units.find((unit) => unit.id === current.unitId).lessons[4];
  const after = setClassPlanningPosition(before, "5e", current.unitId, nextLesson.id);

  assert.deepEqual(after.classProgress["5e"], { classId: "5e", unitId: current.unitId, lessonId: nextLesson.id });
  assert.deepEqual(after.classProgress["5c"], peerBefore);
  assert.deepEqual(protectedState(after), protectedBefore);
  assert.equal(after.teachingSessions.length, before.teachingSessions.length);
  assert.equal(classEntry(after).lesson.id, nextLesson.id);
});

test("Phase C same-selection planning is a strict no-op with no revision churn", () => {
  const planner = freshSamplePlanner();
  const current = planner.classProgress["5e"];
  assert.equal(setClassPlanningPosition(planner, "5e", current.unitId, current.lessonId), planner);
});

test("Phase C Unit changes are year-scoped and preserve cohort references and history", () => {
  let planner = freshSamplePlanner();
  planner = createUnitRecord(planner, {
    id: "year-5-new-unit",
    yearLevelId: "year-5",
    yearLevelIds: ["year-5"],
    title: "New Year 5 Unit",
    lessons: [{ id: "year-5-new-lesson", title: "New start", sequence: 1 }],
  }, false);
  const protectedBefore = protectedState(planner);
  const next = setClassPlanningPosition(planner, "5e", "year-5-new-unit", "year-5-new-lesson");
  assert.equal(next.classProgress["5e"].unitId, "year-5-new-unit");
  assert.deepEqual(protectedState(next), protectedBefore);
  assert.throws(() => setClassPlanningPosition(planner, "5e", "travel", "travel-lesson-1"), /valid unit and lesson/);
});

test("renamed, added and reordered Program Lessons resolve immediately by stable ID", () => {
  let planner = freshSamplePlanner();
  planner = updateLessonRecord(planner, "nationalities", "nationalities-lesson-4", "Renamed current Lesson");
  assert.equal(classEntry(planner).lesson.title, "Renamed current Lesson");

  planner = addLessonRecord(planner, "nationalities", { id: "new-stable-lesson", title: "Newly authored Lesson", sequence: 99 });
  planner = setClassPlanningPosition(planner, "5e", "nationalities", "new-stable-lesson");
  assert.equal(classEntry(planner).lesson.id, "new-stable-lesson");
  assert.equal(classEntry(planner).lesson.title, "Newly authored Lesson");

  planner = reorderLessonRecord(planner, "nationalities", "new-stable-lesson", -1);
  const entry = classEntry(planner);
  assert.equal(entry.lesson.id, "new-stable-lesson");
  assert.equal(entry.lessonNumber, planner.units.find((unit) => unit.id === "nationalities").lessons.findIndex((lesson) => lesson.id === "new-stable-lesson") + 1);
});

test("Phase C planning works without TMR availability and survives supported backup restore", () => {
  const source = freshSamplePlanner();
  const localOnly = {
    ...source,
    units: source.units.map((unit) => ({
      ...unit,
      externalResourceRef: undefined,
      lessons: unit.lessons.map((lesson) => ({ ...lesson, externalResourceRef: undefined })),
    })),
  };
  const next = setClassPlanningPosition(localOnly, "5e", "nationalities", "nationalities-lesson-5");
  const restored = importPlannerData(exportPlannerData(next));
  assert.deepEqual(restored.classProgress["5e"], next.classProgress["5e"]);
  assert.equal(classEntry(restored).lesson.id, "nationalities-lesson-5");
});

test("Phase C persistent routes cover every workspace, nested Unit, and Settings section", () => {
  const validUnits = new Set(["unit / one"]);
  const routes = [
    { view: "week" },
    { view: "units" },
    { view: "units", unitId: "unit / one" },
    { view: "term", section: "overview" },
    { view: "term", section: "progress" },
    { view: "settings", section: "program" },
    { view: "settings", section: "cohorts" },
    { view: "settings", section: "timetable" },
    { view: "settings", section: "calendar" },
    { view: "settings", section: "holidays" },
    { view: "settings", section: "notes" },
    { view: "settings", section: "data" },
    { view: "settings", section: "account" },
  ];
  for (const route of routes) {
    const parsed = parseAppRoute(appRouteHash(route), validUnits);
    assert.equal(sameAppRoute(parsed, route), true, appRouteHash(route));
  }
  assert.deepEqual(parseAppRoute("", validUnits), { view: "week" });
  assert.deepEqual(parseAppRoute("#/units/missing", validUnits), { view: "units" });
  assert.deepEqual(parseAppRoute("#/settings/not-real", validUnits), { view: "settings", section: "program" });
  assert.deepEqual(parseAppRoute("#/not-real", validUnits), { view: "week" });
});

test("Phase C UI wires planning safety and browser history without cloud writes on navigation", async () => {
  const [dashboard, week, units, settings, term] = await Promise.all([
    readFile(new URL("../app/dashboard-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/week-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/program-unit-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/setup-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/term-overview.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(week, /Change Unit \/ Lesson/);
  assert.match(week, /setClassPlanningPosition/);
  assert.match(week, /does not mark anything taught or rewrite teaching history/);
  assert.match(week, /current\.unitId !== planningDraft\.unitId && !window\.confirm/);
  assert.doesNotMatch(week.slice(week.indexOf("function savePlanningPosition"), week.indexOf("function renderEntry")), /materializeTeachingSessionsForDate|recordTeachingSessionOutcome/);
  assert.match(dashboard, /window\.history\[replace \? "replaceState" : "pushState"\]/);
  assert.match(dashboard, /addEventListener\("popstate"/);
  assert.match(dashboard, /addEventListener\("hashchange"/);
  assert.match(dashboard, /selectedUnitId={route\.view === "units" \? route\.unitId : undefined}/);
  assert.match(units, /onSelectUnit\?: \(unitId\?: string\) => void/);
  assert.match(settings, /onSectionChange\?: \(section: SettingsSection\) => void/);
  assert.match(term, /onSectionChange\?: \(section: "overview" \| "progress"\) => void/);
});
