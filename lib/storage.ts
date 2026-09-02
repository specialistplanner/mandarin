import {
  CLASS_COLOUR_PRESETS,
  PLANNER_SCHEMA_VERSION,
  clonePlanner,
  type ClassColourId,
  type PlannerData,
  type ProgressMap,
  type SessionType,
  type TeachingSessionOutcome,
} from "./domain.ts";

export const STORAGE_KEY = "specialist-planner.data.v6";
export const LEGACY_V5_STORAGE_KEY = "specialist-planner.data.v5";
export const LEGACY_V4_STORAGE_KEY = "specialist-planner.data.v4";
export const LEGACY_V3_STORAGE_KEY = "specialist-planner.data.v3";
export const LEGACY_V2_STORAGE_KEY = "specialist-planner.data.v2";
export const LEGACY_STORAGE_KEY = "specialist-planner.dashboard.progress.v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;
export type PlannerLoadResult = { planner: PlannerData | null; source: "v6" | "migrated-v5" | "migrated-v4" | "migrated-v3" | "migrated-v2" | "migrated-v1" | "empty" };

const sessionTypes = new Set<SessionType>([
  "specialist-teaching", "cover-release", "planning", "meeting", "school-activity", "break", "other",
]);
const teachingOutcomes = new Set<TeachingSessionOutcome>(["planned", "completed", "partial", "not-taught"]);

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is missing or invalid.`);
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return string(value, field);
}

function uniqueIds(items: Array<{ id: string }>, label: string) {
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error(`${label} IDs must be unique.`);
}

export function validatePlannerData(value: unknown): PlannerData {
  if (!record(value) || value.schemaVersion !== PLANNER_SCHEMA_VERSION) {
    throw new Error("This file is not a Specialist Planner v0.4.1 backup.");
  }
  if (!Array.isArray(value.subjects) || !Array.isArray(value.yearLevels) || !Array.isArray(value.classes) ||
      !Array.isArray(value.units) || !Array.isArray(value.timetableSessions) || !Array.isArray(value.teachingSessions) || !Array.isArray(value.trialNotes) ||
      !record(value.classProgress) || !record(value.progressBaselines) || !record(value.progressCheckpoints) || !record(value.classColours)) {
    throw new Error("Planner collections are missing or invalid.");
  }

  const subjects = value.subjects.map((item, index) => {
    if (!record(item)) throw new Error(`Subject ${index + 1} is invalid.`);
    return { id: string(item.id, "Subject ID"), name: string(item.name, "Subject name") };
  });
  if (!subjects.length) throw new Error("The planner needs at least one subject.");
  uniqueIds(subjects, "Subject");
  const activeSubjectId = string(value.activeSubjectId, "Active subject");
  if (!subjects.some((item) => item.id === activeSubjectId)) throw new Error("The active subject does not exist.");

  const yearLevels = value.yearLevels.map((item, index) => {
    if (!record(item)) throw new Error(`Year level ${index + 1} is invalid.`);
    return {
      id: string(item.id, "Year level ID"), label: string(item.label, "Year level name"),
      shortLabel: string(item.shortLabel, "Year level short label"),
      currentUnitId: item.currentUnitId === null ? null : string(item.currentUnitId, "Current unit ID"),
      expectedLessonId: item.expectedLessonId === null ? null : string(item.expectedLessonId, "Expected lesson ID"),
    };
  });
  uniqueIds(yearLevels, "Year level");

  const classes = value.classes.map((item, index) => {
    if (!record(item)) throw new Error(`Class ${index + 1} is invalid.`);
    return { id: string(item.id, "Class ID"), name: string(item.name, "Class name"), yearLevelId: string(item.yearLevelId, "Class year level") };
  });
  uniqueIds(classes, "Class");

  const classColours = Object.fromEntries(Object.entries(value.classColours).map(([classId, colourId]) => {
    if (!classes.some((item) => item.id === classId)) throw new Error(`Class colour for ${classId} has no valid class.`);
    if (typeof colourId !== "string" || !(colourId in CLASS_COLOUR_PRESETS)) throw new Error(`Class colour for ${classId} is invalid.`);
    return [classId, colourId as ClassColourId];
  }));

  const units = value.units.map((item, unitIndex) => {
    if (!record(item) || !Array.isArray(item.lessons) || !item.lessons.length) throw new Error(`Unit ${unitIndex + 1} needs lessons.`);
    const lessons = item.lessons.map((lesson, lessonIndex) => {
      if (!record(lesson)) throw new Error(`Lesson ${lessonIndex + 1} is invalid.`);
      return {
        id: string(lesson.id, "Lesson ID"), title: string(lesson.title, "Lesson title"),
        description: optionalString(lesson.description, "Lesson description"), sequence: lessonIndex + 1,
      };
    });
    uniqueIds(lessons, "Lesson");
    return {
      id: string(item.id, "Unit ID"), yearLevelId: string(item.yearLevelId, "Unit year level"),
      title: string(item.title, "Unit title"), description: optionalString(item.description, "Unit description"), lessons,
    };
  });
  uniqueIds(units, "Unit");

  for (const item of classes) if (!yearLevels.some((level) => level.id === item.yearLevelId)) throw new Error(`Class ${item.name} has no valid year level.`);
  for (const unit of units) if (!yearLevels.some((level) => level.id === unit.yearLevelId)) throw new Error(`Unit ${unit.title} has no valid year level.`);
  for (const level of yearLevels) {
    if (level.currentUnitId === null) {
      if (level.expectedLessonId !== null) throw new Error(`${level.label} has an expected lesson but no unit.`);
      continue;
    }
    const unit = units.find((candidate) => candidate.id === level.currentUnitId && candidate.yearLevelId === level.id);
    if (!unit) throw new Error(`${level.label} references an invalid current unit.`);
    if (!unit.lessons.some((lesson) => lesson.id === level.expectedLessonId)) throw new Error(`${level.label} references an invalid expected lesson.`);
  }

  const classProgress = Object.fromEntries(Object.entries(value.classProgress).map(([classId, item]) => {
    if (!record(item)) throw new Error(`Progress for ${classId} is invalid.`);
    const progress = {
      classId: string(item.classId, "Progress class ID"), unitId: string(item.unitId, "Progress unit ID"), lessonId: string(item.lessonId, "Progress lesson ID"),
      ...(item.unitComplete === true ? { unitComplete: true as const } : {}),
    };
    const specialistClass = classes.find((candidate) => candidate.id === classId && candidate.id === progress.classId);
    const level = yearLevels.find((candidate) => candidate.id === specialistClass?.yearLevelId);
    const unit = units.find((candidate) => candidate.id === progress.unitId && candidate.yearLevelId === level?.id);
    if (!specialistClass || !unit?.lessons.some((lesson) => lesson.id === progress.lessonId)) throw new Error(`Progress for ${classId} has an invalid reference.`);
    if (progress.unitComplete && unit.lessons.at(-1)?.id !== progress.lessonId) throw new Error(`Progress for ${classId} marks an unfinished lesson as Unit complete.`);
    return [classId, progress];
  }));
  for (const specialistClass of classes) {
    const level = yearLevels.find((candidate) => candidate.id === specialistClass.yearLevelId);
    if (level?.currentUnitId && !classProgress[specialistClass.id]) {
      throw new Error(`Progress for ${specialistClass.name} is missing.`);
    }
  }

  const progressBaselines = Object.fromEntries(Object.entries(value.progressBaselines).map(([classId, item]) => {
    if (!record(item)) throw new Error(`Progress baseline for ${classId} is invalid.`);
    const progress = {
      classId: string(item.classId, "Baseline class ID"), unitId: string(item.unitId, "Baseline unit ID"), lessonId: string(item.lessonId, "Baseline lesson ID"),
      ...(item.unitComplete === true ? { unitComplete: true as const } : {}),
    };
    const specialistClass = classes.find((candidate) => candidate.id === classId && candidate.id === progress.classId);
    const level = yearLevels.find((candidate) => candidate.id === specialistClass?.yearLevelId);
    const unit = units.find((candidate) => candidate.id === progress.unitId && candidate.yearLevelId === level?.id);
    if (!specialistClass || !unit?.lessons.some((lesson) => lesson.id === progress.lessonId)) throw new Error(`Progress baseline for ${classId} has an invalid reference.`);
    if (progress.unitComplete && unit.lessons.at(-1)?.id !== progress.lessonId) throw new Error(`Progress baseline for ${classId} marks an unfinished lesson as Unit complete.`);
    return [classId, progress];
  }));
  for (const specialistClass of classes) if (classProgress[specialistClass.id] && !progressBaselines[specialistClass.id]) throw new Error(`Progress baseline for ${specialistClass.name} is missing.`);

  const progressCheckpoints = Object.fromEntries(Object.entries(value.progressCheckpoints).map(([classId, item]) => {
    if (!record(item)) throw new Error(`Progress checkpoint for ${classId} is invalid.`);
    const specialistClass = classes.find((candidate) => candidate.id === classId && candidate.id === item.classId);
    const unitId = string(item.unitId, "Checkpoint unit ID");
    const lessonId = string(item.lessonId, "Checkpoint lesson ID");
    const unit = units.find((candidate) => candidate.id === unitId && candidate.yearLevelId === specialistClass?.yearLevelId);
    const effectiveDate = string(item.effectiveDate, "Checkpoint effective date");
    const createdAt = string(item.createdAt, "Checkpoint created timestamp");
    if (!specialistClass || !unit?.lessons.some((lesson) => lesson.id === lessonId)) throw new Error(`Progress checkpoint for ${classId} has an invalid reference.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new Error(`Progress checkpoint for ${classId} has an invalid date.`);
    if (Number.isNaN(Date.parse(createdAt))) throw new Error(`Progress checkpoint for ${classId} has an invalid timestamp.`);
    const checkpoint = {
      classId, unitId, lessonId,
      ...(item.unitComplete === true ? { unitComplete: true as const } : {}),
      effectiveDate, createdAt, reason: string(item.reason, "Checkpoint reason"),
    };
    if (checkpoint.unitComplete && unit.lessons.at(-1)?.id !== lessonId) throw new Error(`Progress checkpoint for ${classId} marks an unfinished lesson as Unit complete.`);
    return [classId, checkpoint];
  }));

  let reconciliationStatus;
  if (value.reconciliationStatus !== undefined) {
    if (!record(value.reconciliationStatus)) throw new Error("Reconciliation status is invalid.");
    const startDate = string(value.reconciliationStatus.startDate, "Reconciliation start date");
    const throughDate = string(value.reconciliationStatus.throughDate, "Reconciliation through date");
    const completedAt = string(value.reconciliationStatus.completedAt, "Reconciliation timestamp");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(throughDate) || startDate > throughDate || Number.isNaN(Date.parse(completedAt))) throw new Error("Reconciliation status is invalid.");
    reconciliationStatus = { startDate, throughDate, completedAt };
  }

  const timetableSessions = value.timetableSessions.map((item, index) => {
    if (!record(item)) throw new Error(`Timetable session ${index + 1} is invalid.`);
    const type = string(item.type, "Session type") as SessionType;
    if (!sessionTypes.has(type)) throw new Error(`Timetable session ${index + 1} has an invalid type.`);
    const weekday = Number(item.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("Session weekday is invalid.");
    const startTime = string(item.startTime, "Start time");
    const endTime = string(item.endTime, "End time");
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) throw new Error("Session times are invalid.");
    const classId = optionalString(item.classId, "Session class ID");
    if (classId && !classes.some((candidate) => candidate.id === classId)) throw new Error("A timetable session references a missing class.");
    if (type === "specialist-teaching" && !classId) throw new Error("Specialist teaching sessions require a class.");
    return {
      id: string(item.id, "Session ID"), weekday, startTime, endTime, type, classId,
      subjectId: optionalString(item.subjectId, "Session subject ID"), label: optionalString(item.label, "Session label"),
    };
  });
  uniqueIds(timetableSessions, "Timetable session");

  const teachingSessions = value.teachingSessions.map((item, index) => {
    if (!record(item)) throw new Error(`Teaching session ${index + 1} is invalid.`);
    const outcome = string(item.outcome, "Teaching session outcome") as TeachingSessionOutcome;
    if (!teachingOutcomes.has(outcome)) throw new Error(`Teaching session ${index + 1} has an invalid outcome.`);
    const date = string(item.date, "Teaching session date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) throw new Error("A teaching session has an invalid date.");
    const timetableSessionId = string(item.timetableSessionId, "Teaching timetable reference");
    const timetable = timetableSessions.find((candidate) => candidate.id === timetableSessionId && candidate.type === "specialist-teaching");
    const classId = string(item.classId, "Teaching session class ID");
    const specialistClass = classes.find((candidate) => candidate.id === classId);
    const yearLevelId = string(item.yearLevelId, "Teaching session year level ID");
    const subjectId = string(item.subjectId, "Teaching session subject ID");
    if (timetable && timetable.classId !== classId) throw new Error("A teaching session references an invalid timetable occurrence.");
    if (!specialistClass || specialistClass.yearLevelId !== yearLevelId) throw new Error("A teaching session references an invalid class or year level.");
    if (!subjects.some((candidate) => candidate.id === subjectId)) throw new Error("A teaching session references an invalid subject.");
    const createdAt = string(item.createdAt, "Teaching session created timestamp");
    const updatedAt = string(item.updatedAt, "Teaching session updated timestamp");
    if (Number.isNaN(Date.parse(createdAt)) || Number.isNaN(Date.parse(updatedAt))) throw new Error("A teaching session timestamp is invalid.");
    const affectsProgress = item.affectsProgress === true;
    if (outcome !== "completed" && affectsProgress) throw new Error("Only completed teaching sessions can affect progress.");
    return {
      id: string(item.id, "Teaching session ID"), date, timetableSessionId, subjectId, classId, yearLevelId,
      plannedUnitId: string(item.plannedUnitId, "Planned unit ID"), plannedLessonId: string(item.plannedLessonId, "Planned lesson ID"),
      plannedUnitTitle: string(item.plannedUnitTitle, "Planned unit title"), plannedLessonTitle: string(item.plannedLessonTitle, "Planned lesson title"),
      outcome, note: optionalString(item.note, "Teaching session note"), reason: optionalString(item.reason, "Teaching session reason"),
      affectsProgress, createdAt, updatedAt,
    };
  });
  uniqueIds(teachingSessions, "Teaching session");

  const trialNotes = value.trialNotes.map((item, index) => {
    if (!record(item)) throw new Error(`Trial note ${index + 1} is invalid.`);
    const createdAt = string(item.createdAt, "Note timestamp");
    if (Number.isNaN(Date.parse(createdAt))) throw new Error("A trial note has an invalid timestamp.");
    const classId = optionalString(item.classId, "Note class ID");
    if (classId && !classes.some((candidate) => candidate.id === classId)) throw new Error("A trial note references a missing class.");
    return { id: string(item.id, "Note ID"), text: string(item.text, "Note text"), createdAt, context: optionalString(item.context, "Note context"), classId };
  });
  uniqueIds(trialNotes, "Trial note");

  return {
    schemaVersion: PLANNER_SCHEMA_VERSION, id: string(value.id, "Planner ID"), subjects, activeSubjectId,
    yearLevels, classes, units, classProgress, progressBaselines, progressCheckpoints, classColours, timetableSessions, teachingSessions, reconciliationStatus, trialNotes,
    updatedAt: typeof value.updatedAt === "string" && !Number.isNaN(Date.parse(value.updatedAt)) ? value.updatedAt : new Date().toISOString(),
  };
}

export function loadPlanner(storage: StorageLike, sample: PlannerData): PlannerLoadResult {
  const current = storage.getItem(STORAGE_KEY);
  if (current) {
    try { return { planner: validatePlannerData(JSON.parse(current)), source: "v6" }; }
    catch { /* Leave invalid local data untouched so it can be recovered manually. */ }
  }
  const v5 = storage.getItem(LEGACY_V5_STORAGE_KEY);
  if (v5) {
    try { return { planner: migrateV5PlannerData(JSON.parse(v5)), source: "migrated-v5" }; }
    catch { /* Fall through to the v0.3 migration. */ }
  }
  const v4 = storage.getItem(LEGACY_V4_STORAGE_KEY);
  if (v4) {
    try { return { planner: migrateV4PlannerData(JSON.parse(v4)), source: "migrated-v4" }; }
    catch { /* Fall through to the v0.2.1 migration. */ }
  }
  const v3 = storage.getItem(LEGACY_V3_STORAGE_KEY);
  if (v3) {
    try { return { planner: migrateV3PlannerData(JSON.parse(v3)), source: "migrated-v3" }; }
    catch { /* Fall through to the v0.2 migration. */ }
  }
  const previous = storage.getItem(LEGACY_V2_STORAGE_KEY);
  if (previous) {
    try { return { planner: migrateV2PlannerData(JSON.parse(previous)), source: "migrated-v2" }; }
    catch { /* Fall through to the v0.1 progress migration. */ }
  }
  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return { planner: null, source: "empty" };
  try {
    const saved = JSON.parse(legacy) as Record<string, unknown>;
    if (!record(saved)) return { planner: null, source: "empty" };
    const migrated = clonePlanner(sample);
    for (const [classId, value] of Object.entries(saved)) {
      if (!Number.isInteger(value)) continue;
      const progress = migrated.classProgress[classId];
      const unit = migrated.units.find((item) => item.id === progress?.unitId);
      if (!progress || !unit) continue;
      const lesson = unit.lessons[Math.min(Math.max(Number(value), 1), unit.lessons.length) - 1];
      progress.lessonId = lesson.id;
      migrated.progressBaselines[classId] = { ...progress };
    }
    migrated.updatedAt = new Date().toISOString();
    return { planner: migrated, source: "migrated-v1" };
  } catch {
    return { planner: null, source: "empty" };
  }
}

export function persistPlanner(storage: StorageLike, planner: PlannerData) {
  storage.setItem(STORAGE_KEY, JSON.stringify(validatePlannerData(planner)));
}

export function clearPlanner(storage: StorageLike) {
  storage.removeItem?.(STORAGE_KEY);
}

export function exportPlannerData(planner: PlannerData): string {
  return JSON.stringify(validatePlannerData(planner), null, 2);
}

export function importPlannerData(text: string): PlannerData {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error("The selected file is not valid JSON."); }
  if (record(parsed) && parsed.schemaVersion === 5) return migrateV5PlannerData(parsed);
  if (record(parsed) && parsed.schemaVersion === 4) return migrateV4PlannerData(parsed);
  if (record(parsed) && parsed.schemaVersion === 3) return migrateV3PlannerData(parsed);
  if (record(parsed) && parsed.schemaVersion === 2) return migrateV2PlannerData(parsed);
  return validatePlannerData(parsed);
}

export function migrateV2PlannerData(value: unknown): PlannerData {
  if (!record(value) || value.schemaVersion !== 2) throw new Error("This is not a valid Specialist Planner v0.2 backup.");
  return migrateV3PlannerData({ ...value, schemaVersion: 3 });
}

export function migrateV5PlannerData(value: unknown): PlannerData {
  if (!record(value) || value.schemaVersion !== 5 || !record(value.classProgress) || !record(value.progressBaselines) || !record(value.progressCheckpoints) || !Array.isArray(value.teachingSessions)) {
    throw new Error("This is not a valid Specialist Planner v0.3.1/v0.4 backup.");
  }
  return validatePlannerData({ ...value, schemaVersion: PLANNER_SCHEMA_VERSION, classColours: {} });
}

export function migrateV3PlannerData(value: unknown): PlannerData {
  if (!record(value) || value.schemaVersion !== 3 || !record(value.classProgress)) throw new Error("This is not a valid Specialist Planner v0.2.1 backup.");
  return validatePlannerData({
    ...value,
    schemaVersion: PLANNER_SCHEMA_VERSION,
    progressBaselines: JSON.parse(JSON.stringify(value.classProgress)),
    progressCheckpoints: {},
    classColours: {},
    teachingSessions: [],
  });
}

export function migrateV4PlannerData(value: unknown): PlannerData {
  if (!record(value) || value.schemaVersion !== 4 || !record(value.classProgress) || !record(value.progressBaselines) || !Array.isArray(value.teachingSessions)) {
    throw new Error("This is not a valid Specialist Planner v0.3 backup.");
  }
  return validatePlannerData({ ...value, schemaVersion: PLANNER_SCHEMA_VERSION, progressCheckpoints: {}, classColours: {} });
}

// v0.1 API retained to prove the migration source remains readable.
export function restoreProgress(storage: StorageLike, fallback: ProgressMap): ProgressMap {
  try {
    const raw = storage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { ...fallback };
    const parsed = JSON.parse(raw) as unknown;
    if (!record(parsed)) return { ...fallback };
    const restored = { ...fallback };
    for (const [classId, value] of Object.entries(parsed)) {
      if (classId in fallback && Number.isInteger(value) && Number(value) > 0) restored[classId] = Number(value);
    }
    return restored;
  } catch { return { ...fallback }; }
}

export function persistProgress(storage: StorageLike, progress: ProgressMap) {
  storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(progress));
}
