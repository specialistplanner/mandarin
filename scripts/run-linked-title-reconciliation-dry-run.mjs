import { readFile, writeFile } from "node:fs/promises";
import { reconcileLinkedUnitTitles } from "../lib/linked-unit-title-reconciliation.ts";
import { importPlannerData } from "../lib/storage.ts";
import { parseUnitLibraryIndex, UNIT_LIBRARY_LIVE_INDEX_URL } from "../lib/unit-library.ts";

const backupPath = process.argv[2];
const outputPath = process.argv[3];
if (!backupPath) throw new Error("Usage: node scripts/run-linked-title-reconciliation-dry-run.mjs <official-planner-backup.json>");

const planner = importPlannerData(await readFile(backupPath, "utf8"));
const response = await fetch(UNIT_LIBRARY_LIVE_INDEX_URL, {
  headers: { Accept: "application/json" },
  cache: "no-store",
});
if (!response.ok) throw new Error(`Live Unit Library returned ${response.status}; dry-run aborted without classifying missing content.`);
const index = parseUnitLibraryIndex(await response.json());
const result = reconcileLinkedUnitTitles(planner, index, { mode: "dry-run", sourceAvailable: true });

const report = {
  backupPath,
  programId: planner.id,
  liveIndexGeneratedAt: index.generatedAt,
  source: UNIT_LIBRARY_LIVE_INDEX_URL,
  ...result.report,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
  await writeFile(outputPath, serialized, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ outputPath, linkedUnitCount: report.linkedUnitCount, liveIndexGeneratedAt: report.liveIndexGeneratedAt }, null, 2));
} else {
  console.log(serialized);
}
