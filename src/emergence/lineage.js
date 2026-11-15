import {copy,freeze,finite,idOf} from './shared.js';
export class LineageJournal {
  constructor(capacity=100000){this.capacity=Math.max(1,capacity|0);this.sequence=0;this.events=[];this.parents=new Map();this.children=new Map();this.counts=new Map();this.totals=new Map()}
  record(kind,data={}){const event=freeze({sequence:++this.sequence,kind,time:finite(data.time),...copy(data)});this.events.push(event);this.counts.set(kind,this.count(kind)+1);for(const [key,value]of Object.entries(event))if(typeof value==="number"&&Number.isFinite(value)){const metric=kind+":"+key;this.totals.set(metric,(this.totals.get(metric)||0)+value)}if(this.events.length>this.capacity)this.events.splice(0,this.events.length-this.capacity);for(const child of event.children||event.outputs||[]){const id=idOf(child);if(Number.isInteger(id)){const parentIds=(event.parents||event.inputs||[]).map(idOf).filter(Number.isInteger);this.parents.set(id,parentIds);for(const p of parentIds){if(!this.children.has(p))this.children.set(p,[]);this.children.get(p).push(id)}}}return event}
  count(kind){return this.counts.get(kind)||0}
  total(kind,key){return this.totals.get(kind+":"+key)||0}
  ancestors(id){const out=[],seen=new Set(),visit=n=>{for(const p of this.parents.get(n)||[])if(!seen.has(p)){seen.add(p);out.push(p);visit(p)}};visit(id);return out}
  descendants(id){const out=[],seen=new Set(),visit=n=>{for(const c of this.children.get(n)||[])if(!seen.has(c)){seen.add(c);out.push(c);visit(c)}};visit(id);return out}
  history(id){return this.events.filter(e=>(e.parents||e.inputs||[]).some(x=>idOf(x)===id)||(e.children||e.outputs||[]).some(x=>idOf(x)===id)||e.entity===id)}
}
