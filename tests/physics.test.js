import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";

const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

test("electrostatic interactions repel like charges and attract opposite charges",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const a=biology.create("particle",{x:40,y:50,vx:0,vy:0,mass:1,charge:1},1);
  const b=biology.create("particle",{x:50,y:50,vx:0,vy:0,mass:1,charge:1},1);
  biology.applyElectrostatics({radius:30,strength:10,softening:1,maxAcceleration:1,dt:1});
  assert.ok(a.properties.vx<0&&b.properties.vx>0);
  a.properties.vx=0;b.properties.vx=0;b.properties.charge=-1;
  biology.applyElectrostatics({radius:30,strength:10,softening:1,maxAcceleration:1,dt:1});
  assert.ok(a.properties.vx>0&&b.properties.vx<0);
});

test("electrostatic force conserves pair momentum across unequal masses",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const a=biology.create("particle",{x:40,y:50,vx:0,vy:0,mass:2,charge:1},1);
  const b=biology.create("particle",{x:50,y:50,vx:0,vy:0,mass:4,charge:-1},1);
  biology.applyElectrostatics({radius:30,strength:10,softening:1,maxAcceleration:1,dt:1});
  assert.ok(Math.abs(a.properties.vx*2+b.properties.vx*4)<1e-10);
});

test("thermal exchange moves energy down temperature gradients without creating energy",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const hot=biology.create("particle",{x:40,y:50,heatCapacity:1},10);
  const cold=biology.create("particle",{x:45,y:50,heatCapacity:2},0);
  const before=hot.energy+cold.energy;
  const moved=biology.exchangeThermalEnergy({radius:20,conductance:.5,dt:1});
  assert.equal(moved,1);
  assert.ok(hot.energy<10&&cold.energy>0);
  assert.ok(Math.abs(hot.energy+cold.energy-before)<1e-10);
  assert.equal(runtime.energy.audit(runtime.store,10).balanced,true);
});


test("short-range nuclear attraction binds free nucleons with conserved pair momentum",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const a=biology.create("proton",{x:40,y:50,vx:0,vy:0,mass:3,charge:1},.1);
  const b=biology.create("neutron",{x:60,y:50,vx:0,vy:0,mass:3,charge:0},.1);
  const nucleus=biology.create("atomic-nucleus",{x:80,y:50,mass:3,protonCount:1},0);
  const bound=biology.create("proton",{x:80,y:50,vx:0,vy:0,mass:3,charge:1},.1);
  runtime.store.transact([{op:"compose",parent:nucleus.id,child:bound.id}]);
  const pairs=biology.applyNuclearAttraction({radius:30,range:20,strength:1,maxAcceleration:1,dt:1});
  assert.equal(pairs,1);
  assert.ok(a.properties.vx>0&&b.properties.vx<0);
  assert.equal(bound.properties.vx,0);
  assert.ok(Math.abs(a.properties.vx*a.properties.mass+b.properties.vx*b.properties.mass)<1e-10);
});


test("thermal exchange accepts GPU-generated candidate pairs while preserving exact energy flux",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const hot=biology.create("particle",{x:40,y:50,heatCapacity:1},10);
  const cold=biology.create("particle",{x:45,y:50,heatCapacity:2},0);
  const entities=[hot,cold],before=hot.energy+cold.energy;
  assert.equal(biology.exchangeThermalEnergy({radius:20,conductance:.5,dt:1,candidatePairs:[[0,1]],candidateEntities:entities}),1);
  assert.ok(hot.energy<10&&cold.energy>0);
  assert.ok(Math.abs(hot.energy+cold.energy-before)<1e-10);
  assert.equal(runtime.energy.audit(runtime.store,before).balanced,true);
});

test("thermal GPU candidate list can suppress false broadphase pairs",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const hot=biology.create("particle",{x:40,y:50,heatCapacity:1},10);
  const cold=biology.create("particle",{x:45,y:50,heatCapacity:2},0);
  assert.equal(biology.exchangeThermalEnergy({radius:20,conductance:.5,dt:1,candidatePairs:[],candidateEntities:[hot,cold]}),0);
  assert.equal(hot.energy,10);assert.equal(cold.energy,0);
});

test("GPU broadphase candidates are accepted by molecular bond formation",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const a=biology.create("monomer",{x:40,y:50,valence:2,monomerKind:"A",bondAffinity:1},1);
  const b=biology.create("monomer",{x:45,y:50,valence:2,monomerKind:"U",bondAffinity:1},1);
  assert.equal(biology.formChemicalBonds({types:["monomer"],radius:10,rate:100,dt:1,energyCost:0,candidatePairs:[[0,1]],candidateEntities:[a,b]}),1);
  assert.equal(runtime.store.neighbours(a.id,"bond").includes(b.id),true);
});

test("GPU broadphase candidates can be consumed by contact aggregation",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const a=biology.create("particle",{x:40,y:50},0),b=biology.create("particle",{x:45,y:50},0);
  assert.equal(biology.aggregateContacts({radius:10,types:["particle"],candidatePairs:[[0,1]],candidateEntities:[a,b]}),1);
  assert.equal(runtime.store.neighbours(a.id,"bond").includes(b.id),true);
});
