import { PLANNER_SCHEMA_VERSION, clonePlanner, type PlannerData } from "./domain.ts";
import { createBlankPlanner } from "./sample-data.ts";
import { validatePlannerData } from "./storage.ts";

export const CLOUD_PROGRAM_SCHEMA_VERSION = 1 as const;

export const SUBJECT_PRESETS = [
  { id: "art", label: "Art", defaultName: "Visual Arts" },
  { id: "music", label: "Music", defaultName: "Music" },
  { id: "pe", label: "PE", defaultName: "Physical Education" },
  { id: "performing_arts", label: "Performing Arts", defaultName: "Performing Arts" },
  { id: "stem", label: "STEM", defaultName: "STEM" },
  { id: "languages", label: "Languages", defaultName: "Languages" },
  { id: "library", label: "Library", defaultName: "Library" },
  { id: "other", label: "Other", defaultName: "My specialist program" },
] as const;

export type ProgramSubjectType = typeof SUBJECT_PRESETS[number]["id"];
export type ProgramMemberRole = "owner";

export type CloudProgram = {
  id: string;
  ownerUid: string;
  memberUids: string[];
  members: Record<string, ProgramMemberRole>;
  name: string;
  subjectType: ProgramSubjectType;
  customSubjectName?: string;
  schemaVersion: typeof CLOUD_PROGRAM_SCHEMA_VERSION;
  plannerSchemaVersion: typeof PLANNER_SCHEMA_VERSION;
  revision: number;
  lastMutationId: string;
  createdAt: unknown;
  updatedAt: unknown;
  data: PlannerData;
};

export type LocalProgramSummary = {
  name: string;
  classes: number;
  recordedSessions: number;
  units: number;
  updatedAt: string;
};

export function isProgramSubjectType(value: unknown): value is ProgramSubjectType {
  return SUBJECT_PRESETS.some((preset) => preset.id === value);
}

export function defaultProgramName(subjectType: ProgramSubjectType): string {
  return SUBJECT_PRESETS.find((preset) => preset.id === subjectType)?.defaultName ?? "My specialist program";
}

export function preparePlannerForProgram(programId: string, name: string): PlannerData {
  const planner = createBlankPlanner();
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Enter a Program name.");
  return validatePlannerData({
    ...planner,
    id: `planner-${programId}`,
    subjects: planner.subjects.map((subject) => ({ ...subject, name: cleanName })),
    updatedAt: new Date().toISOString(),
  });
}

export function activeProgramName(planner: PlannerData): string {
  return planner.subjects.find((subject) => subject.id === planner.activeSubjectId)?.name.trim() || "Untitled Program";
}

export function summarizeLocalProgram(planner: PlannerData): LocalProgramSummary {
  return {
    name: activeProgramName(planner),
    classes: planner.classes.length,
    recordedSessions: planner.teachingSessions.filter((session) => session.outcome !== "planned").length,
    units: planner.units.length,
    updatedAt: planner.updatedAt,
  };
}

export function makeCloudProgram(input: {
  id: string;
  ownerUid: string;
  name: string;
  subjectType: ProgramSubjectType;
  customSubjectName?: string;
  planner: PlannerData;
  mutationId: string;
  timestamp?: unknown;
}): CloudProgram {
  const id = input.id.trim();
  const ownerUid = input.ownerUid.trim();
  const name = input.name.trim();
  if (!id || !ownerUid || !name || !input.mutationId.trim()) throw new Error("Program identity is incomplete.");
  if (!isProgramSubjectType(input.subjectType)) throw new Error("Choose a valid specialist area.");
  const planner = validatePlannerData(input.planner);
  return {
    id,
    ownerUid,
    memberUids: [ownerUid],
    members: { [ownerUid]: "owner" },
    name,
    subjectType: input.subjectType,
    ...(input.customSubjectName?.trim() ? { customSubjectName: input.customSubjectName.trim() } : {}),
    schemaVersion: CLOUD_PROGRAM_SCHEMA_VERSION,
    plannerSchemaVersion: PLANNER_SCHEMA_VERSION,
    revision: 1,
    lastMutationId: input.mutationId,
    createdAt: input.timestamp ?? null,
    updatedAt: input.timestamp ?? null,
    data: clonePlanner(planner),
  };
}

export function validateCloudProgram(value: unknown): CloudProgram {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Cloud Program is invalid.");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || !candidate.id || typeof candidate.ownerUid !== "string" || !candidate.ownerUid) throw new Error("Cloud Program identity is invalid.");
  if (!Array.isArray(candidate.memberUids) || !candidate.memberUids.includes(candidate.ownerUid)) throw new Error("Cloud Program membership is invalid.");
  if (!candidate.members || typeof candidate.members !== "object" || Array.isArray(candidate.members) || (candidate.members as Record<string, unknown>)[candidate.ownerUid] !== "owner") throw new Error("Cloud Program owner membership is invalid.");
  if (typeof candidate.name !== "string" || !candidate.name.trim() || !isProgramSubjectType(candidate.subjectType)) throw new Error("Cloud Program details are invalid.");
  if (candidate.schemaVersion !== CLOUD_PROGRAM_SCHEMA_VERSION || candidate.plannerSchemaVersion !== PLANNER_SCHEMA_VERSION) throw new Error("Cloud Program schema is incompatible.");
  if (!Number.isInteger(candidate.revision) || Number(candidate.revision) < 1 || typeof candidate.lastMutationId !== "string" || !candidate.lastMutationId) throw new Error("Cloud Program revision is invalid.");
  return {
    id: candidate.id,
    ownerUid: candidate.ownerUid,
    memberUids: [...candidate.memberUids] as string[],
    members: { ...(candidate.members as Record<string, ProgramMemberRole>) },
    name: candidate.name.trim(),
    subjectType: candidate.subjectType,
    ...(typeof candidate.customSubjectName === "string" && candidate.customSubjectName.trim() ? { customSubjectName: candidate.customSubjectName.trim() } : {}),
    schemaVersion: CLOUD_PROGRAM_SCHEMA_VERSION,
    plannerSchemaVersion: PLANNER_SCHEMA_VERSION,
    revision: Number(candidate.revision),
    lastMutationId: candidate.lastMutationId,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    data: clonePlanner(validatePlannerData(candidate.data)),
  };
}

export function programBelongsTo(program: CloudProgram, uid: string): boolean {
  return program.memberUids.includes(uid) && Boolean(program.members[uid]);
}
