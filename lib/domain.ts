export const PLANNER_SCHEMA_VERSION = 9 as const;

export const CLASS_COLOUR_PRESETS = {
  "hot-pink": { label: "Hot pink", background: "#fce4f1", accent: "#d61f75", foreground: "#17372c" },
  orange: { label: "Orange", background: "#ffe8d6", accent: "#c55a11", foreground: "#17372c" },
  yellow: { label: "Yellow", background: "#fff4bf", accent: "#9a7510", foreground: "#17372c" },
  green: { label: "Green", background: "#e5f3e8", accent: "#3f7d4c", foreground: "#17372c" },
  aqua: { label: "Aqua", background: "#ddf5f2", accent: "#2a7f78", foreground: "#17372c" },
  blue: { label: "Blue", background: "#e4eefa", accent: "#3f6fa8", foreground: "#17372c" },
  purple: { label: "Purple", background: "#eee6f6", accent: "#79549a", foreground: "#17372c" },
} as const;

export type ClassColourId = keyof typeof CLASS_COLOUR_PRESETS;

export type ExternalResourceRef = {
  provider: string;
  resourceType: "unit" | "lesson";
  resourceId: string;
  parentResourceId?: string;
  label?: string;
  url?: string;
};

export type SessionType =
  | "specialist-teaching"
  | "generalist-teaching"
  | "cover-release"
  | "planning"
  | "meeting"
  | "school-activity"
  | "break"
  | "other";

export type TeachingSessionOutcome =
  | "planned"
  | "completed"
  | "partial"
  | "not-taught";

export type Subject = { id: string; name: string };

export type Lesson = {
  id: string;
  title: string;
  description?: string;
  sequence: number;
  externalResourceRef?: ExternalResourceRef;
};

export type Unit = {
  id: string;
  yearLevelId: string;
  title: string;
  description?: string;
  lessons: Lesson[];
  externalResourceRef?: ExternalResourceRef;
};

export type YearLevel = {
  id: string;
  label: string;
  shortLabel: string;
  currentUnitId: string | null;
  expectedLessonId: string | null;
};

export type SpecialistClass = {
  id: string;
  name: string;
  yearLevelId: string;
};

export type ClassProgress = {
  classId: string;
  unitId: string;
  lessonId: string;
  unitComplete?: boolean;
};

export type ProgressCheckpoint = ClassProgress & {
  effectiveDate: string;
  createdAt: string;
  reason: string;
};

export type ReconciliationStatus = {
  startDate: string;
  throughDate: string;
  completedAt: string;
};

export type SessionSlot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  kind: "session" | "break";
};

export type TimetableSession = {
  id: string;
  slotId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  type: SessionType;
  classId?: string;
  subjectId?: string;
  label?: string;
};

export type TeachingSession = {
  id: string;
  date: string;
  timetableSessionId: string;
  subjectId: string;
  classId: string;
  yearLevelId: string;
  plannedUnitId: string;
  plannedLessonId: string;
  plannedUnitTitle: string;
  plannedLessonTitle: string;
  outcome: TeachingSessionOutcome;
  note?: string;
  reason?: string;
  affectsProgress: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TrialNote = {
  id: string;
  text: string;
  createdAt: string;
  context?: string;
  classId?: string;
};

export type PlannerData = {
  schemaVersion: typeof PLANNER_SCHEMA_VERSION;
  id: string;
  subjects: Subject[];
  activeSubjectId: string;
  yearLevels: YearLevel[];
  classes: SpecialistClass[];
  units: Unit[];
  classProgress: Record<string, ClassProgress>;
  progressBaselines: Record<string, ClassProgress>;
  progressCheckpoints: Record<string, ProgressCheckpoint>;
  classColours: Record<string, ClassColourId>;
  sessionSlots: SessionSlot[];
  timetableSessions: TimetableSession[];
  teachingSessions: TeachingSession[];
  reconciliationStatus?: ReconciliationStatus;
  trialNotes: TrialNote[];
  updatedAt: string;
};

export type ProgressStatus = {
  kind: "behind" | "on-track" | "ahead" | "different-unit";
  difference: number | null;
  label: string;
};

// Retained for v0.1 migration and backwards-compatible progress tests.
export type ProgressMap = Record<string, number>;

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  "specialist-teaching": "Specialist Teaching",
  "generalist-teaching": "Generalist Teaching",
  "cover-release": "Cover / Release",
  planning: "Planning",
  meeting: "PLT / Meeting",
  "school-activity": "Assembly / School Activity",
  break: "Break",
  other: "Other",
};

export const DEFAULT_SESSION_SLOTS: SessionSlot[] = [
  { id: "session-1", label: "S1", startTime: "08:55", endTime: "09:55", kind: "session" },
  { id: "session-2", label: "S2", startTime: "09:55", endTime: "10:55", kind: "session" },
  { id: "recess", label: "Recess", startTime: "10:55", endTime: "11:15", kind: "break" },
  { id: "session-3", label: "S3", startTime: "11:15", endTime: "12:15", kind: "session" },
  { id: "session-4", label: "S4", startTime: "12:15", endTime: "13:15", kind: "session" },
  { id: "lunch", label: "Lunch", startTime: "13:15", endTime: "14:15", kind: "break" },
  { id: "session-5", label: "S5", startTime: "14:15", endTime: "15:15", kind: "session" },
];

export function clonePlanner(planner: PlannerData): PlannerData {
  return JSON.parse(JSON.stringify(planner)) as PlannerData;
}

export function touchPlanner(planner: PlannerData): PlannerData {
  return { ...planner, updatedAt: new Date().toISOString() };
}

export function setClassColour(planner: PlannerData, classId: string, colourId?: ClassColourId): PlannerData {
  if (!planner.classes.some((item) => item.id === classId)) throw new Error("Class not found.");
  if (colourId && !CLASS_COLOUR_PRESETS[colourId]) throw new Error("Choose a valid class colour.");
  const classColours = { ...planner.classColours };
  if (colourId) classColours[classId] = colourId;
  else delete classColours[classId];
  return touchPlanner({ ...planner, classColours });
}

export function setUnitExternalResource(planner: PlannerData, unitId: string, reference?: ExternalResourceRef): PlannerData {
  if (reference && reference.resourceType !== "unit") throw new Error("Choose a Unit Library unit.");
  if (!planner.units.some((unit) => unit.id === unitId)) throw new Error("Unit not found.");
  return touchPlanner({
    ...planner,
    units: planner.units.map((unit) => {
      if (unit.id !== unitId) return unit;
      const sameResource = reference?.resourceId === unit.externalResourceRef?.resourceId && reference?.provider === unit.externalResourceRef?.provider;
      return {
        ...unit,
        externalResourceRef: reference,
        lessons: sameResource ? unit.lessons : unit.lessons.map((lesson) => ({ ...lesson, externalResourceRef: undefined })),
      };
    }),
  });
}

export function setLessonExternalResource(planner: PlannerData, unitId: string, lessonId: string, reference?: ExternalResourceRef): PlannerData {
  const unit = planner.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error("Unit not found.");
  if (!unit.lessons.some((lesson) => lesson.id === lessonId)) throw new Error("Lesson not found.");
  if (reference && (reference.resourceType !== "lesson" || !reference.parentResourceId || reference.parentResourceId !== unit.externalResourceRef?.resourceId || reference.provider !== unit.externalResourceRef?.provider)) {
    throw new Error("Choose a Lesson from the linked Unit Library unit.");
  }
  return touchPlanner({
    ...planner,
    units: planner.units.map((candidate) => candidate.id === unitId ? {
      ...candidate,
      lessons: candidate.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, externalResourceRef: reference } : lesson),
    } : candidate),
  });
}

export function clampLesson(value: number, lessonCount: number): number {
  if (!Number.isInteger(value) || lessonCount < 1) return 1;
  return Math.min(Math.max(value, 1), lessonCount);
}

export function moveProgress(
  progress: ProgressMap,
  classId: string,
  delta: number,
  lessonCount: number,
): ProgressMap {
  const current = progress[classId] ?? 1;
  return { ...progress, [classId]: clampLesson(current + delta, lessonCount) };
}

export function setProgress(
  progress: ProgressMap,
  classId: string,
  lesson: number,
  lessonCount: number,
): ProgressMap {
  return { ...progress, [classId]: clampLesson(lesson, lessonCount) };
}

export function lessonPosition(unit: Unit, lessonId: string | null | undefined): number {
  const index = unit.lessons.findIndex((lesson) => lesson.id === lessonId);
  return index < 0 ? 1 : index + 1;
}

export function lessonAt(unit: Unit, position: number): Lesson {
  return unit.lessons[clampLesson(position, unit.lessons.length) - 1];
}

export function getProgressStatus(currentLesson: number, expectedLesson: number): ProgressStatus {
  const difference = currentLesson - expectedLesson;
  if (difference === 0) return { kind: "on-track", difference, label: "On track" };
  const distance = Math.abs(difference);
  const unit = distance === 1 ? "lesson" : "lessons";
  return difference < 0
    ? { kind: "behind", difference, label: `${distance} ${unit} behind` }
    : { kind: "ahead", difference, label: `${distance} ${unit} ahead` };
}

export function getCohortProgressStatus(
  classUnitId: string,
  classLesson: number,
  expectedUnitId: string,
  expectedLesson: number,
): ProgressStatus {
  if (classUnitId !== expectedUnitId) {
    return { kind: "different-unit", difference: null, label: "Different unit" };
  }
  return getProgressStatus(classLesson, expectedLesson);
}

export function getYearLevelExceptions(
  classes: SpecialistClass[],
  progress: ProgressMap,
  expectedLesson: number,
): SpecialistClass[] {
  return classes.filter((item) =>
    getProgressStatus(progress[item.id] ?? 1, expectedLesson).kind !== "on-track",
  );
}

export function getTeachingSessionsForWeekday(
  sessions: TimetableSession[],
  weekday: number,
): TimetableSession[] {
  return sessions
    .filter((session) =>
      session.weekday === weekday &&
      session.type === "specialist-teaching" &&
      Boolean(session.classId),
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function teachingSessionId(date: string, timetableSessionId: string): string {
  return `teaching-${date}-${timetableSessionId}`;
}

function plannedTeachingSession(
  planner: PlannerData,
  timetable: TimetableSession,
  date: string,
  timestamp: string,
): TeachingSession | null {
  const specialistClass = planner.classes.find((item) => item.id === timetable.classId);
  const progress = specialistClass ? planner.classProgress[specialistClass.id] : undefined;
  const checkpoint = specialistClass ? planner.progressCheckpoints[specialistClass.id] : undefined;
  const unit = planner.units.find((item) => item.id === progress?.unitId);
  const lesson = unit?.lessons.find((item) => item.id === progress?.lessonId);
  if (!specialistClass || !progress || !unit || !lesson || progress.unitComplete || (checkpoint && date <= checkpoint.effectiveDate)) return null;
  return {
    id: teachingSessionId(date, timetable.id),
    date,
    timetableSessionId: timetable.id,
    subjectId: timetable.subjectId ?? planner.activeSubjectId,
    classId: specialistClass.id,
    yearLevelId: specialistClass.yearLevelId,
    plannedUnitId: unit.id,
    plannedLessonId: lesson.id,
    plannedUnitTitle: unit.title,
    plannedLessonTitle: lesson.title,
    outcome: "planned",
    affectsProgress: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getTeachingSessionsForDate(planner: PlannerData, date: Date): TeachingSession[] {
  const dateKey = localDateKey(date);
  const existing = new Map(planner.teachingSessions.filter((item) => item.date === dateKey).map((item) => [item.timetableSessionId, item]));
  const timestamp = new Date().toISOString();
  return getTeachingSessionsForWeekday(planner.timetableSessions, date.getDay())
    .map((timetable) => {
      const saved = existing.get(timetable.id);
      const checkpoint = timetable.classId ? planner.progressCheckpoints[timetable.classId] : undefined;
      if (saved?.outcome === "planned" && checkpoint && dateKey <= checkpoint.effectiveDate) return null;
      return saved ?? plannedTeachingSession(planner, timetable, dateKey, timestamp);
    })
    .filter((item): item is TeachingSession => Boolean(item));
}

export function materializeTeachingSessionsForDate(planner: PlannerData, date: Date): PlannerData {
  const sessions = getTeachingSessionsForDate(planner, date);
  const existingIds = new Set(planner.teachingSessions.map((item) => item.id));
  const additions = sessions.filter((item) => !existingIds.has(item.id));
  return additions.length ? touchPlanner({ ...planner, teachingSessions: [...planner.teachingSessions, ...additions] }) : planner;
}

function advanceClassProgress(planner: PlannerData, progress: ClassProgress): ClassProgress {
  const unit = planner.units.find((item) => item.id === progress.unitId);
  const index = unit?.lessons.findIndex((item) => item.id === progress.lessonId) ?? -1;
  if (!unit || index < 0) return progress;
  if (index === unit.lessons.length - 1) return { ...progress, unitComplete: true };
  const activeProgress = { ...progress };
  delete activeProgress.unitComplete;
  return { ...activeProgress, lessonId: unit.lessons[index + 1].id };
}

function sessionCanAffectProgress(planner: PlannerData, session: TeachingSession): boolean {
  const checkpoint = planner.progressCheckpoints[session.classId];
  return session.outcome === "completed" && session.affectsProgress && (!checkpoint || session.date > checkpoint.effectiveDate);
}

export function reconcileClassProgress(planner: PlannerData, classId: string): PlannerData {
  const baseline = planner.progressBaselines[classId];
  if (!baseline) return planner;
  let progress = { ...baseline };
  const timetableById = new Map(planner.timetableSessions.map((item) => [item.id, item]));
  const completed = planner.teachingSessions
    .filter((item) => item.classId === classId && sessionCanAffectProgress(planner, item))
    .sort((a, b) => `${a.date}T${timetableById.get(a.timetableSessionId)?.startTime ?? "00:00"}`.localeCompare(`${b.date}T${timetableById.get(b.timetableSessionId)?.startTime ?? "00:00"}`) || a.createdAt.localeCompare(b.createdAt));
  for (const session of completed) {
    if (!progress.unitComplete && progress.unitId === session.plannedUnitId && progress.lessonId === session.plannedLessonId) {
      progress = advanceClassProgress(planner, progress);
    }
  }
  return { ...planner, classProgress: { ...planner.classProgress, [classId]: progress } };
}

function reconcileClasses(planner: PlannerData, classIds: Iterable<string>): PlannerData {
  let next = planner;
  for (const classId of new Set(classIds)) next = reconcileClassProgress(next, classId);
  return touchPlanner(next);
}

export function recordTeachingSessionOutcome(
  planner: PlannerData,
  sessionId: string,
  outcome: TeachingSessionOutcome,
  detail = "",
): PlannerData {
  const existing = planner.teachingSessions.find((item) => item.id === sessionId);
  if (!existing) throw new Error("Teaching session not found.");
  const timestamp = new Date().toISOString();
  const cleaned = detail.trim();
  const checkpoint = planner.progressCheckpoints[existing.classId];
  const affectsProgress = outcome === "completed" && (!checkpoint || existing.date > checkpoint.effectiveDate);
  const teachingSessions = planner.teachingSessions.map((item) => item.id === sessionId ? {
    ...item,
    outcome,
    note: outcome === "partial" && cleaned ? cleaned : undefined,
    reason: outcome === "not-taught" && cleaned ? cleaned : undefined,
    affectsProgress,
    updatedAt: timestamp,
  } : item);
  let next = { ...planner, teachingSessions };
  if (planner.reconciliationStatus && existing.date >= planner.reconciliationStatus.startDate && existing.date <= planner.reconciliationStatus.throughDate) {
    next = rebuildHistoricalPlans(next, existing.classId);
  }
  return reconcileClasses(next, [existing.classId]);
}

export function markAllTaughtAsPlanned(planner: PlannerData, date: Date): PlannerData {
  const materialized = materializeTeachingSessionsForDate(planner, date);
  const dateKey = localDateKey(date);
  const timestamp = new Date().toISOString();
  const eligible = materialized.teachingSessions.filter((item) => item.date === dateKey && item.outcome === "planned");
  if (!eligible.length) return materialized;
  const eligibleIds = new Set(eligible.map((item) => item.id));
  const teachingSessions = materialized.teachingSessions.map((item) => eligibleIds.has(item.id) ? {
    ...item, outcome: "completed" as const,
    affectsProgress: !materialized.progressCheckpoints[item.classId] || item.date > materialized.progressCheckpoints[item.classId].effectiveDate,
    note: undefined, reason: undefined, updatedAt: timestamp,
  } : item);
  return reconcileClasses({ ...materialized, teachingSessions }, eligible.map((item) => item.classId));
}

export function latestRecordedTeachingSession(planner: PlannerData, classId: string): TeachingSession | undefined {
  return planner.teachingSessions
    .filter((item) => item.classId === classId && item.outcome !== "planned")
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
}

export type ScheduledTeachingOccurrence = {
  date: string;
  timetableSession: TimetableSession;
};

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function validDateRange(startDate: string, endDate: string) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && localDateKey(dateFromKey(value)) === value;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new Error("Choose a valid reconciliation date range.");
  }
}

export function getScheduledTeachingOccurrencesInRange(
  planner: PlannerData,
  startDate: string,
  endDate: string,
): ScheduledTeachingOccurrence[] {
  validDateRange(startDate, endDate);
  const occurrences: ScheduledTeachingOccurrence[] = [];
  const cursor = dateFromKey(startDate);
  const last = dateFromKey(endDate);
  while (cursor <= last) {
    const date = localDateKey(cursor);
    for (const timetableSession of getTeachingSessionsForWeekday(planner.timetableSessions, cursor.getDay())) {
      occurrences.push({ date, timetableSession });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return occurrences;
}

function retreatClassProgress(planner: PlannerData, progress: ClassProgress): ClassProgress {
  const unit = planner.units.find((item) => item.id === progress.unitId);
  if (!unit) return progress;
  if (progress.unitComplete) return { classId: progress.classId, unitId: progress.unitId, lessonId: progress.lessonId };
  const index = unit.lessons.findIndex((item) => item.id === progress.lessonId);
  return index > 0 ? { classId: progress.classId, unitId: progress.unitId, lessonId: unit.lessons[index - 1].id } : progress;
}

function rebuildHistoricalPlans(planner: PlannerData, classId: string): PlannerData {
  const status = planner.reconciliationStatus;
  const baseline = planner.progressBaselines[classId];
  if (!status || !baseline) return planner;
  let pointer = { ...baseline };
  const timetableById = new Map(planner.timetableSessions.map((item) => [item.id, item]));
  const sessions = planner.teachingSessions
    .filter((item) => item.classId === classId && item.date >= status.startDate && item.date <= status.throughDate)
    .sort((a, b) => `${b.date}T${timetableById.get(b.timetableSessionId)?.startTime ?? "00:00"}`.localeCompare(`${a.date}T${timetableById.get(a.timetableSessionId)?.startTime ?? "00:00"}`));
  const updates = new Map<string, TeachingSession>();
  for (const session of sessions) {
    const planned = session.outcome === "completed" ? retreatClassProgress(planner, pointer) : pointer;
    const unit = planner.units.find((item) => item.id === planned.unitId);
    const lesson = unit?.lessons.find((item) => item.id === planned.lessonId);
    if (unit && lesson) {
      updates.set(session.id, {
        ...session,
        plannedUnitId: unit.id,
        plannedLessonId: lesson.id,
        plannedUnitTitle: unit.title,
        plannedLessonTitle: lesson.title,
        affectsProgress: false,
      });
    }
    if (session.outcome === "completed") pointer = planned;
  }
  return { ...planner, teachingSessions: planner.teachingSessions.map((item) => updates.get(item.id) ?? item) };
}

export function reconcilePreviousTeaching(
  planner: PlannerData,
  startDate: string,
  endDate: string,
  asOfDate = localDateKey(new Date()),
): PlannerData {
  validDateRange(startDate, endDate);
  if (endDate > asOfDate) throw new Error("Reconciliation can only include today or earlier dates.");
  const occurrences = getScheduledTeachingOccurrencesInRange(planner, startDate, endDate);
  if (!occurrences.length) throw new Error("No Specialist Teaching sessions are scheduled in that range.");

  let materialized: PlannerData = { ...planner, progressCheckpoints: {} };
  for (let cursor = dateFromKey(startDate), last = dateFromKey(endDate); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    materialized = materializeTeachingSessionsForDate(materialized, new Date(cursor));
  }

  const timestamp = new Date().toISOString();
  const classProgress = clonePlanner(materialized).classProgress;
  const progressBaselines = clonePlanner(materialized).classProgress;
  const progressCheckpoints = Object.fromEntries(Object.values(progressBaselines).map((progress) => [progress.classId, {
    ...progress,
    effectiveDate: asOfDate,
    createdAt: timestamp,
    reason: `Reconciled previous teaching through ${endDate}`,
  }]));
  const teachingSessions = materialized.teachingSessions.map((session) => {
    const inRange = session.date >= startDate && session.date <= endDate;
    const outcome = inRange && session.outcome === "planned" ? "completed" as const : session.outcome;
    return session.date <= asOfDate ? {
      ...session,
      outcome,
      affectsProgress: false,
      note: outcome === "completed" ? undefined : session.note,
      reason: outcome === "completed" ? undefined : session.reason,
      updatedAt: inRange ? timestamp : session.updatedAt,
    } : session;
  });
  let next: PlannerData = touchPlanner({
    ...materialized,
    classProgress,
    progressBaselines,
    progressCheckpoints,
    teachingSessions,
    reconciliationStatus: { startDate, throughDate: endDate, completedAt: timestamp },
  });
  for (const classId of Object.keys(progressBaselines)) next = rebuildHistoricalPlans(next, classId);
  return { ...next, classProgress };
}

export function lessonLabel(position: number, lessons: Lesson[]): string {
  const item = lessons[position - 1];
  return item ? `Lesson ${position} · ${item.title}` : `Lesson ${position}`;
}

export function createClassRecord(
  planner: PlannerData,
  item: SpecialistClass,
): PlannerData {
  if (!planner.yearLevels.some((level) => level.id === item.yearLevelId)) {
    throw new Error("Choose a valid year level.");
  }
  if (!item.name.trim()) throw new Error("Class name is required.");
  if (planner.classes.some((existing) => existing.id === item.id)) {
    throw new Error("Class ID already exists.");
  }
  const level = planner.yearLevels.find((candidate) => candidate.id === item.yearLevelId)!;
  const unit = planner.units.find((candidate) => candidate.id === level.currentUnitId);
  const classProgress = { ...planner.classProgress };
  const progressBaselines = { ...planner.progressBaselines };
  if (unit?.lessons[0]) {
    classProgress[item.id] = { classId: item.id, unitId: unit.id, lessonId: unit.lessons[0].id };
    progressBaselines[item.id] = { ...classProgress[item.id] };
  }
  return touchPlanner({ ...planner, classes: [...planner.classes, item], classProgress, progressBaselines });
}

export function renameClassRecord(planner: PlannerData, classId: string, name: string): PlannerData {
  if (!name.trim()) throw new Error("Class name is required.");
  if (!planner.classes.some((item) => item.id === classId)) throw new Error("Class not found.");
  return touchPlanner({
    ...planner,
    classes: planner.classes.map((item) => item.id === classId ? { ...item, name } : item),
  });
}

export function deleteClassRecord(planner: PlannerData, classId: string): PlannerData {
  if (!planner.classes.some((item) => item.id === classId)) throw new Error("Class not found.");
  const classProgress = { ...planner.classProgress };
  const progressBaselines = { ...planner.progressBaselines };
  const progressCheckpoints = { ...planner.progressCheckpoints };
  const classColours = { ...planner.classColours };
  delete classProgress[classId];
  delete progressBaselines[classId];
  delete progressCheckpoints[classId];
  delete classColours[classId];
  return touchPlanner({
    ...planner,
    classes: planner.classes.filter((item) => item.id !== classId),
    classProgress,
    progressBaselines,
    progressCheckpoints,
    classColours,
    timetableSessions: planner.timetableSessions.filter((session) => session.classId !== classId),
    teachingSessions: planner.teachingSessions.filter((session) => session.classId !== classId),
    trialNotes: planner.trialNotes.map((note) => note.classId === classId ? { ...note, classId: undefined } : note),
  });
}

export function createUnitRecord(planner: PlannerData, unit: Unit, makeCurrent = true): PlannerData {
  if (!planner.yearLevels.some((level) => level.id === unit.yearLevelId)) throw new Error("Year level not found.");
  if (!unit.title.trim()) throw new Error("Unit title is required.");
  if (!unit.lessons.length) throw new Error("A unit needs at least one lesson.");
  if (planner.units.some((existing) => existing.id === unit.id)) throw new Error("Unit ID already exists.");
  const normalized = normalizeUnit(unit);
  let next = touchPlanner({ ...planner, units: [...planner.units, normalized] });
  if (makeCurrent) next = setCurrentUnit(next, unit.yearLevelId, unit.id);
  return next;
}

export function updateUnitDetails(
  planner: PlannerData,
  unitId: string,
  title: string,
  description = "",
): PlannerData {
  if (!title.trim()) throw new Error("Unit title is required.");
  return touchPlanner({
    ...planner,
    units: planner.units.map((unit) => unit.id === unitId
      ? { ...unit, title, description: description || undefined }
      : unit),
  });
}

export function setCurrentUnit(planner: PlannerData, yearLevelId: string, unitId: string): PlannerData {
  const unit = planner.units.find((candidate) => candidate.id === unitId && candidate.yearLevelId === yearLevelId);
  if (!unit?.lessons[0]) throw new Error("Choose a valid unit with lessons.");
  const classProgress = { ...planner.classProgress };
  const progressBaselines = { ...planner.progressBaselines };
  for (const item of planner.classes.filter((candidate) => candidate.yearLevelId === yearLevelId)) {
    if (!classProgress[item.id]) {
      classProgress[item.id] = { classId: item.id, unitId, lessonId: unit.lessons[0].id };
      progressBaselines[item.id] = { ...classProgress[item.id] };
    }
  }
  return touchPlanner({
    ...planner,
    yearLevels: planner.yearLevels.map((level) => level.id === yearLevelId
      ? { ...level, currentUnitId: unitId, expectedLessonId: unit.lessons[0].id }
      : level),
    classProgress,
    progressBaselines,
  });
}

export function deleteUnitRecord(planner: PlannerData, unitId: string): PlannerData {
  if (planner.yearLevels.some((level) => level.currentUnitId === unitId)) {
    throw new Error("Set another current unit before deleting this unit.");
  }
  if (Object.values(planner.classProgress).some((progress) => progress.unitId === unitId)) {
    throw new Error("Move every class to another unit before deleting this unit.");
  }
  return touchPlanner({ ...planner, units: planner.units.filter((unit) => unit.id !== unitId) });
}

export function addLessonRecord(planner: PlannerData, unitId: string, lesson: Lesson): PlannerData {
  if (!lesson.title.trim()) throw new Error("Lesson title is required.");
  return touchPlanner({
    ...planner,
    units: planner.units.map((unit) => unit.id === unitId
      ? normalizeUnit({ ...unit, lessons: [...unit.lessons, { ...lesson, title: lesson.title.trim() }] })
      : unit),
  });
}

export function updateLessonRecord(
  planner: PlannerData,
  unitId: string,
  lessonId: string,
  title: string,
  description = "",
): PlannerData {
  if (!title.trim()) throw new Error("Lesson title is required.");
  return touchPlanner({
    ...planner,
    units: planner.units.map((unit) => unit.id === unitId ? {
      ...unit,
      lessons: unit.lessons.map((lesson) => lesson.id === lessonId
        ? { ...lesson, title, description: description || undefined }
        : lesson),
    } : unit),
  });
}

export function reorderLessonRecord(
  planner: PlannerData,
  unitId: string,
  lessonId: string,
  direction: -1 | 1,
): PlannerData {
  return touchPlanner({
    ...planner,
    units: planner.units.map((unit) => {
      if (unit.id !== unitId) return unit;
      const lessons = [...unit.lessons];
      const index = lessons.findIndex((lesson) => lesson.id === lessonId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= lessons.length) return unit;
      [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
      return normalizeUnit({ ...unit, lessons });
    }),
  });
}

export function deleteLessonRecord(planner: PlannerData, unitId: string, lessonId: string): PlannerData {
  const unit = planner.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error("Unit not found.");
  if (unit.lessons.length <= 1) throw new Error("A unit must keep at least one lesson.");
  const removedIndex = unit.lessons.findIndex((lesson) => lesson.id === lessonId);
  if (removedIndex < 0) throw new Error("Lesson not found.");
  const remaining = unit.lessons.filter((lesson) => lesson.id !== lessonId);
  const replacement = remaining[Math.min(removedIndex, remaining.length - 1)];
  const repairProgress = (progress: ClassProgress) => {
    if (progress.unitId !== unitId || progress.lessonId !== lessonId) return progress;
    const activeProgress = { ...progress };
    delete activeProgress.unitComplete;
    return { ...activeProgress, lessonId: replacement.id };
  };
  const classProgress = Object.fromEntries(Object.entries(planner.classProgress).map(([classId, progress]) => [
    classId, repairProgress(progress),
  ]));
  const progressBaselines = Object.fromEntries(Object.entries(planner.progressBaselines).map(([classId, progress]) => [
    classId, repairProgress(progress),
  ]));
  const progressCheckpoints = Object.fromEntries(Object.entries(planner.progressCheckpoints).map(([classId, progress]) => [
    classId, repairProgress(progress) as ProgressCheckpoint,
  ]));
  return touchPlanner({
    ...planner,
    units: planner.units.map((candidate) => candidate.id === unitId ? normalizeUnit({ ...candidate, lessons: remaining }) : candidate),
    yearLevels: planner.yearLevels.map((level) => level.expectedLessonId === lessonId ? { ...level, expectedLessonId: replacement.id } : level),
    classProgress,
    progressBaselines,
    progressCheckpoints,
  });
}

export function setClassLesson(planner: PlannerData, classId: string, lessonId: string): PlannerData {
  const item = planner.classes.find((candidate) => candidate.id === classId);
  const level = planner.yearLevels.find((candidate) => candidate.id === item?.yearLevelId);
  const existing = planner.classProgress[classId];
  const unit = planner.units.find((candidate) => candidate.id === existing?.unitId && candidate.yearLevelId === level?.id);
  if (!item || !level || !unit?.lessons.some((lesson) => lesson.id === lessonId)) {
    throw new Error("Choose a valid lesson for this class.");
  }
  return applyManualProgressCorrection(planner, { classId, unitId: unit.id, lessonId });
}

export function setClassPosition(
  planner: PlannerData,
  classId: string,
  unitId: string,
  lessonId: string,
): PlannerData {
  const item = planner.classes.find((candidate) => candidate.id === classId);
  const unit = planner.units.find((candidate) =>
    candidate.id === unitId &&
    candidate.yearLevelId === item?.yearLevelId &&
    candidate.lessons.some((lesson) => lesson.id === lessonId),
  );
  if (!item || !unit) throw new Error("Choose a valid unit and lesson for this class.");
  return applyManualProgressCorrection(planner, { classId, unitId, lessonId });
}

function applyManualProgressCorrection(planner: PlannerData, progress: ClassProgress): PlannerData {
  const timestamp = new Date().toISOString();
  return touchPlanner({
    ...planner,
    classProgress: { ...planner.classProgress, [progress.classId]: progress },
    progressBaselines: { ...planner.progressBaselines, [progress.classId]: progress },
    progressCheckpoints: { ...planner.progressCheckpoints, [progress.classId]: {
      ...progress,
      effectiveDate: localDateKey(new Date()),
      createdAt: timestamp,
      reason: "Manual progress correction",
    } },
    teachingSessions: planner.teachingSessions.map((session) => session.classId === progress.classId
      ? { ...session, affectsProgress: false }
      : session),
  });
}

export function setExpectedLesson(planner: PlannerData, yearLevelId: string, lessonId: string): PlannerData {
  const level = planner.yearLevels.find((candidate) => candidate.id === yearLevelId);
  const unit = planner.units.find((candidate) => candidate.id === level?.currentUnitId);
  if (!unit?.lessons.some((lesson) => lesson.id === lessonId)) throw new Error("Choose a valid expected lesson.");
  return touchPlanner({
    ...planner,
    yearLevels: planner.yearLevels.map((candidate) => candidate.id === yearLevelId ? { ...candidate, expectedLessonId: lessonId } : candidate),
  });
}

export function normalizeUnit(unit: Unit): Unit {
  return { ...unit, lessons: unit.lessons.map((lesson, index) => ({ ...lesson, sequence: index + 1 })) };
}
