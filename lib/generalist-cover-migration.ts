import { touchPlanner, type PlannerData } from "./domain.ts";

export const GENERALIST_COVER_MIGRATION_KEY = "specialist-planner.generalist-cover.v1";

export function migrateClassCoverToGeneralistTeaching(planner: PlannerData): { planner: PlannerData; applied: boolean } {
  const matchingIds = new Set(
    planner.timetableSessions
      .filter((session) => session.type === "cover-release" && session.label?.trim().toLocaleLowerCase() === "class cover")
      .map((session) => session.id),
  );
  if (!matchingIds.size) return { planner, applied: false };
  return {
    planner: touchPlanner({
      ...planner,
      timetableSessions: planner.timetableSessions.map((session) => matchingIds.has(session.id)
        ? { ...session, type: "generalist-teaching" }
        : session),
    }),
    applied: true,
  };
}
