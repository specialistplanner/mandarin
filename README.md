# Specialist Planner v0.6 development

Specialist Planner is a private, progress-aware weekly planner for a single specialist teacher. v0.6 adds authenticated cloud Programs and cross-device continuity while preserving the stable v0.5.1 classroom workflow, JSON backups and local resilience.

## Production

The stable v0.5.1 production site remains:

**https://specialistplanner.github.io/mandarin/**

Production is built from `main` by [the GitHub Pages workflow](.github/workflows/pages.yml). Vite emits a static site to `dist-pages` using the required `/mandarin/` base path, and GitHub Actions deploys that artifact. The application has one client-side page, so bookmarking or refreshing the production URL does not depend on a server-side route fallback.

v0.6 remains on its staging branch and private preview until the release-blocking migration, provider, isolation, cross-device and regression checks pass. The former `chatgpt.site` deployment remains available as an owner-only staging and migration reference.

## Authentication and startup routing

- Signed-out visitors see Google and Microsoft sign-in before any Planner creation path.
- A signed-in teacher with one cloud Program opens that Program directly in **Week**.
- A signed-in teacher with no cloud Program enters first-time specialist-area onboarding.
- If a valid local v0.5.x Planner is present, the teacher is offered an explicit cloud migration before blank Program creation.
- JSON import remains disaster recovery; it is not the normal way to move an established cloud Program between devices.

Cloud ownership belongs to the exact authenticated Specialist Planner identity shown during migration and in the account menu. A Google identity and a Microsoft identity are separate unless a future release implements verified provider linking. v0.6 never merges accounts by name, similar email, browser state or client-side assertion. The owner must use the same authenticated identity on every device.

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

## Cloud storage, local resilience and backup

Cloud Programs are privately owned Firestore documents protected by owner-only security rules. Each save uses a monotonic revision and mutation ID so stale devices cannot silently overwrite a newer revision. The footer reports **Synced to cloud**, **Saving…**, **Sync pending**, or **Offline · changes saved locally** truthfully. Offline cache keys include the authenticated UID and are never loaded for another account.

JSON export/import remains the complete backup format. A cloud restore validates the file, requires a currently synced Program, creates an immutable pre-restore snapshot, writes through revision protection and verifies the restored Program. Legacy localStorage stays intact until the first cloud migration has been read back successfully.

### Move an existing v0.5.x Planner into v0.6

1. On the original device, open **Settings → Backup & reset** and export a fresh JSON backup.
2. Keep the backup outside the browser and never commit or publish it.
3. Sign in with the account that should permanently own the Program.
4. Review the detected Program summary and confirm the fresh backup before choosing **Move this Program to my cloud account**.
5. Verify Week, Progress, Units, History and Settings from the cloud copy, then sign in with that same identity on a second device and confirm it opens directly in Week without JSON import.

## Current limitations

v0.6 remains single-owner and single-Program in normal use. It does not include sharing, co-teaching, automatic Google/Microsoft identity merging, CRT workflows, curriculum integration, reports, analytics or notifications. Microsoft sign-in is a release blocker until a real Microsoft Entra application registration is connected and tested.

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
