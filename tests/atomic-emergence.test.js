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
  assert.deepEqual(result,{hadrons:4,nuclei:1,isotopes:1,accretions:0,fusions:0,atoms:1,elements:1});
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


test("composite atomic assembly conserves constituent mass, charge and energy",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime);
  seedHelium(biology);
  const result=biology.assembleAtomicMatter({radius:10});
  assert.deepEqual(result,{hadrons:4,nuclei:1,isotopes:1,accretions:0,fusions:0,atoms:1,elements:1});
  const entities=[...runtime.store.entities.values()];
  const hadrons=entities.filter(e=>e.type==="proton"||e.type==="neutron");
  const nucleus=entities.find(e=>e.type==="atomic-nucleus");
  const isotope=entities.find(e=>e.type==="isotope");
  const atom=entities.find(e=>e.type==="atom");
  const electrons=runtime.store.descendants(atom.id).map(id=>runtime.store.get(id)).filter(e=>e?.type==="lepton");
  const quarks=runtime.store.descendants(nucleus.id).map(id=>runtime.store.get(id)).filter(e=>e?.type==="quark");
  assert.equal(quarks.length,12);
  assert.equal(quarks.reduce((sum,e)=>sum+e.properties.mass,0),nucleus.properties.mass);
  assert.equal(hadrons.reduce((sum,e)=>sum+e.properties.mass,0),nucleus.properties.mass);
  assert.equal(hadrons.reduce((sum,e)=>sum+e.properties.charge,0),nucleus.properties.charge);
  assert.equal(nucleus.properties.atomicNumber,nucleus.properties.protonCount);
  assert.equal(isotope.properties.mass,nucleus.properties.mass);
  assert.equal(isotope.properties.protonCount,nucleus.properties.protonCount);
  assert.equal(atom.properties.mass,isotope.properties.mass+electrons.reduce((sum,e)=>sum+e.properties.mass,0));
  assert.equal(atom.properties.charge,atom.properties.atomicNumber-electrons.length);
  assert.equal(atom.properties.charge,0);
  assert.equal(runtime.energy.audit(runtime.store,1.38).balanced,true);
});


test("multi-proton nuclei form positive ions and neutralise through later electron capture",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const nucleus=biology.create("atomic-nucleus",{x:50,y:50,mass:4,protonCount:2,neutronCount:2,atomicNumber:2,massNumber:4,charge:2},0);
  const isotope=biology.create("isotope",{x:50,y:50,mass:4,protonCount:2,neutronCount:2,atomicNumber:2,massNumber:4,charge:2},0);
  runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
  biology.create("lepton",{x:51,y:50,leptonKind:"electron",charge:-1,mass:.0005},.05);
  assert.equal(biology.formAtoms({radius:10}),1);
  const atom=[...runtime.store.entities.values()].find(e=>e.type==="atom");
  assert.ok(atom);
  assert.equal(atom.properties.charge,1);
  assert.equal(atom.properties.electronCount,1);
  assert.equal(atom.properties.name,"Helium ion");
  biology.create("lepton",{x:52,y:50,leptonKind:"electron",charge:-1,mass:.0005},.05);
  assert.equal(biology.formAtoms({radius:10}),0);
  assert.equal(atom.properties.charge,0);
  assert.equal(atom.properties.electronCount,2);
  assert.equal(atom.properties.name,"Helium atom");
  assert.equal(runtime.store.descendants(atom.id).filter(id=>runtime.store.get(id)?.type==="lepton").length,2);
  assert.equal(runtime.energy.audit(runtime.store,.1).balanced,true);
});




test("an isolated proton can become a neutral hydrogen atom",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  biology.create("proton",{x:50,y:50,mass:1,charge:1},.1);
  biology.create("lepton",{x:51,y:50,leptonKind:"electron",charge:-1,mass:.0005},.05);
  const result=biology.assembleAtomicMatter({radius:10});
  assert.equal(result.nuclei,1);
  assert.equal(result.isotopes,1);
  assert.equal(result.atoms,1);
  const atom=[...runtime.store.entities.values()].find(e=>e.type==="atom");
  assert.equal(atom.properties.atomicNumber,1);
  assert.equal(atom.properties.neutronCount,0);
  assert.equal(atom.properties.charge,0);
  assert.equal(runtime.energy.audit(runtime.store,.15).balanced,true);
});


test("mature isotopes atomise before the next fusion pass",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const make=(x,z)=>{const p={x,y:50,mass:z*2,protonCount:z,neutronCount:z,atomicNumber:z,massNumber:z*2,charge:z,formedAt:0};const nucleus=biology.create('atomic-nucleus',p);const isotope=biology.create('isotope',p);runtime.store.link(isotope.id,nucleus.id,'contains')};
  make(48,1);make(52,2);
  for(let i=0;i<3;i++)biology.create('lepton',{x:50+i*.1,y:50,leptonKind:'electron',charge:-1,mass:.0005},.05);
  runtime.scheduler.time=10;
  const result=biology.assembleAtomicMatter({nuclearRadius:10,atomRadius:10,fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:18,fusionProbability:1,atomizationDelay:10});
  assert.equal(result.atoms,2);
  assert.equal(result.fusions,0);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==='atom').length,2);
});

test("mature isotopes are protected from fusion while waiting for electrons",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  for(const x of [48,52]){
    const properties={x,y:50,mass:4,protonCount:2,neutronCount:2,atomicNumber:2,massNumber:4,charge:2,formedAt:0};
    const nucleus=biology.create('atomic-nucleus',properties,0),isotope=biology.create('isotope',properties,0);
    runtime.store.link(isotope.id,nucleus.id,'contains');
  }
  runtime.scheduler.time=10;
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:10,fusionProbability:1,atomizationDelay:10}),0);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==='isotope'&&!e.parent).length,2);
});

test("isotopes remain fusible during the atomisation window",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const makeHelium=(x)=>{
    const properties={x,y:50,mass:4,protonCount:2,neutronCount:2,atomicNumber:2,massNumber:4,charge:2};
    const nucleus=biology.create("atomic-nucleus",properties,0);
    const isotope=biology.create("isotope",properties,0);
    runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
    return isotope;
  };
  makeHelium(48);makeHelium(52);
  for(let i=0;i<4;i++)biology.create("lepton",{x:50+i*.1,y:50,leptonKind:"electron",charge:-1,mass:.0005},.05);
  assert.equal(biology.formAtoms({radius:10,atomizationDelay:5}),0);
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:10}),1);
  runtime.scheduler.time=5;
  assert.equal(biology.formAtoms({radius:10,atomizationDelay:5}),1);
  const atom=[...runtime.store.entities.values()].find(e=>e.type==="atom");
  assert.equal(atom.properties.atomicNumber,4);
  assert.equal(atom.properties.charge,0);
  assert.equal(runtime.energy.audit(runtime.store,.2).balanced,true);
});


test("hydrogen nuclei remain available while heavier isotopes fuse",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  for(const x of [48,52]){
    const properties={x,y:50,mass:1,protonCount:1,neutronCount:0,atomicNumber:1,massNumber:1,charge:1};
    const nucleus=biology.create("atomic-nucleus",properties,0);
    const isotope=biology.create("isotope",properties,0);
    runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
  }
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1,minFusionAtomicNumber:2,maxAtomicNumber:10}),0);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="isotope"&&!e.parent).length,2);
});



test("hydrogen can be captured by a heavier isotope without hydrogen-only fusion",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const make=(x,z,n)=>{
    const properties={x,y:50,mass:z+n,protonCount:z,neutronCount:n,atomicNumber:z,massNumber:z+n,charge:z};
    const nucleus=biology.create("atomic-nucleus",properties,0);
    const isotope=biology.create("isotope",properties,0);
    runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
  };
  make(48,1,0);make(52,2,2);
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1,minFusionAtomicNumber:2,maxAtomicNumber:10}),1);
  const fused=[...runtime.store.entities.values()].find(e=>e.type==="isotope"&&!e.parent);
  assert.equal(fused.properties.atomicNumber,3);
});




test("primordial seed fraction preserves hydrogen nuclei and unbound neutrons",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime,{seed:17});
  for(let i=0;i<4;i++)biology.create('proton',{x:50+i*.1,y:50,mass:1,charge:1},.1);
  for(let i=0;i<4;i++)biology.create('neutron',{x:50+i*.1,y:50.2,mass:1,charge:0},.1);
  assert.equal(biology.formNuclei({radius:10,maxNucleons:4,maxProtons:2,smallNucleusFraction:1}),4);
  const nuclei=[...runtime.store.entities.values()].filter(e=>e.type==='atomic-nucleus');
  assert.ok(nuclei.every(e=>e.properties.protonCount===1&&e.properties.neutronCount===0));
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==='neutron'&&!e.parent).length,4);
});

test("fusion channel network can build carbon from helium and beryllium nuclei",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const make=(x,z,n)=>{const p={x,y:50,mass:z+n,protonCount:z,neutronCount:n,atomicNumber:z,massNumber:z+n,charge:z,formedAt:0};const nucleus=biology.create('atomic-nucleus',p);const isotope=biology.create('isotope',p);runtime.store.link(isotope.id,nucleus.id,'contains')};
  make(45,2,2);make(55,4,4);
  const channels=[{reactants:[2,4],maxPerTick:1}];
  assert.equal(biology.fuseIsotopes({fusionRadius:20,maxFusionSpeed:1,maxAtomicNumber:18,fusionProbability:1,fusionChannels:channels}),1);
  assert.ok([...runtime.store.entities.values()].some(e=>e.type==='isotope'&&e.properties.atomicNumber===6));
});

test("fusion channels are prioritised globally so oxygen is not stolen by carbon synthesis",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const make=(x,z)=>{const p={x,y:50,mass:z*2,protonCount:z,neutronCount:z,atomicNumber:z,massNumber:z*2,charge:z,formedAt:0};const n=biology.create('atomic-nucleus',p);const i=biology.create('isotope',p);runtime.store.link(i.id,n.id,'contains')};
  make(20,2);make(40,4);make(45,4);
  const channels=[{reactants:[4,4],maxPerTick:1},{reactants:[2,4],maxPerTick:1}];
  assert.equal(biology.fuseIsotopes({fusionRadius:100,maxFusionSpeed:1,maxAtomicNumber:18,fusionProbability:1,fusionChannels:channels}),1);
  assert.ok([...runtime.store.entities.values()].some(e=>e.type==='isotope'&&e.properties.atomicNumber===8));
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==='isotope'&&e.properties.atomicNumber===6).length,0);
});

test("fusion channels enforce a deterministic run-wide product ceiling",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  for(const [x,z] of [[20,7],[30,8],[40,7],[50,8]]){const p={x,y:50,mass:z*2,protonCount:z,neutronCount:z,atomicNumber:z,massNumber:z*2,charge:z,formedAt:0};const n=biology.create('atomic-nucleus',p);const i=biology.create('isotope',p);runtime.store.link(i.id,n.id,'contains')}
  const channels=[{reactants:[7,8],maxPerTick:4,maxProducts:1}];
  assert.equal(biology.fuseIsotopes({fusionRadius:100,maxFusionSpeed:1,maxAtomicNumber:18,fusionProbability:1,fusionChannels:channels}),1);
  assert.equal(biology.fuseIsotopes({fusionRadius:100,maxFusionSpeed:1,maxAtomicNumber:18,fusionProbability:1,fusionChannels:channels}),0);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==='isotope'&&!e.parent&&e.properties.atomicNumber===15).length,1);
  const report=biology.diagnoseAtomicFusion({fusionRadius:100,maxFusionSpeed:1,minFusionAtomicNumber:2,atomizationDelay:100,fusionChannels:channels});
  assert.equal(report.channelCapacity['7+8'].remaining,0);
});

test("atomization diagnostics distinguish mature isotopes with and without nearby electrons",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  for(const [x,z] of [[20,6],[80,8]]){const p={x,y:50,mass:z*2,protonCount:z,neutronCount:z,atomicNumber:z,massNumber:z*2,charge:z,formedAt:0};const n=biology.create('atomic-nucleus',p);const i=biology.create('isotope',p);runtime.store.link(i.id,n.id,'contains')}
  biology.create('lepton',{x:20,y:50,leptonKind:'electron',charge:-1,mass:.0005},.05);
  runtime.scheduler.time=10;
  const report=biology.diagnoseAtomization({radius:10,atomizationDelay:10});
  assert.equal(report.matureIsotopes,2);
  assert.equal(report.atomizableIsotopes,1);
  assert.equal(report.waitingForElectrons,1);
  assert.equal(report.readyByElement.C,1);
  assert.equal(report.waitingByElement.O,1);
});

test("dense nucleon clouds partition into small proton-bearing seed nuclei",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  for(let i=0;i<4;i++)biology.create("proton",{x:50+i*.1,y:50,mass:1,charge:1},.1);
  for(let i=0;i<4;i++)biology.create("neutron",{x:50+i*.1,y:50.2,mass:1,charge:0},.1);
  assert.equal(biology.formNuclei({radius:10,maxNucleons:4,maxProtons:2}),2);
  const nuclei=[...runtime.store.entities.values()].filter(e=>e.type==='atomic-nucleus');
  assert.ok(nuclei.every(e=>e.properties.protonCount===2&&e.properties.neutronCount===2));
});

test("fusion skips an over-ceiling nearest isotope and chooses an eligible partner",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const make=(x,z)=>{const p={x,y:50,vx:0,vy:0,mass:z*2,protonCount:z,neutronCount:z,atomicNumber:z,massNumber:z*2,charge:z};const n=biology.create('atomic-nucleus',p);const i=biology.create('isotope',p);runtime.store.link(i.id,n.id,'contains');return i};
  const ten=make(40,10),twelve=make(41,12),two=make(52,2);
  assert.equal(biology.fuseIsotopes({fusionRadius:20,maxFusionSpeed:1,maxAtomicNumber:18,fusionProbability:1}),1);
  const fused=[...runtime.store.entities.values()].find(e=>e.type==='isotope'&&!e.parent);
  assert.equal(fused.properties.atomicNumber,12);
  assert.ok(runtime.store.get(twelve.id));
  assert.ok(!runtime.store.get(ten.id));
  assert.ok(!runtime.store.get(two.id));
});

test("fusion selection builds the lowest-Z eligible product before using distance",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const make=(x,z)=>{const p={x,y:50,vx:0,vy:0,mass:z*2,protonCount:z,neutronCount:z,atomicNumber:z,massNumber:z*2,charge:z};const n=biology.create('atomic-nucleus',p);const i=biology.create('isotope',p);runtime.store.link(i.id,n.id,'contains');return i};
  const hydrogen=make(40,1),heavy=make(41,5),helium=make(60,2);
  assert.equal(biology.fuseIsotopes({fusionRadius:30,maxFusionSpeed:1,maxAtomicNumber:10,fusionProbability:1}),1);
  const product=[...runtime.store.entities.values()].find(e=>e.type==='isotope'&&e.properties.atomicNumber===3);
  assert.ok(product);
  assert.ok(runtime.store.get(heavy.id));
  assert.ok(!runtime.store.get(hydrogen.id));
  assert.ok(!runtime.store.get(helium.id));
});

test("atomic fusion diagnostics distinguish proximity, speed and element-ceiling blockers",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:17});
  const makeIsotope=(x,z)=>{const nucleus=biology.create("atomic-nucleus",{x,y:0,protonCount:z,neutronCount:z,mass:z*2,atomicNumber:z,massNumber:z*2});const isotope=biology.create("isotope",{x,y:0,protonCount:z,neutronCount:z,mass:z*2,atomicNumber:z,massNumber:z*2});runtime.store.link(isotope.id,nucleus.id,"contains");return isotope};
  makeIsotope(0,2);makeIsotope(5,2);
  let report=biology.diagnoseAtomicFusion({fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:3});
  assert.equal(report.isotopeCount,2);
  assert.equal(report.pairsWithinRadius,1);
  assert.equal(report.eligibleFusionPairs,0);
  report=biology.diagnoseAtomicFusion({fusionRadius:2,maxFusionSpeed:1,maxAtomicNumber:18});
  assert.equal(report.pairsWithinRadius,0);
  assert.equal(report.nearestDistance,5);
  report=biology.diagnoseAtomicFusion({fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:10,minFusionAtomicNumber:2});
  assert.equal(report.eligibleFusionPairs,1);
  report=biology.diagnoseAtomicFusion({fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:10,minFusionAtomicNumber:3});
  assert.equal(report.eligibleFusionPairs,0);
});

test("fusion probability zero preserves nearby isotopes",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  for(const x of [48,52]){
    const properties={x,y:50,mass:2,protonCount:1,neutronCount:1,atomicNumber:1,massNumber:2,charge:1};
    const nucleus=biology.create("atomic-nucleus",properties,0);
    const isotope=biology.create("isotope",properties,0);
    runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
  }
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1,fusionProbability:0}),0);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="isotope"&&!e.parent).length,2);
});


test("hydrogen isotopes can enter the fusion pathway when no threshold is imposed",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  for(const x of [48,52]){
    const properties={x,y:50,mass:1,protonCount:1,neutronCount:1,atomicNumber:1,massNumber:2,charge:1};
    const nucleus=biology.create("atomic-nucleus",properties,0);
    const isotope=biology.create("isotope",properties,0);
    runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
  }
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:10}),1);
  const fused=[...runtime.store.entities.values()].find(e=>e.type==="isotope"&&!e.parent);
  assert.equal(fused.properties.atomicNumber,2);
  assert.equal(fused.properties.neutronCount,2);
});


test("nuclear fusion respects the supported element ceiling",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  for(const x of [48,52]){
    const properties={x,y:50,mass:4,protonCount:2,neutronCount:2,atomicNumber:2,massNumber:4,charge:2};
    const nucleus=biology.create("atomic-nucleus",properties,0);
    const isotope=biology.create("isotope",properties,0);
    runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
  }
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:3}),0);
  assert.equal([...runtime.store.entities.values()].filter(e=>e.type==="isotope"&&!e.parent).length,2);
});


test("simulation accretion keeps primordial seed nuclei below the configured element and mass caps",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const properties={x:50,y:50,mass:4,protonCount:2,neutronCount:2,atomicNumber:2,massNumber:4,charge:2};
  const nucleus=biology.create('atomic-nucleus',properties),isotope=biology.create('isotope',properties);runtime.store.link(isotope.id,nucleus.id,'contains');
  biology.create('proton',{x:51,y:50,mass:1,charge:1},.1);
  biology.create('neutron',{x:52,y:50,mass:1,charge:0},.1);
  assert.equal(biology.accreteNucleons({accretionRadius:10,maxAtomicNumber:2,maxMassNumber:4}),0);
  assert.equal(nucleus.properties.protonCount,2);
  assert.equal(nucleus.properties.neutronCount,2);
});

test("unatomized nuclei accrete nearby free nucleons without losing constituents",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const nucleus=biology.create("atomic-nucleus",{x:50,y:50,mass:4,protonCount:2,neutronCount:2,atomicNumber:2,massNumber:4,charge:2},0);
  const isotope=biology.create("isotope",{x:50,y:50,mass:4,protonCount:2,neutronCount:2,atomicNumber:2,massNumber:4,charge:2},0);
  runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
  const proton=biology.create("proton",{x:54,y:50,mass:3,charge:1},.1);
  assert.equal(biology.accreteNucleons({accretionRadius:10}),1);
  assert.equal(proton.parent,nucleus.id);
  assert.equal(nucleus.properties.protonCount,3);
  assert.equal(nucleus.properties.neutronCount,2);
  assert.equal(nucleus.properties.massNumber,5);
  assert.equal(isotope.properties.atomicNumber,3);
  assert.equal(isotope.properties.mass,7);
  assert.equal(runtime.store.descendants(isotope.id).includes(proton.id),true);
});

test("slow colliding isotopes fuse while preserving both nuclear fragments",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const make=(x,protons,neutrons)=>{
    const mass=protons+neutrons,nucleus=biology.create("atomic-nucleus",{x,y:50,vx:0,vy:0,mass,protonCount:protons,neutronCount:neutrons,atomicNumber:protons,massNumber:mass,charge:protons},0);
    const isotope=biology.create("isotope",{x,y:50,vx:0,vy:0,mass,protonCount:protons,neutronCount:neutrons,atomicNumber:protons,massNumber:mass,charge:protons},0);
    runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
    return{nucleus,isotope};
  };
  const a=make(48,1,1),b=make(52,1,2);
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1}),1);
  const product=[...runtime.store.entities.values()].find(e=>e.type==="isotope"&&!e.parent);
  const fusedNucleus=runtime.store.outgoing(product.id,"contains").map(id=>runtime.store.get(id)).find(e=>e?.type==="atomic-nucleus");
  assert.equal(product.properties.protonCount,2);
  assert.equal(product.properties.neutronCount,3);
  assert.equal(product.properties.massNumber,5);
  assert.equal(fusedNucleus.properties.mass,5);
  assert.deepEqual(new Set(runtime.store.outgoing(fusedNucleus.id,"contains")) ,new Set([a.nucleus.id,b.nucleus.id]));
  assert.equal(runtime.store.get(a.isotope.id),undefined);
  assert.equal(runtime.store.get(b.isotope.id),undefined);
});
test("nuclear fusion and atomisation support phosphorus with its electron shell",()=>{
  const runtime=createRuntime({width:100,height:100,cols:10,rows:10}),biology=new EmergenceProgression(runtime);
  const make=(x,z,n)=>{
    const properties={x,y:50,mass:z+n,protonCount:z,neutronCount:n,atomicNumber:z,massNumber:z+n,charge:z,formedAt:0};
    const nucleus=biology.create("atomic-nucleus",properties,0),isotope=biology.create("isotope",properties,0);
    runtime.store.transact([{op:"compose",parent:isotope.id,child:nucleus.id}]);
  };
  make(48,7,8);make(52,8,8);
  for(let i=0;i<15;i++)biology.create("lepton",{x:50+i*.01,y:50,leptonKind:"electron",charge:-1,mass:.0005},.01);
  assert.equal(biology.fuseIsotopes({fusionRadius:10,maxFusionSpeed:1,maxAtomicNumber:18,fusionProbability:1}),1);
  assert.equal(biology.formAtoms({radius:10}),1);
  const phosphorus=[...runtime.store.entities.values()].find(e=>e.type==="atom");
  assert.equal(phosphorus.properties.atomicNumber,15);
  assert.equal(phosphorus.properties.elementSymbol,"P");
  assert.equal(phosphorus.properties.elementName,"Phosphorus");
  assert.equal(phosphorus.properties.electronCount,15);
  assert.equal(phosphorus.properties.valenceElectrons,5);
  assert.equal(phosphorus.properties.maxCovalentBonds,5);
  assert.equal(runtime.energy.audit(runtime.store,.15).balanced,true);
});
