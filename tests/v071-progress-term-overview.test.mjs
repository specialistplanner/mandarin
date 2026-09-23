import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import {
  deriveTermOverviewDataset,
  termOverviewCellText,
} from "../lib/academic-calendar.ts";
import {
  alignClassWithCohort,
  getCohortProgressStatus,
  lessonPosition,
  materializeTeachingSessionsForDate,
  recordTeachingSessionOutcome,
  startCohortTogether,
} from "../lib/domain.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { buildTermOverviewWorkbook } from "../lib/term-overview-export.ts";

function date(value) {
  return new Date(`${value}T12:00:00`);
}

function withCalendar() {
  const planner = freshSamplePlanner();
  planner.schoolYears = [{ id: "year-2026", label: "2026", startDate: "2026-01-01", endDate: "2026-12-31" }];
  planner.terms = [
    { id: "term-3", schoolYearId: "year-2026", name: "Term 3", startDate: "2026-08-31", endDate: "2026-09-25", sequence: 3 },
    { id: "term-4", schoolYearId: "year-2026", name: "Term 4", startDate: "2026-10-05", endDate: "2026-12-18", sequence: 4 },
  ];
  planner.nonTeachingPeriods = [];
  return planner;
}

function cell(planner, yearLevelId, week = 0) {
  return deriveTermOverviewDataset(planner, "term-3").rows[week].cells.find((item) => item.yearLevelId === yearLevelId);
}

function materialize(planner, value) {
  return materializeTeachingSessionsForDate(planner, date(value));
}

function recordFor(planner, value, classId, outcome, detail = "") {
  const materialized = materialize(planner, value);
  const session = materialized.teachingSessions.find((item) => item.date === value && item.classId === classId);
  assert.ok(session, `Expected a ${classId} session on ${value}`);
  return recordTeachingSessionOutcome(materialized, session.id, outcome, detail);
}

test("a missed lesson is Behind until the teacher aligns the class", () => {
  let planner = withCalendar();
  planner = recordFor(planner, "2026-09-03", "4e", "not-taught", "Athletics Carnival");
  const level = planner.yearLevels.find((item) => item.id === "year-4");
  const unit = planner.units.find((item) => item.id === level.currentUnitId);
  const before = getCohortProgressStatus(
    planner.classProgress["4e"].unitId,
    lessonPosition(unit, planner.classProgress["4e"].lessonId),
    unit.id,
    lessonPosition(unit, level.expectedLessonId),
  );
  assert.equal(before.label, "1 lesson behind");

  const sessionsBefore = structuredClone(planner.teachingSessions);
  planner = alignClassWithCohort(planner, "4e", "2026-09-04");
  const after = getCohortProgressStatus(
    planner.classProgress["4e"].unitId,
    lessonPosition(unit, planner.classProgress["4e"].lessonId),
    unit.id,
    lessonPosition(unit, level.expectedLessonId),
  );
  assert.equal(after.label, "On track");
  assert.deepEqual(planner.teachingSessions, sessionsBefore);
  assert.equal(planner.teachingSessions.some((item) => item.classId === "4e" && item.outcome === "completed"), false);
  assert.equal(planner.teachingSessions.find((item) => item.classId === "4e").reason, "Athletics Carnival");
  assert.match(planner.progressCheckpoints["4e"].reason, /Earlier untaught lessons remain historically unchanged/);
});

test("starting a cohort together creates a clean baseline without completing the old cycle", () => {
  let planner = withCalendar();
  planner = recordFor(planner, "2026-09-03", "4e", "not-taught", "School Camp");
  planner.units.push({
    id: "weather-two", yearLevelId: "year-4", yearLevelIds: ["year-4"], title: "Weather II",
    lessons: [{ id: "weather-two-1", title: "Forecast language", sequence: 1 }, { id: "weather-two-2", title: "Present a forecast", sequence: 2 }],
  });
  const sessionsBefore = structuredClone(planner.teachingSessions);
  planner = startCohortTogether(planner, "year-4", "weather-two", "weather-two-1", "2026-09-04");
  for (const classId of ["4c", "4b", "4e"]) {
    assert.deepEqual(planner.classProgress[classId], { classId, unitId: "weather-two", lessonId: "weather-two-1" });
    assert.deepEqual(planner.progressBaselines[classId], planner.classProgress[classId]);
    assert.match(planner.progressCheckpoints[classId].reason, /previous teaching cycle ended without inferred completion/i);
  }
  assert.equal(planner.yearLevels.find((item) => item.id === "year-4").currentUnitId, "weather-two");
  assert.deepEqual(planner.teachingSessions, sessionsBefore);
  assert.equal(planner.teachingSessions.find((item) => item.classId === "4e").plannedUnitId, "weather");
});

test("term boundaries and holidays never reset or advance Progress automatically", () => {
  const planner = withCalendar();
  planner.nonTeachingPeriods = [{ id: "holidays", schoolYearId: "year-2026", type: "school_holiday", name: "School holidays", startDate: "2026-09-26", endDate: "2026-10-04" }];
  const before = structuredClone({ progress: planner.classProgress, baselines: planner.progressBaselines, checkpoints: planner.progressCheckpoints });
  assert.deepEqual({ progress: planner.classProgress, baselines: planner.progressBaselines, checkpoints: planner.progressCheckpoints }, before);
  assert.equal(planner.classProgress["4e"].lessonId, "weather-lesson-2");
  assert.equal(planner.yearLevels.find((item) => item.id === "year-4").expectedLessonId, "weather-lesson-3");
});

test("unknown history stays blank and current Progress cannot backfill it", () => {
  const planner = withCalendar();
  planner.classProgress["5e"].lessonId = "nationalities-lesson-6";
  planner.classProgress["5c"].lessonId = "nationalities-lesson-6";
  const yearFive = cell(planner, "year-5");
  assert.equal(yearFive.kind, "blank");
  assert.equal(termOverviewCellText(yearFive), "");
  assert.equal(yearFive.eventTitle, undefined);
});

test("a normal historical cell contains both recorded Unit and Lesson titles", () => {
  let planner = withCalendar();
  planner = recordFor(planner, "2026-09-02", "5e", "completed");
  planner = recordFor(planner, "2026-09-02", "5c", "partial", "Practised orally");
  const yearFive = cell(planner, "year-5");
  assert.equal(yearFive.kind, "lesson");
  assert.equal(yearFive.unitTitle, "Nationalities");
  assert.equal(yearFive.lessonNumber, 4);
  assert.equal(yearFive.lessonTitle, "Where are you from?");
  assert.equal(termOverviewCellText(yearFive), "Nationalities — L4 · Where are you from?");
});

test("the same cancellation event for two of three classes outranks minority teaching", () => {
  let planner = withCalendar();
  planner = recordFor(planner, "2026-09-01", "4c", "not-taught", "Athletics Carnival");
  planner = recordFor(planner, "2026-09-01", "4b", "not-taught", "Athletics Carnival");
  planner = recordFor(planner, "2026-09-03", "4e", "completed");
  const yearFour = cell(planner, "year-4");
  assert.equal(yearFour.kind, "event");
  assert.equal(yearFour.eventTitle, "Athletics Carnival");
  assert.equal(yearFour.differentClassCount, 1);
});

test("two taught classes outrank one class at Camp", () => {
  let planner = withCalendar();
  planner = recordFor(planner, "2026-09-01", "4c", "completed");
  planner = recordFor(planner, "2026-09-01", "4b", "completed");
  planner = recordFor(planner, "2026-09-03", "4e", "not-taught", "School Camp");
  const yearFour = cell(planner, "year-4");
  assert.equal(yearFour.kind, "lesson");
  assert.equal(yearFour.unitTitle, "Weather");
  assert.equal(yearFour.lessonTitle, "Seasons");
  assert.equal(yearFour.differentClassCount, 1);
});

test("a configured Curriculum Day is reliable event evidence without fake sessions", () => {
  const planner = withCalendar();
  planner.nonTeachingPeriods = [{ id: "curriculum-day", schoolYearId: "year-2026", type: "curriculum_day", name: "Curriculum Day", startDate: "2026-09-02", endDate: "2026-09-02" }];
  const sessionsBefore = structuredClone(planner.teachingSessions);
  const yearFive = cell(planner, "year-5");
  assert.equal(yearFive.kind, "event");
  assert.equal(yearFive.eventTitle, "Curriculum Day");
  assert.deepEqual(planner.teachingSessions, sessionsBefore);
});

test("an even material split never claims a false majority", () => {
  let planner = withCalendar();
  planner.classProgress["4b"] = { ...planner.classProgress["4b"], lessonId: "weather-lesson-4" };
  planner = recordFor(planner, "2026-09-01", "4c", "completed");
  planner = recordFor(planner, "2026-09-01", "4b", "completed");
  const yearFour = cell(planner, "year-4");
  assert.equal(yearFour.kind, "split");
  assert.equal(yearFour.alternatives.length, 2);
  assert.match(termOverviewCellText(yearFour), /^Split:/);
});

test("Excel is a valid XLSX snapshot of the exact screen dataset", () => {
  let planner = withCalendar();
  planner = recordFor(planner, "2026-09-01", "4c", "not-taught", "Athletics Carnival");
  planner = recordFor(planner, "2026-09-01", "4b", "not-taught", "Athletics Carnival");
  planner = recordFor(planner, "2026-09-03", "4e", "completed");
  const dataset = deriveTermOverviewDataset(planner, "term-3");
  const workbook = unzipSync(buildTermOverviewWorkbook(dataset));
  assert.ok(workbook["xl/workbook.xml"]);
  assert.ok(workbook["xl/worksheets/sheet1.xml"]);
  const sheet = strFromU8(workbook["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /Teaching Week/);
  assert.match(sheet, /Dates/);
  assert.match(sheet, /Prep/);
  assert.match(sheet, /Year 6/);
  assert.match(sheet, /Athletics Carnival/);
  assert.match(sheet, /state="frozen"/);
  assert.ok(
    sheet.indexOf("<autoFilter") < sheet.indexOf("<mergeCells"),
    "worksheet child elements must follow Excel's OOXML schema order",
  );
  assert.doesNotMatch(sheet, /plannedUnitId|mutationId|ownerUid|@/);
  const screenValue = termOverviewCellText(dataset.rows[0].cells.find((item) => item.yearLevelId === "year-4"));
  assert.ok(sheet.includes(screenValue));
});

test("alignment checkpoints survive JSON backup/import without changing IDs", () => {
  const planner = alignClassWithCohort(withCalendar(), "4e", "2026-09-04");
  const restored = importPlannerData(exportPlannerData(planner));
  assert.deepEqual(restored.progressCheckpoints["4e"], planner.progressCheckpoints["4e"]);
  assert.deepEqual(restored.classProgress["4e"], planner.classProgress["4e"]);
  assert.deepEqual(restored.units.map((unit) => unit.id), planner.units.map((unit) => unit.id));
});
