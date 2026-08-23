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

export type Lesson = {
  id: string;
  title: string;
  sequence: number;
};

export type Unit = {
  id: string;
  title: string;
  lessons: Lesson[];
};

export type YearLevel = {
  id: string;
  label: string;
  shortLabel: string;
  currentUnitId: string;
  expectedLesson: number;
};

export type SpecialistClass = {
  id: string;
  name: string;
  yearLevelId: string;
};

export type ClassProgress = {
  classId: string;
  unitId: string;
  currentLesson: number;
};

export type TimetableSession = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  type: SessionType;
  classId?: string;
  subjectId?: string;
  outcome?: TeachingSessionOutcome;
};

export type ProgressStatus = {
  kind: "behind" | "on-track" | "ahead";
  difference: number;
  label: string;
};

export type ProgressMap = Record<string, number>;

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
  return {
    ...progress,
    [classId]: clampLesson(current + delta, lessonCount),
  };
}

export function setProgress(
  progress: ProgressMap,
  classId: string,
  lesson: number,
  lessonCount: number,
): ProgressMap {
  return {
    ...progress,
    [classId]: clampLesson(lesson, lessonCount),
  };
}

export function getProgressStatus(
  currentLesson: number,
  expectedLesson: number,
): ProgressStatus {
  const difference = currentLesson - expectedLesson;
  if (difference === 0) {
    return { kind: "on-track", difference, label: "On track" };
  }

  const distance = Math.abs(difference);
  const unit = distance === 1 ? "lesson" : "lessons";
  return difference < 0
    ? { kind: "behind", difference, label: `${distance} ${unit} behind` }
    : { kind: "ahead", difference, label: `${distance} ${unit} ahead` };
}

export function getYearLevelExceptions(
  classes: SpecialistClass[],
  progress: ProgressMap,
  expectedLesson: number,
): SpecialistClass[] {
  return classes.filter(
    (specialistClass) =>
      getProgressStatus(progress[specialistClass.id] ?? 1, expectedLesson).kind !==
      "on-track",
  );
}

export function getTeachingSessionsForWeekday(
  sessions: TimetableSession[],
  weekday: number,
): TimetableSession[] {
  return sessions
    .filter(
      (session) =>
        session.weekday === weekday && session.type === "specialist-teaching",
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function lessonLabel(lesson: number, lessons: Lesson[]): string {
  const item = lessons.find((candidate) => candidate.sequence === lesson);
  return item ? `Lesson ${item.sequence} · ${item.title}` : `Lesson ${lesson}`;
}
