import assert from "node:assert/strict";
import test from "node:test";
import {
  clampLesson,
  getProgressStatus,
  getTeachingSessionsForWeekday,
  getYearLevelExceptions,
  moveProgress,
  setProgress,
} from "../lib/domain.ts";
import { persistProgress, restoreProgress, STORAGE_KEY } from "../lib/storage.ts";

const classes = [
  { id: "5e", name: "5E", yearLevelId: "year-5" },
  { id: "5c", name: "5C", yearLevelId: "year-5" },
];

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

test("cohort divergence identifies only the out-of-sync class", () => {
  const exceptions = getYearLevelExceptions(classes, { "5e": 4, "5c": 3 }, 4);
  assert.deepEqual(exceptions.map((item) => item.id), ["5c"]);
});

test("one lesson behind is reported precisely", () => {
  assert.deepEqual(getProgressStatus(3, 4), {
    kind: "behind",
    difference: -1,
    label: "1 lesson behind",
  });
});

test("local persistence restores progress and preserves defaults", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  persistProgress(storage, { "5e": 4, "5c": 3 });
  assert.equal(memory.has(STORAGE_KEY), true);
  assert.deepEqual(restoreProgress(storage, { "5e": 4, "5c": 4, "6b": 2 }), {
    "5e": 4,
    "5c": 3,
    "6b": 2,
  });
});

test("weekday filtering returns only specialist teaching in time order", () => {
  const sessions = [
    { id: "cover", weekday: 3, startTime: "08:00", endTime: "09:00", classId: "5c", type: "cover-release" },
    { id: "late", weekday: 3, startTime: "09:55", endTime: "10:55", classId: "5c", type: "specialist-teaching" },
    { id: "early", weekday: 3, startTime: "08:55", endTime: "09:55", classId: "5e", type: "specialist-teaching" },
    { id: "other-day", weekday: 4, startTime: "08:55", endTime: "09:55", classId: "4e", type: "specialist-teaching" },
  ];
  assert.deepEqual(getTeachingSessionsForWeekday(sessions, 3).map((item) => item.id), ["early", "late"]);
});

test("progress controls clamp first, final and invalid lesson values", () => {
  assert.equal(clampLesson(0, 6), 1);
  assert.equal(clampLesson(7, 6), 6);
  assert.equal(clampLesson(2.5, 6), 1);
  assert.equal(moveProgress({ "5c": 1 }, "5c", -1, 6)["5c"], 1);
  assert.equal(moveProgress({ "5c": 6 }, "5c", 1, 6)["5c"], 6);
  assert.equal(setProgress({ "5c": 3 }, "5c", 99, 6)["5c"], 6);
});
