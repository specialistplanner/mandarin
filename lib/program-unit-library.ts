import { unitAppliesToYearLevel, type PlannerData, type Unit, type YearLevel } from "./domain.ts";

export type ProgramUnitLibraryColumn = {
  yearLevel: YearLevel;
  units: Unit[];
};

/**
 * Presentation-only grouping for the Program-owned Unit Library. The returned
 * arrays are copies, so alphabetical display sorting never mutates curriculum
 * sequence or the authoritative Program document.
 */
export function buildProgramUnitLibraryColumns(planner: PlannerData): ProgramUnitLibraryColumn[] {
  return planner.yearLevels.map((yearLevel) => ({
    yearLevel,
    units: planner.units
      .filter((unit) => unitAppliesToYearLevel(unit, yearLevel.id))
      .slice()
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" })),
  }));
}
