# Specialist Planner v0.5 — Unit Library Integration Trial

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

`Unit.externalResourceRef` and `Lesson.externalResourceRef` are optional. Both store `provider`, `resourceType`, `resourceId`, an optional label and canonical URL; a Lesson additionally stores `parentResourceId`. A linked Lesson must belong to the Unit referenced by its local parent. Local IDs, titles and lesson sequences remain authoritative for Planner progress.

Changing or removing a Unit reference clears only incompatible Lesson references. It does not alter `classProgress`, `progressBaselines`, `progressCheckpoints`, `TeachingSession` history, timetable data, colours or Trial Notes. No title-based matching or inferred mapping occurs.

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

Schema v8 uses `specialist-planner.data.v8`. v0.4.2 schema-v7 data migrates by retaining every existing field and adding no guessed external links. Earlier v0.2–v0.4.1 migration paths remain intact. JSON export/import validates and preserves both Unit and Lesson references.

The class colour map remains keyed by class ID. The Unit Library index is not copied into localStorage or backups; only stable references are stored.

## Verification coverage

Automated integration scenarios cover Unit and Lesson references, partial/local-only mapping, exact and encoded deep links, missing Unit/Lesson handling, link change/removal, progress/status independence, export/import, schema-v7 migration, parent-child validation and cross-Unit class resolution. Unit Library separately tests deep-link parsing and proves its generated index omits teaching content.

## Known limitations

- The current live Unit Library contains `Countries` and `Chinese Names`; it does not yet contain a `Nationalities` Unit with `Where are you from?`. Planner supports that acceptance workflow as soon as the Library author publishes those stable records, but v0.5 does not fabricate them.
- Library index refresh is publication-time, not real-time Firestore sync.
- one active subject in the v0.5 UI;
- device-and-browser-local Planner data with no account or cross-device sync;
- no school-term calendar, attendance, student data, assessment, reports, notifications, analytics or multi-teacher administration.
