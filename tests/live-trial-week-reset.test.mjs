import assert from "node:assert/strict";
import test from "node:test";
import { CLASS_COLOUR_PRESETS, getCohortProgressStatus, lessonPosition } from "../lib/domain.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { applyLiveTrialWeekReset, LIVE_TRIAL_WEEK_RESET_KEY } from "../lib/live-trial-week-reset.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { deriveTeachingWeek } from "../lib/week-planner.ts";

const unitTitles = {
  travel: "Chinese Names",
  weather: "Australian States and Territories",
  nationalities: "Countries and Nationalities",
  animals: "Family",
  "my-family": "Pets",
  "hello-friends": "Numbers",
  "daily-life": "Mini Self-intro",
};

function fixture() {
  const planner = freshSamplePlanner();
  planner.units = planner.units.map(unit => unitTitles[unit.id] ? { ...unit, title: unitTitles[unit.id] } : unit);
  planner.classColours = Object.fromEntries(planner.classes.map((item, index) => [item.id, Object.keys(CLASS_COLOUR_PRESETS)[index % 7]]));
  for (const classId of ["prep-e", "prep-c", "prep-b", "3a", "3b"]) {
    planner.progressCheckpoints[classId] = { ...planner.classProgress[classId], effectiveDate: "2026-09-04", createdAt: "2026-09-04T00:00:00.000Z", reason: "Keep me" };
  }
  planner.teachingSessions.push({ id: "keep-prep", date: "2026-09-02", timetableSessionId: "wed-prep-e", subjectId: planner.activeSubjectId, classId: "prep-e", yearLevelId: "prep", plannedUnitId: "hello-friends", plannedLessonId: "hello-friends-lesson-4", plannedUnitTitle: "Numbers", plannedLessonTitle: "Classroom greetings", outcome: "completed", affectsProgress: false, createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z" });
  return planner;
}

function result() {
  const reset = applyLiveTrialWeekReset(fixture());
  assert.equal(reset.applied, true);
  assert.deepEqual(reset.missing, []);
  return reset.planner;
}

function status(planner, classId) {
  const specialistClass = planner.classes.find(item => item.id === classId);
  const level = planner.yearLevels.find(item => item.id === specialistClass.yearLevelId);
  const progress = planner.classProgress[classId];
  const unit = planner.units.find(item => item.id === progress.unitId);
  const expectedUnit = planner.units.find(item => item.id === level.currentUnitId);
  return getCohortProgressStatus(unit.id, lessonPosition(unit, progress.lessonId), expectedUnit.id, lessonPosition(expectedUnit, level.expectedLessonId)).label;
}

function weekEntry(planner, anchor, classId) {
  return deriveTeachingWeek(planner, new Date(`${anchor}T12:00:00`), new Date("2026-09-04T12:00:00"))
    .days.flatMap(day => day.entries).find(entry => entry.specialistClass?.id === classId);
}

test("v2 uses a new one-time marker", () => {
  assert.equal(LIVE_TRIAL_WEEK_RESET_KEY, "specialist-planner.reset.2026-08-31.v2");
});

test("completed Year 4, 5 and 6 lessons become next week's on-track positions", () => {
  const planner = result();
  const expected = { "6b": ["Chinese Names", 6], "6d": ["Chinese Names", 6], "4c": ["Australian States and Territories", 5], "4b": ["Australian States and Territories", 5], "5e": ["Countries and Nationalities", 4], "5c": ["Countries and Nationalities", 4] };
  for (const [classId, [title, nextPosition]] of Object.entries(expected)) {
    const progress = planner.classProgress[classId];
    const unit = planner.units.find(item => item.id === progress.unitId);
    assert.equal(unit.title, title, classId);
    assert.equal(lessonPosition(unit, progress.lessonId), nextPosition, classId);
    assert.equal(status(planner, classId), "On track", classId);
    const record = planner.teachingSessions.find(item => item.classId === classId && item.date >= "2026-08-31" && item.date <= "2026-09-04");
    assert.equal(record.outcome, "completed", classId);
    assert.equal(lessonPosition(unit, record.plannedLessonId), nextPosition - 1, classId);
    assert.equal(record.affectsProgress, false, classId);
  }
});

test("4E is one behind on this week's cancelled L3 card and two behind next week", () => {
  const planner = result();
  const progress = planner.classProgress["4e"];
  const unit = planner.units.find(item => item.id === progress.unitId);
  assert.equal(lessonPosition(unit, progress.lessonId), 3);
  assert.equal(status(planner, "4e"), "2 lessons behind");
  const thisWeek = weekEntry(planner, "2026-08-31", "4e");
  const nextWeek = weekEntry(planner, "2026-09-07", "4e");
  assert.equal(thisWeek.session.outcome, "not-taught");
  assert.equal(thisWeek.session.reason, "Cancelled");
  assert.equal(thisWeek.lessonNumber, 3);
  assert.equal(thisWeek.progressStatus.label, "1 lesson behind");
  assert.equal(nextWeek.lessonNumber, 3);
  assert.equal(nextWeek.progressStatus.label, "2 lessons behind");
});

test("4E has a prior-week cancelled L3 record with Camp as the reason", () => {
  const planner = result();
  const record = planner.teachingSessions.find(item => item.classId === "4e" && item.date === "2026-08-27");
  assert.equal(record.outcome, "not-taught");
  assert.equal(record.reason, "Camp");
  assert.equal(record.plannedLessonId, planner.classProgress["4e"].lessonId);
  assert.equal(record.affectsProgress, false);
  assert.equal(weekEntry(planner, "2026-08-24", "4e").progressStatus.label, "On track");
});

test("1C, 2C, 2A and 1D keep their accurate progress and become Completed", () => {
  const before = fixture();
  const after = applyLiveTrialWeekReset(before).planner;
  for (const classId of ["1c", "2c", "2a", "1d"]) {
    assert.deepEqual(after.classProgress[classId], before.classProgress[classId], classId);
    assert.deepEqual(after.progressBaselines[classId], before.progressBaselines[classId], classId);
    const record = after.teachingSessions.find(item => item.classId === classId && item.date >= "2026-08-31" && item.date <= "2026-09-04");
    assert.equal(record.outcome, "completed", classId);
    assert.equal(record.affectsProgress, false, classId);
  }
});

test("Prep stays on Wednesday and 2C/2A stay on Thursday without changing their progress", () => {
  const planner = result();
  const timetable = classId => planner.timetableSessions.find(item => item.classId === classId && item.type === "specialist-teaching");
  assert.deepEqual([timetable("prep-e").weekday, timetable("prep-e").startTime, timetable("prep-e").endTime], [3, "11:15", "12:15"]);
  assert.deepEqual([timetable("prep-c").weekday, timetable("prep-c").startTime, timetable("prep-c").endTime], [3, "12:15", "13:15"]);
  assert.deepEqual([timetable("2c").weekday, timetable("2c").startTime, timetable("2c").endTime], [4, "11:15", "12:15"]);
  assert.deepEqual([timetable("2a").weekday, timetable("2a").startTime, timetable("2a").endTime], [4, "12:15", "13:15"]);
  assert.equal(planner.teachingSessions.find(item => item.classId === "2c" && item.outcome === "completed").date, "2026-09-03");
});

test("Prep and Year 3 progress, baselines, checkpoints and history stay exactly unchanged", () => {
  const before = fixture();
  const after = applyLiveTrialWeekReset(before).planner;
  for (const classId of ["prep-e", "prep-c", "prep-b", "3a", "3b"]) {
    assert.deepEqual(after.classProgress[classId], before.classProgress[classId], classId);
    assert.deepEqual(after.progressBaselines[classId], before.progressBaselines[classId], classId);
    assert.deepEqual(after.progressCheckpoints[classId], before.progressCheckpoints[classId], classId);
    assert.deepEqual(after.teachingSessions.filter(item => item.classId === classId), before.teachingSessions.filter(item => item.classId === classId), classId);
  }
});

test("all existing class colours are preserved exactly", () => {
  const before = fixture();
  const after = applyLiveTrialWeekReset(before).planner;
  assert.deepEqual(after.classColours, before.classColours);
});

test("the corrected result remains valid through JSON backup and restore", () => {
  const planner = result();
  const restored = importPlannerData(exportPlannerData(planner));
  assert.deepEqual(restored.classColours, planner.classColours);
  assert.equal(status(restored, "4e"), "2 lessons behind");
  assert.equal(restored.teachingSessions.find(item => item.classId === "4e" && item.date === "2026-08-27").reason, "Camp");
});

test("an incomplete target dataset is left entirely untouched", () => {
  const planner = fixture();
  planner.units = planner.units.filter(item => item.title !== "Countries and Nationalities");
  const reset = applyLiveTrialWeekReset(planner);
  assert.equal(reset.applied, false);
  assert.deepEqual(reset.planner, planner);
  assert.equal(reset.missing.some(item => item.startsWith("5E:")), true);
});
