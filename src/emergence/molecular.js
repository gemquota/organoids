import {clamp,finite,copy,idOf} from './shared.js';
const COMPLEMENT=Object.freeze({A:'U',U:'A',C:'G',G:'C'});
export const methods = {
  formChemicalBonds(options={}) {
    const types=new Set(options.types||['monomer']),radius=Math.max(.001,finite(options.radius,10));
    const rate=Math.max(0,finite(options.rate,.2)),dt=Math.max(0,finite(options.dt,1));
    const energyCost=Math.max(0,finite(options.energyCost,.001)),complementary=options.complementary!==false;
    const entities=[...this.store.entities.values()].filter(e=>e.state==='active'&&!e.parent&&types.has(e.type));
    const index=this.runtime.spatial.rebuild(entities),degree=new Map(entities.map(e=>[e.id,this.store.neighbours(e.id,'bond').length]));
    let formed=0;
    for(const a of entities) {
      if((degree.get(a.id)||0)>=Math.max(1,finite(a.properties.valence,2)))continue;
      const pa=a.properties;
      for(const b of index.query(pa.x,pa.y,radius,[])) {
        if(b.id<=a.id||!entities.includes(b)||(degree.get(b.id)||0)>=Math.max(1,finite(b.properties.valence,2)))continue;
        if(complementary&&COMPLEMENT[pa.monomerKind]!==b.properties.monomerKind)continue;
        const dx=b.properties.x-pa.x,dy=b.properties.y-pa.y,d=Math.hypot(dx,dy);
        if(d>radius||this.store.neighbours(a.id,'bond').includes(b.id)||((degree.get(a.id)||0)>0&&(degree.get(b.id)||0)>0))continue;
        const affinity=clamp(finite(pa.bondAffinity,1)*finite(b.properties.bondAffinity,1));
        const temperature=(a.energy/Math.max(.001,finite(pa.heatCapacity,1))+b.energy/Math.max(.001,finite(b.properties.heatCapacity,1)))*.5;
        const activation=Math.max(0,finite(options.activationEnergy,.01));
        const probability=1-Math.exp(-rate*affinity*Math.exp(-activation/Math.max(.02,temperature))*dt);
        if(this.rng.next()>probability||a.energy<energyCost)continue;
        const actions=[{op:'link',from:a.id,to:b.id,type:'bond',properties:{kind:complementary?'complementary':'covalent',distance:d,affinity}}];
        if(energyCost)actions.push({op:'dissipate',id:a.id,amount:energyCost});
        const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
        if(!result.ok)continue;
        degree.set(a.id,(degree.get(a.id)||0)+1);degree.set(b.id,(degree.get(b.id)||0)+1);
        this._record('bonding',{parents:[a.id,b.id],relation:'bond',properties:{kind:complementary?'complementary':'covalent',distance:d,affinity}});
        formed++;
      }
    }
    return formed;
  },
  formMolecules(options={}){const types=options.types||["particle"],min=Math.max(2,options.minSize||2),groups=this._bondComponents(types).filter(g=>g.length>=min);let formed=0;for(const ids of groups){const members=ids.map(id=>this.store.get(id)).filter(Boolean),mass=members.reduce((s,e)=>s+Math.max(0,finite(e.properties.mass,1)),0)||members.length,energy=members.reduce((s,e)=>s+Math.max(0,e.energy),0),x=members.reduce((s,e)=>s+finite(e.properties.x)*Math.max(0,finite(e.properties.mass,1)),0)/mass,y=members.reduce((s,e)=>s+finite(e.properties.y)*Math.max(0,finite(e.properties.mass,1)),0)/mass;const actions=[{op:"create",type:options.productType||"molecule",properties:{x,y,mass,memberCount:ids.length,formedAt:this.runtime.scheduler.time},energy:0,as:"product"}];for(const id of ids)actions.push({op:"compose",parent:{ref:"product"},child:id});if(energy>0)for(const e of members)if(e.energy>0)actions.push({op:"transfer",from:e.id,to:{ref:"product"},amount:e.energy});const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(result.ok){formed++;this._record("molecular-formation",{parents:ids,children:[result.refs.product],mass,energy})}}return formed},
  polymerize(options={}){const types=options.monomerTypes||["monomer"],min=Math.max(2,options.minLength||3),groups=this._bondComponents(types).filter(g=>g.length>=min);let formed=0;for(const ids of groups){const monomers=ids.map(id=>this.store.get(id)).filter(Boolean),sequence=monomers.map(e=>e.properties.monomerKind||e.type),mass=monomers.reduce((s,e)=>s+finite(e.properties.mass,1),0),x=monomers.reduce((s,e)=>s+finite(e.properties.x),0)/monomers.length,y=monomers.reduce((s,e)=>s+finite(e.properties.y),0)/monomers.length;const energyCost=Math.max(0,finite(options.energyCost));if(energyCost>monomers[0].energy)continue;const actions=[{op:"create",type:"polymer",properties:{sequence,mass,x,y,length:ids.length},as:"polymer"},...ids.map(id=>({op:"compose",parent:{ref:"polymer"},child:id}))];if(energyCost)actions.push({op:"dissipate",id:ids[0],amount:energyCost});for(const e of monomers){const available=Math.max(0,e.energy-(e.id===ids[0]?energyCost:0));if(available)actions.push({op:"transfer",from:e.id,to:{ref:"polymer"},amount:available})}const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(result.ok){formed++;this._record("polymerisation",{parents:ids,children:[result.refs.polymer],sequence,energyCost})}}return formed},
  buildAutocatalyticNetwork(spec={}){const members=(spec.members||[]).map(idOf);if(members.length<2||members.some(id=>!this.store.get(id)))throw Error("An autocatalytic network requires at least two existing members");const properties={memberCount:members.length,cycleGain:finite(spec.cycleGain,1),reactionIds:spec.reactionIds||[]},actions=[{op:"create",type:"autocatalytic-network",properties,energy:0,as:"network"},...members.map(id=>({op:"compose",parent:{ref:"network"},child:id})),...members.map((id,i)=>({op:"link",from:id,to:members[(i+1)%members.length],type:"catalyses",properties:{cycle:true}}))],result=this.store.transact(actions);if(!result.ok)throw result.error;const root=this.store.get(result.refs.network);this._record("autocatalytic-network",{parents:members,children:[root.id],cycleGain:root.properties.cycleGain});return root},
  registerAutocatalysis(rule){if(!rule?.id||!rule.inputs?.length||!rule.outputs?.length||!rule.catalysts?.length)throw Error("Autocatalysis needs inputs, outputs and at least one catalyst");return this.runtime.rules.register({...copy(rule),autocatalytic:true})}
};
