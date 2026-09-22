import { strToU8, zipSync } from "fflate";
import { formatTermDate, termOverviewCellText, type TermOverviewDataset } from "./academic-calendar.ts";

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function inlineCell(reference: string, value: string, style = 0): string {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function worksheet(dataset: TermOverviewDataset): string {
  const columnCount = 2 + dataset.columns.length;
  const lastColumn = columnName(columnCount - 1);
  const title = `Specialist Planner — ${dataset.schoolYearLabel} — ${dataset.termName}`;
  const header = ["Teaching Week", "Dates", ...dataset.columns.map((column) => column.label)];
  const rows = dataset.rows.map((row, rowIndex) => {
    const values = [
      `Week ${row.weekNumber}`,
      `${formatTermDate(row.startDate)} – ${formatTermDate(row.endDate)}`,
      ...dataset.columns.map((column) => termOverviewCellText(row.cells.find((cell) => cell.yearLevelId === column.id) ?? {
        yearLevelId: column.id,
        weekNumber: row.weekNumber,
        kind: "blank",
        divergent: false,
        differentClassCount: 0,
        evidenceClassCount: 0,
        scheduledClassCount: 0,
      })),
    ];
    const sheetRow = rowIndex + 5;
    return `<row r="${sheetRow}" ht="44" customHeight="1">${values.map((value, index) => inlineCell(`${columnName(index)}${sheetRow}`, value, index < 2 ? 3 : 4)).join("")}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="${columnCount}" width="24" customWidth="1"/></cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">${inlineCell("A1", title, 1)}</row>
    <row r="2" ht="20" customHeight="1">${inlineCell("A2", "Historical teaching overview — derived from recorded teaching evidence", 2)}</row>
    <row r="4" ht="30" customHeight="1">${header.map((value, index) => inlineCell(`${columnName(index)}4`, value, 2)).join("")}</row>
    ${rows}
  </sheetData>
  <mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>
  <autoFilter ref="A4:${lastColumn}${Math.max(4, dataset.rows.length + 4)}"/>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

export function buildTermOverviewWorkbook(dataset: TermOverviewDataset): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView/></bookViews><sheets><sheet name="Term Overview" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="0"/></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="16"/><color rgb="FF17372C"/><name val="Aptos Display"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174B3A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFDED8CA"/></left><right style="thin"><color rgb="FFDED8CA"/></right><top style="thin"><color rgb="FFDED8CA"/></top><bottom style="thin"><color rgb="FFDED8CA"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
    "xl/worksheets/sheet1.xml": strToU8(worksheet(dataset)),
  };
  return zipSync(files, { level: 6 });
}

export function termOverviewWorkbookFilename(dataset: TermOverviewDataset): string {
  const safe = `${dataset.schoolYearLabel}-${dataset.termName}`.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `specialist-planner-${safe || "term-overview"}.xlsx`;
}
