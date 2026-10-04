import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { validateCloudProgram } from "../lib/cloud-program.ts";
import { exportPlannerData, importPlannerData } from "../lib/storage.ts";
import { parseUnitLibraryIndex, UNIT_LIBRARY_LIVE_INDEX_URL } from "../lib/unit-library.ts";

const require = createRequire(import.meta.url);
const { requireAuth } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/requireAuth.js");
const { getAccessToken } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/apiv2.js");
const { configstore } = require("/opt/homebrew/lib/node_modules/firebase-tools/lib/configstore.js");

const PROJECT_ID = "specialist-planner-staging";
const PROGRAM_ID = "program-ff3c47db-26e6-4e64-8236-976cbcee9b91";
const PROGRAM_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/programs/${PROGRAM_ID}`;
const REPORT_DATE = "2026-10-04";
const PROVENANCE_AUDIT_PATH = new URL("../audits/specialist-planner-legacy-unit-reconciliation-audit-2026-10-03.json", import.meta.url);

const LEGACY_STRATEGIES = {
  "prep-numbers": {
    strategy: "unresolved / owner decision required",
    reason: "The seven-Lesson SP-native structure and current TMR structure use materially different titles. No stable Lesson provenance IDs exist.",
  },
  "year-4-australia-states-and-territories": {
    strategy: "unresolved / owner decision required",
    reason: "The SP-native Unit has six Lessons while the current library has seven, including insertions and renamed concepts. No safe automatic mapping exists.",
  },
  "year-5-countries": {
    strategy: "unresolved / owner decision required",
    reason: "The current library splits Where is China into two Lessons and shifts later Lessons. No safe automatic mapping exists.",
  },
  "year-6-chinese-names": {
    strategy: "preserve existing SP structure",
    reason: "The five current titles and order already match. Preserve the SP-native stable IDs and do not fabricate TMR Lesson provenance.",
  },
  "year-2-family": {
    strategy: "preserve legacy historical structure + create current Term 4 structure",
    reason: "Keep the four SP-native IDs, insert a new SP-owned Family Tree II ID, and adopt the current five-Lesson sequence without assigning unproven TMR Lesson provenance.",
  },
  "year-3-fruit": {
    strategy: "preserve legacy historical structure + create current Term 4 structure",
    reason: "Keep the three SP-native IDs and add two new SP-owned IDs for the current five-Lesson sequence without fabricating historical outcomes or TMR provenance.",
  },
};

const NEW_STYLE_IDS = new Set([
  "year-6-family-ii",
  "year4-australian-states-territories",
  "year-5-nationalities",
  "prep-colours",
  "year-1-mountains-and-water",
]);

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

function decodeDocument(document) {
  return Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, decode(value)]));
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

function currentIdentityState(planner) {
  return planner.units.map((unit) => ({
    unitId: unit.id,
    lessonIds: unit.lessons.map((lesson) => lesson.id),
  }));
}

function unitByExternalId(planner, externalId) {
  const unit = planner.units.find((candidate) => candidate.externalResourceRef?.resourceId === externalId);
  assert.ok(unit, `Program Unit linked to ${externalId} was not found.`);
  return unit;
}

function liveUnitById(index, externalId) {
  const unit = index.units.find((candidate) => candidate.id === externalId);
  assert.ok(unit, `Current library Unit ${externalId} was not found.`);
  return unit;
}

function dependencySummary(planner, unit) {
  const lessonIds = new Set(unit.lessons.map((lesson) => lesson.id));
  const classes = planner.classes.filter((item) => planner.classProgress[item.id]?.unitId === unit.id).map((item) => ({
    classId: item.id,
    className: item.name,
    actual: planner.classProgress[item.id],
    baseline: planner.progressBaselines[item.id] ?? null,
    checkpoint: planner.progressCheckpoints[item.id] ?? null,
  }));
  const yearLevels = planner.yearLevels.filter((level) => level.currentUnitId === unit.id || lessonIds.has(level.expectedLessonId)).map((level) => ({
    id: level.id,
    label: level.label,
    currentUnitId: level.currentUnitId,
    expectedLessonId: level.expectedLessonId,
  }));
  const sessions = planner.teachingSessions.filter((session) => session.plannedUnitId === unit.id || lessonIds.has(session.plannedLessonId));
  return {
    currentClasses: classes,
    cohortReferences: yearLevels,
    historicalTeachingSessionCount: sessions.length,
    historicalOutcomeCounts: Object.fromEntries(["planned", "completed", "partial", "not-taught"].map((outcome) => [outcome, sessions.filter((session) => session.outcome === outcome).length])),
    historicalLessonIds: [...new Set(sessions.map((session) => session.plannedLessonId))],
    historicalSnapshotHash: hash(sessions.map((session) => ({
      id: session.id,
      plannedUnitId: session.plannedUnitId,
      plannedLessonId: session.plannedLessonId,
      plannedUnitTitle: session.plannedUnitTitle,
      plannedLessonTitle: session.plannedLessonTitle,
      outcome: session.outcome,
      reason: session.reason ?? null,
      note: session.note ?? null,
    }))),
  };
}

function lessonView(lesson) {
  return {
    id: lesson.id,
    sequence: lesson.sequence,
    title: lesson.title,
    externalResourceId: lesson.externalResourceRef?.resourceId ?? null,
    vocabularySetId: lesson.vocabularySetId ?? null,
  };
}

function plannedCurrentStructure(planner, index, externalId) {
  const unit = unitByExternalId(planner, externalId);
  const library = liveUnitById(index, externalId);
  const old = [...unit.lessons].sort((a, b) => a.sequence - b.sequence);
  if (externalId === "year-2-family") {
    assert.equal(old.length, 4, "Family legacy structure changed; dry-run must be reviewed.");
    assert.equal(library.lessons.length, 5, "Current Family library structure changed; dry-run must be reviewed.");
    return {
      unitId: unit.id,
      unitTitle: unit.title,
      sourceLibraryId: externalId,
      lessons: [
        { ...lessonView(old[0]), sequence: 1, title: library.lessons[0].title, treatment: "preserve SP ID; current title already aligned; no TMR Lesson provenance assigned" },
        { ...lessonView(old[1]), sequence: 2, title: library.lessons[1].title, treatment: "preserve SP ID and 2A/2C stable position; no TMR Lesson provenance assigned" },
        { id: "lesson-v080-year-2-family-tree-ii", sequence: 3, title: library.lessons[2].title, externalResourceId: null, vocabularySetId: null, treatment: "new SP-owned current Lesson; no historical outcome and no inferred TMR provenance" },
        { ...lessonView(old[2]), sequence: 4, title: library.lessons[3].title, treatment: "preserve SP ID; move current presentation sequence only; historical snapshots unchanged" },
        { ...lessonView(old[3]), sequence: 5, title: library.lessons[4].title, treatment: "preserve SP ID; adopt current display title only after owner approval; historical snapshots unchanged" },
      ],
    };
  }
  if (externalId === "year-3-fruit") {
    assert.equal(old.length, 3, "Fruit legacy structure changed; dry-run must be reviewed.");
    assert.equal(library.lessons.length, 5, "Current Fruit library structure changed; dry-run must be reviewed.");
    return {
      unitId: unit.id,
      unitTitle: unit.title,
      sourceLibraryId: externalId,
      lessons: [
        ...old.map((lesson, indexInUnit) => ({ ...lessonView(lesson), sequence: indexInUnit + 1, title: library.lessons[indexInUnit].title, treatment: "preserve SP ID; current title/order already aligned; no TMR Lesson provenance assigned" })),
        { id: "lesson-v080-year-3-fruit-dislike", sequence: 4, title: library.lessons[3].title, externalResourceId: null, vocabularySetId: null, treatment: "new SP-owned current Lesson; no historical outcome and no inferred TMR provenance" },
        { id: "lesson-v080-year-3-fruit-revision", sequence: 5, title: library.lessons[4].title, externalResourceId: null, vocabularySetId: null, treatment: "new SP-owned current Lesson; no historical outcome and no inferred TMR provenance" },
      ],
    };
  }
  throw new Error(`No v0.8 Term 4 proposal exists for ${externalId}.`);
}

function exactProposedWrites(program, proposals) {
  const writes = [];
  for (const proposal of proposals) {
    const unitIndex = program.data.units.findIndex((unit) => unit.id === proposal.unitId);
    const current = program.data.units[unitIndex];
    writes.push({
      operation: "reorder current curriculum array",
      path: `data.units[${unitIndex}].lessons order`,
      before: current.lessons.map((lesson) => lesson.id),
      after: proposal.lessons.map((lesson) => lesson.id),
      approvalRequired: true,
    });
    for (const lesson of proposal.lessons) {
      const existing = current.lessons.find((candidate) => candidate.id === lesson.id);
      if (!existing) {
        writes.push({
          operation: "add SP-owned current Lesson",
          path: `data.units[${unitIndex}].lessons[id=${lesson.id}]`,
          before: null,
          after: { id: lesson.id, title: lesson.title, sequence: lesson.sequence, schemaVersion: 1, createdAt: "<migration timestamp>", updatedAt: "<migration timestamp>" },
          approvalRequired: true,
        });
        continue;
      }
      if (existing.sequence !== lesson.sequence) writes.push({ operation: "change current sequence", path: `data.units[${unitIndex}].lessons[id=${lesson.id}].sequence`, before: existing.sequence, after: lesson.sequence, approvalRequired: true });
      if (existing.title !== lesson.title) writes.push({ operation: "change current display title", path: `data.units[${unitIndex}].lessons[id=${lesson.id}].title`, before: existing.title, after: lesson.title, approvalRequired: true });
    }
    writes.push({ path: `data.units[${unitIndex}].updatedAt`, before: current.updatedAt ?? null, after: "<migration timestamp>", approvalRequired: true });
  }
  writes.push({ path: "data.updatedAt", before: program.data.updatedAt, after: "<migration timestamp>", approvalRequired: true });
  writes.push({ path: "revision", before: program.revision, after: program.revision + 1, approvalRequired: true });
  writes.push({ path: "lastMutationId", before: program.lastMutationId, after: `v080-authority-cutover-revision-${program.revision}`, approvalRequired: true });
  writes.push({ path: "updatedAt", before: program.updatedAt, after: "<migration timestamp>", approvalRequired: true });
  return writes;
}

function markdown(report) {
  const legacyRows = report.legacyUnits.map((unit) => `| ${unit.title} | ${unit.provenance} | ${unit.strategy} | ${unit.historicalLessons.length} → ${unit.proposedCurrentLessons?.length ?? unit.historicalLessons.length} | ${unit.dependencies.currentClasses.map((item) => item.className).join(", ") || "—"} |`).join("\n");
  const structures = report.priorityProposals.map((proposal) => `### ${proposal.unitTitle}\n\n| Seq | SP Lesson ID | Current title | Treatment |\n|---:|---|---|---|\n${proposal.lessons.map((lesson) => `| ${lesson.sequence} | \`${lesson.id}\` | ${lesson.title} | ${lesson.treatment} |`).join("\n")}\n\nCurrent class dependencies: ${proposal.dependencies.currentClasses.map((item) => `${item.className} → ${item.actual.lessonId}`).join(", ") || "none"}. Historical Teaching Sessions: ${proposal.dependencies.historicalTeachingSessionCount}.`).join("\n\n");
  return `# Specialist Planner v0.8.0 — Phase A migration dry-run\n\n` +
    `Generated: ${report.generatedAt}\n\n` +
    `**Status: DRY-RUN ONLY — no cloud write, deployment, TMR change or production change was performed.**\n\n` +
    `## Safety gate\n\n` +
    `- Project: \`${report.projectId}\` (staging)\n` +
    `- Program: \`${report.programId}\`\n` +
    `- Current revision: **${report.currentRevision}**\n` +
    `- Firestore read update time: ${report.firestoreUpdateTime}\n` +
    `- Source commit: \`${report.sourceCommit}\`\n` +
    `- Official-format backup: \`${report.backup.path}\`\n` +
    `- Backup SHA-256: \`${report.backup.sha256}\`\n` +
    `- Export → import canonical round-trip: **${report.backup.roundTripVerified ? "PASS" : "FAIL"}**\n` +
    `- Protected-state SHA-256: \`${report.protectedState.sha256}\`\n` +
    `- Teaching snapshot SHA-256: \`${report.protectedState.teachingSnapshotsSha256}\`\n\n` +
    `The backup can be restored through **Settings → Backup & Restore → Import planner backup**.\n\n` +
    `## Legacy Unit decisions\n\n| Unit | Provenance | Proposed strategy | Lesson count | Current classes |\n|---|---|---|---:|---|\n${legacyRows}\n\n` +
    `## Priority Term 4 proposals\n\n${structures}\n\n` +
    `## Owner decisions still required\n\n${report.ownerDecisionsRequired.map((item) => `- **${item.unit}:** ${item.reason}`).join("\n")}\n\n` +
    `## Exact cloud fields proposed after approval\n\n${report.exactProposedWrites.map((item) => `- \`${item.path}\`: ${typeof item.before === "object" ? "structured value" : `\`${String(item.before)}\``} → ${typeof item.after === "object" ? "structured value shown in the JSON report" : `\`${String(item.after)}\``}`).join("\n")}\n\n` +
    `No classProgress, progressBaselines, progressCheckpoints, year-level reference, Teaching Session, timetable, historical title snapshot, ownership, calendar or teacher note field is proposed for change.\n\n` +
    `## Authority cutover implementation after approval\n\n` +
    `- SP becomes the sole current Unit/Lesson authority.\n` +
    `- The 30-second TMR Unit-title reconciliation path will be disabled in Phase A implementation.\n` +
    `- Existing Unit-level links are retained as provenance/rollback metadata only; no new provenance IDs are inferred for legacy Lessons.\n` +
    `- TMR remains authoritative only for referenced classroom resources such as Vocabulary and Speaking Practice.\n` +
    `- Term 3 history and all Teaching Session snapshots remain immutable.\n\n` +
    `## STOP gate\n\nNo migration write is authorised by this dry-run. Owner approval is required for the Family/Fruit proposals and the unresolved curriculum decisions above.\n`;
}

await requireAuth({ user: configstore.get("user"), tokens: configstore.get("tokens") });
const token = await getAccessToken();
const [programResponse, libraryResponse, provenanceText] = await Promise.all([
  fetch(PROGRAM_URL, { headers: { Authorization: `Bearer ${token}` } }),
  fetch(UNIT_LIBRARY_LIVE_INDEX_URL, { headers: { Accept: "application/json" }, cache: "no-store" }),
  readFile(PROVENANCE_AUDIT_PATH, "utf8"),
]);
const rawProgram = await programResponse.json();
if (!programResponse.ok) throw new Error(rawProgram.error?.message ?? `Firestore returned ${programResponse.status}`);
if (!libraryResponse.ok) throw new Error(`Live Unit Library returned ${libraryResponse.status}; dry-run aborted.`);
const program = validateCloudProgram(decodeDocument(rawProgram));
const index = parseUnitLibraryIndex(await libraryResponse.json());
const provenanceAudit = JSON.parse(provenanceText);
const backupPath = new URL(`../backups/specialist-planner-backup-staging-pre-v080-authority-cutover-${REPORT_DATE}-rev-${program.revision}.json`, import.meta.url);
const jsonReportPath = new URL(`../audits/specialist-planner-v080-phase-a-dry-run-${REPORT_DATE}-rev-${program.revision}.json`, import.meta.url);
const markdownReportPath = new URL(`../audits/specialist-planner-v080-phase-a-dry-run-${REPORT_DATE}-rev-${program.revision}.md`, import.meta.url);

assert.equal(program.id, PROGRAM_ID);
assert.equal(program.name, "Mandarin");
assert.equal(program.data.classes.length, 16, "Expected the established 16-class Mandarin Program.");

const exported = exportPlannerData(program.data);
const restored = importPlannerData(exported);
assert.deepEqual(canonical(restored), canonical(program.data), "Official backup export/import canonical comparison failed.");
await mkdir(new URL("../backups/", import.meta.url), { recursive: true });
let existingBackup = null;
try { existingBackup = await readFile(backupPath, "utf8"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
if (existingBackup === null) await writeFile(backupPath, `${exported}\n`, { encoding: "utf8", flag: "wx" });
else assert.deepEqual(canonical(importPlannerData(existingBackup)), canonical(restored), "The existing pre-write backup differs from the current staging revision; choose a new backup name before continuing.");

const familyProposal = plannedCurrentStructure(program.data, index, "year-2-family");
const fruitProposal = plannedCurrentStructure(program.data, index, "year-3-fruit");
for (const proposal of [familyProposal, fruitProposal]) proposal.dependencies = dependencySummary(program.data, program.data.units.find((unit) => unit.id === proposal.unitId));

const provenanceByExternalId = new Map(provenanceAudit.units.map((entry) => [entry.tmrUnit.id, entry]));
const legacyUnits = Object.entries(LEGACY_STRATEGIES).map(([externalId, decision]) => {
  const unit = unitByExternalId(program.data, externalId);
  const provenance = provenanceByExternalId.get(externalId)?.provenance?.classification ?? "unknown";
  const proposal = [familyProposal, fruitProposal].find((candidate) => candidate.sourceLibraryId === externalId);
  return {
    id: unit.id,
    externalId,
    title: unit.title,
    provenance,
    strategy: decision.strategy,
    reason: decision.reason,
    historicalLessons: unit.lessons.map(lessonView),
    proposedCurrentLessons: proposal?.lessons ?? null,
    preservedUnitId: unit.id,
    preservedLessonIds: unit.lessons.map((lesson) => lesson.id),
    newLessonIds: proposal?.lessons.filter((lesson) => !unit.lessons.some((current) => current.id === lesson.id)).map((lesson) => lesson.id) ?? [],
    dependencies: dependencySummary(program.data, unit),
    baselineCheckpointImplication: "No baseline/checkpoint write is proposed. Existing stable Lesson identities remain valid; no class is advanced.",
  };
});

const linkedUnits = program.data.units.filter((unit) => unit.externalResourceRef?.resourceType === "unit");
const newStyleUnits = linkedUnits.filter((unit) => NEW_STYLE_IDS.has(unit.externalResourceRef.resourceId)).map((unit) => ({
  id: unit.id,
  title: unit.title,
  externalId: unit.externalResourceRef.resourceId,
  strategy: "preserve current SP structure; external link becomes non-authoritative provenance/rollback metadata",
  lessons: unit.lessons.map(lessonView),
  dependencies: dependencySummary(program.data, unit),
}));

const report = {
  reportType: "Specialist Planner v0.8.0 Phase A migration dry-run",
  status: "dry-run-only-stop-before-write",
  generatedAt: new Date().toISOString(),
  projectId: PROJECT_ID,
  programId: PROGRAM_ID,
  programName: program.name,
  currentRevision: program.revision,
  currentLastMutationId: program.lastMutationId,
  firestoreUpdateTime: rawProgram.updateTime,
  sourceCommit: "dae2759",
  liveLibrary: { source: UNIT_LIBRARY_LIVE_INDEX_URL, generatedAt: index.generatedAt },
  backup: {
    path: fileURLToPath(backupPath),
    format: "existing Specialist Planner exportPlannerData JSON",
    sha256: createHash("sha256").update(`${exported}\n`).digest("hex"),
    roundTripVerified: true,
    restorePath: "Settings → Backup & Restore → Import planner backup",
    canonicalPlannerSha256: hash(restored),
  },
  protectedState: {
    definition: "ownership, classes, cohort references, progress, baselines, checkpoints, timetable, Teaching Sessions, historical snapshots, calendar, colours and teacher notes",
    sha256: hash(protectedState(program)),
    teachingSnapshotsSha256: hash(program.data.teachingSessions),
    currentUnitLessonIdentitySha256: hash(currentIdentityState(program.data)),
    guarantees: [
      "No classProgress change",
      "No progressBaselines change",
      "No progressCheckpoints change",
      "No Teaching Session creation/update/deletion",
      "No historical title snapshot change",
      "No year-level cohort reference change",
      "No ownership, timetable, calendar or teacher-note change",
    ],
  },
  currentProgramCounts: {
    units: program.data.units.length,
    lessons: program.data.units.reduce((total, unit) => total + unit.lessons.length, 0),
    classes: program.data.classes.length,
    teachingSessions: program.data.teachingSessions.length,
    checkpoints: Object.keys(program.data.progressCheckpoints).length,
    baselines: Object.keys(program.data.progressBaselines).length,
  },
  proposedCurrentTerm4Units: program.data.units.map((unit) => ({
    id: unit.id,
    title: unit.title,
    yearLevelIds: unit.yearLevelIds ?? [unit.yearLevelId],
    lessons: [familyProposal, fruitProposal].find((proposal) => proposal.unitId === unit.id)?.lessons ?? unit.lessons.map(lessonView),
    changeProposed: unit.id === familyProposal.unitId || unit.id === fruitProposal.unitId,
  })),
  legacyUnits,
  priorityProposals: [familyProposal, fruitProposal],
  newStyleLinkedUnits: newStyleUnits,
  tmrResourceReferencesPreserved: program.data.units.flatMap((unit) => unit.lessons.filter((lesson) => lesson.vocabularySetId || lesson.externalResourceRef).map((lesson) => ({
    unitId: unit.id,
    lessonId: lesson.id,
    vocabularySetId: lesson.vocabularySetId ?? null,
    externalResourceRef: lesson.externalResourceRef ?? null,
  }))),
  ownerDecisionsRequired: legacyUnits.filter((unit) => unit.strategy.startsWith("unresolved")).map((unit) => ({ unit: unit.title, reason: unit.reason })),
  exactProposedWrites: exactProposedWrites(program, [familyProposal, fruitProposal]),
  prohibitedWrites: [
    "production Firebase or production GitHub Pages",
    "TMR Unit or Lesson data",
    "historical Teaching Sessions or snapshots",
    "class positions, cohort references, baselines or checkpoints",
    "legacy Lesson provenance IDs",
  ],
  executionConfirmation: {
    cloudWritePerformed: false,
    deploymentPerformed: false,
    productionModified: false,
    tmrModified: false,
  },
};

await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
await writeFile(markdownReportPath, markdown(report), { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({
  status: report.status,
  currentRevision: report.currentRevision,
  backupPath: report.backup.path,
  backupSha256: report.backup.sha256,
  protectedStateSha256: report.protectedState.sha256,
  familyLessons: familyProposal.lessons,
  fruitLessons: fruitProposal.lessons,
  ownerDecisionsRequired: report.ownerDecisionsRequired,
  jsonReportPath: fileURLToPath(jsonReportPath),
  markdownReportPath: fileURLToPath(markdownReportPath),
}, null, 2));
