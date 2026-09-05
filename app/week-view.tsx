"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CLASS_COLOUR_PRESETS,
  localDateKey,
  markAllTaughtAsPlanned,
  materializeTeachingSessionsForDate,
  recordTeachingSessionOutcome,
  type PlannerData,
  type TeachingSessionOutcome,
} from "@/lib/domain";
import { deriveTeachingWeek, shiftTeachingWeek, startOfTeachingWeek, type WeekEntry } from "@/lib/week-planner";
import { ResourceLinkAction } from "./resource-link";
import type { UnitLibraryState } from "./use-unit-library";

const dayFormatter = new Intl.DateTimeFormat("en-AU", { weekday: "long" });
const dayNumberFormatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
const rangeFormatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
const outcomeLabels: Record<TeachingSessionOutcome, string> = { planned: "Planned", completed: "Completed", partial: "Partial", "not-taught": "Not taught" };
const preferenceKey = "specialist-planner.preferences.v1";

function classColourStyle(colourId: WeekEntry["classColourId"]): CSSProperties | undefined {
  const colour = colourId ? CLASS_COLOUR_PRESETS[colourId] : undefined;
  return colour ? {
    "--class-card-bg": colour.background,
    "--class-card-accent": colour.accent,
    "--class-card-foreground": colour.foreground,
  } as CSSProperties : undefined;
}

function timeLabel(time: string) {
  const [hourString, minutes] = time.split(":");
  const hour = Number(hourString);
  return `${hour % 12 || 12}:${minutes}${hour >= 12 ? "pm" : "am"}`;
}

function stateLabel(entry: WeekEntry) {
  if (entry.session?.outcome && entry.session.outcome !== "planned") return outcomeLabels[entry.session.outcome];
  if (entry.state === "projected") return entry.projectionUncertain ? "Projection depends on earlier session" : "Proposed";
  if (entry.state === "unconfirmed") return "Unconfirmed";
  if (entry.state === "legacy") return "Before checkpoint";
  if (entry.state === "unit-complete") return "Unit complete";
  if (entry.state === "needs-setup") return "Needs setup";
  return "Planned";
}

export function WeekView({ planner, onChange, onOpenClass, onOpenSettings, onOpenUnits, onQuickNote, unitLibrary }: {
  planner: PlannerData;
  onChange: (planner: PlannerData) => void;
  onOpenClass: (classId: string) => void;
  onOpenSettings: () => void;
  onOpenUnits: () => void;
  onQuickNote: (classId: string | undefined, context: string) => void;
  unitLibrary: UnitLibraryState;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfTeachingWeek(new Date()));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNonTeaching, setShowNonTeaching] = useState(true);
  const [outcomeDraft, setOutcomeDraft] = useState<{ entry: WeekEntry; outcome: "partial" | "not-taught"; detail: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const todayKey = localDateKey(new Date());
  const week = useMemo(() => deriveTeachingWeek(planner, weekStart, new Date(`${todayKey}T12:00:00`)), [planner, weekStart, todayKey]);

  useEffect(() => {
    let savedValue = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem(preferenceKey) ?? "null") as { showNonTeaching?: unknown } | null;
      if (typeof saved?.showNonTeaching === "boolean") savedValue = saved.showNonTeaching;
    } catch { /* Keep the calm default when preference data is malformed. */ }
    const frame = window.requestAnimationFrame(() => setShowNonTeaching(savedValue));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const todayIndex = week.days.findIndex((day) => day.dateKey === todayKey);
    if (todayIndex < 1 || !gridRef.current || !window.matchMedia("(max-width: 540px)").matches) return;
    gridRef.current.scrollTo({ left: 96 + todayIndex * 274, behavior: "smooth" });
  }, [todayKey, week.days]);

  function changeNonTeachingPreference(value: boolean) {
    setShowNonTeaching(value);
    try { window.localStorage.setItem(preferenceKey, JSON.stringify({ showNonTeaching: value })); } catch { /* Preference persistence is non-critical. */ }
  }

  function saveOutcome(entry: WeekEntry, outcome: TeachingSessionOutcome, detail = "") {
    let next = materializeTeachingSessionsForDate(planner, new Date(`${entry.date}T12:00:00`));
    const session = next.teachingSessions.find((item) => item.date === entry.date && item.timetableSessionId === entry.timetable.id);
    if (!session) return;
    next = recordTeachingSessionOutcome(next, session.id, outcome, detail);
    onChange(next);
    setOutcomeDraft(null);
  }

  function completeDay(dateKey: string) {
    onChange(markAllTaughtAsPlanned(planner, new Date(`${dateKey}T12:00:00`)));
  }

  const weekLabel = `${rangeFormatter.format(week.start)} – ${rangeFormatter.format(week.end)}`;
  const slots = [...planner.sessionSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));

  function renderEntry(entry: WeekEntry) {
    if (entry.kind === "non-teaching") return <div className={`week-context-block context-${entry.timetable.type}`} key={entry.key}><span>Non-teaching</span><strong>{entry.label}</strong>{entry.specialistClass && <small>{entry.specialistClass.name}</small>}</div>;
    const lessonLabel = `${entry.lessonNumber ? `L${entry.lessonNumber} · ` : ""}${entry.session?.outcome !== "planned" && entry.session ? entry.session.plannedLessonTitle : entry.lesson?.title ?? (entry.state === "unit-complete" ? "Choose next Unit" : "Lesson not assigned")}`;
    return <article className={`week-card state-${entry.state} ${entry.classColourId ? "has-class-colour" : ""} ${entry.progressStatus && entry.progressStatus.kind !== "on-track" ? "has-attention" : ""} ${entry.session?.outcome === "partial" || entry.session?.outcome === "not-taught" ? "has-attention" : ""}`} style={classColourStyle(entry.classColourId)} key={entry.key}>
      <div className="week-card-summary">
        <button className="week-card-toggle" type="button" aria-label={`${expanded === entry.key ? "Hide" : "Show"} details for ${entry.specialistClass?.name ?? entry.label}`} aria-expanded={expanded === entry.key} onClick={() => setExpanded(expanded === entry.key ? null : entry.key)} />
        <span className="week-card-kind">Teaching</span><span className={`week-card-state outcome-${entry.session?.outcome ?? entry.state}`}>{stateLabel(entry)}</span>
        <strong className="week-card-class">{entry.specialistClass?.name ?? entry.label}</strong>
        {entry.progressStatus && <span className={`week-progress status-${entry.progressStatus.kind}`}>{entry.progressStatus.kind === "on-track" ? "✓" : "⚠"} {entry.progressStatus.label}</span>}
        <span className="week-card-unit">{entry.session?.outcome !== "planned" && entry.session ? entry.session.plannedUnitTitle : entry.unit?.title ?? (entry.state === "unit-complete" ? "Unit complete" : "Unit not assigned")}</span>
        {entry.lesson?.externalResourceRef
          ? <ResourceLinkAction reference={entry.lesson.externalResourceRef} library={unitLibrary} label={lessonLabel} unavailableLabel={lessonLabel} className="week-card-lesson week-card-lesson-link" />
          : <b className="week-card-lesson">{lessonLabel}</b>}
        {(entry.session?.reason || entry.session?.note) && <span className="week-card-note">{entry.session.reason ?? entry.session.note}</span>}
      </div>
      {expanded === entry.key && <div className="week-card-detail">
        {entry.lesson?.description && <p>{entry.lesson.description}</p>}
        {entry.lesson?.externalResourceRef && <div className="week-resource-action"><ResourceLinkAction reference={entry.lesson.externalResourceRef} library={unitLibrary} onRelink={onOpenUnits} label="Open lesson" /></div>}
        <dl><div><dt>Current class position</dt><dd>{entry.unit?.title ?? "Not assigned"}{entry.lessonNumber ? ` · Lesson ${entry.lessonNumber}` : ""}</dd></div><div><dt>Cohort reference</dt><dd>{entry.progressStatus?.label ?? "Not configured"}</dd></div></dl>
        {entry.previousSession && <div className={`week-previous outcome-${entry.previousSession.outcome}`}><span>Previous session · {entry.previousSession.date}</span><strong>{outcomeLabels[entry.previousSession.outcome]}</strong>{(entry.previousSession.reason || entry.previousSession.note) && <p>{entry.previousSession.reason ?? entry.previousSession.note}</p>}</div>}
        {entry.projectionUncertain && <p className="projection-caution">This proposed Lesson depends on an earlier unconfirmed occurrence. It will update after that outcome is recorded.</p>}
        {entry.state === "unit-complete" || entry.state === "needs-setup" ? <button className="secondary-button" type="button" onClick={onOpenSettings}>{entry.state === "unit-complete" ? "Choose next Unit" : "Complete setup"}</button> : entry.canRecordOutcome && <div className="week-outcome-actions" aria-label={`Record outcome for ${entry.label}`}><button type="button" className={entry.session?.outcome === "completed" ? "active completed" : ""} onClick={() => saveOutcome(entry, "completed")}>✓ Completed</button><button type="button" className={entry.session?.outcome === "partial" ? "active partial" : ""} onClick={() => setOutcomeDraft({ entry, outcome: "partial", detail: entry.session?.note ?? "" })}>◐ Partial</button><button type="button" className={entry.session?.outcome === "not-taught" ? "active not-taught" : ""} onClick={() => setOutcomeDraft({ entry, outcome: "not-taught", detail: entry.session?.reason ?? "" })}>× Not taught</button>{entry.session && entry.session.outcome !== "planned" && <button type="button" onClick={() => saveOutcome(entry, "planned")}>Clear</button>}</div>}
        <div className="week-detail-links">{entry.specialistClass && <button type="button" onClick={() => onOpenClass(entry.specialistClass!.id)}>Open Progress detail</button>}<button type="button" onClick={() => onQuickNote(entry.specialistClass?.id, `Week · ${entry.date}`)}>＋ Quick note</button></div>
      </div>}
    </article>;
  }

  return <main className="week-main" id="top">
    <section className="week-toolbar" aria-label="Week navigation">
      <div className="week-controls"><button type="button" onClick={() => setWeekStart(shiftTeachingWeek(weekStart, -1))} aria-label="Previous week">←</button><button type="button" onClick={() => setWeekStart(startOfTeachingWeek(new Date()))}>This week</button><button type="button" onClick={() => setWeekStart(shiftTeachingWeek(weekStart, 1))} aria-label="Next week">→</button></div>
      <div><span>Teaching week</span><strong>{weekLabel}</strong></div>
      <label className="non-teaching-toggle"><input type="checkbox" checked={showNonTeaching} onChange={(event) => changeNonTeachingPreference(event.target.checked)} /><span>Show non-teaching</span></label>
    </section>

    {!planner.timetableSessions.some((item) => item.weekday >= 1 && item.weekday <= 5) ? <section className="week-empty"><strong>No weekly timetable configured</strong><p>Add teaching and non-teaching sessions in Settings to build this week automatically.</p><button className="primary-button" type="button" onClick={onOpenSettings}>Open Settings</button></section> : <div className="week-grid" ref={gridRef} role="table" aria-label={weekLabel}>
      <div className="week-grid-corner" role="columnheader">Session</div>
      {week.days.map(day => { const remaining = day.entries.filter(entry => entry.kind === "teaching" && entry.canRecordOutcome && (!entry.session || entry.session.outcome === "planned")); const isToday = day.dateKey === todayKey; return <header className={`week-day-header ${isToday ? "is-today" : ""}`} role="columnheader" key={day.dateKey}><div><span>{isToday ? "Today" : dayNumberFormatter.format(day.date)}</span><h2 id={`day-${day.dateKey}`}>{dayFormatter.format(day.date)}</h2></div><small>{day.entries.filter(entry => entry.kind === "teaching").length} classes</small>{remaining.length > 1 && <button className="week-bulk-button" type="button" onClick={() => completeDay(day.dateKey)}>✓ Complete day</button>}</header>; })}
      {slots.map(slot => <div className={`week-slot-row kind-${slot.kind}`} role="row" key={slot.id}>
        <div className="week-slot-label" role="rowheader"><strong>{slot.label}</strong><span>{timeLabel(slot.startTime)}–{timeLabel(slot.endTime)}</span></div>
        {week.days.map(day => { const entry = slot.kind === "session" ? day.entries.find(item => item.timetable.slotId === slot.id && (showNonTeaching || item.kind === "teaching")) : undefined; return <div className={`week-cell ${day.dateKey === todayKey ? "is-today" : ""}`} role="cell" key={`${day.dateKey}-${slot.id}`}>{entry ? renderEntry(entry) : <span className="week-cell-empty" aria-hidden="true" />}</div>; })}
      </div>)}
    </div>}

    {outcomeDraft && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setOutcomeDraft(null)}><section className="quick-note-modal outcome-modal" role="dialog" aria-modal="true" aria-labelledby="week-outcome-title"><div className="drawer-topline"><span>Teaching outcome</span><button className="close-button" type="button" onClick={() => setOutcomeDraft(null)} aria-label="Close outcome detail">×</button></div><h2 id="week-outcome-title">{outcomeDraft.entry.label} · {outcomeDraft.outcome === "partial" ? "Partial" : "Not taught"}</h2><p>{outcomeDraft.outcome === "partial" ? "Optionally note where the lesson stopped." : "Optionally record why the lesson did not happen."}</p><textarea rows={3} value={outcomeDraft.detail} onChange={(event) => setOutcomeDraft({ ...outcomeDraft, detail: event.target.value })} placeholder={outcomeDraft.outcome === "partial" ? "Stopped after Activity 3" : "Year 4 Camp"} /><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setOutcomeDraft(null)}>Cancel</button><button className="primary-button" type="button" onClick={() => saveOutcome(outcomeDraft.entry, outcomeDraft.outcome, outcomeDraft.detail)}>Save {outcomeLabels[outcomeDraft.outcome]}</button></div></section></div>}
  </main>;
}
