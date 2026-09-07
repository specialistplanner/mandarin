import { clonePlanner, unitAppliesToYearLevel, type ClassProgress, type PlannerData, type TeachingSession, type Unit } from "./domain.ts";

export const LIVE_TRIAL_WEEK_RESET_KEY = "specialist-planner.reset.2026-08-31.v2";
export const LIVE_TRIAL_WEEK_START = "2026-08-31";
export const LIVE_TRIAL_WEEK_END = "2026-09-04";

type ProgressTarget = { className: string; unitTitle: string; completedLesson: number };

const completedTargets: ProgressTarget[] = [
  { className: "6B", unitTitle: "Chinese Names", completedLesson: 5 },
  { className: "6D", unitTitle: "Chinese Names", completedLesson: 5 },
  { className: "4C", unitTitle: "Australian States and Territories", completedLesson: 4 },
  { className: "4B", unitTitle: "Australian States and Territories", completedLesson: 4 },
  { className: "5E", unitTitle: "Countries and Nationalities", completedLesson: 3 },
  { className: "5C", unitTitle: "Countries and Nationalities", completedLesson: 3 },
];

const completedOnlyClassNames = ["1C", "2C", "2A", "1D"];
const untouchedClassNames = ["Prep E", "Prep C", "Prep B", "3A", "3B"];
const timetableCorrections: Record<string, { weekday: number; startTime: string; endTime: string }> = {
  "Prep E": { weekday: 3, startTime: "11:15", endTime: "12:15" },
  "Prep C": { weekday: 3, startTime: "12:15", endTime: "13:15" },
  "2C": { weekday: 4, startTime: "11:15", endTime: "12:15" },
  "2A": { weekday: 4, startTime: "12:15", endTime: "13:15" },
};
const timestamp = "2026-09-04T00:00:00.000Z";

function comparable(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

function unitForTarget(planner: PlannerData, yearLevelId: string, title: string): Unit | undefined {
  const wanted = comparable(title);
  return planner.units.find(unit => unitAppliesToYearLevel(unit, yearLevelId) && comparable(unit.title) === wanted);
}

function occurrenceDate(weekday: number): string | undefined {
  return ({ 1: "2026-08-31", 2: "2026-09-01", 3: "2026-09-02", 4: "2026-09-03", 5: "2026-09-04" } as Record<number, string>)[weekday];
}

function nextProgress(classId: string, unit: Unit, completedLesson: number): ClassProgress {
  const nextLesson = unit.lessons[completedLesson];
  if (nextLesson) return { classId, unitId: unit.id, lessonId: nextLesson.id };
  return { classId, unitId: unit.id, lessonId: unit.lessons.at(-1)!.id, unitComplete: true };
}

function replaceOccurrence(planner: PlannerData, session: TeachingSession): void {
  planner.teachingSessions = planner.teachingSessions.filter(item =>
    !(item.date === session.date && item.timetableSessionId === session.timetableSessionId),
  );
  planner.teachingSessions.push(session);
}

function recordedSession(
  planner: PlannerData,
  classId: string,
  unit: Unit,
  plannedLessonId: string,
  outcome: "completed" | "not-taught",
  date?: string,
  reason?: string,
): TeachingSession | undefined {
  const timetable = planner.timetableSessions.find(session => session.type === "specialist-teaching" && session.classId === classId);
  const specialistClass = planner.classes.find(item => item.id === classId);
  const lesson = unit.lessons.find(item => item.id === plannedLessonId);
  const sessionDate = date ?? (timetable ? occurrenceDate(timetable.weekday) : undefined);
  if (!timetable || !specialistClass || !lesson || !sessionDate) return undefined;
  return {
    id: `live-reset-v2-${sessionDate}-${timetable.id}`,
    date: sessionDate,
    timetableSessionId: timetable.id,
    subjectId: timetable.subjectId ?? planner.activeSubjectId,
    classId,
    yearLevelId: specialistClass.yearLevelId,
    plannedUnitId: unit.id,
    plannedLessonId: lesson.id,
    plannedUnitTitle: unit.title,
    plannedLessonTitle: lesson.title,
    outcome,
    ...(reason ? { reason } : {}),
    affectsProgress: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function applyLiveTrialWeekReset(source: PlannerData): { planner: PlannerData; applied: boolean; missing: string[] } {
  const resolved = completedTargets.map(target => {
    const specialistClass = source.classes.find(item => comparable(item.name) === comparable(target.className));
    const unit = specialistClass ? unitForTarget(source, specialistClass.yearLevelId, target.unitTitle) : undefined;
    const completedLesson = unit?.lessons[target.completedLesson - 1];
    return { target, specialistClass, unit, completedLesson };
  });
  const fourEClass = source.classes.find(item => comparable(item.name) === comparable("4E"));
  const fourEUnit = fourEClass ? unitForTarget(source, fourEClass.yearLevelId, "Australian States and Territories") : undefined;
  const fourELesson3 = fourEUnit?.lessons[2];
  const completedOnly = completedOnlyClassNames.map(className => {
    const specialistClass = source.classes.find(item => comparable(item.name) === comparable(className));
    const progress = specialistClass ? source.classProgress[specialistClass.id] : undefined;
    const unit = progress ? source.units.find(item => item.id === progress.unitId) : undefined;
    const lesson = unit?.lessons.find(item => item.id === progress?.lessonId);
    return { className, specialistClass, progress, unit, lesson };
  });
  const missing = [
    ...resolved.filter(item => !item.specialistClass || !item.unit || !item.completedLesson).map(item => `${item.target.className}: ${item.target.unitTitle} L${item.target.completedLesson}`),
    ...(!fourEClass || !fourEUnit || !fourELesson3 ? ["4E: Australian States and Territories L3"] : []),
    ...completedOnly.filter(item => !item.specialistClass || !item.progress || !item.unit || !item.lesson).map(item => `${item.className}: current progress`),
  ];
  if (missing.length) return { planner: source, applied: false, missing };

  const planner = clonePlanner(source);
  const coloursBefore = JSON.stringify(planner.classColours);
  const untouchedBefore = Object.fromEntries(untouchedClassNames.map(name => {
    const specialistClass = planner.classes.find(item => comparable(item.name) === comparable(name))!;
    return [name, {
      progress: planner.classProgress[specialistClass.id],
      baseline: planner.progressBaselines[specialistClass.id],
      checkpoint: planner.progressCheckpoints[specialistClass.id],
      sessions: planner.teachingSessions.filter(item => item.classId === specialistClass.id),
    }];
  }));

  for (const item of resolved) {
    const progress = nextProgress(item.specialistClass!.id, item.unit!, item.target.completedLesson);
    planner.classProgress[item.specialistClass!.id] = progress;
    planner.progressBaselines[item.specialistClass!.id] = { ...progress };
    planner.progressCheckpoints[item.specialistClass!.id] = {
      ...progress,
      effectiveDate: LIVE_TRIAL_WEEK_END,
      createdAt: timestamp,
      reason: "Classroom progress correction",
    };
  }
  const fourEProgress = { classId: fourEClass!.id, unitId: fourEUnit!.id, lessonId: fourELesson3!.id };
  planner.classProgress[fourEClass!.id] = fourEProgress;
  planner.progressBaselines[fourEClass!.id] = { ...fourEProgress };
  planner.progressCheckpoints[fourEClass!.id] = {
    ...fourEProgress,
    effectiveDate: LIVE_TRIAL_WEEK_END,
    createdAt: timestamp,
    reason: "Classroom progress correction",
  };

  for (const referenceName of ["6B", "4C", "5E"]) {
    const reference = resolved.find(item => item.target.className === referenceName)!;
    const expected = planner.classProgress[reference.specialistClass!.id];
    planner.yearLevels = planner.yearLevels.map(level => level.id === reference.specialistClass!.yearLevelId
      ? { ...level, currentUnitId: expected.unitId, expectedLessonId: expected.lessonId }
      : level);
  }

  const classById = new Map(planner.classes.map(item => [item.id, item]));
  planner.timetableSessions = planner.timetableSessions.map(session => {
    const specialistClass = session.classId ? classById.get(session.classId) : undefined;
    const correction = specialistClass ? timetableCorrections[specialistClass.name] : undefined;
    return correction && session.type === "specialist-teaching" ? { ...session, ...correction } : session;
  });

  for (const item of resolved) {
    const session = recordedSession(planner, item.specialistClass!.id, item.unit!, item.completedLesson!.id, "completed");
    if (!session) return { planner: source, applied: false, missing: [`${item.target.className}: weekly timetable`] };
    replaceOccurrence(planner, session);
  }
  for (const item of completedOnly) {
    const session = recordedSession(planner, item.specialistClass!.id, item.unit!, item.lesson!.id, "completed");
    if (!session) return { planner: source, applied: false, missing: [`${item.className}: weekly timetable`] };
    replaceOccurrence(planner, session);
  }
  for (const [date, reason] of [["2026-08-27", "Camp"], ["2026-09-03", "Cancelled"]] as const) {
    const cancellation = recordedSession(planner, fourEClass!.id, fourEUnit!, fourELesson3!.id, "not-taught", date, reason);
    if (!cancellation) return { planner: source, applied: false, missing: [`4E: ${date} timetable`] };
    replaceOccurrence(planner, cancellation);
  }
  planner.updatedAt = timestamp;

  if (JSON.stringify(planner.classColours) !== coloursBefore) throw new Error("Class colours changed during the live-trial reset.");
  for (const name of untouchedClassNames) {
    const specialistClass = planner.classes.find(item => comparable(item.name) === comparable(name))!;
    const after = {
      progress: planner.classProgress[specialistClass.id],
      baseline: planner.progressBaselines[specialistClass.id],
      checkpoint: planner.progressCheckpoints[specialistClass.id],
      sessions: planner.teachingSessions.filter(item => item.classId === specialistClass.id),
    };
    if (JSON.stringify(after) !== JSON.stringify(untouchedBefore[name])) throw new Error(`${name} changed during the live-trial reset.`);
  }
  return { planner, applied: true, missing: [] };
}
