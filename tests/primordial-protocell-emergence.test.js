import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EmergenceProgression} from "../src/emergence.js";

const html=readFileSync(new URL("../accretion.html",import.meta.url),"utf8");
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].split("import('./src/emergence.js')")[0];
const {createRuntime}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

test("primordial particles spontaneously assemble through atoms into a protocell",{timeout:60000},()=>{
  const runtime=createRuntime({width:14700,height:29115,cols:120,rows:68,cellSize:1,constraintIterations:2});
  const biology=new EmergenceProgression(runtime,{seed:20261115});
  const random=biology.rng.next.bind(biology.rng);
  const spawn=(type,properties,energy)=>{
    const angle=random()*Math.PI*2,radius=Math.sqrt(random())*30;
    return biology.create(type,{x:7350+Math.cos(angle)*radius,y:14557.5+Math.sin(angle)*radius,vx:0,vy:0,...properties},energy);
  };
  for(let i=0;i<1760;i++)spawn("quark",{flavor:"up",colorCharge:["red","green","blue"][i%3],charge:2/3,mass:1},.1);
  for(let i=0;i<1760;i++)spawn("quark",{flavor:"down",colorCharge:["red","green","blue"][i%3],charge:-1/3,mass:1},.1);
  for(let i=0;i<3520;i++)spawn("gluon",{colorCharge:["red-antigreen","red-antiblue","green-antired","green-antiblue","blue-antired","blue-antigreen"][i%6],mass:.1},.01);
  for(let i=0;i<1173;i++)spawn("lepton",{leptonKind:"electron",charge:-1,mass:.0005},.05);

  let primordialMatterAssembled=false,physicsEnabled=false,atomic=null;
  for(let frame=1;frame<=16;frame++) {
    runtime.step(.96);
    if(physicsEnabled)biology.applyElectrostatics({radius:2,strength:3,softening:8,maxAcceleration:.04,dt:.96});
    if(frame%4===0) {
      biology.exchangeThermalEnergy({radius:26,conductance:.025,dt:.96});
      biology.advanceCellularProcesses({uptakeRadius:48,uptakeAmount:.08,metabolismAmount:.04,efficiency:.72,growthAmount:.002,growthCost:.0005,maturity:1.5,reproductionInterval:1800,reproductionCost:.01,reproductionShare:.25,alphabet:"ACGU"});
      biology.advanceNeuralProcesses({radius:44,connections:3,learningRate:.015,energyCost:.0001});
      biology.advanceOrganismalProcesses();
    }
    biology.tick(.96);
    for(const entity of runtime.store.entities.values())if(entity.state==="active"||entity.state==="bound") {
      const p=entity.properties;p.vx*=.994;p.vy*=.994;
      if(p.x<0||p.x>14700)p.vx*=-.8;if(p.y<0||p.y>29115)p.vy*=-.8;
      p.x=Math.max(0,Math.min(14700,p.x));p.y=Math.max(0,Math.min(29115,p.y));
    }
    if(frame%2===0) {
      const previousCell=runtime.spatial.cell;
      try {
        if(!primordialMatterAssembled) {
          runtime.spatial.cell=16;
          atomic=biology.assembleAtomicMatter({radius:16,partitionNuclei:true,elementWeights:[[1,.35],[6,.4],[7,.1],[8,.15]]});
          primordialMatterAssembled=true;
        }
        runtime.spatial.cell=24;
        biology.advancePrebioticChemistry({precursorRadius:180,precursorEnergyCost:.0001,monomerBondRadius:80,monomerBondRate:.2,monomerBondEnergy:.00001,minimumPolymerLength:6,polymerEnergyCost:.00001,translationEnergyCost:.00001,assemblyRadius:120,protocellRadius:120,membranePermeability:.15});
      } finally {runtime.spatial.cell=previousCell}
      if(biology.metrics.protocells>0&&!physicsEnabled) {
        physicsEnabled=true;
        runtime.interactions.register({id:"quark-cohesion",a:"quark",b:"quark",radius:1,strength:.045,mode:"attract"})
          .register({id:"quark-exclusion",a:"quark",b:"quark",radius:.5,strength:.28,mode:"repel"});
      }
    }
  }
  assert.equal(atomic.hadrons,1140);
  assert.equal(atomic.atoms,132);
  assert.equal(physicsEnabled,true);
  assert.equal(biology.metrics.protocells,1);

  const count=type=>[...runtime.store.entities.values()].filter(e=>e.type===type).length;
  assert.equal(count("monomer"),6);
  assert.equal(count("lipid"),9);
  assert.equal(count("polymer"),1);
  assert.equal(count("protein"),1);
  assert.equal(count("autocatalytic-network"),1);
  assert.equal(count("membrane"),1);
  assert.equal(count("vesicle"),1);
  assert.equal(count("protocell"),1);
});
