"use client";

import { useMemo, useState } from "react";
import { deriveTermOverview } from "@/lib/academic-calendar";
import type { PlannerData } from "@/lib/domain";

const outcomeLabel = {
  completed: "Completed",
  partial: "Partial",
  "not-taught": "Not taught",
  planned: "Planned",
  scheduled: "Scheduled",
  none: "—",
} as const;

export function TermOverview({ planner, onOpenSettings }: { planner: PlannerData; onOpenSettings: () => void }) {
  const sortedYears = useMemo(() => [...planner.schoolYears].sort((a, b) => b.startDate.localeCompare(a.startDate)), [planner.schoolYears]);
  const [schoolYearId, setSchoolYearId] = useState(() => sortedYears[0]?.id ?? "");
  const availableTerms = useMemo(() => planner.terms.filter((term) => term.schoolYearId === schoolYearId).sort((a, b) => a.sequence - b.sequence), [planner.terms, schoolYearId]);
  const [termId, setTermId] = useState(() => availableTerms[0]?.id ?? "");
  const selectedTermId = availableTerms.some((term) => term.id === termId) ? termId : availableTerms[0]?.id ?? "";
  const rows = useMemo(() => deriveTermOverview(planner, selectedTermId), [planner, selectedTermId]);

  if (!planner.schoolYears.length || !planner.terms.length) return <main className="term-overview-main" id="top"><section className="term-overview-empty"><p className="eyebrow">Term Overview</p><h1>Set your school calendar first.</h1><p>Add a School Year and Terms in Settings. Dates stay editable and are never filled from a hard-coded regional calendar.</p><button className="primary-button" type="button" onClick={onOpenSettings}>Open School Year &amp; Terms</button></section></main>;

  return <main className="term-overview-main" id="top">
    <section className="term-overview-hero"><div><p className="eyebrow">Term &amp; Curriculum Workspace</p><h1>Term Overview</h1><p>One view derived from the timetable, Unit Library, Teaching Sessions and current Progress.</p></div><div className="term-overview-selectors"><label><span>School year</span><select value={schoolYearId} onChange={(event) => { setSchoolYearId(event.target.value); setTermId(""); }}>{sortedYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label><label><span>Term</span><select value={selectedTermId} onChange={(event) => setTermId(event.target.value)}>{availableTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label></div></section>
    {!availableTerms.length ? <section className="term-overview-empty"><h2>No Terms in this school year</h2><button className="primary-button" type="button" onClick={onOpenSettings}>Add a Term</button></section> : <div className="term-overview-scroll"><table className="term-matrix"><thead><tr><th>Teaching week</th>{planner.yearLevels.map((level) => <th key={level.id}>{level.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.startDate}><th><strong>Week {row.weekNumber}</strong><small>{row.startDate.slice(5)} – {row.endDate.slice(5)}</small></th>{row.cells.map((cell) => <td className={cell.divergent ? "is-divergent" : ""} key={cell.yearLevelId}>{cell.items.length ? <div className="term-cell-items">{cell.divergent && <span className="term-divergence-label">Classes differ</span>}{cell.items.map((item) => <div className={`term-class-item outcome-${item.outcome}`} key={item.classId}><strong>{item.className}</strong><span>{item.unitTitle ?? "No Unit"}{item.lessonTitle ? ` · ${item.lessonTitle}` : ""}</span><small>{outcomeLabel[item.outcome]}</small></div>)}</div> : <span className="term-cell-empty">No classes</span>}</td>)}</tr>)}</tbody></table></div>}
  </main>;
}
