# Specialist Planner v0.5.1 — Data contract and integration boundary

## Architecture and ownership

Unit Library and Specialist Planner remain independent peer applications:

```text
Unit Library (source of truth)         Specialist Planner (source of truth)
Unit/Lesson IDs + titles               timetable + class progress + outcomes
            │                                      │
            └── metadata-only index ──► stable reference IDs
                                                   │
                                      new-tab read-only deep link
```

The Library publishes `unit-library-index.json`, generated from an authorised source export. It contains only stable Unit/Lesson IDs, year level, display titles and canonical HTTPS URLs. Planner fetches this small index for chooser labels and validation; it never imports learning intentions, activities, notes, vocabulary, speaking data or resources.

## Reference model

`Unit.externalResourceRef` and `Lesson.externalResourceRef` are optional. Both store `provider`, `resourceType`, `resourceId`, an optional label and canonical URL; a Lesson additionally stores `parentResourceId`. A linked Lesson must belong to the Unit referenced by its local parent. Local IDs and lesson sequences remain authoritative for Planner progress; the transitional rule for current linked display titles is documented below.

Changing or removing a Unit reference clears only incompatible Lesson references. It does not alter `classProgress`, `progressBaselines`, `progressCheckpoints`, `TeachingSession` history, timetable data, colours or Notes. No title-based matching or inferred mapping occurs.

### v0.7.1 transitional title reconciliation

`lib/linked-unit-title-reconciliation.ts` is the single compatibility boundary for linked TMR title changes. It matches only the stable `externalResourceRef.resourceId` identities already stored on an SP Unit and, independently, on each SP Lesson. It never matches by title, sequence, Lesson number or array position.

The optional `externalResourceRef.lastSyncedTitle` records the most recent external title deliberately accepted by Planner. Existing records without that field are bootstrap differences and remain read-only until their dry-run diff is owner-approved. After a baseline exists, automatic refresh may accept a changed external title only while the current SP title still equals that baseline; a teacher-edited title is retained and reported as a conflict.

This logic changes only current linked Unit/Lesson titles plus their link label, canonical URL and last-synced title. It never replaces SP IDs or Lesson arrays and never changes progress, baselines, checkpoints, Teaching Sessions, timetable history, ownership, notes or planning metadata. Structural changes are detection-only. Historical Teaching Session title snapshots remain immutable. Live-source failure is a no-op, and the published snapshot is not treated as authoritative reconciliation evidence.

## Teacher workflows

- In Units Setup, a teacher may leave a Planner Unit `Local only` or choose a Unit Library Unit.
- After linking a Unit, each local Lesson may independently remain `Local only` or map to one Library Lesson. Partial mappings are supported.
- Linked Units and Lessons can be opened in a new tab, changed or removed.
- An expanded Week card offers `Open lesson` when its actual proposed Lesson is mapped.
- The Progress drawer offers the mapped resource for that class’s actual Teach Next Lesson, including when the class is on a different Unit from its cohort.
- Library content is read-only from Planner. Teaching Session outcomes continue to be recorded only in Planner.

## Deep links and resilience

Canonical links use `https://themandarinroom.github.io/units/view.html?unit=<unitId>&lesson=<lessonId>`. Unit Library scrolls to and highlights the exact Lesson. All links open in a new tab with opener isolation.

The Library index is optional runtime data. Loading, offline and unavailable states never block Week, Progress, History, Setup, outcomes or backup. A reference missing from a successfully loaded index is labelled `Linked resource unavailable` and can be relinked. Stored canonical URLs allow a previously linked resource to remain openable while the index itself is temporarily offline.

## Progress semantics

Resource colour and availability are non-semantic. On track, Behind, Ahead, Different unit, Completed, Partial, Not taught, Planned and Unit complete remain explicit text/status indicators. Opening, changing or removing a resource reference cannot advance progress or create a Teaching Session.

Week continues to derive from timetable, actual class progress, Unit/Lesson, outcomes and checkpoints. Confirmed history uses immutable planned Unit/Lesson snapshots; future projections do not create history until the teacher records an outcome.

## Persistence and migration

Schema v9 uses `specialist-planner.data.v9`. Earlier v0.2–v0.4.2 migration paths remain intact, retain existing fields and add no guessed external links. An unreadable current v9 record is preserved for explicit recovery and never replaced automatically by an older record. JSON export/import validates and preserves both Unit and Lesson references.

The class colour map remains keyed by class ID. The Unit Library index is not copied into localStorage or backups; only stable references are stored.

## Verification coverage

Automated integration scenarios cover Unit and Lesson references, partial/local-only mapping, exact and encoded deep links, missing Unit/Lesson handling, link change/removal, progress/status independence, export/import, schema-v7 migration, parent-child validation and cross-Unit class resolution. Unit Library separately tests deep-link parsing and proves its generated index omits teaching content.

## Known limitations

- The live read-only Unit Library index refreshes while Planner is open and falls back to the published snapshot when needed.
- one active subject in the v0.5.x UI;
- device-and-browser-local Planner data with no account or cross-device sync;
- no school-term calendar, attendance, student data, assessment, reports, notifications, analytics or multi-teacher administration.
