# Specialist Planner v0.7.1 — Legacy Unit/Lesson Reconciliation Audit

> STRICTLY READ-ONLY. Candidate relationships below are not approved mappings and were not written to either product.

## Sources and snapshot

- Specialist Planner: `specialist-planner-staging`, Program `program-ff3c47db-26e6-4e64-8236-976cbcee9b91`, revision **79**, live Firestore REST read.
- The Mandarin Room: `the-mandarin-room`, production `units` collection plus live `unitLibraryIndex`, generated 2026-10-03T11:03:46.731Z.
- Snapshot fetched: 2026-10-03T11:03:46.710Z.
- Git history: read-only inspection of `specialistplanner/mandarin`.

## Executive summary

- Linked Units: **11**
- SP Lessons in linked Units: **43**
- TMR Lessons in linked Units: **48**
- Existing stable Lesson mappings: **12**
- Legacy SP Lessons without stable TMR mapping: **31**
- TMR Lessons without stable SP mapping: **36**
- Provenance conclusion: **The six 31-Lesson legacy Units are later Unit-linked SP-native records. Missing Lesson-level TMR IDs are historically expected, not proof of broken synchronization.**

### Audit classification counts

- Exact/high-evidence candidate relationships: 14
- Likely renamed candidates: 8
- TMR-only Lessons: 5
- SP-only Lessons: 0
- Possible splits: 2
- Possible merges: 0
- Reorder/moved cases: 5
- Material content changes proven: 0
- Unresolved/possible-same cases: 2

## Historical provenance investigation

| Date | Commit | Evidence |
|---|---|---|
| 2026-08-23 | `fe744cb` | Initial SP generation stored Program-owned Units/Lessons with stable SP IDs. |
| 2026-08-23 | `d68ab6e` | Setup directly supported adding, renaming, reordering and deleting Units and Lessons; new records used unit-/lesson- UUIDs. |
| 2026-09-04 | `5832942` | TMR references became optional. Selecting a Unit reference preserved local SP Lessons; Lesson references were separately optional. |
| 2026-10-02 | `00ed290` | Live Unit selection began materialising complete TMR Units with stable Lesson references. |

This chronology means missing TMR Lesson IDs on the six old Units are historically expected. The 4 Sep link control attached optional provenance to existing SP-native content; it was not an import/overwrite operation.

## Three kinds of truth

1. **Curriculum/library truth:** Current TMR production Unit documents describe the present reusable curriculum/library sequence.
2. **Current operational truth:** SP revision 79 classProgress/year-level references describe where current classes are positioned, including active Family and Fruit legacy records.
3. **Historical teaching truth:** SP Teaching Session snapshots remain immutable evidence of what was planned/taught under earlier SP-native sequences.

## Complete linked-Unit inventory

| SP Unit | SP title | TMR Unit | TMR title | SP/TMR Lessons | Unit title match | lastSyncedTitle | Stable mappings | Unmapped SP | Unmapped TMR | Provenance | Structural divergence |
|---|---|---|---|---:|---|---|---:|---:|---:|---|---|
| `hello-friends` | Numbers | `prep-numbers` | Numbers 0-10 I | 7/7 | No | — | 0 | 7 | 7 | later Unit-linked SP-native | not-detected |
| `weather` | Australian States and Territories | `year-4-australia-states-and-territories` | Australian States and Territories | 6/7 | Yes | Australian States and Territories | 0 | 6 | 7 | later Unit-linked SP-native | present-or-suspected |
| `nationalities` | Countries | `year-5-countries` | Countries | 6/7 | Yes | Countries | 0 | 6 | 7 | later Unit-linked SP-native | present-or-suspected |
| `travel` | Chinese Names | `year-6-chinese-names` | Chinese Names | 5/5 | Yes | Chinese Names | 0 | 5 | 5 | later Unit-linked SP-native | not-detected |
| `unit-f89fcb17-f9b5-4038-9955-be2e2a461c55` | Family | `year-2-family` | Family | 4/5 | Yes | Family | 0 | 4 | 5 | later Unit-linked SP-native | present-or-suspected |
| `unit-b5e690a6-3d13-4bde-9690-e451065d6f9e` | Fruit | `year-3-fruit` | Fruit | 3/5 | Yes | Fruit | 0 | 3 | 5 | later Unit-linked SP-native | present-or-suspected |
| `unit-library-year-6-family-ii` | Family II | `year-6-family-ii` | Family II | 2/2 | Yes | Family II | 2 | 0 | 0 | TMR-imported legacy | not-detected |
| `unit-6cb8ecc9-9a22-4be5-95d1-3641ade882d5` | Places at School | `year4-australian-states-territories` | Places at School | 1/1 | Yes | Places at School | 1 | 0 | 0 | TMR-imported legacy | not-detected |
| `unit-9b90b90c-3f2e-4348-834a-225fb9b8addd` | Nationalities | `year-5-nationalities` | Nationalities | 4/4 | Yes | Nationalities | 4 | 0 | 0 | TMR-imported legacy | not-detected |
| `unit-a25aa50c-a2f6-4035-bef6-e39e46e0b615` | Colours | `prep-colours` | Colours | 3/3 | Yes | Colours | 3 | 0 | 0 | TMR-imported legacy | not-detected |
| `unit-fb2195b5-3a83-405e-b5a8-7926303c32b4` | Mountains and Water | `year-1-mountains-and-water` | Mountains and Water | 2/2 | Yes | Mountains and Water | 2 | 0 | 0 | TMR-imported legacy | not-detected |

## Year 2 Family — detailed conclusion

The evidence strongly suggests TMR Family Tree II was inserted into the current TMR sequence after or independently of the four-Lesson SP-native sequence. SP L3 corresponds as a candidate to TMR L4 by exact distinctive title, not to TMR L3. TMR L3 must not be mapped to SP L3.

**Why TMR L3 must not be treated as SP L3:**
- TMR L3 is Family Tree II; SP L3 is My family has five people.
- SP L3 has an exact distinctive-title candidate at TMR L4.
- The old SP editor allowed independent Lesson authoring and the Family Unit has no Lesson provenance IDs.
- Array position is explicitly non-authoritative and the structure is 4 SP Lessons versus 5 TMR Lessons.

Current TMR Family evidence:
- **TMR L1 — Introduction** (`lesson-1788760226079`): intention To name some key family words through a song. To understand that all families are different. To describe who I have in my family in English.; vocabulary year2-family; speaking —; resources https://www.youtube.com/watch?v=K8D_2cU3O_U&list=RDK8D_2cU3O_U&start_radio=1.
- **TMR L2 — Family Tree** (`lesson-1788760345727`): intention To create a family tree that shows who I have in my family. To label my family members with Mandarin words (pinyin and characters).; vocabulary year2-family; speaking —; resources https://www.youtube.com/watch?v=K8D_2cU3O_U&list=RDK8D_2cU3O_U&start_radio=1.
- **TMR L3 — Family Tree II** (`lesson-1788761602623`): intention —; vocabulary —; speaking —; resources —.
- **TMR L4 — My family has five people.** (`lesson-1788760440092`): intention To describe how many people I have in my family in Mandarin.; vocabulary year2-family; speaking —; resources https://www.youtube.com/watch?v=K8D_2cU3O_U&list=RDK8D_2cU3O_U&start_radio=1.
- **TMR L5 — My family has ....** (`lesson-1788760525217`): intention To describe who I have in my family in Mandarin.; vocabulary year2-family; speaking —; resources https://www.youtube.com/watch?v=K8D_2cU3O_U&list=RDK8D_2cU3O_U&start_radio=1.

## Unit-by-Unit side-by-side inventories

Position alignment below is display-only and is never treated as identity.

### Numbers

- SP Unit: `hello-friends`
- TMR Unit: `prep-numbers`
- Provenance: **later Unit-linked SP-native**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `hello-friends-lesson-1` | Match and sequence | 1 | `lesson-1788496768908` | Introduction | Titles/structure diverge at this position; position is not identity. |
| 2 | `hello-friends-lesson-2` | Pegs and play-dough numbers | 2 | `lesson-1788497218061` | Making Numbers I | Titles/structure diverge at this position; position is not identity. |
| 3 | `hello-friends-lesson-3` | Paper strip numbers I | 3 | `lesson-1788497381558` | Making numbers II | Titles/structure diverge at this position; position is not identity. |
| 4 | `hello-friends-lesson-4` | Paper strip numbers II | 4 | `lesson-1788497549906` | Making numbers III | Titles/structure diverge at this position; position is not identity. |
| 5 | `hello-friends-lesson-5` | Writing Number 1 | 5 | `lesson-1788497735406` | Handwriting I | Titles/structure diverge at this position; position is not identity. |
| 6 | `lesson-6e530491-1226-4369-8b08-27e50ef1ee2f` | Writing Number 2 | 6 | `lesson-1788497916542` | Handwriting II | Titles/structure diverge at this position; position is not identity. |
| 7 | `lesson-059f5031-6eb6-4b34-b609-ab0f9cce0780` | Writing Number 3 | 7 | `lesson-1788497980608` | Handwriting III | Titles/structure diverge at this position; position is not identity. |

### Australian States and Territories

- SP Unit: `weather`
- TMR Unit: `year-4-australia-states-and-territories`
- Provenance: **later Unit-linked SP-native**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `weather-lesson-1` | States and territories | 1 | `lesson-1788575330616` | Introduction | Titles/structure diverge at this position; position is not identity. |
| 2 | `weather-lesson-2` | I've been to... | 2 | `lesson-1788575340300` | I have been to .... | Titles/structure diverge at this position; position is not identity. |
| 3 | `weather-lesson-3` | I want to go to... | 3 | `lesson-1788575354282` | I want to go to .... | Titles/structure diverge at this position; position is not identity. |
| 4 | `weather-lesson-4` | Have you been to ...? | 4 | `lesson-1788575366471` | Have you been to ...? | Titles match, but position/title alone is not identity. |
| 5 | `weather-lesson-5` | Have you been to ...? II | 5 | `lesson-1788575377025` | Do you want to go to ...? | Titles/structure diverge at this position; position is not identity. |
| 6 | `weather-lesson-6` | Review | 6 | `lesson-1788575393609` | I live in .... | Titles/structure diverge at this position; position is not identity. |
| — | — | — | 7 | `lesson-1788575431290` | Revision | TMR-only at this position; inspect candidate/unmatched analysis. |

### Countries

- SP Unit: `nationalities`
- TMR Unit: `year-5-countries`
- Provenance: **later Unit-linked SP-native**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `nationalities-lesson-1` | Introduction | 1 | `lesson-1788328454984` | Introduction | Titles match, but position/title alone is not identity. |
| 2 | `nationalities-lesson-2` | Countries I | 2 | `lesson-1788574591953` | Countries I | Titles match, but position/title alone is not identity. |
| 3 | `nationalities-lesson-3` | Where is China? | 3 | `lesson-1788574619599` | Where is China I | Titles/structure diverge at this position; position is not identity. |
| 4 | `nationalities-lesson-4` | Countries II | 4 | `lesson-1788574651474` | Where is China II | Titles/structure diverge at this position; position is not identity. |
| 5 | `nationalities-lesson-5` | Countries III | 5 | `lesson-1788574672716` | Countries II | Titles/structure diverge at this position; position is not identity. |
| 6 | `nationalities-lesson-6` | Review | 6 | `lesson-1788574689167` | Countries III | Titles/structure diverge at this position; position is not identity. |
| — | — | — | 7 | `lesson-1788574700373` | Revision | TMR-only at this position; inspect candidate/unmatched analysis. |

### Chinese Names

- SP Unit: `travel`
- TMR Unit: `year-6-chinese-names`
- Provenance: **later Unit-linked SP-native**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `travel-lesson-1` | Typing Chinese characters | 1 | `lesson-1788082219655` | Typing Chinese characters | Titles match, but position/title alone is not identity. |
| 2 | `travel-lesson-2` | Homophones | 2 | `lesson-1788082447113` | Homophones | Titles match, but position/title alone is not identity. |
| 3 | `travel-lesson-3` | My Chinese Name I | 3 | `lesson-1788083010783` | My Chinese Name I | Titles match, but position/title alone is not identity. |
| 4 | `travel-lesson-4` | My Chinese Name II | 4 | `lesson-1788084151755` | My Chinese Name II | Titles match, but position/title alone is not identity. |
| 5 | `travel-lesson-5` | Mini Self-introduction I | 5 | `lesson-1788087277864` | Mini Self-introduction I | Titles match, but position/title alone is not identity. |

### Family

- SP Unit: `unit-f89fcb17-f9b5-4038-9955-be2e2a461c55`
- TMR Unit: `year-2-family`
- Provenance: **later Unit-linked SP-native**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `lesson-c7991263-82ec-466e-b454-952da0f71048` | Introduction | 1 | `lesson-1788760226079` | Introduction | Titles match, but position/title alone is not identity. |
| 2 | `lesson-c913759e-a856-495e-adf7-936152feac06` | Family Tree | 2 | `lesson-1788760345727` | Family Tree | Titles match, but position/title alone is not identity. |
| 3 | `lesson-93f2899f-5790-4fae-8cf0-58118aa32fcb` | My family has five people. | 3 | `lesson-1788761602623` | Family Tree II | Titles/structure diverge at this position; position is not identity. |
| 4 | `lesson-8381da89-e8f2-40ef-8d92-e398c87911af` | I have ... (in my family). | 4 | `lesson-1788760440092` | My family has five people. | Titles/structure diverge at this position; position is not identity. |
| — | — | — | 5 | `lesson-1788760525217` | My family has .... | TMR-only at this position; inspect candidate/unmatched analysis. |

### Fruit

- SP Unit: `unit-b5e690a6-3d13-4bde-9690-e451065d6f9e`
- TMR Unit: `year-3-fruit`
- Provenance: **later Unit-linked SP-native**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `lesson-746ae4ac-ce6a-4f2e-9393-e8f1ce7df440` | Introduction | 1 | `lesson-1788761840165` | Introduction | Titles match, but position/title alone is not identity. |
| 2 | `lesson-a1431c95-c3e9-46e2-91f8-d198d88a3a82` | Vocabulary Reinforcement | 2 | `lesson-1788761848014` | Vocabulary Reinforcement | Titles match, but position/title alone is not identity. |
| 3 | `lesson-6abd117d-f5bf-4934-9d25-240f9e8c89d8` | I like ... and ... | 3 | `lesson-1788761903322` | I like ... and ... | Titles match, but position/title alone is not identity. |
| — | — | — | 4 | `lesson-1788761926730` | I don't like ... or ... | TMR-only at this position; inspect candidate/unmatched analysis. |
| — | — | — | 5 | `lesson-1788761947230` | Revision | TMR-only at this position; inspect candidate/unmatched analysis. |

### Family II

- SP Unit: `unit-library-year-6-family-ii`
- TMR Unit: `year-6-family-ii`
- Provenance: **TMR-imported legacy**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `lesson-library-year-6-family-ii-1` | There are five people in my family. | 1 | `lesson-1790909455090` | There are five people in my family. | Existing stable mapping. |
| 2 | `lesson-library-year-6-family-ii-2` | I have two older brothers. | 2 | `lesson-1790920751476` | I have two older brothers. | Existing stable mapping. |

### Places at School

- SP Unit: `unit-6cb8ecc9-9a22-4be5-95d1-3641ade882d5`
- TMR Unit: `year4-australian-states-territories`
- Provenance: **TMR-imported legacy**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `lesson-b7fca415-3f22-4b8b-b97d-326849025e73` | Introduction | 1 | `lesson-1791020089176` | Introduction | Existing stable mapping. |

### Nationalities

- SP Unit: `unit-9b90b90c-3f2e-4348-834a-225fb9b8addd`
- TMR Unit: `year-5-nationalities`
- Provenance: **TMR-imported legacy**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `lesson-5a9a88bf-d49f-44de-9c78-3ba7994cb002` | Introduction | 1 | `lesson-1791023666235` | Introduction | Existing stable mapping. |
| 2 | `lesson-3685879b-dd16-4ed7-86c1-180680b99c2b` | Reinforcement | 2 | `lesson-1791023683160` | Reinforcement | Existing stable mapping. |
| 3 | `lesson-716bfb22-fd51-4de7-8184-7843f8e0672a` | What country are you from? | 3 | `lesson-1791023717813` | What country are you from? | Existing stable mapping. |
| 4 | `lesson-98a71479-2606-47b1-8306-fe144ff6fdfa` | Review | 4 | `lesson-1791023795475` | Review | Existing stable mapping. |

### Colours

- SP Unit: `unit-a25aa50c-a2f6-4035-bef6-e39e46e0b615`
- TMR Unit: `prep-colours`
- Provenance: **TMR-imported legacy**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `lesson-ab2aa64e-1f77-4087-9239-42fc53e5bb40` | Introduction | 1 | `lesson-1791024070742` | Introduction | Existing stable mapping. |
| 2 | `lesson-6a6a2af0-bb10-4f07-bf75-35f52f887995` | Reinforcement | 2 | `lesson-1791024079654` | Reinforcement | Existing stable mapping. |
| 3 | `lesson-6542ff20-3ffb-47a3-a91c-53c89f34241c` | I Can Draw a Rainbow | 3 | `lesson-1791024104024` | I Can Draw a Rainbow | Existing stable mapping. |

### Mountains and Water

- SP Unit: `unit-fb2195b5-3a83-405e-b5a8-7926303c32b4`
- TMR Unit: `year-1-mountains-and-water`
- Provenance: **TMR-imported legacy**

| SP pos | SP Lesson ID | SP title | TMR pos | TMR Lesson ID | TMR title | Initial observation |
|---:|---|---|---:|---|---|---|
| 1 | `lesson-82e17fe4-99e5-419d-ae9f-471d530bffa1` | Sun and Moon | 1 | `lesson-1791024389573` | Sun and Moon | Existing stable mapping. |
| 2 | `lesson-4466e9d6-d5b8-4ed4-988f-9afd2d00ad59` | Mountain and Water | 2 | `lesson-1791024395273` | Mountain and Water | Existing stable mapping. |

## Historical usage matrix — 31 SP-native legacy Lessons

| Unit | SP pos | SP Lesson | Current class refs | Cohort refs | Baselines | Checkpoints | Teaching Sessions | Historical dependency |
|---|---:|---|---:|---:|---:|---:|---:|---|
| Numbers | L1 | `hello-friends-lesson-1` Match and sequence | 0 | 0 | 0 | 0 | 0 | No |
| Numbers | L2 | `hello-friends-lesson-2` Pegs and play-dough numbers | 0 | 0 | 0 | 0 | 0 | No |
| Numbers | L3 | `hello-friends-lesson-3` Paper strip numbers I | 0 | 0 | 0 | 0 | 2 | Yes |
| Numbers | L4 | `hello-friends-lesson-4` Paper strip numbers II | 0 | 0 | 0 | 0 | 5 | Yes |
| Numbers | L5 | `hello-friends-lesson-5` Writing Number 1 | 0 | 0 | 0 | 0 | 3 | Yes |
| Numbers | L6 | `lesson-6e530491-1226-4369-8b08-27e50ef1ee2f` Writing Number 2 | 0 | 0 | 0 | 0 | 1 | Yes |
| Numbers | L7 | `lesson-059f5031-6eb6-4b34-b609-ab0f9cce0780` Writing Number 3 | 0 | 0 | 0 | 0 | 0 | No |
| Australian States and Territories | L1 | `weather-lesson-1` States and territories | 0 | 0 | 0 | 0 | 0 | No |
| Australian States and Territories | L2 | `weather-lesson-2` I've been to... | 0 | 0 | 0 | 0 | 0 | No |
| Australian States and Territories | L3 | `weather-lesson-3` I want to go to... | 0 | 0 | 0 | 0 | 3 | Yes |
| Australian States and Territories | L4 | `weather-lesson-4` Have you been to ...? | 0 | 0 | 0 | 0 | 4 | Yes |
| Australian States and Territories | L5 | `weather-lesson-5` Have you been to ...? II | 0 | 0 | 0 | 0 | 2 | Yes |
| Australian States and Territories | L6 | `weather-lesson-6` Review | 0 | 0 | 0 | 0 | 2 | Yes |
| Countries | L1 | `nationalities-lesson-1` Introduction | 0 | 0 | 0 | 0 | 0 | No |
| Countries | L2 | `nationalities-lesson-2` Countries I | 0 | 0 | 0 | 0 | 2 | Yes |
| Countries | L3 | `nationalities-lesson-3` Where is China? | 0 | 0 | 0 | 0 | 2 | Yes |
| Countries | L4 | `nationalities-lesson-4` Countries II | 0 | 0 | 0 | 0 | 2 | Yes |
| Countries | L5 | `nationalities-lesson-5` Countries III | 0 | 0 | 0 | 0 | 0 | No |
| Countries | L6 | `nationalities-lesson-6` Review | 0 | 0 | 0 | 0 | 0 | No |
| Chinese Names | L1 | `travel-lesson-1` Typing Chinese characters | 0 | 0 | 0 | 0 | 0 | No |
| Chinese Names | L2 | `travel-lesson-2` Homophones | 0 | 0 | 0 | 0 | 0 | No |
| Chinese Names | L3 | `travel-lesson-3` My Chinese Name I | 0 | 0 | 0 | 0 | 0 | No |
| Chinese Names | L4 | `travel-lesson-4` My Chinese Name II | 0 | 0 | 0 | 0 | 0 | No |
| Chinese Names | L5 | `travel-lesson-5` Mini Self-introduction I | 0 | 0 | 0 | 0 | 4 | Yes |
| Family | L1 | `lesson-c7991263-82ec-466e-b454-952da0f71048` Introduction | 0 | 1 | 0 | 0 | 2 | Yes |
| Family | L2 | `lesson-c913759e-a856-495e-adf7-936152feac06` Family Tree | 2 | 0 | 2 | 2 | 2 | Yes |
| Family | L3 | `lesson-93f2899f-5790-4fae-8cf0-58118aa32fcb` My family has five people. | 0 | 0 | 0 | 0 | 0 | No |
| Family | L4 | `lesson-8381da89-e8f2-40ef-8d92-e398c87911af` I have ... (in my family). | 0 | 0 | 0 | 0 | 0 | No |
| Fruit | L1 | `lesson-746ae4ac-ce6a-4f2e-9393-e8f1ce7df440` Introduction | 0 | 1 | 2 | 2 | 2 | Yes |
| Fruit | L2 | `lesson-a1431c95-c3e9-46e2-91f8-d198d88a3a82` Vocabulary Reinforcement | 2 | 0 | 0 | 0 | 0 | Yes |
| Fruit | L3 | `lesson-6abd117d-f5bf-4934-9d25-240f9e8c89d8` I like ... and ... | 0 | 0 | 0 | 0 | 0 | No |

## Candidate-only future relationships

No row in this section is an approved mapping.

### Numbers

| SP Lesson | TMR Lesson candidate(s) | Classification | Confidence | Evidence | Risk | Owner decision |
|---|---|---|---|---|---|---|
| `hello-friends-lesson-1` Match and sequence | `lesson-1788496768908` Introduction | POSSIBLE SAME LESSON — OWNER REVIEW REQUIRED | Moderate evidence | TMR notes explicitly describe sequencing and matching numbers, matching the SP title concept. Both occur at the start of the same Unit. | Different titles and SP has no learning-intention/resource metadata; position is not identity. | Required |
| `hello-friends-lesson-2` Pegs and play-dough numbers | `lesson-1788497218061` Making Numbers I | LIKELY RENAMED SAME LESSON | High evidence | TMR notes explicitly name playdough and pegs. The distinctive activities match the SP title. | Needs explicit owner approval because the SP Lesson predates Lesson-level integration. | Required |
| `hello-friends-lesson-3` Paper strip numbers I | `lesson-1788497381558` Making numbers II | LIKELY RENAMED SAME LESSON | High evidence | SP description says 1–5. TMR notes specify constructing 1–5 with paper strips. | Renamed title; no stable historic provenance ID. | Required |
| `hello-friends-lesson-4` Paper strip numbers II | `lesson-1788497549906` Making numbers III | LIKELY RENAMED SAME LESSON | High evidence | SP description says 6–10. TMR notes specify constructing 6–10 with paper strips. | Renamed title; no stable historic provenance ID. | Required |
| `hello-friends-lesson-5` Writing Number 1 | `lesson-1788497735406` Handwriting I | LIKELY RENAMED SAME LESSON | High evidence | SP title names writing Number 1. TMR Handwriting I notes explicitly identify 一. | Renamed title; no stable historic provenance ID. | Required |
| `lesson-6e530491-1226-4369-8b08-27e50ef1ee2f` Writing Number 2 | `lesson-1788497916542` Handwriting II | LIKELY RENAMED SAME LESSON | High evidence | SP title names writing Number 2. TMR Handwriting II notes explicitly identify 二. | Renamed title; no stable historic provenance ID. | Required |
| `lesson-059f5031-6eb6-4b34-b609-ab0f9cce0780` Writing Number 3 | `lesson-1788497980608` Handwriting III | LIKELY RENAMED SAME LESSON | High evidence | SP title names writing Number 3. TMR Handwriting III notes explicitly identify 三. | Renamed title; no stable historic provenance ID. | Required |

### Australian States and Territories

| SP Lesson | TMR Lesson candidate(s) | Classification | Confidence | Evidence | Risk | Owner decision |
|---|---|---|---|---|---|---|
| `weather-lesson-1` States and territories | `lesson-1788575330616` Introduction | POSSIBLE SAME LESSON — OWNER REVIEW REQUIRED | Weak evidence | Both are introductory Lessons in the same Unit. | Generic title and no supporting SP metadata; position alone is insufficient. | Required |
| `weather-lesson-2` I've been to... | `lesson-1788575340300` I have been to .... | LIKELY RENAMED SAME LESSON | High evidence | Titles are the same proposition with only contraction/punctuation variation. Surrounding sequence is consistent. | No stable historic provenance ID. | Required |
| `weather-lesson-3` I want to go to... | `lesson-1788575354282` I want to go to .... | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Distinctive titles match after punctuation normalization. The preceding and following concepts are consistent. | No stable historic provenance ID. | Required |
| `weather-lesson-4` Have you been to ...? | `lesson-1788575366471` Have you been to ...? | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Distinctive titles match after punctuation normalization. The surrounding sequence is consistent. | No stable historic provenance ID. | Required |
| `weather-lesson-5` Have you been to ...? II | `lesson-1788575366471` Have you been to ...? | POSSIBLE SPLIT | Moderate evidence | SP labels this as a second session of the same question represented by TMR Lesson 4. SP Lessons 4 and 5 may be a two-session treatment of one TMR Lesson. | Could instead be an independently authored extension; owner curriculum decision required. | Required |
| `weather-lesson-6` Review | `lesson-1788575431290` Revision | MOVED / REORDERED | High evidence | Review and Revision express the same terminal function. TMR has two intervening concepts, explaining the position shift. | Reorder/insertions mean numeric position cannot be used as identity. | Required |
| — | `lesson-1788575377025` Do you want to go to ...? | TMR-ONLY LESSON | — | No clear SP counterpart found. | Must not be inserted automatically. | Required |
| — | `lesson-1788575393609` I live in .... | TMR-ONLY LESSON | — | No clear SP counterpart found. | Must not be inserted automatically. | Required |

### Countries

| SP Lesson | TMR Lesson candidate(s) | Classification | Confidence | Evidence | Risk | Owner decision |
|---|---|---|---|---|---|---|
| `nationalities-lesson-1` Introduction | `lesson-1788328454984` Introduction | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact title in the same Unit. It anchors the same surrounding Countries sequence. | SP lacks the TMR learning-intention metadata. | Required |
| `nationalities-lesson-2` Countries I | `lesson-1788574591953` Countries I | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. The following Where is China concept is consistent. | No stable historic provenance ID. | Required |
| `nationalities-lesson-3` Where is China? | `lesson-1788574619599` Where is China I; `lesson-1788574651474` Where is China II | POSSIBLE SPLIT | Moderate evidence | SP has one broad Where is China Lesson. TMR now has Where is China I and II. | One SP Lesson may have been split into two TMR Lessons; owner must determine curriculum lineage. | Required |
| `nationalities-lesson-4` Countries II | `lesson-1788574672716` Countries II | MOVED / REORDERED | High evidence | Exact title. The position moved after the apparent Where is China split. | Numeric position differs. | Required |
| `nationalities-lesson-5` Countries III | `lesson-1788574689167` Countries III | MOVED / REORDERED | High evidence | Exact title. The sequence shift is consistent with an inserted/split Lesson. | Numeric position differs. | Required |
| `nationalities-lesson-6` Review | `lesson-1788574700373` Revision | MOVED / REORDERED | High evidence | Review and Revision have the same terminal function. Both close the same Unit sequence. | Title is not exact and position differs. | Required |

### Chinese Names

| SP Lesson | TMR Lesson candidate(s) | Classification | Confidence | Evidence | Risk | Owner decision |
|---|---|---|---|---|---|---|
| `travel-lesson-1` Typing Chinese characters | `lesson-1788082219655` Typing Chinese characters | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. All five surrounding Unit titles align in the same sequence. | No stable historic provenance ID. | Required |
| `travel-lesson-2` Homophones | `lesson-1788082447113` Homophones | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. Full Unit sequence alignment provides independent context. | No stable historic provenance ID. | Required |
| `travel-lesson-3` My Chinese Name I | `lesson-1788083010783` My Chinese Name I | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. Full Unit sequence alignment provides independent context. | No stable historic provenance ID. | Required |
| `travel-lesson-4` My Chinese Name II | `lesson-1788084151755` My Chinese Name II | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. Full Unit sequence alignment provides independent context. | No stable historic provenance ID. | Required |
| `travel-lesson-5` Mini Self-introduction I | `lesson-1788087277864` Mini Self-introduction I | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. Full Unit sequence alignment provides independent context. | No stable historic provenance ID. | Required |

### Family

| SP Lesson | TMR Lesson candidate(s) | Classification | Confidence | Evidence | Risk | Owner decision |
|---|---|---|---|---|---|---|
| `lesson-c7991263-82ec-466e-b454-952da0f71048` Introduction | `lesson-1788760226079` Introduction | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact title. Both introduce the same Unit before Family Tree. | SP lacks TMR content metadata and provenance ID. | Required |
| `lesson-c913759e-a856-495e-adf7-936152feac06` Family Tree | `lesson-1788760345727` Family Tree | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. Both follow Introduction. | SP lacks TMR content metadata and provenance ID. | Required |
| `lesson-93f2899f-5790-4fae-8cf0-58118aa32fcb` My family has five people. | `lesson-1788760440092` My family has five people. | MOVED / REORDERED | High evidence | Exact distinctive title. TMR Family Tree II appears immediately before it and explains the L3→L4 shift. | Position changed because of an apparent TMR insertion. | Required |
| `lesson-8381da89-e8f2-40ef-8d92-e398c87911af` I have ... (in my family). | `lesson-1788760525217` My family has .... | LIKELY RENAMED SAME LESSON | Moderate evidence | Both describe who is in the learner’s family. Both follow the family-size Lesson. | Wording differs and SP has no learning intention; owner confirmation is required. | Required |
| — | `lesson-1788761602623` Family Tree II | TMR-ONLY LESSON | — | No clear SP counterpart found. | Must not be inserted automatically. | Required |

### Fruit

| SP Lesson | TMR Lesson candidate(s) | Classification | Confidence | Evidence | Risk | Owner decision |
|---|---|---|---|---|---|---|
| `lesson-746ae4ac-ce6a-4f2e-9393-e8f1ce7df440` Introduction | `lesson-1788761840165` Introduction | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact title. It begins an otherwise matching three-Lesson SP sequence. | SP lacks TMR content metadata and provenance ID. | Required |
| `lesson-a1431c95-c3e9-46e2-91f8-d198d88a3a82` Vocabulary Reinforcement | `lesson-1788761848014` Vocabulary Reinforcement | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. It follows the same Introduction. | SP lacks TMR content metadata and provenance ID. | Required |
| `lesson-6abd117d-f5bf-4934-9d25-240f9e8c89d8` I like ... and ... | `lesson-1788761903322` I like ... and ... | EXACT / HIGH-CONFIDENCE SAME LESSON | High evidence | Exact distinctive title. It completes the same initial three-Lesson sequence. | SP lacks TMR content metadata and provenance ID. | Required |
| — | `lesson-1788761926730` I don't like ... or ... | TMR-ONLY LESSON | — | No clear SP counterpart found. | Must not be inserted automatically. | Required |
| — | `lesson-1788761947230` Revision | TMR-ONLY LESSON | — | No clear SP counterpart found. | Must not be inserted automatically. | Required |

## Migration blockers

| Blocker | Units | Resolution owner |
|---|---|---|
| Six SP-native Units have no Lesson provenance contract. | `hello-friends`, `weather`, `nationalities`, `travel`, `unit-f89fcb17-f9b5-4038-9955-be2e2a461c55`, `unit-b5e690a6-3d13-4bde-9690-e451065d6f9e` | **BOTH** |
| Family, Fruit, Countries and Australian States have structural divergence (insertions, extensions or possible splits). | `unit-f89fcb17-f9b5-4038-9955-be2e2a461c55`, `unit-b5e690a6-3d13-4bde-9690-e451065d6f9e`, `nationalities`, `weather` | **OWNER CONTENT DECISION** |
| Historically referenced SP Lessons cannot be deleted or replaced without orphaning operational/history references. | `hello-friends`, `weather`, `nationalities`, `travel`, `unit-f89fcb17-f9b5-4038-9955-be2e2a461c55`, `unit-b5e690a6-3d13-4bde-9690-e451065d6f9e` | **ENGINEERING DECISION** |
| Title/position similarity is candidate evidence only and cannot create identity. | `hello-friends`, `weather`, `nationalities`, `travel`, `unit-f89fcb17-f9b5-4038-9955-be2e2a461c55`, `unit-b5e690a6-3d13-4bde-9690-e451065d6f9e` | **BOTH** |
| Two distinct TMR Unit IDs use similar Australia/States naming but represent different current Units. | `weather`, `unit-6cb8ecc9-9a22-4be5-95d1-3641ade882d5` | **BOTH** |
| TMR-only Lessons need owner decisions on whether they are new curriculum, split content or future-only extensions. | `weather`, `unit-f89fcb17-f9b5-4038-9955-be2e2a461c55`, `unit-b5e690a6-3d13-4bde-9690-e451065d6f9e` | **OWNER CONTENT DECISION** |

## Should the 31 legacy Lessons receive TMR IDs?

Not categorically. Provenance IDs should only be backfilled for owner-approved pairs whose historical identity is established by multiple signals. Structurally divergent SP-native Lessons should remain historical operational records or be handled by an explicit migration table/lifecycle model.

### Option A

Backfill TMR provenance only for owner-approved, clearly matched SP Lessons.
- Advantages: Preserves SP stable IDs. Enables safe future metadata reconciliation for approved pairs.
- Risks: Can falsely rewrite provenance. Splits/reorders require more than one-to-one IDs.
- Potentially suitable: Chinese Names, Numbers for individually verified Lessons.
- Status: not chosen and not implemented.

### Option B

Use an explicit one-time mapping table during authority migration without writing provenance onto every legacy Lesson first.
- Advantages: Keeps audit decisions explicit and reversible before migration. Can represent split/reorder exceptions.
- Risks: Migration code becomes more complex. Mapping table still requires owner approval.
- Potentially suitable: Chinese Names, Numbers, Countries.
- Status: not chosen and not implemented.

### Option C

Preserve SP-native Lessons as historical operational records and create new SP-authoritative curriculum Lessons separately.
- Advantages: Protects historical truth. Avoids pretending new curriculum is identical to old teaching records.
- Risks: Requires a clear active-vs-legacy lifecycle model. Current class transitions need explicit checkpoints.
- Potentially suitable: Family, Fruit, Australian States and Territories, Countries.
- Status: not chosen and not implemented.

### Option D

Use a Unit-specific hybrid of A/B/C.
- Advantages: Fits the materially different provenance and divergence patterns.
- Risks: Requires per-Unit owner decisions and engineering safeguards.
- Potentially suitable: All six legacy Units.
- Status: not chosen and not implemented.

## Family II hotfix boundary

- Appropriate for: New-style linked Units with stable Unit and Lesson IDs, such as Family II and the four 3 Oct imports.
- Inappropriate for: SP-native legacy Lessons without stable Lesson provenance IDs.
- Year 2 Family conclusion: **B — expected limitation caused by missing legacy Lesson identity and structural divergence, not a Family II reconciliation defect.**

## Unit-by-Unit owner decision sheet

### Numbers

- Current status: **title divergence**
- SP Lessons: 7
- TMR Lessons: 7
- Stable Lesson mappings: 0
- Historically referenced SP Lessons: 4
- Provenance: later Unit-linked SP-native
- Likely issues: Unit title divergence (Numbers vs Numbers 0-10 I). Lesson titles evolved, but counts remain 7/7. Four SP Lessons have Teaching Session dependencies.
- Owner decisions needed: approve/reject candidate lineage; decide how new/split Lessons relate to the SP-native sequence.
- Engineering decisions needed: choose provenance backfill, mapping-table or legacy-lifecycle treatment without rewriting history.
- Recommended next investigation: owner review of the candidate table and actual curriculum intent.

### Australian States and Territories

- Current status: **structural divergence / ambiguous**
- SP Lessons: 6
- TMR Lessons: 7
- Stable Lesson mappings: 0
- Historically referenced SP Lessons: 4
- Provenance: later Unit-linked SP-native
- Likely issues: 6 SP Lessons vs 7 TMR Lessons. Possible repeated/split Have you been treatment. TMR adds Do you want to go and I live in concepts. Four SP Lessons have historical session dependencies.
- Owner decisions needed: approve/reject candidate lineage; decide how new/split Lessons relate to the SP-native sequence.
- Engineering decisions needed: choose provenance backfill, mapping-table or legacy-lifecycle treatment without rewriting history.
- Recommended next investigation: owner review of the candidate table and actual curriculum intent.

### Countries

- Current status: **structural divergence / ambiguous**
- SP Lessons: 6
- TMR Lessons: 7
- Stable Lesson mappings: 0
- Historically referenced SP Lessons: 3
- Provenance: later Unit-linked SP-native
- Likely issues: 6 SP Lessons vs 7 TMR Lessons. Where is China appears as one SP Lesson but I/II in TMR. Three SP Lessons have historical session dependencies.
- Owner decisions needed: approve/reject candidate lineage; decide how new/split Lessons relate to the SP-native sequence.
- Engineering decisions needed: choose provenance backfill, mapping-table or legacy-lifecycle treatment without rewriting history.
- Recommended next investigation: owner review of the candidate table and actual curriculum intent.

### Chinese Names

- Current status: **aligned**
- SP Lessons: 5
- TMR Lessons: 5
- Stable Lesson mappings: 0
- Historically referenced SP Lessons: 1
- Provenance: later Unit-linked SP-native
- Likely issues: Five titles and sequence align, but provenance remains SP-native and unmapped. Mini Self-introduction I has historical session dependencies.
- Owner decisions needed: approve/reject candidate lineage; decide how new/split Lessons relate to the SP-native sequence.
- Engineering decisions needed: choose provenance backfill, mapping-table or legacy-lifecycle treatment without rewriting history.
- Recommended next investigation: owner review of the candidate table and actual curriculum intent.

### Family

- Current status: **structural divergence / ambiguous**
- SP Lessons: 4
- TMR Lessons: 5
- Stable Lesson mappings: 0
- Historically referenced SP Lessons: 2
- Provenance: later Unit-linked SP-native
- Likely issues: TMR Family Tree II is absent from SP. SP L3 matches TMR L4 by distinctive title, proving position is not identity. Family Tree is current operational truth for two classes and checkpointed.
- Owner decisions needed: approve/reject candidate lineage; decide how new/split Lessons relate to the SP-native sequence.
- Engineering decisions needed: choose provenance backfill, mapping-table or legacy-lifecycle treatment without rewriting history.
- Recommended next investigation: owner review of the candidate table and actual curriculum intent.

### Fruit

- Current status: **structural divergence / ambiguous**
- SP Lessons: 3
- TMR Lessons: 5
- Stable Lesson mappings: 0
- Historically referenced SP Lessons: 2
- Provenance: later Unit-linked SP-native
- Likely issues: SP has the first three Lessons; TMR adds I don't like and Revision. Introduction and Vocabulary Reinforcement carry operational dependencies.
- Owner decisions needed: approve/reject candidate lineage; decide how new/split Lessons relate to the SP-native sequence.
- Engineering decisions needed: choose provenance backfill, mapping-table or legacy-lifecycle treatment without rewriting history.
- Recommended next investigation: owner review of the candidate table and actual curriculum intent.

### Family II

- Current status: **aligned**
- SP Lessons: 2
- TMR Lessons: 2
- Stable Lesson mappings: 2
- Historically referenced SP Lessons: 1
- Provenance: TMR-imported legacy
- Likely issues: No current structural divergence; serves as the stable-mapping control.
- Owner decisions needed: none for current stable mappings unless curriculum structure changes.
- Engineering decisions needed: retain current stable-ID reconciliation safeguards.
- Recommended next investigation: none beyond normal regression monitoring.

### Places at School

- Current status: **aligned**
- SP Lessons: 1
- TMR Lessons: 1
- Stable Lesson mappings: 1
- Historically referenced SP Lessons: 1
- Provenance: TMR-imported legacy
- Likely issues: No current structural divergence; one stable mapped Lesson.
- Owner decisions needed: none for current stable mappings unless curriculum structure changes.
- Engineering decisions needed: retain current stable-ID reconciliation safeguards.
- Recommended next investigation: none beyond normal regression monitoring.

### Nationalities

- Current status: **aligned**
- SP Lessons: 4
- TMR Lessons: 4
- Stable Lesson mappings: 4
- Historically referenced SP Lessons: 1
- Provenance: TMR-imported legacy
- Likely issues: No current structural divergence; four stable mapped Lessons.
- Owner decisions needed: none for current stable mappings unless curriculum structure changes.
- Engineering decisions needed: retain current stable-ID reconciliation safeguards.
- Recommended next investigation: none beyond normal regression monitoring.

### Colours

- Current status: **aligned**
- SP Lessons: 3
- TMR Lessons: 3
- Stable Lesson mappings: 3
- Historically referenced SP Lessons: 1
- Provenance: TMR-imported legacy
- Likely issues: No current structural divergence; three stable mapped Lessons.
- Owner decisions needed: none for current stable mappings unless curriculum structure changes.
- Engineering decisions needed: retain current stable-ID reconciliation safeguards.
- Recommended next investigation: none beyond normal regression monitoring.

### Mountains and Water

- Current status: **aligned**
- SP Lessons: 2
- TMR Lessons: 2
- Stable Lesson mappings: 2
- Historically referenced SP Lessons: 1
- Provenance: TMR-imported legacy
- Likely issues: No current structural divergence; two stable mapped Lessons.
- Owner decisions needed: none for current stable mappings unless curriculum structure changes.
- Engineering decisions needed: retain current stable-ID reconciliation safeguards.
- Recommended next investigation: none beyond normal regression monitoring.

## Read-only confirmation

No SP/TMR data, source code, mappings, Firebase rules, Storage, deployment or backups were modified. Only these two local audit reports were generated.

LEGACY UNIT AUDIT COMPLETE — OWNER DECISIONS REQUIRED
