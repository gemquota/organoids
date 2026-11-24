import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";
const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

test("small amphiphile clusters self-assemble into micelles instead of membranes",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const lipids=Array.from({length:5},(_,i)=>biology.create("lipid",{x:20+Math.cos(i*1.2)*2,y:20+Math.sin(i*1.2)*2,headPolarity:1,tailHydrophobicity:1}));
  assert.equal(biology.selfAssembleMicelles({radius:8,minLipids:3,maxLipids:7}),1);
  const micelle=[...runtime.store.entities.values()].find(e=>e.type==="micelle");
  assert.ok(micelle);
  assert.equal(micelle.properties.amphiphileCount,5);
  assert.deepEqual(runtime.store.descendants(micelle.id).sort((a,b)=>a-b),lipids.map(e=>e.id).sort((a,b)=>a-b));
  assert.equal(biology.metrics.micelles,1);
});

test("vesicles can encapsulate polymers and catalytic networks without duplicating membranes",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const membrane=biology.assembleMembrane({x:20,y:20,count:8,radius:8}),vesicle=biology.wrapVesicle(membrane.id);
  assert.equal(membrane.properties.bilayer,true);
  assert.equal(membrane.properties.outerLeafletCount,4);
  assert.equal(membrane.properties.innerLeafletCount,4);
  assert.equal(biology.store.descendants(membrane.id).map(id=>biology.store.get(id)).filter(e=>e?.properties.leaflet==="outer").length,4);
  const polymer=biology.create("polymer",{sequence:["A","U","C","G"],x:20,y:20,mass:4},1);
  const a=biology.create("catalyst",{x:19,y:20}),b=biology.create("catalyst",{x:21,y:20});
  const network=biology.buildAutocatalyticNetwork({members:[a.id,b.id]});
  assert.equal(biology.formProtocellsFromAssemblies({radius:12}),1);
  const cell=[...runtime.store.entities.values()].find(e=>e.type==="protocell");
  assert.ok(cell);
  assert.equal(vesicle.parent,cell.id);
  assert.equal(membrane.parent,vesicle.id);
  assert.equal(polymer.parent,cell.id);
  assert.equal(network.parent,cell.id);
  assert.equal(biology.metrics.vesicles,1);
});

test("prokaryotic cells arise from mature protocells and endosymbiosis integrates a second lineage",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:4});
  const hostProto=biology.formProtocell({x:20,y:20,energy:3,genome:{sequence:"ACGUAC",traits:{}}});
  const symProto=biology.formProtocell({x:22,y:20,energy:2,genome:{sequence:"GGCCAU",traits:{}}});
  const host=biology.formProkaryoticCell(hostProto.id),symbiont=biology.formProkaryoticCell(symProto.id);
  const eukaryote=biology.formEukaryoticCell(host.id,symbiont.id,{radius:10,geneTransferLength:3});
  assert.equal(eukaryote.type,"eukaryotic-cell");
  assert.equal(eukaryote.properties.genome.sequence,"ACGUACGGC");
  assert.equal(eukaryote.properties.organelleCount,1);
  assert.equal(runtime.store.neighbours(host.id,"endosymbiosis").includes(symbiont.id),true);
  assert.ok(runtime.store.descendants(eukaryote.id).includes(hostProto.id));
  assert.ok(runtime.store.descendants(eukaryote.id).includes(symProto.id));
  assert.ok(eukaryote.energy>0);
  assert.equal(biology.metrics.prokaryoticCells,2);
  assert.equal(biology.metrics.eukaryoticCells,1);
  assert.equal(biology.metrics.endosymbioses,1);
});

test("metabolism can promote a protocell into a prokaryotic cell",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  const proto=biology.formProtocell({x:10,y:10,energy:2,genome:{sequence:"ACGU",traits:{}}});
  runtime.store.transact([{op:"set",id:proto.id,key:"metabolicEvents",value:3}]);
  const result=biology.advanceEvolutionaryTransitions({minimumMetabolicEvents:3,minimumEnergy:1,endosymbiosis:false});
  assert.equal(result.prokaryotes,1);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="prokaryotic-cell").length,1);
});
