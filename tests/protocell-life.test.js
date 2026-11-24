import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";
const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

test("a membrane, polymer and catalytic network become one protocell",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:12});
  const membrane=biology.assembleMembrane({x:20,y:20,count:8,radius:8});
  const polymer=biology.create("polymer",{sequence:["A","U","C","G"],x:20,y:20,mass:4,length:4},2);
  const a=biology.create("catalyst",{x:19,y:20},.5),b=biology.create("catalyst",{x:21,y:20},.5);
  const network=biology.buildAutocatalyticNetwork({members:[a.id,b.id],cycleGain:1.1});
  const cell=biology.encapsulateProtocell(membrane.id,[polymer.id,network.id]);
  assert.equal(cell.type,"protocell");
  assert.equal(cell.properties.genome.sequence,"AUCG");
  assert.equal(cell.properties.catalogueId,"protocells");
  assert.equal(membrane.parent,cell.id);
  assert.equal(polymer.parent,cell.id);
  assert.equal(network.parent,cell.id);
  assert.ok(runtime.store.descendants(cell.id).includes(a.id));
  assert.equal(biology.metrics.protocells,1);
});

test("repeated vesicle assembly ignores already wrapped vesicles",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:14});
  biology.assembleMembrane({x:20,y:20,count:8,radius:8});
  assert.equal(biology.formVesiclesFromMembranes(),1);
  assert.equal(biology.formVesiclesFromMembranes(),0);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="vesicle").length,1);
});

test("cellular metabolism transports substrate through a membrane and funds growth",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:3});
  const cell=biology.formProtocell({x:20,y:20,energy:1,biomass:1,lipidCount:8,genome:{sequence:"ACGT",traits:{}}});
  const nutrient=biology.create("substrate",{x:30,y:20,volume:1},0);
  biology.owner.material(nutrient.id,"substrate",1,"energy");
  const result=biology.advanceCellularProcesses({uptakeRadius:30,uptakeAmount:.5,metabolismAmount:.1,efficiency:.8,growthAmount:.2,growthCost:.05,maturity:1.1,reproductionInterval:10000});
  assert.ok(result.transported>0);
  assert.ok(result.metabolised>0);
  assert.equal(result.grown,1);
  assert.ok(cell.energy>1);
  assert.equal(biology.lifecycle.stage(cell),"mature");
  assert.ok(nutrient.quantities.substrate<1);
});

test("cell fission partitions biomass and creates an RNA-compatible daughter",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:8});
  const parent=biology.create("protocell",{x:10,y:10,genome:{sequence:"AUCG",traits:{mutationRate:1}},biomass:4,lifeStage:"mature"},10);
  biology.assembleMembrane({x:10,y:10,count:6,radius:5});
  const membrane=[...runtime.store.entities.values()].find(e=>e.type==="membrane");
  runtime.store.compose(parent.id,membrane.id);
  const daughter=biology.fission(parent.id,{share:.3,energyCost:.1,alphabet:"ACGU"});
  assert.equal(daughter.type,"protocell");
  assert.match(daughter.properties.genome.sequence,/^[ACGU]+$/);
  assert.equal(daughter.properties.genome.sequence.length,4);
  assert.ok(daughter.properties.biomass>0);
  assert.equal(runtime.store.outgoing(daughter.id,"contains").map(id=>runtime.store.get(id)).filter(e=>e?.type==="membrane").length,1);
  assert.equal(biology.lifecycle.stage(parent),"mature");
});
