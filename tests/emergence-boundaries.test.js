import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression,DependencyEventIndex,ExperimentHarness} from "../src/emergence.js";

const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const engineSource=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(engineSource).toString("base64"));

test("energy-bearing material converts to ATP and heat under the energy flux invariant",()=>{
  const r=createRuntime({width:20,height:20,cols:4,rows:4}),b=new EmergenceProgression(r),cell=b.create("cell",{genome:{sequence:"AC"},x:5,y:5},0);
  b.owner.material(cell.id,"glucose",4,"energy");
  const before=r.energy.inventory(r.store).total;
  const result=b.metabolize(cell.id,{substrate:"glucose",waste:"waste",amount:2,efficiency:.75});
  assert.equal(result.consumed,2);assert.equal(result.energy,1.5);
  assert.equal(r.energy.quantity(cell,"glucose"),2);assert.equal(r.energy.quantity(cell,"waste"),2);
  assert.equal(cell.energy,1.5);assert.ok(Math.abs(r.energy.inventory(r.store).total-before)<1e-6);
  assert.equal(r.energy.audit(r.store,before).balanced,true);
});

test("membrane transport is selective, permeability-limited and conserves material",()=>{
  const r=createRuntime(),b=new EmergenceProgression(r),cell=b.formProtocell({genome:{sequence:"AC"},permeability:.5});
  const membrane=r.store.outgoing(cell.id,"contains").map(id=>r.store.get(id)).find(e=>e.type==="membrane");
  const outside=b.create("particle",{x:30,y:30});
  b.owner.material(cell.id,"nutrient",10,"mass");
  membrane.properties.selectivity=["nutrient"];
  assert.equal(b.transport(membrane.id,cell.id,outside.id,"toxin",5),0);
  assert.equal(b.transport(membrane.id,cell.id,outside.id,"nutrient",10),5);
  assert.equal(r.energy.quantity(cell,"nutrient"),5);assert.equal(r.energy.quantity(outside,"nutrient"),5);
});

test("gene regulation maps sequence loci and signals into heritable phenotype traits",()=>{
  const r=createRuntime(),b=new EmergenceProgression(r),cell=b.create("cell",{genome:{sequence:"AACCGGTT",traits:{}}});
  const genome=b.genetics.defineLoci(cell.properties.genome,[{id:"adhesion-gene",start:0,end:4,trait:"adhesion",min:0,max:1,basal:.2,regulators:[{name:"signal",weight:.8}]}]);
  b.owner.patch(cell.id,{genome});
  const traits=b.genetics.express(cell.id,{signal:.5});
  assert.ok(Math.abs(traits.adhesion-.6)<1e-9);
  assert.ok(Math.abs(cell.properties.genome.expression["adhesion-gene"]-.6)<1e-9);
  assert.equal(b.lineage.count("gene-expression"),1);
});

test("dependency index dispatches only matching entity-property subscriptions",()=>{
  const seen=[],r=createRuntime(),b=new EmergenceProgression(r),cell=b.create("cell",{genome:{sequence:"A"}});
  b.dependencies.subscribe({entityType:"cell",property:"phenotype"},change=>seen.push(change.value));
  b.dependencies.subscribe({entityType:"particle",property:"phenotype"},()=>seen.push("wrong"));
  r.store.transact([{op:"set",id:cell.id,key:"phenotype",value:"boundary"}]);
  assert.deepEqual(seen,["boundary"]);
  assert.equal(b.dependencies.size,2);
});

test("whole-tick transaction restores entity, field, scheduler and lineage state after failure",()=>{
  const r=createRuntime({width:20,height:20,cols:4,rows:4}),b=new EmergenceProgression(r),cell=b.create("cell",{genome:{sequence:"A"},x:2,y:2,vx:1,vy:0});
  r.fields.define("morphogen",0,{unit:"concentration",diffusion:.5});
  r.fields.add("morphogen",5,5,4);
  const before=r.fields.total("morphogen"),time=r.scheduler.time,tick=r.scheduler.tick,notifications=[];b.dependencies.subscribe({entityType:"cell",property:"biomass"},change=>notifications.push(change.value));
  r.scheduler.add("injected-failure",()=>{r.store.transact([{op:"set",id:cell.id,key:"biomass",value:99}]);b.lineage.record("should-rollback",{entity:cell.id});throw Error("injected tick failure")},99);
  assert.throws(()=>b.tickTransaction.run(()=>r.step(1)),/injected tick failure/);
  assert.equal(cell.properties.x,2);assert.equal(cell.properties.biomass,1);assert.equal(r.fields.total("morphogen"),before);
  assert.equal(r.scheduler.time,time);assert.equal(r.scheduler.tick,tick);
  assert.equal(b.lineage.count("should-rollback"),0);assert.deepEqual(notifications,[]);
});

test("fission partitions biomass, energy and material inventories atomically",()=>{
  const r=createRuntime(),b=new EmergenceProgression(r),parent=b.create("cell",{genome:{sequence:"ACGT"},biomass:10},10);
  b.owner.material(parent.id,"carbon",8,"mass");
  b.lifecycle.transition(parent.id,"growing");b.lifecycle.transition(parent.id,"mature");
  const daughter=b.fission(parent.id,{share:.5});
  assert.equal(parent.properties.biomass,5);assert.equal(daughter.properties.biomass,5);
  assert.equal(parent.energy,5);assert.equal(daughter.energy,5);
  assert.equal(r.energy.quantity(parent,"carbon"),4);assert.equal(r.energy.quantity(daughter,"carbon"),4);
  assert.equal(b.lifecycle.stage(parent),"mature");assert.equal(b.metrics.reproductions,0);
  assert.equal(b.lineage.count("fission"),1);
});

test("resource-limited growth refuses shortages and consumes supplied precursors",()=>{
  const r=createRuntime(),b=new EmergenceProgression(r),cell=b.create("cell",{genome:{sequence:"A"},biomass:1},5);
  b.owner.material(cell.id,"carbon",1,"mass");
  assert.equal(b.grow(cell.id,{biomass:2,resources:{carbon:2}}),false);
  assert.equal(cell.properties.biomass,1);assert.equal(r.energy.quantity(cell,"carbon"),1);
  assert.equal(b.grow(cell.id,{biomass:2,resources:{carbon:.5}}),true);
  assert.equal(cell.properties.biomass,3);assert.equal(r.energy.quantity(cell,"carbon"),.5);
});

test("field gradients drive differentiation and morphogenetic movement",()=>{
  const r=createRuntime({width:20,height:20,cols:20,rows:20}),b=new EmergenceProgression(r);
  r.fields.define("morphogen",0,{unit:"concentration"});
  r.fields.add("morphogen",5,5,1);
  const cells=[0,1,2].map(i=>b.create("cell",{genome:{sequence:"A"},x:5+i,y:5}));
  const colony=b.formColony(cells.map(x=>x.id));
  assert.equal(b.differentiateFromField(cells[0].id,"morphogen"),cells[0]);
  assert.equal(cells[0].properties.phenotype,"boundary");
  const before=cells[1].properties.x;
  b.morphogenesisFromField(colony.id,"morphogen",{strength:1,maxStep:1});
  assert.notEqual(cells[1].properties.x,before);
  assert.equal(b.lineage.count("field-morphogenesis"),1);
});

test("factorial experiment campaigns enumerate parameter combinations with distinct seeds",async()=>{
  const h=new ExperimentHarness(()=>createRuntime(),{seed:40});
  const campaign=await h.factorial({config:{steps:0},factors:{resource:["carbon","nitrogen"],rate:[1,2]},replicates:2,seed:40,applyParameters:(runtime,biology,parameters)=>biology.create("particle",{x:parameters.rate,y:0,resource:parameters.resource})});
  assert.equal(campaign.arms.length,4);assert.ok(campaign.arms.every(arm=>arm.runs.length===2));
  assert.deepEqual(campaign.arms.flatMap(arm=>arm.runs.map(run=>run.seed)),[40,41,42,43,44,45,46,47]);
});

test("declared biological payloads reject bypass writes but remain transactionally writable",()=>{
  const r=createRuntime(),b=new EmergenceProgression(r),cell=b.create("cell",{genome:{sequence:"AC"},biomass:2});
  assert.throws(()=>{cell.properties.genome={sequence:"TT"}},/owned by an EntityStore transaction/);
  assert.throws(()=>{cell.properties.genome.sequence="TT"},/read only|Cannot assign/);
  b.owner.patch(cell.id,{genome:{sequence:"TT"}});
  assert.equal(cell.properties.genome.sequence,"TT");
  const failed=r.store.transact([{op:"set",id:cell.id,key:"biomass",value:8},{op:"remove",id:999}]);
  assert.equal(failed.ok,false);assert.equal(cell.properties.biomass,2);
  assert.throws(()=>{cell.properties.biomass=9},/owned by an EntityStore transaction/);
  assert.throws(()=>{cell.energy=99},/owned by EnergyEngine flux operations/);
  r.energy.source(cell,1);assert.equal(cell.energy,1);
});
