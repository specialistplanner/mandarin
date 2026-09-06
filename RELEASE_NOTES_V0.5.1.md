# Specialist Planner v0.5.1 — Migration Safety Hotfix

Released 6 September 2026.

This hotfix preserves an imported Planner backup as the authoritative state when moving to a new website origin. After a successful import, one-time historical corrections are marked as already handled so refreshing the new site cannot reapply them.

The Week, Progress, Units, History, timetable, class colours, Teaching Sessions, Notes and Unit Library links remain unchanged from the restored backup. No new classroom features are included.

This release also supplies the static `/mandarin/` build and GitHub Actions workflow for the independent production site at `https://specialistplanner.github.io/mandarin/`. The existing `v0.5.0` tag remains unchanged; the origin-migration fix is intentionally released as `v0.5.1`.
