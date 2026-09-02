import assert from "node:assert/strict";
import test from "node:test";
import {
  getCohortProgressStatus,
  getScheduledTeachingOccurrencesInRange,
  getTeachingSessionsForDate,
  lessonPosition,
  materializeTeachingSessionsForDate,
  reconcilePreviousTeaching,
  recordTeachingSessionOutcome,
} from "../lib/domain.ts";
import { exportPlannerData, importPlannerData, loadPlanner, persistPlanner, STORAGE_KEY } from "../lib/storage.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";

const startDate = "2026-08-24";
const endDate = "2026-08-28";
const checkpointDate = "2026-09-02";

function date(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function knownCurrentPlanner() {
  const planner = freshSamplePlanner();
  const lessons = { "4c": "weather-lesson-4", "4b": "weather-lesson-4", "4e": "weather-lesson-3" };
  for (const [classId, lessonId] of Object.entries(lessons)) {
    planner.classProgress[classId] = { classId, unitId: "weather", lessonId };
    planner.progressBaselines[classId] = { ...planner.classProgress[classId] };
  }
  planner.yearLevels.find((item) => item.id === "year-4").expectedLessonId = "weather-lesson-4";
  return planner;
}

function reconcile(planner = knownCurrentPlanner()) {
  return reconcilePreviousTeaching(planner, startDate, endDate, checkpointDate);
}

function historicalSession(planner, classId) {
  return planner.teachingSessions.find((item) => item.classId === classId && item.date >= startDate && item.date <= endDate);
}

test("the selected week contains every scheduled specialist occurrence and excludes cover", () => {
  const occurrences = getScheduledTeachingOccurrencesInRange(knownCurrentPlanner(), startDate, endDate);
  assert.equal(occurrences.length, 16);
  assert.equal(occurrences.some((item) => item.timetableSession.id === "sample-cover"), false);
});

test("reconciliation preserves every verified current Unit and Lesson pointer", () => {
  const before = knownCurrentPlanner();
  const snapshot = structuredClone(before.classProgress);
  const reconciled = reconcile(before);
  assert.deepEqual(reconciled.classProgress, snapshot);
});

test("historical Planned occurrences become Completed without affecting progress", () => {
  const reconciled = reconcile();
  const week = reconciled.teachingSessions.filter((item) => item.date >= startDate && item.date <= endDate);
  assert.equal(week.length, 16);
  assert.equal(week.every((item) => item.outcome === "completed"), true);
  assert.equal(week.every((item) => item.affectsProgress === false), true);
});

test("dated checkpoints freeze each class at the migration-day baseline", () => {
  const reconciled = reconcile();
  assert.equal(Object.keys(reconciled.progressCheckpoints).length, reconciled.classes.length);
  assert.equal(Object.values(reconciled.progressCheckpoints).every((item) => item.effectiveDate === checkpointDate), true);
  assert.deepEqual(reconciled.progressBaselines, reconciled.classProgress);
  assert.deepEqual(reconciled.reconciliationStatus, {
    startDate,
    throughDate: endDate,
    completedAt: reconciled.reconciliationStatus.completedAt,
  });
});

test("historical planned snapshots are reconstructed backwards from current progress", () => {
  const reconciled = reconcile();
  assert.equal(historicalSession(reconciled, "4c").plannedLessonId, "weather-lesson-3");
  assert.equal(historicalSession(reconciled, "4e").plannedLessonId, "weather-lesson-2");
});

test("4E can be changed to Not taught for Year 4 Camp without moving any class", () => {
  const reconciled = reconcile();
  const before = structuredClone(reconciled.classProgress);
  const corrected = recordTeachingSessionOutcome(reconciled, historicalSession(reconciled, "4e").id, "not-taught", "Year 4 Camp");
  assert.deepEqual(corrected.classProgress, before);
  assert.equal(historicalSession(corrected, "4e").reason, "Year 4 Camp");
  assert.equal(historicalSession(corrected, "4e").affectsProgress, false);
  assert.equal(historicalSession(corrected, "4e").plannedLessonId, "weather-lesson-3");
});

test("the Camp exception leaves only 4E one lesson behind its Year 4 cohort", () => {
  const reconciled = reconcile();
  const corrected = recordTeachingSessionOutcome(reconciled, historicalSession(reconciled, "4e").id, "not-taught", "Year 4 Camp");
  const level = corrected.yearLevels.find((item) => item.id === "year-4");
  const unit = corrected.units.find((item) => item.id === level.currentUnitId);
  const expected = lessonPosition(unit, level.expectedLessonId);
  const statuses = Object.fromEntries(corrected.classes.filter((item) => item.yearLevelId === level.id).map((item) => {
    const progress = corrected.classProgress[item.id];
    return [item.id, getCohortProgressStatus(progress.unitId, lessonPosition(unit, progress.lessonId), unit.id, expected).label];
  }));
  assert.deepEqual(statuses, { "4c": "On track", "4b": "On track", "4e": "1 lesson behind" });
});

test("re-running reconciliation is idempotent and creates no duplicate sessions", () => {
  const once = reconcile();
  const twice = reconcilePreviousTeaching(once, startDate, endDate, checkpointDate);
  assert.equal(twice.teachingSessions.length, once.teachingSessions.length);
  assert.equal(new Set(twice.teachingSessions.map((item) => item.id)).size, twice.teachingSessions.length);
  assert.deepEqual(twice.classProgress, once.classProgress);
});

test("legacy Planned sessions on or before the checkpoint are no longer active", () => {
  let planner = materializeTeachingSessionsForDate(knownCurrentPlanner(), date("2026-08-31"));
  assert.equal(getTeachingSessionsForDate(planner, date("2026-08-31")).some((item) => item.outcome === "planned"), true);
  planner = reconcile(planner);
  assert.deepEqual(getTeachingSessionsForDate(planner, date("2026-08-31")), []);
  assert.equal(planner.teachingSessions.some((item) => item.date === "2026-08-31" && item.outcome === "planned"), true);
});

test("a post-checkpoint Completed session advances once and repeated saves do not double-advance", () => {
  let planner = reconcile();
  planner = materializeTeachingSessionsForDate(planner, date("2026-09-08"));
  const session = getTeachingSessionsForDate(planner, date("2026-09-08")).find((item) => item.classId === "4c");
  assert.ok(session);
  const completed = recordTeachingSessionOutcome(planner, session.id, "completed");
  const repeated = recordTeachingSessionOutcome(completed, session.id, "completed");
  assert.equal(completed.classProgress["4c"].lessonId, "weather-lesson-5");
  assert.deepEqual(repeated.classProgress["4c"], completed.classProgress["4c"]);
  assert.equal(repeated.classProgress["4b"].lessonId, "weather-lesson-4");
});

test("checkpoints, status, history, and positions survive localStorage and JSON round trips", () => {
  const reconciled = reconcile();
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  persistPlanner(storage, reconciled);
  const loaded = loadPlanner(storage, freshSamplePlanner());
  const imported = importPlannerData(exportPlannerData(reconciled));
  assert.equal(loaded.source, "v6");
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).schemaVersion, 6);
  assert.deepEqual(loaded.planner.progressCheckpoints, reconciled.progressCheckpoints);
  assert.deepEqual(imported.reconciliationStatus, reconciled.reconciliationStatus);
  assert.deepEqual(imported.teachingSessions, reconciled.teachingSessions);
  assert.deepEqual(imported.classProgress, reconciled.classProgress);
});
