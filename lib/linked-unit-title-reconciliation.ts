/**
 * Transitional TMR compatibility logic.
 *
 * Specialist Planner is the operational authority for Program Units, Lessons,
 * progress and history. This module only reconciles display titles for records
 * that already carry stable TMR identities. It must remain isolated so it can
 * be retired when Unit/Lesson authoring authority moves fully into Planner.
 *
 * It deliberately never inserts, deletes or reorders Lessons and never touches
 * progress, baselines, checkpoints, Teaching Sessions or historical snapshots.
 */
import { touchPlanner, type ExternalResourceRef, type PlannerData, type Unit } from "./domain.ts";
import { UNIT_LIBRARY_PROVIDER, type UnitLibraryIndex, type UnitLibraryUnit } from "./unit-library.ts";

export type LinkedTitleReconciliationMode = "dry-run" | "automatic" | "approved-bootstrap";

export type LinkedTitleDifference = {
  target: "unit" | "lesson";
  spId: string;
  externalId: string;
  field: "title";
  oldValue: string;
  newValue: string;
  classification: "safe" | "bootstrap";
  wouldApply: boolean;
};

export type LinkedTitleConflict = {
  target: "unit" | "lesson";
  spId: string;
  externalId: string;
  currentValue: string;
  lastSyncedValue: string;
  externalValue: string;
};

export type LinkedStructuralDifference = {
  kind: "external-unit-missing" | "external-lesson-added" | "external-lesson-deleted" | "external-lesson-moved" | "external-lessons-reordered" | "duplicate-external-mapping";
  spUnitId: string;
  externalUnitId: string;
  spLessonId?: string;
  externalLessonId?: string;
  detail: string;
};

export type LinkedUnmappedItem = {
  target: "unit" | "lesson";
  spId: string;
  detail: string;
};

export type LinkedUnitReconciliationReport = {
  spUnitId: string;
  externalUnitId: string;
  spTitle: string;
  externalTitle?: string;
  chineseTitle: { programStoresField: false; externalProvidesValue: boolean; externalValue?: string };
  titleDifferences: LinkedTitleDifference[];
  titleConflicts: LinkedTitleConflict[];
  structuralDifferences: LinkedStructuralDifference[];
  unmappedItems: LinkedUnmappedItem[];
  baselinesToInitialize: Array<{ target: "unit" | "lesson"; spId: string; externalId: string; value: string }>;
  unchangedTitles: Array<{ target: "unit" | "lesson"; spId: string; externalId: string; value: string }>;
  writesBlockedByStructure: boolean;
};

export type LinkedTitleReconciliationReport = {
  sourceAvailable: boolean;
  mode: LinkedTitleReconciliationMode;
  linkedUnitCount: number;
  changed: boolean;
  units: LinkedUnitReconciliationReport[];
};

export type LinkedTitleReconciliationResult = {
  planner: PlannerData;
  changed: boolean;
  report: LinkedTitleReconciliationReport;
};

function linkedUnit(unit: Unit): boolean {
  return unit.externalResourceRef?.provider === UNIT_LIBRARY_PROVIDER
    && unit.externalResourceRef.resourceType === "unit";
}

function titleDecision(args: {
  target: "unit" | "lesson";
  spId: string;
  reference: ExternalResourceRef;
  currentValue: string;
  externalValue: string;
  mode: LinkedTitleReconciliationMode;
}): {
  difference?: LinkedTitleDifference;
  conflict?: LinkedTitleConflict;
  baseline?: { target: "unit" | "lesson"; spId: string; externalId: string; value: string };
  unchanged?: { target: "unit" | "lesson"; spId: string; externalId: string; value: string };
  shouldApply: boolean;
} {
  const { target, spId, reference, currentValue, externalValue, mode } = args;
  const lastSynced = reference.lastSyncedTitle;
  const externalId = reference.resourceId;

  if (!lastSynced) {
    const baseline = { target, spId, externalId, value: externalValue };
    if (currentValue === externalValue) {
      return {
        baseline,
        unchanged: { target, spId, externalId, value: currentValue },
        shouldApply: mode === "approved-bootstrap",
      };
    }
    return {
      baseline,
      difference: {
        target,
        spId,
        externalId,
        field: "title",
        oldValue: currentValue,
        newValue: externalValue,
        classification: "bootstrap",
        wouldApply: mode === "approved-bootstrap",
      },
      shouldApply: mode === "approved-bootstrap",
    };
  }

  if (currentValue !== lastSynced && currentValue !== externalValue) {
    return {
      conflict: { target, spId, externalId, currentValue, lastSyncedValue: lastSynced, externalValue },
      shouldApply: false,
    };
  }

  if (currentValue === externalValue) {
    return {
      unchanged: { target, spId, externalId, value: currentValue },
      shouldApply: reference.label !== externalValue || lastSynced !== externalValue,
    };
  }

  return {
    difference: {
      target,
      spId,
      externalId,
      field: "title",
      oldValue: currentValue,
      newValue: externalValue,
      classification: "safe",
      wouldApply: mode !== "dry-run",
    },
    shouldApply: mode !== "dry-run",
  };
}

function updatedReference(reference: ExternalResourceRef, externalTitle: string, url: string): ExternalResourceRef {
  return { ...reference, label: externalTitle, lastSyncedTitle: externalTitle, url };
}

function externalLessonLocations(index: UnitLibraryIndex): Map<string, UnitLibraryUnit[]> {
  const locations = new Map<string, UnitLibraryUnit[]>();
  for (const unit of index.units) for (const lesson of unit.lessons) {
    const current = locations.get(lesson.id) ?? [];
    current.push(unit);
    locations.set(lesson.id, current);
  }
  return locations;
}

export function reconcileLinkedUnitTitles(
  planner: PlannerData,
  index: UnitLibraryIndex | null,
  options: { mode: LinkedTitleReconciliationMode; sourceAvailable: boolean },
): LinkedTitleReconciliationResult {
  const linkedUnits = planner.units.filter(linkedUnit);
  const emptyReport: LinkedTitleReconciliationReport = {
    sourceAvailable: options.sourceAvailable,
    mode: options.mode,
    linkedUnitCount: linkedUnits.length,
    changed: false,
    units: [],
  };
  if (!options.sourceAvailable || !index) return { planner, changed: false, report: emptyReport };

  const lessonLocations = externalLessonLocations(index);
  const reports: LinkedUnitReconciliationReport[] = [];
  let anyChange = false;
  const nextUnits = planner.units.map((unit) => {
    if (!linkedUnit(unit)) return unit;
    const unitRef = unit.externalResourceRef!;
    const externalUnit = index.units.find((candidate) => candidate.id === unitRef.resourceId);
    const report: LinkedUnitReconciliationReport = {
      spUnitId: unit.id,
      externalUnitId: unitRef.resourceId,
      spTitle: unit.title,
      externalTitle: externalUnit?.title,
      chineseTitle: {
        programStoresField: false,
        externalProvidesValue: Boolean(externalUnit?.chineseTitle),
        ...(externalUnit?.chineseTitle ? { externalValue: externalUnit.chineseTitle } : {}),
      },
      titleDifferences: [],
      titleConflicts: [],
      structuralDifferences: [],
      unmappedItems: [],
      baselinesToInitialize: [],
      unchangedTitles: [],
      writesBlockedByStructure: false,
    };
    reports.push(report);
    if (!externalUnit) {
      report.structuralDifferences.push({
        kind: "external-unit-missing",
        spUnitId: unit.id,
        externalUnitId: unitRef.resourceId,
        detail: "The linked external Unit is absent from the available live index.",
      });
      report.writesBlockedByStructure = true;
      return unit;
    }

    const mappedLessonIds: string[] = [];
    const mappingCounts = new Map<string, number>();
    for (const lesson of unit.lessons) {
      const reference = lesson.externalResourceRef;
      if (!reference || reference.provider !== UNIT_LIBRARY_PROVIDER || reference.resourceType !== "lesson" || reference.parentResourceId !== unitRef.resourceId) {
        report.unmappedItems.push({ target: "lesson", spId: lesson.id, detail: "No stable TMR Lesson identity under this linked Unit." });
        continue;
      }
      mappedLessonIds.push(reference.resourceId);
      mappingCounts.set(reference.resourceId, (mappingCounts.get(reference.resourceId) ?? 0) + 1);
      const externalLesson = externalUnit.lessons.find((candidate) => candidate.id === reference.resourceId);
      if (!externalLesson) {
        const locations = lessonLocations.get(reference.resourceId) ?? [];
        report.structuralDifferences.push({
          kind: locations.length ? "external-lesson-moved" : "external-lesson-deleted",
          spUnitId: unit.id,
          externalUnitId: unitRef.resourceId,
          spLessonId: lesson.id,
          externalLessonId: reference.resourceId,
          detail: locations.length
            ? `The external Lesson now appears under ${locations.map((candidate) => candidate.id).join(", ")}.`
            : "The mapped external Lesson is absent from the available live index.",
        });
      }
    }
    for (const [externalLessonId, count] of mappingCounts) if (count > 1) {
      report.structuralDifferences.push({
        kind: "duplicate-external-mapping",
        spUnitId: unit.id,
        externalUnitId: unitRef.resourceId,
        externalLessonId,
        detail: `${count} SP Lessons map to the same external Lesson identity.`,
      });
    }
    const mappedSet = new Set(mappedLessonIds);
    const allSpLessonsHaveStableMappings = unit.lessons.length > 0 && mappedLessonIds.length === unit.lessons.length;
    // An unlinked external Lesson is only a proven addition when every SP
    // Lesson already has a stable source identity. Legacy Unit-only links do
    // not provide enough evidence to classify external Lessons as newly added.
    for (const externalLesson of externalUnit.lessons) if (allSpLessonsHaveStableMappings && !mappedSet.has(externalLesson.id)) {
      report.structuralDifferences.push({
        kind: "external-lesson-added",
        spUnitId: unit.id,
        externalUnitId: unitRef.resourceId,
        externalLessonId: externalLesson.id,
        detail: "The external Lesson is not present in the SP active sequence and was not inserted.",
      });
    }
    const externalMappedOrder = externalUnit.lessons.map((lesson) => lesson.id).filter((id) => mappedSet.has(id));
    const spMappedOrder = mappedLessonIds.filter((id) => externalUnit.lessons.some((lesson) => lesson.id === id));
    if (externalMappedOrder.length === spMappedOrder.length && externalMappedOrder.some((id, indexAt) => id !== spMappedOrder[indexAt])) {
      report.structuralDifferences.push({
        kind: "external-lessons-reordered",
        spUnitId: unit.id,
        externalUnitId: unitRef.resourceId,
        detail: "The external Lesson order differs; the SP sequence was not reordered.",
      });
    }
    report.writesBlockedByStructure = report.structuralDifferences.length > 0 || report.unmappedItems.length > 0;

    const unitDecision = titleDecision({
      target: "unit",
      spId: unit.id,
      reference: unitRef,
      currentValue: unit.title,
      externalValue: externalUnit.title,
      mode: options.mode,
    });
    if (unitDecision.difference) report.titleDifferences.push(unitDecision.difference);
    if (unitDecision.conflict) report.titleConflicts.push(unitDecision.conflict);
    if (unitDecision.baseline) report.baselinesToInitialize.push(unitDecision.baseline);
    if (unitDecision.unchanged) report.unchangedTitles.push(unitDecision.unchanged);

    const lessonDecisions = unit.lessons.map((lesson) => {
      const reference = lesson.externalResourceRef;
      if (!reference || reference.provider !== UNIT_LIBRARY_PROVIDER || reference.resourceType !== "lesson" || reference.parentResourceId !== unitRef.resourceId) return null;
      const externalLesson = externalUnit.lessons.find((candidate) => candidate.id === reference.resourceId);
      if (!externalLesson || (mappingCounts.get(reference.resourceId) ?? 0) !== 1) return null;
      const decision = titleDecision({
        target: "lesson",
        spId: lesson.id,
        reference,
        currentValue: lesson.title,
        externalValue: externalLesson.title,
        mode: options.mode,
      });
      if (decision.difference) report.titleDifferences.push(decision.difference);
      if (decision.conflict) report.titleConflicts.push(decision.conflict);
      if (decision.baseline) report.baselinesToInitialize.push(decision.baseline);
      if (decision.unchanged) report.unchangedTitles.push(decision.unchanged);
      return { lesson, externalLesson, decision };
    });

    if (options.mode === "dry-run") return unit;
    let unitChanged = false;
    let nextUnit = unit;
    if (!unitDecision.conflict && unitDecision.shouldApply) {
      nextUnit = {
        ...nextUnit,
        title: externalUnit.title,
        externalResourceRef: updatedReference(unitRef, externalUnit.title, externalUnit.url),
      };
      unitChanged = true;
    }
    const nextLessons = unit.lessons.map((lesson, lessonIndex) => {
      const linked = lessonDecisions[lessonIndex];
      if (report.writesBlockedByStructure || !linked || linked.decision.conflict || !linked.decision.shouldApply) return lesson;
      unitChanged = true;
      return {
        ...lesson,
        title: linked.externalLesson.title,
        externalResourceRef: updatedReference(lesson.externalResourceRef!, linked.externalLesson.title, linked.externalLesson.url),
      };
    });
    if (!unitChanged) return unit;
    anyChange = true;
    return { ...nextUnit, lessons: nextLessons };
  });

  const nextPlanner = anyChange ? touchPlanner({ ...planner, units: nextUnits }) : planner;
  const report = { ...emptyReport, changed: anyChange, units: reports };
  return { planner: nextPlanner, changed: anyChange, report };
}
