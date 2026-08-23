# Dashboard prototype notes

## Purpose

Specialist Progress Dashboard v0.1 answers four questions at a glance:

1. What unit is each year level studying?
2. What lesson is the cohort expected to be on?
3. Where is every individual class actually up to?
4. What specialist teaching sessions are scheduled for the selected day?

It deliberately does not treat Calendar entries as the source of truth for class progress.

## Architecture

- `app/page.tsx` is the dashboard route.
- `app/dashboard-app.tsx` contains the client UI and its lightweight interaction state.
- `lib/domain.ts` contains subject-agnostic types and pure progress/timetable calculations.
- `lib/sample-data.ts` contains Mandarin-only sample units, classes, initial progress, and the weekly timetable.
- `lib/storage.ts` is the browser-persistence adapter.
- `tests/` verifies domain behaviour and server rendering.

The UI is intentionally separate from the reusable domain functions. A future Calendar view can consume the same shared entities without importing Dashboard components.

## Data model

The reusable model is:

- **Subject** — the specialist discipline, such as Mandarin, Music, Art, or PE.
- **YearLevel** — owns the current unit reference and an explicit expected lesson.
- **Class** — belongs to one year level.
- **Unit** — contains an ordered lesson sequence.
- **ClassProgress** — maps a class to its independent current/next lesson within a unit.
- **TimetableSession** — has a weekday, time, session type, optional subject/class, and a future-compatible outcome.

Session types already distinguish specialist teaching, cover/release, planning, meetings, school activities, breaks, and other work. Only `specialist-teaching` sessions appear in Today’s Teaching and may eventually affect subject progress. The sample `Prep B` cover session in the data proves that non-teaching sessions are filtered out.

The session outcome type reserves `planned`, `completed`, `partial`, and `cancelled`, but v0.1 does not apply outcome events yet.

## Sample data

The 16 classes, Mandarin units and lessons, initial progress values, and weekly timetable are prototype content. The type names, progress calculations, storage adapter, and session filtering contain no Mandarin-specific assumptions.

The acceptance scenario starts Year 5 with both 5E and 5C on Lesson 4. Open 5C and use the minus control or lesson selector to move it to Lesson 3. Both the Year 5 row and Wednesday card immediately report that 5C is one lesson behind.

## Cohort and divergence logic

Each year level has an explicit `expectedLesson`. This is clearer for v0.1 than deriving a target from a majority/median, because the teacher can see and intentionally set the planned cohort position later. A class status is its actual lesson minus that expected lesson:

- `0`: on track
- negative: behind by the absolute difference
- positive: ahead by the difference

The exact lesson remains visible alongside the status. Aligned rows stay visually quiet; amber is reserved for behind exceptions, while muted blue distinguishes ahead classes without making them look like errors.

Lesson values are clamped to the first and final lessons. The prototype models the lesson to teach next: if a class is on Lesson 4, Lesson 3 is the last completed lesson.

## Local persistence

Progress is stored in browser `localStorage` under the versioned key `specialist-planner.dashboard.progress.v1`. Stored data is validated and merged over defaults, so new classes can be introduced without losing known progress. Invalid or corrupt data safely falls back to sample defaults.

This device-local persistence is intentional for v0.1. No Firebase, production data, security rule, deployment configuration, or account state is touched.

## Relationship to Calendar

The task referenced an existing `calendar/` module and its README, but neither exists in this repository checkout. No Calendar code was removed, renamed, or refactored. The header shows Calendar as an unavailable separate module instead of linking to a broken route.

When Calendar is available, the recommended shared domain package should own:

- subjects, year levels, classes, units, and lesson identifiers;
- typed timetable/teaching sessions;
- stable session outcome values;
- date/time and school-term conventions.

Calendar should retain scheduled and historical session records. Dashboard should retain derived/current class progress. A future completed-session application service can connect them:

`Timetable → TeachingSession → outcome → progress event → ClassProgress → Dashboard`

Completed sessions would normally advance progress, partial sessions would require a teacher decision, and cancelled sessions would retain history without advancing progress. This should be event-driven rather than having Calendar entries directly overwrite progress.

Because the Calendar source is absent, its proposed Firestore fields cannot be compared honestly. Before integration, inspect its class/unit/session identifiers and refactor only duplicated domain types into shared code; keep editor and view state module-local.

## Prototype-only elements

- direct advance/back/reset controls;
- hard-coded expected lessons and timetable;
- initials/workspace presentation in the header;
- local browser persistence;
- Mandarin sample curriculum language.

The next recommended step is a small shared-domain integration spike with the actual Calendar repository present: reconcile identifiers, introduce a teaching-session outcome event, and prove that one completed specialist-teaching session advances exactly one class while Calendar history remains unchanged.
