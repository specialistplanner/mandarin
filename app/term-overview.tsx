"use client";

import { useMemo, useState, type ReactNode } from "react";
import { deriveTermOverviewDataset, formatTermDate, type TermOverviewCell } from "@/lib/academic-calendar";
import type { PlannerData } from "@/lib/domain";
import { buildTermOverviewWorkbook, termOverviewWorkbookFilename } from "@/lib/term-overview-export";

function TermCell({ cell }: { cell: TermOverviewCell }) {
  if (cell.kind === "blank") return <span className="term-cell-blank" aria-label="No reliable historical evidence" />;
  const difference = cell.differentClassCount === 1 ? "1 class different" : `${cell.differentClassCount} classes different`;
  return <div className={`term-cell-content term-cell-${cell.kind}`}>
    {cell.kind === "lesson" && <><strong>{cell.unitTitle}</strong><span>{cell.lessonNumber ? `L${cell.lessonNumber} · ` : ""}{cell.lessonTitle}</span></>}
    {cell.kind === "event" && <><small>School event</small><strong>{cell.eventTitle}</strong></>}
    {cell.kind === "split" && <><strong>Split teaching week</strong>{cell.alternatives?.map((item) => <span key={item.label}>{item.label}</span>)}</>}
    {cell.divergent && cell.differentClassCount > 0 && <em>{difference}</em>}
  </div>;
}

export function TermOverview({ planner, onOpenSettings, progressView }: { planner: PlannerData; onOpenSettings: () => void; progressView: ReactNode }) {
  const [section, setSection] = useState<"overview" | "progress">("overview");
  const sortedYears = useMemo(() => [...planner.schoolYears].sort((a, b) => b.startDate.localeCompare(a.startDate)), [planner.schoolYears]);
  const [schoolYearId, setSchoolYearId] = useState(() => sortedYears[0]?.id ?? "");
  const availableTerms = useMemo(() => planner.terms.filter((term) => term.schoolYearId === schoolYearId).sort((a, b) => a.sequence - b.sequence), [planner.terms, schoolYearId]);
  const [termId, setTermId] = useState(() => availableTerms[0]?.id ?? "");
  const selectedTermId = availableTerms.some((term) => term.id === termId) ? termId : availableTerms[0]?.id ?? "";
  const dataset = useMemo(() => deriveTermOverviewDataset(planner, selectedTermId), [planner, selectedTermId]);
  function exportExcel() {
    const workbook = buildTermOverviewWorkbook(dataset);
    const blob = new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = termOverviewWorkbookFilename(dataset);
    link.click();
    URL.revokeObjectURL(url);
  }
  const sectionTabs = <div className="term-workspace-tabs" role="tablist" aria-label="Term workspace">
    <button type="button" role="tab" aria-selected={section === "overview"} className={section === "overview" ? "active" : ""} onClick={() => setSection("overview")}>Term Overview</button>
    <button type="button" role="tab" aria-selected={section === "progress"} className={section === "progress" ? "active" : ""} onClick={() => setSection("progress")}>Progress</button>
  </div>;

  if (section === "progress") return <main className="term-overview-main" id="top">{sectionTabs}{progressView}</main>;

  if (!planner.schoolYears.length || !planner.terms.length) return <main className="term-overview-main" id="top">{sectionTabs}<section className="term-overview-empty"><p className="eyebrow">Term Overview</p><h1>Set your school calendar first.</h1><p>Add a School Year and Terms in Settings. Dates stay editable and are never filled from a hard-coded regional calendar.</p><button className="primary-button" type="button" onClick={onOpenSettings}>Open School Year &amp; Terms</button></section></main>;

  return <main className="term-overview-main" id="top">
    {sectionTabs}
    <section className="term-overview-hero"><div><p className="eyebrow">Term &amp; Curriculum Workspace</p><h1>Term Overview</h1><p>A historical curriculum map derived only from recorded teaching and known school events.</p></div><div className="term-overview-actions"><div className="term-overview-selectors"><label><span>School year</span><select value={schoolYearId} onChange={(event) => { setSchoolYearId(event.target.value); setTermId(""); }}>{sortedYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label><label><span>Term</span><select value={selectedTermId} onChange={(event) => setTermId(event.target.value)}>{availableTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label></div><button className="secondary-button term-export-button" type="button" disabled={!availableTerms.length} onClick={exportExcel}>Export Excel</button></div></section>
    {!availableTerms.length ? <section className="term-overview-empty"><h2>No Terms in this school year</h2><button className="primary-button" type="button" onClick={onOpenSettings}>Add a Term</button></section> : <div className="term-overview-scroll"><table className="term-matrix"><colgroup><col className="term-week-column" />{dataset.columns.map((column) => <col key={column.id} />)}</colgroup><thead><tr><th scope="col">Teaching week</th>{dataset.columns.map((column) => <th scope="col" key={column.id}>{column.label}</th>)}</tr></thead><tbody>{dataset.rows.map((row) => <tr key={row.startDate}><th scope="row"><strong>Week {row.weekNumber}</strong><small>{formatTermDate(row.startDate)} – {formatTermDate(row.endDate)}</small></th>{dataset.columns.map((column) => { const cell = row.cells.find((item) => item.yearLevelId === column.id)!; return <td className={cell.divergent ? "is-divergent" : ""} key={column.id}><TermCell cell={cell} /></td>; })}</tr>)}</tbody></table></div>}
  </main>;
}
