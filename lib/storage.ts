import type { ProgressMap } from "./domain";

export const STORAGE_KEY = "specialist-planner.dashboard.progress.v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function restoreProgress(
  storage: StorageLike,
  fallback: ProgressMap,
): ProgressMap {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...fallback };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...fallback };
    }

    const restored = { ...fallback };
    for (const [classId, value] of Object.entries(parsed)) {
      if (classId in fallback && Number.isInteger(value) && Number(value) > 0) {
        restored[classId] = Number(value);
      }
    }
    return restored;
  } catch {
    return { ...fallback };
  }
}

export function persistProgress(storage: StorageLike, progress: ProgressMap) {
  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
