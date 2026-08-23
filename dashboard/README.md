# Specialist Planner v0.2.1 — Live Trial Hotfix

## Purpose

v0.2.1 is a targeted live-trial hotfix. It preserves natural whitespace during controlled text editing and allows classes in one year-level cohort to reference different current units.

It still does not treat Calendar records as the source of truth for progress, and it does not implement teaching-session outcomes yet.

## Architecture

- `app/dashboard-app.tsx` owns the Dashboard, first-run choice, progress drawer and Quick Note modal.
- `app/setup-view.tsx` provides the single Setup experience for cohorts, units, lessons, timetable, trial notes and backup.
- `lib/domain.ts` defines schema v3 and pure integrity-preserving mutations.
- `lib/sample-data.ts` supplies optional Mandarin demonstration data and a blank-planner factory.
- `lib/storage.ts` validates, persists, migrates, exports and imports the complete planner.
- `tests/` covers domain behaviour, migration, backup safety and server rendering.

The persisted conceptual shape is:

`PlannerData → Subjects → YearLevels → Classes → Units → Lessons → ClassProgress → TimetableSessions → TrialNotes`

## Editable domain model

All entities use stable internal IDs. Display names can be changed without changing references.

- **Subject**: v0.2.1 supports one active subject in the UI; the schema stores a subject collection and active subject ID.
- **YearLevel**: editable display name and short label, plus stable references to the cohort reference unit and expected lesson.
- **Class**: stable ID, editable name and year-level reference.
- **Unit**: stable ID, year-level reference, editable title/optional description, and an ordered lesson collection.
- **Lesson**: stable ID, editable title/optional description and normalized display sequence.
- **ClassProgress**: independently references a class’s actual current unit and the stable ID of its lesson to teach next.
- **TimetableSession**: stable ID, recurring weekday/time, type, optional class and label, plus a reserved future outcome field.
- **TrialNote**: stable ID, text, timestamp, optional context and optional class reference.

Units are shared definitions rather than duplicated per class. Each class chooses one of its year level’s units. Lesson order is display order; progress does not store an array index. Renaming a lesson leaves progress unchanged. Reordering a lesson moves that lesson—and any class pointing to it—to its new displayed position.

Editable mutation functions validate required text with `trim()` but store the original value unchanged. Trimming occurs only when submitting add forms or saving notes—not during ordinary controlled-input typing.

## Progress semantics

The stored class lesson means **the lesson to teach next**. If a class displays Lesson 4, Lessons 1–3 are considered completed for this lightweight trial model.

Each year level stores a cohort reference unit and expected next lesson. When a class is in that same unit, Dashboard status compares lesson positions:

- zero difference: on track;
- negative difference: behind;
- positive difference: ahead.

When units differ, lesson-index arithmetic is not meaningful. The status is categorical **Different unit**, and the Dashboard shows the class’s actual unit and the cohort reference unit explicitly.

Manual progress adjustment remains intentional during the trial. Completed, Partial and Cancelled session workflows are reserved but not applied.

## Local storage and migration

The complete document is stored under:

`specialist-planner.data.v3`

On first v0.2.1 load:

1. valid schema-v3 data is restored;
2. otherwise, `specialist-planner.data.v2` is migrated by preserving every class’s existing `unitId` and `lessonId`;
3. otherwise, `specialist-planner.dashboard.progress.v1` is checked and migrated through the sample configuration;
4. the result is persisted as schema v3;
5. legacy keys are left untouched as additional recovery sources.

Invalid v2 data is never overwritten automatically. Mid-edit invalid fields are not persisted until the planner validates again.

This browser storage is explicitly required for the trial. No Firebase, cloud database, account or cross-device sync is used.

## Setup workflow

1. New users choose **Start blank planner** or **Explore sample data**.
2. Rename the active subject.
3. Add year levels, classes and class names.
4. Create each current unit and edit its description.
5. Add, rename, describe, reorder or remove lessons.
6. Set the cohort reference unit/lesson, then set every class’s independent actual unit and next lesson.
7. Add recurring weekly timetable sessions.
8. Return to the Dashboard and begin daily use.

Changing the cohort reference unit does not move existing classes. Newly created classes start in the cohort reference unit when one exists. Removing a class requires confirmation and removes its progress and timetable sessions; its notes remain but lose the class link. Removing a referenced lesson requires confirmation and safely moves affected progress/expectations to the nearest remaining lesson. A unit cannot be deleted while it is the cohort reference or any class still uses it.

## Timetable session types

- Specialist Teaching
- Cover / Release
- Planning
- PLT / Meeting
- Assembly / School Activity
- Break
- Other

Only Specialist Teaching sessions with a valid class appear in Dashboard teaching-progress cards. Cover, planning, meetings, activities, breaks and other sessions never enter that view and cannot advance progress.

## Backup and restore

**Export JSON** downloads the entire validated v2 document: configuration, progress, timetable and trial notes.

**Import JSON** accepts schema-v3 backups and migrates compatible schema-v2 backups. It validates collection shape, stable IDs, class-level unit/lesson references, times and teaching-session requirements before asking permission to replace current data.

**Load sample data** and **Reset planner** are separate confirmed destructive actions. Export a backup first.

## Quick Notes

Use **+ Quick note** anywhere, or launch a class-linked note from the progress drawer. Notes persist with the planner, are reviewable and deletable in Setup, and are included in every JSON backup. They are intentionally not a general notes or analytics system.

## Live Trial Guidance

At the start of the week, confirm each cohort expectation and each class’s next lesson. Use the Today cards before teaching, then manually correct class progress as needed. Export a JSON backup at least weekly and before major setup changes.

Record Quick Notes when reality challenges the model—for example:

- a class finishes only part of a lesson;
- a cancellation makes the expected lesson confusing;
- the Dashboard lacks context needed before class;
- a setup or correction takes too many steps;
- different classes need genuinely different lesson sequences.

Useful notes describe what happened, what the teacher expected, and what decision the product could not represent.

## Known limitations and intentional deferrals

- one active subject in the v0.2.1 UI;
- device-and-browser-local data with no cross-device sync;
- no automated teaching-session outcome engine;
- no Calendar integration because Calendar is absent from this checkout;
- no timetable drag-and-drop;
- no curriculum, students, attendance, assessment, reporting, accounts, analytics or notifications.

The Mandarin curriculum content and sample weekly schedule remain hard-coded only as optional demonstration data. The working planner—including every class’s actual unit—is editable after it is loaded.

## Recommended future Teaching Session model

Keep scheduled/history data separate from current progress:

`Timetable occurrence → TeachingSession → Completed / Partial / Cancelled → progress event → ClassProgress`

A Completed outcome may advance exactly one class. Partial should preserve teacher judgment about the next lesson. Cancelled should retain history without advancing. Live-trial notes should be reviewed before locking those semantics.

Calendar integration should wait until the actual Calendar module is present and the shared stable IDs can be reconciled without copying its UI code.
