import {active,finite} from './shared.js';
export class LifecycleEngine {
  constructor(runtime,journal){this.runtime=runtime;this.store=runtime.store;this.journal=journal;this.transitions=new Map([
    ["nascent",new Set(["growing","dormant","senescent","dead"])],
    ["growing",new Set(["mature","dormant","senescent","dead"])],
    ["mature",new Set(["growing","reproducing","dormant","senescent","dead"])],
    ["reproducing",new Set(["mature","senescent","dead"])],
    ["dormant",new Set(["growing","mature","senescent","dead"])],
    ["senescent",new Set(["dead"])],["dead",new Set()]
  ])}
  stage(entity){return entity?.properties?.lifeStage||"nascent"}
  transition(id,next,reason=""){const e=this.store.get(id);if(!e)throw Error("Unknown entity "+id);const from=this.stage(e);if(from===next)return false;if(!this.transitions.get(from)?.has(next))throw Error("Invalid lifecycle transition "+from+" -> "+next);const actions=[{op:"set",id,key:"lifeStage",value:next},{op:"set",id,key:"lifeStageChanged",value:{from,to:next,reason}}];if(next==="dead")actions.push({op:"state",id,state:"inactive"});const result=this.store.transact(actions);if(!result.ok)throw result.error;this.journal?.record("lifecycle",{entity:id,from,to:next,reason,time:this.runtime.scheduler.time});return true}
  age(id,dt){const e=this.store.get(id);if(!e||!active(e))return 0;const age=finite(e.properties.age)+Math.max(0,dt);const r=this.store.transact([{op:"set",id,key:"age",value:age}]);if(!r.ok)throw r.error;return age}
}
