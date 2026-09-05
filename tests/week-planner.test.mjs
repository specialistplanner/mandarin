import assert from "node:assert/strict";
import test from "node:test";
import {
  getTeachingSessionsForDate,
  markAllTaughtAsPlanned,
  materializeTeachingSessionsForDate,
  reconcilePreviousTeaching,
  recordTeachingSessionOutcome,
  setClassColour,
} from "../lib/domain.ts";
import { deriveTeachingWeek, shiftTeachingWeek, startOfTeachingWeek } from "../lib/week-planner.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";

const wednesday = new Date(2026, 8, 2, 12);
const nextWednesday = new Date(2026, 8, 9, 12);

function teachingEntries(week) {
  return week.days.flatMap((day) => day.entries).filter((entry) => entry.kind === "teaching");
}

function entryFor(week, classId) {
  return teachingEntries(week).find((entry) => entry.specialistClass?.id === classId);
}

function saveOutcome(planner, date, classId, outcome, detail = "") {
  const materialized = materializeTeachingSessionsForDate(planner, date);
  const session = getTeachingSessionsForDate(materialized, date).find((item) => item.classId === classId);
  return recordTeachingSessionOutcome(materialized, session.id, outcome, detail);
}

test("Week View derives Monday-Friday sessions from the configured timetable", () => {
  const week = deriveTeachingWeek(freshSamplePlanner(), wednesday, wednesday);
  assert.equal(week.days.length, 5);
  assert.equal(teachingEntries(week).length, 16);
});

test("the correct class appears on the configured weekday and time", () => {
  const week = deriveTeachingWeek(freshSamplePlanner(), wednesday, wednesday);
  const entry = entryFor(week, "5e");
  assert.equal(entry.date, "2026-09-02");
  assert.equal(entry.timetable.startTime, "08:55");
  assert.equal(entry.timetable.endTime, "09:55");
});

test("a teaching card derives its actual Unit from class progress", () => {
  assert.equal(entryFor(deriveTeachingWeek(freshSamplePlanner(), wednesday, wednesday), "5e").unit.id, "nationalities");
});

test("a teaching card carries its class-ID colour without changing status", () => {
  const planner = setClassColour(freshSamplePlanner(), "5e", "blue");
  const entry = entryFor(deriveTeachingWeek(planner, wednesday, wednesday), "5e");
  assert.equal(entry.classColourId, "blue");
  assert.equal(entry.progressStatus.label, "On track");
  assert.equal(entry.session?.outcome ?? "planned", "planned");
});

test("a teaching card derives the correct Teach Next Lesson", () => {
  const entry = entryFor(deriveTeachingWeek(freshSamplePlanner(), wednesday, wednesday), "5e");
  assert.equal(entry.lesson.id, "nationalities-lesson-4");
  assert.equal(entry.lessonNumber, 4);
});

test("an aligned class carries an explicit On track status", () => {
  assert.equal(entryFor(deriveTeachingWeek(freshSamplePlanner(), wednesday, wednesday), "5e").progressStatus.label, "On track");
});

test("a behind class carries the correct cohort divergence", () => {
  const planner = freshSamplePlanner();
  planner.yearLevels.find((item) => item.id === "year-5").expectedLessonId = "nationalities-lesson-5";
  assert.equal(entryFor(deriveTeachingWeek(planner, wednesday, wednesday), "5c").progressStatus.label, "1 lesson behind");
});

test("a cross-Unit class displays its actual Unit and avoids lesson arithmetic", () => {
  const planner = freshSamplePlanner();
  planner.units.push({ id: "body-parts", yearLevelId: "year-1", title: "Body Parts", lessons: [{ id: "body-final", title: "Review", sequence: 1 }] });
  planner.classProgress["1c"] = { classId: "1c", unitId: "body-parts", lessonId: "body-final" };
  const entry = entryFor(deriveTeachingWeek(planner, wednesday, wednesday), "1c");
  assert.equal(entry.unit.title, "Body Parts");
  assert.equal(entry.progressStatus.kind, "different-unit");
});

test("Completed updates the Week outcome and shared Progress pointer", () => {
  const completed = saveOutcome(freshSamplePlanner(), wednesday, "5e", "completed");
  const entry = entryFor(deriveTeachingWeek(completed, wednesday, wednesday), "5e");
  assert.equal(entry.session.outcome, "completed");
  assert.equal(completed.classProgress["5e"].lessonId, "nationalities-lesson-5");
});

test("Partial keeps the same next Lesson in the following week", () => {
  const partial = saveOutcome(freshSamplePlanner(), wednesday, "5e", "partial", "Stopped after Activity 3");
  assert.equal(entryFor(deriveTeachingWeek(partial, nextWednesday, wednesday), "5e").lesson.id, "nationalities-lesson-4");
});

test("Not taught keeps the same next Lesson in the following week", () => {
  const missed = saveOutcome(freshSamplePlanner(), wednesday, "5e", "not-taught", "Excursion");
  assert.equal(entryFor(deriveTeachingWeek(missed, nextWednesday, wednesday), "5e").lesson.id, "nationalities-lesson-4");
});

test("a Not taught reason remains accessible from this and next week's cards", () => {
  const missed = saveOutcome(freshSamplePlanner(), wednesday, "5e", "not-taught", "Year 5 Camp");
  assert.equal(entryFor(deriveTeachingWeek(missed, wednesday, wednesday), "5e").session.reason, "Year 5 Camp");
  assert.equal(entryFor(deriveTeachingWeek(missed, nextWednesday, wednesday), "5e").previousSession.reason, "Year 5 Camp");
});

test("daily bulk completion affects only Specialist Teaching occurrences", () => {
  const planner = freshSamplePlanner();
  planner.timetableSessions.push({ id: "wed-planning", weekday: 3, startTime: "14:00", endTime: "15:00", type: "planning", label: "Planning" });
  const completed = markAllTaughtAsPlanned(planner, wednesday);
  assert.equal(completed.teachingSessions.length, 4);
  assert.equal(completed.teachingSessions.every((item) => item.outcome === "completed"), true);
  assert.equal(completed.teachingSessions.some((item) => item.timetableSessionId === "wed-planning"), false);
});

test("non-teaching entries provide context but can never record outcomes", () => {
  const week = deriveTeachingWeek(freshSamplePlanner(), wednesday, wednesday);
  const cover = week.days.flatMap((day) => day.entries).find((entry) => entry.timetable.id === "sample-cover");
  assert.equal(cover.kind, "non-teaching");
  assert.equal(cover.canRecordOutcome, false);
});

test("Generalist Teaching is teaching context but never affects specialist progress or outcomes", () => {
  const planner = freshSamplePlanner();
  const specialistOnlyResult = markAllTaughtAsPlanned(freshSamplePlanner(), wednesday);
  planner.timetableSessions.push({
    id: "generalist-cover",
    slotId: "session-5",
    weekday: 3,
    startTime: "14:15",
    endTime: "15:15",
    type: "generalist-teaching",
    label: "Class cover",
    customClassName: "2B",
  });
  const week = deriveTeachingWeek(planner, wednesday, wednesday);
  const cover = week.days.flatMap((day) => day.entries).find((entry) => entry.timetable.id === "generalist-cover");
  assert.equal(cover.kind, "generalist-teaching");
  assert.equal(cover.label, "Class cover");
  assert.equal(cover.contextClassName, "2B");
  assert.equal(cover.classColourId, undefined);
  assert.equal(cover.canRecordOutcome, false);
  const completed = markAllTaughtAsPlanned(planner, wednesday);
  assert.equal(completed.teachingSessions.some((item) => item.timetableSessionId === "generalist-cover"), false);
  assert.deepEqual(completed.classProgress, specialistOnlyResult.classProgress);
  const stableSessionSummary = (sessions) => sessions.map((session) => Object.fromEntries(
    Object.entries(session).filter(([key]) => key !== "createdAt" && key !== "updatedAt"),
  ));
  assert.deepEqual(stableSessionSummary(completed.teachingSessions), stableSessionSummary(specialistOnlyResult.teachingSessions));
});

test("future week projection creates no Teaching Session history", () => {
  const planner = freshSamplePlanner();
  const before = structuredClone(planner.teachingSessions);
  const week = deriveTeachingWeek(planner, nextWednesday, wednesday);
  assert.equal(entryFor(week, "5e").state, "projected");
  assert.deepEqual(planner.teachingSessions, before);
});

test("an unresolved earlier occurrence prevents a later same-class projection from leaping", () => {
  const planner = freshSamplePlanner();
  planner.timetableSessions.push({ id: "thu-5e-extra", weekday: 4, startTime: "08:55", endTime: "09:55", type: "specialist-teaching", classId: "5e", subjectId: "mandarin" });
  const week = deriveTeachingWeek(planner, nextWednesday, wednesday);
  const entries = teachingEntries(week).filter((entry) => entry.specialistClass?.id === "5e");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].lesson.id, entries[1].lesson.id);
  assert.equal(entries[1].projectionUncertain, true);
});

test("Unit complete is explicit and never invents the next Unit", () => {
  const planner = freshSamplePlanner();
  planner.classProgress["5e"] = { classId: "5e", unitId: "nationalities", lessonId: "nationalities-lesson-6", unitComplete: true };
  const entry = entryFor(deriveTeachingWeek(planner, nextWednesday, wednesday), "5e");
  assert.equal(entry.state, "unit-complete");
  assert.equal(entry.unit.id, "nationalities");
});

test("the v0.3.1 checkpoint keeps legacy occurrences inactive", () => {
  const reconciled = reconcilePreviousTeaching(freshSamplePlanner(), "2026-08-24", "2026-08-28", "2026-09-02");
  const week = deriveTeachingWeek(reconciled, new Date(2026, 7, 31, 12), wednesday);
  const monday = week.days[0].entries.filter((entry) => entry.kind === "teaching");
  assert.equal(monday.every((entry) => entry.state === "legacy" && entry.canRecordOutcome === false), true);
});

test("v0.3.1 data opens in v0.4 without losing timetable, progress, sessions, or checkpoints", () => {
  const planner = reconcilePreviousTeaching(freshSamplePlanner(), "2026-08-24", "2026-08-28", "2026-09-02");
  const opened = importPlannerData(exportPlannerData(planner));
  assert.deepEqual(opened.timetableSessions.map((item) => item.id), planner.timetableSessions.map((item) => item.id));
  assert.deepEqual(opened.classProgress, planner.classProgress);
  assert.deepEqual(opened.teachingSessions, planner.teachingSessions);
  assert.deepEqual(opened.progressCheckpoints, planner.progressCheckpoints);
});

test("backup/import preserves all state needed to derive the same Week", () => {
  const completed = saveOutcome(freshSamplePlanner(), wednesday, "5e", "completed");
  const imported = importPlannerData(exportPlannerData(completed));
  const summary = (planner) => teachingEntries(deriveTeachingWeek(planner, wednesday, wednesday)).map((entry) => ({
    key: entry.key,
    state: entry.state,
    unitId: entry.unit?.id,
    lessonId: entry.lesson?.id,
    outcome: entry.session?.outcome,
    status: entry.progressStatus?.label,
  }));
  assert.deepEqual(summary(imported), summary(completed));
});

test("repeated rendering and week navigation never duplicate Teaching Sessions", () => {
  const planner = saveOutcome(freshSamplePlanner(), wednesday, "5e", "completed");
  const before = structuredClone(planner.teachingSessions);
  deriveTeachingWeek(planner, wednesday, wednesday);
  deriveTeachingWeek(planner, shiftTeachingWeek(startOfTeachingWeek(wednesday), 1), wednesday);
  deriveTeachingWeek(planner, wednesday, wednesday);
  assert.deepEqual(planner.teachingSessions, before);
  assert.equal(new Set(planner.teachingSessions.map((item) => item.id)).size, planner.teachingSessions.length);
});
