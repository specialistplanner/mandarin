# Specialist Planner v0.8.0 — Phase A migration dry-run

Generated: 2026-10-04T02:19:24.092Z

**Status: DRY-RUN ONLY — no cloud write, deployment, TMR change or production change was performed.**

## Safety gate

- Project: `specialist-planner-staging` (staging)
- Program: `program-ff3c47db-26e6-4e64-8236-976cbcee9b91`
- Current revision: **89**
- Firestore read update time: 2026-10-04T01:31:29.839461Z
- Source commit: `dae2759`
- Official-format backup: `/Users/weiwang/Documents/ChatGPT/Specialist Planner/backups/specialist-planner-backup-staging-pre-v080-authority-cutover-2026-10-04-rev-89.json`
- Backup SHA-256: `9d4cbef4b50b531746094476256fe780944465438dc880d4a012a83372a4c552`
- Export → import canonical round-trip: **PASS**
- Protected-state SHA-256: `9cf90979ada28da44f1fdbd3469c14bf23278a721d49e17b1ca005b3be3d7b8f`
- Teaching snapshot SHA-256: `de69086ad8fc3d204c3fc84447f64d15416bd4f197d16877cae2e50d3f68be60`

The backup can be restored through **Settings → Backup & Restore → Import planner backup**.

## Legacy Unit decisions

| Unit | Provenance | Proposed strategy | Lesson count | Current classes |
|---|---|---|---:|---|
| Numbers | later Unit-linked SP-native | unresolved / owner decision required | 7 → 7 | — |
| Australian States and Territories | later Unit-linked SP-native | unresolved / owner decision required | 6 → 6 | — |
| Countries | later Unit-linked SP-native | unresolved / owner decision required | 6 → 6 | — |
| Chinese Names | later Unit-linked SP-native | preserve existing SP structure | 5 → 5 | — |
| Family | later Unit-linked SP-native | preserve legacy historical structure + create current Term 4 structure | 4 → 5 | 2C, 2A |
| Fruit | later Unit-linked SP-native | preserve legacy historical structure + create current Term 4 structure | 3 → 5 | 3A, 3B |

## Priority Term 4 proposals

### Family

| Seq | SP Lesson ID | Current title | Treatment |
|---:|---|---|---|
| 1 | `lesson-c7991263-82ec-466e-b454-952da0f71048` | Introduction | preserve SP ID; current title already aligned; no TMR Lesson provenance assigned |
| 2 | `lesson-c913759e-a856-495e-adf7-936152feac06` | Family Tree | preserve SP ID and 2A/2C stable position; no TMR Lesson provenance assigned |
| 3 | `lesson-v080-year-2-family-tree-ii` | Family Tree II | new SP-owned current Lesson; no historical outcome and no inferred TMR provenance |
| 4 | `lesson-93f2899f-5790-4fae-8cf0-58118aa32fcb` | My family has five people. | preserve SP ID; move current presentation sequence only; historical snapshots unchanged |
| 5 | `lesson-8381da89-e8f2-40ef-8d92-e398c87911af` | My family has .... | preserve SP ID; adopt current display title only after owner approval; historical snapshots unchanged |

Current class dependencies: 2C → lesson-c913759e-a856-495e-adf7-936152feac06, 2A → lesson-c913759e-a856-495e-adf7-936152feac06. Historical Teaching Sessions: 4.

### Fruit

| Seq | SP Lesson ID | Current title | Treatment |
|---:|---|---|---|
| 1 | `lesson-746ae4ac-ce6a-4f2e-9393-e8f1ce7df440` | Introduction | preserve SP ID; current title/order already aligned; no TMR Lesson provenance assigned |
| 2 | `lesson-a1431c95-c3e9-46e2-91f8-d198d88a3a82` | Vocabulary Reinforcement | preserve SP ID; current title/order already aligned; no TMR Lesson provenance assigned |
| 3 | `lesson-6abd117d-f5bf-4934-9d25-240f9e8c89d8` | I like ... and ... | preserve SP ID; current title/order already aligned; no TMR Lesson provenance assigned |
| 4 | `lesson-v080-year-3-fruit-dislike` | I don't like ... or ... | new SP-owned current Lesson; no historical outcome and no inferred TMR provenance |
| 5 | `lesson-v080-year-3-fruit-revision` | Revision | new SP-owned current Lesson; no historical outcome and no inferred TMR provenance |

Current class dependencies: 3A → lesson-6abd117d-f5bf-4934-9d25-240f9e8c89d8, 3B → lesson-6abd117d-f5bf-4934-9d25-240f9e8c89d8. Historical Teaching Sessions: 4.

## Owner decisions still required

- **Numbers:** The seven-Lesson SP-native structure and current TMR structure use materially different titles. No stable Lesson provenance IDs exist.
- **Australian States and Territories:** The SP-native Unit has six Lessons while the current library has seven, including insertions and renamed concepts. No safe automatic mapping exists.
- **Countries:** The current library splits Where is China into two Lessons and shifts later Lessons. No safe automatic mapping exists.

## Exact cloud fields proposed after approval

- `data.units[8].lessons order`: structured value → structured value shown in the JSON report
- `data.units[8].lessons[id=lesson-v080-year-2-family-tree-ii]`: structured value → structured value shown in the JSON report
- `data.units[8].lessons[id=lesson-93f2899f-5790-4fae-8cf0-58118aa32fcb].sequence`: `3` → `4`
- `data.units[8].lessons[id=lesson-8381da89-e8f2-40ef-8d92-e398c87911af].sequence`: `4` → `5`
- `data.units[8].lessons[id=lesson-8381da89-e8f2-40ef-8d92-e398c87911af].title`: `I have ... (in my family).` → `My family has ....`
- `data.units[8].updatedAt`: `2026-09-15T01:49:34.789Z` → `<migration timestamp>`
- `data.units[10].lessons order`: structured value → structured value shown in the JSON report
- `data.units[10].lessons[id=lesson-v080-year-3-fruit-dislike]`: structured value → structured value shown in the JSON report
- `data.units[10].lessons[id=lesson-v080-year-3-fruit-revision]`: structured value → structured value shown in the JSON report
- `data.units[10].updatedAt`: `2026-09-15T01:49:34.789Z` → `<migration timestamp>`
- `data.updatedAt`: `2026-10-04T01:31:28.288Z` → `<migration timestamp>`
- `revision`: `89` → `90`
- `lastMutationId`: `save-56c84a84-ca50-443e-bf43-241d5ee7c70a` → `v080-authority-cutover-revision-89`
- `updatedAt`: `2026-10-04T01:31:29.763Z` → `<migration timestamp>`

No classProgress, progressBaselines, progressCheckpoints, year-level reference, Teaching Session, timetable, historical title snapshot, ownership, calendar or teacher note field is proposed for change.

## Authority cutover implementation after approval

- SP becomes the sole current Unit/Lesson authority.
- The 30-second TMR Unit-title reconciliation path will be disabled in Phase A implementation.
- Existing Unit-level links are retained as provenance/rollback metadata only; no new provenance IDs are inferred for legacy Lessons.
- TMR remains authoritative only for referenced classroom resources such as Vocabulary and Speaking Practice.
- Term 3 history and all Teaching Session snapshots remain immutable.

## STOP gate

No migration write is authorised by this dry-run. Owner approval is required for the Family/Fruit proposals and the unresolved curriculum decisions above.
