import assert from "node:assert/strict";
import test from "node:test";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { reconcileLinkedUnitTitles } from "../lib/linked-unit-title-reconciliation.ts";
import { materializeUnitLibraryUnit, parseUnitLibraryIndex, UNIT_LIBRARY_PROVIDER } from "../lib/unit-library.ts";

const OLD_HEADING = "My family has five people.";
const NEW_HEADING = "There are five people in my family.";

function familyIndex({
  unitTitle = "Family II",
  firstTitle = OLD_HEADING,
  lessons = [
    { id: "lesson-1790909455090", title: firstTitle },
    { id: "lesson-1790920751476", title: "I have two older brothers." },
  ],
} = {}) {
  return parseUnitLibraryIndex({
    schemaVersion: 1,
    provider: UNIT_LIBRARY_PROVIDER,
    generatedAt: "2026-10-03T00:00:00.000Z",
    units: [{
      id: "year-6-family-ii",
      yearLevel: 6,
      title: unitTitle,
      chineseTitle: "家庭 II",
      url: "https://themandarinroom.github.io/units/view.html?unit=year-6-family-ii",
      lessons: lessons.map((lesson) => ({
        ...lesson,
        url: `https://themandarinroom.github.io/units/view.html?unit=year-6-family-ii&lesson=${lesson.id}`,
      })),
    }],
  });
}

function familyPlanner({ bootstrap = false } = {}) {
  let sequence = 0;
  const result = materializeUnitLibraryUnit(
    freshSamplePlanner(),
    "year-6",
    familyIndex().units[0],
    (prefix) => `${prefix}-family-${++sequence}`,
  );
  const planner = result.planner;
  const unit = planner.units.find((candidate) => candidate.id === result.unitId);
  if (bootstrap) {
    delete unit.externalResourceRef.lastSyncedTitle;
    for (const lesson of unit.lessons) delete lesson.externalResourceRef.lastSyncedTitle;
  }
  planner.classProgress["6b"] = { classId: "6b", unitId: unit.id, lessonId: unit.lessons[0].id };
  planner.classProgress["6d"] = { classId: "6d", unitId: unit.id, lessonId: unit.lessons[0].id };
  planner.progressBaselines["6b"] = structuredClone(planner.classProgress["6b"]);
  planner.progressBaselines["6d"] = structuredClone(planner.classProgress["6d"]);
  planner.progressCheckpoints["6b"] = { ...structuredClone(planner.classProgress["6b"]), effectiveDate: "2026-09-01", createdAt: "2026-09-01T00:00:00.000Z", reason: "Existing baseline" };
  planner.progressCheckpoints["6d"] = { ...structuredClone(planner.classProgress["6d"]), effectiveDate: "2026-09-01", createdAt: "2026-09-01T00:00:00.000Z", reason: "Existing baseline" };
  planner.teachingSessions.push({
    id: "historical-family-session",
    date: "2026-09-08",
    timetableSessionId: "timetable-6b",
    subjectId: planner.activeSubjectId,
    classId: "6b",
    yearLevelId: "year-6",
    plannedUnitId: unit.id,
    plannedLessonId: unit.lessons[0].id,
    plannedUnitTitle: "Family II",
    plannedLessonTitle: OLD_HEADING,
    outcome: "completed",
    affectsProgress: true,
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
  });
  return { planner, unitId: unit.id, firstLessonId: unit.lessons[0].id };
}

function operationalState(planner) {
  return structuredClone({
    classProgress: planner.classProgress,
    progressBaselines: planner.progressBaselines,
    progressCheckpoints: planner.progressCheckpoints,
    teachingSessions: planner.teachingSessions,
    timetableSessions: planner.timetableSessions,
  });
}

test("linked Unit and Lesson title changes reconcile through stable external IDs", () => {
  const { planner, unitId, firstLessonId } = familyPlanner();
  const before = operationalState(planner);
  const nextIndex = familyIndex({ unitTitle: "Family, part two", firstTitle: NEW_HEADING });
  const result = reconcileLinkedUnitTitles(planner, nextIndex, { mode: "automatic", sourceAvailable: true });
  const unit = result.planner.units.find((candidate) => candidate.id === unitId);

  assert.equal(result.changed, true);
  assert.equal(unit.title, "Family, part two");
  assert.equal(unit.lessons[0].title, NEW_HEADING);
  assert.equal(unit.id, unitId);
  assert.equal(unit.lessons[0].id, firstLessonId);
  assert.equal(unit.externalResourceRef.resourceId, "year-6-family-ii");
  assert.equal(unit.lessons[0].externalResourceRef.resourceId, "lesson-1790909455090");
  assert.equal(unit.externalResourceRef.lastSyncedTitle, "Family, part two");
  assert.equal(unit.lessons[0].externalResourceRef.lastSyncedTitle, NEW_HEADING);
  assert.equal(unit.lessons[0].externalResourceRef.label, NEW_HEADING);
  assert.deepEqual(operationalState(result.planner), before);
});

test("Family II regression updates the current Program value while history stays immutable", () => {
  const { planner, unitId } = familyPlanner();
  const history = structuredClone(planner.teachingSessions);
  const result = reconcileLinkedUnitTitles(planner, familyIndex({ firstTitle: NEW_HEADING }), { mode: "automatic", sourceAvailable: true });
  const unit = result.planner.units.find((candidate) => candidate.id === unitId);

  assert.equal(unit.lessons[0].title, NEW_HEADING);
  assert.deepEqual(result.planner.teachingSessions, history);
  assert.equal(result.planner.teachingSessions.at(-1).plannedLessonTitle, OLD_HEADING);
  assert.equal(result.planner.classProgress["6b"].lessonId, unit.lessons[0].id);
  assert.equal(result.planner.classProgress["6d"].lessonId, unit.lessons[0].id);
});

test("no title difference is a strict no-op with no timestamp or revision-triggering object change", () => {
  const { planner } = familyPlanner();
  const result = reconcileLinkedUnitTitles(planner, familyIndex(), { mode: "automatic", sourceAvailable: true });
  assert.equal(result.changed, false);
  assert.equal(result.planner, planner);
  assert.equal(result.planner.updatedAt, planner.updatedAt);
});

test("an unavailable live source keeps stored metadata and emits no deletion or structural warning", () => {
  const { planner } = familyPlanner();
  const result = reconcileLinkedUnitTitles(planner, null, { mode: "automatic", sourceAvailable: false });
  assert.equal(result.changed, false);
  assert.equal(result.planner, planner);
  assert.deepEqual(result.report.units, []);
});

test("a new external Lesson is detected but never inserted or allowed to reorder the Program", () => {
  const { planner, unitId } = familyPlanner();
  const before = planner.units.find((candidate) => candidate.id === unitId).lessons.map((lesson) => lesson.id);
  const nextIndex = familyIndex({
    firstTitle: NEW_HEADING,
    lessons: [
      { id: "lesson-1790909455090", title: NEW_HEADING },
      { id: "lesson-new", title: "New external lesson" },
      { id: "lesson-1790920751476", title: "I have two older brothers." },
    ],
  });
  const result = reconcileLinkedUnitTitles(planner, nextIndex, { mode: "automatic", sourceAvailable: true });
  const report = result.report.units[0];

  assert.equal(result.changed, false);
  assert.ok(report.structuralDifferences.some((item) => item.kind === "external-lesson-added"));
  assert.deepEqual(result.planner.units.find((candidate) => candidate.id === unitId).lessons.map((lesson) => lesson.id), before);
  assert.equal(result.planner.units.find((candidate) => candidate.id === unitId).lessons[0].title, OLD_HEADING);
});

test("a stable Unit title can reconcile even when legacy Lessons have no stable mapping", () => {
  const { planner, unitId } = familyPlanner();
  const unit = planner.units.find((candidate) => candidate.id === unitId);
  for (const lesson of unit.lessons) lesson.externalResourceRef = undefined;
  const result = reconcileLinkedUnitTitles(planner, familyIndex({ unitTitle: "Family, part two" }), { mode: "automatic", sourceAvailable: true });
  assert.equal(result.changed, true);
  assert.equal(result.planner.units.find((candidate) => candidate.id === unitId).title, "Family, part two");
  assert.equal(result.planner.units.find((candidate) => candidate.id === unitId).lessons[0].title, OLD_HEADING);
  assert.equal(result.report.units[0].unmappedItems.length, 2);
  assert.equal(result.report.units[0].structuralDifferences.some((item) => item.kind === "external-lesson-added"), false);
});

test("a deleted external Lesson is detected and the mapped SP Lesson is retained", () => {
  const { planner, unitId } = familyPlanner();
  const nextIndex = familyIndex({ lessons: [{ id: "lesson-1790909455090", title: OLD_HEADING }] });
  const result = reconcileLinkedUnitTitles(planner, nextIndex, { mode: "automatic", sourceAvailable: true });
  assert.equal(result.changed, false);
  assert.ok(result.report.units[0].structuralDifferences.some((item) => item.kind === "external-lesson-deleted"));
  assert.equal(result.planner.units.find((candidate) => candidate.id === unitId).lessons.length, 2);
});

test("external Lesson reordering is detected without changing the SP sequence", () => {
  const { planner, unitId } = familyPlanner();
  const reversed = [...familyIndex().units[0].lessons].reverse().map(({ id, title }) => ({ id, title }));
  const result = reconcileLinkedUnitTitles(planner, familyIndex({ lessons: reversed }), { mode: "automatic", sourceAvailable: true });
  assert.equal(result.changed, false);
  assert.ok(result.report.units[0].structuralDifferences.some((item) => item.kind === "external-lessons-reordered"));
  assert.deepEqual(result.planner.units.find((candidate) => candidate.id === unitId).lessons.map((lesson) => lesson.id), ["lesson-family-2", "lesson-family-3"]);
});

test("a teacher-edited title conflicts with both baseline and TMR and is not overwritten", () => {
  const { planner, unitId } = familyPlanner();
  planner.units.find((candidate) => candidate.id === unitId).lessons[0].title = "Teacher's local wording";
  const result = reconcileLinkedUnitTitles(planner, familyIndex({ firstTitle: NEW_HEADING }), { mode: "automatic", sourceAvailable: true });
  assert.equal(result.changed, false);
  assert.equal(result.planner.units.find((candidate) => candidate.id === unitId).lessons[0].title, "Teacher's local wording");
  assert.equal(result.report.units[0].titleConflicts[0].lastSyncedValue, OLD_HEADING);
});

test("bootstrap differences are dry-run-only until explicitly approved", () => {
  const { planner, unitId } = familyPlanner({ bootstrap: true });
  const nextIndex = familyIndex({ firstTitle: NEW_HEADING });
  const dryRun = reconcileLinkedUnitTitles(planner, nextIndex, { mode: "dry-run", sourceAvailable: true });
  assert.equal(dryRun.changed, false);
  assert.equal(dryRun.planner, planner);
  assert.equal(dryRun.report.units[0].titleDifferences.find((item) => item.target === "lesson").classification, "bootstrap");
  assert.equal(dryRun.report.units[0].baselinesToInitialize.length, 3);

  const automatic = reconcileLinkedUnitTitles(planner, nextIndex, { mode: "automatic", sourceAvailable: true });
  assert.equal(automatic.changed, false);
  assert.equal(automatic.planner.units.find((candidate) => candidate.id === unitId).lessons[0].title, OLD_HEADING);

  const approved = reconcileLinkedUnitTitles(planner, nextIndex, { mode: "approved-bootstrap", sourceAvailable: true });
  assert.equal(approved.changed, true);
  assert.equal(approved.planner.units.find((candidate) => candidate.id === unitId).lessons[0].title, NEW_HEADING);
  assert.equal(approved.planner.units.find((candidate) => candidate.id === unitId).lessons[0].externalResourceRef.lastSyncedTitle, NEW_HEADING);
});

test("JSON backup round-trip preserves reconciled titles, stable IDs, and last-synced titles", () => {
  const { planner, unitId, firstLessonId } = familyPlanner();
  const reconciled = reconcileLinkedUnitTitles(planner, familyIndex({ firstTitle: NEW_HEADING }), { mode: "automatic", sourceAvailable: true }).planner;
  const restored = importPlannerData(exportPlannerData(reconciled));
  const unit = restored.units.find((candidate) => candidate.id === unitId);
  assert.equal(unit.id, unitId);
  assert.equal(unit.lessons[0].id, firstLessonId);
  assert.equal(unit.lessons[0].title, NEW_HEADING);
  assert.equal(unit.lessons[0].externalResourceRef.lastSyncedTitle, NEW_HEADING);
});

test("non-TMR Programs and local-only Units are unaffected", () => {
  const planner = freshSamplePlanner();
  const result = reconcileLinkedUnitTitles(planner, familyIndex({ firstTitle: NEW_HEADING }), { mode: "automatic", sourceAvailable: true });
  assert.equal(result.changed, false);
  assert.equal(result.planner, planner);
  assert.equal(result.report.linkedUnitCount, 0);
});

test("descriptive metadata is not copied and Chinese title support is inspection-only", () => {
  const { planner, unitId } = familyPlanner();
  const before = planner.units.find((candidate) => candidate.id === unitId);
  before.description = "Planner-owned description";
  before.lessons[0].description = "Planner-owned lesson description";
  before.lessons[0].vocabularySetId = "planner-owned-vocabulary-reference";
  const result = reconcileLinkedUnitTitles(planner, familyIndex({ firstTitle: NEW_HEADING }), { mode: "automatic", sourceAvailable: true });
  const after = result.planner.units.find((candidate) => candidate.id === unitId);
  assert.equal(after.description, "Planner-owned description");
  assert.equal(after.lessons[0].description, "Planner-owned lesson description");
  assert.equal(after.lessons[0].vocabularySetId, "planner-owned-vocabulary-reference");
  assert.equal("chineseTitle" in after, false);
  assert.deepEqual(result.report.units[0].chineseTitle, { programStoresField: false, externalProvidesValue: true, externalValue: "家庭 II" });
});

test("reconciliation creates no teaching outcomes and all current consumers share one Program title", () => {
  const { planner, unitId } = familyPlanner();
  const outcomesBefore = planner.teachingSessions.map((session) => session.outcome);
  const result = reconcileLinkedUnitTitles(planner, familyIndex({ firstTitle: NEW_HEADING }), { mode: "automatic", sourceAvailable: true });
  const unit = result.planner.units.find((candidate) => candidate.id === unitId);
  const settingsTitle = unit.lessons[0].title;
  const progressTitle = result.planner.units.find((candidate) => candidate.id === result.planner.classProgress["6b"].unitId).lessons[0].title;
  const weekTitle = result.planner.units.find((candidate) => candidate.id === result.planner.classProgress["6d"].unitId).lessons[0].title;
  assert.equal(settingsTitle, NEW_HEADING);
  assert.equal(progressTitle, NEW_HEADING);
  assert.equal(weekTitle, NEW_HEADING);
  assert.deepEqual(result.planner.teachingSessions.map((session) => session.outcome), outcomesBefore);
});
