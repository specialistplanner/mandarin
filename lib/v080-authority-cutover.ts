import {
  LESSON_SCHEMA_VERSION,
  clonePlanner,
  type Lesson,
  type PlannerData,
  type Unit,
} from "./domain.ts";

/**
 * One-time v0.8 staging migration for the owner-approved Term 4 Family and
 * Fruit structures. This deliberately does not infer or assign TMR Lesson
 * provenance. SP-native IDs remain the operational and historical identity.
 */
export const V080_AUTHORITY_CUTOVER = {
  family: {
    unitId: "unit-f89fcb17-f9b5-4038-9955-be2e2a461c55",
    existingLessonIds: [
      "lesson-c7991263-82ec-466e-b454-952da0f71048",
      "lesson-c913759e-a856-495e-adf7-936152feac06",
      "lesson-93f2899f-5790-4fae-8cf0-58118aa32fcb",
      "lesson-8381da89-e8f2-40ef-8d92-e398c87911af",
    ],
    newLessonId: "lesson-v080-year-2-family-tree-ii",
  },
  fruit: {
    unitId: "unit-b5e690a6-3d13-4bde-9690-e451065d6f9e",
    existingLessonIds: [
      "lesson-746ae4ac-ce6a-4f2e-9393-e8f1ce7df440",
      "lesson-a1431c95-c3e9-46e2-91f8-d198d88a3a82",
      "lesson-6abd117d-f5bf-4934-9d25-240f9e8c89d8",
    ],
    newLessonIds: [
      "lesson-v080-year-3-fruit-dislike",
      "lesson-v080-year-3-fruit-revision",
    ],
  },
} as const;

export type V080AuthorityCutoverReport = {
  changed: boolean;
  family: { unitId: string; lessonIds: string[]; titles: string[] };
  fruit: { unitId: string; lessonIds: string[]; titles: string[] };
  preservedExistingLessonIds: string[];
  addedLessonIds: string[];
};

function unit(planner: PlannerData, unitId: string): Unit {
  const result = planner.units.find((candidate) => candidate.id === unitId);
  if (!result) throw new Error(`Required v0.8 Unit ${unitId} was not found.`);
  return result;
}

function lesson(source: Unit, lessonId: string): Lesson {
  const result = source.lessons.find((candidate) => candidate.id === lessonId);
  if (!result) throw new Error(`Required v0.8 Lesson ${lessonId} was not found.`);
  return result;
}

function assertLegacyFamily(source: Unit) {
  const ids = source.lessons.map((item) => item.id);
  const expected = [...V080_AUTHORITY_CUTOVER.family.existingLessonIds];
  const applied = [expected[0], expected[1], V080_AUTHORITY_CUTOVER.family.newLessonId, expected[2], expected[3]];
  if (JSON.stringify(ids) === JSON.stringify(applied)) {
    const appliedTitles = ["Introduction", "Family Tree", "Family Tree II", "My family has five people.", "My family has ...."];
    if (JSON.stringify(source.lessons.map((item) => item.title)) !== JSON.stringify(appliedTitles)) {
      throw new Error("Family structure changed after v0.8 migration; migration aborted.");
    }
    return;
  }
  if (JSON.stringify(ids) !== JSON.stringify(expected)) throw new Error("Family structure changed after owner approval; v0.8 migration aborted.");
  const titles = source.lessons.map((item) => item.title);
  const approved = ["Introduction", "Family Tree", "My family has five people.", "I have ... (in my family)."];
  if (JSON.stringify(titles) !== JSON.stringify(approved)) throw new Error("Family titles changed after owner approval; v0.8 migration aborted.");
}

function assertLegacyFruit(source: Unit) {
  const ids = source.lessons.map((item) => item.id);
  const expected = [...V080_AUTHORITY_CUTOVER.fruit.existingLessonIds];
  const applied = [...expected, ...V080_AUTHORITY_CUTOVER.fruit.newLessonIds];
  if (JSON.stringify(ids) === JSON.stringify(applied)) {
    const appliedTitles = ["Introduction", "Vocabulary Reinforcement", "I like ... and ...", "I don't like ... or ...", "Revision"];
    if (JSON.stringify(source.lessons.map((item) => item.title)) !== JSON.stringify(appliedTitles)) {
      throw new Error("Fruit structure changed after v0.8 migration; migration aborted.");
    }
    return;
  }
  if (JSON.stringify(ids) !== JSON.stringify(expected)) throw new Error("Fruit structure changed after owner approval; v0.8 migration aborted.");
  const titles = source.lessons.map((item) => item.title);
  const approved = ["Introduction", "Vocabulary Reinforcement", "I like ... and ..."];
  if (JSON.stringify(titles) !== JSON.stringify(approved)) throw new Error("Fruit titles changed after owner approval; v0.8 migration aborted.");
}

function newLesson(id: string, title: string, sequence: number, timestamp: string): Lesson {
  return {
    id,
    title,
    sequence,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: LESSON_SCHEMA_VERSION,
  };
}

function report(planner: PlannerData, changed: boolean): V080AuthorityCutoverReport {
  const family = unit(planner, V080_AUTHORITY_CUTOVER.family.unitId);
  const fruit = unit(planner, V080_AUTHORITY_CUTOVER.fruit.unitId);
  return {
    changed,
    family: { unitId: family.id, lessonIds: family.lessons.map((item) => item.id), titles: family.lessons.map((item) => item.title) },
    fruit: { unitId: fruit.id, lessonIds: fruit.lessons.map((item) => item.id), titles: fruit.lessons.map((item) => item.title) },
    preservedExistingLessonIds: [
      ...V080_AUTHORITY_CUTOVER.family.existingLessonIds,
      ...V080_AUTHORITY_CUTOVER.fruit.existingLessonIds,
    ],
    addedLessonIds: [
      V080_AUTHORITY_CUTOVER.family.newLessonId,
      ...V080_AUTHORITY_CUTOVER.fruit.newLessonIds,
    ],
  };
}

export function applyV080AuthorityCutover(
  planner: PlannerData,
  timestamp = new Date().toISOString(),
): { planner: PlannerData; report: V080AuthorityCutoverReport } {
  const currentFamily = unit(planner, V080_AUTHORITY_CUTOVER.family.unitId);
  const currentFruit = unit(planner, V080_AUTHORITY_CUTOVER.fruit.unitId);
  assertLegacyFamily(currentFamily);
  assertLegacyFruit(currentFruit);

  const alreadyApplied = currentFamily.lessons.some((item) => item.id === V080_AUTHORITY_CUTOVER.family.newLessonId)
    && V080_AUTHORITY_CUTOVER.fruit.newLessonIds.every((id) => currentFruit.lessons.some((item) => item.id === id));
  if (alreadyApplied) return { planner, report: report(planner, false) };

  const next = clonePlanner(planner);
  const family = unit(next, V080_AUTHORITY_CUTOVER.family.unitId);
  const fruit = unit(next, V080_AUTHORITY_CUTOVER.fruit.unitId);

  const [familyIntroduction, familyTree, familyCount, familyMembers] = V080_AUTHORITY_CUTOVER.family.existingLessonIds.map((id) => lesson(family, id));
  family.lessons = [
    { ...familyIntroduction, sequence: 1 },
    { ...familyTree, sequence: 2 },
    newLesson(V080_AUTHORITY_CUTOVER.family.newLessonId, "Family Tree II", 3, timestamp),
    { ...familyCount, sequence: 4 },
    { ...familyMembers, sequence: 5, title: "My family has ....", updatedAt: timestamp },
  ];
  family.updatedAt = timestamp;

  const [fruitIntroduction, fruitVocabulary, fruitLikes] = V080_AUTHORITY_CUTOVER.fruit.existingLessonIds.map((id) => lesson(fruit, id));
  fruit.lessons = [
    { ...fruitIntroduction, sequence: 1 },
    { ...fruitVocabulary, sequence: 2 },
    { ...fruitLikes, sequence: 3 },
    newLesson(V080_AUTHORITY_CUTOVER.fruit.newLessonIds[0], "I don't like ... or ...", 4, timestamp),
    newLesson(V080_AUTHORITY_CUTOVER.fruit.newLessonIds[1], "Revision", 5, timestamp),
  ];
  fruit.updatedAt = timestamp;
  next.updatedAt = timestamp;

  return { planner: next, report: report(next, true) };
}
