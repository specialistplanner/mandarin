import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { validateCloudProgram } from "../lib/cloud-program.ts";
import { importPlannerData } from "../lib/storage.ts";
import { V080_AUTHORITY_CUTOVER, applyV080AuthorityCutover } from "../lib/v080-authority-cutover.ts";

const require = createRequire(import.meta.url);
const { requireAuth } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/requireAuth.js");
const { getAccessToken } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/apiv2.js");
const { configstore } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/configstore.js");

const PROJECT_ID = "specialist-planner-staging";
const PROGRAM_ID = "program-ff3c47db-26e6-4e64-8236-976cbcee9b91";
const ACCEPTED_PHASE_A_REVISION = 90;
const PHASE_B_CONTENT_BASELINE_REVISION = 93;
const PHASE_B_VERIFICATION_REVISION = 95;
const EXPECTED_PLANNER_HASH = "5775216282071328573b37d44db1f4ef8c31bb0662a83e366bb4205daf59cf38";
const EXPECTED_PROTECTED_HASH = "6d9ce582de4be40cb130a227c46287638691900c3df1c374253c1990d390f291";
const EXPECTED_TEACHING_HASH = "de69086ad8fc3d204c3fc84447f64d15416bd4f197d16877cae2e50d3f68be60";
const PROGRAM_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/programs/${PROGRAM_ID}`;
const PHASE_A_BACKUP = new URL("../backups/specialist-planner-backup-staging-pre-v080-authority-cutover-2026-10-04-rev-89.json", import.meta.url);
const diagnosticMode = process.argv.includes("--diagnose");

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
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function protectedState(program) {
  const planner = program.data;
  return {
    cloudOwnership: { id: program.id, ownerUid: program.ownerUid, memberUids: program.memberUids, members: program.members, createdAt: program.createdAt },
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

function unitSnapshot(planner, unitId) {
  const unit = planner.units.find((candidate) => candidate.id === unitId);
  assert.ok(unit, `Unit ${unitId} was not found.`);
  return { id: unit.id, title: unit.title, lessonIds: unit.lessons.map((lesson) => lesson.id), lessonTitles: unit.lessons.map((lesson) => lesson.title) };
}

function differences(before, after, path = "data", results = []) {
  if (JSON.stringify(canonical(before)) === JSON.stringify(canonical(after))) return results;
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.every((item) => item && typeof item === "object" && "id" in item) && after.every((item) => item && typeof item === "object" && "id" in item)) {
      const beforeById = new Map(before.map((item) => [item.id, item]));
      const afterById = new Map(after.map((item) => [item.id, item]));
      for (const id of new Set([...beforeById.keys(), ...afterById.keys()])) differences(beforeById.get(id), afterById.get(id), `${path}[id=${id}]`, results);
      return results;
    }
    results.push({ path, before, after });
    return results;
  }
  if (before && after && typeof before === "object" && typeof after === "object") {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) differences(before[key], after[key], `${path}.${key}`, results);
    return results;
  }
  results.push({ path, before: before ?? null, after: after ?? null });
  return results;
}

await requireAuth({ user: configstore.get("user"), tokens: configstore.get("tokens") });
const token = await getAccessToken();
const response = await fetch(PROGRAM_URL, { headers: { Authorization: `Bearer ${token}` } });
const raw = await response.json();
if (!response.ok) throw new Error(raw.error?.message ?? `Firestore returned ${response.status}`);
const program = validateCloudProgram(Object.fromEntries(Object.entries(raw.fields ?? {}).map(([key, value]) => [key, decode(value)])));
const family = unitSnapshot(program.data, V080_AUTHORITY_CUTOVER.family.unitId);
const fruit = unitSnapshot(program.data, V080_AUTHORITY_CUTOVER.fruit.unitId);
const protectedHash = hash(protectedState(program));
const teachingHash = hash(program.data.teachingSessions);
const phaseABackup = importPlannerData(await readFile(PHASE_A_BACKUP, "utf8"));
const phaseAPlanner = applyV080AuthorityCutover(phaseABackup, "2026-10-04T03:25:04.307970Z").planner;
const changesSinceRevision90 = differences(phaseAPlanner, program.data);

if (!diagnosticMode) {
  assert.equal(program.revision, PHASE_B_VERIFICATION_REVISION, "Staging Program revision changed after the Phase B verification baseline.");
  assert.equal(hash(program.data), EXPECTED_PLANNER_HASH, "Staging Planner data changed after the Phase B baseline audit.");
  assert.equal(protectedHash, EXPECTED_PROTECTED_HASH, "Protected staging state changed after the Phase B baseline audit.");
  assert.equal(teachingHash, EXPECTED_TEACHING_HASH, "Historical Teaching Session snapshots changed.");
}
assert.deepEqual(family.lessonIds, [
  "lesson-c7991263-82ec-466e-b454-952da0f71048",
  "lesson-c913759e-a856-495e-adf7-936152feac06",
  "lesson-v080-year-2-family-tree-ii",
  "lesson-93f2899f-5790-4fae-8cf0-58118aa32fcb",
  "lesson-8381da89-e8f2-40ef-8d92-e398c87911af",
]);
assert.deepEqual(fruit.lessonIds, [
  "lesson-746ae4ac-ce6a-4f2e-9393-e8f1ce7df440",
  "lesson-a1431c95-c3e9-46e2-91f8-d198d88a3a82",
  "lesson-6abd117d-f5bf-4934-9d25-240f9e8c89d8",
  "lesson-v080-year-3-fruit-dislike",
  "lesson-v080-year-3-fruit-revision",
]);

console.log(JSON.stringify({
  status: "verified-read-only",
  projectId: PROJECT_ID,
  programId: PROGRAM_ID,
  revision: program.revision,
  lastMutationId: program.lastMutationId,
  acceptedPhaseARevision: ACCEPTED_PHASE_A_REVISION,
  phaseBContentBaselineRevision: PHASE_B_CONTENT_BASELINE_REVISION,
  phaseBVerificationRevision: PHASE_B_VERIFICATION_REVISION,
  firestoreUpdateTime: raw.updateTime,
  plannerCanonicalHash: hash(program.data),
  protectedStateCanonicalHash: protectedHash,
  teachingSessionCanonicalHash: teachingHash,
  teachingSessionCount: program.data.teachingSessions.length,
  matchesPhaseBBaselinePlannerHash: hash(program.data) === EXPECTED_PLANNER_HASH,
  matchesPhaseBBaselineProtectedHash: protectedHash === EXPECTED_PROTECTED_HASH,
  matchesAcceptedHistoricalHash: teachingHash === EXPECTED_TEACHING_HASH,
  changesSinceRevision90,
  family,
  fruit,
  linkedTmrUnitCount: program.data.units.filter((unit) => unit.externalResourceRef?.provider === "the-mandarin-room-unit-library").length,
  classPositions: Object.fromEntries(["2a", "2c", "3a", "3b"].map((classId) => [classId, {
    progress: program.data.classProgress[classId],
    baseline: program.data.progressBaselines[classId],
    checkpoint: program.data.progressCheckpoints[classId] ?? null,
  }])),
}, null, 2));
