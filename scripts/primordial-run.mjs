#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {EmergenceProgression} from '../src/emergence.js';

const html=readFileSync(new URL('../accretion.html',import.meta.url),'utf8');
const start=html.indexOf('<script type="module">')+'<script type="module">'.length;
const end=html.indexOf('</script>',start);
const inline=start>=0&&end>=start?html.slice(start,end):null;
if(!inline) throw new Error('Could not locate the simulation runtime source in accretion.html');
const runtimeSource=inline.split("import('./src/emergence.js')")[0];
const {createRuntime}=await import('data:text/javascript;base64,'+Buffer.from(runtimeSource).toString('base64'));

const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const [k,...v]=arg.replace(/^--/,'').split('=');return[k,v.join('=')]}));
const seed=Number(args.seed??20261115)>>>0;
const steps=Math.max(1,Math.floor(Number(args.steps??12000)));
const sampleEvery=Math.max(1,Math.floor(Number(args.sampleEvery??300)));
const spread=Math.max(.01,Math.min(1,Number(args.spread??1)));
const fusionProbability=Math.max(0,Math.min(1,Number(args.fusionProbability??.01)));
const fusionRadius=Math.max(1,Number(args.fusionRadius??80));
const atomizationDelay=Math.max(0,Number(args.atomizationDelay??180));
const populationScale=Math.max(.1,Number(args.populationScale??1));
const output=args.output||'';
const W=14700,H=29115,scale=15,distance=n=>n*scale,velocity=n=>n*scale;
const sim=createRuntime({width:W,height:H,cols:120,rows:68,cellSize:distance(24),constraintIterations:2});
const biology=new EmergenceProgression(sim,{seed});
sim.fields.add('stimulus',W*.5,H*.5,.8);
sim.interactions.register({id:'long-range-cohesion',a:'*',b:'*',radius:distance(150),strength:.045,mode:'attract'})
 .register({id:'atomic-condensation',a:'atom',b:'atom',radius:distance(420),strength:.012,mode:'attract'})
 .register({id:'short-range-exclusion',a:'*',b:'*',radius:distance(10),strength:.28,mode:'repel'});
const spawn=(type,properties,energy)=>biology.create(type,{x:W*(.5+(biology.rng.next()-.5)*spread),y:H*(.5+(biology.rng.next()-.5)*spread),vx:(biology.rng.next()-.5)*velocity(.12),vy:(biology.rng.next()-.5)*velocity(.12),...properties},energy);
for(let i=0;i<Math.round(120*populationScale);i++)spawn('quark',{flavor:'up',colorCharge:['red','green','blue'][i%3],charge:2/3,mass:1},.1);
for(let i=0;i<Math.round(120*populationScale);i++)spawn('quark',{flavor:'down',colorCharge:['red','green','blue'][i%3],charge:-1/3,mass:1},.1);
for(let i=0;i<Math.round(240*populationScale);i++)spawn('gluon',{colorCharge:['red-antigreen','red-antiblue','green-antired','green-antiblue','blue-antired','blue-antigreen'][i%6],mass:.1},.01);
for(let i=0;i<Math.round(80*populationScale);i++)spawn('lepton',{leptonKind:'electron',charge:-1,mass:.0005},.05);
const initialEnergy=sim.energy.inventory(sim.store).total;

const symbols={1:'H',2:'He',3:'Li',4:'Be',5:'B',6:'C',7:'N',8:'O',15:'P',16:'S'};
const countTypes=()=>{const out={};for(const e of sim.store.entities.values())if(e.state==='active'||e.state==='bound')out[e.type]=(out[e.type]||0)+1;return out};
function atomInventory(){
 const all=[...sim.store.entities.values()].filter(e=>e.type==='atom'&&(e.state==='active'||e.state==='bound'));
 const free=all.filter(e=>!e.parent),counts={},freeCounts={};
 for(const e of all){const z=e.properties.atomicNumber,k=symbols[z]||String(z);counts[k]=(counts[k]||0)+1;if(!e.parent)freeCounts[k]=(freeCounts[k]||0)+1}
 return{all:counts,free:freeCounts,total:all.length,freeTotal:free.length};
}
function pathwaySnapshot(step,atomic={},chemistry={}){
 const types=countTypes(),atoms=atomInventory(),pathway=biology.diagnosePrimordialPathway({radius:distance(48),initialEnergy}),availability=pathway.atoms.availability,atomicFusion=biology.diagnoseAtomicFusion({fusionRadius:distance(fusionRadius),maxFusionSpeed:velocity(3),maxAtomicNumber:18});
 const products=pathway.products;
 const stage={
  elements:{carbon:atoms.all.C||0,nitrogen:atoms.all.N||0,oxygen:atoms.all.O||0,phosphorus:atoms.all.P||0},
  freeElements:{carbon:atoms.free.C||0,nitrogen:atoms.free.N||0,oxygen:atoms.free.O||0,phosphorus:atoms.free.P||0},
  feedstock:{global:availability.globallyPossible,localClusters:availability.localClusters,freeAtomsByElement:availability.freeAtomsByElement},pathwayDiagnostics:pathway,
  products,atomicFusion,atomicEvents:atomic,chemistryEvents:chemistry,
  blockers:pathway.blockers,
  energy:sim.energy.inventory(sim.store),energyAudit:sim.energy.audit(sim.store,initialEnergy),
  entities:types,metrics:biology.metrics
 };
 return{step,...stage};
}
const snapshots=[];
for(let step=1;step<=steps;step++){
 sim.step(1);
 biology.applyElectrostatics({radius:distance(180),strength:3,softening:8,maxAcceleration:.04,dt:1});
 biology.applyNuclearAttraction({radius:distance(32),range:distance(12),strength:.08,maxAcceleration:.04,dt:1});
 if(step%4===0)biology.exchangeThermalEnergy({radius:distance(26),conductance:.025,dt:1});
 let atomic={},chemistry={};
 if(step%2===0){
  const before=sim.store.entities.size;
  chemistry=biology.assembleMolecularMatter({radius:distance(48),waterRadius:distance(48),organicRadius:distance(48),amphiphileRadius:distance(48),monomerRadius:distance(48),riboseRadius:distance(48),phosphateRadius:distance(48),nucleotideRadius:distance(48),condensationRadius:distance(48),phosphodiesterRadius:distance(48),bondRadius:distance(24),bondRate:.22,bondEnergyCost:.0005,polymerEnergyCost:.002,dt:1});
  biology.selfAssembleMicelles({radius:distance(12),minLipids:3,maxLipids:7});
  biology.selfAssembleMembranes({radius:distance(18),minLipids:8,permeability:.15});
  biology.formVesiclesFromMembranes();
  biology.formProtocellsFromAssemblies({radius:distance(14)});
  const afterChem=sim.store.entities.size;
  sim.spatial.rebuild(sim.store.entities.values());
  atomic=biology.assembleAtomicMatter({hadronRadius:distance(24),nuclearRadius:distance(16),atomRadius:distance(90),fusionRadius:distance(fusionRadius),maxFusionSpeed:velocity(3),fusionProbability,maxAtomicNumber:18,atomizationDelay});
  const afterAtomic=sim.store.entities.size;
  chemistry.entityDelta=afterChem-before;atomic.entityDelta=afterAtomic-afterChem;
 }
 biology.tick(1);
 for(const e of sim.store.entities.values()){
  if(e.state!=='active'&&e.state!=='bound')continue;
  const p=e.properties;p.vx=(Number(p.vx)||0)*.994;p.vy=(Number(p.vy)||0)*.994;
  if(p.x<0||p.x>W)p.vx*=-.8;if(p.y<0||p.y>H)p.vy*=-.8;
  p.x=Math.max(0,Math.min(W,p.x));p.y=Math.max(0,Math.min(H,p.y));
  sim.energy.source(e,.00008);if(step%3===0)sim.energy.dissipate(e,.00008);
 }
 if(step%sampleEvery===0||step===steps){const s=pathwaySnapshot(step,atomic,chemistry);snapshots.push(s);process.stdout.write(JSON.stringify(s)+'\n')}
}
const result={seed,steps,sampleEvery,spread,fusionProbability,fusionRadius,atomizationDelay,populationScale,initialEnergy,snapshots,final:snapshots.at(-1)};
if(output)writeFileSync(output,JSON.stringify(result,null,2)+'\n');
