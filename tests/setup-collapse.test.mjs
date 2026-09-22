import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Settings class panels stay collapsed while the standalone Unit Library opens its content directly", async () => {
  const source = await readFile(new URL("../app/setup-view.tsx", import.meta.url), "utf8");

  assert.match(source, /<details className="cohort-editor" open=\{section === "library" \? true : undefined\} key=\{level\.id\}>/);
  assert.match(source, /<summary className="cohort-editor-summary">/);
  assert.match(source, /libraryOnly = initialSection === "library"/);
});
