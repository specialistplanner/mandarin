"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  CLASS_COLOUR_PRESETS,
  getCohortProgressStatus,
  latestRecordedTeachingSession,
  lessonPosition,
  setClassLesson,
  touchPlanner,
  type PlannerData,
  type TeachingSession,
  type TeachingSessionOutcome,
  type Unit,
} from "@/lib/domain";
import { createBlankPlanner, freshSamplePlanner, samplePlanner } from "@/lib/sample-data";
import { loadPlanner, persistPlanner } from "@/lib/storage";
import { applyLiveTrialWeekReset, LIVE_TRIAL_WEEK_RESET_KEY } from "@/lib/live-trial-week-reset";
import { SetupView } from "./setup-view";
import { WeekView } from "./week-view";
import { ResourceLinkAction } from "./resource-link";
import { useUnitLibrary } from "./use-unit-library";

type AppView = "week" | "progress" | "units" | "history" | "settings";
const historyDateFormatter = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const OUTCOME_LABELS: Record<TeachingSessionOutcome, string> = { planned: "Planned", completed: "Completed", partial: "Partial", "not-taught": "Not taught" };
const SESSION_ONE_LABEL_MIGRATION_KEY = "specialist-planner.session-label.s1.v1";

function classColourStyle(colourId: keyof typeof CLASS_COLOUR_PRESETS | undefined): CSSProperties | undefined {
  const colour = colourId ? CLASS_COLOUR_PRESETS[colourId] : undefined;
  return colour ? {
    "--class-card-bg": colour.background,
    "--class-card-accent": colour.accent,
    "--class-card-foreground": colour.foreground,
  } as CSSProperties : undefined;
}

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
  const [classFilters, setClassFilters] = useState<string[]>([]);
  const classById = Object.fromEntries(planner.classes.map((item) => [item.id, item]));
  const timetableById = Object.fromEntries(planner.timetableSessions.map((item) => [item.id, item]));
  const classOptions = [...planner.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const recorded = planner.teachingSessions.filter((item) => item.outcome !== "planned" && (!classFilters.length || classFilters.includes(item.classId))).sort((a, b) => b.date.localeCompare(a.date) || (timetableById[b.timetableSessionId]?.startTime ?? "").localeCompare(timetableById[a.timetableSessionId]?.startTime ?? ""));
  const grouped = recorded.reduce<Map<string, TeachingSession[]>>((map, session) => { map.set(session.date, [...(map.get(session.date) ?? []), session]); return map; }, new Map());
  const selectedNames = classFilters.map(classId => classById[classId]?.name).filter(Boolean);
  function toggleClassFilter(classId: string) {
    setClassFilters(current => current.includes(classId) ? current.filter(item => item !== classId) : [...current, classId]);
  }
  return <main className="history-main" id="top">
    <section className="history-hero"><div><p className="eyebrow">Teaching sessions</p><h1>What actually happened?</h1><p>History is recorded from confirmed lesson outcomes—not simply from the timetable.</p></div><span className="history-count">{recorded.length}<small>recorded</small></span></section>
    <section className="history-filter" aria-label="Browse teaching history by class">
      <div className="history-filter-heading"><span>Browse by class</span><strong>{selectedNames.length ? `${selectedNames.length} classes selected` : "All classes"}</strong></div>
      <div className="history-class-options"><label className={!classFilters.length ? "active" : ""}><input type="checkbox" checked={!classFilters.length} onChange={() => setClassFilters([])} /><span>All classes</span></label>{classOptions.map(item => <label className={classFilters.includes(item.id) ? "active" : ""} key={item.id}><input type="checkbox" checked={classFilters.includes(item.id)} onChange={() => toggleClassFilter(item.id)} /><span>{item.name}</span></label>)}</div>
    </section>
    {!recorded.length ? <div className="history-empty"><strong>{selectedNames.length ? "No teaching outcomes recorded for this class selection" : "No teaching outcomes recorded yet"}</strong><p>{selectedNames.length ? "Choose another class combination or return to all classes." : "Use Week cards to mark lessons Completed, Partial or Not taught."}</p></div> : <div className="history-groups">{[...grouped].map(([date, sessions]) => <section className="history-day" key={date}><h2>{historyDateFormatter.format(new Date(`${date}T12:00:00`))}<span>{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span></h2><div>{sessions.map((session) => { const item = classById[session.classId]; const timetable = timetableById[session.timetableSessionId]; return <article className="history-session" key={session.id}><button className="history-class" type="button" onClick={() => onSelectClass(session.classId)}>{item?.name ?? "Removed class"}</button><div><span>{session.plannedUnitTitle}</span><strong>{session.plannedLessonTitle}</strong>{timetable && <small>{timeLabel(timetable.startTime)}–{timeLabel(timetable.endTime)}</small>}</div><span className={`history-outcome outcome-${session.outcome}`}>{OUTCOME_LABELS[session.outcome]}</span><p>{session.reason ?? session.note ?? "—"}</p></article>; })}</div></section>)}</div>}
  </main>;
}

function ProgressView({ planner, onSelectClass, onOpenSettings }: { planner: PlannerData; onSelectClass: (classId: string) => void; onOpenSettings: () => void }) {
  const unitById = Object.fromEntries(planner.units.map((item) => [item.id, item]));
  const levelById = Object.fromEntries(planner.yearLevels.map((item) => [item.id, item]));
  const unitForClass = (classId: string) => unitById[planner.classProgress[classId]?.unitId];
  const positionForClass = (classId: string, unit = unitForClass(classId)) => unit ? lessonPosition(unit, planner.classProgress[classId]?.lessonId) : 1;
  const expectedForLevel = (levelId: string, unit: Unit) => lessonPosition(unit, levelById[levelId]?.expectedLessonId);
  const attentionCount = planner.yearLevels.reduce((total, level) => {
    const unit = level.currentUnitId ? unitById[level.currentUnitId] : undefined;
    if (!unit) return total;
    const expected = expectedForLevel(level.id, unit);
    return total + planner.classes.filter((item) => item.yearLevelId === level.id && (!unitForClass(item.id) || getCohortProgressStatus(unitForClass(item.id).id, positionForClass(item.id), unit.id, expected).kind !== "on-track")).length;
  }, 0);
  return <main id="top"><section className="intro" aria-labelledby="progress-title"><div><p className="eyebrow">Cohort diagnosis</p><h1 id="progress-title">Where is every class up to?</h1><p className="intro-copy">Compare actual class positions with each cohort reference and focus on exceptions.</p></div><div className="attention-summary"><span className="summary-number">{attentionCount}</span><span><strong>{attentionCount === 1 ? "class needs" : "classes need"} a look</strong><small>Across {planner.yearLevels.length} year {planner.yearLevels.length === 1 ? "level" : "levels"}</small></span></div></section>
    {!planner.yearLevels.length ? <section className="dashboard-empty"><span className="year-badge">1</span><div><h2>Your planner is ready for setup</h2><p>Add year levels, units, lessons, classes and your weekly timetable.</p></div><button className="primary-button" type="button" onClick={onOpenSettings}>Open Settings</button></section> : <section className="overview-section" aria-labelledby="overview-title"><div className="section-heading overview-heading"><div><p className="section-kicker">All cohorts</p><h2 id="overview-title">Class progress overview</h2></div><div className="legend"><span><i className="legend-dot aligned" />Aligned</span><span><i className="legend-dot attention" />Needs attention</span></div></div><div className="year-list">{planner.yearLevels.map((level) => {
      const unit = level.currentUnitId ? unitById[level.currentUnitId] : undefined;
      const cohort = planner.classes.filter((item) => item.yearLevelId === level.id);
      if (!unit) return <article className="year-card needs-setup" key={level.id}><div className="year-identity"><span className="year-badge">{level.shortLabel}</span><div><h3>{level.label}</h3><p>No current unit</p></div></div><button className="secondary-button" type="button" onClick={onOpenSettings}>Complete setup</button></article>;
      const expected = expectedForLevel(level.id, unit);
      const exceptions = cohort.filter((item) => { const classUnit = unitForClass(item.id); return !classUnit || getCohortProgressStatus(classUnit.id, positionForClass(item.id, classUnit), unit.id, expected).kind !== "on-track"; });
      return <article className={`year-card ${exceptions.length ? "diverged" : "aligned"}`} key={level.id}><div className="year-identity"><span className="year-badge">{level.shortLabel}</span><div><h3>{level.label}</h3><p>{unit.title}</p></div></div><div className="expected-block"><span>Expected / teach next</span><strong>Lesson {expected}</strong><small>{unit.lessons[expected - 1]?.title}</small></div><div className="class-pills">{cohort.map((item) => { const classUnit = unitForClass(item.id) ?? unit; const current = positionForClass(item.id, classUnit); const status = getCohortProgressStatus(classUnit.id, current, unit.id, expected); const unitComplete = planner.classProgress[item.id]?.unitComplete; const classColourId = planner.classColours[item.id]; return <button type="button" key={item.id} className={`class-pill ${status.kind} ${classColourId ? "has-class-colour" : ""}`} style={classColourStyle(classColourId)} onClick={() => onSelectClass(item.id)} aria-label={`${item.name}, ${classUnit.title}, ${unitComplete ? "unit complete" : `teach lesson ${current} next`}, ${status.label}`}><span className="class-pill-copy"><b>{item.name}</b><small>{classUnit.title}</small></span><strong>{unitComplete ? "Done" : `L${current}`}</strong><i aria-hidden="true">{unitComplete ? "✓" : status.kind === "on-track" ? "✓" : status.kind === "behind" ? "↓" : status.kind === "ahead" ? "↑" : "↔"}</i></button>; })}</div><div className={`cohort-note ${exceptions.length ? "exception" : "calm"}`}>{exceptions.length ? <><span>!</span><p><strong>{exceptions.map((item) => item.name).join(" and ")}</strong> {exceptions.length === 1 ? "is" : "are"} out of sync</p></> : <><span>✓</span><p>{cohort.length ? "All classes aligned" : "No classes yet"}</p></>}</div></article>;
    })}</div></section>}
  </main>;
}

export function DashboardApp() {
  const [planner, setPlanner] = useState<PlannerData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "empty" | "ready">("loading");
  const [migrationNotice, setMigrationNotice] = useState(false);
  const [view, setView] = useState<AppView>("week");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [quickNote, setQuickNote] = useState<{ classId?: string; context: string } | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const unitLibrary = useUnitLibrary();

  useEffect(() => { const frame = window.requestAnimationFrame(() => { const loaded = loadPlanner(window.localStorage, samplePlanner); if (!loaded.planner) { setLoadState("empty"); return; } let next = loaded.planner; let resetApplied = false; let sessionLabelMigrated = false; if (window.localStorage.getItem(LIVE_TRIAL_WEEK_RESET_KEY) !== "applied") { const reset = applyLiveTrialWeekReset(next); if (reset.applied) { next = reset.planner; persistPlanner(window.localStorage, next); window.localStorage.setItem(LIVE_TRIAL_WEEK_RESET_KEY, "applied"); resetApplied = true; } } if (window.localStorage.getItem(SESSION_ONE_LABEL_MIGRATION_KEY) !== "applied") { const firstSession = next.sessionSlots.find((slot) => slot.id === "session-1"); if (firstSession?.label === "Session 1") { next = touchPlanner({ ...next, sessionSlots: next.sessionSlots.map((slot) => slot.id === "session-1" ? { ...slot, label: "S1" } : slot) }); sessionLabelMigrated = true; } window.localStorage.setItem(SESSION_ONE_LABEL_MIGRATION_KEY, "applied"); } setPlanner(next); setLoadState("ready"); if (loaded.source !== "v9" || resetApplied || sessionLabelMigrated) { persistPlanner(window.localStorage, next); setMigrationNotice(true); } }); return () => window.cancelAnimationFrame(frame); }, []);
  useEffect(() => { if (loadState === "ready" && planner) try { persistPlanner(window.localStorage, planner); } catch { /* Keep the last valid local state during edits. */ } }, [planner, loadState]);
  useEffect(() => { if (!selectedClassId && !quickNote) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") { if (quickNote) setQuickNote(null); else setSelectedClassId(null); } }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [selectedClassId, quickNote]);

  if (loadState === "loading") return <div className="loading-screen"><span className="brand-mark">SP</span><p>Opening your planner…</p></div>;
  if (loadState === "empty" || !planner) return <main className="onboarding-screen"><div className="onboarding-card"><span className="brand-mark">SP</span><p className="eyebrow">Specialist Planner v0.5</p><h1>Make it yours.</h1><p>Start with the Mandarin demonstration or begin with a blank planner. Your data stays in this browser.</p><div className="onboarding-actions"><button className="primary-button" type="button" onClick={() => { setPlanner(createBlankPlanner()); setLoadState("ready"); setView("settings"); }}>Start blank planner</button><button className="secondary-button" type="button" onClick={() => { setPlanner(freshSamplePlanner()); setLoadState("ready"); }}>Explore sample data</button></div><small>You can import a backup later from Settings.</small></div></main>;

  const activeSubject = planner.subjects.find((item) => item.id === planner.activeSubjectId)!;
  const classById = Object.fromEntries(planner.classes.map((item) => [item.id, item]));
  const levelById = Object.fromEntries(planner.yearLevels.map((item) => [item.id, item]));
  const unitById = Object.fromEntries(planner.units.map((item) => [item.id, item]));
  const selectedClass = selectedClassId ? classById[selectedClassId] : null;
  const selectedLevel = selectedClass ? levelById[selectedClass.yearLevelId] : null;
  const selectedUnit = selectedClass ? unitById[planner.classProgress[selectedClass.id]?.unitId] : null;
  const selectedCohortUnit = selectedLevel?.currentUnitId ? unitById[selectedLevel.currentUnitId] : null;
  const selectedPosition = selectedClass && selectedUnit ? lessonPosition(selectedUnit, planner.classProgress[selectedClass.id]?.lessonId) : 1;
  const selectedExpected = selectedLevel && selectedCohortUnit ? lessonPosition(selectedCohortUnit, selectedLevel.expectedLessonId) : 1;
  const selectedPreviousSession = selectedClass ? latestRecordedTeachingSession(planner, selectedClass.id) : undefined;
  const openQuickNote = (classId: string | undefined, context: string) => { setQuickNote({ classId, context }); setQuickNoteText(""); };
  function saveQuickNote() { if (!quickNote || !quickNoteText.trim()) return; setPlanner(touchPlanner({ ...planner, trialNotes: [{ id: makeId("note"), text: quickNoteText.trim(), createdAt: new Date().toISOString(), context: quickNote.context, classId: quickNote.classId }, ...planner.trialNotes] })); setQuickNote(null); setQuickNoteText(""); }
  function shiftSelected(delta: number) { if (!selectedClass || !selectedUnit) return; const target = Math.min(Math.max(selectedPosition + delta, 1), selectedUnit.lessons.length); setPlanner(setClassLesson(planner, selectedClass.id, selectedUnit.lessons[target - 1].id)); }

  return <div className="app-shell"><header className="topbar"><button className="brand brand-button" type="button" onClick={() => setView("week")} aria-label="Open Week"><span className="brand-mark">SP</span><span><strong>Specialist Planner</strong><small>{activeSubject.name || "Untitled subject"} · Live trial</small></span></button><nav aria-label="Primary navigation"><button className={`nav-link ${view === "week" ? "active" : ""}`} type="button" onClick={() => setView("week")}>Week</button><button className={`nav-link ${view === "progress" ? "active" : ""}`} type="button" onClick={() => setView("progress")}>Progress</button><button className={`nav-link ${view === "units" ? "active" : ""}`} type="button" onClick={() => setView("units")}>Units</button><span className="nav-divider" /><button className={`nav-link nav-secondary ${view === "history" ? "active" : ""}`} type="button" onClick={() => setView("history")}>History</button><button className={`nav-link nav-secondary ${view === "settings" ? "active" : ""}`} type="button" onClick={() => setView("settings")}>Settings</button></nav><button className="quick-note-button" type="button" onClick={() => openQuickNote(undefined, view === "week" ? "Week" : view === "progress" ? "Progress" : view === "units" ? "Units" : view === "history" ? "History" : "Settings")}>＋ Quick note</button></header>
    {migrationNotice && <div className="migration-banner">Your existing setup, history and progress are ready in the new Week View.<button type="button" onClick={() => setMigrationNotice(false)}>×</button></div>}
    {view === "week" ? <WeekView planner={planner} onChange={setPlanner} onOpenClass={(classId) => { setSelectedClassId(classId); }} onOpenSettings={() => setView("settings")} onQuickNote={openQuickNote} unitLibrary={unitLibrary} /> : view === "progress" ? <ProgressView planner={planner} onSelectClass={setSelectedClassId} onOpenSettings={() => setView("settings")} /> : view === "history" ? <TeachingHistory planner={planner} onSelectClass={setSelectedClassId} /> : <SetupView key={view} planner={planner} onChange={setPlanner} onBack={() => setView("week")} unitLibrary={unitLibrary} initialSection={view === "units" ? "cohorts" : "timetable"} />}
    <footer><span>Specialist Planner <strong>v0.5 Integration Trial</strong></span><span>Saved locally on this device · <button type="button" onClick={() => setView("settings")}>Backup in Settings</button></span></footer>

    {selectedClass && selectedLevel && <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSelectedClassId(null)}><aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="drawer-topline"><span>Class progress</span><button className="close-button" type="button" onClick={() => setSelectedClassId(null)} aria-label="Close class detail">×</button></div><div className="drawer-title"><span className="drawer-class-badge">{selectedClass.name}</span><div><h2 id="detail-title">{selectedClass.name}</h2><p>{selectedLevel.label} · {activeSubject.name}</p></div></div>{!selectedUnit ? <div className="drawer-empty"><h3>No current unit</h3><p>Add a Unit in Settings before setting progress.</p><button className="primary-button" type="button" onClick={() => { setSelectedClassId(null); setView("units"); }}>Open Units</button></div> : <><div className="detail-unit"><span>Actual current unit</span><strong>{selectedUnit.title}</strong>{selectedCohortUnit && <StatusLabel current={selectedPosition} expected={selectedExpected} currentUnitId={selectedUnit.id} expectedUnitId={selectedCohortUnit.id} />}</div><div className="lesson-detail-grid"><div><span>Last completed</span><strong>{planner.classProgress[selectedClass.id]?.unitComplete ? `Lesson ${selectedUnit.lessons.length}` : selectedPosition === 1 ? "Not started" : `Lesson ${selectedPosition - 1}`}</strong><small>{planner.classProgress[selectedClass.id]?.unitComplete ? selectedUnit.lessons.at(-1)?.title : selectedPosition > 1 ? selectedUnit.lessons[selectedPosition - 2]?.title : "Ready to begin"}</small></div><div className="next-lesson"><span>Teach next</span>{planner.classProgress[selectedClass.id]?.unitComplete ? <><strong>Unit complete</strong><small>Choose the next Unit in Units</small></> : <><strong>Lesson {selectedPosition}</strong><small>{selectedUnit.lessons[selectedPosition - 1]?.title}</small></>}</div></div><div className={`cohort-context ${selectedCohortUnit && selectedCohortUnit.id !== selectedUnit.id ? "unit-mismatch" : ""}`}><span>Cohort reference</span>{selectedCohortUnit ? <p>The cohort expects <strong>{selectedCohortUnit.title} · Lesson {selectedExpected}</strong>. {selectedCohortUnit.id !== selectedUnit.id ? `${selectedClass.name} is currently on ${selectedUnit.title}.` : "Comparison uses the shared Progress model."}</p> : <p>No cohort reference Unit is set.</p>}</div>{selectedPreviousSession && <div className={`previous-session outcome-${selectedPreviousSession.outcome}`}><span>Previous session · {selectedPreviousSession.date}</span><strong>{OUTCOME_LABELS[selectedPreviousSession.outcome]}</strong>{(selectedPreviousSession.reason || selectedPreviousSession.note) && <p>{selectedPreviousSession.reason ?? selectedPreviousSession.note}</p>}</div>}<div className="prototype-controls"><span className="prototype-tag">Manual correction</span><h3>Correct progress</h3><p>Teaching outcomes normally update progress. Use this only for exceptional corrections.</p>{planner.classProgress[selectedClass.id]?.unitComplete && <button className="reopen-unit-button" type="button" onClick={() => setPlanner(setClassLesson(planner, selectedClass.id, selectedUnit.lessons.at(-1)!.id))}>Reopen final lesson</button>}<div className="stepper"><button type="button" onClick={() => shiftSelected(-1)} disabled={selectedPosition <= 1}>−</button><span><small>Teach next</small><strong>{selectedPosition}</strong></span><button type="button" onClick={() => shiftSelected(1)} disabled={selectedPosition >= selectedUnit.lessons.length}>+</button></div><label className="lesson-select"><span>Choose next lesson</span><select value={planner.classProgress[selectedClass.id]?.lessonId ?? selectedUnit.lessons[0].id} onChange={(event) => setPlanner(setClassLesson(planner, selectedClass.id, event.target.value))}>{selectedUnit.lessons.map((lesson, index) => <option key={lesson.id} value={lesson.id}>Lesson {index + 1} · {lesson.title}</option>)}</select></label></div><button className="drawer-note-button" type="button" onClick={() => openQuickNote(selectedClass.id, "Progress detail")}>＋ Add quick note about {selectedClass.name}</button></>}</aside></div>}
    {quickNote && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setQuickNote(null)}><section className="quick-note-modal" role="dialog" aria-modal="true" aria-labelledby="quick-note-title"><div className="drawer-topline"><span>Live trial observation</span><button className="close-button" type="button" onClick={() => setQuickNote(null)} aria-label="Close quick note">×</button></div><h2 id="quick-note-title">Quick note{quickNote.classId ? ` · ${classById[quickNote.classId]?.name}` : ""}</h2><p>{quickNote.context} · Capture what happened while the context is fresh.</p><textarea rows={5} value={quickNoteText} onChange={(event) => setQuickNoteText(event.target.value)} placeholder="Product or workflow observation…" /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setQuickNote(null)}>Cancel</button><button className="primary-button" type="button" disabled={!quickNoteText.trim()} onClick={saveQuickNote}>Save trial note</button></div></section></div>}
    {selectedClass && selectedUnit?.lessons[selectedPosition - 1]?.externalResourceRef && <div className="progress-resource-float"><span>Teach next resource</span><ResourceLinkAction reference={selectedUnit.lessons[selectedPosition - 1].externalResourceRef} library={unitLibrary} onRelink={() => { setSelectedClassId(null); setView("units"); }} label="Open in Unit Library" /></div>}
  </div>;
}
