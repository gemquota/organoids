import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";
const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

test("mature cells self-organise into colonies and differentiate from morphogen gradients",()=>{
  const runtime=createRuntime({width:100,height:100,cols:40,rows:40}),biology=new EmergenceProgression(runtime);
  const positions=[[42,50],[50,42],[58,50],[50,58],[48,49],[50,48],[52,51]];
  const cells=positions.map(([x,y],i)=>biology.create("cell",{x,y,genome:{sequence:"ACGT",traits:{}},lifeStage:"mature",biomass:3}));
  const result=biology.advanceMulticellularProcesses({adhesionRadius:14,minimumCells:5,morphogenesisRadius:8});
  assert.equal(result.formed,1);
  const colony=[...runtime.store.entities.values()].find(e=>e.type==="colony");
  assert.ok(colony);
  assert.equal(runtime.store.descendants(colony.id).filter(id=>cells.some(c=>c.id===id)).length,7);
  assert.ok(cells.every(e=>e.properties.phenotype));
  assert.ok(cells.some(e=>e.properties.phenotype==="boundary"));
  assert.ok(cells.some(e=>e.properties.phenotype==="interior"));
  assert.equal(biology.metrics.differentiations,7);
});

test("differentiated cell populations organise into tissues and an organoid",()=>{
  const runtime=createRuntime({width:100,height:100,cols:40,rows:40}),biology=new EmergenceProgression(runtime);
  const cells=[];
  for(let i=0;i<4;i++)cells.push(biology.create("cell",{x:20+i,y:20,genome:{sequence:"ACGT",traits:{}},lifeStage:"mature",phenotype:"boundary"}));
  for(let i=0;i<3;i++)cells.push(biology.create("cell",{x:20+i,y:24,genome:{sequence:"ACGT",traits:{}},lifeStage:"mature",phenotype:"interior"}));
  const colony=biology.formColony(cells.map(e=>e.id));
  const tissues=biology.formTissues(colony.id);
  assert.equal(tissues.length,2);
  const organoid=biology.formOrganoid(colony.id);
  assert.ok(organoid);
  assert.equal(organoid.properties.tissueCount,2);
  assert.equal(runtime.store.get(organoid.id).parent,colony.id);
  assert.equal(runtime.store.descendants(organoid.id).filter(id=>cells.some(c=>c.id===id)).length,7);
  assert.equal(biology.metrics.tissues,2);
  assert.equal(biology.metrics.organoids,1);
});

test("cells retain membrane transport and metabolism after colony incorporation",()=>{
  const runtime=createRuntime({width:100,height:100,cols:20,rows:20}),biology=new EmergenceProgression(runtime);
  const cells=[0,1,2].map(i=>biology.formProtocell({x:20+i*3,y:20,energy:1,biomass:1,lipidCount:6,genome:{sequence:"ACGT",traits:{}}}));
  const colony=biology.formColony(cells.map(e=>e.id));
  const nutrient=biology.create("substrate",{x:30,y:20},0);
  biology.owner.material(nutrient.id,"substrate",1,"energy");
  const result=biology.advanceCellularProcesses({uptakeRadius:30,uptakeAmount:.5,metabolismAmount:.1,efficiency:.8,growthAmount:.1,growthCost:.01,maturity:1.5,reproductionInterval:99999});
  assert.equal(result.cells,3);
  assert.ok(result.transported>0);
  assert.ok(cells.some(e=>e.energy>1));
  assert.equal(runtime.store.get(colony.id).type,"colony");
});
