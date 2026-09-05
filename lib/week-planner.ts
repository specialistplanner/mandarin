import {
  SESSION_TYPE_LABELS,
  getCohortProgressStatus,
  lessonPosition,
  localDateKey,
  type Lesson,
  type ClassColourId,
  type PlannerData,
  type ProgressStatus,
  type SpecialistClass,
  type TeachingSession,
  type TimetableSession,
  type Unit,
  type YearLevel,
} from "./domain.ts";

export type WeekEntryState = "actual" | "planned" | "unconfirmed" | "projected" | "legacy" | "unit-complete" | "needs-setup";

export type WeekEntry = {
  key: string;
  date: string;
  timetable: TimetableSession;
  kind: "teaching" | "generalist-teaching" | "non-teaching";
  label: string;
  state: WeekEntryState;
  specialistClass?: SpecialistClass;
  yearLevel?: YearLevel;
  unit?: Unit;
  lesson?: Lesson;
  lessonNumber?: number;
  progressStatus?: ProgressStatus;
  session?: TeachingSession;
  previousSession?: TeachingSession;
  projectionUncertain?: boolean;
  canRecordOutcome: boolean;
  classColourId?: ClassColourId;
};

export type WeekDay = {
  date: Date;
  dateKey: string;
  weekday: number;
  entries: WeekEntry[];
};

export type DerivedWeek = {
  start: Date;
  end: Date;
  days: WeekDay[];
};

export function startOfTeachingWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function shiftTeachingWeek(start: Date, amount: number): Date {
  const shifted = new Date(start);
  shifted.setDate(shifted.getDate() + amount * 7);
  return startOfTeachingWeek(shifted);
}

function latestEarlierSession(
  planner: PlannerData,
  classId: string,
  date: string,
  startTime: string,
  excludedId?: string,
): TeachingSession | undefined {
  const timetableById = new Map(planner.timetableSessions.map((item) => [item.id, item]));
  return planner.teachingSessions
    .filter((item) => item.classId === classId && item.id !== excludedId && item.outcome !== "planned" && (item.date < date || (item.date === date && (timetableById.get(item.timetableSessionId)?.startTime ?? "00:00") < startTime)))
    .sort((a, b) => b.date.localeCompare(a.date) || (timetableById.get(b.timetableSessionId)?.startTime ?? "00:00").localeCompare(timetableById.get(a.timetableSessionId)?.startTime ?? "00:00") || b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function deriveTeachingWeek(planner: PlannerData, anchorDate: Date, today = new Date()): DerivedWeek {
  const start = startOfTeachingWeek(anchorDate);
  const todayKey = localDateKey(today);
  const classById = new Map(planner.classes.map((item) => [item.id, item]));
  const levelById = new Map(planner.yearLevels.map((item) => [item.id, item]));
  const unitById = new Map(planner.units.map((item) => [item.id, item]));
  const sessionByOccurrence = new Map(planner.teachingSessions.map((item) => [`${item.date}:${item.timetableSessionId}`, item]));
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const endKey = localDateKey(end);
  const completedCohortPositions = new Map<string, number>();
  const completedCohortPositionsByWeek = new Map<string, number>();
  for (const session of planner.teachingSessions.filter(item => item.outcome === "completed")) {
    const specialistClass = classById.get(session.classId);
    const unit = unitById.get(session.plannedUnitId);
    if (!specialistClass || !unit) continue;
    const position = lessonPosition(unit, session.plannedLessonId);
    const key = `${specialistClass.yearLevelId}:${unit.id}`;
    const sessionWeekKey = localDateKey(startOfTeachingWeek(new Date(`${session.date}T12:00:00`)));
    const weeklyKey = `${sessionWeekKey}:${key}`;
    completedCohortPositionsByWeek.set(weeklyKey, Math.max(completedCohortPositionsByWeek.get(weeklyKey) ?? 0, position));
    if (session.date >= localDateKey(start) && session.date <= endKey) {
      completedCohortPositions.set(key, Math.max(completedCohortPositions.get(key) ?? 0, position));
    }
  }
  const historicalCompletedBaseline = (key: string) => {
    const selectedWeekKey = localDateKey(start);
    const later = [...completedCohortPositionsByWeek.entries()]
      .filter(([weeklyKey]) => weeklyKey.endsWith(`:${key}`) && weeklyKey.slice(0, 10) > selectedWeekKey)
      .sort(([a], [b]) => a.localeCompare(b))[0];
    if (!later) return undefined;
    const laterStart = startOfTeachingWeek(new Date(`${later[0].slice(0, 10)}T12:00:00`));
    const weekDistance = Math.round((laterStart.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, later[1] - weekDistance);
  };
  const unresolvedClasses = new Set<string>();
  const days: WeekDay[] = [];

  for (let offset = 0; offset < 5; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const dateKey = localDateKey(date);
    const timetable = planner.timetableSessions
      .filter((item) => item.weekday === date.getDay())
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const entries = timetable.map<WeekEntry>((item) => {
      if (item.type === "generalist-teaching") {
        return {
          key: `${dateKey}:${item.id}`,
          date: dateKey,
          timetable: item,
          kind: "generalist-teaching",
          label: item.label?.trim() || SESSION_TYPE_LABELS[item.type],
          state: "planned",
          specialistClass: item.classId ? classById.get(item.classId) : undefined,
          canRecordOutcome: false,
        };
      }
      if (item.type !== "specialist-teaching") {
        return {
          key: `${dateKey}:${item.id}`,
          date: dateKey,
          timetable: item,
          kind: "non-teaching",
          label: item.label?.trim() || SESSION_TYPE_LABELS[item.type],
          state: "planned",
          canRecordOutcome: false,
        };
      }

      const specialistClass = item.classId ? classById.get(item.classId) : undefined;
      const yearLevel = specialistClass ? levelById.get(specialistClass.yearLevelId) : undefined;
      const progress = specialistClass ? planner.classProgress[specialistClass.id] : undefined;
      const currentUnit = progress ? unitById.get(progress.unitId) : undefined;
      const session = sessionByOccurrence.get(`${dateKey}:${item.id}`);
      const useSessionSnapshot = Boolean(session && session.outcome !== "planned");
      const sessionUnit = session ? unitById.get(session.plannedUnitId) : undefined;
      const unit = useSessionSnapshot ? sessionUnit : currentUnit;
      const lessonId = useSessionSnapshot ? session!.plannedLessonId : progress?.lessonId;
      const lesson = unit?.lessons.find((candidate) => candidate.id === lessonId);
      const checkpoint = specialistClass ? planner.progressCheckpoints[specialistClass.id] : undefined;
      const legacy = Boolean(checkpoint && dateKey <= checkpoint.effectiveDate && session?.outcome === "planned");
      const beforeCheckpoint = Boolean(checkpoint && dateKey <= checkpoint.effectiveDate && !session);
      const actual = Boolean(session && session.outcome !== "planned");
      const canRecordOutcome = Boolean(specialistClass && !beforeCheckpoint && !legacy && dateKey <= todayKey && (!checkpoint || dateKey > checkpoint.effectiveDate));
      let state: WeekEntryState = actual ? "actual" : dateKey > todayKey ? "projected" : dateKey < todayKey ? "unconfirmed" : "planned";
      if (legacy || beforeCheckpoint) state = "legacy";
      else if (!actual && progress?.unitComplete) state = "unit-complete";
      else if (!specialistClass || !progress || !currentUnit || !lesson) state = "needs-setup";
      const projectionUncertain = Boolean(specialistClass && unresolvedClasses.has(specialistClass.id) && !actual);
      if (specialistClass && !actual && state !== "legacy" && state !== "unit-complete" && state !== "needs-setup") unresolvedClasses.add(specialistClass.id);

      const cohortUnit = yearLevel?.currentUnitId ? unitById.get(yearLevel.currentUnitId) : undefined;
      const statusUnit = useSessionSnapshot ? sessionUnit : currentUnit;
      const statusLessonId = useSessionSnapshot ? session!.plannedLessonId : progress?.lessonId;
      const cohortPositionKey = yearLevel && cohortUnit ? `${yearLevel.id}:${cohortUnit.id}` : undefined;
      const completedCohortPosition = cohortPositionKey
        ? completedCohortPositions.get(cohortPositionKey) ?? historicalCompletedBaseline(cohortPositionKey)
        : undefined;
      const expectedPosition = useSessionSnapshot && completedCohortPosition
        ? completedCohortPosition
        : cohortUnit ? lessonPosition(cohortUnit, yearLevel?.expectedLessonId) : undefined;
      const progressStatus = statusUnit && statusLessonId && cohortUnit && expectedPosition
        ? getCohortProgressStatus(statusUnit.id, lessonPosition(statusUnit, statusLessonId), cohortUnit.id, expectedPosition)
        : undefined;
      return {
        key: `${dateKey}:${item.id}`,
        date: dateKey,
        timetable: item,
        kind: "teaching",
        label: specialistClass?.name ?? item.label ?? "Specialist teaching",
        state,
        specialistClass,
        yearLevel,
        unit,
        lesson,
        lessonNumber: unit && lesson ? lessonPosition(unit, lesson.id) : undefined,
        progressStatus,
        session,
        previousSession: specialistClass ? latestEarlierSession(planner, specialistClass.id, dateKey, item.startTime, session?.id) : undefined,
        projectionUncertain,
        canRecordOutcome,
        classColourId: specialistClass ? planner.classColours[specialistClass.id] : undefined,
      };
    });
    days.push({ date, dateKey, weekday: date.getDay(), entries });
  }
  return { start, end, days };
}
