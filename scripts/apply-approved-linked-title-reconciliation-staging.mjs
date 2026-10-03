import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { validateCloudProgram } from "../lib/cloud-program.ts";
import { reconcileLinkedUnitTitles } from "../lib/linked-unit-title-reconciliation.ts";
import { exportPlannerData } from "../lib/storage.ts";
import { parseUnitLibraryIndex, UNIT_LIBRARY_LIVE_INDEX_URL } from "../lib/unit-library.ts";

const require = createRequire(import.meta.url);
const { requireAuth } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/requireAuth.js");
const { getAccessToken } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/apiv2.js");
const { configstore } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/configstore.js");

const projectId = "specialist-planner-staging";
const programId = "program-ff3c47db-26e6-4e64-8236-976cbcee9b91";
const expectedRevision = 51;
const mutationId = "v071-linked-title-family-ii-approved-revision-51";
const programUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/programs/${programId}`;
const approvedBootstrapKeys = [
  "unit:year-5-countries",
  "unit:year-6-chinese-names",
  "unit:year-2-family",
  "unit:year-3-fruit",
  "unit:year-4-australia-states-and-territories",
  "unit:year-6-family-ii",
  "lesson:lesson-1790909455090",
  "lesson:lesson-1790920751476",
];

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

function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, encode(entry)])) } };
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

function decodeDocument(document) {
  return Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decode(value)]));
}

function diffValues(before, after, path = "") {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const size = Math.max(before.length, after.length);
    return Array.from({ length: size }, (_, index) => diffValues(before[index], after[index], `${path}[${index}]`)).flat();
  }
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => diffValues(before[key], after[key], path ? `${path}.${key}` : key));
  }
  return [{ path, before: before ?? null, after: after ?? null }];
}

function protectedState(planner) {
  return {
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
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function familyState(planner) {
  const unit = planner.units.find((candidate) => candidate.externalResourceRef?.resourceId === "year-6-family-ii");
  assert.ok(unit, "Family II Unit is missing.");
  return {
    unitId: unit.id,
    unitTitle: unit.title,
    unitLastSyncedTitle: unit.externalResourceRef?.lastSyncedTitle,
    lessons: unit.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      externalId: lesson.externalResourceRef?.resourceId,
      lastSyncedTitle: lesson.externalResourceRef?.lastSyncedTitle,
    })),
  };
}

function unresolvedBootstrap(report) {
  return report.units.flatMap((unit) => unit.titleDifferences.filter((difference) => difference.classification === "bootstrap").map((difference) => ({
    target: difference.target,
    spId: difference.spId,
    externalId: difference.externalId,
    oldValue: difference.oldValue,
    newValue: difference.newValue,
  })));
}

await requireAuth({ user: configstore.get("user"), tokens: configstore.get("tokens") });
const token = await getAccessToken();
const headers = { Authorization: `Bearer ${token}` };
const [programResponse, libraryResponse] = await Promise.all([
  fetch(programUrl, { headers }),
  fetch(UNIT_LIBRARY_LIVE_INDEX_URL, { headers: { Accept: "application/json" }, cache: "no-store" }),
]);
const rawBefore = await programResponse.json();
if (!programResponse.ok) throw new Error(rawBefore.error?.message ?? `Firestore returned ${programResponse.status}`);
if (!libraryResponse.ok) throw new Error(`Live Unit Library returned ${libraryResponse.status}; approved write aborted.`);
const before = validateCloudProgram(decodeDocument(rawBefore));
const index = parseUnitLibraryIndex(await libraryResponse.json());

if (before.lastMutationId === mutationId && before.revision === expectedRevision + 1) {
  console.log(JSON.stringify({ status: "already-applied", revision: before.revision, family: familyState(before.data) }, null, 2));
  process.exit(0);
}
assert.equal(before.revision, expectedRevision, "Staging revision changed after owner approval; write aborted.");
assert.equal(before.name, "Mandarin", "Expected staging Mandarin Program was not found.");
assert.equal(before.data.classes.length, 16, "Expected 16-class Mandarin Program was not found.");

const dryBefore = reconcileLinkedUnitTitles(before.data, index, { mode: "dry-run", sourceAvailable: true });
assert.deepEqual(unresolvedBootstrap(dryBefore.report), [
  { target: "unit", spId: "hello-friends", externalId: "prep-numbers", oldValue: "Numbers", newValue: "Numbers 0-10 I" },
  { target: "lesson", spId: "lesson-library-year-6-family-ii-1", externalId: "lesson-1790909455090", oldValue: "My family has five people.", newValue: "There are five people in my family." },
]);
assert.equal(dryBefore.report.units.flatMap((unit) => unit.titleConflicts).length, 0, "Unexpected title conflict detected.");
assert.equal(dryBefore.report.units.flatMap((unit) => unit.structuralDifferences).length, 0, "Unexpected structural difference detected.");
assert.equal(dryBefore.report.units.flatMap((unit) => unit.unmappedItems).length, 31, "Legacy unmapped Lesson count changed.");

const applied = reconcileLinkedUnitTitles(before.data, index, {
  mode: "approved-bootstrap",
  sourceAvailable: true,
  approvedBootstrapKeys,
});
assert.equal(applied.changed, true, "Approved reconciliation produced no Program change.");
assert.deepEqual(protectedState(applied.planner), protectedState(before.data), "Protected operational or historical state changed.");

const familyBefore = familyState(before.data);
const familyAfter = familyState(applied.planner);
assert.equal(familyAfter.unitId, familyBefore.unitId);
assert.deepEqual(familyAfter.lessons.map((lesson) => lesson.id), familyBefore.lessons.map((lesson) => lesson.id));
assert.equal(familyAfter.lessons[0].title, "There are five people in my family.");
assert.equal(familyAfter.lessons[0].lastSyncedTitle, "There are five people in my family.");

const prep = applied.planner.units.find((unit) => unit.externalResourceRef?.resourceId === "prep-numbers");
const year4 = applied.planner.units.find((unit) => unit.externalResourceRef?.resourceId === "year-4-australia-states-and-territories");
assert.equal(prep?.title, "Numbers");
assert.equal(prep?.externalResourceRef?.lastSyncedTitle, undefined);
assert.equal(year4?.title, "Australian States and Territories");
assert.equal(year4?.externalResourceRef?.lastSyncedTitle, "Australian States and Territories");

const plannerDiff = diffValues(before.data, applied.planner);
const allowedPaths = new Set(["updatedAt"]);
for (const key of approvedBootstrapKeys) {
  const [target, externalId] = key.split(":");
  const unitIndex = before.data.units.findIndex((unit) => target === "unit"
    ? unit.externalResourceRef?.resourceId === externalId
    : unit.lessons.some((lesson) => lesson.externalResourceRef?.resourceId === externalId));
  assert.notEqual(unitIndex, -1, `Approved target ${key} was not found.`);
  if (target === "unit") {
    allowedPaths.add(`units[${unitIndex}].externalResourceRef.lastSyncedTitle`);
    allowedPaths.add(`units[${unitIndex}].externalResourceRef.label`);
    allowedPaths.add(`units[${unitIndex}].externalResourceRef.url`);
  } else {
    const lessonIndex = before.data.units[unitIndex].lessons.findIndex((lesson) => lesson.externalResourceRef?.resourceId === externalId);
    allowedPaths.add(`units[${unitIndex}].lessons[${lessonIndex}].externalResourceRef.lastSyncedTitle`);
    allowedPaths.add(`units[${unitIndex}].lessons[${lessonIndex}].externalResourceRef.label`);
    allowedPaths.add(`units[${unitIndex}].lessons[${lessonIndex}].externalResourceRef.url`);
    if (externalId === "lesson-1790909455090") allowedPaths.add(`units[${unitIndex}].lessons[${lessonIndex}].title`);
  }
}
for (const difference of plannerDiff) assert.ok(allowedPaths.has(difference.path), `Unexpected Program field change: ${difference.path}`);

const now = new Date().toISOString();
const params = new URLSearchParams();
for (const field of ["data", "revision", "lastMutationId", "updatedAt"]) params.append("updateMask.fieldPaths", field);
params.set("currentDocument.updateTime", rawBefore.updateTime);
const patchResponse = await fetch(`${programUrl}?${params}`, {
  method: "PATCH",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ fields: {
    data: encode(applied.planner),
    revision: { integerValue: String(before.revision + 1) },
    lastMutationId: { stringValue: mutationId },
    updatedAt: { timestampValue: now },
  } }),
});
const rawPatched = await patchResponse.json();
if (!patchResponse.ok) throw new Error(rawPatched.error?.message ?? `Firestore update returned ${patchResponse.status}`);

const verifyResponse = await fetch(programUrl, { headers });
const rawAfter = await verifyResponse.json();
if (!verifyResponse.ok) throw new Error(rawAfter.error?.message ?? `Firestore read-back returned ${verifyResponse.status}`);
const after = validateCloudProgram(decodeDocument(rawAfter));
assert.equal(after.revision, before.revision + 1);
assert.equal(after.lastMutationId, mutationId);
assert.deepEqual(after.data, applied.planner);
assert.deepEqual(protectedState(after.data), protectedState(before.data));

const dryAfter = reconcileLinkedUnitTitles(after.data, index, { mode: "dry-run", sourceAvailable: true });
assert.deepEqual(unresolvedBootstrap(dryAfter.report), [
  { target: "unit", spId: "hello-friends", externalId: "prep-numbers", oldValue: "Numbers", newValue: "Numbers 0-10 I" },
]);
assert.equal(dryAfter.report.units.flatMap((unit) => unit.titleConflicts).length, 0);
assert.equal(dryAfter.report.units.flatMap((unit) => unit.unmappedItems).length, 31);

const verification = {
  status: "updated-and-verified",
  projectId,
  programId,
  revisionBefore: before.revision,
  revisionAfter: after.revision,
  mutationId,
  liveIndexGeneratedAt: index.generatedAt,
  familyBefore,
  familyAfter: familyState(after.data),
  baselinedRecords: approvedBootstrapKeys,
  sourceDriftObservedAfterApproval: {
    externalId: "year-4-australia-states-and-territories",
    approvedDryRunExternalTitle: "Australia States and Territories",
    writeTimeExternalTitle: "Australian States and Territories",
    spTitleChanged: false,
    treatment: "Current titles matched at write time, so only lastSyncedTitle was initialized.",
  },
  unresolvedBootstrapDifferences: unresolvedBootstrap(dryAfter.report),
  plannerFieldChanges: plannerDiff,
  cloudDocumentFieldsChanged: ["data", "revision", "lastMutationId", "updatedAt"],
  protectedStateCanonicalHashBefore: hash(protectedState(before.data)),
  protectedStateCanonicalHashAfter: hash(protectedState(after.data)),
  backupRestorePayloadSha256: createHash("sha256").update(exportPlannerData(after.data)).digest("hex"),
};
const reportPath = "/Users/weiwang/Downloads/specialist-planner-staging-linked-title-write-verification-2026-10-03.json";
await writeFile(reportPath, `${JSON.stringify(verification, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ...verification, reportPath }, null, 2));
