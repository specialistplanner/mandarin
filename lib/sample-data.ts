import { PLANNER_SCHEMA_VERSION, type Lesson, type PlannerData, type TimetableSession } from "./domain.ts";

function lessons(unitId: string, titles: string[]): Lesson[] {
  return titles.map((title, index) => ({ id: `${unitId}-lesson-${index + 1}`, title, sequence: index + 1 }));
}

const subject = { id: "mandarin", name: "Mandarin" };
const units = [
  { id: "hello-friends", yearLevelId: "prep", title: "Hello, Friends!", description: "Greetings and classroom language", lessons: lessons("hello-friends", ["Hello", "My name is…", "How are you?", "Classroom greetings", "Review"]) },
  { id: "my-family", yearLevelId: "year-1", title: "My Family", description: "Introducing family members", lessons: lessons("my-family", ["Family words", "This is my…", "Brothers and sisters", "Family portraits", "Review"]) },
  { id: "animals", yearLevelId: "year-2", title: "Amazing Animals", description: "Animals, preferences and habitats", lessons: lessons("animals", ["Animal names", "Big and small", "I like…", "Animal habitats", "Class survey", "Review"]) },
  { id: "daily-life", yearLevelId: "year-3", title: "My Day", description: "Daily routines and time", lessons: lessons("daily-life", ["Morning routines", "Telling time", "School day", "After school", "My timetable", "Review"]) },
  { id: "weather", yearLevelId: "year-4", title: "Weather", description: "Weather, seasons and clothing", lessons: lessons("weather", ["Weather words", "What is the weather?", "Seasons", "Weather report", "What should I wear?", "Review"]) },
  { id: "nationalities", yearLevelId: "year-5", title: "Nationalities", description: "Countries, nationalities and home", lessons: lessons("nationalities", ["Introduction", "Countries", "Nationalities", "Where are you from?", "Where do you live?", "Review"]) },
  { id: "travel", yearLevelId: "year-6", title: "Let’s Travel", description: "Travel plans and practical language", lessons: lessons("travel", ["Places to go", "Transport", "Buying a ticket", "Directions", "Travel plans", "Review"]) },
];

const yearLevels = [
  { id: "prep", label: "Prep", shortLabel: "P", currentUnitId: "hello-friends", expectedLessonId: "hello-friends-lesson-3" },
  { id: "year-1", label: "Year 1", shortLabel: "1", currentUnitId: "my-family", expectedLessonId: "my-family-lesson-3" },
  { id: "year-2", label: "Year 2", shortLabel: "2", currentUnitId: "animals", expectedLessonId: "animals-lesson-4" },
  { id: "year-3", label: "Year 3", shortLabel: "3", currentUnitId: "daily-life", expectedLessonId: "daily-life-lesson-3" },
  { id: "year-4", label: "Year 4", shortLabel: "4", currentUnitId: "weather", expectedLessonId: "weather-lesson-3" },
  { id: "year-5", label: "Year 5", shortLabel: "5", currentUnitId: "nationalities", expectedLessonId: "nationalities-lesson-4" },
  { id: "year-6", label: "Year 6", shortLabel: "6", currentUnitId: "travel", expectedLessonId: "travel-lesson-4" },
];

const classes = [
  { id: "prep-e", name: "Prep E", yearLevelId: "prep" }, { id: "prep-c", name: "Prep C", yearLevelId: "prep" }, { id: "prep-b", name: "Prep B", yearLevelId: "prep" },
  { id: "1c", name: "1C", yearLevelId: "year-1" }, { id: "1d", name: "1D", yearLevelId: "year-1" },
  { id: "2c", name: "2C", yearLevelId: "year-2" }, { id: "2a", name: "2A", yearLevelId: "year-2" },
  { id: "3a", name: "3A", yearLevelId: "year-3" }, { id: "3b", name: "3B", yearLevelId: "year-3" },
  { id: "4c", name: "4C", yearLevelId: "year-4" }, { id: "4b", name: "4B", yearLevelId: "year-4" }, { id: "4e", name: "4E", yearLevelId: "year-4" },
  { id: "5e", name: "5E", yearLevelId: "year-5" }, { id: "5c", name: "5C", yearLevelId: "year-5" },
  { id: "6b", name: "6B", yearLevelId: "year-6" }, { id: "6d", name: "6D", yearLevelId: "year-6" },
];

const nextLesson = (classId: string, unitId: string, position: number) => [classId, { classId, unitId, lessonId: `${unitId}-lesson-${position}` }];

const teaching = (id: string, weekday: number, startTime: string, endTime: string, classId: string): TimetableSession => ({
  id, weekday, startTime, endTime, classId, subjectId: subject.id, type: "specialist-teaching",
});

const timetableSessions: TimetableSession[] = [
  teaching("mon-6b", 1, "11:15", "12:15", "6b"), teaching("mon-6d", 1, "12:15", "13:15", "6d"),
  teaching("tue-4c", 2, "08:55", "09:55", "4c"), teaching("tue-4b", 2, "09:55", "10:55", "4b"),
  teaching("wed-5e", 3, "08:55", "09:55", "5e"), teaching("wed-5c", 3, "09:55", "10:55", "5c"), teaching("wed-2c", 3, "11:15", "12:15", "2c"), teaching("wed-2a", 3, "12:15", "13:15", "2a"),
  teaching("thu-1c", 4, "09:55", "10:55", "1c"), teaching("thu-prep-e", 4, "11:15", "12:15", "prep-e"), teaching("thu-prep-c", 4, "12:15", "13:15", "prep-c"), teaching("thu-4e", 4, "14:15", "15:15", "4e"),
  teaching("fri-3a", 5, "08:55", "09:55", "3a"), teaching("fri-3b", 5, "09:55", "10:55", "3b"), teaching("fri-1d", 5, "11:15", "12:15", "1d"), teaching("fri-prep-b", 5, "12:15", "13:15", "prep-b"),
  { id: "sample-cover", weekday: 1, startTime: "09:00", endTime: "10:00", classId: "prep-b", type: "cover-release", label: "Prep B cover" },
];

const classProgress = Object.fromEntries([
  nextLesson("prep-e", "hello-friends", 3), nextLesson("prep-c", "hello-friends", 3), nextLesson("prep-b", "hello-friends", 3),
  nextLesson("1c", "my-family", 3), nextLesson("1d", "my-family", 3), nextLesson("2c", "animals", 4), nextLesson("2a", "animals", 4),
  nextLesson("3a", "daily-life", 3), nextLesson("3b", "daily-life", 3), nextLesson("4c", "weather", 3), nextLesson("4b", "weather", 3), nextLesson("4e", "weather", 2),
  nextLesson("5e", "nationalities", 4), nextLesson("5c", "nationalities", 4), nextLesson("6b", "travel", 4), nextLesson("6d", "travel", 5),
]);

export const samplePlanner: PlannerData = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  id: "local-specialist-planner",
  subjects: [subject],
  activeSubjectId: subject.id,
  yearLevels,
  classes,
  units,
  classProgress,
  progressBaselines: JSON.parse(JSON.stringify(classProgress)),
  timetableSessions,
  teachingSessions: [],
  trialNotes: [],
  updatedAt: "2026-08-23T00:00:00.000Z",
};

export function createBlankPlanner(): PlannerData {
  return {
    schemaVersion: PLANNER_SCHEMA_VERSION,
    id: "local-specialist-planner",
    subjects: [{ id: "subject-1", name: "My subject" }],
    activeSubjectId: "subject-1",
    yearLevels: [],
    classes: [],
    units: [],
    classProgress: {},
    progressBaselines: {},
    timetableSessions: [],
    teachingSessions: [],
    trialNotes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function freshSamplePlanner(): PlannerData {
  return JSON.parse(JSON.stringify(samplePlanner)) as PlannerData;
}
