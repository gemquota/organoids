import {finite,copy,freeze,active} from './shared.js';
import {SeededRandom} from './random.js';
import {ContractRegistry,ModuleContractRegistry} from './contracts.js';
import {LineageJournal} from './lineage.js';
import {LifecycleEngine} from './lifecycle.js';
import {DeterministicEventQueue,EventRuleRouter} from './events.js';
import {StateOwner} from './ownership.js';
import {AtomicExecutor} from './execution.js';
import {methods as aggregation} from './aggregation.js';
import {methods as molecular} from './molecular.js';
import {methods as membranes} from './membranes.js';
import {methods as heredity} from './heredity.js';
import {methods as organismal} from './organismal.js';
import {methods as development} from './development.js';
export class EmergenceProgression {
  constructor(runtime,options={}){if(!runtime?.store||!runtime?.energy)throw Error("A complete runtime is required");this.runtime=runtime;this.store=runtime.store;this.energy=runtime.energy;this.rng=options.random||new SeededRandom(options.seed||1);this.contracts=new ContractRegistry();this.owner=new StateOwner(runtime,this.contracts);this.executor=new AtomicExecutor(runtime);this.modules=new ModuleContractRegistry();this.eventQueue=new DeterministicEventQueue(options.eventCapacity);this.eventRouter=new EventRuleRouter(runtime,this.eventQueue,this.executor);this.lineage=new LineageJournal(options.historyCapacity);this.lifecycle=new LifecycleEngine(runtime,this.lineage);this._defineContracts()}
  get metrics(){const l=this.lineage;return freeze({aggregations:l.total("aggregation","bonds"),bonds:l.count("bonding"),molecules:l.count("molecular-formation"),polymers:l.count("polymerisation"),networks:l.count("autocatalytic-network"),membranes:l.count("membrane-assembly"),protocells:l.count("protocell-formation"),replications:l.count("replication"),reproductions:l.count("reproduction"),colonies:l.count("colony-formation"),differentiations:l.count("differentiation"),morphogenesis:l.count("morphogenesis")})}
  _defineContracts(){this.contracts
    .define("particle",{mass:{type:"number",min:0,default:1},x:{type:"number"},y:{type:"number"}})
    .define("monomer",{monomerKind:{type:"string",required:true},mass:{type:"number",min:0,default:1}})
    .define("polymer",{sequence:{type:"array",required:true},mass:{type:"number",min:0,default:0}})
    .define("lipid",{headPolarity:{type:"number",min:0,max:1,default:1},tailHydrophobicity:{type:"number",min:0,max:1,default:1}})
    .define("membrane",{permeability:{type:"number",min:0,max:1,default:.2},lipidCount:{type:"number",min:3,default:8}})
    .define("protocell",{genome:{type:"object",required:true},age:{type:"number",min:0,default:0},biomass:{type:"number",min:0,default:1}})
    .define("cell",{genome:{type:"object",required:true},age:{type:"number",min:0,default:0},biomass:{type:"number",min:0,default:1},lifeStage:{type:"string",default:"nascent"}})}
  create(type,properties={},energy=0){return this.owner.create(type,properties,Math.max(0,finite(energy)))}
  _record(kind,data){return this.lineage.record(kind,{time:this.runtime.scheduler.time,...data})}
  tick(dt=1){for(const e of this.store.entities.values())if(active(e)&&e.properties.genome){this.lifecycle.age(e.id,dt);const age=finite(e.properties.age),maxAge=finite(e.properties.maxAge,1000);if(age>maxAge&&this.lifecycle.stage(e)!=="dead")this.lifecycle.transition(e.id,"senescent","age threshold")}return this}
  snapshot(){return{random:this.rng.snapshot?.(),metrics:copy(this.metrics),events:copy(this.lineage.events),parents:[...this.lineage.parents].map(([id,parents])=>[id,parents.slice()]),children:[...this.lineage.children].map(([id,children])=>[id,children.slice()]),eventQueue:this.eventQueue.snapshot(),sequence:this.lineage.sequence}}
  statistics(){const entities=[...this.store.entities.values()].filter(active),byType={};for(const e of entities)byType[e.type]=(byType[e.type]||0)+1;return{entities:entities.length,byType,metrics:copy(this.metrics),lineageEvents:this.lineage.sequence,meanAge:entities.length?entities.reduce((s,e)=>s+finite(e.properties.age),0)/entities.length:0,meanBiomass:entities.length?entities.reduce((s,e)=>s+finite(e.properties.biomass),0)/entities.length:0,typeDiversity:Object.values(byType).length?Object.values(byType).reduce((h,n)=>{const p=n/entities.length;return h-p*Math.log(p)},0):0}}
}
Object.assign(EmergenceProgression.prototype,aggregation,molecular,membranes,heredity,organismal,development);
