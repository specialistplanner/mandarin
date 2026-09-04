import assert from "node:assert/strict";
import test from "node:test";
import { getProgressStatus, materializeTeachingSessionsForDate, recordTeachingSessionOutcome, setLessonExternalResource, setUnitExternalResource } from "../lib/domain.ts";
import { exportPlannerData, importPlannerData, migrateV7PlannerData } from "../lib/storage.ts";
import { freshSamplePlanner } from "../lib/sample-data.ts";
import {
  UNIT_LIBRARY_PROVIDER,
  findLinkedLesson,
  findLinkedUnit,
  lessonReference,
  parseUnitLibraryIndex,
  referenceDeepLink,
  unitLibraryDeepLink,
  unitReference,
} from "../lib/unit-library.ts";

const library = parseUnitLibraryIndex({
  schemaVersion: 1,
  provider: UNIT_LIBRARY_PROVIDER,
  generatedAt: "2026-09-04T00:00:00.000Z",
  units: [
    {
      id: "library-nationalities",
      yearLevel: 5,
      title: "Nationalities",
      url: "https://themandarinroom.github.io/units/view.html?unit=library-nationalities",
      lessons: [
        { id: "library-nationalities-l3", title: "Nationalities", url: "https://themandarinroom.github.io/units/view.html?unit=library-nationalities&lesson=library-nationalities-l3" },
        { id: "library-nationalities-l4", title: "Where are you from?", url: "https://themandarinroom.github.io/units/view.html?unit=library-nationalities&lesson=library-nationalities-l4" },
      ],
    },
    {
      id: "library-countries",
      yearLevel: 5,
      title: "Countries",
      url: "https://themandarinroom.github.io/units/view.html?unit=library-countries",
      lessons: [{ id: "library-countries-l1", title: "Introduction", url: "https://themandarinroom.github.io/units/view.html?unit=library-countries&lesson=library-countries-l1" }],
    },
  ],
});

function linkedPlanner() {
  let planner = freshSamplePlanner();
  planner = setUnitExternalResource(planner, "nationalities", unitReference(library.units[0]));
  return setLessonExternalResource(planner, "nationalities", "nationalities-lesson-4", lessonReference(library.units[0], library.units[0].lessons[1]));
}

test("1. Planner Unit stores a stable provider and Unit ID reference", () => {
  const unit = linkedPlanner().units.find(item => item.id === "nationalities");
  assert.deepEqual(unit.externalResourceRef, unitReference(library.units[0]));
});

test("2. Planner Lesson stores a stable Lesson ID beneath its linked Unit", () => {
  const lesson = linkedPlanner().units.find(item => item.id === "nationalities").lessons[3];
  assert.equal(lesson.externalResourceRef.resourceId, "library-nationalities-l4");
  assert.equal(lesson.externalResourceRef.parentResourceId, "library-nationalities");
});

test("3. partial mapping leaves every unmapped Lesson local-only", () => {
  const lessons = linkedPlanner().units.find(item => item.id === "nationalities").lessons;
  assert.equal(lessons.filter(lesson => lesson.externalResourceRef).length, 1);
  assert.equal(lessons[2].externalResourceRef, undefined);
});

test("4. local-only Units remain valid without any external reference", () => {
  const planner = freshSamplePlanner();
  assert.equal(planner.units.find(item => item.id === "weather").externalResourceRef, undefined);
  assert.equal(importPlannerData(exportPlannerData(planner)).units.length, planner.units.length);
});

test("5. deep links address exact stable Unit and Lesson IDs", () => {
  assert.equal(unitLibraryDeepLink("unit / 五", "lesson & 4"), "https://themandarinroom.github.io/units/view.html?unit=unit+%2F+%E4%BA%94&lesson=lesson+%26+4");
});

test("6. Week and Progress actions can derive a new-tab resource URL from the reference alone", () => {
  const reference = linkedPlanner().units.find(item => item.id === "nationalities").lessons[3].externalResourceRef;
  assert.equal(referenceDeepLink(reference), library.units[0].lessons[1].url);
});

test("7. a deleted or missing Library Unit resolves unavailable without damaging the Planner", () => {
  const unit = linkedPlanner().units.find(item => item.id === "nationalities");
  assert.equal(findLinkedUnit({ ...library, units: [] }, unit.externalResourceRef), undefined);
  assert.equal(unit.title, "Nationalities");
});

test("8. a deleted or missing Library Lesson resolves unavailable while its Unit remains linked", () => {
  const planner = linkedPlanner();
  const unit = planner.units.find(item => item.id === "nationalities");
  assert.equal(findLinkedLesson({ ...library, units: [{ ...library.units[0], lessons: [] }] }, unit.lessons[3].externalResourceRef), undefined);
  assert.equal(findLinkedUnit(library, unit.externalResourceRef).id, "library-nationalities");
});

test("9. changing a Unit link clears incompatible Lesson mappings only", () => {
  const before = linkedPlanner();
  const progress = structuredClone(before.classProgress);
  const after = setUnitExternalResource(before, "nationalities", unitReference(library.units[1]));
  assert.equal(after.units.find(item => item.id === "nationalities").lessons.some(lesson => lesson.externalResourceRef), false);
  assert.deepEqual(after.classProgress, progress);
});

test("10. removing a Unit link preserves progress, baselines, checkpoints, and history", () => {
  let before = materializeTeachingSessionsForDate(linkedPlanner(), new Date(2026, 8, 9, 12));
  const session = before.teachingSessions.find(item => item.classId === "5e" && item.date === "2026-09-09");
  before = recordTeachingSessionOutcome(before, session.id, "completed");
  const snapshots = structuredClone({ progress: before.classProgress, baselines: before.progressBaselines, checkpoints: before.progressCheckpoints, sessions: before.teachingSessions });
  const after = setUnitExternalResource(before, "nationalities", undefined);
  assert.deepEqual({ progress: after.classProgress, baselines: after.progressBaselines, checkpoints: after.progressCheckpoints, sessions: after.teachingSessions }, snapshots);
});

test("11. status remains independently understandable after a resource link changes", () => {
  const before = getProgressStatus(3, 4);
  const planner = setUnitExternalResource(linkedPlanner(), "nationalities", unitReference(library.units[1]));
  assert.deepEqual(getProgressStatus(3, 4), before);
  assert.equal(planner.classProgress["5e"].lessonId, "nationalities-lesson-4");
});

test("12. JSON export and import preserve stable Unit and Lesson references", () => {
  const restored = importPlannerData(exportPlannerData(linkedPlanner()));
  const unit = restored.units.find(item => item.id === "nationalities");
  assert.equal(unit.externalResourceRef.resourceId, "library-nationalities");
  assert.equal(unit.lessons[3].externalResourceRef.resourceId, "library-nationalities-l4");
});

test("13. v0.4.2 migration preserves all planning data and introduces no guessed links", () => {
  const legacy = freshSamplePlanner();
  legacy.schemaVersion = 7;
  const migrated = migrateV7PlannerData(legacy);
  assert.deepEqual(migrated.classProgress, legacy.classProgress);
  assert.deepEqual(migrated.teachingSessions, legacy.teachingSessions);
  assert.equal(migrated.units.some(unit => unit.externalResourceRef), false);
});

test("14. a Lesson cannot map to a different external Unit", () => {
  const planner = setUnitExternalResource(freshSamplePlanner(), "nationalities", unitReference(library.units[0]));
  assert.throws(() => setLessonExternalResource(planner, "nationalities", "nationalities-lesson-4", lessonReference(library.units[1], library.units[1].lessons[0])), /linked Unit Library unit/);
});

test("15. classes on a different actual Unit resolve resources from that Unit, not the cohort reference", () => {
  let planner = linkedPlanner();
  planner.classProgress["5c"] = { classId: "5c", unitId: "weather", lessonId: "weather-lesson-3" };
  planner = setUnitExternalResource(planner, "weather", unitReference(library.units[1]));
  planner = setLessonExternalResource(planner, "weather", "weather-lesson-3", lessonReference(library.units[1], library.units[1].lessons[0]));
  const actual = planner.units.find(unit => unit.id === planner.classProgress["5c"].unitId);
  assert.equal(actual.lessons[2].externalResourceRef.parentResourceId, "library-countries");
  assert.equal(planner.yearLevels.find(level => level.id === "year-5").currentUnitId, "nationalities");
});

test("16. recording Completed advances Planner progress and never mutates the resource reference", () => {
  let planner = materializeTeachingSessionsForDate(linkedPlanner(), new Date(2026, 8, 9, 12));
  const session = planner.teachingSessions.find(item => item.classId === "5e" && item.date === "2026-09-09");
  const reference = structuredClone(planner.units.find(item => item.id === "nationalities").lessons[3].externalResourceRef);
  planner = recordTeachingSessionOutcome(planner, session.id, "completed");
  assert.equal(planner.classProgress["5e"].lessonId, "nationalities-lesson-5");
  assert.deepEqual(planner.units.find(item => item.id === "nationalities").lessons[3].externalResourceRef, reference);
});
