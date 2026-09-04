import { clonePlanner, type PlannerData, type TeachingSession, type Unit } from "./domain.ts";

export const LIVE_TRIAL_WEEK_RESET_KEY = "specialist-planner.reset.2026-08-31.v1";
export const LIVE_TRIAL_WEEK_START = "2026-08-31";
export const LIVE_TRIAL_WEEK_END = "2026-09-04";

type ResetTarget = { className: string; unitTitle: string; lesson: number };

const targets: ResetTarget[] = [
  { className: "6B", unitTitle: "Chinese Names", lesson: 5 },
  { className: "6D", unitTitle: "Chinese Names", lesson: 5 },
  { className: "4C", unitTitle: "Australian States and Territories", lesson: 4 },
  { className: "4B", unitTitle: "Australian States and Territories", lesson: 4 },
  { className: "4E", unitTitle: "Australian States and Territories", lesson: 3 },
  { className: "5E", unitTitle: "Countries and Nationalities", lesson: 3 },
  { className: "5C", unitTitle: "Countries and Nationalities", lesson: 3 },
  { className: "2C", unitTitle: "Family", lesson: 1 },
  { className: "2A", unitTitle: "Family", lesson: 1 },
  { className: "1C", unitTitle: "Pets", lesson: 1 },
  { className: "1D", unitTitle: "Pets", lesson: 2 },
  { className: "Prep E", unitTitle: "Numbers", lesson: 4 },
  { className: "Prep C", unitTitle: "Numbers", lesson: 4 },
  { className: "Prep B", unitTitle: "Numbers", lesson: 5 },
  { className: "3A", unitTitle: "Mini Self-intro", lesson: 4 },
  { className: "3B", unitTitle: "Mini Self-intro", lesson: 4 },
];

const cohortReferences = ["6B", "4C", "5E", "2C", "1D", "Prep E", "3A"];
const timetableCorrections: Record<string, { weekday: number; startTime: string; endTime: string }> = {
  "Prep E": { weekday: 3, startTime: "11:15", endTime: "12:15" },
  "Prep C": { weekday: 3, startTime: "12:15", endTime: "13:15" },
  "2C": { weekday: 4, startTime: "11:15", endTime: "12:15" },
  "2A": { weekday: 4, startTime: "12:15", endTime: "13:15" },
};

function comparable(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

function unitForTarget(planner: PlannerData, yearLevelId: string, title: string): Unit | undefined {
  const wanted = comparable(title);
  return planner.units.find(unit => unit.yearLevelId === yearLevelId && comparable(unit.title) === wanted);
}

function cancelledSession(planner: PlannerData, classId: string, unit: Unit, lessonId: string): TeachingSession | undefined {
  const timetable = planner.timetableSessions.find(session => session.type === "specialist-teaching" && session.classId === classId && session.weekday === 4);
  const specialistClass = planner.classes.find(item => item.id === classId);
  const lesson = unit.lessons.find(item => item.id === lessonId);
  if (!timetable || !specialistClass || !lesson) return undefined;
  const timestamp = "2026-09-04T00:00:00.000Z";
  return {
    id: `live-reset-2026-09-03-${timetable.id}`,
    date: "2026-09-03",
    timetableSessionId: timetable.id,
    subjectId: timetable.subjectId ?? planner.activeSubjectId,
    classId,
    yearLevelId: specialistClass.yearLevelId,
    plannedUnitId: unit.id,
    plannedLessonId: lesson.id,
    plannedUnitTitle: unit.title,
    plannedLessonTitle: lesson.title,
    outcome: "not-taught",
    reason: "Cancelled",
    affectsProgress: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function applyLiveTrialWeekReset(source: PlannerData): { planner: PlannerData; applied: boolean; missing: string[] } {
  const resolved = targets.map(target => {
    const specialistClass = source.classes.find(item => comparable(item.name) === comparable(target.className));
    const unit = specialistClass ? unitForTarget(source, specialistClass.yearLevelId, target.unitTitle) : undefined;
    const lesson = unit?.lessons[target.lesson - 1];
    return { target, specialistClass, unit, lesson };
  });
  const missing = resolved.filter(item => !item.specialistClass || !item.unit || !item.lesson).map(item => `${item.target.className}: ${item.target.unitTitle} L${item.target.lesson}`);
  if (missing.length) return { planner: source, applied: false, missing };

  const planner = clonePlanner(source);
  const coloursBefore = JSON.stringify(planner.classColours);
  const byName = new Map(resolved.map(item => [item.target.className, item]));

  for (const { specialistClass, unit, lesson } of resolved) {
    const progress = { classId: specialistClass!.id, unitId: unit!.id, lessonId: lesson!.id };
    planner.classProgress[specialistClass!.id] = progress;
    planner.progressBaselines[specialistClass!.id] = { ...progress };
  }

  planner.yearLevels = planner.yearLevels.map(level => {
    const referenceName = cohortReferences.find(name => byName.get(name)?.specialistClass?.yearLevelId === level.id);
    const reference = referenceName ? byName.get(referenceName) : undefined;
    return reference ? { ...level, currentUnitId: reference.unit!.id, expectedLessonId: reference.lesson!.id } : level;
  });

  const classesById = new Map(planner.classes.map(item => [item.id, item]));
  planner.timetableSessions = planner.timetableSessions.map(session => {
    const specialistClass = session.classId ? classesById.get(session.classId) : undefined;
    const correction = specialistClass ? timetableCorrections[specialistClass.name] : undefined;
    return correction && session.type === "specialist-teaching" ? { ...session, ...correction } : session;
  });

  planner.teachingSessions = planner.teachingSessions
    .filter(session => !(session.classId === byName.get("4E")!.specialistClass!.id && session.date === "2026-09-03"))
    .map(session => session.date >= LIVE_TRIAL_WEEK_START && session.date <= LIVE_TRIAL_WEEK_END ? { ...session, affectsProgress: false } : session);
  const fourE = byName.get("4E")!;
  const cancellation = cancelledSession(planner, fourE.specialistClass!.id, fourE.unit!, fourE.lesson!.id);
  if (!cancellation) return { planner: source, applied: false, missing: ["4E timetable: Thursday"] };
  planner.teachingSessions.push(cancellation);
  planner.updatedAt = "2026-09-04T00:00:00.000Z";

  if (JSON.stringify(planner.classColours) !== coloursBefore) throw new Error("Class colours changed during the live-trial reset.");
  return { planner, applied: true, missing: [] };
}
