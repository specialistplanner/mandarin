# Specialist Planner v0.6.0 — Private Cloud Workspaces

Specialist Planner is a private, progress-aware weekly planner for a single specialist teacher. v0.6.0 adds authenticated cloud Programs and cross-device continuity while preserving the established classroom workflow, JSON backups and local resilience.

## Production

The production site is:

**https://specialistplanner.github.io/mandarin/**

Production is built from `main` by [the GitHub Pages workflow](.github/workflows/pages.yml). Vite emits a static site to `dist-pages` using the required `/mandarin/` base path, and GitHub Actions deploys that artifact. The application has one client-side page, so bookmarking or refreshing the production URL does not depend on a server-side route fallback.

The separate v0.6 staging deployment remains available for release verification. The former `chatgpt.site` deployment remains available as an owner-only migration reference.

## Authentication and startup routing

- Signed-out visitors see Google sign-in before any Planner creation path. Microsoft support remains retained in the application configuration but is hidden from the normal v0.6.0 production entry.
- A signed-in teacher with one cloud Program opens that Program directly in **Week**.
- A signed-in teacher with no cloud Program enters first-time specialist-area onboarding.
- If a valid local v0.5.x Planner is present, the teacher is offered an explicit cloud migration before blank Program creation.
- JSON import remains disaster recovery; it is not the normal way to move an established cloud Program between devices.

Cloud ownership belongs to the exact authenticated Specialist Planner identity shown during migration and in the account menu. A Google identity and a Microsoft identity are separate unless a future release implements verified provider linking. v0.6 never merges accounts by name, similar email, browser state or client-side assertion. The owner must use the same authenticated identity on every device.

## Core views

- **Week** is the primary teaching workspace. It combines the Monday–Friday timetable, shared session times, class identity colours, Unit and Lesson context, progress exceptions, and Completed, Partial or Not taught outcomes.
- **Progress** compares each class’s actual Unit and next Lesson with its cohort reference while preserving independent positions for classes in different Units.
- **Units** manages the active Program's own Unit and Lesson sequences, plus optional read-only links from Mandarin Programs to The Mandarin Room resources.
- **History** lists confirmed outcomes with saved Unit/Lesson snapshots, notes and reasons, with multi-class filtering.
- **Settings** manages cohorts, classes, timetable/session times, internal Notes, reconciliation, backup and deliberate reset actions.

## Teaching outcomes

- **Completed** advances the affected class exactly once.
- **Partial** records where teaching stopped without advancing progress.
- **Not taught** records the reason without advancing progress.
- Non-specialist timetable entries never affect specialist progress. Generalist Teaching is shown as teaching context only.

## Program-Owned Unit Library

Every cloud Program owns its complete Unit Library inside the private Program document. Art, Music, PE, Languages and every other specialist area use the same model; a non-Mandarin Program does not depend on The Mandarin Room or another external service.

- Units and Lessons receive stable generated IDs. Renaming a title does not create a duplicate or move class progress.
- A Unit can apply to one or several year levels while retaining one stable ID and one ordered Lesson sequence.
- Week and Progress resolve the current title from those IDs, so later renames appear immediately.
- Teaching History stores the planned Unit and Lesson IDs together with title snapshots, so old records remain readable after later edits.
- A Unit or Lesson referenced by cohort expectations, class progress, checkpoints or History cannot be deleted. Move the live references first; historical references remain protected.
- The entire Program Unit Library participates in cloud revision control, per-user offline caching, JSON export/import and pre-restore snapshots.
- An empty Program shows a clear **No Units yet** state. The optional first Unit can be created during onboarding or added later from Units.

For a Mandarin Program only, a Program Unit or Lesson may additionally hold a read-only deep link to the independent [The Mandarin Room Unit Library](https://themandarinroom.github.io/units/). The Program-owned record remains authoritative for Planner workflow and progress. External resource availability never blocks Week, Progress, History or outcome recording.

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

v0.6.0 remains single-owner and single-Program in normal use. It does not include sharing, co-teaching, automatic Google/Microsoft identity merging, CRT workflows, curriculum integration, reports, analytics or notifications.

School-managed student iPads may fail during Google authentication at the Firebase auth handler with a certificate warning. The current release is teacher-facing and its teacher-laptop workflow has been validated. Users must not bypass browser certificate warnings.

## Development and preview

```bash
npm install
npm test
npm run lint
npm run build:pages
npm run preview:pages
```

`npm run dev` retains the existing local development workflow. `npm run preview:pages` previews the static Pages build; production deployment itself is owned by the GitHub Actions workflow on `main`.

The Mandarin Room Unit Library is a separate public application and remains the source of truth only for optionally linked Mandarin teaching content. Its absolute external URLs must not be rewritten under `/mandarin/`. Planner continues to work when that separate resource is unavailable.

See [`dashboard/README.md`](dashboard/README.md) for the data contract, integration boundary and resilience details.
