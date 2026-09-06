import type { PlannerData } from "./domain.ts";
import { isProgramSubjectType, type ProgramSubjectType } from "./cloud-program.ts";
import { validatePlannerData } from "./storage.ts";

export const CLOUD_CACHE_SCHEMA_VERSION = 1 as const;
export const CLOUD_CACHE_PREFIX = "specialist-planner.cloud-cache.v1";
export const CLOUD_MIGRATION_PREFIX = "specialist-planner.cloud-migration.v1";

export type CloudPendingOperation = {
  mutationId: string;
  expectedRevision: number;
  planner: PlannerData;
};

export type CloudCache = {
  schemaVersion: typeof CLOUD_CACHE_SCHEMA_VERSION;
  uid: string;
  programId: string;
  programName: string;
  subjectType: ProgramSubjectType;
  customSubjectName?: string;
  revision: number;
  planner: PlannerData;
  pending: boolean;
  mutationId?: string;
  pendingOperation?: CloudPendingOperation;
  savedAt: string;
};

type CacheStorage = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>;

export function cloudCacheKey(uid: string): string {
  return `${CLOUD_CACHE_PREFIX}.${uid}`;
}

export function migrationIntentKey(uid: string): string {
  return `${CLOUD_MIGRATION_PREFIX}.${uid}`;
}

export function readCloudCache(storage: CacheStorage, uid: string): CloudCache | null {
  try {
    const raw = storage.getItem(cloudCacheKey(uid));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CloudCache>;
    if (value.schemaVersion !== CLOUD_CACHE_SCHEMA_VERSION || value.uid !== uid || typeof value.programId !== "string" || !value.programId || typeof value.programName !== "string" || !value.programName || !isProgramSubjectType(value.subjectType) || !Number.isInteger(value.revision) || Number(value.revision) < 1 || typeof value.pending !== "boolean" || typeof value.savedAt !== "string") return null;
    let pendingOperation: CloudPendingOperation | undefined;
    if (value.pendingOperation !== undefined) {
      const operation = value.pendingOperation as Partial<CloudPendingOperation>;
      if (typeof operation.mutationId !== "string" || !operation.mutationId || !Number.isInteger(operation.expectedRevision) || Number(operation.expectedRevision) < 1) return null;
      pendingOperation = { mutationId: operation.mutationId, expectedRevision: Number(operation.expectedRevision), planner: validatePlannerData(operation.planner) };
    }
    return { ...value, revision: Number(value.revision), planner: validatePlannerData(value.planner), ...(pendingOperation ? { pendingOperation } : {}) } as CloudCache;
  } catch {
    return null;
  }
}

export function writeCloudCache(storage: CacheStorage, cache: Omit<CloudCache, "schemaVersion" | "savedAt">): CloudCache {
  const validated: CloudCache = {
    ...cache,
    schemaVersion: CLOUD_CACHE_SCHEMA_VERSION,
    planner: validatePlannerData(cache.planner),
    ...(cache.pendingOperation ? { pendingOperation: { ...cache.pendingOperation, planner: validatePlannerData(cache.pendingOperation.planner) } } : {}),
    savedAt: new Date().toISOString(),
  };
  storage.setItem(cloudCacheKey(cache.uid), JSON.stringify(validated));
  return validated;
}

export function migrationProgramId(storage: CacheStorage, uid: string): string {
  const key = migrationIntentKey(uid);
  const existing = storage.getItem(key);
  if (existing && /^[A-Za-z0-9_-]{8,120}$/.test(existing)) return existing;
  const id = `program-${crypto.randomUUID()}`;
  storage.setItem(key, id);
  return id;
}

export function finishMigrationIntent(storage: CacheStorage, uid: string) {
  storage.removeItem?.(migrationIntentKey(uid));
}
