import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { validateCloudProgram } from "../lib/cloud-program.ts";
import { reconcileLinkedUnitTitles } from "../lib/linked-unit-title-reconciliation.ts";
import { importPlannerData } from "../lib/storage.ts";
import { parseUnitLibraryIndex, UNIT_LIBRARY_LIVE_INDEX_URL } from "../lib/unit-library.ts";

const require = createRequire(import.meta.url);
const { requireAuth } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/requireAuth.js");
const { getAccessToken } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/apiv2.js");
const { configstore } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/configstore.js");

const projectId = "specialist-planner-staging";
const programId = "program-ff3c47db-26e6-4e64-8236-976cbcee9b91";
const mutationId = "v071-linked-title-family-ii-approved-revision-51";
const backupPath = "/Users/weiwang/Downloads/specialist-planner-staging-mandarin-pre-linked-title-reconciliation-2026-10-03.json";
const reportPath = "/Users/weiwang/Downloads/specialist-planner-staging-linked-title-canonical-verification-2026-10-03.json";

function decode(value) {
  if (!value || typeof value !== "object") return value;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decode);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, entry]) => [key, decode(entry)]));
  throw new Error(`Unsupported Firestore value: ${Object.keys(value).join(", ")}`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function protectedState(planner) {
  return JSON.parse(JSON.stringify({
    ids: planner.units.map((unit) => ({ id: unit.id, lessonIds: unit.lessons.map((lesson) => lesson.id) })),
    classes: planner.classes,
    yearLevels: planner.yearLevels,
    classProgress: planner.classProgress,
    progressBaselines: planner.progressBaselines,
    progressCheckpoints: planner.progressCheckpoints,
    teachingSessions: planner.teachingSessions,
    timetableSessions: planner.timetableSessions,
    schoolYears: planner.schoolYears,
    terms: planner.terms,
    nonTeachingPeriods: planner.nonTeachingPeriods,
    trialNotes: planner.trialNotes,
  }));
}

function family(planner) {
  const unit = planner.units.find((candidate) => candidate.externalResourceRef?.resourceId === "year-6-family-ii");
  assert.ok(unit);
  return unit;
}

await requireAuth({ user: configstore.get("user"), tokens: configstore.get("tokens") });
const token = await getAccessToken();
const headers = { Authorization: `Bearer ${token}` };
const [programResponse, libraryResponse, backupText] = await Promise.all([
  fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/programs/${programId}`, { headers }),
  fetch(UNIT_LIBRARY_LIVE_INDEX_URL, { headers: { Accept: "application/json" }, cache: "no-store" }),
  readFile(backupPath, "utf8"),
]);
const raw = await programResponse.json();
if (!programResponse.ok) throw new Error(raw.error?.message ?? `Firestore returned ${programResponse.status}`);
if (!libraryResponse.ok) throw new Error(`Live Unit Library returned ${libraryResponse.status}.`);
const after = validateCloudProgram(Object.fromEntries(Object.entries(raw.fields ?? {}).map(([key, value]) => [key, decode(value)])));
const beforePlanner = importPlannerData(backupText);
const index = parseUnitLibraryIndex(await libraryResponse.json());

assert.equal(after.revision, 52);
assert.equal(after.lastMutationId, mutationId);
assert.deepEqual(protectedState(after.data), protectedState(beforePlanner));
assert.equal(hash(protectedState(after.data)), hash(protectedState(beforePlanner)));

const beforeFamily = family(beforePlanner);
const afterFamily = family(after.data);
assert.equal(afterFamily.id, beforeFamily.id);
assert.deepEqual(afterFamily.lessons.map((lesson) => lesson.id), beforeFamily.lessons.map((lesson) => lesson.id));
assert.equal(afterFamily.lessons[0].title, "There are five people in my family.");
assert.equal(afterFamily.lessons[0].externalResourceRef?.lastSyncedTitle, "There are five people in my family.");
assert.deepEqual(after.data.classProgress["6b"], beforePlanner.classProgress["6b"]);
assert.deepEqual(after.data.classProgress["6d"], beforePlanner.classProgress["6d"]);
assert.deepEqual(
  JSON.parse(JSON.stringify(after.data.teachingSessions)),
  JSON.parse(JSON.stringify(beforePlanner.teachingSessions)),
);

const prep = after.data.units.find((unit) => unit.externalResourceRef?.resourceId === "prep-numbers");
const year4 = after.data.units.find((unit) => unit.externalResourceRef?.resourceId === "year-4-australia-states-and-territories");
assert.equal(prep?.title, "Numbers");
assert.equal(prep?.externalResourceRef?.lastSyncedTitle, undefined);
assert.equal(year4?.title, "Australian States and Territories");
assert.equal(year4?.externalResourceRef?.lastSyncedTitle, "Australian States and Territories");

const dryRun = reconcileLinkedUnitTitles(after.data, index, { mode: "dry-run", sourceAvailable: true });
const differences = dryRun.report.units.flatMap((unit) => unit.titleDifferences.map((difference) => ({
  target: difference.target,
  spId: difference.spId,
  externalId: difference.externalId,
  oldValue: difference.oldValue,
  newValue: difference.newValue,
  classification: difference.classification,
})));
assert.deepEqual(differences, [{
  target: "unit",
  spId: "hello-friends",
  externalId: "prep-numbers",
  oldValue: "Numbers",
  newValue: "Numbers 0-10 I",
  classification: "bootstrap",
}]);
assert.equal(dryRun.report.units.flatMap((unit) => unit.titleConflicts).length, 0);
assert.equal(dryRun.report.units.flatMap((unit) => unit.structuralDifferences).length, 0);
assert.equal(dryRun.report.units.flatMap((unit) => unit.unmappedItems).length, 31);

const report = {
  status: "verified",
  projectId,
  programId,
  revisionBefore: 51,
  revisionAfter: after.revision,
  mutationId,
  liveIndexGeneratedAt: index.generatedAt,
  protectedStateCanonicalHashBefore: hash(protectedState(beforePlanner)),
  protectedStateCanonicalHashAfter: hash(protectedState(after.data)),
  family: {
    unitId: afterFamily.id,
    lessons: afterFamily.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, externalId: lesson.externalResourceRef?.resourceId, lastSyncedTitle: lesson.externalResourceRef?.lastSyncedTitle })),
  },
  classPositions: { "6B": after.data.classProgress["6b"], "6D": after.data.classProgress["6d"] },
  historicalTeachingSessionsUnchanged: true,
  unmappedLegacyLessons: 31,
  unresolvedBootstrapDifferences: differences,
  year4SourceNowMatchesWithoutSpTitleChange: true,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ...report, reportPath }, null, 2));
