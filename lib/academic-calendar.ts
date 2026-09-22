import { localDateKey, type NonTeachingPeriod, type PlannerData, type TeachingSessionOutcome, type Term } from "./domain.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTermDate(value: string): string {
  const [, month, day] = value.split("-").map(Number);
  return `${day} ${SHORT_MONTH_NAMES[month - 1]}`;
}

function atNoon(value: string | Date): Date {
  return typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
}

export function mondayOf(date: Date): Date {
  const result = atNoon(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

export function nonTeachingPeriodForDate(planner: PlannerData, value: string | Date): NonTeachingPeriod | undefined {
  const key = typeof value === "string" ? value : localDateKey(value);
  return planner.nonTeachingPeriods.find((period) => period.startDate <= key && period.endDate >= key);
}

export function isTeachingDate(planner: PlannerData, value: string | Date): boolean {
  const date = atNoon(value);
  const key = localDateKey(date);
  if (date.getDay() === 0 || date.getDay() === 6 || nonTeachingPeriodForDate(planner, key)) return false;
  if (!planner.terms.length) return true;
  return planner.terms.some((term) => term.startDate <= key && term.endDate >= key);
}

export function weekHasTeachingDay(planner: PlannerData, weekStart: Date): boolean {
  for (let offset = 0; offset < 5; offset += 1) {
    const date = atNoon(weekStart);
    date.setDate(date.getDate() + offset);
    if (isTeachingDate(planner, date)) return true;
  }
  return false;
}

export function shiftConfiguredTeachingWeek(planner: PlannerData, start: Date, amount: number): Date {
  if (!amount) return mondayOf(start);
  const direction = amount < 0 ? -1 : 1;
  let remaining = Math.abs(amount);
  const cursor = mondayOf(start);
  let guard = 0;
  while (remaining && guard < 540) {
    cursor.setDate(cursor.getDate() + direction * 7);
    if (weekHasTeachingDay(planner, cursor)) remaining -= 1;
    guard += 1;
  }
  return cursor;
}

export function teachingWeekStarts(planner: PlannerData, term: Term): Date[] {
  const starts: Date[] = [];
  const cursor = mondayOf(atNoon(term.startDate));
  const end = atNoon(term.endDate);
  while (cursor <= end) {
    if (weekHasTeachingDay(planner, cursor)) starts.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return starts;
}

export type TermOverviewClassItem = {
  classId: string;
  className: string;
  unitId?: string;
  unitTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  outcome: TeachingSessionOutcome | "scheduled" | "none";
  supportingClassCount: number;
  totalClassCount: number;
  outcomes: { outcome: TeachingSessionOutcome | "scheduled" | "none"; count: number }[];
};

export type TermOverviewCell = {
  yearLevelId: string;
  weekNumber: number;
  items: TermOverviewClassItem[];
  divergent: boolean;
};

type TermOverviewClassDetail = Omit<TermOverviewClassItem, "supportingClassCount" | "totalClassCount" | "outcomes">;

export type TermOverviewRow = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  cells: TermOverviewCell[];
};

export function deriveTermOverview(planner: PlannerData, termId: string): TermOverviewRow[] {
  const term = planner.terms.find((item) => item.id === termId);
  if (!term) return [];
  const unitById = new Map(planner.units.map((item) => [item.id, item]));
  return teachingWeekStarts(planner, term).map((start, index) => {
    const end = new Date(start.getTime() + 4 * DAY_MS);
    const startDate = localDateKey(start);
    const endDate = localDateKey(end);
    const cells = planner.yearLevels.map((yearLevel) => {
      const classes = planner.classes.filter((item) => item.yearLevelId === yearLevel.id);
      const items = classes.map<TermOverviewClassDetail>((specialistClass) => {
        const recorded = planner.teachingSessions
          .filter((session) => session.classId === specialistClass.id && session.date >= startDate && session.date <= endDate && session.outcome !== "planned")
          .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
        if (recorded) return {
          classId: specialistClass.id,
          className: specialistClass.name,
          unitId: recorded.plannedUnitId,
          unitTitle: recorded.plannedUnitTitle,
          lessonId: recorded.plannedLessonId,
          lessonTitle: recorded.plannedLessonTitle,
          outcome: recorded.outcome,
        };
        const hasScheduledOccurrence = planner.timetableSessions.some((session) => {
          if (session.type !== "specialist-teaching" || session.classId !== specialistClass.id) return false;
          const date = new Date(start);
          const offset = (session.weekday + 6) % 7;
          date.setDate(start.getDate() + offset);
          return localDateKey(date) >= startDate && localDateKey(date) <= endDate && isTeachingDate(planner, date);
        });
        const progress = planner.classProgress[specialistClass.id];
        const unit = unitById.get(progress?.unitId ?? "");
        const lesson = unit?.lessons.find((candidate) => candidate.id === progress?.lessonId);
        return {
          classId: specialistClass.id,
          className: specialistClass.name,
          unitId: unit?.id,
          unitTitle: unit?.title,
          lessonId: lesson?.id,
          lessonTitle: lesson?.title,
          outcome: hasScheduledOccurrence ? "scheduled" : "none",
        };
      });
      const progressGroups = new Map<string, TermOverviewClassDetail[]>();
      for (const item of items) {
        const signature = `${item.unitId ?? ""}:${item.lessonId ?? ""}`;
        progressGroups.set(signature, [...(progressGroups.get(signature) ?? []), item]);
      }
      const referenceSignature = `${yearLevel.currentUnitId ?? ""}:${yearLevel.expectedLessonId ?? ""}`;
      const majorityGroup = [...progressGroups.entries()].sort(([leftKey, left], [rightKey, right]) =>
        right.length - left.length
        || Number(rightKey === referenceSignature) - Number(leftKey === referenceSignature)
        || leftKey.localeCompare(rightKey)
      )[0]?.[1] ?? [];
      const outcomeCounts = new Map<TermOverviewClassDetail["outcome"], number>();
      for (const item of items) outcomeCounts.set(item.outcome, (outcomeCounts.get(item.outcome) ?? 0) + 1);
      const majorityOutcome = [...outcomeCounts.entries()].sort(([leftOutcome, left], [rightOutcome, right]) => right - left || leftOutcome.localeCompare(rightOutcome))[0]?.[0] ?? "none";
      const representative = [...majorityGroup].sort((a, b) => a.className.localeCompare(b.className))[0];
      const yearItem = representative ? [{
        ...representative,
        classId: yearLevel.id,
        className: yearLevel.label,
        outcome: majorityOutcome,
        supportingClassCount: majorityGroup.length,
        totalClassCount: items.length,
        outcomes: [...outcomeCounts.entries()].map(([outcome, count]) => ({ outcome, count })).sort((a, b) => b.count - a.count || a.outcome.localeCompare(b.outcome)),
      }] : [];
      return { yearLevelId: yearLevel.id, weekNumber: index + 1, items: yearItem, divergent: progressGroups.size > 1 };
    });
    return { weekNumber: index + 1, startDate, endDate, cells };
  });
}
