import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("History can be browsed by multiple classes or all classes", async () => {
  const source = await readFile(new URL("../app/dashboard-app.tsx", import.meta.url), "utf8");

  assert.match(source, /const \[classFilters, setClassFilters\] = useState<string\[]>\(\[\]\)/);
  assert.match(source, /!classFilters\.length \|\| classFilters\.includes\(item\.classId\)/);
  assert.match(source, /toggleClassFilter/);
  assert.match(source, /checked=\{classFilters\.includes\(item\.id\)\}/);
  assert.match(source, /All classes/);
  assert.match(source, /Browse by class/);
  assert.match(source, /No teaching outcomes recorded for this class selection/);
});
