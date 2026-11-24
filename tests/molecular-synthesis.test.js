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

test("complementary monomers can form a multi-unit polymer chain",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:31});
  for(const [i,monomerKind] of ["A","U","A","U"].entries())biology.create("monomer",{x:20+i*2,y:20,monomerKind,mass:1,valence:2},.1);
  const bonds=biology.formChemicalBonds({types:["monomer"],radius:3,rate:10,dt:1,energyCost:0,activationEnergy:0,complementary:true});
  assert.equal(bonds,3);
  assert.equal(biology.polymerize({minLength:3,energyCost:0}),1);
  const polymer=[...runtime.store.entities.values()].find(e=>e.type==="polymer");
  assert.deepEqual(polymer.properties.sequence,["A","U","A","U"]);
  assert.equal(runtime.store.descendants(polymer.id).length,4);
});


test("polymer sequence follows bond topology rather than entity creation order",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:61});
  const a=biology.create("monomer",{x:0,y:0,monomerKind:"A",mass:1});
  const u=biology.create("monomer",{x:1,y:0,monomerKind:"U",mass:1});
  const c=biology.create("monomer",{x:2,y:0,monomerKind:"C",mass:1});
  const g=biology.create("monomer",{x:3,y:0,monomerKind:"G",mass:1});
  runtime.store.link(a.id,c.id,"bond");runtime.store.link(c.id,u.id,"bond");runtime.store.link(u.id,g.id,"bond");
  assert.equal(biology.polymerize({minLength:3,energyCost:0}),1);
  const polymer=[...runtime.store.entities.values()].find(entity=>entity.type==="polymer");
  assert.deepEqual(polymer.properties.sequence,["A","C","U","G"]);
  assert.equal(polymer.properties.topology,"linear");
  assert.equal(polymer.properties.bondCount,3);
  assert.deepEqual(runtime.store.descendants(polymer.id),[a.id,c.id,u.id,g.id]);
});

test("branched monomer clusters are not misrepresented as linear polymers",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:67});
  const monomers=["A","U","A","U"].map((kind,i)=>biology.create("monomer",{x:i,y:0,monomerKind:kind,mass:1}));
  runtime.store.link(monomers[0].id,monomers[1].id,"bond");runtime.store.link(monomers[1].id,monomers[2].id,"bond");runtime.store.link(monomers[1].id,monomers[3].id,"bond");
  assert.equal(biology.polymerize({minLength:3,energyCost:0}),0);
  assert.equal([...runtime.store.entities.values()].filter(entity=>entity.type==="polymer").length,0);
});

test("atomic feedstock can synthesize amphiphiles that assemble into a membrane and vesicle",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:41});
  const centers=Array.from({length:8},(_,i)=>({x:80+Math.cos(i*Math.PI/4)*8,y:80+Math.sin(i*Math.PI/4)*8}));
  for(const center of centers) {
    for(let i=0;i<8;i++)biology.create("atom",{x:center.x+(i%4)*.03,y:center.y+Math.floor(i/4)*.03,atomicNumber:6,elementSymbol:"C",mass:12});
    for(let i=0;i<16;i++)biology.create("atom",{x:center.x+(i%4)*.025,y:center.y+Math.floor(i/4)*.025+.2,atomicNumber:1,elementSymbol:"H",mass:1});
    for(let i=0;i<2;i++)biology.create("atom",{x:center.x+i*.03,y:center.y-.2,atomicNumber:8,elementSymbol:"O",mass:16});
  }
  assert.equal(biology.assembleAmphiphiles({radius:3}),8);
  const lipids=[...runtime.store.entities.values()].filter(e=>e.type==="lipid");
  assert.equal(lipids.length,8);
  assert.ok(lipids.every(e=>e.properties.formula==="C8H16O2"&&e.properties.headPolarity>.5&&e.properties.tailHydrophobicity>.5));
  assert.equal(biology.selfAssembleMembranes({radius:18,minLipids:8}),1);
  assert.equal(biology.formVesiclesFromMembranes(),1);
  assert.equal(biology.metrics.membranes,1);
  assert.equal(biology.metrics.vesicles,1);
});

test("atomic feedstock produces nucleobase analogues that polymerise into an information chain",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:53});
  const addCluster=(x,kind)=>{
    const counts=kind==="A"?{6:5,1:5,7:5,8:0}:{6:4,1:4,7:2,8:2};
    for(const [atomicNumber,count] of Object.entries(counts))for(let i=0;i<count;i++)biology.create("atom",{x:x+(i%5)*.03,y:30+Math.floor(i/5)*.03,atomicNumber:Number(atomicNumber),mass:atomicNumber==="1"?1:atomicNumber==="6"?12:atomicNumber==="7"?14:16});
  };
  for(const [x,kind] of [[20,"A"],[26,"A"],[32,"A"],[23,"U"],[29,"U"],[35,"U"]])addCluster(x,kind);
  assert.equal(biology.assembleNucleobaseMonomers({radius:1}),6);
  const monomers=[...runtime.store.entities.values()].filter(e=>e.type==="monomer");
  assert.equal(monomers.length,6);
  assert.ok(monomers.every(e=>e.properties.sugarBackbone===false&&e.properties.phosphateGroups===0));
  let bonds=0;
  for(let i=0;i<6;i++)bonds+=biology.formChemicalBonds({types:["monomer"],radius:4,rate:10,dt:1,energyCost:0,activationEnergy:0});
  assert.ok(bonds>=5);
  assert.equal(biology.polymerize({monomerTypes:["monomer"],minLength:3,energyCost:0}),1);
  const polymer=[...runtime.store.entities.values()].find(e=>e.type==="polymer");
  assert.equal(polymer.properties.length,6);
  assert.equal(polymer.properties.polymerClass,"nucleobase-analogue-chain");
  assert.equal(polymer.properties.backboneType,"base-only");
  assert.equal(polymer.properties.translationEligible,false);
  assert.equal(runtime.store.descendants(polymer.id).filter(id=>runtime.store.get(id)?.type==="monomer").length,6);
  assert.deepEqual(biology.translateAllRNA(),[]);
});

test("nearby translated proteins can organise into a catalytic network",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:59});
  biology.create("polymer",{x:20,y:20,sequence:["A","U","A","U","A","U"],mass:6,length:6},1);
  biology.create("polymer",{x:22,y:20,sequence:["C","U","C","U","C","U"],mass:6,length:6},1);
  assert.equal(biology.translateAllRNA().length,2);
  assert.equal(biology.assembleAutocatalyticNetworks({radius:8,minimumCatalyticEfficiency:.2}),1);
  const network=[...runtime.store.entities.values()].find(e=>e.type==="autocatalytic-network");
  assert.equal(network.properties.memberCount,2);
  assert.equal(runtime.store.descendants(network.id).filter(id=>runtime.store.get(id)?.type==="protein").length,2);
});
test("ribose and phosphoric-acid precursors assemble from C/H/O and P/H/O atoms",()=>{
  const runtime=createRuntime(),biology=new EmergenceProgression(runtime,{seed:73});
  const add=(x,z,count,mass)=>{for(let i=0;i<count;i++)biology.create("atom",{x:x+(i%4)*.02,y:40+Math.floor(i/4)*.02,atomicNumber:z,elementSymbol:({1:"H",6:"C",7:"N",8:"O",15:"P"})[z],mass});};
  add(10,6,5,12);add(10,8,5,16);add(10,1,10,1);
  add(40,6,5,12);add(40,1,5,1);add(40,7,5,14);
  add(70,15,1,31);add(70,8,4,16);add(70,1,3,1);
  assert.equal(biology.assembleRibose({radius:5}),1);
  assert.equal(biology.assembleNucleobaseMonomers({radius:5}),1);
  assert.equal(biology.assemblePhosphoricAcid({radius:5}),1);
  const sugar=[...runtime.store.entities.values()].find(e=>e.type==="sugar");
  const phosphate=[...runtime.store.entities.values()].find(e=>e.type==="phosphoric-acid");
  assert.equal(sugar.properties.formula,"C5H10O5");
  assert.equal(runtime.store.descendants(sugar.id).length,20);
  assert.equal(phosphate.properties.formula,"H3PO4");
  assert.equal(runtime.store.descendants(phosphate.id).length,8);
  assert.equal(biology.assembleNucleotidePrecursors({radius:40}),1);
  const precursor=[...runtime.store.entities.values()].find(e=>e.type==="nucleotide-precursor");
  assert.ok(precursor);
  assert.equal(precursor.properties.condensationRequired,true);
  assert.equal(precursor.properties.sugarBackbone,false);
  assert.equal(precursor.properties.backboneType,"uncondensed");
  assert.equal(runtime.store.outgoing(precursor.id,"contains").length,3);
  assert.equal(biology.polymerize({monomerTypes:["monomer"],minLength:2,energyCost:0}),0);
});
