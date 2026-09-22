"use client";

import { useState } from "react";
import { UNIT_LIBRARY_BASE_URL, type UnitLibraryUnit } from "@/lib/unit-library";
import type { UnitLibraryState } from "./use-unit-library";

type YearFilter = "all" | number;

const YEAR_FILTERS: YearFilter[] = ["all", 0, 1, 2, 3, 4, 5, 6];

// The public index is the authority for Units, year levels, lesson counts and links.
// These labels are presentation-only fallbacks until the index publishes chineseTitle.
const CHINESE_TITLE_FALLBACKS: Record<string, string> = {
  "prep-numbers": "数字 0–10 I",
  "year-1-body-parts": "身体部位",
  "year-1-numbers-0-10-ii": "数字 0–10 II",
  "year-2-family": "家庭",
  "year-3-fruit": "水果",
  "year-4-australia-states-and-territories": "澳大利亚各州和直辖区",
  "year4-australian-states-territories": "澳大利亚各州和直辖区",
  "year-5-countries": "国家",
  "year-6-age": "年龄",
  "year-6-chinese-names": "中文名字",
};

function yearLabel(year: number) {
  return year === 0 ? "Prep" : `Year ${year}`;
}

function editUrl(unit: UnitLibraryUnit) {
  return `${UNIT_LIBRARY_BASE_URL}/edit.html?unit=${encodeURIComponent(unit.id)}`;
}

export function MandarinUnitLibrary({ library }: { library: UnitLibraryState }) {
  const [activeYear, setActiveYear] = useState<YearFilter>("all");
  const units = library.index?.units ?? [];
  const visibleUnits = activeYear === "all" ? units : units.filter((unit) => unit.yearLevel === activeYear);

  return <main className="mandarin-library-main">
    <section className="mandarin-library-heading">
      <div>
        <p className="eyebrow">Reusable teaching content</p>
        <h1>Unit Library</h1>
      </div>
      <a className="mandarin-library-new" href={`${UNIT_LIBRARY_BASE_URL}/edit.html`} target="_blank" rel="noopener noreferrer">+ New unit</a>
    </section>

    <nav className="mandarin-library-filters" aria-label="Filter units by year">
      {YEAR_FILTERS.map((year) => <button
        className={activeYear === year ? "active" : ""}
        key={year}
        type="button"
        aria-pressed={activeYear === year}
        onClick={() => setActiveYear(year)}
      >{year === "all" ? "All" : yearLabel(year)}</button>)}
    </nav>

    <p className="mandarin-library-status" role="status">
      {library.status === "loading"
        ? "Loading live Unit Library…"
        : library.status === "unavailable"
          ? "The Unit Library is temporarily unavailable."
          : `${visibleUnits.length} ${visibleUnits.length === 1 ? "unit" : "units"}`}
    </p>

    {library.status === "unavailable" ? <section className="mandarin-library-empty">
      <strong>Live Unit Library unavailable</strong>
      <p>Your Specialist Planner data is unchanged. Try again when the connection is restored.</p>
    </section> : <section className="mandarin-library-grid" aria-live="polite" aria-busy={library.status === "loading"}>
      {visibleUnits.map((unit) => {
        const chineseTitle = unit.chineseTitle || CHINESE_TITLE_FALLBACKS[unit.id];
        return <article className="mandarin-library-card" key={unit.id}>
          <p className="mandarin-library-year">{yearLabel(unit.yearLevel)}</p>
          <div>
            {chineseTitle && <p className="mandarin-library-chinese" lang="zh-Hans">{chineseTitle}</p>}
            <h2>{unit.title}</h2>
          </div>
          <p className="mandarin-library-lesson-count">{unit.lessons.length} {unit.lessons.length === 1 ? "Lesson" : "Lessons"}</p>
          <div className="mandarin-library-actions">
            <a className="secondary" href={editUrl(unit)} target="_blank" rel="noopener noreferrer">Edit</a>
            <a className="primary" href={unit.url} target="_blank" rel="noopener noreferrer">Open</a>
          </div>
        </article>;
      })}
      {library.status === "ready" && visibleUnits.length === 0 && <p className="mandarin-library-empty">No units for this year yet.</p>}
    </section>}

    {library.status === "ready" && <p className="mandarin-library-sync-note">
      {library.source === "live" ? "Live synced with The Mandarin Room" : "Showing the latest published snapshot"}
    </p>}
  </main>;
}
