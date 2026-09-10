# Specialist Planner v0.6.0 — Private Cloud Workspaces

## Release summary

Specialist Planner v0.6.0 moves each teacher's Program into a private, owner-scoped Firebase workspace with cross-device cloud continuity. Google is the visible production sign-in method. Microsoft support remains configured in the application but is hidden from normal users for this release.

## Included

- Private Program ownership enforced by Firestore rules
- Cross-device cloud sync with revision and mutation conflict protection
- Authentication-first entry and direct Week launch for returning teachers
- Program-owned Unit Library with stable Unit and Lesson IDs
- Preserved Week, Progress, Units, Teaching Sessions and History workflows
- JSON backup, validation, restore and pre-restore snapshots
- Local resilience without sharing cached Program data between authenticated users

## Out of scope

- Unit Library redesign
- Term Overview
- Co-teaching and shared Program ownership

## Known compatibility limitation

School-managed student iPads may fail during Google authentication at the Firebase auth handler with a certificate warning. This does not affect the validated teacher-laptop workflow. Users must not bypass browser certificate warnings.
