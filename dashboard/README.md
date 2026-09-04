# Specialist Planner v0.4.2 — Seven Class Colours

## Product architecture

v0.4.2 keeps Week as the primary working surface and provides seven optional class-recognition colours without changing progress semantics.

```text
Units / Lessons
      ↓
Class Progress
      ↓
Weekly Timetable
      ↓
Progress-Aware Week View
      ↓
Teaching Session Outcome
      ↓
 ┌───────────────┬─────────────────┬───────────────┐
 ↓               ↓                 ↓
Progress     Teaching History   Next Week
```

Navigation is now **Week | Progress | Units**, with History and Settings retained as supporting destinations. Units reuses the established Year Level → Unit → Lesson editor; Settings retains subject, class, timetable, backup, import, reconciliation and Trial Note controls.

## One source of truth

Week does not store a second weekly plan. `deriveTeachingWeek` reads only the existing `TimetableSession`, `ClassProgress`, Unit/Lesson, `TeachingSession` and progress-checkpoint data for the visible Monday–Friday range. Merely opening or navigating a week is read-only and cannot create duplicate sessions or false history.

Outcome actions materialise the selected dated occurrence only when the teacher records it, then call the shared v0.3 Teaching Session engine. The same Completed, Partial or Not taught record immediately drives Week status, Progress, History and later projections.

## Projection rules

- A confirmed historical occurrence displays its immutable planned Unit/Lesson snapshot and actual outcome.
- An unrecorded occurrence displays the class’s current actual Unit and Teach Next Lesson as a proposal.
- Completed advances the shared class pointer exactly once.
- Partial and Not taught retain the same Teach Next Lesson; their note or reason remains visible on the current card and as previous-session context later.
- If the same class has another unresolved occurrence earlier in the visible week, the later occurrence does not leap forward. It shows the same current Lesson and an explicit dependency warning.
- Future projections never become Completed and create no `TeachingSession` until an outcome is deliberately recorded.
- A cross-Unit class shows its own actual Unit. Comparison remains `Different unit` because Units have no authoritative ordering.
- `unitComplete` produces an explicit Choose next Unit state; the planner never selects another Unit automatically.
- Occurrences on or before a v0.3.1 checkpoint remain legacy/inactive and cannot re-enter the daily confirmation workflow.

## Week interaction and exceptions

Monday–Friday columns use chronological timetable order. Specialist Teaching cards prioritise class, time, Unit, Lesson, cohort status and actual/proposed state. Expanding a card reveals lesson description, current and cohort context, previous outcome/reason, shared Teaching Session controls, Progress detail and a contextual Quick Note action.

Normal cards stay visually calm. Behind/ahead/different-Unit states and previous Partial/Not taught outcomes receive restrained amber attention. Non-teaching timetable entries appear as compact muted context blocks and can be hidden with a device-local preference. They have no progress or outcome controls. Daily bulk completion uses the shared engine and only affects eligible Specialist Teaching occurrences.

## Class colour recognition

Each class can optionally use one of seven named presets—Hot pink, Orange, Yellow, Green, Aqua, Blue or Purple—selected in Setup. The same class-ID mapping colours Week cards, Progress class buttons and Specialist Teaching rows in the timetable editor. There is no unrestricted colour input in v0.4.2.

Colour is deliberately non-semantic. On track, Behind, Ahead, Different unit, Completed, Partial, Not taught and other states continue to use explicit text, icons, outcome chips and attention borders. Every preset pairs a pale background with the established dark ink foreground at WCAG AA contrast or better.

## Responsive behaviour

Large screens use five weekday columns. Smaller laptops and tablets keep the weekly comparison in a horizontally scrollable grid. Portrait iPad and mobile use wide, touch-friendly day columns with scroll snapping rather than squeezing five columns. Week navigation remains sticky below the main navigation where the layout is stable.

## Persistence and migration

Planner data uses schema v7 under `specialist-planner.data.v7`. `classColours` is a class-ID-to-preset-ID map, so class renaming does not break the association. Existing schema-v6 colours migrate to the closest new seven-colour preset, while earlier backups retain their established migration path. Timetable, Units, Lessons, class progress, Teaching Sessions, reconciliation status, dated checkpoints and Trial Notes remain unchanged. The optional non-teaching visibility preference is stored separately as device-local UI state.

JSON export/import remains the complete planner backup. Week behaviour is reconstructed from that existing data after restore; there is no separate Week backup format. No Firebase, account or cloud database is introduced.

## Known limitations

- one active subject in the v0.4.2 UI;
- device-and-browser-local planner data with no cross-device sync;
- no school-term calendar, holiday/event model or month view;
- no ordered Unit sequence, so cross-Unit status is categorical and Unit completion requires teacher choice;
- projections intentionally do not assume that an unresolved occurrence will be completed;
- no curriculum integration, attendance, student data, assessment, reports, notifications, analytics or multi-teacher administration.
