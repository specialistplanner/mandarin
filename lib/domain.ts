export const PLANNER_SCHEMA_VERSION = 3 as const;

export type SessionType =
  | "specialist-teaching"
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
  | "cancelled";

export type Subject = { id: string; name: string };

export type Lesson = {
  id: string;
  title: string;
  description?: string;
  sequence: number;
};

export type Unit = {
  id: string;
  yearLevelId: string;
  title: string;
  description?: string;
  lessons: Lesson[];
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
};

export type TimetableSession = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  type: SessionType;
  classId?: string;
  subjectId?: string;
  label?: string;
  outcome?: TeachingSessionOutcome;
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
  timetableSessions: TimetableSession[];
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
  "cover-release": "Cover / Release",
  planning: "Planning",
  meeting: "PLT / Meeting",
  "school-activity": "Assembly / School Activity",
  break: "Break",
  other: "Other",
};

export function clonePlanner(planner: PlannerData): PlannerData {
  return JSON.parse(JSON.stringify(planner)) as PlannerData;
}

export function touchPlanner(planner: PlannerData): PlannerData {
  return { ...planner, updatedAt: new Date().toISOString() };
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
  if (unit?.lessons[0]) {
    classProgress[item.id] = { classId: item.id, unitId: unit.id, lessonId: unit.lessons[0].id };
  }
  return touchPlanner({ ...planner, classes: [...planner.classes, item], classProgress });
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
  delete classProgress[classId];
  return touchPlanner({
    ...planner,
    classes: planner.classes.filter((item) => item.id !== classId),
    classProgress,
    timetableSessions: planner.timetableSessions.filter((session) => session.classId !== classId),
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
  for (const item of planner.classes.filter((candidate) => candidate.yearLevelId === yearLevelId)) {
    if (!classProgress[item.id]) {
      classProgress[item.id] = { classId: item.id, unitId, lessonId: unit.lessons[0].id };
    }
  }
  return touchPlanner({
    ...planner,
    yearLevels: planner.yearLevels.map((level) => level.id === yearLevelId
      ? { ...level, currentUnitId: unitId, expectedLessonId: unit.lessons[0].id }
      : level),
    classProgress,
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
  const classProgress = Object.fromEntries(Object.entries(planner.classProgress).map(([classId, progress]) => [
    classId,
    progress.unitId === unitId && progress.lessonId === lessonId ? { ...progress, lessonId: replacement.id } : progress,
  ]));
  return touchPlanner({
    ...planner,
    units: planner.units.map((candidate) => candidate.id === unitId ? normalizeUnit({ ...candidate, lessons: remaining }) : candidate),
    yearLevels: planner.yearLevels.map((level) => level.expectedLessonId === lessonId ? { ...level, expectedLessonId: replacement.id } : level),
    classProgress,
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
  return touchPlanner({
    ...planner,
    classProgress: { ...planner.classProgress, [classId]: { classId, unitId: unit.id, lessonId } },
  });
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
  return touchPlanner({
    ...planner,
    classProgress: { ...planner.classProgress, [classId]: { classId, unitId, lessonId } },
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
