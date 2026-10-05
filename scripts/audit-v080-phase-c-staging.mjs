import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { validateCloudProgram } from "../lib/cloud-program.ts";

const require = createRequire(import.meta.url);
const { requireAuth } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/requireAuth.js");
const { getAccessToken } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/apiv2.js");
const { configstore } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/configstore.js");

const PROJECT_ID = "specialist-planner-staging";
const PROGRAM_ID = "program-ff3c47db-26e6-4e64-8236-976cbcee9b91";
const PHASE_C_PRE_DEPLOY_REVISION = 100;
const EXPECTED_PLANNER_HASH = "329b7ab9d76ada07133707a1f59ab61a6291f46898e3568f903578ebe54dc398";
const EXPECTED_PROTECTED_HASH = "b8e875f4b82312a9901f7d49b75caa20827f3ce2f63e5138fb29f046103554a9";
const EXPECTED_TEACHING_HASH = "051bda7ad7b396711e7b3d1a85d7adf5b24f9f1f7a4f98d3e9f436c63b70be96";
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

await requireAuth({ user: configstore.get("user"), tokens: configstore.get("tokens") });
const token = await getAccessToken();
const response = await fetch(PROGRAM_URL, { headers: { Authorization: `Bearer ${token}` } });
const raw = await response.json();
if (!response.ok) throw new Error(raw.error?.message ?? `Firestore returned ${response.status}`);
const program = validateCloudProgram(Object.fromEntries(Object.entries(raw.fields ?? {}).map(([key, value]) => [key, decode(value)])));
const plannerHash = hash(program.data);
const protectedHash = hash(protectedState(program));
const teachingHash = hash(program.data.teachingSessions);

assert.equal(program.revision, PHASE_C_PRE_DEPLOY_REVISION, "Staging Program revision changed after the Phase C pre-deploy baseline.");
assert.equal(plannerHash, EXPECTED_PLANNER_HASH, "Staging Planner data changed after the Phase C pre-deploy baseline.");
assert.equal(protectedHash, EXPECTED_PROTECTED_HASH, "Protected staging state changed after the Phase C pre-deploy baseline.");
assert.equal(teachingHash, EXPECTED_TEACHING_HASH, "Historical Teaching Session snapshots changed after the Phase C pre-deploy baseline.");
assert.equal(program.data.teachingSessions.length, 60);

console.log(JSON.stringify({
  status: "verified-read-only",
  projectId: PROJECT_ID,
  programId: PROGRAM_ID,
  revision: program.revision,
  lastMutationId: program.lastMutationId,
  firestoreUpdateTime: raw.updateTime,
  plannerCanonicalHash: plannerHash,
  protectedStateCanonicalHash: protectedHash,
  teachingSessionCanonicalHash: teachingHash,
  teachingSessionCount: program.data.teachingSessions.length,
  classPositions: Object.fromEntries(["2a", "2c", "3a", "3b", "6b", "6d"].map((classId) => [classId, program.data.classProgress[classId]])),
}, null, 2));
