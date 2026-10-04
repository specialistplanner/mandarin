import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createUnitRecord } from "../lib/domain.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import {
  V080_AUTHORITY_CUTOVER,
  applyV080AuthorityCutover,
} from "../lib/v080-authority-cutover.ts";

const TIMESTAMP = "2026-10-04T02:00:00.000Z";

function lesson(id, title, sequence) {
  return { id, title, sequence };
}

function fixture() {
  let planner = freshSamplePlanner();
  planner = createUnitRecord(planner, {
    id: V080_AUTHORITY_CUTOVER.family.unitId,
    yearLevelId: "year-2",
    title: "Family",
    lessons: [
      lesson(V080_AUTHORITY_CUTOVER.family.existingLessonIds[0], "Introduction", 1),
      lesson(V080_AUTHORITY_CUTOVER.family.existingLessonIds[1], "Family Tree", 2),
      lesson(V080_AUTHORITY_CUTOVER.family.existingLessonIds[2], "My family has five people.", 3),
      lesson(V080_AUTHORITY_CUTOVER.family.existingLessonIds[3], "I have ... (in my family).", 4),
    ],
  }, false);
  planner = createUnitRecord(planner, {
    id: V080_AUTHORITY_CUTOVER.fruit.unitId,
    yearLevelId: "year-3",
    title: "Fruit",
    lessons: [
      lesson(V080_AUTHORITY_CUTOVER.fruit.existingLessonIds[0], "Introduction", 1),
      lesson(V080_AUTHORITY_CUTOVER.fruit.existingLessonIds[1], "Vocabulary Reinforcement", 2),
      lesson(V080_AUTHORITY_CUTOVER.fruit.existingLessonIds[2], "I like ... and ...", 3),
    ],
  }, false);

  for (const classId of ["2a", "2c"]) {
    planner.classProgress[classId] = { classId, unitId: V080_AUTHORITY_CUTOVER.family.unitId, lessonId: V080_AUTHORITY_CUTOVER.family.existingLessonIds[1] };
    planner.progressBaselines[classId] = { classId, unitId: V080_AUTHORITY_CUTOVER.family.unitId, lessonId: V080_AUTHORITY_CUTOVER.family.existingLessonIds[1] };
    planner.progressCheckpoints[classId] = { classId, unitId: V080_AUTHORITY_CUTOVER.family.unitId, lessonId: V080_AUTHORITY_CUTOVER.family.existingLessonIds[1], effectiveDate: "2026-10-01", createdAt: TIMESTAMP, reason: "Test baseline" };
  }
  for (const classId of ["3a", "3b"]) {
    planner.classProgress[classId] = { classId, unitId: V080_AUTHORITY_CUTOVER.fruit.unitId, lessonId: V080_AUTHORITY_CUTOVER.fruit.existingLessonIds[2] };
    planner.progressBaselines[classId] = { classId, unitId: V080_AUTHORITY_CUTOVER.fruit.unitId, lessonId: V080_AUTHORITY_CUTOVER.fruit.existingLessonIds[2] };
  }
  planner.teachingSessions.push({
    id: "historical-family",
    date: "2026-09-01",
    timetableSessionId: "wed-2a",
    classId: "2a",
    yearLevelId: "year-2",
    subjectId: planner.activeSubjectId,
    plannedUnitId: V080_AUTHORITY_CUTOVER.family.unitId,
    plannedUnitTitle: "Family",
    plannedLessonId: V080_AUTHORITY_CUTOVER.family.existingLessonIds[2],
    plannedLessonTitle: "My family has five people.",
    outcome: "completed",
    affectsProgress: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  return planner;
}

function protectedState(planner) {
  return {
    subjects: planner.subjects,
    activeSubjectId: planner.activeSubjectId,
    yearLevels: planner.yearLevels,
    classes: planner.classes,
    classProgress: planner.classProgress,
    progressBaselines: planner.progressBaselines,
    progressCheckpoints: planner.progressCheckpoints,
    classColours: planner.classColours,
    sessionSlots: planner.sessionSlots,
    timetableSessions: planner.timetableSessions,
    teachingSessions: planner.teachingSessions,
    schoolYears: planner.schoolYears,
    terms: planner.terms,
    nonTeachingPeriods: planner.nonTeachingPeriods,
    reconciliationStatus: planner.reconciliationStatus,
    trialNotes: planner.trialNotes,
  };
}

test("v0.8 Phase A creates only the approved Family and Fruit current structures", () => {
  const before = fixture();
  const { planner: after, report } = applyV080AuthorityCutover(before, TIMESTAMP);
  assert.equal(report.changed, true);
  assert.deepEqual(report.preservedExistingLessonIds, [
    ...V080_AUTHORITY_CUTOVER.family.existingLessonIds,
    ...V080_AUTHORITY_CUTOVER.fruit.existingLessonIds,
  ]);
  assert.deepEqual(report.addedLessonIds, [
    V080_AUTHORITY_CUTOVER.family.newLessonId,
    ...V080_AUTHORITY_CUTOVER.fruit.newLessonIds,
  ]);
  assert.deepEqual(report.family.titles, ["Introduction", "Family Tree", "Family Tree II", "My family has five people.", "My family has ...."]);
  assert.deepEqual(report.fruit.titles, ["Introduction", "Vocabulary Reinforcement", "I like ... and ...", "I don't like ... or ...", "Revision"]);
  assert.deepEqual(protectedState(after), protectedState(before));
  for (const id of report.addedLessonIds) {
    const added = after.units.flatMap((unit) => unit.lessons).find((item) => item.id === id);
    assert.ok(added);
    assert.equal(added.externalResourceRef, undefined);
  }
});

test("v0.8 Phase A keeps progress, baselines, checkpoints and historical snapshots immutable", () => {
  const before = fixture();
  const historicalBefore = structuredClone(before.teachingSessions);
  const progressBefore = structuredClone(before.classProgress);
  const baselineBefore = structuredClone(before.progressBaselines);
  const checkpointBefore = structuredClone(before.progressCheckpoints);
  const { planner: after } = applyV080AuthorityCutover(before, TIMESTAMP);
  assert.deepEqual(after.teachingSessions, historicalBefore);
  assert.deepEqual(after.classProgress, progressBefore);
  assert.deepEqual(after.progressBaselines, baselineBefore);
  assert.deepEqual(after.progressCheckpoints, checkpointBefore);
  assert.equal(after.teachingSessions.at(-1).plannedLessonTitle, "My family has five people.");
});

test("v0.8 Phase A is idempotent and survives the supported JSON backup round trip", () => {
  const first = applyV080AuthorityCutover(fixture(), TIMESTAMP);
  const second = applyV080AuthorityCutover(first.planner, "2026-10-04T03:00:00.000Z");
  assert.equal(second.report.changed, false);
  assert.equal(second.planner, first.planner);
  const exported = exportPlannerData(first.planner);
  const restored = importPlannerData(exported);
  assert.equal(exportPlannerData(restored), exported);
  assert.deepEqual(restored.classProgress, first.planner.classProgress);
  assert.deepEqual(restored.progressBaselines, first.planner.progressBaselines);
  assert.deepEqual(restored.progressCheckpoints, first.planner.progressCheckpoints);
  assert.deepEqual(
    restored.teachingSessions.map(({ id, plannedUnitId, plannedLessonId, plannedUnitTitle, plannedLessonTitle, outcome }) => ({ id, plannedUnitId, plannedLessonId, plannedUnitTitle, plannedLessonTitle, outcome })),
    first.planner.teachingSessions.map(({ id, plannedUnitId, plannedLessonId, plannedUnitTitle, plannedLessonTitle, outcome }) => ({ id, plannedUnitId, plannedLessonId, plannedUnitTitle, plannedLessonTitle, outcome })),
  );
});

test("v0.8 Phase A aborts when owner-approved legacy identity or titles drift", () => {
  const planner = fixture();
  const family = planner.units.find((unit) => unit.id === V080_AUTHORITY_CUTOVER.family.unitId);
  family.lessons[1].title = "Unexpected edit";
  assert.throws(() => applyV080AuthorityCutover(planner, TIMESTAMP), /Family titles changed/);
});

test("active dashboard no longer runs transitional TMR title reconciliation writes", async () => {
  const source = await readFile(new URL("../app/dashboard-app.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /linked-unit-title-reconciliation/);
  assert.doesNotMatch(source, /reconcileLinkedUnitTitles/);
});
