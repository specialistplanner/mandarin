import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { validateCloudProgram } from "../lib/cloud-program.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import {
  V080_AUTHORITY_CUTOVER,
  applyV080AuthorityCutover,
} from "../lib/v080-authority-cutover.ts";

const require = createRequire(import.meta.url);
const { requireAuth } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/requireAuth.js");
const { getAccessToken } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/apiv2.js");
const { configstore } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/configstore.js");

const PROJECT_ID = "specialist-planner-staging";
const PROGRAM_ID = "program-ff3c47db-26e6-4e64-8236-976cbcee9b91";
const EXPECTED_REVISION = 89;
const EXPECTED_UPDATE_TIME = "2026-10-04T01:31:29.839461Z";
const EXPECTED_BACKUP_SHA256 = "9d4cbef4b50b531746094476256fe780944465438dc880d4a012a83372a4c552";
const EXPECTED_BACKUP_CANONICAL_SHA256 = "2b13d094ea7aa49dfbfb1963d11e78a8ad2df2543345a27ced6b430ab8310d23";
const EXPECTED_PROTECTED_SHA256 = "9cf90979ada28da44f1fdbd3469c14bf23278a721d49e17b1ca005b3be3d7b8f";
const EXPECTED_TEACHING_SNAPSHOT_SHA256 = "de69086ad8fc3d204c3fc84447f64d15416bd4f197d16877cae2e50d3f68be60";
const MUTATION_ID = "v080-authority-cutover-family-fruit-revision-89";
const BACKUP_PATH = new URL("../backups/specialist-planner-backup-staging-pre-v080-authority-cutover-2026-10-04-rev-89.json", import.meta.url);
const REPORT_PATH = new URL("../audits/specialist-planner-v080-phase-a-write-verification-2026-10-04-rev-90.json", import.meta.url);
const PROGRAM_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/programs/${PROGRAM_ID}`;

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

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function protectedState(program) {
  const planner = program.data;
  return {
    cloudOwnership: {
      id: program.id,
      ownerUid: program.ownerUid,
      memberUids: program.memberUids,
      members: program.members,
      createdAt: program.createdAt,
    },
    subjects: planner.subjects,
    activeSubjectId: planner.activeSubjectId,
    yearLevels: planner.yearLevels,
    classes: planner.classes,
    classProgress: planner.classProgress,
    progressBaselines: planner.progressBaselines,
    progressCheckpoints: planner.progressCheckpoints,
    classColours: planner.classColours,
    sessionSlots: planner.sessionSlots,
    timetableSessions: planner.timetableSessions,
    teachingSessions: planner.teachingSessions,
    schoolYears: planner.schoolYears,
    terms: planner.terms,
    nonTeachingPeriods: planner.nonTeachingPeriods,
    reconciliationStatus: planner.reconciliationStatus ?? null,
    trialNotes: planner.trialNotes,
  };
}

function teachingSnapshots(planner) {
  // Must remain byte-for-byte compatible with the approved dry-run hash.
  return planner.teachingSessions;
}

function unitSnapshot(planner, unitId) {
  const unit = planner.units.find((candidate) => candidate.id === unitId);
  assert.ok(unit, `Unit ${unitId} was not found.`);
  return {
    id: unit.id,
    title: unit.title,
    externalResourceRef: unit.externalResourceRef ?? null,
    lessons: unit.lessons.map((lesson) => ({
      id: lesson.id,
      sequence: lesson.sequence,
      title: lesson.title,
      externalResourceRef: lesson.externalResourceRef ?? null,
      vocabularySetId: lesson.vocabularySetId ?? null,
    })),
  };
}

function classPositions(planner, classIds) {
  return Object.fromEntries(classIds.map((classId) => [classId, {
    progress: planner.classProgress[classId],
    baseline: planner.progressBaselines[classId],
    checkpoint: planner.progressCheckpoints[classId] ?? null,
  }]));
}

const backupText = await readFile(BACKUP_PATH, "utf8");
assert.equal(createHash("sha256").update(backupText).digest("hex"), EXPECTED_BACKUP_SHA256, "The approved pre-write backup changed; write aborted.");
const backupPlanner = importPlannerData(backupText);
assert.equal(hash(JSON.parse(exportPlannerData(backupPlanner))), EXPECTED_BACKUP_CANONICAL_SHA256, "The approved backup no longer restores to the approved Planner state.");

await requireAuth({ user: configstore.get("user"), tokens: configstore.get("tokens") });
const token = await getAccessToken();
const headers = { Authorization: `Bearer ${token}` };
const beforeResponse = await fetch(PROGRAM_URL, { headers });
const rawBefore = await beforeResponse.json();
if (!beforeResponse.ok) throw new Error(rawBefore.error?.message ?? `Firestore returned ${beforeResponse.status}`);
const cloudAtStart = validateCloudProgram(decodeDocument(rawBefore));
const alreadyApplied = cloudAtStart.lastMutationId === MUTATION_ID && cloudAtStart.revision === EXPECTED_REVISION + 1;
assert.ok(alreadyApplied || cloudAtStart.revision === EXPECTED_REVISION, "Staging revision changed outside the approved Phase A mutation; verification aborted.");
assert.equal(cloudAtStart.name, "Mandarin", "The approved staging Mandarin Program was not found.");
assert.equal(cloudAtStart.data.classes.length, 16, "The approved 16-class Mandarin Program was not found.");

const before = { ...cloudAtStart, revision: EXPECTED_REVISION, lastMutationId: "save-56c84a84-ca50-443e-bf43-241d5ee7c70a", data: backupPlanner };
assert.equal(hash(protectedState(before)), EXPECTED_PROTECTED_SHA256, "The restorable backup does not contain the approved protected state.");
assert.equal(hash(teachingSnapshots(before.data)), EXPECTED_TEACHING_SNAPSHOT_SHA256, "The restorable backup does not contain the approved Teaching Session snapshots.");

if (!alreadyApplied) {
  assert.equal(rawBefore.updateTime, EXPECTED_UPDATE_TIME, "Staging document changed after the approved dry-run; write aborted.");
  assert.equal(hash(JSON.parse(exportPlannerData(cloudAtStart.data))), EXPECTED_BACKUP_CANONICAL_SHA256, "Cloud read-back no longer matches the restorable pre-write backup.");
}

const appliedTimestamp = alreadyApplied
  ? cloudAtStart.data.units.find((unit) => unit.id === V080_AUTHORITY_CUTOVER.family.unitId)?.lessons.find((lesson) => lesson.id === V080_AUTHORITY_CUTOVER.family.newLessonId)?.createdAt
  : new Date().toISOString();
assert.ok(appliedTimestamp, "The applied Phase A timestamp could not be established.");
const applied = applyV080AuthorityCutover(before.data, appliedTimestamp);
assert.equal(applied.report.changed, true, "Approved Phase A migration produced no change.");

const unaffectedBefore = before.data.units.filter((unit) => ![V080_AUTHORITY_CUTOVER.family.unitId, V080_AUTHORITY_CUTOVER.fruit.unitId].includes(unit.id));
const unaffectedAfter = applied.planner.units.filter((unit) => ![V080_AUTHORITY_CUTOVER.family.unitId, V080_AUTHORITY_CUTOVER.fruit.unitId].includes(unit.id));
assert.deepEqual(canonical(unaffectedAfter), canonical(unaffectedBefore), "A Unit outside Family/Fruit changed; write aborted.");
assert.equal(hash(protectedState({ ...before, data: applied.planner })), EXPECTED_PROTECTED_SHA256, "Protected operational state would change; write aborted.");
assert.equal(hash(teachingSnapshots(applied.planner)), EXPECTED_TEACHING_SNAPSHOT_SHA256, "Historical snapshots would change; write aborted.");

const positionsBefore = classPositions(before.data, ["2a", "2c", "3a", "3b"]);
const positionsAfter = classPositions(applied.planner, ["2a", "2c", "3a", "3b"]);
assert.deepEqual(positionsAfter, positionsBefore, "Family/Fruit class positions changed; write aborted.");
assert.equal(applied.planner.teachingSessions.length, before.data.teachingSessions.length, "Teaching Sessions were created or removed; write aborted.");

let rawAfter = rawBefore;
let after = cloudAtStart;
if (!alreadyApplied) {
  const params = new URLSearchParams();
  for (const field of ["data", "revision", "lastMutationId", "updatedAt"]) params.append("updateMask.fieldPaths", field);
  params.set("currentDocument.updateTime", rawBefore.updateTime);
  const patchResponse = await fetch(`${PROGRAM_URL}?${params}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: {
      data: encode(applied.planner),
      revision: { integerValue: String(before.revision + 1) },
      lastMutationId: { stringValue: MUTATION_ID },
      updatedAt: { timestampValue: appliedTimestamp },
    } }),
  });
  const rawPatched = await patchResponse.json();
  if (!patchResponse.ok) throw new Error(rawPatched.error?.message ?? `Firestore update returned ${patchResponse.status}`);

  const afterResponse = await fetch(PROGRAM_URL, { headers });
  rawAfter = await afterResponse.json();
  if (!afterResponse.ok) throw new Error(rawAfter.error?.message ?? `Firestore read-back returned ${afterResponse.status}`);
  after = validateCloudProgram(decodeDocument(rawAfter));
}
assert.equal(after.revision, EXPECTED_REVISION + 1);
assert.equal(after.lastMutationId, MUTATION_ID);
assert.deepEqual(canonical(after.data), canonical(applied.planner), "Cloud Planner read-back differs from the approved migration payload.");
assert.equal(hash(protectedState(after)), EXPECTED_PROTECTED_SHA256);
assert.equal(hash(teachingSnapshots(after.data)), EXPECTED_TEACHING_SNAPSHOT_SHA256);
assert.deepEqual(classPositions(after.data, ["2a", "2c", "3a", "3b"]), positionsBefore);
assert.deepEqual(canonical(after.data.units.filter((unit) => ![V080_AUTHORITY_CUTOVER.family.unitId, V080_AUTHORITY_CUTOVER.fruit.unitId].includes(unit.id))), canonical(unaffectedBefore));

const secondRun = applyV080AuthorityCutover(after.data, new Date().toISOString());
assert.equal(secondRun.report.changed, false, "Migration was not idempotent after cloud read-back.");
assert.equal(secondRun.planner, after.data);

const report = {
  status: alreadyApplied ? "recovered-post-write-verification-and-verified" : "updated-and-verified",
  projectId: PROJECT_ID,
  programId: PROGRAM_ID,
  revisionBefore: before.revision,
  revisionAfter: after.revision,
  firestoreUpdateTimeBefore: EXPECTED_UPDATE_TIME,
  firestoreUpdateTimeAfter: rawAfter.updateTime,
  mutationId: MUTATION_ID,
  cloudDocumentFieldsChanged: ["data", "revision", "lastMutationId", "updatedAt"],
  programDataChanges: {
    family: { before: unitSnapshot(before.data, V080_AUTHORITY_CUTOVER.family.unitId), after: unitSnapshot(after.data, V080_AUTHORITY_CUTOVER.family.unitId) },
    fruit: { before: unitSnapshot(before.data, V080_AUTHORITY_CUTOVER.fruit.unitId), after: unitSnapshot(after.data, V080_AUTHORITY_CUTOVER.fruit.unitId) },
    addedLessonIds: applied.report.addedLessonIds,
    preservedExistingLessonIds: applied.report.preservedExistingLessonIds,
    unaffectedUnitIds: unaffectedBefore.map((unit) => unit.id),
  },
  classPositionsBefore: positionsBefore,
  classPositionsAfter: classPositions(after.data, ["2a", "2c", "3a", "3b"]),
  protectedStateCanonicalSha256Before: hash(protectedState(before)),
  protectedStateCanonicalSha256After: hash(protectedState(after)),
  teachingSnapshotSha256Before: hash(teachingSnapshots(before.data)),
  teachingSnapshotSha256After: hash(teachingSnapshots(after.data)),
  teachingSessionCountBefore: before.data.teachingSessions.length,
  teachingSessionCountAfter: after.data.teachingSessions.length,
  preWriteBackup: {
    path: BACKUP_PATH.pathname,
    sha256: EXPECTED_BACKUP_SHA256,
    canonicalPlannerSha256: EXPECTED_BACKUP_CANONICAL_SHA256,
    restorePath: "Settings → Backup & Restore → Import planner backup",
  },
  idempotentReadBackVerified: true,
  productionModified: false,
  tmrModified: false,
};
await mkdir(new URL("../audits/", import.meta.url), { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ...report, reportPath: REPORT_PATH.pathname }, null, 2));
