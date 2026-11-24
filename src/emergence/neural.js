import {clamp,finite,active} from './shared.js';

export const methods={
  formNervousSystem(organId,options={}) {
    const organ=this.store.get(organId);
    if(!organ||organ.type!=='organ')throw Error('Nervous-system formation requires an organ');
    const existing=this.store.outgoing(organId,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='nervous-system');
    if(existing)return existing;
    const descendants=this.store.descendants(organId).map(id=>this.store.get(id)).filter(Boolean);
    const tissues=descendants.filter(e=>e.type==='tissue'&&['neural','sensory'].includes(e.properties.role));
    const neurons=descendants.filter(e=>(e.type==='cell'||e.type==='protocell')&&['neural','sensory'].includes(e.properties.phenotype));
    const units=tissues.length?tissues:neurons;
    if(units.length<1)return null;
    const x=finite(organ.properties.x),y=finite(organ.properties.y);
    const actions=[{op:'create',type:'nervous-system',properties:{x,y,neuronCount:neurons.length||units.reduce((n,e)=>n+finite(e.properties.cellCount),0),catalogueId:'nervous-systems',name:'Nervous system',categoryId:'organisms',catalogueColor:'#c4a0ed'},energy:0,as:'nervous'}];
    for(const unit of units)actions.push({op:'compose',parent:{ref:'nervous'},child:unit.id});
    actions.push({op:'compose',parent:organId,child:{ref:'nervous'}});
    const result=this.store.transact(actions);
    if(!result.ok)throw result.error;
    const nervous=this.store.get(result.refs.nervous);
    this._record('nervous-system-formation',{parents:units.map(e=>e.id),children:[nervous.id],neuronCount:nervous.properties.neuronCount});
    return nervous;
  },

  formBrain(nervousId,options={}) {
    const nervous=this.store.get(nervousId);
    if(!nervous||nervous.type!=='nervous-system')throw Error('Brain formation requires a nervous system');
    const existing=this.store.outgoing(nervousId,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='brain');
    if(existing)return existing;
    const neurons=this.store.descendants(nervousId).map(id=>this.store.get(id)).filter(e=>(e?.type==='cell'||e?.type==='protocell')&&['neural','sensory'].includes(e.properties.phenotype));
    const count=Math.max(neurons.length,finite(nervous.properties.neuronCount));
    if(count<4)return null;
    const parentId=nervous.parent,x=finite(nervous.properties.x),y=finite(nervous.properties.y);
    const actions=[{op:'create',type:'brain',properties:{x,y,neuronCount:count,networkSize:count,catalogueId:'brains',name:'Brain',categoryId:'organisms',catalogueColor:'#c4a0ed'},energy:0,as:'brain'},{op:'compose',parent:{ref:'brain'},child:nervousId}];
    if(parentId)actions.push({op:'compose',parent:parentId,child:{ref:'brain'}});
    const result=this.store.transact(actions);
    if(!result.ok)throw result.error;
    const brain=this.store.get(result.refs.brain);
    this._record('brain-formation',{parents:[nervousId],children:[brain.id],neuronCount:count});
    return brain;
  },

  formCognition(brainId,options={}) {
    const brain=this.store.get(brainId);
    if(!brain||brain.type!=='brain')throw Error('Cognition requires a brain');
    const existing=this.store.outgoing(brainId,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='cognition');
    if(existing)return existing;
    const neurons=this.store.descendants(brainId).map(id=>this.store.get(id)).filter(e=>(e?.type==='cell'||e?.type==='protocell')&&['neural','sensory'].includes(e.properties.phenotype));
    const activity=finite(brain.properties.activity);
    if(neurons.length<4||activity<=0)return null;
    const actions=[{op:'create',type:'cognition',properties:{x:finite(brain.properties.x),y:finite(brain.properties.y),networkSize:neurons.length,memoryCapacity:Math.max(16,neurons.length*8),activeNeurons:finite(brain.properties.activeNeurons),catalogueId:'cognition',name:'Cognition',categoryId:'organisms',catalogueColor:'#c4a0ed'},energy:0,as:'cognition'},{op:'compose',parent:brainId,child:{ref:'cognition'}}];
    const result=this.store.transact(actions);
    if(!result.ok)throw result.error;
    const cognition=this.store.get(result.refs.cognition);
    this._record('cognition-emergence',{parents:[brainId],children:[cognition.id],networkSize:neurons.length,activity});
    return cognition;
  },

  advanceOrganismalProcesses() {
    const organoids=[...this.store.entities.values()].filter(e=>e.type==='organoid'&&active(e));
    let organs=0,nervousSystems=0,brains=0,cognitiveSystems=0;
    for(const organoid of organoids) {
      const organ=this.formOrgan(organoid.id);
      if(!organ)continue;
      if(organ.id!==organoid.parent)organs++;
      const nervous=this.formNervousSystem(organ.id);
      if(!nervous)continue;
      if(!this.store.outgoing(organ.id,'contains').map(id=>this.store.get(id)).some(e=>e?.type==='nervous-system'))nervousSystems++;
      const brain=this.formBrain(nervous.id);
      if(!brain)continue;
      if(!this.store.outgoing(nervous.id,'contains').map(id=>this.store.get(id)).some(e=>e?.type==='brain'))brains++;
      const cognition=this.formCognition(brain.id);
      if(cognition)cognitiveSystems++;
    }
    return{organs,nervousSystems,brains,cognitiveSystems};
  },

  advanceNeuralProcesses(options={}) {
    const neurons=[...this.store.entities.values()].filter(e=>(e.type==='cell'||e.type==='protocell')&&active(e)&&['neural','sensory'].includes(e.properties.phenotype));
    if(!neurons.length)return{neurons:0,connections:0,fired:0,activity:0};
    this.store.defineRelation?.('signals',{direction:'directed'});
    const radius=Math.max(.001,finite(options.radius,40)),limit=Math.max(1,Math.floor(options.connections||3)),index=this.runtime.spatial.rebuild(neurons);
    let connections=0;
    for(const neuron of neurons) {
      const existing=new Set(this.store.outgoing(neuron.id,'signals'));
      const nearest=index.query(neuron.properties.x,neuron.properties.y,radius,[]).filter(e=>e.id!==neuron.id).sort((a,b)=>Math.hypot(a.properties.x-neuron.properties.x,a.properties.y-neuron.properties.y)-Math.hypot(b.properties.x-neuron.properties.x,b.properties.y-neuron.properties.y));
      let added=0;
      for(const target of nearest)if(!existing.has(target.id)&&added<limit){this.store.link(neuron.id,target.id,'signals',{weight:finite(options.initialWeight,.35)});added++;connections++}
    }
    const field=this.runtime.fields.fields.has('stimulus')?'stimulus':null,updates=[],states=new Map();
    for(const neuron of neurons) {
      const p=neuron.properties,incoming=this.store.incoming(neuron.id,'signals');
      const synaptic=incoming.reduce((sum,id)=>{const source=this.store.get(id);if(!source)return sum;const edge=this.store.edges(id,'out','signals').find(e=>e.b===neuron.id);return sum+finite(source.properties.activity)*finite(edge?.properties.weight,.35)},0);
      const stimulus=field?this.runtime.fields.sample(field,finite(p.x),finite(p.y)):0;
      const threshold=Math.max(.01,finite(p.threshold,.5)),potential=clamp(finite(p.potential)*.82+stimulus+synaptic,-4,4),fired=potential>=threshold,activity=fired?1:Math.max(0,potential/threshold*.25),memory=[...(Array.isArray(p.memory)?p.memory:[]),activity].slice(-32);
      states.set(neuron.id,{activity,fired,potential:fired?0:potential,memory});
      updates.push({op:'set',id:neuron.id,key:'activity',value:activity},{op:'set',id:neuron.id,key:'potential',value:fired?0:potential},{op:'set',id:neuron.id,key:'memory',value:memory},{op:'set',id:neuron.id,key:'spikeCount',value:finite(p.spikeCount)+(fired?1:0)});
    }
    const result=this.store.transact(updates);
    if(!result.ok)throw result.error;
    let fired=0,total=0;
    for(const neuron of neurons){const state=states.get(neuron.id);total+=state.activity;if(state.fired){fired++;const cost=Math.max(0,finite(options.energyCost,.0001));if(neuron.energy>=cost&&cost)this.energy.dissipate(neuron,cost)}}
    const brains=[...this.store.entities.values()].filter(e=>e.type==='brain'&&active(e));
    for(const brain of brains){const members=this.store.descendants(brain.id).map(id=>this.store.get(id)).filter(e=>e&&(e.type==='cell'||e.type==='protocell')&&['neural','sensory'].includes(e.properties.phenotype)),activeNeurons=members.filter(e=>finite(e.properties.activity)>0).length,activity=members.length?activeNeurons/members.length:0;this.store.transact([{op:'set',id:brain.id,key:'activeNeurons',value:activeNeurons},{op:'set',id:brain.id,key:'activity',value:activity}])}
    return{neurons:neurons.length,connections,fired,activity:total/neurons.length};
  }
};
