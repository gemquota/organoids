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

test("unassigned startup quarks assemble from local colour and flavour matches",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const quarks=[
    ["up","red",20,20],["down","green",21,20],["up","blue",20,21],
    ["down","red",40,40],["up","green",41,40],["down","blue",40,41]
  ];
  for(const [flavor,colorCharge,x,y] of quarks)biology.create("quark",{x,y,flavor,colorCharge,charge:flavor==="up"?2/3:-1/3,mass:1},.1);
  assert.equal(biology.formHadrons({radius:5}),2);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="proton").length,1);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="neutron").length,1);
});

test("atomic valence limits bonds and produces a methane molecular structure",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  biology.create("atom",{x:20,y:20,atomicNumber:6,elementSymbol:"C",valence:4,electronegativity:2.55,mass:12},1);
  for(const [x,y] of [[24,20],[16,20],[20,24],[20,16]])biology.create("atom",{x,y,atomicNumber:1,elementSymbol:"H",valence:1,electronegativity:2.2,mass:1},1);
  const bonds=biology.formChemicalBonds({types:["atom"],radius:5,rate:10,dt:10,energyCost:.0001,activationEnergy:0});
  assert.equal(bonds,4);
  assert.equal(runtime.store.neighbours([...runtime.store.entities.values()].find(e=>e.type==="atom"&&e.properties.atomicNumber===6).id,"bond").length,4);
  assert.equal(biology.formMolecules({types:["atom"],minSize:2}),1);
  const molecule=[...runtime.store.entities.values()].find(e=>e.type==="molecule");
  assert.equal(molecule.properties.formula,"CH4");
  assert.equal(molecule.properties.moleculeName,"Methane");
  assert.equal(molecule.properties.bondCount,4);
});

test("GPU molecular candidates constrain CPU bond commits to the detected spatial pairs",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const carbon=biology.create("atom",{x:20,y:20,atomicNumber:6,elementSymbol:"C",valence:4,electronegativity:2.55,mass:12},1);
  const near=biology.create("atom",{x:24,y:20,atomicNumber:1,elementSymbol:"H",valence:1,electronegativity:2.2,mass:1},1);
  biology.create("atom",{x:26,y:20,atomicNumber:1,elementSymbol:"H",valence:1,electronegativity:2.2,mass:1},1);
  assert.equal(biology.formChemicalBonds({types:["atom"],radius:8,rate:10,dt:10,energyCost:0,activationEnergy:0,candidatePairs:[[carbon.id,near.id]]}),1);
  assert.deepEqual(runtime.store.neighbours(carbon.id,"bond"),[near.id]);
});

test("diatomic oxygen and nitrogen acquire double and triple bonds",()=>{
  for(const [atomicNumber,symbol,expectedOrder] of [[8,"O",2],[7,"N",3]]) {
    const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
    const props={atomicNumber,elementSymbol:symbol,valence:atomicNumber===8?2:3,electronegativity:atomicNumber===8?3.44:3.04,mass:atomicNumber===8?16:14};
    const a=biology.create("atom",{...props,x:20,y:20},1),b=biology.create("atom",{...props,x:24,y:20},1);
    assert.equal(biology.formChemicalBonds({types:["atom"],radius:5,rate:10,dt:10,energyCost:0,activationEnergy:0}),1);
    const bond=runtime.store.activeLinks.find(link=>link.type==="bond");
    assert.equal(bond.properties.order,expectedOrder);
    assert.ok(runtime.constraints);
  }
});

test("closed-shell noble gases do not form covalent bonds",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  biology.create("atom",{x:20,y:20,atomicNumber:2,elementSymbol:"He",valence:0,electronegativity:0},1);
  biology.create("atom",{x:22,y:20,atomicNumber:1,elementSymbol:"H",valence:1,electronegativity:2.2},1);
  assert.equal(biology.formChemicalBonds({types:["atom"],radius:5,rate:10,dt:10,energyCost:0,activationEnergy:0}),0);
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
