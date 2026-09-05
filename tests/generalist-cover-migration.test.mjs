import assert from "node:assert/strict";
import test from "node:test";
import { migrateClassCoverToGeneralistTeaching } from "../lib/generalist-cover-migration.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";

test("only an exact Class cover entry migrates to Generalist Teaching", () => {
  const planner = freshSamplePlanner();
  planner.timetableSessions.push(
    { id: "class-cover", slotId: "session-5", weekday: 3, startTime: "14:15", endTime: "15:15", type: "cover-release", label: "Class cover" },
    { id: "release", slotId: "session-5", weekday: 4, startTime: "14:15", endTime: "15:15", type: "cover-release", label: "Release" },
  );
  const result = migrateClassCoverToGeneralistTeaching(planner);
  assert.equal(result.applied, true);
  assert.equal(result.planner.timetableSessions.find((item) => item.id === "class-cover").type, "generalist-teaching");
  assert.equal(result.planner.timetableSessions.find((item) => item.id === "release").type, "cover-release");
});

test("Generalist Teaching survives localStorage backup export and import", () => {
  const planner = freshSamplePlanner();
  planner.timetableSessions.push({ id: "class-cover", slotId: "session-5", weekday: 3, startTime: "14:15", endTime: "15:15", type: "generalist-teaching", label: "Class cover" });
  const restored = importPlannerData(exportPlannerData(planner));
  assert.equal(restored.timetableSessions.find((item) => item.id === "class-cover").type, "generalist-teaching");
});
