# Specialist Planner v0.3 — Teaching Session Engine

## Purpose

v0.3 connects the recurring weekly timetable to what actually happened in class. Time passing never advances progress. A teacher must confirm a scheduled specialist lesson as **Completed**, **Partial**, or **Not taught**.

```text
Weekly Timetable
       ↓
Teaching Session
       ↓
     Outcome
    ↙       ↘
Class Progress  Teaching History
       ↓
   Dashboard
```

Calendar is intended to become a date-based view over the same Teaching Sessions and planned timetable data. It must not maintain a second independent history.

## Domain model

- `TimetableSession` is the recurring weekly plan: weekday, time, type, subject, and optional class.
- `TeachingSession` is one dated occurrence of a valid Specialist Teaching timetable entry. It stores stable timetable, subject, class, year-level, Unit, and Lesson references plus small immutable Unit/Lesson title snapshots, outcome, optional detail, and timestamps.
- `ClassProgress` points to the actual Unit and Lesson to teach next and can explicitly be `unitComplete`.
- `progressBaselines` hold the authoritative starting pointer used by the reconciliation engine.
- `TrialNote` remains a separate product-research observation. It is not a lesson outcome note.

Teaching Sessions are generated lazily only for dates the teacher views or confirms. The app does not pre-generate future weeks.

## Outcomes and daily workflow

- **Completed** records the lesson and advances only that class. Completing the final Lesson sets `Unit complete`; the app never guesses another Unit.
- **Partial** records the lesson and optional note but leaves progress unchanged, so the same Lesson is proposed next time.
- **Not taught** records the missed lesson and optional reason but leaves progress unchanged. The record remains in History and can explain why a class is behind.
- **Planned** is the unconfirmed state. Clearing an outcome returns a session to Planned.

The Teaching Day cards provide touch-friendly one-step completion, compact detail entry for Partial/Not taught, and **All taught as planned** for all still-Planned specialist sessions on that date. Non-teaching timetable entries are never included. A lightweight previous-day prompt appears when yesterday still has unconfirmed specialist sessions.

## Safe progress reconciliation

Progress is not implemented as “every click equals +1.” For each class, the engine starts from its stable progress baseline and replays dated Completed sessions in timetable order. A session advances only when its planned Unit/Lesson matches the replay pointer. Partial, Not taught, and Planned sessions contribute no movement.

Every outcome edit recomputes that class from its baseline. Therefore:

- repeated saving cannot double-advance;
- Completed → Partial or Not taught reverses the prior movement;
- Not taught → Completed advances exactly once;
- clearing an outcome reconciles safely;
- later matching Completed sessions replay consistently.

The class drawer’s **Correct progress** control is an exceptional manual correction. It establishes a new baseline and retires previous session effects without deleting their history. Normal weekly maintenance should happen through Teaching Day outcomes.

## Cross-Unit and end-of-Unit behavior

Each class keeps its own actual Unit and Lesson. Sessions snapshot that class’s actual plan, even when its cohort reference has moved to another Unit. Dashboard comparisons remain categorical **Different unit** across Units; lesson-index arithmetic is never performed across unrelated Units.

Completing a Unit’s final Lesson leaves the class on the same Unit/Lesson with `unitComplete: true`. The teacher must choose the next Unit in Setup or use a deliberate manual correction.

## History and Dashboard

History is derived directly from non-Planned Teaching Sessions and groups records by date. It shows class, planned Unit/Lesson snapshot, scheduled time when available, outcome, and optional note/reason.

Completed outcomes update Dashboard progress immediately. Partial and Not taught preserve the pointer, which naturally exposes cohort divergence. The class drawer shows the most recent recorded outcome and its reason/note without cluttering the overview row.

## Local persistence and migration

The complete planner is stored under `specialist-planner.data.v4`. This device-local browser storage is explicitly required for the live trial; no Firebase, authentication, or cloud database is used.

Migration order:

1. restore valid schema-v4 data;
2. migrate schema-v3 (`specialist-planner.data.v3`) by preserving all setup and progress, copying current progress into `progressBaselines`, and starting with an empty Teaching Session history;
3. migrate compatible schema-v2 data the same way;
4. retain the v0.1 numeric progress recovery path;
5. persist the migrated result as schema v4 while leaving legacy keys untouched for recovery.

Invalid legacy data is never silently overwritten. Existing v0.2/v0.2.1 class Unit/Lesson positions become the starting baseline, so real trial data is not reset.

## Backup and restore

JSON export/import includes subjects, cohorts, Units, Lessons, class progress and baselines, timetable, dated Teaching Sessions with outcomes and snapshots, Trial Notes, and setup data. Import validates stable IDs, references, session types, dates, outcomes, timestamps, progress integrity, and cross-Unit class rules. Compatible v0.2/v0.2.1 backups migrate automatically.

## Known limitations

- one active subject in the v0.3 UI;
- device-and-browser-local data with no cross-device sync;
- lazy occurrences only for viewed/confirmed dates;
- no ordered Unit sequence, so Unit completion requires teacher choice;
- no Calendar UI yet; future Calendar must read the shared Teaching Session model;
- no notifications, attendance, students, curriculum, assessment, reporting, analytics, accounts, or multi-teacher administration.

## Normal workflow

1. Open the teaching date.
2. Teach the scheduled lesson.
3. Mark Completed, Partial, or Not taught—or confirm all normal sessions together.
4. Review exceptions in Dashboard and details in History.
5. Use Correct progress only for exceptional data repair.
6. Export regular JSON backups during the live trial.
