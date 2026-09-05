import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_SESSION_SLOTS } from "../lib/domain.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";

test("the shared time axis contains the requested Sessions and breaks", () => {
  assert.deepEqual(DEFAULT_SESSION_SLOTS.map(item => [item.label, item.startTime, item.endTime, item.kind]), [
    ["S1", "08:55", "09:55", "session"],
    ["S2", "09:55", "10:55", "session"],
    ["Recess", "10:55", "11:15", "break"],
    ["S3", "11:15", "12:15", "session"],
    ["S4", "12:15", "13:15", "session"],
    ["Lunch", "13:15", "14:15", "break"],
    ["S5", "14:15", "15:15", "session"],
  ]);
});

test("Session time changes synchronize every assigned timetable card and survive backup", () => {
  const planner = freshSamplePlanner();
  planner.sessionSlots = planner.sessionSlots.map(item => item.id === "session-3" ? { ...item, startTime: "11:20", endTime: "12:20" } : item);
  const restored = importPlannerData(exportPlannerData(planner));
  const assigned = restored.timetableSessions.filter(item => item.slotId === "session-3");
  assert.equal(assigned.length > 1, true);
  assert.equal(assigned.every(item => item.startTime === "11:20" && item.endTime === "12:20"), true);
});

test("Week View uses aligned Session rows and keeps time off individual cards", async () => {
  const [view, setup, styles] = await Promise.all([
    readFile(new URL("../app/week-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/setup-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(view, /week-slot-label/);
  assert.match(view, /item\.timetable\.slotId === slot\.id/);
  assert.doesNotMatch(view, /week-card-time/);
  assert.doesNotMatch(view, /week-hero|What are you teaching this week/);
  assert.doesNotMatch(view, /entry\.yearLevel\?\.label/);
  assert.match(setup, /Session times/);
  assert.match(setup, /sessionDraft\.slotId/);
  assert.match(styles, /\.week-grid \{[^}]*grid-template-columns: 116px repeat\(5/);
  assert.match(styles, /\.week-context-block \{[^}]*min-height: 96px/);
  assert.match(styles, /\.week-card \{[^}]*min-height: 96px/);
  assert.match(styles, /\.week-slot-label \{[^}]*position: sticky; left: 0/);
});

test("the S1 label upgrades without overwriting a custom Session name", async () => {
  const app = await readFile(new URL("../app/dashboard-app.tsx", import.meta.url), "utf8");
  assert.match(app, /firstSession\?\.label === "Session 1"/);
  assert.match(app, /label: "S1"/);
  assert.match(app, /SESSION_ONE_LABEL_MIGRATION_KEY/);
});

test("Class cover can be marked as Generalist Teaching without entering specialist progress", async () => {
  const [app, view, setup, styles] = await Promise.all([
    readFile(new URL("../app/dashboard-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/week-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/setup-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /GENERALIST_COVER_MIGRATION_KEY/);
  assert.match(view, /entry\.kind === "generalist-teaching"/);
  assert.match(view, /Generalist curriculum/);
  assert.match(view, /entry\.contextClassName/);
  assert.match(view, /showNonTeaching \|\| item\.kind !== "non-teaching"/);
  assert.match(setup, /customClassName/);
  assert.match(setup, /session\.type === "specialist-teaching" && session\.classId/);
  assert.match(setup, /Generalist Teaching appears as teaching context without changing specialist progress/);
  assert.match(styles, /context-generalist-teaching/);
});

test("linked Unit Library lessons open from Current class position in a new tab", async () => {
  const [view, resource] = await Promise.all([
    readFile(new URL("../app/week-view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resource-link.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(view, /resolveLinkedLessonReference/);
  assert.match(view, /week-position-link/);
  assert.doesNotMatch(view, /<dt>Cohort reference<\/dt>|Previous session ·/);
  assert.match(resource, /target="_blank"/);
  assert.match(resource, /rel="noopener noreferrer"/);
});
