import assert from "node:assert/strict";
import test from "node:test";
import {
  PLANNER_SCHEMA_VERSION,
  clampLesson,
  createClassRecord,
  createUnitRecord,
  deleteClassRecord,
  deleteLessonRecord,
  deleteUnitRecord,
  getProgressStatus,
  getTeachingSessionsForWeekday,
  getYearLevelExceptions,
  lessonPosition,
  moveProgress,
  renameClassRecord,
  reorderLessonRecord,
  setProgress,
  updateLessonRecord,
} from "../lib/domain.ts";
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  exportPlannerData,
  importPlannerData,
  loadPlanner,
  persistPlanner,
  persistProgress,
  restoreProgress,
} from "../lib/storage.ts";

function fixture() {
  const lesson = (number, title) => ({ id: `u5-l${number}`, title, sequence: number });
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    id: "planner",
    subjects: [{ id: "subject", name: "Mandarin" }],
    activeSubjectId: "subject",
    yearLevels: [{ id: "y5", label: "Year 5", shortLabel: "5", currentUnitId: "u5", expectedLessonId: "u5-l4" }],
    classes: [{ id: "5e", name: "5E", yearLevelId: "y5" }, { id: "5c", name: "5C", yearLevelId: "y5" }],
    units: [{ id: "u5", yearLevelId: "y5", title: "Nationalities", lessons: [lesson(1, "Countries"), lesson(2, "Nationalities"), lesson(3, "Where are you from?"), lesson(4, "Where do you live?"), lesson(5, "Review")] }],
    classProgress: {
      "5e": { classId: "5e", unitId: "u5", lessonId: "u5-l4" },
      "5c": { classId: "5c", unitId: "u5", lessonId: "u5-l3" },
    },
    timetableSessions: [
      { id: "teach", weekday: 3, startTime: "08:55", endTime: "09:55", classId: "5e", subjectId: "subject", type: "specialist-teaching", outcome: "planned" },
      { id: "cover", weekday: 3, startTime: "10:00", endTime: "11:00", classId: "5c", type: "cover-release" },
    ],
    trialNotes: [{ id: "note", text: "Half a lesson", createdAt: "2026-08-23T00:00:00.000Z", classId: "5c", context: "Class drawer" }],
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
}

const oldClasses = [{ id: "5e", name: "5E", yearLevelId: "y5" }, { id: "5c", name: "5C", yearLevelId: "y5" }];

test("classes hold independent lesson progress", () => {
  const progress = { "5e": 4, "5c": 3 };
  assert.equal(progress["5e"], 4);
  assert.equal(progress["5c"], 3);
});

test("advancing one class does not advance another", () => {
  const before = { "5e": 4, "5c": 3 };
  const after = moveProgress(before, "5c", 1, 6);
  assert.deepEqual(after, { "5e": 4, "5c": 4 });
  assert.deepEqual(before, { "5e": 4, "5c": 3 });
});

test("cohort divergence and one-lesson-behind wording remain precise", () => {
  assert.deepEqual(getYearLevelExceptions(oldClasses, { "5e": 4, "5c": 3 }, 4).map((item) => item.id), ["5c"]);
  assert.deepEqual(getProgressStatus(3, 4), { kind: "behind", difference: -1, label: "1 lesson behind" });
});

test("creating and editing a class uses a stable ID and independent progress", () => {
  const created = createClassRecord(fixture(), { id: "5blue", name: "Grade 5 Blue", yearLevelId: "y5" });
  assert.equal(created.classes.at(-1).name, "Grade 5 Blue");
  assert.equal(created.classProgress["5blue"].lessonId, "u5-l1");
  const renamed = renameClassRecord(created, "5blue", "5 North");
  assert.equal(renamed.classes.find((item) => item.id === "5blue").name, "5 North");
  assert.equal(renamed.classProgress["5blue"].lessonId, "u5-l1");
  assert.equal(renamed.classProgress["5e"].lessonId, "u5-l4");
});

test("creating a unit sets stable current-unit, expected-lesson and progress references", () => {
  const planner = fixture();
  planner.yearLevels.push({ id: "y6", label: "Year 6", shortLabel: "6", currentUnitId: null, expectedLessonId: null });
  planner.classes.push({ id: "6a", name: "6A", yearLevelId: "y6" });
  const created = createUnitRecord(planner, { id: "travel", yearLevelId: "y6", title: "Travel", lessons: [{ id: "travel-first", title: "Places", sequence: 1 }] });
  const level = created.yearLevels.find((item) => item.id === "y6");
  assert.equal(level.currentUnitId, "travel");
  assert.equal(level.expectedLessonId, "travel-first");
  assert.equal(created.classProgress["6a"].lessonId, "travel-first");
});

test("ordered lesson reordering keeps class progress on the same lesson ID", () => {
  const before = fixture();
  const reordered = reorderLessonRecord(before, "u5", "u5-l4", -1);
  const unit = reordered.units[0];
  assert.equal(reordered.classProgress["5e"].lessonId, "u5-l4");
  assert.equal(lessonPosition(unit, "u5-l4"), 3);
  assert.deepEqual(unit.lessons.map((item) => item.sequence), [1, 2, 3, 4, 5]);
});

test("editing a lesson title does not change class progress", () => {
  const renamed = updateLessonRecord(fixture(), "u5", "u5-l4", "Where do you call home?");
  assert.equal(renamed.units[0].lessons[3].title, "Where do you call home?");
  assert.equal(renamed.classProgress["5e"].lessonId, "u5-l4");
});

test("timetable filtering excludes cover and every non-teaching session", () => {
  const sessions = [
    ...fixture().timetableSessions,
    { id: "planning", weekday: 3, startTime: "11:00", endTime: "12:00", type: "planning" },
    { id: "assembly", weekday: 3, startTime: "12:00", endTime: "13:00", type: "school-activity" },
  ];
  assert.deepEqual(getTeachingSessionsForWeekday(sessions, 3).map((item) => item.id), ["teach"]);
});

test("export contains the complete planner and import restores it", () => {
  const planner = fixture();
  const json = exportPlannerData(planner);
  const parsed = JSON.parse(json);
  assert.equal(parsed.subjects[0].name, "Mandarin");
  assert.equal(parsed.units[0].lessons.length, 5);
  assert.equal(parsed.classProgress["5c"].lessonId, "u5-l3");
  assert.equal(parsed.timetableSessions.length, 2);
  assert.equal(parsed.trialNotes[0].text, "Half a lesson");
  assert.deepEqual(JSON.parse(JSON.stringify(importPlannerData(json))), parsed);
});

test("invalid import is rejected without returning partial data", () => {
  assert.throws(() => importPlannerData("not json"), /not valid JSON/);
  assert.throws(() => importPlannerData(JSON.stringify({ schemaVersion: 2 })), /collections/);
  const invalid = fixture();
  invalid.classes[0].yearLevelId = "missing";
  assert.throws(() => importPlannerData(JSON.stringify(invalid)), /no valid year level/);
});

test("localStorage v2 persists fully and v0.1 numeric progress migrates safely", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
  persistPlanner(storage, fixture());
  assert.equal(loadPlanner(storage, fixture()).source, "v2");
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).trialNotes.length, 1);

  memory.delete(STORAGE_KEY);
  memory.set(LEGACY_STORAGE_KEY, JSON.stringify({ "5e": 2, "5c": 3 }));
  const migrated = loadPlanner(storage, fixture());
  assert.equal(migrated.source, "migrated-v1");
  assert.equal(migrated.planner.classProgress["5e"].lessonId, "u5-l2");
  assert.equal(migrated.planner.classProgress["5c"].lessonId, "u5-l3");
});

test("deleting referenced records repairs or removes dependants safely", () => {
  const lessonDeleted = deleteLessonRecord(fixture(), "u5", "u5-l4");
  assert.equal(lessonDeleted.classProgress["5e"].lessonId, "u5-l5");
  assert.equal(lessonDeleted.yearLevels[0].expectedLessonId, "u5-l5");
  assert.equal(lessonDeleted.units[0].lessons.length, 4);

  const classDeleted = deleteClassRecord(fixture(), "5c");
  assert.equal(classDeleted.classes.some((item) => item.id === "5c"), false);
  assert.equal(classDeleted.classProgress["5c"], undefined);
  assert.equal(classDeleted.timetableSessions.some((item) => item.classId === "5c"), false);
  assert.equal(classDeleted.trialNotes[0].classId, undefined);

  assert.throws(() => deleteUnitRecord(fixture(), "u5"), /Set another current unit/);
});

test("legacy progress API remains readable and boundary-safe", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  persistProgress(storage, { "5e": 4, "5c": 3 });
  assert.equal(memory.has(LEGACY_STORAGE_KEY), true);
  assert.deepEqual(restoreProgress(storage, { "5e": 4, "5c": 4, "6b": 2 }), { "5e": 4, "5c": 3, "6b": 2 });
  assert.equal(clampLesson(0, 6), 1);
  assert.equal(clampLesson(7, 6), 6);
  assert.equal(clampLesson(2.5, 6), 1);
  assert.equal(moveProgress({ "5c": 1 }, "5c", -1, 6)["5c"], 1);
  assert.equal(setProgress({ "5c": 3 }, "5c", 99, 6)["5c"], 6);
});
