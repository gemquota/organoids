import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";
const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

test("organoids integrate into organs and specialised neural tissues form nervous systems and brains",()=>{
  const runtime=createRuntime({width:100,height:100,cols:40,rows:40}),biology=new EmergenceProgression(runtime);
  const cells=[];
  for(let i=0;i<4;i++)cells.push(biology.create("cell",{x:20+i,y:20,genome:{sequence:"ACGT",traits:{}},lifeStage:"mature",phenotype:"neural"}));
  for(let i=0;i<3;i++)cells.push(biology.create("cell",{x:20+i,y:24,genome:{sequence:"ACGT",traits:{}},lifeStage:"mature",phenotype:"boundary"}));
  const colony=biology.formColony(cells.map(e=>e.id)),tissues=biology.formTissues(colony.id);
  const organoid=biology.formOrganoid(colony.id);
  const organ=biology.formOrgan(organoid.id);
  const nervous=biology.formNervousSystem(organ.id);
  const brain=biology.formBrain(nervous.id);
  assert.ok(organ&&nervous&&brain);
  assert.equal(organ.type,"organ");
  assert.equal(nervous.type,"nervous-system");
  assert.equal(brain.properties.neuronCount,4);
  assert.ok(runtime.store.descendants(brain.id).includes(tissues.find(t=>t.properties.role==="neural").id));
  assert.equal(biology.metrics.organs,1);
  assert.equal(biology.metrics.nervousSystems,1);
  assert.equal(biology.metrics.brains,1);
});

test("neural activity responds to stimulus, builds directed connections and retains short-term memory",()=>{
  const runtime=createRuntime({width:100,height:100,cols:40,rows:40}),biology=new EmergenceProgression(runtime,{seed:2});
  const neurons=Array.from({length:5},(_,i)=>biology.create("cell",{x:20+i*3,y:20,genome:{sequence:"ACGT",traits:{}},phenotype:"neural",threshold:.2,heatCapacity:1},1));
  runtime.fields.add("stimulus",20,20,2);
  const result=biology.advanceNeuralProcesses({radius:20,connections:2,initialWeight:.4,energyCost:.001});
  assert.equal(result.neurons,5);
  assert.ok(result.connections>0);
  assert.ok(result.fired>0);
  assert.ok(neurons.some(e=>e.properties.memory.length>0));
  assert.ok(neurons.some(e=>e.properties.spikeCount>0));
});

test("cognition emerges only after a sufficiently active brain exists",()=>{
  const runtime=createRuntime({width:100,height:100,cols:40,rows:40}),biology=new EmergenceProgression(runtime);
  const neurons=Array.from({length:4},(_,i)=>biology.create("cell",{x:10+i,y:10,genome:{sequence:"ACGT",traits:{}},phenotype:"neural"},1));
  const colony=biology.formColony(neurons.map(e=>e.id));
  const tissue=biology.formTissues(colony.id)[0];
  const organoid=biology.formOrganoid(colony.id);
  const organ=biology.formOrgan(organoid.id);
  const nervous=biology.formNervousSystem(organ.id);
  const brain=biology.formBrain(nervous.id);
  assert.equal(biology.formCognition(brain.id),null);
  runtime.fields.add("stimulus",10,10,1);
  biology.advanceNeuralProcesses({radius:10});
  const cognition=biology.formCognition(brain.id);
  assert.ok(cognition);
  assert.equal(cognition.type,"cognition");
  assert.equal(cognition.properties.networkSize,4);
});
