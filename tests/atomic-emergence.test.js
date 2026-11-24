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
