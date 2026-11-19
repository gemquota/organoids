import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const html=readFileSync(new URL("../emergent-life-atlas.html",import.meta.url),"utf8");
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,"Atlas must contain its application script");

const registrySource=script.slice(0,script.indexOf("const $=id=>"));
const registry=vm.runInNewContext(`${registrySource};({entries:E})`);

test("atlas application script parses",()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
});

test("atlas registry has unique, populated entries",()=>{
  const ids=registry.entries.map(entry=>entry.id);
  assert.equal(ids.length,50);
  assert.equal(new Set(ids).size,ids.length);
  for(const entry of registry.entries){
    assert.ok(entry.name && entry.summary && entry.structure);
    assert.ok(entry.form);
    assert.ok(Array.isArray(entry.cap));
    assert.ok(Array.isArray(entry.next));
  }
});

test("every registered morphology has an SVG renderer path",()=>{
  const renderer=script.slice(script.indexOf("function specimenArt(form)"),script.indexOf("function select(id)"));
  const forms=[...new Set(registry.entries.map(entry=>entry.form))];
  for(const form of forms) assert.ok(renderer.includes('"'+form+'"'),`Missing SVG renderer coverage for ${form}`);
  assert.ok(renderer.includes("else{s=circle"),"Unknown forms must have a visible fallback illustration");
  assert.ok(!script.includes("getContext("),"Atlas must not depend on canvas rendering");
});

test("the atlas uses one taxonomy derived from entry categories",()=>{
  const categories=[...new Set(registry.entries.map(entry=>entry.stage))];
  assert.ok(categories.length>0);
  assert.ok(html.includes('id="stage"'));
  assert.ok(html.includes('stages=[...new Set(E.map(e=>e.stage))]'));
  assert.ok(!html.includes("LEVELS"));
  assert.ok(!html.includes("levelgrid"));
});

test("the atlas exposes one entity selector and a visible result count",()=>{
  assert.equal((html.match(/<nav id="nav"/g)||[]).length,1);
  assert.ok(html.includes('id="list-count"'));
  assert.ok(!html.includes('id="cards"'));
  assert.ok(!html.includes('class="cards"'));
  assert.ok(script.includes('document.querySelectorAll("#nav [data-id]")'));
});

test("unregistered transition targets are identified as future forms",()=>{
  assert.ok(script.includes("not yet in this catalogue"));
  assert.ok(script.includes("const unknown=e.next.filter"));
});

test("batch one adds distinct cellular and tissue organisations",()=>{
  const ids=new Set(registry.entries.map(entry=>entry.id));
  for(const id of ["prokaryotic-cell","eukaryotic-cell","endosymbiotic-cell","differentiated-colony","epithelial-tissue"]) assert.ok(ids.has(id),`Missing ${id}`);
  const forms=new Set(registry.entries.map(entry=>entry.form));
  for(const form of ["prokaryote","eukaryote","endosymbiont","differentiated-colony","epithelium"]) assert.ok(forms.has(form),`Missing morphology ${form}`);
});

test("batch two adds multicellular development and specialised tissue forms",()=>{
  const ids=new Set(registry.entries.map(entry=>entry.id));
  for(const id of ["multicellular-slug","fruiting-body","branched-colony","contractile-tissue","vascular-tissue"]) assert.ok(ids.has(id),`Missing ${id}`);
  const forms=new Set(registry.entries.map(entry=>entry.form));
  for(const form of ["slug","fruiting-body","branched-colony","contractile-tissue","vascular-tissue"]) assert.ok(forms.has(form),`Missing morphology ${form}`);
});

test("batch three adds developmental transition forms",()=>{
  const ids=new Set(registry.entries.map(entry=>entry.id));
  for(const id of ["aggregating-population","motile-cell-sheet","pseudotissue","tubular-tissue","budding-organism"]) assert.ok(ids.has(id),`Missing ${id}`);
  const forms=new Set(registry.entries.map(entry=>entry.form));
  for(const form of ["aggregating-population","motile-sheet","pseudotissue","tubular-tissue","budding-organism"]) assert.ok(forms.has(form),`Missing morphology ${form}`);
});

test("batch four adds integrated organism systems",()=>{
  const ids=new Set(registry.entries.map(entry=>entry.id));
  for(const id of ["sensory-network","digestive-system","neural-network","reproductive-system","integrated-organism"]) assert.ok(ids.has(id),`Missing ${id}`);
  const forms=new Set(registry.entries.map(entry=>entry.form));
  for(const form of ["sensory-network","digestive-system","neural-network","reproductive-system","integrated-organism"]) assert.ok(forms.has(form),`Missing morphology ${form}`);
});


test("batch five adds ecological organisation forms",()=>{
  const ids=new Set(registry.entries.map(entry=>entry.id));
  for(const id of ["reproductive-population","symbiotic-consortium","microbial-mat","biofilm","trophic-network"]) assert.ok(ids.has(id),`Missing ${id}`);
  const forms=new Set(registry.entries.map(entry=>entry.form));
  for(const form of ["breeding-population","symbiotic-consortium","microbial-mat","biofilm","trophic-network"]) assert.ok(forms.has(form),`Missing morphology ${form}`);
});


test("batch six adds spatial ecology and habitat structures",()=>{
  const ids=new Set(registry.entries.map(entry=>entry.id));
  for(const id of ["habitat-patch","metapopulation","migration-corridor","successional-community","disturbance-mosaic"]) assert.ok(ids.has(id),`Missing ${id}`);
  const forms=new Set(registry.entries.map(entry=>entry.form));
  for(const form of ["habitat-patch","metapopulation","migration-corridor","successional-community","disturbance-mosaic"]) assert.ok(forms.has(form),`Missing morphology ${form}`);
});
