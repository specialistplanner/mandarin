import { GENERALIST_COVER_MIGRATION_KEY } from "./generalist-cover-migration.ts";
import { LIVE_TRIAL_WEEK_RESET_KEY } from "./live-trial-week-reset.ts";

export const SESSION_ONE_LABEL_MIGRATION_KEY = "specialist-planner.session-label.s1.v1";

type MigrationMarkerStorage = Pick<Storage, "setItem">;

export function markOneTimeMigrationsApplied(storage: MigrationMarkerStorage) {
  storage.setItem(LIVE_TRIAL_WEEK_RESET_KEY, "applied");
  storage.setItem(SESSION_ONE_LABEL_MIGRATION_KEY, "applied");
  storage.setItem(GENERALIST_COVER_MIGRATION_KEY, "applied");
}
