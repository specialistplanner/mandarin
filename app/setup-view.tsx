"use client";

import { useRef, useState, type CSSProperties } from "react";
import {
  CLASS_COLOUR_PRESETS,
  SESSION_TYPE_LABELS,
  addLessonRecord,
  createClassRecord,
  createUnitRecord,
  deleteClassRecord,
  deleteLessonRecord,
  deleteUnitRecord,
  getScheduledTeachingOccurrencesInRange,
  localDateKey,
  reconcilePreviousTeaching,
  recordTeachingSessionOutcome,
  reorderLessonRecord,
  renameClassRecord,
  setClassPosition,
  setClassLesson,
  setClassColour,
  setLessonExternalResource,
  setUnitExternalResource,
  setCurrentUnit,
  setExpectedLesson,
  touchPlanner,
  updateLessonRecord,
  updateUnitDetails,
  type PlannerData,
  type SessionType,
  type TimetableSession,
} from "@/lib/domain";
import { createBlankPlanner, freshSamplePlanner } from "@/lib/sample-data";
import { exportPlannerData, importPlannerData } from "@/lib/storage";
import { findLinkedUnit, lessonReference, unitReference, UNIT_LIBRARY_PROVIDER } from "@/lib/unit-library";
import { ResourceLinkAction } from "./resource-link";
import type { UnitLibraryState } from "./use-unit-library";

type SetupSection = "cohorts" | "timetable" | "notes" | "data";
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const outcomeLabels = { planned: "Planned", completed: "Completed", partial: "Partial", "not-taught": "Not taught" } as const;
const classColourOptions = Object.entries(CLASS_COLOUR_PRESETS);

function classColourStyle(colourId: keyof typeof CLASS_COLOUR_PRESETS | undefined): CSSProperties | undefined {
  const colour = colourId ? CLASS_COLOUR_PRESETS[colourId] : undefined;
  return colour ? {
    "--class-card-bg": colour.background,
    "--class-card-accent": colour.accent,
    "--class-card-foreground": colour.foreground,
  } as CSSProperties : undefined;
}

function previousTeachingWeek() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { startDate: localDateKey(monday), endDate: localDateKey(friday) };
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function downloadBackup(planner: PlannerData) {
  const blob = new Blob([exportPlannerData(planner)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `specialist-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function SetupView({ planner, onChange, onBack, unitLibrary, initialSection = "cohorts" }: {
  planner: PlannerData;
  onChange: (planner: PlannerData) => void;
  onBack: () => void;
  unitLibrary: UnitLibraryState;
  initialSection?: SetupSection;
}) {
  const [section, setSection] = useState<SetupSection>(initialSection);
  const [newYearLabel, setNewYearLabel] = useState("");
  const [newClassNames, setNewClassNames] = useState<Record<string, string>>({});
  const [newUnitNames, setNewUnitNames] = useState<Record<string, string>>({});
  const [newLessonNames, setNewLessonNames] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState("");
  const [message, setMessage] = useState("");
  const [linkingUnitId, setLinkingUnitId] = useState<string | null>(null);
  const [sessionDraft, setSessionDraft] = useState({ weekday: 1, startTime: "09:00", endTime: "10:00", type: "specialist-teaching" as SessionType, classId: "", label: "" });
  const [reconciliationRange, setReconciliationRange] = useState(previousTeachingWeek);
  const importRef = useRef<HTMLInputElement>(null);
  const activeSubject = planner.subjects.find((item) => item.id === planner.activeSubjectId)!;
  let reconciliationPreview: ReturnType<typeof getScheduledTeachingOccurrencesInRange> = [];
  try { reconciliationPreview = getScheduledTeachingOccurrencesInRange(planner, reconciliationRange.startDate, reconciliationRange.endDate); }
  catch { /* Date inputs can be temporarily incomplete while editing. */ }

  function apply(action: () => PlannerData) {
    try { onChange(action()); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "That change could not be saved."); }
  }

  function addYearLevel() {
    const label = newYearLabel.trim();
    if (!label) return setMessage("Enter a year level name first.");
    const shortLabel = label.replace(/^Year\s+/i, "").slice(0, 2).toUpperCase();
    onChange(touchPlanner({ ...planner, yearLevels: [...planner.yearLevels, { id: makeId("year"), label, shortLabel: shortLabel || label.slice(0, 1), currentUnitId: null, expectedLessonId: null }] }));
    setNewYearLabel("");
  }

  function removeYearLevel(yearLevelId: string) {
    const hasDependencies = planner.classes.some((item) => item.yearLevelId === yearLevelId) || planner.units.some((unit) => unit.yearLevelId === yearLevelId);
    if (hasDependencies) return setMessage("Remove this year level’s classes and units first.");
    if (!window.confirm("Remove this empty year level?")) return;
    onChange(touchPlanner({ ...planner, yearLevels: planner.yearLevels.filter((item) => item.id !== yearLevelId) }));
  }

  function addClass(yearLevelId: string) {
    const name = (newClassNames[yearLevelId] ?? "").trim();
    if (!name) return setMessage("Enter a class name first.");
    apply(() => createClassRecord(planner, { id: makeId("class"), name, yearLevelId }));
    setNewClassNames((current) => ({ ...current, [yearLevelId]: "" }));
  }

  function removeClass(classId: string, name: string) {
    if (!window.confirm(`Remove ${name}? Its progress and timetable sessions will also be removed. Notes will be kept without a class link.`)) return;
    apply(() => deleteClassRecord(planner, classId));
  }

  function addUnit(yearLevelId: string) {
    const title = (newUnitNames[yearLevelId] ?? "").trim();
    if (!title) return setMessage("Enter a unit name first.");
    const unitId = makeId("unit");
    if (planner.classes.some((item) => item.yearLevelId === yearLevelId) && !window.confirm("Make this the cohort reference unit? Existing classes will keep their individual units and lessons.")) return;
    apply(() => createUnitRecord(planner, {
      id: unitId, yearLevelId, title, lessons: [{ id: makeId("lesson"), title: "First lesson", sequence: 1 }],
    }));
    setNewUnitNames((current) => ({ ...current, [yearLevelId]: "" }));
  }

  function switchUnit(yearLevelId: string, unitId: string) {
    const cohortHasClasses = planner.classes.some((item) => item.yearLevelId === yearLevelId);
    if (cohortHasClasses && !window.confirm("Switch the cohort reference unit? Individual class units and lessons will stay unchanged.")) return;
    apply(() => setCurrentUnit(planner, yearLevelId, unitId));
  }

  function addLesson(unitId: string) {
    const title = (newLessonNames[unitId] ?? "").trim();
    if (!title) return setMessage("Enter a lesson name first.");
    apply(() => addLessonRecord(planner, unitId, { id: makeId("lesson"), title, sequence: 999 }));
    setNewLessonNames((current) => ({ ...current, [unitId]: "" }));
  }

  function removeLesson(unitId: string, lessonId: string, title: string) {
    if (!window.confirm(`Delete “${title}”? Any class or cohort pointing to it will move to the nearest remaining lesson.`)) return;
    apply(() => deleteLessonRecord(planner, unitId, lessonId));
  }

  function addSession() {
    if (sessionDraft.startTime >= sessionDraft.endTime) return setMessage("End time must be after start time.");
    if (sessionDraft.type === "specialist-teaching" && !sessionDraft.classId) return setMessage("Choose a class for specialist teaching.");
    const next: TimetableSession = {
      id: makeId("session"), weekday: sessionDraft.weekday, startTime: sessionDraft.startTime,
      endTime: sessionDraft.endTime, type: sessionDraft.type,
      classId: sessionDraft.classId || undefined, subjectId: planner.activeSubjectId,
      label: sessionDraft.label.trim() || undefined,
    };
    onChange(touchPlanner({ ...planner, timetableSessions: [...planner.timetableSessions, next] }));
    setSessionDraft((current) => ({ ...current, label: "" }));
  }

  function updateSession(id: string, patch: Partial<TimetableSession>) {
    const existing = planner.timetableSessions.find((item) => item.id === id);
    if (!existing) return;
    const next = { ...existing, ...patch };
    if (next.type === "specialist-teaching" && !next.classId) {
      setMessage("Choose a class before changing this to Specialist Teaching.");
      return;
    }
    onChange(touchPlanner({ ...planner, timetableSessions: planner.timetableSessions.map((item) => item.id === id ? next : item) }));
  }

  function removeSession(id: string) {
    if (!window.confirm("Remove this weekly session?")) return;
    onChange(touchPlanner({ ...planner, timetableSessions: planner.timetableSessions.filter((item) => item.id !== id) }));
  }

  function addNote() {
    if (!noteText.trim()) return;
    onChange(touchPlanner({ ...planner, trialNotes: [{ id: makeId("note"), text: noteText.trim(), createdAt: new Date().toISOString(), context: "Setup" }, ...planner.trialNotes] }));
    setNoteText("");
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      const imported = importPlannerData(await file.text());
      if (!window.confirm("Import this backup? It will replace all current local planner data.")) return;
      onChange(imported);
      setMessage("Backup imported successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The backup could not be imported.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  function runReconciliation() {
    if (!reconciliationPreview.length) return setMessage("Choose a past date range containing Specialist Teaching sessions.");
    if (!window.confirm("Export a JSON backup before reconciliation. Continue only if your current class positions are correct and you have saved a backup.")) return;
    try {
      onChange(reconcilePreviousTeaching(planner, reconciliationRange.startDate, reconciliationRange.endDate));
      setMessage(`Teaching history reconciled through ${reconciliationRange.endDate}. Current class progress was preserved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reconcile previous teaching.");
    }
  }

  function changeHistoricalOutcome(sessionId: string, outcome: "completed" | "partial" | "not-taught") {
    const existing = planner.teachingSessions.find((item) => item.id === sessionId);
    if (!existing) return;
    let detail = "";
    if (outcome === "partial") {
      const answer = window.prompt("Optional note for this Partial lesson:", existing.note ?? "");
      if (answer === null) return;
      detail = answer;
    }
    if (outcome === "not-taught") {
      const answer = window.prompt("Optional reason this lesson was Not taught:", existing.reason ?? "");
      if (answer === null) return;
      detail = answer;
    }
    apply(() => recordTeachingSessionOutcome(planner, sessionId, outcome, detail));
  }

  return (
    <main className="setup-main" id="top">
      <section className="setup-hero">
        <div>
          <p className="eyebrow">Live Classroom Trial</p>
          <h1>Set up your teaching week.</h1>
          <p>Everything here is saved only in this browser. Changes appear in Week and Progress straight away.</p>
        </div>
        <button className="primary-button" type="button" onClick={onBack}>Return to Week</button>
      </section>

      <div className="setup-layout">
        <aside className="setup-menu" aria-label="Setup sections">
          <div className="setup-subject-card">
            <span>Active subject</span>
            <input aria-label="Active subject name" value={activeSubject.name} onChange={(event) => onChange(touchPlanner({ ...planner, subjects: planner.subjects.map((item) => item.id === activeSubject.id ? { ...item, name: event.target.value } : item) }))} />
            <small>Single-subject mode for v0.5</small>
          </div>
          {([['cohorts', 'Year levels & units'], ['timetable', 'Weekly timetable'], ['notes', `Trial notes (${planner.trialNotes.length})`], ['data', 'Backup & reset']] as [SetupSection, string][]).map(([id, label]) => (
            <button type="button" key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}<span>→</span></button>
          ))}
        </aside>

        <section className="setup-content">
          {message && <div className="setup-message" role="status">{message}<button type="button" onClick={() => setMessage("")}>×</button></div>}

          {section === "cohorts" && <>
            <div className="setup-section-title">
              <div><p className="section-kicker">Step 1–3</p><h2>Year levels, classes & units</h2><p>Define the cohort reference, then set each class’s actual unit and next lesson independently.</p></div>
            </div>
            <div className="add-row top-add-row">
              <input value={newYearLabel} onChange={(event) => setNewYearLabel(event.target.value)} placeholder="New year level, e.g. Year 4" onKeyDown={(event) => event.key === "Enter" && addYearLevel()} />
              <button className="secondary-button" type="button" onClick={addYearLevel}>Add year level</button>
            </div>

            {!planner.yearLevels.length && <div className="setup-empty"><strong>Start with your first year level</strong><p>Add Prep, Year 1, Grade 4 East—or whatever naming your school uses.</p></div>}

            <div className="cohort-editor-list">
              {planner.yearLevels.map((level) => {
                const cohort = planner.classes.filter((item) => item.yearLevelId === level.id);
                const levelUnits = planner.units.filter((unit) => unit.yearLevelId === level.id);
                const currentUnit = levelUnits.find((unit) => unit.id === level.currentUnitId);
                return <details className="cohort-editor" key={level.id}>
                  <summary className="cohort-editor-summary">
                    <span className="year-badge">{level.shortLabel}</span>
                    <span className="cohort-summary-name">{level.label}</span>
                    <span className="cohort-summary-meta">{cohort.length} {cohort.length === 1 ? "class" : "classes"}</span>
                    <span className="cohort-summary-meta">{currentUnit?.title ?? "No reference unit"}</span>
                    <span className="cohort-summary-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="cohort-editor-head">
                    <span className="year-badge">{level.shortLabel}</span>
                    <label><span>Year level name</span><input value={level.label} onChange={(event) => onChange(touchPlanner({ ...planner, yearLevels: planner.yearLevels.map((item) => item.id === level.id ? { ...item, label: event.target.value } : item) }))} /></label>
                    <label className="short-label"><span>Short</span><input maxLength={2} value={level.shortLabel} onChange={(event) => onChange(touchPlanner({ ...planner, yearLevels: planner.yearLevels.map((item) => item.id === level.id ? { ...item, shortLabel: event.target.value } : item) }))} /></label>
                    <button className="text-button danger" type="button" onClick={() => removeYearLevel(level.id)}>Remove year level</button>
                  </div>

                  <div className="cohort-editor-grid">
                    <div className="editor-panel">
                      <div className="editor-panel-title"><div><span>Classes</span><strong>{cohort.length} configured</strong></div></div>
                      <div className="editable-list">
                        {cohort.map((item) => {
                          const progress = planner.classProgress[item.id];
                          const classUnit = levelUnits.find((unit) => unit.id === progress?.unitId) ?? currentUnit;
                          const selectedColour = planner.classColours[item.id];
                          return <div className={`editable-class ${selectedColour ? "has-class-colour" : ""}`} style={classColourStyle(selectedColour)} key={item.id}>
                            <input aria-label={`${item.name} class name`} value={item.name} onChange={(event) => apply(() => renameClassRecord(planner, item.id, event.target.value))} />
                            {classUnit ? <><select aria-label={`${item.name} current unit`} value={classUnit.id} onChange={(event) => { const nextUnit = levelUnits.find((unit) => unit.id === event.target.value); if (nextUnit) apply(() => setClassPosition(planner, item.id, nextUnit.id, nextUnit.lessons[0].id)); }}>
                              {levelUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.title}</option>)}
                            </select><select aria-label={`${item.name} next lesson`} value={progress?.lessonId ?? classUnit.lessons[0].id} onChange={(event) => apply(() => setClassLesson(planner, item.id, event.target.value))}>
                              {classUnit.lessons.map((lesson, index) => <option value={lesson.id} key={lesson.id}>L{index + 1} · {lesson.title}</option>)}
                            </select></> : <span className="needs-unit">Add a unit first</span>}
                            <button className="icon-button danger" type="button" onClick={() => removeClass(item.id, item.name)} aria-label={`Remove ${item.name}`}>×</button>
                            <fieldset className="class-colour-picker">
                              <legend>Card colour <small>optional</small></legend>
                              <button className={`colour-choice colour-none ${!selectedColour ? "selected" : ""}`} type="button" aria-pressed={!selectedColour} aria-label={`Use no custom card colour for ${item.name}`} title="No custom colour" onClick={() => apply(() => setClassColour(planner, item.id))}><span aria-hidden="true">—</span></button>
                              {classColourOptions.map(([colourId, colour]) => <button className={`colour-choice ${selectedColour === colourId ? "selected" : ""}`} style={{ background: colour.background, borderColor: colour.accent }} type="button" key={colourId} aria-pressed={selectedColour === colourId} aria-label={`Use ${colour.label} card colour for ${item.name}`} title={colour.label} onClick={() => apply(() => setClassColour(planner, item.id, colourId as keyof typeof CLASS_COLOUR_PRESETS))}><span className="visually-hidden">{colour.label}</span></button>)}
                            </fieldset>
                          </div>;
                        })}
                      </div>
                      <div className="add-row">
                        <input value={newClassNames[level.id] ?? ""} onChange={(event) => setNewClassNames((current) => ({ ...current, [level.id]: event.target.value }))} placeholder="Class name" onKeyDown={(event) => event.key === "Enter" && addClass(level.id)} />
                        <button type="button" onClick={() => addClass(level.id)}>Add</button>
                      </div>
                    </div>

                    <div className="editor-panel unit-editor-panel">
                      <div className="editor-panel-title unit-switcher">
                        <div><span>Cohort reference unit</span>{currentUnit && <strong>{currentUnit.title}</strong>}</div>
                        {levelUnits.length > 0 && <select value={currentUnit?.id ?? ""} onChange={(event) => switchUnit(level.id, event.target.value)} aria-label={`${level.label} cohort reference unit`}>
                          {levelUnits.map((unit) => <option value={unit.id} key={unit.id}>{unit.title}</option>)}
                        </select>}
                      </div>

                      {!currentUnit ? <div className="mini-empty"><p>No cohort reference unit yet.</p></div> : <>
                        <div className="unit-fields">
                          <label><span>Unit name</span><input value={currentUnit.title} onChange={(event) => apply(() => updateUnitDetails(planner, currentUnit.id, event.target.value, currentUnit.description))} /></label>
                          <label><span>Short description <i>optional</i></span><input value={currentUnit.description ?? ""} onChange={(event) => apply(() => updateUnitDetails(planner, currentUnit.id, currentUnit.title, event.target.value))} /></label>
                          <label><span>Cohort expected / next lesson</span><select value={level.expectedLessonId ?? currentUnit.lessons[0].id} onChange={(event) => apply(() => setExpectedLesson(planner, level.id, event.target.value))}>
                            {currentUnit.lessons.map((lesson, index) => <option value={lesson.id} key={lesson.id}>Lesson {index + 1} · {lesson.title}</option>)}
                          </select></label>
                        </div>
                        <div className="unit-library-link-panel">
                          <div>
                            <span>Linked resource</span>
                            {currentUnit.externalResourceRef?.provider === UNIT_LIBRARY_PROVIDER
                              ? <><strong>{findLinkedUnit(unitLibrary.index, currentUnit.externalResourceRef)?.title ?? currentUnit.externalResourceRef.label ?? currentUnit.externalResourceRef.resourceId}</strong><small>Unit Library owns this content.</small></>
                              : <><strong>Local only</strong><small>Resource linking is optional.</small></>}
                          </div>
                          {currentUnit.externalResourceRef?.provider === UNIT_LIBRARY_PROVIDER && <ResourceLinkAction reference={currentUnit.externalResourceRef} library={unitLibrary} onRelink={() => setLinkingUnitId(currentUnit.id)} />}
                          <button className="secondary-button compact-button" type="button" onClick={() => setLinkingUnitId(linkingUnitId === currentUnit.id ? null : currentUnit.id)}>{currentUnit.externalResourceRef ? "Change link" : "Choose from Unit Library"}</button>
                          {currentUnit.externalResourceRef && <button className="text-button danger" type="button" onClick={() => apply(() => setUnitExternalResource(planner, currentUnit.id))}>Remove link</button>}
                          {linkingUnitId === currentUnit.id && <div className="unit-library-chooser">
                            {unitLibrary.status === "loading" ? <p>Loading Unit Library…</p> : unitLibrary.status === "unavailable" ? <p>Unit Library is unavailable. Your local Unit remains unchanged.</p> : <label><span>Choose Unit Library Unit</span><select defaultValue="" onChange={(event) => {
                              const linked = unitLibrary.index?.units.find((unit) => unit.id === event.target.value);
                              if (linked) { apply(() => setUnitExternalResource(planner, currentUnit.id, unitReference(linked))); setLinkingUnitId(null); }
                            }}><option value="" disabled>Select a Unit</option>{unitLibrary.index?.units.map((unit) => <option value={unit.id} key={unit.id}>{unit.yearLevel === 0 ? "Prep" : `Year ${unit.yearLevel}`} · {unit.title}</option>)}</select></label>}
                          </div>}
                        </div>
                        <div className="lesson-editor-title"><span>Lesson sequence</span><small>Progress follows lesson IDs when order changes.</small></div>
                        <ol className="lesson-editor-list">
                          {currentUnit.lessons.map((lesson, index) => <li key={lesson.id}>
                            <span className="lesson-number">{index + 1}</span>
                            <div className="lesson-inputs">
                              <input aria-label={`Lesson ${index + 1} title`} value={lesson.title} onChange={(event) => apply(() => updateLessonRecord(planner, currentUnit.id, lesson.id, event.target.value, lesson.description))} />
                              <input aria-label={`Lesson ${index + 1} description`} className="lesson-description-input" value={lesson.description ?? ""} placeholder="Optional description" onChange={(event) => apply(() => updateLessonRecord(planner, currentUnit.id, lesson.id, lesson.title, event.target.value))} />
                              {currentUnit.externalResourceRef?.provider === UNIT_LIBRARY_PROVIDER && <div className="lesson-library-link">
                                <label><span>Unit Library lesson <i>optional</i></span><select aria-label={`${lesson.title} Unit Library lesson`} value={lesson.externalResourceRef?.resourceId ?? ""} onChange={(event) => {
                                  const libraryUnit = findLinkedUnit(unitLibrary.index, currentUnit.externalResourceRef);
                                  const linked = libraryUnit?.lessons.find((candidate) => candidate.id === event.target.value);
                                  apply(() => setLessonExternalResource(planner, currentUnit.id, lesson.id, linked && libraryUnit ? lessonReference(libraryUnit, linked) : undefined));
                                }}><option value="">Local only</option>{findLinkedUnit(unitLibrary.index, currentUnit.externalResourceRef)?.lessons.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.title}</option>)}</select></label>
                                {lesson.externalResourceRef && <ResourceLinkAction reference={lesson.externalResourceRef} library={unitLibrary} onRelink={() => setLinkingUnitId(currentUnit.id)} label="Open lesson" />}
                              </div>}
                            </div>
                            <div className="reorder-buttons">
                              <button type="button" disabled={index === 0} onClick={() => apply(() => reorderLessonRecord(planner, currentUnit.id, lesson.id, -1))} aria-label={`Move ${lesson.title} up`}>↑</button>
                              <button type="button" disabled={index === currentUnit.lessons.length - 1} onClick={() => apply(() => reorderLessonRecord(planner, currentUnit.id, lesson.id, 1))} aria-label={`Move ${lesson.title} down`}>↓</button>
                            </div>
                            <button className="icon-button danger" type="button" onClick={() => removeLesson(currentUnit.id, lesson.id, lesson.title)} aria-label={`Delete ${lesson.title}`}>×</button>
                          </li>)}
                        </ol>
                        <div className="add-row">
                          <input value={newLessonNames[currentUnit.id] ?? ""} onChange={(event) => setNewLessonNames((current) => ({ ...current, [currentUnit.id]: event.target.value }))} placeholder="New lesson title" onKeyDown={(event) => event.key === "Enter" && addLesson(currentUnit.id)} />
                          <button type="button" onClick={() => addLesson(currentUnit.id)}>Add lesson</button>
                        </div>
                      </>}
                      <div className="new-unit-row">
                        <input value={newUnitNames[level.id] ?? ""} onChange={(event) => setNewUnitNames((current) => ({ ...current, [level.id]: event.target.value }))} placeholder="New unit name" />
                        <button type="button" onClick={() => addUnit(level.id)}>Create & use</button>
                        {currentUnit && levelUnits.length > 1 && <button className="text-button danger" type="button" onClick={() => {
                          const other = levelUnits.find((unit) => unit.id !== currentUnit.id)!;
                          if (!window.confirm(`Replace “${currentUnit.title}” with “${other.title}” and delete the old unit? Class progress will reset.`)) return;
                          apply(() => deleteUnitRecord(setCurrentUnit(planner, level.id, other.id), currentUnit.id));
                        }}>Replace current</button>}
                      </div>
                    </div>
                  </div>
                </details>;
              })}
            </div>
          </>}

          {section === "timetable" && <>
            <div className="setup-section-title"><div><p className="section-kicker">Step 4</p><h2>Weekly timetable</h2><p>Specialist Teaching sessions become progress-aware Week cards; other entries provide muted timetable context.</p></div></div>
            <div className="session-form">
              <label><span>Day</span><select value={sessionDraft.weekday} onChange={(event) => setSessionDraft({ ...sessionDraft, weekday: Number(event.target.value) })}>{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>
              <label><span>Start</span><input type="time" value={sessionDraft.startTime} onChange={(event) => setSessionDraft({ ...sessionDraft, startTime: event.target.value })} /></label>
              <label><span>End</span><input type="time" value={sessionDraft.endTime} onChange={(event) => setSessionDraft({ ...sessionDraft, endTime: event.target.value })} /></label>
              <label><span>Type</span><select value={sessionDraft.type} onChange={(event) => setSessionDraft({ ...sessionDraft, type: event.target.value as SessionType })}>{Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>Class {sessionDraft.type !== "specialist-teaching" && <i>optional</i>}</span><select value={sessionDraft.classId} onChange={(event) => setSessionDraft({ ...sessionDraft, classId: event.target.value })}><option value="">No class</option>{planner.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label><span>Label <i>optional</i></span><input value={sessionDraft.label} onChange={(event) => setSessionDraft({ ...sessionDraft, label: event.target.value })} placeholder="e.g. House assembly" /></label>
              <button className="primary-button" type="button" onClick={addSession}>Add session</button>
            </div>
            <div className="week-editor">
              {weekdays.map((day, weekday) => {
                const sessions = planner.timetableSessions.filter((item) => item.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime));
                if (!sessions.length && (weekday === 0 || weekday === 6)) return null;
                return <section className="day-editor" key={day}><h3>{day}<span>{sessions.length}</span></h3>
                  {!sessions.length ? <p className="day-empty">No sessions</p> : sessions.map((session) => { const selectedColour = session.classId ? planner.classColours[session.classId] : undefined; return <div className={`session-editor-row ${selectedColour ? "has-class-colour" : ""}`} style={classColourStyle(selectedColour)} key={session.id}>
                    <div className={`session-type-mark ${session.type}`} aria-hidden="true" />
                    <input aria-label={`${day} start time`} type="time" value={session.startTime} onChange={(event) => updateSession(session.id, { startTime: event.target.value })} />
                    <input aria-label={`${day} end time`} type="time" value={session.endTime} onChange={(event) => updateSession(session.id, { endTime: event.target.value })} />
                    <select aria-label={`${day} session type`} value={session.type} onChange={(event) => updateSession(session.id, { type: event.target.value as SessionType })}>{Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
                    <select aria-label={`${day} session class`} value={session.classId ?? ""} onChange={(event) => updateSession(session.id, { classId: event.target.value || undefined })}><option value="">No class</option>{planner.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
                    <input aria-label={`${day} session label`} value={session.label ?? ""} placeholder="Optional label" onChange={(event) => updateSession(session.id, { label: event.target.value || undefined })} />
                    <button className="icon-button danger" type="button" onClick={() => removeSession(session.id)} aria-label={`Remove ${day} session`}>×</button>
                  </div>; })}
                </section>;
              })}
            </div>
          </>}

          {section === "notes" && <>
            <div className="setup-section-title"><div><p className="section-kicker">Live research</p><h2>Trial notes</h2><p>Capture friction, surprises and missing context while the real teaching week is fresh.</p></div></div>
            <div className="note-composer"><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="What did you notice?" rows={3} /><button className="primary-button" type="button" onClick={addNote}>Save note</button></div>
            <div className="notes-list">
              {!planner.trialNotes.length && <div className="setup-empty"><strong>No trial notes yet</strong><p>Useful notes describe what happened, what you expected, and what information was missing.</p></div>}
              {planner.trialNotes.map((note) => {
                const item = planner.classes.find((candidate) => candidate.id === note.classId);
                return <article className="note-card" key={note.id}><div><span>{new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(note.createdAt))}</span><strong>{item?.name ?? note.context ?? "Planner"}</strong></div><p>{note.text}</p><button className="text-button danger" type="button" onClick={() => window.confirm("Delete this trial note?") && onChange(touchPlanner({ ...planner, trialNotes: planner.trialNotes.filter((item) => item.id !== note.id) }))}>Delete</button></article>;
              })}
            </div>
          </>}

          {section === "data" && <>
            <div className="setup-section-title"><div><p className="section-kicker">Safety</p><h2>Backup & reset</h2><p>Your data lives in this browser. Export a backup regularly during the live trial.</p></div></div>
            <div className="data-actions">
              <article><span className="data-icon">↓</span><div><h3>Export planner backup</h3><p>Downloads subjects, cohorts, units, lessons, progress, timetable and notes as JSON.</p><button className="secondary-button" type="button" onClick={() => downloadBackup(planner)}>Export JSON</button></div></article>
              <article><span className="data-icon">↑</span><div><h3>Import planner backup</h3><p>Validates v0.5 and compatible v0.2–v0.4.2 backups before asking to replace current local data.</p><button className="secondary-button" type="button" onClick={() => importRef.current?.click()}>Choose JSON file</button><input className="visually-hidden" ref={importRef} type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} /></div></article>
            </div>
            <section className="reconciliation-tool" aria-labelledby="reconciliation-title">
              <div className="reconciliation-heading"><div><span>One-time migration tool</span><h3 id="reconciliation-title">Reconcile previous teaching</h3><p>Keep today’s known-correct class positions, then reconstruct an earlier teaching week as history without advancing any class again.</p></div>{planner.reconciliationStatus && <strong>Teaching history reconciled through {planner.reconciliationStatus.throughDate}</strong>}</div>
              <div className="reconciliation-controls">
                <label><span>Start date</span><input type="date" max={localDateKey(new Date())} value={reconciliationRange.startDate} onChange={(event) => setReconciliationRange({ ...reconciliationRange, startDate: event.target.value })} /></label>
                <label><span>End date</span><input type="date" max={localDateKey(new Date())} value={reconciliationRange.endDate} onChange={(event) => setReconciliationRange({ ...reconciliationRange, endDate: event.target.value })} /></label>
                <button className="secondary-button" type="button" onClick={() => downloadBackup(planner)}>Export backup first</button>
                <button className="primary-button" type="button" disabled={!reconciliationPreview.length} onClick={runReconciliation}>Mark all as taught as planned</button>
              </div>
              <p className="reconciliation-note">{reconciliationPreview.length} scheduled Specialist Teaching {reconciliationPreview.length === 1 ? "session" : "sessions"} in this range. Existing Partial or Not taught exceptions are preserved.</p>
              {!!reconciliationPreview.length && <div className="reconciliation-list">{reconciliationPreview.map(({ date, timetableSession }) => {
                const item = planner.classes.find((candidate) => candidate.id === timetableSession.classId);
                const session = planner.teachingSessions.find((candidate) => candidate.date === date && candidate.timetableSessionId === timetableSession.id);
                return <article key={`${date}-${timetableSession.id}`}>
                  <div><span>{date} · {timetableSession.startTime}–{timetableSession.endTime}</span><strong>{item?.name ?? "Missing class"}</strong>{session && <small>{session.plannedUnitTitle} · {session.plannedLessonTitle}</small>}</div>
                  <span className={`reconciliation-outcome outcome-${session?.outcome ?? "planned"}`}>{outcomeLabels[session?.outcome ?? "planned"]}</span>
                  {session && <div className="reconciliation-actions"><button type="button" onClick={() => changeHistoricalOutcome(session.id, "completed")}>Completed</button><button type="button" onClick={() => changeHistoricalOutcome(session.id, "partial")}>Partial</button><button type="button" onClick={() => changeHistoricalOutcome(session.id, "not-taught")}>Not taught</button></div>}
                  {(session?.reason || session?.note) && <p>{session.reason ?? session.note}</p>}
                </article>;
              })}</div>}
            </section>
            <div className="danger-zone"><div><h3>Start over</h3><p>These actions replace the complete planner. Export a backup first.</p></div><div>
              <button className="secondary-button" type="button" onClick={() => window.confirm("Replace all current data with the Mandarin sample planner?") && onChange(freshSamplePlanner())}>Load sample data</button>
              <button className="danger-button" type="button" onClick={() => window.confirm("Reset to a blank planner? All current local data will be replaced.") && onChange(createBlankPlanner())}>Reset planner</button>
            </div></div>
          </>}
        </section>
      </div>
    </main>
  );
}
