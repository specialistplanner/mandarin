import assert from "node:assert/strict";
import test from "node:test";
import { deriveTermOverview, formatTermDate, shiftConfiguredTeachingWeek, teachingWeekStarts } from "../lib/academic-calendar.ts";
import { materializeTeachingSessionsForDate, recordTeachingSessionOutcome, updateLessonMetadata, updateUnitMetadata } from "../lib/domain.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { exportPlannerData, importPlannerData, migrateV9PlannerData } from "../lib/storage.ts";

function withCalendar() {
  const planner = freshSamplePlanner();
  planner.schoolYears = [{ id: "year-2026", label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }];
  planner.terms = [{ id: "term-3", schoolYearId: "year-2026", name: "Term 3", startDate: "2026-08-31", endDate: "2026-09-25", sequence: 3 }];
  planner.nonTeachingPeriods = [];
  return planner;
}

test("Term Overview uses an unambiguous Australian written date format", () => {
  assert.equal(formatTermDate("2026-09-25"), "25 Sep");
  assert.equal(formatTermDate("2026-10-01"), "1 Oct");
});

test("v0.6 schema 9 migrates idempotently without changing stable curriculum or progress IDs", () => {
  const original = freshSamplePlanner();
  const old = JSON.parse(JSON.stringify(original));
  old.schemaVersion = 9;
  delete old.schoolYears;
  delete old.terms;
  delete old.nonTeachingPeriods;
  for (const unit of old.units) {
    delete unit.schemaVersion; delete unit.createdAt; delete unit.updatedAt;
    for (const lesson of unit.lessons) { delete lesson.schemaVersion; delete lesson.createdAt; delete lesson.updatedAt; }
  }
  const migrated = migrateV9PlannerData(old);
  assert.equal(migrated.schemaVersion, 10);
  assert.deepEqual(migrated.units.map((unit) => unit.id), original.units.map((unit) => unit.id));
  assert.deepEqual(migrated.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)), original.units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id)));
  assert.deepEqual(migrated.classProgress, original.classProgress);
  assert.deepEqual(importPlannerData(exportPlannerData(migrated)), migrated);
});

test("a configured holiday creates no planned or missed teaching occurrence", () => {
  const planner = withCalendar();
  planner.nonTeachingPeriods = [{ id: "holiday", schoolYearId: "year-2026", type: "school_holiday", name: "School holidays", startDate: "2026-09-02", endDate: "2026-09-02" }];
  const next = materializeTeachingSessionsForDate(planner, new Date("2026-09-02T12:00:00"));
  assert.equal(next.teachingSessions.length, 0);
});

test("teaching-week navigation skips a fully non-teaching week", () => {
  const planner = withCalendar();
  planner.nonTeachingPeriods = [{ id: "break", schoolYearId: "year-2026", type: "school_holiday", name: "Term break", startDate: "2026-09-07", endDate: "2026-09-11" }];
  const weeks = teachingWeekStarts(planner, planner.terms[0]).map((date) => date.toISOString().slice(0, 10));
  assert.deepEqual(weeks, ["2026-08-31", "2026-09-14", "2026-09-21"]);
  assert.equal(shiftConfiguredTeachingWeek(planner, new Date("2026-08-31T12:00:00"), 1).toISOString().slice(0, 10), "2026-09-14");
});

test("Term Overview aggregates one year-level position while retaining distinct outcome counts", () => {
  let planner = withCalendar();
  planner = materializeTeachingSessionsForDate(planner, new Date("2026-09-02T12:00:00"));
  const fiveE = planner.teachingSessions.find((session) => session.classId === "5e");
  const fiveC = planner.teachingSessions.find((session) => session.classId === "5c");
  planner = recordTeachingSessionOutcome(planner, fiveE.id, "completed");
  planner = recordTeachingSessionOutcome(planner, fiveC.id, "partial", "Half taught");
  const week = deriveTermOverview(planner, "term-3")[0];
  const yearFive = week.cells.find((cell) => cell.yearLevelId === "year-5");
  assert.equal(yearFive.items.length, 1);
  assert.equal(yearFive.items[0].totalClassCount, 2);
  assert.deepEqual(yearFive.items[0].outcomes, [{ outcome: "completed", count: 1 }, { outcome: "partial", count: 1 }]);
});

test("Term Overview uses the majority Unit and Lesson when classes in one year level diverge", () => {
  const planner = withCalendar();
  const fiveE = planner.classProgress["5e"];
  const yearFiveUnit = planner.units.find((unit) => unit.id === fiveE.unitId);
  planner.classes.push({ id: "5x", name: "5X", yearLevelId: "year-5" });
  planner.classProgress["5x"] = { ...fiveE, classId: "5x" };
  planner.classProgress["5c"] = { ...planner.classProgress["5c"], lessonId: yearFiveUnit.lessons.find((lesson) => lesson.id !== fiveE.lessonId).id };
  const cell = deriveTermOverview(planner, "term-3")[0].cells.find((item) => item.yearLevelId === "year-5");
  assert.equal(cell.divergent, true);
  assert.equal(cell.items.length, 1);
  assert.equal(cell.items[0].lessonId, fiveE.lessonId);
  assert.equal(cell.items[0].supportingClassCount, 2);
  assert.equal(cell.items[0].totalClassCount, 3);
});

test("Program-owned Unit metadata and Mandarin vocabulary references survive backup restore", () => {
  let planner = freshSamplePlanner();
  const unit = planner.units[0];
  const lesson = unit.lessons[0];
  planner = updateUnitMetadata(planner, unit.id, {
    teacherNotes: "Use picture cards",
    curriculumMetadata: { framework: "Victorian Curriculum", codes: ["VC2LC4C01"] },
    resources: [{ id: "resource-1", label: "Slides", url: "https://example.edu/slides" }],
  });
  planner = updateLessonMetadata(planner, unit.id, lesson.id, { vocabularySetId: "prep-greetings", teacherNotes: "Model first" });
  const restored = importPlannerData(exportPlannerData(planner));
  assert.equal(restored.units[0].curriculumMetadata.codes[0], "VC2LC4C01");
  assert.equal(restored.units[0].lessons[0].vocabularySetId, "prep-greetings");
  assert.equal(restored.units[0].resources[0].url, "https://example.edu/slides");
});
