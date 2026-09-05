# Specialist Planner v0.5.0

Specialist Planner is a local-first, progress-aware weekly planner for a single specialist teacher. The v0.5.0 release establishes the stable classroom workflow: plan from Week, record what happened, review class-specific Progress, and rely on History for confirmed outcomes.

## Core views

- **Week** is the primary teaching workspace. It combines the Monday–Friday timetable, shared session times, class identity colours, Unit and Lesson context, progress exceptions, and Completed, Partial or Not taught outcomes.
- **Progress** compares each class’s actual Unit and next Lesson with its cohort reference while preserving independent positions for classes in different Units.
- **Units** manages local Unit and Lesson sequences plus optional read-only links to the Unit Library.
- **History** lists confirmed outcomes with saved Unit/Lesson snapshots, notes and reasons, with multi-class filtering.
- **Settings** manages cohorts, classes, timetable/session times, internal Notes, reconciliation, backup and deliberate reset actions.

## Teaching outcomes

- **Completed** advances the affected class exactly once.
- **Partial** records where teaching stopped without advancing progress.
- **Not taught** records the reason without advancing progress.
- Non-specialist timetable entries never affect specialist progress. Generalist Teaching is shown as teaching context only.

## Unit Library

Planner Units and Lessons can optionally link to the independent [The Mandarin Room Unit Library](https://themandarinroom.github.io/units/). Planner owns timetable, outcomes and progress; Unit Library owns teaching content. Missing or unavailable Library resources do not prevent Week, Progress, History or outcome recording from working.

## Local storage and backup

Planner state is stored in this browser under `specialist-planner.data.v9`. JSON export/import is the complete backup format, preserving subjects, cohorts, Units, Lessons, class progress, checkpoints, timetable and session times, class colours, confirmed Teaching Sessions, History snapshots, resource references, Notes and reconciliation metadata. Import is validated before replacing current data. If current storage cannot be read, Planner preserves it and opens a deliberate backup-recovery screen instead of silently loading older data.

## Current limitations

v0.5.x is a stable single-teacher, single-subject, device-and-browser-local Planner. It does not provide accounts, cross-device cloud sync, multi-teacher collaboration, co-teaching, CRT workflows, curriculum integration, reports, analytics or notifications. Those remain outside the v0.5 release boundary.

## Run and verify

```bash
npm install
npm test
npm run lint
```

See [`dashboard/README.md`](dashboard/README.md) for the data contract, integration boundary and resilience details.
