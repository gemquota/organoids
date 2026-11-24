import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";
const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

function seedHelium(biology) {
  const flavors=[["up","red"],["up","green"],["down","blue"],["up","red"],["down","green"],["down","blue"],["up","red"],["up","green"],["down","blue"],["up","red"],["down","green"],["down","blue"]];
  flavors.forEach(([flavor,colorCharge],i)=>biology.create("quark",{x:20+(i%3),y:20+Math.floor(i/3),flavor,colorCharge,baryonGroup:Math.floor(i/3),charge:flavor==="up"?2/3:-1/3,mass:1},.1));
  for(let i=0;i<8;i++)biology.create("gluon",{x:20+i%3,y:20+Math.floor(i/3),baryonGroup:Math.floor(i/2),colorCharge:["red","green","blue"][i%3],mass:.1},.01);
  for(let i=0;i<2;i++)biology.create("lepton",{x:20+i,y:20,leptonKind:"electron",charge:-1,mass:.0005},.05);
}

test("quark colour and flavour assemble protons and neutrons",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  seedHelium(biology);
  assert.equal(biology.formHadrons({radius:8}),4);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="proton").length,2);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="neutron").length,2);
  assert.ok([...runtime.store.entities.values()].filter(e=>e.type==="proton").every(e=>e.properties.charge===1));
  assert.ok([...runtime.store.entities.values()].filter(e=>e.type==="neutron").every(e=>e.properties.charge===0));
});

test("nucleons bind into nuclei, isotopes capture electrons and elements are classified",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  seedHelium(biology);
  const result=biology.assembleAtomicMatter({radius:10});
  assert.deepEqual(result,{hadrons:4,nuclei:1,isotopes:1,atoms:1,elements:1});
  const element=[...runtime.store.entities.values()].find(e=>e.type==="element");
  const atom=[...runtime.store.entities.values()].find(e=>e.type==="atom");
  const isotope=[...runtime.store.entities.values()].find(e=>e.type==="isotope");
  assert.equal(element.properties.symbol,"He");
  assert.equal(atom.properties.elementName,"Helium");
  assert.equal(atom.properties.atomicNumber,2);
  assert.equal(atom.properties.electronCount,2);
  assert.equal(isotope.properties.massNumber,4);
  assert.equal(runtime.store.neighbours(element.id,'classifies').includes(atom.id),true);assert.equal(atom.parent,null);
  assert.equal(biology.metrics.isotopes,1);
  assert.equal(biology.metrics.atoms,1);
  assert.equal(biology.metrics.elements,1);
});
