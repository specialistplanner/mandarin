# Specialist Planner v0.5 — Unit Library Integration Trial

A local-first, progress-aware weekly planner for specialist teachers. v0.5 adds optional read-only links from Planner Units and Lessons to the independent [The Mandarin Room Unit Library](https://themandarinroom.github.io/units/) without copying curriculum content or coupling resource availability to teaching progress.

Week is the daily working surface, Progress provides cohort-level diagnosis, Units manages local sequences and optional Library mapping, History records what happened, and Settings preserves timetable, backup and reconciliation tools. The seven accessible class-recognition colours remain available and non-semantic.

See [`dashboard/README.md`](dashboard/README.md) for the data contract, workflows, resilience rules and migration details.

## Run and verify

```bash
npm install
npm test
npm run lint
```

Planner data remains browser-local under `specialist-planner.data.v8`. JSON export/import is the complete backup format, including stable resource references.
