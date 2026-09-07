import assert from "node:assert/strict";
import test from "node:test";
import {
  createClassRecord,
  createUnitRecord,
  deleteLessonRecord,
  deleteUnitRecord,
  getTeachingSessionsForDate,
  materializeTeachingSessionsForDate,
  recordTeachingSessionOutcome,
  updateLessonRecord,
  updateUnitDetails,
} from "../lib/domain.ts";
import { makeCloudProgram, preparePlannerForProgram, validateCloudProgram } from "../lib/cloud-program.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { deriveTeachingWeek } from "../lib/week-planner.ts";

function visualArtsProgram() {
  let planner = preparePlannerForProgram("visual-arts", "Visual Arts");
  planner = {
    ...planner,
    yearLevels: [{ id: "year-3", label: "Year 3", shortLabel: "3", currentUnitId: null, expectedLessonId: null }],
  };
  planner = createUnitRecord(planner, {
    id: "unit-drawing",
    yearLevelId: "year-3",
    yearLevelIds: ["year-3"],
    title: "Drawing",
    description: "Line, shape and observation",
    lessons: [
      { id: "drawing-l1", title: "Observational lines", sequence: 1 },
      { id: "drawing-l2", title: "Shape studies", sequence: 2 },
      { id: "drawing-l3", title: "Final composition", sequence: 3 },
    ],
  });
  planner = createClassRecord(planner, { id: "3a", name: "3A", yearLevelId: "year-3" });
  return {
    ...planner,
    timetableSessions: [{
      id: "mon-3a",
      slotId: "session-1",
      weekday: 1,
      startTime: "08:55",
      endTime: "09:55",
      type: "specialist-teaching",
      classId: "3a",
      subjectId: planner.activeSubjectId,
    }],
  };
}

test("a non-Mandarin Program owns its Units and completes lessons without an external library", () => {
  const date = new Date(2026, 8, 7, 12);
  let planner = materializeTeachingSessionsForDate(visualArtsProgram(), date);
  const session = getTeachingSessionsForDate(planner, date)[0];
  assert.equal(session.plannedUnitId, "unit-drawing");
  assert.equal(session.plannedLessonId, "drawing-l1");
  planner = recordTeachingSessionOutcome(planner, session.id, "completed");
  assert.equal(planner.classProgress["3a"].lessonId, "drawing-l2");

  const restored = importPlannerData(exportPlannerData(planner));
  assert.deepEqual(restored.units.map((unit) => unit.id), ["unit-drawing"]);
  assert.deepEqual(restored.units[0].lessons.map((lesson) => lesson.id), ["drawing-l1", "drawing-l2", "drawing-l3"]);
  assert.equal(restored.teachingSessions[0].outcome, "completed");
});

test("renames resolve live in Week View while History keeps its original title snapshots", () => {
  const date = new Date(2026, 8, 7, 12);
  let planner = materializeTeachingSessionsForDate(visualArtsProgram(), date);
  const historical = getTeachingSessionsForDate(planner, date)[0];
  planner = recordTeachingSessionOutcome(planner, historical.id, "completed");
  planner = updateUnitDetails(planner, "unit-drawing", "Drawing and Design", "Updated description");
  planner = updateLessonRecord(planner, "unit-drawing", "drawing-l2", "Geometric shape studies");

  const week = deriveTeachingWeek(planner, new Date(2026, 8, 14, 12), new Date(2026, 8, 13, 12));
  const nextEntry = week.days.flatMap((day) => day.entries).find((entry) => entry.specialistClass?.id === "3a");
  assert.equal(nextEntry.unit.id, "unit-drawing");
  assert.equal(nextEntry.unit.title, "Drawing and Design");
  assert.equal(nextEntry.lesson.id, "drawing-l2");
  assert.equal(nextEntry.lesson.title, "Geometric shape studies");
  assert.equal(planner.teachingSessions[0].plannedUnitTitle, "Drawing");
  assert.equal(planner.teachingSessions[0].plannedLessonTitle, "Observational lines");
});

test("referenced Units and Lessons are protected while unreferenced records remain deletable", () => {
  const planner = visualArtsProgram();
  assert.throws(() => deleteUnitRecord(planner, "unit-drawing"), /current unit/);
  assert.throws(() => deleteLessonRecord(planner, "unit-drawing", "drawing-l1"), /Progress or History/);

  let withSpare = createUnitRecord(planner, {
    id: "unit-spare",
    yearLevelId: "year-3",
    title: "Unused Unit",
    lessons: [
      { id: "spare-l1", title: "Unused one", sequence: 1 },
      { id: "spare-l2", title: "Unused two", sequence: 2 },
    ],
  }, false);
  withSpare = deleteLessonRecord(withSpare, "unit-spare", "spare-l2");
  withSpare = deleteUnitRecord(withSpare, "unit-spare");
  assert.equal(withSpare.units.some((unit) => unit.id === "unit-spare"), false);
});

test("existing Mandarin Units migrate into a cloud Program without ID, order, progress, History or link loss", () => {
  const original = freshSamplePlanner();
  original.units[0].externalResourceRef = {
    provider: "the-mandarin-room",
    resourceType: "unit",
    resourceId: "hello-friends",
    label: "Hello, Friends!",
    url: "https://example.test/unit/hello-friends",
  };
  original.units[0].lessons[0].externalResourceRef = {
    provider: "the-mandarin-room",
    resourceType: "lesson",
    resourceId: "hello-lesson-1",
    parentResourceId: "hello-friends",
    label: "Hello",
    url: "https://example.test/unit/hello-friends/lesson/1",
  };
  const date = new Date(2026, 8, 7, 12);
  const materialized = materializeTeachingSessionsForDate(original, date);
  const cloud = validateCloudProgram(makeCloudProgram({
    id: "mandarin-program",
    ownerUid: "teacher-a",
    name: "Mandarin",
    subjectType: "languages",
    customSubjectName: "Mandarin",
    planner: materialized,
    mutationId: "migration-1",
  }));

  assert.deepEqual(cloud.data.units.map((unit) => unit.id), original.units.map((unit) => unit.id));
  assert.deepEqual(cloud.data.units.map((unit) => unit.lessons.map((lesson) => lesson.id)), original.units.map((unit) => unit.lessons.map((lesson) => lesson.id)));
  assert.deepEqual(cloud.data.classProgress, materialized.classProgress);
  assert.deepEqual(JSON.parse(JSON.stringify(cloud.data.teachingSessions)), JSON.parse(JSON.stringify(materialized.teachingSessions)));
  assert.deepEqual(JSON.parse(JSON.stringify(cloud.data.units[0].externalResourceRef)), original.units[0].externalResourceRef);
  assert.deepEqual(JSON.parse(JSON.stringify(cloud.data.units[0].lessons[0].externalResourceRef)), original.units[0].lessons[0].externalResourceRef);
  assert.equal(new Set(cloud.data.units.map((unit) => unit.id)).size, cloud.data.units.length);
});
