# Changelog

## v0.5.1 — 2026-09-06

### Fixed

- Treat a successfully imported backup as the authoritative Planner snapshot on a new browser origin.
- Record one-time migration markers after import or deliberate initialisation so a later refresh cannot reapply classroom-specific corrections to restored data.

### Deployment

- Add a static Vite build with the `/mandarin/` base path and a GitHub Actions Pages deployment workflow.
- Set the independent production identity to `https://specialistplanner.github.io/mandarin/`.

This is a data-migration safety hotfix. It does not change the classroom workflow or add product features.

## v0.5.0 — 2026-09-05

### Added

- Progress-aware weekly teaching planner with a shared session-time axis.
- Individual, accessible class-recognition colours.
- Teaching Session outcomes: Completed, Partial and Not taught.
- Teaching History with multi-class filtering.
- Optional Unit Library links for Planner Units and Lessons.
- Complete validated JSON backup and restore for local Planner state.
- Generalist Teaching context that remains isolated from specialist progress.

### Changed

- Week is the primary day-to-day teaching workspace.
- Progress is the cohort-level diagnostic view while class Unit/Lesson positions remain independent.
- Timetable and progress operate through the shared Teaching Session model.
- Unit Library choices synchronize from the live read-only index with a published snapshot fallback.
- Trial-facing interface wording has been replaced with stable production terminology; existing Notes data is retained.

### Fixed

- Reconciled historical classroom progress without double-advancing current positions.
- Prevented historical reconstruction, repeated rendering and repeated saves from advancing progress more than once.
- Preserved independent cross-Unit class progress.
- Preserved lesson identity through title edits and sequence changes.
- Corrected timetable/session alignment and compact Week cards.
- Kept Unit Library availability and resource changes independent from progress.
- Stopped unreadable current storage from silently falling back to and overwriting with older data; added an explicit backup-recovery path.

### Release boundary

v0.5.x is the stable single-teacher Specialist Planner. Shared Programs, co-teaching, CRT access, role permissions, cloud sync and multi-teacher collaboration are deferred to future major development.
