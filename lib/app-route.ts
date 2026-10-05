export const SETTINGS_SECTIONS = ["program", "cohorts", "timetable", "calendar", "holidays", "notes", "data", "account"] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number];

export type AppRoute =
  | { view: "week" }
  | { view: "units"; unitId?: string }
  | { view: "term"; section: "overview" | "progress" }
  | { view: "settings"; section: SettingsSection };

const settingsSlugBySection: Record<SettingsSection, string> = {
  program: "program",
  cohorts: "classes",
  timetable: "timetable",
  calendar: "school-year-and-terms",
  holidays: "holidays",
  notes: "notes",
  data: "backup-and-restore",
  account: "account",
};

const settingsSectionBySlug = Object.fromEntries(
  Object.entries(settingsSlugBySection).map(([section, slug]) => [slug, section]),
) as Record<string, SettingsSection>;

export function appRouteHash(route: AppRoute): string {
  if (route.view === "week") return "#/week";
  if (route.view === "units") return route.unitId ? `#/units/${encodeURIComponent(route.unitId)}` : "#/units";
  if (route.view === "term") return route.section === "progress" ? "#/progress" : "#/term-overview";
  return `#/settings/${settingsSlugBySection[route.section]}`;
}

export function parseAppRoute(hash: string, validUnitIds?: ReadonlySet<string>): AppRoute {
  const raw = hash.replace(/^#/, "").replace(/^\/+/, "");
  if (!raw) return { view: "week" };
  let segments: string[];
  try {
    segments = raw.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    return { view: "week" };
  }
  if (segments.length === 1 && segments[0] === "week") return { view: "week" };
  if (segments.length === 1 && segments[0] === "progress") return { view: "term", section: "progress" };
  if (segments.length === 1 && segments[0] === "term-overview") return { view: "term", section: "overview" };
  if (segments[0] === "units") {
    if (segments.length === 1) return { view: "units" };
    if (segments.length === 2 && (!validUnitIds || validUnitIds.has(segments[1]))) return { view: "units", unitId: segments[1] };
    return { view: "units" };
  }
  if (segments[0] === "settings") {
    if (segments.length === 1) return { view: "settings", section: "program" };
    const section = segments.length === 2 ? settingsSectionBySlug[segments[1]] : undefined;
    return { view: "settings", section: section ?? "program" };
  }
  return { view: "week" };
}

export function sameAppRoute(left: AppRoute, right: AppRoute): boolean {
  return appRouteHash(left) === appRouteHash(right);
}
