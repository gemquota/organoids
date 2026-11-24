import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const html = readFileSync(new URL("../hitchhikers-guide.html", import.meta.url), "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join("\n");

test("guide presents the encyclopedia as the default continuous page", () => {
  assert.match(html, /id="encyclopedia"/);
  assert.match(html, /id="emergence-map"/);
  assert.match(html, /id="scale-index"/);
  assert.match(script, /function renderGuide\(\)/);
  assert.match(script, /renderGuide\(\);/);
  assert.doesNotMatch(html, /data-view=/);
  assert.doesNotMatch(html, /nav\.modes/);
});

test("all entity information is rendered directly into each entry", () => {
  for (const field of ["d[3]", "d[4]", "d[5]", "d[6]", "d[7]", "d[8]"]) {
    assert.ok(script.includes(field), "entity card should render " + field);
  }
  assert.match(script, /data-entity-card/);
  assert.match(script, /Constituents \/ precursors/);
  assert.match(script, /Enables \/ contributes to/);
});

test("curated entities have unique IDs and valid references", () => {
  const block = script.match(/const D=\[([\s\S]*?)\n\];/);
  assert.ok(block, "entity data block must exist");
  const rows = block[1].split("\n").filter(line => line.startsWith("[")).map(line => JSON.parse(line.replace(/,$/, "")));
  assert.ok(rows.length >= 40);
  const ids = new Set(rows.map(row => row[0]));
  assert.equal(ids.size, rows.length);
  const chapterBlock = script.match(/const C=\[([\s\S]*?)\n\];/);
  assert.ok(chapterBlock, "chapter data block must exist");
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
