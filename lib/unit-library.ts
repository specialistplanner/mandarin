import type { ExternalResourceRef } from "./domain.ts";

export const UNIT_LIBRARY_PROVIDER = "the-mandarin-room-unit-library";
export const UNIT_LIBRARY_BASE_URL = "https://themandarinroom.github.io/units";
export const UNIT_LIBRARY_INDEX_URL = `${UNIT_LIBRARY_BASE_URL}/unit-library-index.json`;
export const UNIT_LIBRARY_LIVE_INDEX_URL = "https://australia-southeast1-the-mandarin-room.cloudfunctions.net/unitLibraryIndex";

export type UnitLibraryLesson = { id: string; title: string; url: string };
export type UnitLibraryUnit = { id: string; yearLevel: number; title: string; url: string; lessons: UnitLibraryLesson[] };
export type UnitLibraryIndex = { schemaVersion: 1; provider: typeof UNIT_LIBRARY_PROVIDER; generatedAt: string; units: UnitLibraryUnit[] };

export function unitLibraryDeepLink(unitId: string, lessonId?: string): string {
  const params = new URLSearchParams({ unit: unitId });
  if (lessonId) params.set("lesson", lessonId);
  return `${UNIT_LIBRARY_BASE_URL}/view.html?${params.toString()}`;
}

export function unitReference(unit: UnitLibraryUnit): ExternalResourceRef {
  return { provider: UNIT_LIBRARY_PROVIDER, resourceType: "unit", resourceId: unit.id, label: unit.title, url: unit.url };
}

export function lessonReference(unit: UnitLibraryUnit, lesson: UnitLibraryLesson): ExternalResourceRef {
  return { provider: UNIT_LIBRARY_PROVIDER, resourceType: "lesson", resourceId: lesson.id, parentResourceId: unit.id, label: lesson.title, url: lesson.url };
}

export function referenceDeepLink(reference: ExternalResourceRef): string | null {
  if (reference.provider !== UNIT_LIBRARY_PROVIDER) return null;
  if (reference.url) return reference.url;
  return reference.resourceType === "unit"
    ? unitLibraryDeepLink(reference.resourceId)
    : reference.parentResourceId ? unitLibraryDeepLink(reference.parentResourceId, reference.resourceId) : null;
}

export function parseUnitLibraryIndex(value: unknown): UnitLibraryIndex {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unit Library index is invalid.");
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || candidate.provider !== UNIT_LIBRARY_PROVIDER || typeof candidate.generatedAt !== "string" || !Array.isArray(candidate.units)) {
    throw new Error("Unit Library index is incompatible.");
  }
  const units = candidate.units.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Unit Library Unit is invalid.");
    const unit = item as Record<string, unknown>;
    if (typeof unit.id !== "string" || !unit.id || typeof unit.title !== "string" || !unit.title || !Number.isInteger(unit.yearLevel) || !Array.isArray(unit.lessons)) throw new Error("Unit Library Unit is invalid.");
    const lessons = unit.lessons.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Unit Library Lesson is invalid.");
      const lesson = entry as Record<string, unknown>;
      if (typeof lesson.id !== "string" || !lesson.id || typeof lesson.title !== "string" || !lesson.title || typeof lesson.url !== "string" || !lesson.url.startsWith("https://")) throw new Error("Unit Library Lesson is invalid.");
      return { id: lesson.id, title: lesson.title, url: lesson.url };
    });
    if (typeof unit.url !== "string" || !unit.url.startsWith("https://")) throw new Error("Unit Library Unit URL is invalid.");
    return { id: unit.id, yearLevel: Number(unit.yearLevel), title: unit.title, url: unit.url, lessons };
  });
  return { schemaVersion: 1, provider: UNIT_LIBRARY_PROVIDER, generatedAt: candidate.generatedAt, units };
}

export type UnitLibraryIndexSource = "live" | "snapshot";

export async function fetchUnitLibraryIndexWithSource(signal?: AbortSignal): Promise<{ index: UnitLibraryIndex; source: UnitLibraryIndexSource }> {
  let lastError: unknown;
  for (const [source, url] of [["live", UNIT_LIBRARY_LIVE_INDEX_URL], ["snapshot", UNIT_LIBRARY_INDEX_URL]] as const) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal });
      if (!response.ok) throw new Error(`Unit Library returned ${response.status}.`);
      return { index: parseUnitLibraryIndex(await response.json()), source };
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error("Unit Library is unavailable.");
}

export async function fetchUnitLibraryIndex(signal?: AbortSignal): Promise<UnitLibraryIndex> {
  return (await fetchUnitLibraryIndexWithSource(signal)).index;
}

export function findLinkedUnit(index: UnitLibraryIndex | null, reference: ExternalResourceRef | undefined) {
  return reference?.provider === UNIT_LIBRARY_PROVIDER && reference.resourceType === "unit"
    ? index?.units.find((unit) => unit.id === reference.resourceId)
    : undefined;
}

export function findLinkedLesson(index: UnitLibraryIndex | null, reference: ExternalResourceRef | undefined) {
  if (!reference || reference.provider !== UNIT_LIBRARY_PROVIDER || reference.resourceType !== "lesson" || !reference.parentResourceId) return undefined;
  return index?.units.find((unit) => unit.id === reference.parentResourceId)?.lessons.find((lesson) => lesson.id === reference.resourceId);
}

export function resolveLinkedLessonReference(
  index: UnitLibraryIndex | null,
  unitRef: ExternalResourceRef | undefined,
  lessonRef: ExternalResourceRef | undefined,
  lessonNumber: number | undefined,
): ExternalResourceRef | undefined {
  if (lessonRef?.provider === UNIT_LIBRARY_PROVIDER && lessonRef.resourceType === "lesson") return lessonRef;
  if (!lessonNumber || lessonNumber < 1) return undefined;
  const linkedUnit = findLinkedUnit(index, unitRef);
  const linkedLesson = linkedUnit?.lessons[lessonNumber - 1];
  return linkedUnit && linkedLesson ? lessonReference(linkedUnit, linkedLesson) : undefined;
}
