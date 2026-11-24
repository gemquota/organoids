import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const html = readFileSync(new URL("../hitchhikers-guide.html", import.meta.url), "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join("\n");

test("guide opens directly into the illustrated entity browser and map", () => {
  assert.match(html, /id="encyclopedia"/);
  assert.match(html, /id="emergence-map"/);
  assert.match(html, /id="diagrams"/);
  assert.match(html, /id="progression-diagram"/);
  assert.match(html, /id="origins-diagram"/);
  assert.match(html, /id="scale-diagram"/);
  assert.match(html, /id="chapter-nav"/);
  assert.match(script, /function renderGuide\(\)/);
  assert.match(script, /function renderDiagrams\(\)/);
  assert.match(script, /function renderMap\(\)/);
  assert.match(html, /Detailed node map/);
  assert.match(script, /renderGuide\(\);/);
  assert.doesNotMatch(html, /scale-index|data-view=|nav\.modes|Start with the things themselves/);
});

test("entity descriptions, mechanisms, evidence, scales and relationships remain visible", () => {
  for (const field of ["d[3]", "d[4]", "d[5]", "d[6]", "d[7]", "d[8]"]) {
    assert.ok(script.includes(field), "entity card should render " + field);
  }
  assert.match(script, /data-entity-card/);
  assert.match(script, /relation-label/);
  assert.match(script, /links\(d\[8\]/);
  assert.match(script, /links\(next/);
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

test("entries use atlas illustrations and consistent category colours", () => {
  assert.match(html, /assets\/atlas\/entities\.svg#entity-/);
  assert.match(html, /const PALETTE=/);
  assert.match(script, /function colorFor\(/);
  assert.match(script, /colorFor\(d\[2\]\)/);
  assert.match(html, /id="map-legend"/);
  assert.match(script, /data-category=/);
});

test("entity map uses a layered rectangular layout with larger labelled nodes", () => {
  assert.match(script, /const colW=260,nodeW=218,nodeH=62/);
  assert.match(script, /<rect x=/);
  assert.match(script, /nodeW=218,nodeH=62/);
  assert.match(script, /map-arrow/);
  assert.match(script, /diagram-edge/);
  assert.match(script, /setAttribute\("viewBox"/);
  assert.doesNotMatch(script, /const angle=-Math\.PI\/2\+i\*2\*Math\.PI\/C\.length/);
});
