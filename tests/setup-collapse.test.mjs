import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("year level editors render as independently expandable panels that are closed by default", async () => {
  const source = await readFile(new URL("../app/setup-view.tsx", import.meta.url), "utf8");

  assert.match(source, /<details className="cohort-editor" key=\{level\.id\}>/);
  assert.match(source, /<summary className="cohort-editor-summary">/);
  assert.doesNotMatch(source, /<details[^>]*\sopen(?:=|\s|>)/);
});
