import assert from "node:assert/strict";
import test from "node:test";
import {
  getTeachingSessionsForDate,
  latestRecordedTeachingSession,
  markAllTaughtAsPlanned,
  materializeTeachingSessionsForDate,
  recordTeachingSessionOutcome,
  setClassLesson,
  setClassPosition,
  updateLessonRecord,
} from "../lib/domain.ts";
import { exportPlannerData, importPlannerData, loadPlanner, persistPlanner, STORAGE_KEY } from "../lib/storage.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";

const wednesday = new Date(2026, 8, 2);
const thursday = new Date(2026, 8, 3);

function materialized(date = wednesday) {
  return materializeTeachingSessionsForDate(freshSamplePlanner(), date);
}

function sessionFor(planner, classId, date = wednesday) {
  return getTeachingSessionsForDate(planner, date).find((item) => item.classId === classId);
}

test("Completed advances exactly one class and leaves its peer unchanged", () => {
  const planner = materialized();
  const beforePeer = planner.classProgress["5c"].lessonId;
  const completed = recordTeachingSessionOutcome(planner, sessionFor(planner, "5e").id, "completed");
  assert.equal(completed.classProgress["5e"].lessonId, "nationalities-lesson-5");
  assert.equal(completed.classProgress["5c"].lessonId, beforePeer);
});

test("Partial preserves progress and its optional note", () => {
  const planner = materialized();
  const partial = recordTeachingSessionOutcome(planner, sessionFor(planner, "5e").id, "partial", "Stopped after Activity 3");
  assert.equal(partial.classProgress["5e"].lessonId, "nationalities-lesson-4");
  assert.equal(sessionFor(partial, "5e").note, "Stopped after Activity 3");
});

test("Not taught preserves progress and its reason", () => {
  const planner = materialized(thursday);
  const missed = recordTeachingSessionOutcome(planner, sessionFor(planner, "4e", thursday).id, "not-taught", "Year 4 Camp");
  assert.equal(missed.classProgress["4e"].lessonId, "weather-lesson-2");
  assert.equal(sessionFor(missed, "4e", thursday).reason, "Year 4 Camp");
});

test("All taught as planned completes only eligible specialist teaching occurrences", () => {
  const completed = markAllTaughtAsPlanned(freshSamplePlanner(), wednesday);
  const sessions = getTeachingSessionsForDate(completed, wednesday);
  assert.equal(sessions.length, 4);
  assert.equal(sessions.every((item) => item.outcome === "completed"), true);
  assert.deepEqual(sessions.map((item) => item.classId), ["5e", "5c", "2c", "2a"]);
  assert.equal(completed.teachingSessions.some((item) => item.timetableSessionId === "sample-cover"), false);
});

test("bulk completion preserves an exception that was already recorded", () => {
  const planner = materialized();
  const exception = recordTeachingSessionOutcome(planner, sessionFor(planner, "5e").id, "not-taught", "Excursion");
  const completed = markAllTaughtAsPlanned(exception, wednesday);
  assert.equal(sessionFor(completed, "5e").outcome, "not-taught");
  assert.equal(sessionFor(completed, "5e").reason, "Excursion");
  assert.equal(getTeachingSessionsForDate(completed, wednesday).filter((item) => item.outcome === "completed").length, 3);
});

test("editing Completed to Partial reverses and safely reconciles progress", () => {
  const planner = materialized();
  const id = sessionFor(planner, "5e").id;
  const completed = recordTeachingSessionOutcome(planner, id, "completed");
  const corrected = recordTeachingSessionOutcome(completed, id, "partial", "Only first half");
  assert.equal(corrected.classProgress["5e"].lessonId, "nationalities-lesson-4");
  assert.equal(sessionFor(corrected, "5e").outcome, "partial");
});

test("editing Not taught to Completed advances once and repeated saves never double-advance", () => {
  const planner = materialized();
  const id = sessionFor(planner, "5e").id;
  const missed = recordTeachingSessionOutcome(planner, id, "not-taught", "Assembly");
  const completed = recordTeachingSessionOutcome(missed, id, "completed");
  const savedAgain = recordTeachingSessionOutcome(completed, id, "completed");
  assert.equal(completed.classProgress["5e"].lessonId, "nationalities-lesson-5");
  assert.deepEqual(savedAgain.classProgress["5e"], completed.classProgress["5e"]);
});

test("clearing an outcome returns it to Planned and reconciles progress", () => {
  const planner = materialized();
  const id = sessionFor(planner, "5e").id;
  const completed = recordTeachingSessionOutcome(planner, id, "completed");
  const cleared = recordTeachingSessionOutcome(completed, id, "planned");
  assert.equal(cleared.classProgress["5e"].lessonId, "nationalities-lesson-4");
  assert.equal(sessionFor(cleared, "5e").outcome, "planned");
});

test("Teaching Sessions survive localStorage and JSON backup round trips", () => {
  const planner = materialized(thursday);
  const recorded = recordTeachingSessionOutcome(planner, sessionFor(planner, "4e", thursday).id, "not-taught", "Year 4 Camp");
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  persistPlanner(storage, recorded);
  const loaded = loadPlanner(storage, freshSamplePlanner()).planner;
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).teachingSessions.length, recorded.teachingSessions.length);
  assert.equal(latestRecordedTeachingSession(loaded, "4e").reason, "Year 4 Camp");
  assert.deepEqual(JSON.parse(JSON.stringify(importPlannerData(exportPlannerData(recorded)))), JSON.parse(JSON.stringify(recorded)));
});

test("planned Unit and Lesson snapshots survive later title edits", () => {
  const planner = materialized();
  const session = sessionFor(planner, "5e");
  const renamed = updateLessonRecord(planner, "nationalities", "nationalities-lesson-4", "Renamed later");
  assert.equal(sessionFor(renamed, "5e").plannedLessonTitle, session.plannedLessonTitle);
});

test("cross-Unit class progress remains valid through a teaching outcome", () => {
  let planner = freshSamplePlanner();
  planner.units.push({ id: "body-parts", yearLevelId: "year-1", title: "Body Parts", lessons: [1, 2].map((number) => ({ id: `body-${number}`, title: `Body ${number}`, sequence: number })) });
  planner = setClassPosition(planner, "1c", "body-parts", "body-1");
  planner = materializeTeachingSessionsForDate(planner, thursday);
  const completed = recordTeachingSessionOutcome(planner, sessionFor(planner, "1c", thursday).id, "completed");
  assert.deepEqual(completed.classProgress["1c"], { classId: "1c", unitId: "body-parts", lessonId: "body-2" });
  assert.equal(completed.classProgress["1d"].unitId, "my-family");
});

test("final-Lesson completion stops at Unit complete and never guesses another Unit", () => {
  const followingWednesday = new Date(2026, 8, 9);
  let planner = freshSamplePlanner();
  planner = setClassLesson(planner, "5e", "nationalities-lesson-6");
  planner = materializeTeachingSessionsForDate(planner, followingWednesday);
  const completed = recordTeachingSessionOutcome(planner, sessionFor(planner, "5e", followingWednesday).id, "completed");
  assert.equal(completed.classProgress["5e"].unitId, "nationalities");
  assert.equal(completed.classProgress["5e"].lessonId, "nationalities-lesson-6");
  assert.equal(completed.classProgress["5e"].unitComplete, true);
});

test("manual correction creates a new progress baseline without erasing history", () => {
  const planner = materialized();
  const id = sessionFor(planner, "5e").id;
  const completed = recordTeachingSessionOutcome(planner, id, "completed");
  const corrected = setClassLesson(completed, "5e", "nationalities-lesson-3");
  assert.equal(corrected.classProgress["5e"].lessonId, "nationalities-lesson-3");
  assert.equal(corrected.progressBaselines["5e"].lessonId, "nationalities-lesson-3");
  assert.equal(corrected.teachingSessions.find((item) => item.id === id).outcome, "completed");
  assert.equal(corrected.teachingSessions.find((item) => item.id === id).affectsProgress, false);
});

test("4E Camp is preserved end-to-end without advancing progress", () => {
  const planner = materialized(thursday);
  const id = sessionFor(planner, "4e", thursday).id;
  const recorded = recordTeachingSessionOutcome(planner, id, "not-taught", "Year 4 Camp");
  const restored = importPlannerData(exportPlannerData(recorded));
  const previous = latestRecordedTeachingSession(restored, "4e");
  assert.equal(restored.classProgress["4e"].lessonId, "weather-lesson-2");
  assert.equal(previous.outcome, "not-taught");
  assert.equal(previous.reason, "Year 4 Camp");
});
