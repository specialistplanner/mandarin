"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCohortProgressStatus,
  getTeachingSessionsForWeekday,
  lessonPosition,
  setClassLesson,
  touchPlanner,
  type PlannerData,
  type Unit,
} from "@/lib/domain";
import { createBlankPlanner, freshSamplePlanner, samplePlanner } from "@/lib/sample-data";
import { loadPlanner, persistPlanner } from "@/lib/storage";
import { SetupView } from "./setup-view";

const dateFormatter = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" });

function makeId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
function timeLabel(time: string) {
  const [hourString, minutes] = time.split(":");
  const hour = Number(hourString);
  return `${hour % 12 || 12}:${minutes}${hour >= 12 ? "pm" : "am"}`;
}

function StatusLabel({ current, expected, currentUnitId, expectedUnitId }: { current: number; expected: number; currentUnitId: string; expectedUnitId: string }) {
  const status = getCohortProgressStatus(currentUnitId, current, expectedUnitId, expected);
  return <span className={`status status-${status.kind}`}><span aria-hidden="true" className="status-dot" />{status.label}</span>;
}

export function DashboardApp() {
  const [planner, setPlanner] = useState<PlannerData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "empty" | "ready">("loading");
  const [migrationNotice, setMigrationNotice] = useState(false);
  const [view, setView] = useState<"dashboard" | "setup">("dashboard");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [quickNote, setQuickNote] = useState<{ classId?: string; context: string } | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");

  useEffect(() => {
    const loaded = loadPlanner(window.localStorage, samplePlanner);
    if (!loaded.planner) { setLoadState("empty"); return; }
    setPlanner(loaded.planner);
    setLoadState("ready");
    if (loaded.source === "migrated-v1" || loaded.source === "migrated-v2") {
      persistPlanner(window.localStorage, loaded.planner);
      setMigrationNotice(true);
    }
  }, []);

  useEffect(() => {
    if (loadState !== "ready" || !planner) return;
    try { persistPlanner(window.localStorage, planner); } catch { /* Keep last valid saved state while a field is mid-edit. */ }
  }, [planner, loadState]);

  useEffect(() => {
    if (!selectedClassId && !quickNote) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") quickNote ? setQuickNote(null) : setSelectedClassId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedClassId, quickNote]);

  if (loadState === "loading") return <div className="loading-screen"><span className="brand-mark">SP</span><p>Opening your planner…</p></div>;

  if (loadState === "empty" || !planner) {
    return <main className="onboarding-screen">
      <div className="onboarding-card">
        <span className="brand-mark">SP</span>
        <p className="eyebrow">Specialist Planner v0.2.1</p>
        <h1>Make it yours.</h1>
        <p>Start with the Mandarin demonstration or begin with a blank planner. Either way, your data stays in this browser.</p>
        <div className="onboarding-actions">
          <button className="primary-button" type="button" onClick={() => { setPlanner(createBlankPlanner()); setLoadState("ready"); setView("setup"); }}>Start blank planner</button>
          <button className="secondary-button" type="button" onClick={() => { setPlanner(freshSamplePlanner()); setLoadState("ready"); }}>Explore sample data</button>
        </div>
        <small>You can import a backup later from Setup.</small>
      </div>
    </main>;
  }

  const activeSubject = planner.subjects.find((item) => item.id === planner.activeSubjectId)!;
  const classById = Object.fromEntries(planner.classes.map((item) => [item.id, item]));
  const yearLevelById = Object.fromEntries(planner.yearLevels.map((item) => [item.id, item]));
  const unitById = Object.fromEntries(planner.units.map((item) => [item.id, item]));
  const teachingSessions = getTeachingSessionsForWeekday(planner.timetableSessions, selectedDate.getDay());

  const unitForClass = (classId: string) => unitById[planner.classProgress[classId]?.unitId];
  const positionForClass = (classId: string, unit = unitForClass(classId)) => unit ? lessonPosition(unit, planner.classProgress[classId]?.lessonId) : 1;
  const expectedForLevel = (levelId: string, unit: Unit) => lessonPosition(unit, yearLevelById[levelId]?.expectedLessonId);
  const attentionCount = planner.yearLevels.reduce((total, level) => {
    const unit = level.currentUnitId ? unitById[level.currentUnitId] : undefined;
    if (!unit) return total;
    const expected = expectedForLevel(level.id, unit);
    return total + planner.classes.filter((item) => {
      if (item.yearLevelId !== level.id) return false;
      const classUnit = unitForClass(item.id);
      return !classUnit || getCohortProgressStatus(classUnit.id, positionForClass(item.id, classUnit), unit.id, expected).kind !== "on-track";
    }).length;
  }, 0);

  const selectedClass = selectedClassId ? classById[selectedClassId] : null;
  const selectedLevel = selectedClass ? yearLevelById[selectedClass.yearLevelId] : null;
  const selectedUnit = selectedClass ? unitForClass(selectedClass.id) : null;
  const selectedCohortUnit = selectedLevel?.currentUnitId ? unitById[selectedLevel.currentUnitId] : null;
  const selectedPosition = selectedClass && selectedUnit ? positionForClass(selectedClass.id, selectedUnit) : 1;
  const selectedExpected = selectedLevel && selectedCohortUnit ? expectedForLevel(selectedLevel.id, selectedCohortUnit) : 1;

  function choosePlanner(next: PlannerData) { setPlanner(next); setLoadState("ready"); }
  function shiftDay(offset: number) {
    setSelectedDate((current) => { const next = new Date(current); next.setDate(next.getDate() + offset); return next; });
  }
  function shiftSelected(delta: number) {
    if (!planner || !selectedClass || !selectedUnit) return;
    const target = Math.min(Math.max(selectedPosition + delta, 1), selectedUnit.lessons.length);
    setPlanner(setClassLesson(planner, selectedClass.id, selectedUnit.lessons[target - 1].id));
  }
  function saveQuickNote() {
    if (!planner || !quickNote || !quickNoteText.trim()) return;
    setPlanner(touchPlanner({
      ...planner,
      trialNotes: [{ id: makeId("note"), text: quickNoteText.trim(), createdAt: new Date().toISOString(), context: quickNote.context, classId: quickNote.classId }, ...planner.trialNotes],
    }));
    setQuickNote(null);
    setQuickNoteText("");
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand brand-button" type="button" onClick={() => setView("dashboard")} aria-label="Specialist Planner dashboard">
        <span className="brand-mark" aria-hidden="true">SP</span>
        <span><strong>Specialist Planner</strong><small>{activeSubject.name || "Untitled subject"} · Live trial</small></span>
      </button>
      <nav aria-label="Primary navigation">
        <button className={`nav-link ${view === "dashboard" ? "active" : ""}`} type="button" onClick={() => setView("dashboard")}>Dashboard</button>
        <span className="nav-link unavailable" title="Calendar remains separate future work">Calendar</span>
        <button className={`nav-link ${view === "setup" ? "active" : ""}`} type="button" onClick={() => setView("setup")}>Setup</button>
      </nav>
      <button className="quick-note-button" type="button" onClick={() => setQuickNote({ context: view === "setup" ? "Setup" : "Dashboard" })}>＋ Quick note</button>
    </header>

    {migrationNotice && <div className="migration-banner">Your existing class units and lesson progress were safely migrated to v0.2.1.<button type="button" onClick={() => setMigrationNotice(false)}>×</button></div>}

    {view === "setup" ? <SetupView planner={planner} onChange={choosePlanner} onBack={() => setView("dashboard")} /> : <main id="top">
      <section className="intro" aria-labelledby="page-title">
        <div><p className="eyebrow">{activeSubject.name || "Untitled subject"} · Weekly progress</p><h1 id="page-title">Where is every class up to?</h1><p className="intro-copy">A quick read on the week—what’s aligned, what needs attention, and what you’re teaching today.</p></div>
        <div className="attention-summary"><span className="summary-number">{attentionCount}</span><span><strong>{attentionCount === 1 ? "class needs" : "classes need"} a look</strong><small>Across {planner.yearLevels.length} year {planner.yearLevels.length === 1 ? "level" : "levels"}</small></span></div>
      </section>

      {!planner.yearLevels.length ? <section className="dashboard-empty"><span className="year-badge">1</span><div><h2>Your dashboard is ready for setup</h2><p>Add year levels, units, lessons, classes and your weekly timetable. You can return here at any time.</p></div><button className="primary-button" type="button" onClick={() => setView("setup")}>Open Setup</button></section> : <>
        <section className="today-section" aria-labelledby="today-title">
          <div className="section-heading today-heading"><div><p className="section-kicker">Teaching day</p><h2 id="today-title">{dateFormatter.format(selectedDate)}</h2></div><div className="day-controls" aria-label="Change teaching day"><button type="button" onClick={() => shiftDay(-1)} aria-label="Previous day">←</button><button className="today-button" type="button" onClick={() => setSelectedDate(new Date())}>Today</button><button type="button" onClick={() => shiftDay(1)} aria-label="Next day">→</button></div></div>
          {teachingSessions.length ? <div className="session-strip">{teachingSessions.map((session) => {
            const item = classById[session.classId!];
            const level = item ? yearLevelById[item.yearLevelId] : undefined;
            const cohortUnit = level?.currentUnitId ? unitById[level.currentUnitId] : undefined;
            const unit = item ? unitForClass(item.id) : undefined;
            const current = item && unit ? positionForClass(item.id, unit) : 1;
            const expected = level && cohortUnit ? expectedForLevel(level.id, cohortUnit) : 1;
            const status = unit && cohortUnit ? getCohortProgressStatus(unit.id, current, cohortUnit.id, expected) : null;
            return <button type="button" className={`session-card ${status && status.kind !== "on-track" ? "has-exception" : ""}`} key={session.id} onClick={() => item && setSelectedClassId(item.id)}>
              <span className="session-time">{timeLabel(session.startTime)}–{timeLabel(session.endTime)}</span><span className="session-class">{item?.name ?? "Missing class"}</span><span className="session-year">{level?.label}</span>
              {unit && cohortUnit ? <><span className="session-unit">{unit.title}</span><span className="session-lesson">Teach next: L{current} · {unit.lessons[current - 1]?.title}</span><StatusLabel current={current} expected={expected} currentUnitId={unit.id} expectedUnitId={cohortUnit.id} /></> : <span className="session-lesson">Unit needs setup</span>}
            </button>;
          })}</div> : <div className="no-sessions"><span aria-hidden="true">☀</span><p><strong>No specialist teaching sessions</strong><br />This day is clear in the {activeSubject.name || "specialist"} timetable.</p></div>}
        </section>

        <section className="overview-section" id="overview" aria-labelledby="overview-title">
          <div className="section-heading overview-heading"><div><p className="section-kicker">All cohorts</p><h2 id="overview-title">Class progress overview</h2></div><div className="legend" aria-label="Progress status legend"><span><i className="legend-dot aligned" />Aligned</span><span><i className="legend-dot attention" />Needs attention</span></div></div>
          <div className="year-list">{planner.yearLevels.map((level) => {
            const unit = level.currentUnitId ? unitById[level.currentUnitId] : undefined;
            const cohort = planner.classes.filter((item) => item.yearLevelId === level.id);
            if (!unit) return <article className="year-card needs-setup" key={level.id}><div className="year-identity"><span className="year-badge">{level.shortLabel}</span><div><h3>{level.label}</h3><p>No current unit</p></div></div><button className="secondary-button" type="button" onClick={() => setView("setup")}>Complete setup</button></article>;
            const expected = expectedForLevel(level.id, unit);
            const exceptions = cohort.filter((item) => {
              const classUnit = unitForClass(item.id);
              return !classUnit || getCohortProgressStatus(classUnit.id, positionForClass(item.id, classUnit), unit.id, expected).kind !== "on-track";
            });
            return <article className={`year-card ${exceptions.length ? "diverged" : "aligned"}`} key={level.id}>
              <div className="year-identity"><span className="year-badge">{level.shortLabel}</span><div><h3>{level.label}</h3><p>{unit.title}</p></div></div>
              <div className="expected-block"><span>Expected / teach next</span><strong>Lesson {expected}</strong><small>{unit.lessons[expected - 1]?.title}</small></div>
              <div className="class-pills" aria-label={`${level.label} class progress`}>{cohort.map((item) => {
                const classUnit = unitForClass(item.id) ?? unit;
                const current = positionForClass(item.id, classUnit);
                const status = getCohortProgressStatus(classUnit.id, current, unit.id, expected);
                return <button type="button" key={item.id} className={`class-pill ${status.kind}`} onClick={() => setSelectedClassId(item.id)} aria-label={`${item.name}, ${classUnit.title}, teach lesson ${current} next, ${status.label}`}><span className="class-pill-copy"><b>{item.name}</b><small>{classUnit.title}</small></span><strong>L{current}</strong><i aria-hidden="true">{status.kind === "on-track" ? "✓" : status.kind === "behind" ? "↓" : status.kind === "ahead" ? "↑" : "↔"}</i></button>;
              })}</div>
              <div className={`cohort-note ${exceptions.length ? "exception" : "calm"}`}>{exceptions.length ? <><span aria-hidden="true">!</span><p><strong>{exceptions.map((item) => item.name).join(" and ")}</strong> {exceptions.length === 1 ? "is" : "are"} out of sync</p></> : <><span aria-hidden="true">✓</span><p>{cohort.length ? "All classes aligned" : "No classes yet"}</p></>}</div>
            </article>;
          })}</div>
        </section>
      </>}
    </main>}

    <footer><span>Specialist Planner <strong>v0.2.1 Live Trial</strong></span><span>Saved locally on this device · <button type="button" onClick={() => setView("setup")}>Backup in Setup</button></span></footer>

    {selectedClass && selectedLevel && <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSelectedClassId(null)}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-topline"><span>Class progress</span><button className="close-button" type="button" onClick={() => setSelectedClassId(null)} aria-label="Close class detail">×</button></div>
        <div className="drawer-title"><span className="drawer-class-badge">{selectedClass.name}</span><div><h2 id="detail-title">{selectedClass.name}</h2><p>{selectedLevel.label} · {activeSubject.name}</p></div></div>
        {!selectedUnit ? <div className="drawer-empty"><h3>No current unit</h3><p>Add a unit in Setup before setting progress.</p><button className="primary-button" type="button" onClick={() => { setSelectedClassId(null); setView("setup"); }}>Open Setup</button></div> : <>
          <div className="detail-unit"><span>Actual current unit</span><strong>{selectedUnit.title}</strong>{selectedCohortUnit && <StatusLabel current={selectedPosition} expected={selectedExpected} currentUnitId={selectedUnit.id} expectedUnitId={selectedCohortUnit.id} />}</div>
          <div className="lesson-detail-grid"><div><span>Last completed</span><strong>{selectedPosition === 1 ? "Not started" : `Lesson ${selectedPosition - 1}`}</strong><small>{selectedPosition > 1 ? selectedUnit.lessons[selectedPosition - 2]?.title : "Ready to begin"}</small></div><div className="next-lesson"><span>Teach next</span><strong>Lesson {selectedPosition}</strong><small>{selectedUnit.lessons[selectedPosition - 1]?.title}</small></div></div>
          <div className={`cohort-context ${selectedCohortUnit && selectedCohortUnit.id !== selectedUnit.id ? "unit-mismatch" : ""}`}><span>Cohort reference</span>{selectedCohortUnit ? <p>The cohort expects <strong>{selectedCohortUnit.title} · Lesson {selectedExpected}</strong>. {selectedCohortUnit.id !== selectedUnit.id ? `${selectedClass.name} is currently finishing ${selectedUnit.title}.` : planner.classes.filter((item) => item.yearLevelId === selectedLevel.id && item.id !== selectedClass.id).map((item) => { const peerUnit = unitForClass(item.id); return `${item.name} is on ${peerUnit?.title ?? "no unit"} L${positionForClass(item.id, peerUnit)}`; }).join(" · ") || "No other classes in this cohort."}</p> : <p>No cohort reference unit is set.</p>}</div>
          <div className="prototype-controls"><div><span className="prototype-tag">Live trial control</span><h3>Set the lesson to teach next</h3><p>Manual adjustment is intentional for this trial. “L4” means Lessons 1–3 are complete and Lesson 4 is next.</p></div><div className="stepper"><button type="button" onClick={() => shiftSelected(-1)} disabled={selectedPosition <= 1}>−</button><span><small>Teach next</small><strong>{selectedPosition}</strong></span><button type="button" onClick={() => shiftSelected(1)} disabled={selectedPosition >= selectedUnit.lessons.length}>+</button></div><label className="lesson-select"><span>Choose next lesson</span><select value={planner.classProgress[selectedClass.id]?.lessonId ?? selectedUnit.lessons[0].id} onChange={(event) => setPlanner(setClassLesson(planner, selectedClass.id, event.target.value))}>{selectedUnit.lessons.map((lesson, index) => <option key={lesson.id} value={lesson.id}>Lesson {index + 1} · {lesson.title}</option>)}</select></label></div>
          <button className="drawer-note-button" type="button" onClick={() => { setQuickNote({ classId: selectedClass.id, context: "Class drawer" }); setQuickNoteText(""); }}>＋ Add quick note about {selectedClass.name}</button>
        </>}
      </aside>
    </div>}

    {quickNote && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setQuickNote(null)}><section className="quick-note-modal" role="dialog" aria-modal="true" aria-labelledby="quick-note-title"><div className="drawer-topline"><span>Live trial observation</span><button className="close-button" type="button" onClick={() => setQuickNote(null)} aria-label="Close quick note">×</button></div><h2 id="quick-note-title">Quick note{quickNote.classId ? ` · ${classById[quickNote.classId]?.name}` : ""}</h2><p>Capture what happened while the context is fresh.</p><textarea autoFocus rows={5} value={quickNoteText} onChange={(event) => setQuickNoteText(event.target.value)} placeholder="Only completed half the lesson today…" /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setQuickNote(null)}>Cancel</button><button className="primary-button" type="button" disabled={!quickNoteText.trim()} onClick={saveQuickNote}>Save note</button></div></section></div>}
  </div>;
}
