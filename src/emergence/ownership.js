import {finite,idOf} from './shared.js';
export class StateOwner {
  constructor(runtime,contracts,dependencies=null){this.runtime=runtime;this.store=runtime.store;this.energy=runtime.energy;this.fields=runtime.fields;this.contracts=contracts;this.dependencies=dependencies}
  create(type,properties={},energy=0){const p=this.contracts.defaults(type,properties);this.contracts.assert(type,p);if(!Number.isFinite(energy)||energy<0)throw Error("Entity energy must be finite and non-negative");return this.store.create(type,p,{energy})}
  patch(id,patch){if(!patch||typeof patch!=="object"||Array.isArray(patch))throw Error("A property patch must be an object");if(Object.hasOwn(patch,"energy")||Object.hasOwn(patch,"quantities"))throw Error("Energy and material inventories have dedicated owners");const actions=Object.entries(patch).map(([key,value])=>({op:"set",id,key,value}));const result=this.store.transact(actions);if(!result.ok)throw result.error;return this.store.get(id)}
  transfer(from,to,amount){return this.energy.transfer(this.store.get(idOf(from)),this.store.get(idOf(to)),amount)}
  material(entity,key,delta,unit){const id=idOf(entity),result=this.store.transact([{op:"material",id,key,delta,unit}],{energy:this.energy,fields:this.fields});if(!result.ok)throw result.error;return this.energy.quantity(this.store.get(id),key)}
  transferMaterial(from,to,key,amount,unit){const result=this.store.transact([{op:"transfer-material",from:idOf(from),to:idOf(to),key,amount,unit}],{energy:this.energy,fields:this.fields});if(!result.ok)throw result.error;return this.energy.quantity(this.store.get(idOf(to)),key)}
  deposit(field,entity,amount){return this.energy.deposit(field,this.store.get(idOf(entity)),amount)}
  harvest(field,entity,amount){return this.energy.harvest(field,this.store.get(idOf(entity)),amount)}
  relate(a,b,type="bond",properties={}){this.store.link(idOf(a),idOf(b),type,properties);return this}
  remove(id,discardEnergy=false){const result=this.store.transact([{op:"remove",id,discardEnergy}],{energy:this.energy,fields:this.fields});if(!result.ok)throw result.error;return true}
}
