import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";
const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

test("complementary monomers form energy-costed bonds and polymerise into a sequence",()=>{
  const runtime=createRuntime({width:40,height:40,cols:8,rows:8}),biology=new EmergenceProgression(runtime,{seed:4});
  const monomers=["A","U","A","U"].map((monomerKind,i)=>biology.create("monomer",{monomerKind,x:10+i*.5,y:10,valence:2,heatCapacity:1,bondAffinity:1,mass:1},1));
  assert.equal(biology.formChemicalBonds({radius:5,rate:20,dt:1,energyCost:.01}),3);
  assert.equal(biology.polymerize({minLength:3,energyCost:.02}),1);
  const polymer=[...runtime.store.entities.values()].find(e=>e.type==="polymer");
  assert.equal(polymer.properties.length,4);
  assert.equal(polymer.properties.sequence.length,4);
  assert.equal(runtime.store.descendants(polymer.id).length,4);
  assert.ok(monomers.every(e=>e.parent===polymer.id));
  assert.equal(runtime.energy.audit(runtime.store,4).balanced,true);
});

test("lipid clusters self-assemble into closed membranes using their own components",()=>{
  const runtime=createRuntime({width:40,height:40,cols:8,rows:8}),biology=new EmergenceProgression(runtime);
  const lipids=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return biology.create("lipid",{x:20+Math.cos(a)*2,y:20+Math.sin(a)*2,headPolarity:1,tailHydrophobicity:1},.1)});
  assert.equal(biology.selfAssembleMembranes({radius:5,minLipids:8,permeability:.15}),1);
  const membrane=[...runtime.store.entities.values()].find(e=>e.type==="membrane");
  assert.ok(membrane);
  assert.equal(membrane.properties.closed,true);
  assert.equal(membrane.properties.lipidCount,8);
  assert.deepEqual(runtime.store.descendants(membrane.id).sort((a,b)=>a-b),lipids.map(e=>e.id).sort((a,b)=>a-b));
  assert.equal(runtime.store.activeLinks.filter(e=>e.type==="bond").length,8);
  assert.equal(biology.metrics.membranes,1);
});


test("bond activation cost is shared by both reactants in one conserved transaction",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const a=biology.create("atom",{x:20,y:20,atomicNumber:6,elementSymbol:"C",mass:12,valence:4,electronegativity:2.55},.001);
  const b=biology.create("atom",{x:23,y:20,atomicNumber:1,elementSymbol:"H",mass:1,valence:1,electronegativity:2.2},.1);
  const beforeA=a.energy,beforeB=b.energy;
  assert.equal(biology.formChemicalBonds({types:["atom"],radius:5,rate:100,dt:1,energyCost:.05,activationEnergy:0}),1);
  assert.ok(a.energy<beforeA);
  assert.ok(b.energy<beforeB);
  assert.ok(Math.abs((beforeA+beforeB)-(a.energy+b.energy)-.05)<1e-9);
  assert.equal(runtime.energy.audit(runtime.store,.101).balanced,true);
});

test("polymerisation can pay its activation cost from the combined monomer pool",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:31});
  const monomers=["A","U","A"].map((monomerKind,i)=>biology.create("monomer",{x:20+i*2,y:20,monomerKind,mass:1,valence:2},i===0?0:i===1?.03:.03));
  assert.equal(biology.formChemicalBonds({types:["monomer"],radius:3,rate:100,dt:1,energyCost:0,activationEnergy:0}),2);
  assert.equal(biology.polymerize({minLength:3,energyCost:.05}),1);
  const polymer=[...runtime.store.entities.values()].find(e=>e.type==="polymer");
  assert.ok(polymer);
  assert.ok(Math.abs(polymer.energy-.01)<1e-9);
  assert.equal(runtime.energy.audit(runtime.store,.06).balanced,true);
});
