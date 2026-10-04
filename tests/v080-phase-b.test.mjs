import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addLessonRecord,
  createUnitRecord,
  reorderLessonRecord,
  updateLessonRecord,
  updateUnitDetails,
  updateUnitMetadata,
} from "../lib/domain.ts";
import { buildProgramUnitLibraryColumns } from "../lib/program-unit-library.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";

function operationalState(planner) {
  return JSON.stringify({
    classProgress: planner.classProgress,
    progressBaselines: planner.progressBaselines,
    progressCheckpoints: planner.progressCheckpoints,
    teachingSessions: planner.teachingSessions,
    yearLevels: planner.yearLevels,
  });
}

test("Phase B groups all seven year levels and sorts each column without mutating Program Unit order", () => {
  let planner = freshSamplePlanner();
  const yearId = planner.yearLevels[0].id;
  planner = createUnitRecord(planner, {
    id: "unit-zebra",
    yearLevelId: yearId,
    title: "Zebra",
    lessons: [{ id: "zebra-1", title: "First", sequence: 1 }],
  }, false);
  planner = createUnitRecord(planner, {
    id: "unit-apple",
    yearLevelId: yearId,
    title: "Apple",
    lessons: [{ id: "apple-1", title: "First", sequence: 1 }],
  }, false);
  const storedOrder = planner.units.map((unit) => unit.id);
  const columns = buildProgramUnitLibraryColumns(planner);
  assert.equal(columns.length, 7);
  assert.deepEqual(columns.map((column) => column.yearLevel.label), ["Prep", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"]);
  const prepTitles = columns[0].units.map((unit) => unit.title);
  assert.deepEqual(prepTitles, [...prepTitles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
  assert.deepEqual(planner.units.map((unit) => unit.id), storedOrder);
});

test("Phase B Unit and Lesson authoring preserves stable IDs and operational state", () => {
  let planner = freshSamplePlanner();
  const unit = planner.units[0];
  const unitId = unit.id;
  const lessonIds = unit.lessons.map((lesson) => lesson.id);
  const before = operationalState(planner);

  planner = updateUnitDetails(planner, unitId, "Renamed Unit", unit.description);
  planner = updateUnitMetadata(planner, unitId, {
    secondaryTitle: "第二标题",
    teacherNotes: unit.teacherNotes,
    resources: unit.resources,
    curriculumMetadata: unit.curriculumMetadata,
  });
  planner = updateLessonRecord(planner, unitId, lessonIds[0], "Renamed Lesson", unit.lessons[0].description);
  planner = addLessonRecord(planner, unitId, { id: "phase-b-new-lesson", title: "New Lesson", sequence: 999 });
  planner = reorderLessonRecord(planner, unitId, "phase-b-new-lesson", -1);

  assert.equal(planner.units.find((candidate) => candidate.id === unitId)?.title, "Renamed Unit");
  assert.equal(planner.units.find((candidate) => candidate.id === unitId)?.secondaryTitle, "第二标题");
  assert.ok(planner.units.some((candidate) => candidate.id === unitId));
  assert.ok(lessonIds.every((lessonId) => planner.units.find((candidate) => candidate.id === unitId)?.lessons.some((lesson) => lesson.id === lessonId)));
  assert.equal(operationalState(planner), before);
});

test("Phase B creation does not set cohort/class progress and optional secondary titles round-trip", () => {
  const before = freshSamplePlanner();
  const yearLevelId = before.yearLevels[0].id;
  const operationalBefore = operationalState(before);
  const next = createUnitRecord(before, {
    id: "phase-b-created-unit",
    yearLevelId,
    title: "New curriculum",
    secondaryTitle: "新课程",
    lessons: [{ id: "phase-b-created-lesson", title: "First lesson", sequence: 1 }],
  }, false);
  assert.equal(operationalState(next), operationalBefore);
  const restored = importPlannerData(exportPlannerData(next));
  assert.equal(restored.units.find((unit) => unit.id === "phase-b-created-unit")?.secondaryTitle, "新课程");
});

test("Phase B Unit Library is native, compact and has no TMR authoring/read-through actions", async () => {
  const [component, styles, dashboard, settings] = await Promise.all([
    readFile(new URL("../app/program-unit-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/setup-view.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(styles, /grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(component, /ProgramUnitEditor/);
  assert.match(component, /createUnitRecord/);
  assert.match(component, /reorderLessonRecord/);
  assert.doesNotMatch(component, /edit\.html|materializeUnitLibraryUnit|UNIT_LIBRARY_INDEX_URL/);
  assert.match(dashboard, /view === "units" \? <ProgramUnitLibrary/);
  assert.doesNotMatch(dashboard, /view === "units" && isMandarinProgram/);
  assert.doesNotMatch(settings, /Unit Library · live|materializeUnitLibraryUnit/);
});
