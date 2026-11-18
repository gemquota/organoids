import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const html=readFileSync(new URL("../emergent-life-atlas.html",import.meta.url),"utf8");
const script=html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
assert.ok(script,"Atlas must contain its application script");

const registrySource=script.slice(0,script.indexOf("function renderLevels()"));
const registry=vm.runInNewContext(`${registrySource};({entries:E,levels:LEVELS})`);

test("atlas application script parses",()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
});

test("atlas registry has unique, populated entries",()=>{
  const ids=registry.entries.map(entry=>entry.id);
  assert.equal(ids.length,20);
  assert.equal(new Set(ids).size,ids.length);
  for(const entry of registry.entries){
    assert.ok(entry.name && entry.summary && entry.structure);
    assert.ok(entry.form);
    assert.ok(Array.isArray(entry.cap));
  }
});

test("every registered morphology has an SVG renderer path",()=>{
  const renderer=script.slice(script.indexOf("function specimenArt(form)"),script.indexOf("function renderLevels()"));
  const forms=[...new Set(registry.entries.map(entry=>entry.form))];
  for(const form of forms) assert.ok(renderer.includes('"'+form+'"'),`Missing SVG renderer coverage for ${form}`);
  assert.ok(renderer.includes("else{s=circle"),"Unknown forms must have a visible fallback illustration");
  assert.ok(!script.includes("getContext("),"Atlas must not depend on canvas rendering");
});

test("unregistered transition targets are identified as future forms",()=>{
  assert.ok(script.includes("not yet in this catalogue"));
  assert.ok(script.includes("const unknown=e.next.filter"));
});

test("both specimen navigation and cards are wired to selection",()=>{
  assert.ok(script.includes('document.querySelectorAll("#nav [data-id],#cards [data-id]")'));
  assert.ok(script.includes('addEventListener("click",()=>select(b.dataset.id))'));
});

test("emergence stack contains six ordered levels",()=>{
  assert.equal(registry.levels.length,6);
  assert.deepEqual(Array.from(registry.levels,level=>level.n),[0,1,2,3,4,5]);
});
