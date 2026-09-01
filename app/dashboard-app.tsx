"use client";

import { useEffect, useState } from "react";
import {
  getCohortProgressStatus,
  getTeachingSessionsForWeekday,
  getTeachingSessionsForDate,
  latestRecordedTeachingSession,
  lessonPosition,
  localDateKey,
  markAllTaughtAsPlanned,
  materializeTeachingSessionsForDate,
  recordTeachingSessionOutcome,
  setClassLesson,
  touchPlanner,
  type PlannerData,
  type TeachingSession,
  type TeachingSessionOutcome,
  type Unit,
} from "@/lib/domain";
import { createBlankPlanner, freshSamplePlanner, samplePlanner } from "@/lib/sample-data";
import { loadPlanner, persistPlanner } from "@/lib/storage";
import { SetupView } from "./setup-view";

const dateFormatter = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" });
const historyDateFormatter = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const OUTCOME_LABELS: Record<TeachingSessionOutcome, string> = { planned: "Planned", completed: "Completed", partial: "Partial", "not-taught": "Not taught" };

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

function TeachingHistory({ planner, onSelectClass }: { planner: PlannerData; onSelectClass: (classId: string) => void }) {
  const classById = Object.fromEntries(planner.classes.map((item) => [item.id, item]));
  const timetableById = Object.fromEntries(planner.timetableSessions.map((item) => [item.id, item]));
  const recorded = planner.teachingSessions
    .filter((item) => item.outcome !== "planned")
    .sort((a, b) => b.date.localeCompare(a.date) || (timetableById[b.timetableSessionId]?.startTime ?? "").localeCompare(timetableById[a.timetableSessionId]?.startTime ?? ""));
  const grouped = recorded.reduce<Map<string, TeachingSession[]>>((map, session) => {
    map.set(session.date, [...(map.get(session.date) ?? []), session]);
    return map;
  }, new Map());

  return <main className="history-main" id="top">
    <section className="history-hero"><div><p className="eyebrow">Teaching sessions</p><h1>What actually happened?</h1><p>History is recorded from confirmed lesson outcomes—not simply from the timetable.</p></div><span className="history-count">{recorded.length}<small>recorded</small></span></section>
    {!recorded.length ? <div className="history-empty"><strong>No teaching outcomes recorded yet</strong><p>Use the Teaching Day cards to mark lessons Completed, Partial or Not taught.</p></div> : <div className="history-groups">{[...grouped].map(([date, sessions]) => <section className="history-day" key={date}>
      <h2>{historyDateFormatter.format(new Date(`${date}T12:00:00`))}<span>{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span></h2>
      <div>{sessions.map((session) => {
        const item = classById[session.classId];
        const timetable = timetableById[session.timetableSessionId];
        return <article className="history-session" key={session.id}>
          <button className="history-class" type="button" onClick={() => onSelectClass(session.classId)}>{item?.name ?? "Removed class"}</button>
          <div><span>{session.plannedUnitTitle}</span><strong>{session.plannedLessonTitle}</strong>{timetable && <small>{timeLabel(timetable.startTime)}–{timeLabel(timetable.endTime)}</small>}</div>
          <span className={`history-outcome outcome-${session.outcome}`}>{OUTCOME_LABELS[session.outcome]}</span>
          <p>{session.reason ?? session.note ?? "—"}</p>
        </article>;
      })}</div>
    </section>)}</div>}
  </main>;
}

export function DashboardApp() {
  const [planner, setPlanner] = useState<PlannerData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "empty" | "ready">("loading");
  const [migrationNotice, setMigrationNotice] = useState(false);
  const [view, setView] = useState<"dashboard" | "history" | "setup">("dashboard");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [quickNote, setQuickNote] = useState<{ classId?: string; context: string } | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [outcomeDraft, setOutcomeDraft] = useState<{ sessionId: string; outcome: "partial" | "not-taught"; detail: string } | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = loadPlanner(window.localStorage, samplePlanner);
      if (!loaded.planner) { setLoadState("empty"); return; }
      const datedPlanner = materializeTeachingSessionsForDate(loaded.planner, selectedDate);
      setPlanner(datedPlanner);
      setLoadState("ready");
      if (loaded.source === "migrated-v1" || loaded.source === "migrated-v2" || loaded.source === "migrated-v3") {
        persistPlanner(window.localStorage, datedPlanner);
        setMigrationNotice(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
    // The initial date is intentionally captured once when local data is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loadState !== "ready" || !planner) return;
    try { persistPlanner(window.localStorage, planner); } catch { /* Keep last valid saved state while a field is mid-edit. */ }
  }, [planner, loadState]);

  useEffect(() => {
    if (!selectedClassId && !quickNote) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (quickNote) setQuickNote(null);
        else setSelectedClassId(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedClassId, quickNote]);

  if (loadState === "loading") return <div className="loading-screen"><span className="brand-mark">SP</span><p>Opening your planner…</p></div>;

  if (loadState === "empty" || !planner) {
    return <main className="onboarding-screen">
      <div className="onboarding-card">
        <span className="brand-mark">SP</span>
        <p className="eyebrow">Specialist Planner v0.3</p>
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
  const timetableById = Object.fromEntries(planner.timetableSessions.map((item) => [item.id, item]));
  const teachingSessions = getTeachingSessionsForDate(planner, selectedDate);
  const unresolvedTeaching = getTeachingSessionsForWeekday(planner.timetableSessions, selectedDate.getDay()).filter((item) => !teachingSessions.some((session) => session.timetableSessionId === item.id));
  const plannedSessions = teachingSessions.filter((item) => item.outcome === "planned");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayPlanned = getTeachingSessionsForDate(planner, yesterday).filter((item) => item.outcome === "planned");

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
  const selectedPreviousSession = selectedClass ? latestRecordedTeachingSession(planner, selectedClass.id) : undefined;

  function choosePlanner(next: PlannerData) { setPlanner(next); setLoadState("ready"); }
  function selectTeachingDate(date: Date) {
    setSelectedDate(date);
    setPlanner((current) => current ? materializeTeachingSessionsForDate(current, date) : current);
  }
  function shiftDay(offset: number) {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + offset);
    selectTeachingDate(next);
  }
  function shiftSelected(delta: number) {
    if (!planner || !selectedClass || !selectedUnit) return;
    const target = Math.min(Math.max(selectedPosition + delta, 1), selectedUnit.lessons.length);
    setPlanner(setClassLesson(planner, selectedClass.id, selectedUnit.lessons[target - 1].id));
  }
  function saveOutcome(sessionId: string, outcome: TeachingSessionOutcome, detail = "") {
    setPlanner(recordTeachingSessionOutcome(planner!, sessionId, outcome, detail));
    setOutcomeDraft(null);
  }
  function completeAll(date: Date) {
    setPlanner(markAllTaughtAsPlanned(planner!, date));
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
        <button className={`nav-link ${view === "history" ? "active" : ""}`} type="button" onClick={() => setView("history")}>History</button>
        <button className={`nav-link ${view === "setup" ? "active" : ""}`} type="button" onClick={() => setView("setup")}>Setup</button>
      </nav>
      <button className="quick-note-button" type="button" onClick={() => setQuickNote({ context: view === "setup" ? "Setup" : "Dashboard" })}>＋ Quick note</button>
    </header>

    {migrationNotice && <div className="migration-banner">Your existing setup and class progress were safely migrated to v0.3.<button type="button" onClick={() => setMigrationNotice(false)}>×</button></div>}

    {view === "setup" ? <SetupView planner={planner} onChange={choosePlanner} onBack={() => setView("dashboard")} /> : view === "history" ? <TeachingHistory planner={planner} onSelectClass={setSelectedClassId} /> : <main id="top">
      <section className="intro" aria-labelledby="page-title">
        <div><p className="eyebrow">{activeSubject.name || "Untitled subject"} · Weekly progress</p><h1 id="page-title">Where is every class up to?</h1><p className="intro-copy">A quick read on the week—what’s aligned, what needs attention, and what you’re teaching today.</p></div>
        <div className="attention-summary"><span className="summary-number">{attentionCount}</span><span><strong>{attentionCount === 1 ? "class needs" : "classes need"} a look</strong><small>Across {planner.yearLevels.length} year {planner.yearLevels.length === 1 ? "level" : "levels"}</small></span></div>
      </section>

      {!planner.yearLevels.length ? <section className="dashboard-empty"><span className="year-badge">1</span><div><h2>Your dashboard is ready for setup</h2><p>Add year levels, units, lessons, classes and your weekly timetable. You can return here at any time.</p></div><button className="primary-button" type="button" onClick={() => setView("setup")}>Open Setup</button></section> : <>
        {localDateKey(selectedDate) === localDateKey(new Date()) && yesterdayPlanned.length > 0 && <section className="previous-day-prompt" aria-label="Previous day review">
          <div><span>Previous day</span><strong>Yesterday had {yesterdayPlanned.length} unconfirmed {activeSubject.name || "specialist"} {yesterdayPlanned.length === 1 ? "session" : "sessions"}.</strong><p>Were they taught as planned?</p></div>
          <div><button className="primary-button" type="button" onClick={() => completeAll(yesterday)}>All completed</button><button className="secondary-button" type="button" onClick={() => selectTeachingDate(yesterday)}>Review</button></div>
        </section>}
        <section className="today-section" aria-labelledby="today-title">
          <div className="section-heading today-heading"><div><p className="section-kicker">Teaching day</p><h2 id="today-title">{dateFormatter.format(selectedDate)}</h2></div><div className="teaching-day-actions">{plannedSessions.length > 1 && <button className="bulk-complete-button" type="button" onClick={() => completeAll(selectedDate)}>✓ All taught as planned</button>}<div className="day-controls" aria-label="Change teaching day"><button type="button" onClick={() => shiftDay(-1)} aria-label="Previous day">←</button><button className="today-button" type="button" onClick={() => selectTeachingDate(new Date())}>Today</button><button type="button" onClick={() => shiftDay(1)} aria-label="Next day">→</button></div></div></div>
          {teachingSessions.length || unresolvedTeaching.length ? <div className="session-strip">{teachingSessions.map((session) => {
            const timetable = timetableById[session.timetableSessionId];
            const item = classById[session.classId];
            const level = item ? yearLevelById[item.yearLevelId] : undefined;
            const cohortUnit = level?.currentUnitId ? unitById[level.currentUnitId] : undefined;
            const unit = item ? unitForClass(item.id) : undefined;
            const current = item && unit ? positionForClass(item.id, unit) : 1;
            const expected = level && cohortUnit ? expectedForLevel(level.id, cohortUnit) : 1;
            const status = unit && cohortUnit ? getCohortProgressStatus(unit.id, current, cohortUnit.id, expected) : null;
            const plannedUnit = unitById[session.plannedUnitId];
            const plannedPosition = plannedUnit ? lessonPosition(plannedUnit, session.plannedLessonId) : null;
            return <article className={`session-card outcome-${session.outcome} ${status && status.kind !== "on-track" ? "has-exception" : ""}`} key={session.id}>
              <button className="session-card-main" type="button" onClick={() => item && setSelectedClassId(item.id)}>
                <span className="session-time">{timetable ? `${timeLabel(timetable.startTime)}–${timeLabel(timetable.endTime)}` : "Scheduled session"}</span><span className={`session-outcome outcome-${session.outcome}`}>{OUTCOME_LABELS[session.outcome]}</span><span className="session-class">{item?.name ?? "Missing class"}</span><span className="session-year">{level?.label}</span>
                <span className="session-unit">{session.plannedUnitTitle}</span><span className="session-lesson">Planned: {plannedPosition ? `L${plannedPosition} · ` : ""}{session.plannedLessonTitle}</span>
                {status && unit && cohortUnit && <StatusLabel current={current} expected={expected} currentUnitId={unit.id} expectedUnitId={cohortUnit.id} />}
                {(session.reason || session.note) && <span className="session-detail">{session.reason ?? session.note}</span>}
              </button>
              <div className="session-outcome-actions" aria-label={`Record outcome for ${item?.name ?? "session"}`}>
                <button className={session.outcome === "completed" ? "active completed" : ""} type="button" onClick={() => saveOutcome(session.id, "completed")}>✓ Completed</button>
                <button className={session.outcome === "partial" ? "active partial" : ""} type="button" onClick={() => setOutcomeDraft({ sessionId: session.id, outcome: "partial", detail: session.note ?? "" })}>◐ Partial</button>
                <button className={session.outcome === "not-taught" ? "active not-taught" : ""} type="button" onClick={() => setOutcomeDraft({ sessionId: session.id, outcome: "not-taught", detail: session.reason ?? "" })}>× Not taught</button>
                {session.outcome !== "planned" && <button className="clear-outcome" type="button" onClick={() => saveOutcome(session.id, "planned")}>Clear</button>}
              </div>
            </article>;
          })}{unresolvedTeaching.map((timetable) => {
            const item = timetable.classId ? classById[timetable.classId] : undefined;
            const progress = item ? planner.classProgress[item.id] : undefined;
            const unit = progress ? unitById[progress.unitId] : undefined;
            return <article className="session-card blocked-session" key={`blocked-${timetable.id}`}><button className="session-card-main" type="button" onClick={() => item && setSelectedClassId(item.id)}><span className="session-time">{timeLabel(timetable.startTime)}–{timeLabel(timetable.endTime)}</span><span className="session-outcome">Needs setup</span><span className="session-class">{item?.name ?? "Missing class"}</span><span className="session-year">{item ? yearLevelById[item.yearLevelId]?.label : ""}</span><span className="session-unit">{unit?.title ?? "No current unit"}</span><span className="session-lesson">{progress?.unitComplete ? "Unit complete · choose the next Unit" : "Set a valid Unit and Lesson before teaching"}</span></button><button className="blocked-setup-button" type="button" onClick={() => setView("setup")}>Open Setup</button></article>;
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
                const unitComplete = planner.classProgress[item.id]?.unitComplete;
                return <button type="button" key={item.id} className={`class-pill ${status.kind}`} onClick={() => setSelectedClassId(item.id)} aria-label={`${item.name}, ${classUnit.title}, ${unitComplete ? "unit complete" : `teach lesson ${current} next`}, ${status.label}`}><span className="class-pill-copy"><b>{item.name}</b><small>{classUnit.title}</small></span><strong>{unitComplete ? "Done" : `L${current}`}</strong><i aria-hidden="true">{unitComplete ? "✓" : status.kind === "on-track" ? "✓" : status.kind === "behind" ? "↓" : status.kind === "ahead" ? "↑" : "↔"}</i></button>;
              })}</div>
              <div className={`cohort-note ${exceptions.length ? "exception" : "calm"}`}>{exceptions.length ? <><span aria-hidden="true">!</span><p><strong>{exceptions.map((item) => item.name).join(" and ")}</strong> {exceptions.length === 1 ? "is" : "are"} out of sync</p></> : <><span aria-hidden="true">✓</span><p>{cohort.length ? "All classes aligned" : "No classes yet"}</p></>}</div>
            </article>;
          })}</div>
        </section>
      </>}
    </main>}

    <footer><span>Specialist Planner <strong>v0.3 Live Trial</strong></span><span>Saved locally on this device · <button type="button" onClick={() => setView("setup")}>Backup in Setup</button></span></footer>

    {selectedClass && selectedLevel && <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSelectedClassId(null)}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-topline"><span>Class progress</span><button className="close-button" type="button" onClick={() => setSelectedClassId(null)} aria-label="Close class detail">×</button></div>
        <div className="drawer-title"><span className="drawer-class-badge">{selectedClass.name}</span><div><h2 id="detail-title">{selectedClass.name}</h2><p>{selectedLevel.label} · {activeSubject.name}</p></div></div>
        {!selectedUnit ? <div className="drawer-empty"><h3>No current unit</h3><p>Add a unit in Setup before setting progress.</p><button className="primary-button" type="button" onClick={() => { setSelectedClassId(null); setView("setup"); }}>Open Setup</button></div> : <>
          <div className="detail-unit"><span>Actual current unit</span><strong>{selectedUnit.title}</strong>{selectedCohortUnit && <StatusLabel current={selectedPosition} expected={selectedExpected} currentUnitId={selectedUnit.id} expectedUnitId={selectedCohortUnit.id} />}</div>
          <div className="lesson-detail-grid"><div><span>Last completed</span><strong>{planner.classProgress[selectedClass.id]?.unitComplete ? `Lesson ${selectedUnit.lessons.length}` : selectedPosition === 1 ? "Not started" : `Lesson ${selectedPosition - 1}`}</strong><small>{planner.classProgress[selectedClass.id]?.unitComplete ? selectedUnit.lessons.at(-1)?.title : selectedPosition > 1 ? selectedUnit.lessons[selectedPosition - 2]?.title : "Ready to begin"}</small></div><div className="next-lesson"><span>Teach next</span>{planner.classProgress[selectedClass.id]?.unitComplete ? <><strong>Unit complete</strong><small>Choose the next Unit in Setup</small></> : <><strong>Lesson {selectedPosition}</strong><small>{selectedUnit.lessons[selectedPosition - 1]?.title}</small></>}</div></div>
          <div className={`cohort-context ${selectedCohortUnit && selectedCohortUnit.id !== selectedUnit.id ? "unit-mismatch" : ""}`}><span>Cohort reference</span>{selectedCohortUnit ? <p>The cohort expects <strong>{selectedCohortUnit.title} · Lesson {selectedExpected}</strong>. {selectedCohortUnit.id !== selectedUnit.id ? `${selectedClass.name} is currently finishing ${selectedUnit.title}.` : planner.classes.filter((item) => item.yearLevelId === selectedLevel.id && item.id !== selectedClass.id).map((item) => { const peerUnit = unitForClass(item.id); return `${item.name} is on ${peerUnit?.title ?? "no unit"} L${positionForClass(item.id, peerUnit)}`; }).join(" · ") || "No other classes in this cohort."}</p> : <p>No cohort reference unit is set.</p>}</div>
          {selectedPreviousSession && <div className={`previous-session outcome-${selectedPreviousSession.outcome}`}><span>Previous session · {selectedPreviousSession.date}</span><strong>{OUTCOME_LABELS[selectedPreviousSession.outcome]}</strong>{(selectedPreviousSession.reason || selectedPreviousSession.note) && <p>{selectedPreviousSession.reason ?? selectedPreviousSession.note}</p>}</div>}
          <div className="prototype-controls"><div><span className="prototype-tag">Manual correction</span><h3>Correct progress</h3><p>Teaching outcomes normally update progress. Use this only for setup mistakes, skipped lessons or exceptional corrections.</p></div>{planner.classProgress[selectedClass.id]?.unitComplete && <button className="reopen-unit-button" type="button" onClick={() => setPlanner(setClassLesson(planner, selectedClass.id, selectedUnit.lessons.at(-1)!.id))}>Reopen final lesson</button>}<div className="stepper"><button type="button" onClick={() => shiftSelected(-1)} disabled={selectedPosition <= 1}>−</button><span><small>Teach next</small><strong>{selectedPosition}</strong></span><button type="button" onClick={() => shiftSelected(1)} disabled={selectedPosition >= selectedUnit.lessons.length}>+</button></div><label className="lesson-select"><span>Choose next lesson</span><select value={planner.classProgress[selectedClass.id]?.lessonId ?? selectedUnit.lessons[0].id} onChange={(event) => setPlanner(setClassLesson(planner, selectedClass.id, event.target.value))}>{selectedUnit.lessons.map((lesson, index) => <option key={lesson.id} value={lesson.id}>Lesson {index + 1} · {lesson.title}</option>)}</select></label></div>
          <button className="drawer-note-button" type="button" onClick={() => { setQuickNote({ classId: selectedClass.id, context: "Class drawer" }); setQuickNoteText(""); }}>＋ Add quick note about {selectedClass.name}</button>
        </>}
      </aside>
    </div>}

    {outcomeDraft && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setOutcomeDraft(null)}><section className="quick-note-modal outcome-modal" role="dialog" aria-modal="true" aria-labelledby="outcome-title"><div className="drawer-topline"><span>Teaching outcome</span><button className="close-button" type="button" onClick={() => setOutcomeDraft(null)} aria-label="Close outcome detail">×</button></div><h2 id="outcome-title">{outcomeDraft.outcome === "partial" ? "Partial lesson" : "Not taught"}</h2><p>{outcomeDraft.outcome === "partial" ? "Optionally note where the lesson stopped." : "Optionally record why the lesson did not happen."}</p><textarea rows={3} value={outcomeDraft.detail} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, detail: event.target.value })} placeholder={outcomeDraft.outcome === "partial" ? "Stopped after Activity 3" : "Year 4 Camp"} /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setOutcomeDraft(null)}>Cancel</button><button className="primary-button" type="button" onClick={() => saveOutcome(outcomeDraft.sessionId, outcomeDraft.outcome, outcomeDraft.detail)}>Save {OUTCOME_LABELS[outcomeDraft.outcome]}</button></div></section></div>}

    {quickNote && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setQuickNote(null)}><section className="quick-note-modal" role="dialog" aria-modal="true" aria-labelledby="quick-note-title"><div className="drawer-topline"><span>Live trial observation</span><button className="close-button" type="button" onClick={() => setQuickNote(null)} aria-label="Close quick note">×</button></div><h2 id="quick-note-title">Quick note{quickNote.classId ? ` · ${classById[quickNote.classId]?.name}` : ""}</h2><p>Capture what happened while the context is fresh.</p><textarea rows={5} value={quickNoteText} onChange={(event) => setQuickNoteText(event.target.value)} placeholder="Product or workflow observation…" /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setQuickNote(null)}>Cancel</button><button className="primary-button" type="button" disabled={!quickNoteText.trim()} onClick={saveQuickNote}>Save trial note</button></div></section></div>}
  </div>;
}
