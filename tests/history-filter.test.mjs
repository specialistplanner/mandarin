import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Term Overview replaces History navigation while retaining multi-class Teaching Session evidence", async () => {
  const [dashboard, overview, calendar, setup] = await Promise.all([
    readFile(new URL("../app/dashboard-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/term-overview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/academic-calendar.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/setup-view.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, />Term Overview</);
  assert.doesNotMatch(dashboard, />History</);
  assert.match(dashboard, />Weekly View<\/button>/);
  assert.match(dashboard, />Unit Library<\/button>/);
  assert.doesNotMatch(dashboard, /setView\("progress"\)/);
  assert.match(dashboard, /progressView={<ProgressView/);
  assert.match(dashboard, /initialSection={view === "units" \? "library" : "program"}/);
  assert.match(setup, /\['cohorts', 'Classes'\]/);
  assert.doesNotMatch(setup, /\['cohorts', 'Classes & Unit Library'\]/);
  assert.match(setup, /libraryOnly/);
  assert.match(overview, /aria-label="Term workspace"/);
  assert.match(overview, />Progress<\/button>/);
  assert.doesNotMatch(overview, /term-progress-section/);
  assert.match(overview, /Majority position/);
  assert.match(overview, /cell\.items\.map/);
  assert.match(overview, /Majority position/);
  assert.match(calendar, /planner\.teachingSessions/);
  assert.match(calendar, /session\.outcome !== "planned"/);
});
