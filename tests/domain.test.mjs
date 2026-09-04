import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASS_COLOUR_PRESETS,
  PLANNER_SCHEMA_VERSION,
  clampLesson,
  createClassRecord,
  createUnitRecord,
  deleteClassRecord,
  deleteLessonRecord,
  deleteUnitRecord,
  getCohortProgressStatus,
  getProgressStatus,
  getTeachingSessionsForWeekday,
  getYearLevelExceptions,
  lessonPosition,
  moveProgress,
  renameClassRecord,
  reorderLessonRecord,
  setClassColour,
  setClassLesson,
  setClassPosition,
  setCurrentUnit,
  setProgress,
  updateUnitDetails,
  updateLessonRecord,
} from "../lib/domain.ts";
import {
  LEGACY_STORAGE_KEY,
  LEGACY_V2_STORAGE_KEY,
  LEGACY_V3_STORAGE_KEY,
  LEGACY_V4_STORAGE_KEY,
  LEGACY_V5_STORAGE_KEY,
  LEGACY_V6_STORAGE_KEY,
  LEGACY_V7_STORAGE_KEY,
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
    progressBaselines: {
      "5e": { classId: "5e", unitId: "u5", lessonId: "u5-l4" },
      "5c": { classId: "5c", unitId: "u5", lessonId: "u5-l3" },
    },
    progressCheckpoints: {},
    classColours: {},
    timetableSessions: [
      { id: "teach", weekday: 3, startTime: "08:55", endTime: "09:55", classId: "5e", subjectId: "subject", type: "specialist-teaching" },
      { id: "cover", weekday: 3, startTime: "10:00", endTime: "11:00", classId: "5c", type: "cover-release" },
    ],
    teachingSessions: [],
    trialNotes: [{ id: "note", text: "Half a lesson", createdAt: "2026-08-23T00:00:00.000Z", classId: "5c", context: "Class drawer" }],
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
}

function mixedUnitFixture() {
  const planner = fixture();
  planner.yearLevels[0] = { id: "y5", label: "Year 1", shortLabel: "1", currentUnitId: "pets", expectedLessonId: "pets-l1" };
  planner.classes = [{ id: "1c", name: "1C", yearLevelId: "y5" }, { id: "1d", name: "1D", yearLevelId: "y5" }];
  planner.units = [
    { id: "body", yearLevelId: "y5", title: "Body Parts", lessons: [1, 2, 3].map((number) => ({ id: `body-l${number}`, title: `Lesson ${number}`, sequence: number })) },
    { id: "pets", yearLevelId: "y5", title: "Pets", lessons: [1, 2, 3].map((number) => ({ id: `pets-l${number}`, title: `Lesson ${number}`, sequence: number })) },
  ];
  planner.classProgress = {
    "1c": { classId: "1c", unitId: "body", lessonId: "body-l3" },
    "1d": { classId: "1d", unitId: "pets", lessonId: "pets-l1" },
  };
  planner.progressBaselines = JSON.parse(JSON.stringify(planner.classProgress));
  planner.timetableSessions = [];
  planner.trialNotes = [];
  return planner;
}

const oldClasses = [{ id: "5e", name: "5E", yearLevelId: "y5" }, { id: "5c", name: "5C", yearLevelId: "y5" }];

test("classes hold independent lesson progress", () => {
  const progress = { "5e": 4, "5c": 3 };
  assert.equal(progress["5e"], 4);
  assert.equal(progress["5c"], 3);
});

test("optional preset colours are stored by stable class ID and clear independently", () => {
  const first = setClassColour(fixture(), "5e", "blue");
  const second = setClassColour(first, "5c", "orange");
  assert.deepEqual(second.classColours, { "5e": "blue", "5c": "orange" });
  const cleared = setClassColour(second, "5e");
  assert.deepEqual(cleared.classColours, { "5c": "orange" });
  assert.throws(() => setClassColour(fixture(), "missing", "hot-pink"), /Class not found/);
});

test("the restrained preset palette keeps foreground contrast at WCAG AA", () => {
  const channel = (hex) => {
    const value = Number.parseInt(hex, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex) => 0.2126 * channel(hex.slice(1, 3)) + 0.7152 * channel(hex.slice(3, 5)) + 0.0722 * channel(hex.slice(5, 7));
  const contrast = (one, two) => (Math.max(luminance(one), luminance(two)) + 0.05) / (Math.min(luminance(one), luminance(two)) + 0.05);
  assert.deepEqual(Object.values(CLASS_COLOUR_PRESETS).map((colour) => colour.label), ["Hot pink", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple"]);
  for (const colour of Object.values(CLASS_COLOUR_PRESETS)) assert.ok(contrast(colour.background, colour.foreground) >= 4.5, colour.label);
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

test("editable multi-word values preserve spaces during controlled input updates", () => {
  const classRenamed = renameClassRecord(fixture(), "5e", "Grade 5 Blue ");
  assert.equal(classRenamed.classes.find((item) => item.id === "5e").name, "Grade 5 Blue ");
  const unitRenamed = updateUnitDetails(classRenamed, "u5", "Body Parts ", "Australian States and Territories ");
  assert.equal(unitRenamed.units[0].title, "Body Parts ");
  assert.equal(unitRenamed.units[0].description, "Australian States and Territories ");
  const lessonRenamed = updateLessonRecord(unitRenamed, "u5", "u5-l3", "Where are you from? ");
  assert.equal(lessonRenamed.units[0].lessons[2].title, "Where are you from? ");
});

test("classes in one cohort can independently reference different units", () => {
  const planner = mixedUnitFixture();
  assert.deepEqual(planner.classProgress["1c"], { classId: "1c", unitId: "body", lessonId: "body-l3" });
  assert.deepEqual(planner.classProgress["1d"], { classId: "1d", unitId: "pets", lessonId: "pets-l1" });

  const moved = setClassPosition(planner, "1c", "pets", "pets-l2");
  assert.deepEqual(moved.classProgress["1c"], { classId: "1c", unitId: "pets", lessonId: "pets-l2" });
  assert.deepEqual(moved.classProgress["1d"], { classId: "1d", unitId: "pets", lessonId: "pets-l1" });
});

test("lesson progress stays independent inside each class unit", () => {
  const changed = setClassLesson(mixedUnitFixture(), "1c", "body-l2");
  assert.equal(changed.classProgress["1c"].lessonId, "body-l2");
  assert.equal(changed.classProgress["1d"].lessonId, "pets-l1");
});

test("cross-unit progress is categorical, never lesson arithmetic", () => {
  assert.deepEqual(getCohortProgressStatus("body", 3, "pets", 1), {
    kind: "different-unit", difference: null, label: "Different unit",
  });
  assert.notEqual(getCohortProgressStatus("body", 3, "pets", 1).label, "2 lessons ahead");
});

test("changing the cohort reference unit does not move either class", () => {
  const planner = mixedUnitFixture();
  const changed = setCurrentUnit(planner, "y5", "body");
  assert.equal(changed.yearLevels[0].currentUnitId, "body");
  assert.deepEqual(changed.classProgress, planner.classProgress);
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
  const planner = mixedUnitFixture();
  planner.classColours["1c"] = "purple";
  const json = exportPlannerData(planner);
  const parsed = JSON.parse(json);
  assert.equal(parsed.subjects[0].name, "Mandarin");
  assert.equal(parsed.units.length, 2);
  assert.deepEqual(parsed.classProgress["1c"], { classId: "1c", unitId: "body", lessonId: "body-l3" });
  assert.deepEqual(parsed.classProgress["1d"], { classId: "1d", unitId: "pets", lessonId: "pets-l1" });
  assert.equal(parsed.classColours["1c"], "purple");
  assert.deepEqual(JSON.parse(JSON.stringify(importPlannerData(json))), parsed);
});

test("invalid import is rejected without returning partial data", () => {
  assert.throws(() => importPlannerData("not json"), /not valid JSON/);
  assert.throws(() => importPlannerData(JSON.stringify({ schemaVersion: 2 })), /valid|collections/);
  const invalid = fixture();
  invalid.classes[0].yearLevelId = "missing";
  assert.throws(() => importPlannerData(JSON.stringify(invalid)), /no valid year level/);
  const invalidColour = fixture();
  invalidColour.classColours["5e"] = "neon-pink";
  assert.throws(() => importPlannerData(JSON.stringify(invalidColour)), /Class colour.*invalid/);
});

test("localStorage v8 persists fully and older planner schemas migrate safely", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
  persistPlanner(storage, fixture());
  assert.equal(loadPlanner(storage, fixture()).source, "v8");
  assert.equal(JSON.parse(memory.get(STORAGE_KEY)).trialNotes.length, 1);

  memory.delete(STORAGE_KEY);
  const v7 = fixture();
  v7.schemaVersion = 7;
  memory.set(LEGACY_V7_STORAGE_KEY, JSON.stringify(v7));
  const v7Migrated = loadPlanner(storage, fixture());
  assert.equal(v7Migrated.source, "migrated-v7");
  assert.deepEqual(v7Migrated.planner.classProgress, v7.classProgress);

  memory.delete(LEGACY_V7_STORAGE_KEY);
  const v6 = fixture();
  v6.schemaVersion = 6;
  v6.classColours = { "5e": "ocean", "5c": "clay" };
  memory.set(LEGACY_V6_STORAGE_KEY, JSON.stringify(v6));
  const v6Migrated = loadPlanner(storage, fixture());
  assert.equal(v6Migrated.source, "migrated-v6");
  assert.deepEqual(v6Migrated.planner.classColours, { "5e": "blue", "5c": "hot-pink" });
  assert.deepEqual(v6Migrated.planner.classProgress, v6.classProgress);

  memory.delete(LEGACY_V6_STORAGE_KEY);
  const v5 = fixture();
  v5.schemaVersion = 5;
  delete v5.classColours;
  memory.set(LEGACY_V5_STORAGE_KEY, JSON.stringify(v5));
  const v5Migrated = loadPlanner(storage, fixture());
  assert.equal(v5Migrated.source, "migrated-v5");
  assert.deepEqual(v5Migrated.planner.classProgress, v5.classProgress);
  assert.deepEqual(v5Migrated.planner.classColours, {});

  memory.delete(LEGACY_V5_STORAGE_KEY);
  const v4 = fixture();
  v4.schemaVersion = 4;
  delete v4.progressCheckpoints;
  delete v4.classColours;
  memory.set(LEGACY_V4_STORAGE_KEY, JSON.stringify(v4));
  const v4Migrated = loadPlanner(storage, fixture());
  assert.equal(v4Migrated.source, "migrated-v4");
  assert.deepEqual(v4Migrated.planner.classProgress, v4.classProgress);
  assert.deepEqual(v4Migrated.planner.teachingSessions, v4.teachingSessions);
  assert.deepEqual(v4Migrated.planner.progressCheckpoints, {});

  memory.delete(LEGACY_V4_STORAGE_KEY);
  const v3 = fixture();
  v3.schemaVersion = 3;
  delete v3.progressBaselines;
  delete v3.classColours;
  delete v3.teachingSessions;
  memory.set(LEGACY_V3_STORAGE_KEY, JSON.stringify(v3));
  const v3Migrated = loadPlanner(storage, fixture());
  assert.equal(v3Migrated.source, "migrated-v3");
  assert.deepEqual(v3Migrated.planner.progressBaselines, v3Migrated.planner.classProgress);
  assert.deepEqual(v3Migrated.planner.teachingSessions, []);

  memory.delete(LEGACY_V3_STORAGE_KEY);
  memory.delete(STORAGE_KEY);
  const v2 = fixture();
  v2.schemaVersion = 2;
  delete v2.classColours;
  memory.set(LEGACY_V2_STORAGE_KEY, JSON.stringify(v2));
  const v2Migrated = loadPlanner(storage, fixture());
  assert.equal(v2Migrated.source, "migrated-v2");
  assert.deepEqual(v2Migrated.planner.classProgress["5e"], { classId: "5e", unitId: "u5", lessonId: "u5-l4" });

  memory.delete(LEGACY_V2_STORAGE_KEY);
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

  const coloured = fixture();
  coloured.classColours["5c"] = "hot-pink";
  const classDeleted = deleteClassRecord(coloured, "5c");
  assert.equal(classDeleted.classes.some((item) => item.id === "5c"), false);
  assert.equal(classDeleted.classProgress["5c"], undefined);
  assert.equal(classDeleted.timetableSessions.some((item) => item.classId === "5c"), false);
  assert.equal(classDeleted.trialNotes[0].classId, undefined);
  assert.equal(classDeleted.classColours["5c"], undefined);

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
