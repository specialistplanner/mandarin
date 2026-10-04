"use client";

import { useState } from "react";
import {
  addLessonRecord,
  createUnitRecord,
  deleteLessonRecord,
  deleteUnitRecord,
  reorderLessonRecord,
  setUnitYearLevels,
  unitYearLevelIds,
  updateLessonMetadata,
  updateLessonRecord,
  updateUnitDetails,
  updateUnitMetadata,
  type Lesson,
  type PlannerData,
  type ResourceLink,
  type Unit,
} from "@/lib/domain";
import { buildProgramUnitLibraryColumns } from "@/lib/program-unit-library";
import { ResourceLinkAction } from "./resource-link";
import type { UnitLibraryState } from "./use-unit-library";

function makeId(prefix: "unit" | "lesson" | "resource") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cleanResources(resources: ResourceLink[]): ResourceLink[] | undefined {
  const populated = resources.filter((resource) => resource.label.trim() || resource.url.trim());
  for (const resource of populated) {
    if (!resource.label.trim()) throw new Error("Every resource needs a label.");
    if (!/^https:\/\//i.test(resource.url.trim())) throw new Error("Resource URLs must use HTTPS.");
  }
  return populated.length ? populated.map((resource) => ({ ...resource, label: resource.label.trim(), url: resource.url.trim() })) : undefined;
}

function ResourceFields({ value, onChange, label }: { value: ResourceLink[]; onChange: (value: ResourceLink[]) => void; label: string }) {
  return <fieldset className="program-resource-fields">
    <legend>{label}</legend>
    {value.map((resource, index) => <div className="program-resource-row" key={resource.id}>
      <input aria-label={`${label} ${index + 1} label`} value={resource.label} placeholder="Resource label" onChange={(event) => onChange(value.map((item) => item.id === resource.id ? { ...item, label: event.target.value } : item))} />
      <input aria-label={`${label} ${index + 1} URL`} type="url" value={resource.url} placeholder="https://…" onChange={(event) => onChange(value.map((item) => item.id === resource.id ? { ...item, url: event.target.value } : item))} />
      <button className="icon-button danger" type="button" onClick={() => onChange(value.filter((item) => item.id !== resource.id))} aria-label={`Remove ${resource.label || "resource"}`}>×</button>
    </div>)}
    <button className="text-button" type="button" onClick={() => onChange([...value, { id: makeId("resource"), label: "", url: "" }])}>＋ Add resource</button>
  </fieldset>;
}

function LessonEditor({ planner, unit, lesson, index, onChange, onMessage, library }: {
  planner: PlannerData;
  unit: Unit;
  lesson: Lesson;
  index: number;
  onChange: (planner: PlannerData) => void;
  onMessage: (message: string) => void;
  library: UnitLibraryState;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? "");
  const [teacherNotes, setTeacherNotes] = useState(lesson.teacherNotes ?? "");
  const [codes, setCodes] = useState(lesson.curriculumMetadata?.codes?.join(", ") ?? "");
  const [resources, setResources] = useState<ResourceLink[]>(lesson.resources?.map((resource) => ({ ...resource })) ?? []);

  function save() {
    try {
      let next = updateLessonRecord(planner, unit.id, lesson.id, title, description);
      next = updateLessonMetadata(next, unit.id, lesson.id, {
        teacherNotes: teacherNotes.trim() || undefined,
        resources: cleanResources(resources),
        curriculumMetadata: {
          ...lesson.curriculumMetadata,
          codes: codes.split(",").map((code) => code.trim()).filter(Boolean),
        },
        vocabularySetId: lesson.vocabularySetId,
      });
      onChange(next);
      onMessage(`Saved Lesson ${index + 1}.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "That Lesson could not be saved.");
    }
  }

  function remove() {
    if (!window.confirm(`Remove “${lesson.title}”? This is blocked whenever Progress or History references the Lesson.`)) return;
    try {
      onChange(deleteLessonRecord(planner, unit.id, lesson.id));
      onMessage("Lesson removed.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "That Lesson cannot be removed.");
    }
  }

  return <li className="program-lesson-editor">
    <div className="program-lesson-heading">
      <span className="lesson-number">{index + 1}</span>
      <div><strong>{lesson.title}</strong><small>Stable Lesson ID · {lesson.id}</small></div>
      <div className="reorder-buttons">
        <button type="button" disabled={index === 0} onClick={() => onChange(reorderLessonRecord(planner, unit.id, lesson.id, -1))} aria-label={`Move ${lesson.title} up`}>↑</button>
        <button type="button" disabled={index === unit.lessons.length - 1} onClick={() => onChange(reorderLessonRecord(planner, unit.id, lesson.id, 1))} aria-label={`Move ${lesson.title} down`}>↓</button>
      </div>
    </div>
    <div className="program-editor-fields two-column">
      <label><span>Lesson title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label><span>Learning intention / description <i>optional</i></span><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label><span>Teacher notes <i>optional</i></span><textarea rows={2} value={teacherNotes} onChange={(event) => setTeacherNotes(event.target.value)} /></label>
      <label><span>Curriculum codes <i>comma separated</i></span><input value={codes} onChange={(event) => setCodes(event.target.value)} /></label>
    </div>
    <ResourceFields label="Lesson resources" value={resources} onChange={setResources} />
    {lesson.externalResourceRef && <div className="program-provenance-note"><span>Linked classroom resource</span><code>{lesson.externalResourceRef.provider} · {lesson.externalResourceRef.resourceId}</code><ResourceLinkAction reference={lesson.externalResourceRef} library={library} label="Open linked resource" /></div>}
    <div className="program-editor-actions"><button className="primary-button" type="button" onClick={save}>Save Lesson</button><button className="text-button danger" type="button" onClick={remove}>Remove Lesson</button></div>
  </li>;
}

function ProgramUnitEditor({ planner, unit, library, onChange, onClose }: {
  planner: PlannerData;
  unit: Unit;
  library: UnitLibraryState;
  onChange: (planner: PlannerData) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(unit.title);
  const [secondaryTitle, setSecondaryTitle] = useState(unit.secondaryTitle ?? "");
  const [description, setDescription] = useState(unit.description ?? "");
  const [teacherNotes, setTeacherNotes] = useState(unit.teacherNotes ?? "");
  const [framework, setFramework] = useState(unit.curriculumMetadata?.framework ?? "");
  const [codes, setCodes] = useState(unit.curriculumMetadata?.codes?.join(", ") ?? "");
  const [curriculumNotes, setCurriculumNotes] = useState(unit.curriculumMetadata?.notes ?? "");
  const [resources, setResources] = useState<ResourceLink[]>(unit.resources?.map((resource) => ({ ...resource })) ?? []);
  const [selectedYearLevels, setSelectedYearLevels] = useState(unitYearLevelIds(unit));
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [message, setMessage] = useState("");

  function saveUnit() {
    try {
      let next = updateUnitDetails(planner, unit.id, title, description);
      next = updateUnitMetadata(next, unit.id, {
        secondaryTitle: secondaryTitle.trim() || undefined,
        teacherNotes: teacherNotes.trim() || undefined,
        resources: cleanResources(resources),
        curriculumMetadata: {
          framework: framework.trim() || undefined,
          codes: codes.split(",").map((code) => code.trim()).filter(Boolean),
          notes: curriculumNotes.trim() || undefined,
        },
      });
      if (JSON.stringify(selectedYearLevels) !== JSON.stringify(unitYearLevelIds(unit))) next = setUnitYearLevels(next, unit.id, selectedYearLevels);
      onChange(next);
      setMessage("Unit saved. Weekly View, Settings and Progress now use this value.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That Unit could not be saved.");
    }
  }

  function addLesson() {
    if (!newLessonTitle.trim()) return setMessage("Enter a Lesson title first.");
    try {
      onChange(addLessonRecord(planner, unit.id, { id: makeId("lesson"), title: newLessonTitle.trim(), sequence: unit.lessons.length + 1 }));
      setNewLessonTitle("");
      setMessage("Lesson added without changing class progress.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That Lesson could not be added.");
    }
  }

  function removeUnit() {
    if (!window.confirm(`Remove “${unit.title}”? This is blocked whenever Classes, Progress or History reference the Unit.`)) return;
    try {
      onChange(deleteUnitRecord(planner, unit.id));
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That Unit cannot be removed.");
    }
  }

  return <div className="program-unit-editor-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <aside className="program-unit-editor" role="dialog" aria-modal="true" aria-labelledby="program-unit-editor-title">
      <header><div><p className="eyebrow">Program-owned Unit</p><h2 id="program-unit-editor-title">{unit.title}</h2><small>Stable Unit ID · {unit.id}</small></div><button className="close-button" type="button" onClick={onClose} aria-label="Close Unit editor">×</button></header>
      {message && <div className="setup-message" role="status">{message}<button type="button" onClick={() => setMessage("")}>×</button></div>}
      <section className="program-unit-editor-section">
        <div className="program-editor-fields two-column">
          <label><span>Unit title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label><span>Secondary title <i>optional; e.g. Chinese title</i></span><input value={secondaryTitle} onChange={(event) => setSecondaryTitle(event.target.value)} /></label>
          <label><span>Short description <i>optional</i></span><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label><span>Curriculum framework <i>optional</i></span><input value={framework} onChange={(event) => setFramework(event.target.value)} /></label>
          <label><span>Teacher notes <i>optional</i></span><textarea rows={2} value={teacherNotes} onChange={(event) => setTeacherNotes(event.target.value)} /></label>
          <label><span>Curriculum notes <i>optional</i></span><textarea rows={2} value={curriculumNotes} onChange={(event) => setCurriculumNotes(event.target.value)} /></label>
          <label className="wide-field"><span>Curriculum codes <i>comma separated</i></span><input value={codes} onChange={(event) => setCodes(event.target.value)} /></label>
        </div>
        <fieldset className="program-year-level-fields"><legend>Year levels</legend>{planner.yearLevels.map((level) => <label key={level.id}><input type="checkbox" checked={selectedYearLevels.includes(level.id)} disabled={selectedYearLevels.length === 1 && selectedYearLevels.includes(level.id)} onChange={(event) => setSelectedYearLevels(event.target.checked ? [...selectedYearLevels, level.id] : selectedYearLevels.filter((id) => id !== level.id))} /><span>{level.label}</span></label>)}</fieldset>
        <ResourceFields label="Unit resources" value={resources} onChange={setResources} />
        {unit.externalResourceRef && <div className="program-provenance-note"><span>Historical external provenance</span><code>{unit.externalResourceRef.provider} · {unit.externalResourceRef.resourceId}</code><ResourceLinkAction reference={unit.externalResourceRef} library={library} label="Open linked classroom resource" /></div>}
        <div className="program-editor-actions"><button className="primary-button" type="button" onClick={saveUnit}>Save Unit</button><button className="text-button danger" type="button" onClick={removeUnit}>Remove Unit</button></div>
      </section>
      <section className="program-unit-editor-section lesson-sequence-section">
        <div className="lesson-editor-title"><div><span>Lesson sequence</span><strong>{unit.lessons.length} {unit.lessons.length === 1 ? "Lesson" : "Lessons"}</strong></div><small>Reordering keeps stable IDs and historical snapshots unchanged.</small></div>
        <ol className="program-lesson-list">{unit.lessons.map((lesson, index) => <LessonEditor key={lesson.id} planner={planner} unit={unit} lesson={lesson} index={index} onChange={onChange} onMessage={setMessage} library={library} />)}</ol>
        <div className="program-add-lesson"><input value={newLessonTitle} placeholder="New Lesson title" onChange={(event) => setNewLessonTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addLesson()} /><button className="secondary-button" type="button" onClick={addLesson}>Add Lesson</button></div>
      </section>
    </aside>
  </div>;
}

export function ProgramUnitLibrary({ planner, onChange, library }: { planner: PlannerData; onChange: (planner: PlannerData) => void; library: UnitLibraryState }) {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSecondaryTitle, setNewSecondaryTitle] = useState("");
  const [newYearLevelId, setNewYearLevelId] = useState(planner.yearLevels[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const columns = buildProgramUnitLibraryColumns(planner);
  const selectedUnit = selectedUnitId ? planner.units.find((unit) => unit.id === selectedUnitId) : undefined;

  function createUnit() {
    if (!newTitle.trim() || !newYearLevelId) return setMessage("Choose a year level and enter a Unit title.");
    try {
      const id = makeId("unit");
      const next = createUnitRecord(planner, {
        id,
        yearLevelId: newYearLevelId,
        yearLevelIds: [newYearLevelId],
        title: newTitle.trim(),
        secondaryTitle: newSecondaryTitle.trim() || undefined,
        lessons: [{ id: makeId("lesson"), title: "First lesson", sequence: 1 }],
      }, false);
      onChange(next);
      setCreating(false);
      setNewTitle("");
      setNewSecondaryTitle("");
      setSelectedUnitId(id);
      setMessage("Unit created without changing cohort or class progress.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That Unit could not be created.");
    }
  }

  return <main className="program-library-main">
    <section className="program-library-heading"><div><p className="eyebrow">Program-owned curriculum</p><h1>Unit Library</h1><p>Seven year levels, one authoritative Program. Select a card to edit its stable Unit and Lesson records.</p></div><button className="primary-button" type="button" onClick={() => setCreating(true)}>＋ New Unit</button></section>
    {message && <div className="setup-message program-library-message" role="status">{message}<button type="button" onClick={() => setMessage("")}>×</button></div>}
    <section className="program-library-grid" aria-label="Program Unit Library by year level">
      {columns.map(({ yearLevel, units }) => <section className="program-library-column" key={yearLevel.id} aria-labelledby={`program-library-${yearLevel.id}`}>
        <header><span className="year-badge">{yearLevel.shortLabel}</span><div><h2 id={`program-library-${yearLevel.id}`}>{yearLevel.label}</h2><small>{units.length} {units.length === 1 ? "Unit" : "Units"}</small></div></header>
        <div className="program-library-column-list">
          {units.map((unit) => <button className="program-library-card" type="button" key={unit.id} onClick={() => setSelectedUnitId(unit.id)} aria-label={`Edit ${unit.title}`}>
            <span className="program-library-card-title">{unit.title}</span>
            {unit.secondaryTitle && <span className="program-library-card-secondary" lang="zh-Hans">{unit.secondaryTitle}</span>}
            <span className="program-library-card-meta">{unit.lessons.length} {unit.lessons.length === 1 ? "Lesson" : "Lessons"}</span>
          </button>)}
          {!units.length && <p className="program-library-column-empty">No Units yet</p>}
        </div>
      </section>)}
    </section>
    {creating && <div className="modal-layer" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setCreating(false)}><section className="program-create-unit" role="dialog" aria-modal="true" aria-labelledby="create-unit-title"><div className="drawer-topline"><span>Program-owned curriculum</span><button className="close-button" type="button" onClick={() => setCreating(false)} aria-label="Close new Unit form">×</button></div><h2 id="create-unit-title">Create a Unit</h2><label><span>Year level</span><select value={newYearLevelId} onChange={(event) => setNewYearLevelId(event.target.value)}>{planner.yearLevels.map((level) => <option value={level.id} key={level.id}>{level.label}</option>)}</select></label><label><span>Unit title</span><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /></label><label><span>Secondary title <i>optional</i></span><input value={newSecondaryTitle} onChange={(event) => setNewSecondaryTitle(event.target.value)} /></label><p>Creation does not set cohort progress. The Unit begins with one editable placeholder Lesson.</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-button" type="button" onClick={createUnit}>Create Unit</button></div></section></div>}
    {selectedUnit && <ProgramUnitEditor key={selectedUnit.id} planner={planner} unit={selectedUnit} library={library} onChange={onChange} onClose={() => setSelectedUnitId(null)} />}
  </main>;
}
