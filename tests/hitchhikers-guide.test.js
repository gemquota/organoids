import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const html = readFileSync(new URL("../hitchhikers-guide.html", import.meta.url), "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join("\n");
test("guide exposes all four views", () => {
  for (const view of ["field", "map", "hierarchy", "explorer"]) {
    assert.match(html, new RegExp('id="' + view + '"'));
    assert.match(html, new RegExp('data-view="' + view + '"'));
  }
});
test("curated entities have unique IDs and valid references", () => {
  const block = script.match(/const D=\[([\s\S]*?)\n\];/);
  assert.ok(block);
  const rows = block[1].split("\n").filter(line => line.startsWith("[")).map(line => JSON.parse(line.replace(/,$/, "")));
  assert.ok(rows.length >= 40);
  const ids = new Set(rows.map(row => row[0]));
  assert.equal(ids.size, rows.length);
  const chapterBlock = script.match(/const C=\[([\s\S]*?)\n\];/);
  assert.ok(chapterBlock);
  const chapters = chapterBlock[1].split("\n").filter(line => line.startsWith("[")).map(line => JSON.parse(line.replace(/,$/, "")));
  assert.ok(chapters.length >= 10);
  const chapterIds = new Set(chapters.map(row => row[0]));
  for (const row of rows) {
    assert.ok(chapterIds.has(row[2]), row[0] + " has unknown chapter");
    for (const parent of row[8]) assert.ok(ids.has(parent), row[0] + " has missing precursor " + parent);
  }
});
test("guide inline JavaScript parses", () => {
  const result = spawnSync(process.execPath, ["--check", "--input-type=module"], {input: script, encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
