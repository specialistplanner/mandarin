import { localDateKey, type NonTeachingPeriod, type PlannerData, type TeachingSession, type Term } from "./domain.ts";

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

export type TermOverviewAlternative = {
  label: string;
  classCount: number;
};

export type TermOverviewCell = {
  yearLevelId: string;
  weekNumber: number;
  kind: "blank" | "lesson" | "event" | "split";
  unitTitle?: string;
  lessonNumber?: number;
  lessonTitle?: string;
  eventTitle?: string;
  alternatives?: TermOverviewAlternative[];
  divergent: boolean;
  differentClassCount: number;
  evidenceClassCount: number;
  scheduledClassCount: number;
};

export type TermOverviewRow = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  cells: TermOverviewCell[];
};

export type TermOverviewDataset = {
  schoolYearLabel: string;
  termId: string;
  termName: string;
  columns: { id: string; label: string }[];
  rows: TermOverviewRow[];
};

function humanReadableEvent(value: string): string {
  const cleaned = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scheduledDateForWeek(weekStart: Date, weekday: number): string {
  const date = atNoon(weekStart);
  date.setDate(date.getDate() + ((weekday + 6) % 7));
  return localDateKey(date);
}

function latestByClass(sessions: TeachingSession[]): Map<string, TeachingSession> {
  const result = new Map<string, TeachingSession>();
  for (const session of [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt.localeCompare(b.updatedAt))) {
    result.set(session.classId, session);
  }
  return result;
}

function strictMajority<T>(groups: Map<string, T[]>, denominator: number): [string, T[]] | undefined {
  return [...groups.entries()]
    .sort(([leftKey, left], [rightKey, right]) => right.length - left.length || leftKey.localeCompare(rightKey))
    .find(([, values]) => values.length > denominator / 2);
}

function recordedLessonNumber(planner: PlannerData, session: TeachingSession): number | undefined {
  const unit = planner.units.find((item) => item.id === session.plannedUnitId);
  const lesson = unit?.lessons.find((item) => item.id === session.plannedLessonId);
  return lesson?.sequence ?? (unit ? unit.lessons.findIndex((item) => item.id === session.plannedLessonId) + 1 : undefined);
}

function lessonLabel(planner: PlannerData, session: TeachingSession): string {
  const lessonNumber = recordedLessonNumber(planner, session);
  const lessonTitle = lessonNumber ? `L${lessonNumber} · ${session.plannedLessonTitle}` : session.plannedLessonTitle;
  return `${session.plannedUnitTitle} — ${lessonTitle}`;
}

function deriveCell(
  planner: PlannerData,
  term: Term,
  weekStart: Date,
  weekNumber: number,
  yearLevelId: string,
  startDate: string,
  endDate: string,
): TermOverviewCell {
  const classIds = new Set(planner.classes.filter((item) => item.yearLevelId === yearLevelId).map((item) => item.id));
  const scheduled = planner.timetableSessions
    .filter((session) => session.type === "specialist-teaching" && session.classId && classIds.has(session.classId))
    .map((session) => ({ session, date: scheduledDateForWeek(weekStart, session.weekday) }))
    .filter(({ date }) => date >= startDate && date <= endDate && date >= term.startDate && date <= term.endDate);

  const recorded = planner.teachingSessions.filter((session) =>
    session.yearLevelId === yearLevelId
    && session.date >= startDate
    && session.date <= endDate
    && session.outcome !== "planned",
  );
  const scheduledClassIds = new Set([...scheduled.map(({ session }) => session.classId!), ...recorded.map((session) => session.classId)]);
  const taughtByClass = latestByClass(recorded.filter((session) => session.outcome === "completed" || session.outcome === "partial"));
  const eventByClass = new Map<string, string>();

  for (const session of recorded) {
    if (session.outcome !== "not-taught" || taughtByClass.has(session.classId)) continue;
    const reason = humanReadableEvent(session.reason ?? "");
    if (reason) eventByClass.set(session.classId, reason);
  }
  for (const { session, date } of scheduled) {
    if (!session.classId || taughtByClass.has(session.classId) || eventByClass.has(session.classId)) continue;
    const period = nonTeachingPeriodForDate(planner, date);
    if (period?.name.trim()) eventByClass.set(session.classId, humanReadableEvent(period.name));
  }

  const eventGroups = new Map<string, string[]>();
  for (const [classId, event] of eventByClass) eventGroups.set(event, [...(eventGroups.get(event) ?? []), classId]);
  const eventMajority = strictMajority(eventGroups, scheduledClassIds.size);
  if (eventMajority) {
    const [eventTitle, supportingClasses] = eventMajority;
    return {
      yearLevelId, weekNumber, kind: "event", eventTitle,
      divergent: supportingClasses.length < scheduledClassIds.size,
      differentClassCount: Math.max(0, scheduledClassIds.size - supportingClasses.length),
      evidenceClassCount: new Set([...taughtByClass.keys(), ...eventByClass.keys()]).size,
      scheduledClassCount: scheduledClassIds.size,
    };
  }

  const lessonGroups = new Map<string, TeachingSession[]>();
  for (const session of taughtByClass.values()) {
    const signature = `${session.plannedUnitId}:${session.plannedLessonId}`;
    lessonGroups.set(signature, [...(lessonGroups.get(signature) ?? []), session]);
  }
  const lessonMajority = strictMajority(lessonGroups, taughtByClass.size);
  if (lessonMajority) {
    const [, supportingSessions] = lessonMajority;
    const representative = supportingSessions[0];
    return {
      yearLevelId, weekNumber, kind: "lesson",
      unitTitle: representative.plannedUnitTitle,
      lessonNumber: recordedLessonNumber(planner, representative),
      lessonTitle: representative.plannedLessonTitle,
      divergent: supportingSessions.length < scheduledClassIds.size || lessonGroups.size > 1 || eventByClass.size > 0,
      differentClassCount: Math.max(0, scheduledClassIds.size - supportingSessions.length),
      evidenceClassCount: new Set([...taughtByClass.keys(), ...eventByClass.keys()]).size,
      scheduledClassCount: scheduledClassIds.size,
    };
  }

  const alternatives: TermOverviewAlternative[] = [
    ...[...lessonGroups.values()].map((sessions) => ({ label: lessonLabel(planner, sessions[0]), classCount: sessions.length })),
    ...[...eventGroups.entries()].map(([label, classes]) => ({ label, classCount: classes.length })),
  ].sort((a, b) => b.classCount - a.classCount || a.label.localeCompare(b.label));
  const evidenceClassCount = new Set([...taughtByClass.keys(), ...eventByClass.keys(), ...recorded.map((session) => session.classId)]).size;
  if (evidenceClassCount > 0) {
    return {
      yearLevelId, weekNumber, kind: "split", alternatives,
      divergent: true,
      differentClassCount: Math.max(0, scheduledClassIds.size - (alternatives[0]?.classCount ?? 0)),
      evidenceClassCount,
      scheduledClassCount: scheduledClassIds.size,
    };
  }

  return {
    yearLevelId, weekNumber, kind: "blank", divergent: false,
    differentClassCount: 0, evidenceClassCount: 0, scheduledClassCount: scheduledClassIds.size,
  };
}

export function termOverviewCellText(cell: TermOverviewCell): string {
  if (cell.kind === "lesson") {
    const lesson = cell.lessonTitle ? `${cell.lessonNumber ? `L${cell.lessonNumber} · ` : ""}${cell.lessonTitle}` : "";
    return [cell.unitTitle, lesson].filter(Boolean).join(" — ");
  }
  if (cell.kind === "event") return cell.eventTitle ?? "";
  if (cell.kind === "split") return cell.alternatives?.length
    ? `Split: ${cell.alternatives.map((item) => item.label).join(" | ")}`
    : "Mixed teaching week";
  return "";
}

export function deriveTermOverviewDataset(planner: PlannerData, termId: string): TermOverviewDataset {
  const term = planner.terms.find((item) => item.id === termId);
  const schoolYear = term ? planner.schoolYears.find((item) => item.id === term.schoolYearId) : undefined;
  const columns = planner.yearLevels.map((level) => ({ id: level.id, label: level.label }));
  if (!term) return { schoolYearLabel: schoolYear?.label ?? "", termId, termName: "", columns, rows: [] };
  const rows = teachingWeekStarts(planner, term).map((start, index) => {
    const end = new Date(start.getTime() + 4 * DAY_MS);
    const startDate = localDateKey(start);
    const endDate = localDateKey(end);
    return {
      weekNumber: index + 1,
      startDate,
      endDate,
      cells: planner.yearLevels.map((yearLevel) => deriveCell(planner, term, start, index + 1, yearLevel.id, startDate, endDate)),
    };
  });
  return { schoolYearLabel: schoolYear?.label ?? "", termId: term.id, termName: term.name, columns, rows };
}

export function deriveTermOverview(planner: PlannerData, termId: string): TermOverviewRow[] {
  return deriveTermOverviewDataset(planner, termId).rows;
}
