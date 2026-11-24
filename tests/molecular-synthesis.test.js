import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";
const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

test("water forms from two hydrogen atoms and one oxygen atom",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const h1=biology.create("atom",{x:20,y:20,atomicNumber:1,mass:1,elementSymbol:"H"}),h2=biology.create("atom",{x:22,y:20,atomicNumber:1,mass:1,elementSymbol:"H"}),o=biology.create("atom",{x:21,y:22,atomicNumber:8,mass:16,elementSymbol:"O"});
  assert.equal(biology.assembleWater({radius:8}),1);
  const water=[...runtime.store.entities.values()].find(e=>e.type==="water");
  assert.equal(water.properties.formula,"H2O");
  assert.equal(runtime.store.descendants(water.id).length,3);
  assert.deepEqual(runtime.store.descendants(water.id).sort((a,b)=>a-b),[h1.id,h2.id,o.id].sort((a,b)=>a-b));
});

test("organic feedstock atoms assemble into an amino-acid precursor",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const atoms=[];
  for(let i=0;i<2;i++)atoms.push(biology.create("atom",{x:20+i,y:20,atomicNumber:6,mass:12}));
  for(let i=0;i<5;i++)atoms.push(biology.create("atom",{x:20+i*.5,y:22,atomicNumber:1,mass:1}));
  atoms.push(biology.create("atom",{x:21,y:21,atomicNumber:7,mass:14}));
  for(let i=0;i<2;i++)atoms.push(biology.create("atom",{x:22+i,y:21,atomicNumber:8,mass:16}));
  assert.equal(biology.assembleOrganicMolecules({radius:12}),1);
  const molecule=[...runtime.store.entities.values()].find(e=>e.type==="organic-molecule");
  assert.equal(molecule.properties.formula,"C2H5NO2");
  assert.equal(molecule.properties.moleculeName,"Glycine");
  assert.equal(runtime.store.descendants(molecule.id).length,10);
});

test("RNA translates into a folded protein and can form a ribonucleoprotein complex",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const rna=biology.create("polymer",{x:20,y:20,sequence:["A","U","G","G","C","U","U","A","A"],mass:3,length:9},1);
  const protein=biology.translateRNA(rna.id,{energyCost:.01});
  assert.equal(protein.type,"protein");
  assert.equal(protein.properties.sequence,"MA");
  assert.equal(protein.properties.folded.class,"globular");
  assert.ok(protein.properties.catalyticEfficiency>0);
  assert.equal(biology.assembleMacromolecularComplexes({radius:10}),1);
  const complex=[...runtime.store.entities.values()].find(e=>e.type==="macromolecule");
  assert.ok(runtime.store.descendants(complex.id).includes(rna.id));
  assert.ok(runtime.store.descendants(complex.id).includes(protein.id));
  assert.equal(biology.metrics.proteins,1);
  assert.equal(biology.metrics.macromolecularComplexes,1);
});

test("the integrated molecular pass synthesizes water and organic feedstock from free atoms",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:19});
  biology.create("atom",{x:10,y:10,atomicNumber:8,elementSymbol:"O",mass:16},.1);
  biology.create("atom",{x:9,y:10,atomicNumber:1,elementSymbol:"H",mass:1},.1);
  biology.create("atom",{x:11,y:10,atomicNumber:1,elementSymbol:"H",mass:1},.1);
  for(let i=0;i<2;i++)biology.create("atom",{x:50+i,y:50,atomicNumber:6,elementSymbol:"C",mass:12},.1);
  for(let i=0;i<5;i++)biology.create("atom",{x:49+i*.5,y:52,atomicNumber:1,elementSymbol:"H",mass:1},.1);
  biology.create("atom",{x:50,y:51,atomicNumber:7,elementSymbol:"N",mass:14},.1);
  for(let i=0;i<2;i++)biology.create("atom",{x:51+i,y:51,atomicNumber:8,elementSymbol:"O",mass:16},.1);

  const result=biology.assembleMolecularMatter({waterRadius:5,organicRadius:8,bondRadius:1,bondRate:0,bondEnergyCost:.0005});
  assert.equal(result.water,1);
  assert.equal(result.organic,1);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="water").length,1);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="organic-molecule").length,1);
  assert.equal(biology.metrics.water,1);
  assert.equal(biology.metrics.organicMolecules,1);
});

test("the molecular pass forwards live chemistry parameters to atomic bonding",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  let received=null;
  biology.formChemicalBonds=options=>(received=options,0);
  biology.formMolecules=()=>0;
  biology.translateAllRNA=()=>[];
  biology.assembleMacromolecularComplexes=()=>0;
  biology.assembleWater=()=>0;
  biology.assembleOrganicMolecules=()=>0;
  biology.assembleMolecularMatter({bondRadius:27,bondRate:.73,bondEnergyCost:.004,dt:.5,activationEnergy:.01});
  assert.equal(received.radius,27);
  assert.equal(received.rate,.73);
  assert.equal(received.energyCost,.004);
  assert.equal(received.dt,.5);
  assert.equal(received.activationEnergy,.01);
});

test("organic synthesis searches for a local cluster instead of getting stuck on distant feedstock",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:23});
  biology.create("atom",{x:2,y:2,atomicNumber:6,mass:12});
  biology.create("atom",{x:50,y:50,atomicNumber:6,mass:12});
  biology.create("atom",{x:51,y:50,atomicNumber:6,mass:12});
  for(let i=0;i<5;i++)biology.create("atom",{x:49+i*.5,y:52,atomicNumber:1,mass:1});
  biology.create("atom",{x:50,y:51,atomicNumber:7,mass:14});
  for(let i=0;i<2;i++)biology.create("atom",{x:51+i,y:51,atomicNumber:8,mass:16});
  assert.equal(biology.assembleOrganicMolecules({radius:8}),1);
  const molecule=[...runtime.store.entities.values()].find(e=>e.type==="organic-molecule");
  assert.ok(molecule);
  assert.equal(runtime.store.descendants(molecule.id).length,10);
  assert.equal(runtime.store.get(1).parent,null);
});
