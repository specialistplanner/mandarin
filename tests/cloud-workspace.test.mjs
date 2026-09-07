import assert from "node:assert/strict";
import test from "node:test";
import { SUBJECT_PRESETS, activeProgramName, defaultProgramName, makeCloudProgram, preparePlannerForProgram, programBelongsTo, summarizeLocalProgram, validateCloudProgram } from "../lib/cloud-program.ts";
import { cloudCacheKey, finishMigrationIntent, migrationIntentKey, migrationProgramId, readCloudCache, writeCloudCache } from "../lib/cloud-cache.ts";
import { AUTH_PROVIDER_IDS, readFirebasePublicConfig } from "../firebase/client.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import { readFile } from "node:fs/promises";

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key), data };
}

test("onboarding offers every v0.6 specialist-area preset and custom naming", () => {
  assert.deepEqual(SUBJECT_PRESETS.map((preset) => preset.label), ["Art", "Music", "PE", "Performing Arts", "STEM", "Languages", "Library", "Other"]);
  assert.equal(defaultProgramName("art"), "Visual Arts");
  assert.equal(defaultProgramName("pe"), "Physical Education");
  assert.equal(defaultProgramName("other"), "My specialist program");
});

test("a new Program is blank, named for its specialist area and owned by UID", () => {
  const planner = preparePlannerForProgram("program-art", "Visual Arts");
  assert.equal(activeProgramName(planner), "Visual Arts");
  assert.deepEqual([planner.yearLevels, planner.classes, planner.units, planner.timetableSessions, planner.teachingSessions], [[], [], [], [], []]);
  const program = makeCloudProgram({ id: "program-art", ownerUid: "teacher-a", name: "Visual Arts", subjectType: "art", planner, mutationId: "create-art" });
  assert.equal(program.ownerUid, "teacher-a");
  assert.deepEqual(program.memberUids, ["teacher-a"]);
  assert.deepEqual(program.members, { "teacher-a": "owner" });
  assert.equal(programBelongsTo(program, "teacher-a"), true);
  assert.equal(programBelongsTo(program, "teacher-b"), false);
  assert.deepEqual(validateCloudProgram(program), program);
});

test("the existing Mandarin Program summary retains real classroom collections", () => {
  const planner = freshSamplePlanner();
  const summary = summarizeLocalProgram(planner);
  assert.equal(summary.name, "Mandarin");
  assert.equal(summary.classes, planner.classes.length);
  assert.equal(summary.units, planner.units.length);
  assert.equal(summary.recordedSessions, planner.teachingSessions.filter((session) => session.outcome !== "planned").length);
});

test("local cloud caches are isolated by authenticated UID", () => {
  const storage = memoryStorage();
  const planner = freshSamplePlanner();
  writeCloudCache(storage, { uid: "teacher-a", programId: "program-a", programName: "Mandarin", subjectType: "languages", customSubjectName: "Mandarin", revision: 4, planner, pending: false });
  assert.ok(readCloudCache(storage, "teacher-a"));
  assert.equal(readCloudCache(storage, "teacher-b"), null);
  assert.notEqual(cloudCacheKey("teacher-a"), cloudCacheKey("teacher-b"));
});

test("an uncertain write keeps its mutation and source revision for idempotent retry", () => {
  const storage = memoryStorage();
  const planner = freshSamplePlanner();
  const pendingOperation = { mutationId: "save-stable-id", expectedRevision: 7, planner };
  writeCloudCache(storage, { uid: "teacher-a", programId: "program-a", programName: "Mandarin", subjectType: "languages", revision: 7, planner, pending: true, mutationId: pendingOperation.mutationId, pendingOperation });
  const restored = readCloudCache(storage, "teacher-a");
  assert.equal(restored?.pendingOperation?.mutationId, "save-stable-id");
  assert.equal(restored?.pendingOperation?.expectedRevision, 7);
  assert.equal(restored?.pendingOperation?.planner.id, planner.id);
  assert.equal(restored?.pendingOperation?.planner.updatedAt, planner.updatedAt);
  assert.equal(JSON.stringify(restored?.pendingOperation?.planner.classProgress), JSON.stringify(planner.classProgress));
});

test("migration retries use one stable Program ID until verification finishes", () => {
  const storage = memoryStorage();
  const first = migrationProgramId(storage, "teacher-a");
  assert.equal(migrationProgramId(storage, "teacher-a"), first);
  assert.equal(storage.getItem(migrationIntentKey("teacher-a")), first);
  finishMigrationIntent(storage, "teacher-a");
  assert.equal(storage.getItem(migrationIntentKey("teacher-a")), null);
  assert.notEqual(migrationProgramId(storage, "teacher-a"), first);
});

test("Firebase configuration exposes only public client settings and recognised providers", () => {
  assert.deepEqual(AUTH_PROVIDER_IDS, { google: "google.com", microsoft: "microsoft.com" });
  const config = readFirebasePublicConfig({ VITE_FIREBASE_API_KEY: "public-browser-key", VITE_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com", VITE_FIREBASE_PROJECT_ID: "example", VITE_FIREBASE_APP_ID: "app-id", VITE_FIREBASE_MESSAGING_SENDER_ID: "sender", VITE_FIREBASE_AUTH_GOOGLE_ENABLED: "true", VITE_FIREBASE_AUTH_MICROSOFT_ENABLED: "false" });
  assert.equal(config?.authGoogleEnabled, true);
  assert.equal(config?.authMicrosoftEnabled, false);
  assert.equal("clientSecret" in (config ?? {}), false);
  assert.equal(readFirebasePublicConfig({}), null);
});

test("v0.6 entry is authentication-first and established Programs launch into Week", async () => {
  const cloudSource = await readFile(new URL("../app/cloud-planner-app.tsx", import.meta.url), "utf8");
  const dashboardSource = await readFile(new URL("../app/dashboard-app.tsx", import.meta.url), "utf8");
  assert.match(cloudSource, /Continue with Google/);
  assert.match(cloudSource, /Continue with Microsoft/);
  assert.match(cloudSource, /Create your Specialist Planner/);
  assert.match(cloudSource, /Existing Planner found/);
  assert.match(cloudSource, /Use this same Specialist Planner sign-in identity on every device/);
  assert.match(cloudSource, /Google and Microsoft accounts are not automatically merged/);
  assert.doesNotMatch(cloudSource, /Start a blank one/);
  assert.match(dashboardSource, /useState<AppView>\("week"\)/);
  assert.match(cloudSource, /Synced to cloud/);
  assert.match(cloudSource, /Offline · changes saved locally/);
  assert.match(cloudSource, /pending: cached\.pending/);
  assert.match(cloudSource, /pendingOperation: cached\.pendingOperation/);
  assert.doesNotMatch(cloudSource, /tone === "pending" \|\| tone === "offline"/);
});
