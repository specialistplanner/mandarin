"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getProgressStatus,
  getTeachingSessionsForWeekday,
  getYearLevelExceptions,
  lessonLabel,
  moveProgress,
  setProgress,
  type ProgressMap,
} from "@/lib/domain";
import {
  classById,
  classes,
  initialProgress,
  subject,
  timetable,
  unitById,
  yearLevelById,
  yearLevels,
} from "@/lib/sample-data";
import { persistProgress, restoreProgress } from "@/lib/storage";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function timeLabel(time: string) {
  const [hourString, minutes] = time.split(":");
  const hour = Number(hourString);
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes}${suffix}`;
}

function StatusLabel({ current, expected }: { current: number; expected: number }) {
  const status = getProgressStatus(current, expected);
  return (
    <span className={`status status-${status.kind}`}>
      <span aria-hidden="true" className="status-dot" />
      {status.label}
    </span>
  );
}

export function DashboardApp() {
  const [progress, setProgressState] = useState<ProgressMap>(initialProgress);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setProgressState(restoreProgress(window.localStorage, initialProgress));
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) persistProgress(window.localStorage, progress);
  }, [isHydrated, progress]);

  useEffect(() => {
    if (!selectedClassId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedClassId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedClassId]);

  const teachingSessions = useMemo(
    () => getTeachingSessionsForWeekday(timetable, selectedDate.getDay()),
    [selectedDate],
  );

  const attentionCount = yearLevels.reduce((total, level) => {
    const cohort = classes.filter((item) => item.yearLevelId === level.id);
    return total + getYearLevelExceptions(cohort, progress, level.expectedLesson).length;
  }, 0);

  const selectedClass = selectedClassId ? classById[selectedClassId] : null;
  const selectedLevel = selectedClass ? yearLevelById[selectedClass.yearLevelId] : null;
  const selectedUnit = selectedLevel ? unitById[selectedLevel.currentUnitId] : null;
  const selectedLesson = selectedClass ? progress[selectedClass.id] ?? 1 : 1;

  function shiftDay(offset: number) {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + offset);
      return next;
    });
  }

  function updateSelected(delta: number) {
    if (!selectedClass || !selectedUnit) return;
    setProgressState((current) =>
      moveProgress(current, selectedClass.id, delta, selectedUnit.lessons.length),
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Specialist Planner dashboard">
          <span className="brand-mark" aria-hidden="true">SP</span>
          <span>
            <strong>Specialist Planner</strong>
            <small>{subject.name} workspace</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a className="nav-link active" href="#overview">Dashboard</a>
          <span className="nav-link unavailable" title="Calendar is a separate module and is not present in this checkout">Calendar</span>
        </nav>
        <div className="teacher-chip" aria-label="Current workspace">
          <span className="avatar">WW</span>
          <span><strong>My classes</strong><small>2026</small></span>
        </div>
      </header>

      <main id="top">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">{subject.name} · Weekly progress</p>
            <h1 id="page-title">Where is every class up to?</h1>
            <p className="intro-copy">A quick read on the week—what’s aligned, what needs attention, and what you’re teaching today.</p>
          </div>
          <div className="attention-summary">
            <span className="summary-number">{attentionCount}</span>
            <span><strong>{attentionCount === 1 ? "class needs" : "classes need"} a look</strong><small>Across 7 year levels</small></span>
          </div>
        </section>

        <section className="today-section" aria-labelledby="today-title">
          <div className="section-heading today-heading">
            <div>
              <p className="section-kicker">Teaching day</p>
              <h2 id="today-title">{dateFormatter.format(selectedDate)}</h2>
            </div>
            <div className="day-controls" aria-label="Change teaching day">
              <button type="button" onClick={() => shiftDay(-1)} aria-label="Previous day">←</button>
              <button className="today-button" type="button" onClick={() => setSelectedDate(new Date())}>Today</button>
              <button type="button" onClick={() => shiftDay(1)} aria-label="Next day">→</button>
            </div>
          </div>

          {teachingSessions.length ? (
            <div className="session-strip">
              {teachingSessions.map((session) => {
                const item = classById[session.classId!];
                const level = yearLevelById[item.yearLevelId];
                const unit = unitById[level.currentUnitId];
                const current = progress[item.id] ?? 1;
                const status = getProgressStatus(current, level.expectedLesson);
                return (
                  <button
                    type="button"
                    className={`session-card ${status.kind !== "on-track" ? "has-exception" : ""}`}
                    key={session.id}
                    onClick={() => setSelectedClassId(item.id)}
                  >
                    <span className="session-time">{timeLabel(session.startTime)}</span>
                    <span className="session-class">{item.name}</span>
                    <span className="session-unit">{unit.title}</span>
                    <span className="session-lesson">L{current} · {unit.lessons[current - 1]?.title}</span>
                    <StatusLabel current={current} expected={level.expectedLesson} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="no-sessions">
              <span aria-hidden="true">☀</span>
              <p><strong>No specialist teaching sessions</strong><br />This day is clear in the Mandarin timetable.</p>
            </div>
          )}
        </section>

        <section className="overview-section" id="overview" aria-labelledby="overview-title">
          <div className="section-heading overview-heading">
            <div>
              <p className="section-kicker">All cohorts</p>
              <h2 id="overview-title">Class progress overview</h2>
            </div>
            <div className="legend" aria-label="Progress status legend">
              <span><i className="legend-dot aligned" />Aligned</span>
              <span><i className="legend-dot attention" />Needs attention</span>
            </div>
          </div>

          <div className="year-list">
            {yearLevels.map((level) => {
              const unit = unitById[level.currentUnitId];
              const cohort = classes.filter((item) => item.yearLevelId === level.id);
              const exceptions = getYearLevelExceptions(cohort, progress, level.expectedLesson);
              return (
                <article className={`year-card ${exceptions.length ? "diverged" : "aligned"}`} key={level.id}>
                  <div className="year-identity">
                    <span className="year-badge">{level.shortLabel}</span>
                    <div><h3>{level.label}</h3><p>{unit.title}</p></div>
                  </div>
                  <div className="expected-block">
                    <span>Expected</span>
                    <strong>Lesson {level.expectedLesson}</strong>
                    <small>{unit.lessons[level.expectedLesson - 1]?.title}</small>
                  </div>
                  <div className="class-pills" aria-label={`${level.label} class progress`}>
                    {cohort.map((item) => {
                      const current = progress[item.id] ?? 1;
                      const status = getProgressStatus(current, level.expectedLesson);
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`class-pill ${status.kind}`}
                          onClick={() => setSelectedClassId(item.id)}
                          aria-label={`${item.name}, lesson ${current}, ${status.label}`}
                        >
                          <span>{item.name}</span>
                          <strong>L{current}</strong>
                          <i aria-hidden="true">{status.kind === "on-track" ? "✓" : status.kind === "behind" ? "↓" : "↑"}</i>
                        </button>
                      );
                    })}
                  </div>
                  <div className={`cohort-note ${exceptions.length ? "exception" : "calm"}`}>
                    {exceptions.length ? (
                      <><span aria-hidden="true">!</span><p><strong>{exceptions.map((item) => item.name).join(" and ")}</strong> {exceptions.length === 1 ? "is" : "are"} out of sync</p></>
                    ) : (
                      <><span aria-hidden="true">✓</span><p>All classes aligned</p></>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer>
        <span>Specialist Progress Dashboard <strong>v0.1</strong></span>
        <span>Progress is saved on this device</span>
      </footer>

      {selectedClass && selectedLevel && selectedUnit && (
        <div className="drawer-layer" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setSelectedClassId(null);
        }}>
          <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="drawer-topline">
              <span>Class progress</span>
              <button className="close-button" type="button" onClick={() => setSelectedClassId(null)} aria-label="Close class detail">×</button>
            </div>
            <div className="drawer-title">
              <span className="drawer-class-badge">{selectedClass.name}</span>
              <div><h2 id="detail-title">{selectedClass.name}</h2><p>{selectedLevel.label} · {subject.name}</p></div>
            </div>

            <div className="detail-unit">
              <span>Current unit</span>
              <strong>{selectedUnit.title}</strong>
              <StatusLabel current={selectedLesson} expected={selectedLevel.expectedLesson} />
            </div>

            <div className="lesson-detail-grid">
              <div>
                <span>Last completed</span>
                <strong>{selectedLesson === 1 ? "Not started" : `Lesson ${selectedLesson - 1}`}</strong>
                <small>{selectedLesson > 1 ? selectedUnit.lessons[selectedLesson - 2]?.title : "Ready to begin"}</small>
              </div>
              <div className="next-lesson">
                <span>Teach next</span>
                <strong>Lesson {selectedLesson}</strong>
                <small>{selectedUnit.lessons[selectedLesson - 1]?.title}</small>
              </div>
            </div>

            <div className="cohort-context">
              <span>Cohort reference</span>
              <p>Expected lesson is <strong>Lesson {selectedLevel.expectedLesson}</strong>. {classes
                .filter((item) => item.yearLevelId === selectedLevel.id && item.id !== selectedClass.id)
                .map((item) => `${item.name} is on L${progress[item.id] ?? 1}`)
                .join(" · ")}</p>
            </div>

            <div className="prototype-controls">
              <div>
                <span className="prototype-tag">Prototype controls</span>
                <h3>Adjust class progress</h3>
                <p>For testing only. Future updates will come from completed teaching sessions.</p>
              </div>
              <div className="stepper">
                <button type="button" onClick={() => updateSelected(-1)} disabled={selectedLesson <= 1}>−</button>
                <span><small>Next lesson</small><strong>{selectedLesson}</strong></span>
                <button type="button" onClick={() => updateSelected(1)} disabled={selectedLesson >= selectedUnit.lessons.length}>+</button>
              </div>
              <label className="lesson-select">
                <span>Reset to lesson</span>
                <select
                  value={selectedLesson}
                  onChange={(event) => setProgressState((current) => setProgress(current, selectedClass.id, Number(event.target.value), selectedUnit.lessons.length))}
                >
                  {selectedUnit.lessons.map((lesson) => <option key={lesson.id} value={lesson.sequence}>{lessonLabel(lesson.sequence, selectedUnit.lessons)}</option>)}
                </select>
              </label>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
