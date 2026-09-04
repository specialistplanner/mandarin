import assert from "node:assert/strict";
import test from "node:test";
import { CLASS_COLOUR_PRESETS, getCohortProgressStatus, lessonPosition } from "../lib/domain.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { applyLiveTrialWeekReset } from "../lib/live-trial-week-reset.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";

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
  const addSession = (id, date, classId) => {
    const specialistClass = planner.classes.find(item => item.id === classId);
    const timetable = planner.timetableSessions.find(item => item.classId === classId && item.type === "specialist-teaching");
    const progress = planner.classProgress[classId];
    const unit = planner.units.find(item => item.id === progress.unitId);
    const lesson = unit.lessons.find(item => item.id === progress.lessonId);
    planner.teachingSessions.push({ id, date, timetableSessionId: timetable.id, subjectId: planner.activeSubjectId, classId, yearLevelId: specialistClass.yearLevelId, plannedUnitId: unit.id, plannedLessonId: lesson.id, plannedUnitTitle: unit.title, plannedLessonTitle: lesson.title, outcome: "completed", affectsProgress: true, createdAt: `${date}T00:00:00.000Z`, updatedAt: `${date}T00:00:00.000Z` });
  };
  addSession("before", "2026-08-28", "4e");
  addSession("during", "2026-09-01", "4c");
  addSession("after", "2026-09-05", "4e");
  return planner;
}

function result() {
  const reset = applyLiveTrialWeekReset(fixture());
  assert.equal(reset.applied, true);
  assert.deepEqual(reset.missing, []);
  return reset.planner;
}

test("reset applies every requested class Unit and Teach Next Lesson", () => {
  const planner = result();
  const expected = { "6b": ["Chinese Names", 5], "6d": ["Chinese Names", 5], "4c": ["Australian States and Territories", 4], "4b": ["Australian States and Territories", 4], "4e": ["Australian States and Territories", 3], "5e": ["Countries and Nationalities", 3], "5c": ["Countries and Nationalities", 3], "2c": ["Family", 1], "2a": ["Family", 1], "1c": ["Pets", 1], "1d": ["Pets", 2], "prep-e": ["Numbers", 4], "prep-c": ["Numbers", 4], "prep-b": ["Numbers", 5], "3a": ["Mini Self-intro", 4], "3b": ["Mini Self-intro", 4] };
  for (const [classId, [title, position]] of Object.entries(expected)) {
    const progress = planner.classProgress[classId];
    const unit = planner.units.find(item => item.id === progress.unitId);
    assert.equal(unit.title, title, classId);
    assert.equal(lessonPosition(unit, progress.lessonId), position, classId);
    assert.equal(progress.unitComplete, undefined, classId);
  }
});

test("cohort references produce the requested exceptions", () => {
  const planner = result();
  const status = classId => {
    const specialistClass = planner.classes.find(item => item.id === classId);
    const level = planner.yearLevels.find(item => item.id === specialistClass.yearLevelId);
    const progress = planner.classProgress[classId];
    const unit = planner.units.find(item => item.id === progress.unitId);
    const expectedUnit = planner.units.find(item => item.id === level.currentUnitId);
    return getCohortProgressStatus(unit.id, lessonPosition(unit, progress.lessonId), expectedUnit.id, lessonPosition(expectedUnit, level.expectedLessonId)).label;
  };
  assert.equal(status("1d"), "On track");
  assert.equal(status("1c"), "1 lesson behind");
  assert.equal(status("prep-b"), "1 lesson ahead");
  for (const classId of ["6b", "6d", "4c", "4b", "5e", "5c", "2c", "2a", "prep-e", "prep-c", "3a", "3b"]) assert.equal(status(classId), "On track", classId);
});

test("4E is recorded once as Cancelled and Not taught without advancing", () => {
  const planner = result();
  const records = planner.teachingSessions.filter(item => item.classId === "4e" && item.date === "2026-09-03");
  assert.equal(records.length, 1);
  assert.equal(records[0].outcome, "not-taught");
  assert.equal(records[0].reason, "Cancelled");
  assert.equal(records[0].affectsProgress, false);
  assert.equal(planner.classProgress["4e"].lessonId, records[0].plannedLessonId);
});

test("Prep remains Wednesday and 2C/2A move to Thursday at matching times", () => {
  const planner = result();
  const timetable = classId => planner.timetableSessions.find(item => item.classId === classId && item.type === "specialist-teaching");
  assert.deepEqual([timetable("prep-e").weekday, timetable("prep-e").startTime, timetable("prep-e").endTime], [3, "11:15", "12:15"]);
  assert.deepEqual([timetable("prep-c").weekday, timetable("prep-c").startTime, timetable("prep-c").endTime], [3, "12:15", "13:15"]);
  assert.deepEqual([timetable("2c").weekday, timetable("2c").startTime, timetable("2c").endTime], [4, "11:15", "12:15"]);
  assert.deepEqual([timetable("2a").weekday, timetable("2a").startTime, timetable("2a").endTime], [4, "12:15", "13:15"]);
});

test("all existing class colours are preserved exactly", () => {
  const before = fixture();
  const after = applyLiveTrialWeekReset(before).planner;
  assert.deepEqual(after.classColours, before.classColours);
});

test("unrelated history is retained and current-week sessions cannot re-advance reset progress", () => {
  const planner = result();
  assert.equal(planner.teachingSessions.find(item => item.id === "before").affectsProgress, true);
  assert.equal(planner.teachingSessions.find(item => item.id === "during").affectsProgress, false);
  assert.equal(planner.teachingSessions.find(item => item.id === "after").affectsProgress, true);
});

test("the reset result remains valid through JSON backup and restore", () => {
  const planner = result();
  const restored = importPlannerData(exportPlannerData(planner));
  assert.deepEqual(restored.classColours, planner.classColours);
  assert.equal(restored.teachingSessions.find(item => item.classId === "4e" && item.date === "2026-09-03").reason, "Cancelled");
});

test("an incomplete target dataset is left entirely untouched", () => {
  const planner = fixture();
  planner.units = planner.units.filter(item => item.title !== "Family");
  const reset = applyLiveTrialWeekReset(planner);
  assert.equal(reset.applied, false);
  assert.deepEqual(reset.planner, planner);
  assert.equal(reset.missing.some(item => item.startsWith("2C:")), true);
});
