import {copy} from './shared.js';

export class RuntimeTickTransaction {
  constructor(runtime,options={}){if(!runtime?.store||!runtime?.energy||!runtime?.fields)throw Error("A transactional runtime is required");this.runtime=runtime;this.maxEntities=options.maxEntities??100000;this.sequence=0;this.busy=false;this.participants=[]}
  registerParticipant(snapshot,restore){if(typeof snapshot!=="function"||typeof restore!=="function")throw Error("A checkpoint participant needs snapshot and restore functions");this.participants.push({snapshot,restore});return this}
  run(operation,label="tick"){
    if(this.busy)throw Error("Nested runtime tick transactions are not permitted");
    if(typeof operation!=="function")throw Error("A tick operation is required");
    const r=this.runtime,store=r.store,entities=new Map(store.entities),snapshot=store.snapshot();
    if(entities.size>this.maxEntities)throw Error("Runtime checkpoint entity limit exceeded");
    const fieldArrays=new Map([...r.fields.fields].map(([name,array])=>[name,Float32Array.from(array)]));
    const fieldTotals=new Map(r.fields.totals),fieldWrites=new Map(r.fields.writeCounts);
    const participantStates=this.participants.map(p=>p.snapshot()),ledger=copy(r.energy.ledger),scheduler={time:r.scheduler.time,tick:r.scheduler.tick};
    const constraints=copy(r.constraints?.constraints||[]),ruleEvents=copy(r.rules?.events||[]);
    const ruleSequence=r.rules?.sequence,eventsLength=r.rules?.events?.length;
    this.busy=true;
    try{const value=operation();this.sequence++;return{ok:true,value,sequence:this.sequence,label}}
    catch(error){
      for(const[id,entity]of entities){
        const saved=snapshot.entities.find(x=>x.id===id);if(!saved)continue;
        for(const key of Object.keys(entity.properties))delete entity.properties[key];
        Object.assign(entity.properties,copy(saved.properties));
        entity.state=saved.state;entity.energy=saved.energy;entity.parent=saved.parent;
        entity.children.splice(0,entity.children.length,...saved.children);
        if(saved.quantities){entity.quantities||={};for(const k of Object.keys(entity.quantities))delete entity.quantities[k];Object.assign(entity.quantities,copy(saved.quantities))}else delete entity.quantities;
        if(saved.quantityUnits){entity.quantityUnits||={};for(const k of Object.keys(entity.quantityUnits))delete entity.quantityUnits[k];Object.assign(entity.quantityUnits,copy(saved.quantityUnits))}else delete entity.quantityUnits;
      }
      store.entities.clear();for(const[id,entity]of entities)store.entities.set(id,entity);
      const restored=store.constructor.restore(snapshot);
      store.next=restored.next;store.nextEdge=restored.nextEdge;store.kinds=restored.kinds;
      store._linkLog=restored._linkLog;store.activeLinks=restored.activeLinks;
      store.out=restored.out;store.in=restored.in;store.adj=restored.adj;
      for(const name of [...r.fields.fields.keys()])if(!fieldArrays.has(name)){r.fields.fields.delete(name);r.fields.meta.delete(name)}
      for(const[name,values]of fieldArrays){const array=r.fields.fields.get(name);if(array)array.set(values)}
      r.fields.totals=new Map(fieldTotals);r.fields.writeCounts=new Map(fieldWrites);r.fields.journal=null;
      r.energy.restoreLedger(ledger);r.scheduler.time=scheduler.time;r.scheduler.tick=scheduler.tick;
      if(r.constraints)r.constraints.constraints=constraints;
      if(r.rules?.events){r.rules.events.splice(0,r.rules.events.length,...ruleEvents);if(ruleSequence!==undefined)r.rules.sequence=ruleSequence}
      for(let i=this.participants.length-1;i>=0;i--)this.participants[i].restore(participantStates[i]);
      throw error;
    }finally{this.busy=false}
  }
}
