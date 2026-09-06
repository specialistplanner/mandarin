# Specialist Planner v0.5.1

Specialist Planner is a local-first, progress-aware weekly planner for a single specialist teacher. v0.5.1 retains the stable v0.5.0 classroom workflow and adds a migration-safety hotfix for authoritative backup restores on a new browser origin.

## Production

The independent production site is:

**https://specialistplanner.github.io/mandarin/**

Production is built from `main` by [the GitHub Pages workflow](.github/workflows/pages.yml). Vite emits a static site to `dist-pages` using the required `/mandarin/` base path, and GitHub Actions deploys that artifact. The application has one client-side page, so bookmarking or refreshing the production URL does not depend on a server-side route fallback.

The former `chatgpt.site` deployment is a temporary migration reference only. It is not the production identity and should remain available until the imported data has been checked on the independent site.

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

Browser storage is origin-specific. Data saved on `chatgpt.site` does not automatically appear on `specialistplanner.github.io`, and data on one computer does not automatically appear on another. Until cloud sync is introduced, JSON export/import is the manual migration and device-transfer mechanism.

### Move existing data to production

1. On the old site, open **Settings → Backup & reset** and export a JSON backup.
2. Keep that file outside the browser and do not commit or publish it.
3. Open the independent production site and choose **Import backup** in **Settings → Backup & reset**.
4. Compare Week, Progress, Units, History and Settings, including timetable, colours, class positions, outcomes, reconciliation data, Notes and Unit Library links.
5. Keep the old site unchanged as a temporary reference until the new site has been verified through normal use.

## Current limitations

v0.5.x is a stable single-teacher, single-subject, device-and-browser-local Planner. Independent hosting means the application can be opened on another computer; it does not make local Planner data follow the teacher automatically. It does not provide accounts, cross-device cloud sync, multi-teacher collaboration, co-teaching, CRT workflows, curriculum integration, reports, analytics or notifications. Those remain outside the v0.5 release boundary.

## Development and preview

```bash
npm install
npm test
npm run lint
npm run build:pages
npm run preview:pages
```

`npm run dev` retains the existing local development workflow. `npm run preview:pages` previews the static Pages build; production deployment itself is owned by the GitHub Actions workflow on `main`.

Unit Library is a separate public application and remains the source of truth for linked teaching content. Its absolute external URLs must not be rewritten under `/mandarin/`. Planner continues to work when that separate resource is unavailable.

See [`dashboard/README.md`](dashboard/README.md) for the data contract, integration boundary and resilience details.
