import {clamp,finite,copy} from './shared.js';
export const methods = {
  _membranePlan(options={},prefix="membrane"){const count=Math.max(3,Math.floor(options.count||12)),cx=finite(options.x),cy=finite(options.y),radius=Math.max(2,finite(options.radius,12)),permeability=clamp(finite(options.permeability,.2)),properties={x:cx,y:cy,radius,permeability,lipidCount:count,closed:true,catalogueId:'membranes',name:'Lipid membrane',categoryId:'selforg',catalogueColor:'#e58b9d'},actions=[{op:"create",type:"membrane",properties,energy:0,as:prefix}],lipidRefs=[],bonds=[];this.contracts.assert("membrane",properties);for(let i=0;i<count;i++){const angle=2*Math.PI*i/count,ref=prefix+"Lipid"+i,lipid={x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius,angle,headPolarity:1,tailHydrophobicity:1};this.contracts.assert("lipid",lipid);lipidRefs.push(ref);actions.push({op:"create",type:"lipid",properties:lipid,energy:0,as:ref},{op:"compose",parent:{ref:prefix},child:{ref}});if(i){actions.push({op:"link",id:{ref:lipidRefs[i-1]},target:{ref},type:"bond",properties:{membrane:true}});bonds.push([lipidRefs[i-1],ref])}}actions.push({op:"link",from:{ref:lipidRefs.at(-1)},to:{ref:lipidRefs[0]},type:"bond",properties:{membrane:{ref:prefix}}});bonds.push([lipidRefs.at(-1),lipidRefs[0]]);return{prefix,count,radius,properties,actions,lipidRefs,bonds}},
  _recordMembrane(plan,refs){const membraneId=refs[plan.prefix],lipids=plan.lipidRefs.map(ref=>refs[ref]);for(const [a,b]of plan.bonds)this._record("bonding",{parents:[refs[a],refs[b]],relation:"bond",properties:{membrane:membraneId}});this._record("membrane-assembly",{parents:lipids,children:[membraneId],count:plan.count,radius:plan.radius});return this.store.get(membraneId)},
  assembleMembrane(options={}){const plan=this._membranePlan(options),result=this.store.transact(plan.actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;return this._recordMembrane(plan,result.refs)},
  assembleMembraneFromLipids(ids,options={}) {
    const members=[...new Set(ids)].map(id=>this.store.get(id));
    if(members.length<3||members.some(e=>!e||e.type!=='lipid'||e.state!=='active'||e.parent))throw Error('Membrane assembly requires at least three free lipids');
    const x=members.reduce((s,e)=>s+finite(e.properties.x),0)/members.length;
    const y=members.reduce((s,e)=>s+finite(e.properties.y),0)/members.length;
    const ordered=members.slice().sort((a,b)=>Math.atan2(a.properties.y-y,a.properties.x-x)-Math.atan2(b.properties.y-y,b.properties.x-x));
    const radius=Math.max(2,finite(options.radius,Math.sqrt(members.length)*2.5));
    const permeability=clamp(finite(options.permeability,.2));
    const actions=[{op:'create',type:'membrane',properties:{x,y,radius,permeability,lipidCount:members.length,closed:true,catalogueId:'membranes',name:'Lipid membrane',categoryId:'selforg',catalogueColor:'#e58b9d'},energy:0,as:'membrane'}];
    ordered.forEach((e,i)=>{const angle=2*Math.PI*i/ordered.length;actions.push({op:'compose',parent:{ref:'membrane'},child:e.id},{op:'set',id:e.id,key:'x',value:x+Math.cos(angle)*radius},{op:'set',id:e.id,key:'y',value:y+Math.sin(angle)*radius},{op:'set',id:e.id,key:'angle',value:angle},{op:'link',from:e.id,to:ordered[(i+1)%ordered.length].id,type:'bond',properties:{membrane:true}})});
    const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
    if(!result.ok)throw result.error;
    const membrane=this.store.get(result.refs.membrane);
    const rest=2*radius*Math.sin(Math.PI/ordered.length);for(let i=0;i<ordered.length;i++)this.runtime.constraints.add({a:ordered[i].id,b:ordered[(i+1)%ordered.length].id,rest,stiffness:.8});
    for(let i=0;i<ordered.length;i++)this._record('bonding',{parents:[ordered[i].id,ordered[(i+1)%ordered.length].id],relation:'bond',properties:{membrane:membrane.id}});
    this._record('membrane-assembly',{parents:ordered.map(e=>e.id),children:[membrane.id],count:members.length,radius});
    return membrane;
  },
  selfAssembleMembranes(options={}) {
    const radius=Math.max(.001,finite(options.radius,12)),minimum=Math.max(3,Math.floor(options.minLipids||8));
    const lipids=[...this.store.entities.values()].filter(e=>e.type==='lipid'&&e.state==='active'&&!e.parent);
    const index=this.runtime.spatial.rebuild(lipids),adjacency=new Map(lipids.map(e=>[e.id,[]]));
    for(const a of lipids)for(const b of index.query(a.properties.x,a.properties.y,radius,[]))if(b.id>a.id&&Math.hypot(b.properties.x-a.properties.x,b.properties.y-a.properties.y)<=radius){adjacency.get(a.id).push(b.id);adjacency.get(b.id).push(a.id)}
    const seen=new Set();let formed=0;
    for(const lipid of lipids){if(seen.has(lipid.id))continue;const group=[],stack=[lipid.id];seen.add(lipid.id);while(stack.length){const id=stack.pop();group.push(id);for(const next of adjacency.get(id)||[])if(!seen.has(next)){seen.add(next);stack.push(next)}}
      if(group.length>=minimum){this.assembleMembraneFromLipids(group,options);formed++}
    }
    return formed;
  },
  encapsulateProtocell(membraneId,contents=[],options={}) {
    const membrane=this.store.get(membraneId);
    if(!membrane||membrane.type!=='membrane'||membrane.state!=='active'||membrane.parent||!membrane.properties.closed)throw Error('A free closed membrane is required');
    const members=[...new Set(contents)].map(id=>this.store.get(id));
    if(members.some(e=>!e||e.state!=='active'||e.parent||e.id===membrane.id))throw Error('Protocell contents must be active, uncontained entities');
    const polymer=members.find(e=>e.type==='polymer');
    const sequence=options.genome?.sequence||(polymer?.properties.sequence||[]).join('');
    if(typeof sequence!=='string'||sequence.length<3)throw Error('Protocell formation requires a replicable polymer sequence');
    const genome=copy(options.genome||{sequence,traits:{replicationRate:.02,mutationRate:.002,adhesion:.5}});
    const x=finite(membrane.properties.x),y=finite(membrane.properties.y);
    const properties=this.contracts.defaults('protocell',{x,y,genome,age:0,biomass:Math.max(1,finite(options.biomass,members.length)),permeability:finite(membrane.properties.permeability,.2),lifeStage:'nascent',lineageId:options.lineageId||'emergent'});
    properties.catalogueId='protocells';properties.name='Protocell';properties.categoryId='life';properties.catalogueColor='#8ec6a6';
    this.contracts.assert('protocell',properties);
    const energySources=[membrane,...members,...this.store.descendants(membrane.id).map(id=>this.store.get(id)).filter(Boolean)];
    const actions=[{op:'create',type:'protocell',properties,energy:0,as:'cell'},{op:'compose',parent:{ref:'cell'},child:membrane.id},...members.map(e=>({op:'compose',parent:{ref:'cell'},child:e.id}))];
    for(const source of energySources)if(source.energy>0)actions.push({op:'transfer',from:source.id,to:{ref:'cell'},amount:source.energy});
    const result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});
    if(!result.ok)throw result.error;
    const cell=this.store.get(result.refs.cell);
    this._record('protocell-formation',{parents:[membrane.id,...members.map(e=>e.id)],children:[cell.id],genome:genome.sequence});
    return cell;
  },
  formProtocellsFromAssemblies(options={}) {
    const membranes=[...this.store.entities.values()].filter(e=>e.type==='membrane'&&e.state==='active'&&!e.parent&&e.properties.closed);
    const polymers=[...this.store.entities.values()].filter(e=>e.type==='polymer'&&e.state==='active'&&!e.parent);
    const networks=[...this.store.entities.values()].filter(e=>e.type==='autocatalytic-network'&&e.state==='active'&&!e.parent);
    let formed=0;
    for(const membrane of membranes) {
      const radius=Math.max(2,finite(options.radius,finite(membrane.properties.radius,10)*.95));
      const near=e=>Math.hypot(finite(e.properties.x)-finite(membrane.properties.x),finite(e.properties.y)-finite(membrane.properties.y))<=radius;
      const polymer=polymers.find(e=>near(e)&&Array.isArray(e.properties.sequence)&&e.properties.sequence.length>=3);
      const network=networks.find(near);
      if(!polymer||!network)continue;
      const cell=this.encapsulateProtocell(membrane.id,[polymer.id,network.id],options);
      if(cell)formed++;
    }
    return formed;
  },
  formProtocell(options={}){const genome=copy(options.genome||{sequence:"ACGT",traits:{replicationRate:.05,mutationRate:.001,adhesion:.5}});if(typeof genome.sequence!=="string"||!genome.sequence.length)throw Error("Protocell genome requires a sequence");const properties=this.contracts.defaults("protocell",{x:finite(options.x),y:finite(options.y),genome,age:0,biomass:finite(options.biomass,1),permeability:clamp(finite(options.permeability,.2)),lifeStage:"nascent",lineageId:options.lineageId||"root",catalogueId:'protocells',name:'Protocell',categoryId:'life',catalogueColor:'#8ec6a6'});this.contracts.assert("protocell",properties);const plan=this._membranePlan({x:properties.x,y:properties.y,radius:finite(options.radius,12),count:options.lipidCount||12,permeability:properties.permeability}),actions=[{op:"create",type:"protocell",properties,energy:Math.max(0,finite(options.energy,5)),as:"cell"},...plan.actions,{op:"compose",parent:{ref:"cell"},child:{ref:plan.prefix}},...(options.contents||[]).map(id=>({op:"compose",parent:{ref:"cell"},child:id}))],result=this.store.transact(actions,{energy:this.energy,fields:this.energy.fields});if(!result.ok)throw result.error;const cell=this.store.get(result.refs.cell);this._recordMembrane(plan,result.refs);this._record("protocell-formation",{parents:options.contents||[],children:[cell.id],genome:genome.sequence});return cell}
};
