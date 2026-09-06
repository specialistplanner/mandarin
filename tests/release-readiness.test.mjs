import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  materializeTeachingSessionsForDate,
  recordTeachingSessionOutcome,
  setClassColour,
  setLessonExternalResource,
  setUnitExternalResource,
} from "../lib/domain.ts";
import { GENERALIST_COVER_MIGRATION_KEY } from "../lib/generalist-cover-migration.ts";
import { LIVE_TRIAL_WEEK_RESET_KEY } from "../lib/live-trial-week-reset.ts";
import { markOneTimeMigrationsApplied, SESSION_ONE_LABEL_MIGRATION_KEY } from "../lib/migration-markers.ts";
import { APP_VERSION, RELEASE_DATE, RELEASE_NAME, RELEASE_TITLE, SITE_BASE_PATH, SITE_ORIGIN } from "../lib/release.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { exportPlannerData, importPlannerData, STORAGE_KEY } from "../lib/storage.ts";
import { lessonReference, unitReference } from "../lib/unit-library.ts";
import { deriveTeachingWeek } from "../lib/week-planner.ts";

const releaseWeek = new Date(2026, 8, 2, 12);

function outcome(planner, classId, value, detail = "") {
  const session = planner.teachingSessions.find((item) => item.date === "2026-09-02" && item.classId === classId);
  assert.ok(session, `Expected a materialized session for ${classId}`);
  return recordTeachingSessionOutcome(planner, session.id, value, detail);
}

function weekSummary(planner, anchor) {
  return deriveTeachingWeek(planner, anchor, releaseWeek).days.map((day) => ({
    date: day.dateKey,
    entries: day.entries.map((entry) => ({
      key: entry.key,
      kind: entry.kind,
      classId: entry.specialistClass?.id,
      contextClassName: entry.contextClassName,
      unitId: entry.unit?.id,
      lessonId: entry.lesson?.id,
      state: entry.state,
      status: entry.progressStatus?.label,
      outcome: entry.session?.outcome,
      colour: entry.classColourId,
    })),
  }));
}

test("release metadata has one stable production version source", async () => {
  assert.equal(APP_VERSION, "v0.5.1");
  assert.equal(RELEASE_DATE, "2026-09-06");
  assert.equal(RELEASE_NAME, "Migration Safety Hotfix");
  assert.equal(RELEASE_TITLE, "Specialist Planner v0.5.1 — Migration Safety Hotfix");
  assert.equal(SITE_ORIGIN, "https://specialistplanner.github.io/mandarin/");
  assert.equal(SITE_BASE_PATH, "/mandarin/");
  assert.equal(STORAGE_KEY, "specialist-planner.data.v9");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.version, "0.5.1");
});

test("GitHub Pages production entry and workflow preserve the project base path", async () => {
  const [entry, config, workflow, readme] = await Promise.all([
    readFile(new URL("../github-pages/index.html", import.meta.url), "utf8"),
    readFile(new URL("../vite.github-pages.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  assert.match(config, /base:\s*["']\/mandarin\/["']/);
  assert.match(entry, /https:\/\/specialistplanner\.github\.io\/mandarin\/og-v04\.png/);
  assert.match(workflow, /npm run build:pages/);
  assert.match(workflow, /path:\s*dist-pages/);
  assert.match(readme, /https:\/\/specialistplanner\.github\.io\/mandarin\//);
  assert.doesNotMatch(entry, /chatgpt\.site/i);
});

test("authoritative imports mark every one-time migration as already handled", () => {
  const memory = new Map();
  const storage = { setItem: (key, value) => memory.set(key, value) };
  markOneTimeMigrationsApplied(storage);
  assert.equal(memory.get(LIVE_TRIAL_WEEK_RESET_KEY), "applied");
  assert.equal(memory.get(SESSION_ONE_LABEL_MIGRATION_KEY), "applied");
  assert.equal(memory.get(GENERALIST_COVER_MIGRATION_KEY), "applied");
});

test("stable interface copy contains no visible trial identity", async () => {
  const source = (await Promise.all([
    "../app/dashboard-app.tsx",
    "../app/setup-view.tsx",
    "../app/layout.tsx",
    "../app/page.tsx",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /Live trial|Live Classroom Trial|Integration Trial|Trial notes|trial note/i);
  assert.doesNotMatch(source, /x-forwarded-host|x-forwarded-proto/);
});

test("release backup round-trip preserves complete state and derived views", () => {
  let planner = freshSamplePlanner();
  const linkedUnit = {
    id: "library-nationalities",
    yearLevel: 5,
    title: "Countries and Nationalities",
    url: "https://themandarinroom.github.io/units/view.html?unit=library-nationalities",
    lessons: [{
      id: "library-nationalities-l4",
      title: "Where are you from?",
      url: "https://themandarinroom.github.io/units/view.html?unit=library-nationalities&lesson=library-nationalities-l4",
    }],
  };
  planner = setUnitExternalResource(planner, "nationalities", unitReference(linkedUnit));
  planner = setLessonExternalResource(planner, "nationalities", "nationalities-lesson-4", lessonReference(linkedUnit, linkedUnit.lessons[0]));
  planner = setClassColour(planner, "5e", "blue");
  planner = materializeTeachingSessionsForDate(planner, releaseWeek);
  planner = outcome(planner, "5e", "completed");
  planner = outcome(planner, "5c", "partial", "Stopped after speaking practice");
  planner = outcome(planner, "2c", "not-taught", "School event");
  planner.trialNotes.push({ id: "release-note", text: "Reference note", createdAt: "2026-09-05T00:00:00.000Z", classId: "5e" });
  planner.reconciliationStatus = { startDate: "2026-08-24", throughDate: "2026-08-28", completedAt: "2026-09-05T00:00:00.000Z" };
  planner.timetableSessions.push({ id: "generalist-2b", slotId: "session-5", weekday: 2, startTime: "14:15", endTime: "15:15", type: "generalist-teaching", label: "Class cover", customClassName: "2B" });

  const exported = exportPlannerData(planner);
  const restored = importPlannerData(exported);
  assert.equal(exportPlannerData(restored), exported);
  assert.deepEqual(restored.classProgress, planner.classProgress);
  assert.deepEqual(
    JSON.parse(JSON.stringify(restored.teachingSessions.filter((item) => item.outcome !== "planned"))),
    JSON.parse(JSON.stringify(planner.teachingSessions.filter((item) => item.outcome !== "planned"))),
  );
  for (const offset of [-7, 0, 7]) {
    const anchor = new Date(releaseWeek);
    anchor.setDate(anchor.getDate() + offset);
    assert.deepEqual(weekSummary(restored, anchor), weekSummary(planner, anchor));
  }
});
