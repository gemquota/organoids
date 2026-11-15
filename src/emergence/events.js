import {freeze,finite,copy} from './shared.js';
export class DeterministicEventQueue {
  constructor(capacity=8192){this.capacity=Math.max(1,capacity|0);this.sequence=0;this.pending=[]}
  emit(type,payload={},phase=0){if(typeof type!=="string"||!type)throw Error("Event type is required");if(this.pending.length>=this.capacity)throw Error("Event queue capacity exceeded");const event=freeze({sequence:++this.sequence,type,phase:Math.floor(finite(phase)),payload:copy(payload)});this.pending.push(event);return event}
  peek(phase=0){return this.pending.filter(e=>e.phase<=phase)}
  acknowledge(sequence){const i=this.pending.findIndex(e=>e.sequence===sequence);if(i<0)return false;this.pending.splice(i,1);return true}
  snapshot(){return{sequence:this.sequence,pending:copy(this.pending)}}
  restore(snapshot){this.sequence=snapshot.sequence;this.pending=copy(snapshot.pending);return this}
}

export class EventRuleRouter {
  constructor(runtime,queue,executor){this.runtime=runtime;this.queue=queue;this.executor=executor;this.handlers=new Map();this.order=0;this.dispatching=false}
  on(type,handler,priority=0){if(typeof handler!=="function")throw Error("Event handler must be a function");if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push({handler,priority,order:this.order++});this.handlers.get(type).sort((a,b)=>a.priority-b.priority||a.order-b.order);return this}
  dispatch(phase=0){if(this.dispatching)throw Error("Nested event dispatch is not permitted");this.dispatching=true;let processed=0;try{const batch=this.queue.peek(phase);for(const event of batch){const actions=[];for(const item of this.handlers.get(event.type)||[]){const proposed=item.handler(event,{runtime:this.runtime,phase});if(proposed==null)continue;if(!Array.isArray(proposed))throw Error("Event handlers must return action arrays");actions.push(...proposed)}if(actions.length)this.executor.execute(actions,{label:"event:"+event.type});this.queue.acknowledge(event.sequence);processed++}return processed}finally{this.dispatching=false}}
}
