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
  assert.equal(ids.length,242);
  assert.equal(new Set(ids).size,ids.length);
  for(const entry of registry.entries){
    assert.ok(entry.name && entry.summary && entry.structure);
    assert.ok(entry.form);
    assert.ok(Array.isArray(entry.cap));
    assert.ok(Array.isArray(entry.next));
  }
});

test("every entity has its own dedicated SVG symbol",()=>{
  const sprite=readFileSync(new URL("../assets/atlas/entities.svg",import.meta.url),"utf8");
  const symbols=[...sprite.matchAll(/<symbol id="entity-([^"]+)"/g)].map(match=>match[1]);
  const ids=registry.entries.map(entry=>entry.id);
  assert.equal(symbols.length,ids.length);
  assert.equal(new Set(symbols).size,symbols.length);
  for(const id of ids) assert.ok(symbols.includes(id),`Missing dedicated SVG symbol for ${id}`);
  assert.ok(script.includes('specimenArt(e)'),"Selected entity must render its own specimen");
  assert.ok(script.includes('assets/atlas/entities.svg#entity-'),"Specimens must reference the SVG sprite");
  assert.ok(!script.includes("getContext("),"Atlas must not depend on canvas rendering");
});

test("every entry stores an explicit emergence level independent of semantic category",()=>{
  assert.ok(!script.includes("const stageLevels="),"Levels must not be derived from semantic categories");
  assert.ok(!script.includes("entry.level=stageLevels"),"Level assignment must be explicit on each entity");
  for(const entry of registry.entries) assert.ok(Number.isInteger(entry.level),entry.id+" must declare its own level");
  for(let level=0;level<=15;level++) assert.ok(registry.entries.some(entry=>entry.level===level),"Missing level "+level);
});
test("every entry has an emergence level and levels 0–12 are populated",()=>{
  for(const entry of registry.entries) assert.ok(Number.isInteger(entry.level)&&entry.level>=0&&entry.level<=15,entry.id+" has invalid level");
  for(let level=0;level<=15;level++) assert.ok(registry.entries.some(entry=>entry.level===level),"Missing level "+level);
  for(const [level,stage] of [[0,"Fields"],[1,"Particles"],[2,"Composite particles"],[3,"Atoms"],[4,"Molecules"],[12,"Biosphere"]]) assert.ok(registry.entries.some(entry=>entry.level===level&&entry.stage===stage));
  assert.ok(registry.entries.filter(entry=>entry.level===2).length>=15,"Level 2 should include a broad set of composite particles");
  assert.ok(registry.entries.filter(entry=>entry.level===3).length>=20,"Level 3 should include a broad set of atoms");
  assert.ok(registry.entries.filter(entry=>entry.level===4).length>=20,"Level 4 should contain a substantive set of complex molecules and proteins");
  assert.ok(registry.entries.filter(entry=>entry.level===5).length>=15,"Level 5 should include a substantive set of prebiotic building blocks");
  for(const id of ["dna-molecule","rna-molecule","polysaccharide","ribosome","hemoglobin","collagen","actin","tubulin","antibody","atp-synthase"]) assert.ok(registry.entries.some(entry=>entry.id===id&&entry.level===4),`Missing Level 4 form ${id}`);
  for(const id of ["water-molecule","amino-acid","short-peptide","ribozymic-rna","thioester","pyrophosphate"]) assert.ok(registry.entries.some(entry=>entry.id===id&&entry.level===5),`${id} should be a Level 5 prebiotic building block`);
  for(const id of ["planetary-biosphere","global-microbiome","ocean-biosphere","terrestrial-biosphere","biosphere-geosphere-coupling"]) assert.ok(registry.entries.some(entry=>entry.id===id&&entry.level===12),`Missing Level 12 form ${id}`);
});

test("level and semantic-category filters are independent",()=>{
  assert.ok(html.includes('id="level"')&&html.includes('id="stage"'));
  assert.ok(script.includes('(!stage||e.stage===stage)&&(!level||e.level===Number(level))'));
  assert.ok(script.includes('LEVELS[level].description'));
});

test("the atlas uses one taxonomy derived from entry categories",()=>{
  const categories=[...new Set(registry.entries.map(entry=>entry.stage))];
  assert.ok(categories.length>0);
  assert.ok(html.includes('id="stage"'));
  assert.ok(html.includes('stages=[...new Set(E.map(e=>e.stage))]'));
  assert.ok(html.includes("LEVELS"));
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

test("cosmic context levels 13–15 are populated with distinct planetary, stellar and galactic systems",()=>{
  const levels=registry.entries.reduce((map,entry)=>(map[entry.level]=(map[entry.level]||[]).concat(entry),map),{});
  assert.equal(levels[13].length,12);
  assert.equal(levels[14].length,15);
  assert.equal(levels[15].length,15);
  for(const [level,stage] of [[13,"Planetary systems"],[14,"Stellar systems"],[15,"Galactic systems"]]){
    assert.ok(levels[level].every(entry=>entry.stage===stage));
  }
  for(const id of ["coupled-earth-system","planetary-energy-balance","planetary-system","protoplanetary-disk","habitable-zone-system","molecular-cloud-complex","interstellar-medium","galaxy"]){
    assert.ok(registry.entries.some(entry=>entry.id===id),`Missing cosmic context entity ${id}`);
  }
});
test("cosmic context entities have dedicated SVG symbols and descriptive system properties",()=>{
  const sprite=readFileSync(new URL("../assets/atlas/entities.svg",import.meta.url),"utf8");
  for(const entry of registry.entries.filter(entry=>entry.level>=13)){
    assert.ok(sprite.includes(`<symbol id="entity-${entry.id}"`),`Missing SVG symbol for ${entry.id}`);
    assert.ok(entry.summary.length>40 && entry.structure.length>20);
    assert.ok(entry.cap.length>=3);
  }
});
