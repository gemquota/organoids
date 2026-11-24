import {finite,active,idOf} from './shared.js';
export const methods={
  formColony(ids,options={}){const members=ids.map(idOf);if(members.length<2||members.some(id=>!this.store.get(id)))throw Error("A colony requires at least two existing members");const parts=members.map(id=>this.store.get(id)),x=parts.reduce((s,e)=>s+finite(e.properties.x),0)/parts.length,y=parts.reduce((s,e)=>s+finite(e.properties.y),0)/parts.length;const colony=this.runtime.topology.assemble(options.type||"colony",members,{memberCount:members.length,x,y,radius:finite(options.radius,20),formedAt:this.runtime.scheduler.time,catalogueId:'cellular-colonies',name:'Cellular colony',categoryId:'multicell',catalogueColor:'#7ed4cf'});this._record("colony-formation",{parents:members,children:[colony.id]});return colony},
  formOrgan(organoidId,options={}) {
    const organoid=this.store.get(organoidId);
    if(!organoid||organoid.type!=='organoid')throw Error('Organ formation requires an organoid');
    if(organoid.parent){const parent=this.store.get(organoid.parent);if(parent?.type==='organ')return parent}
    const tissues=this.store.descendants(organoidId).map(id=>this.store.get(id)).filter(e=>e?.type==='tissue');
    if(tissues.length<2)return null;
    const x=finite(organoid.properties.x),y=finite(organoid.properties.y),parentId=organoid.parent;
    const actions=[{op:'create',type:'organ',properties:{x,y,tissueCount:tissues.length,function:options.function||'integrated tissue function',catalogueId:'organs',name:'Organ',categoryId:'organisms',catalogueColor:'#c4a0ed'},energy:0,as:'organ'},{op:'compose',parent:{ref:'organ'},child:organoid.id}];
    if(parentId)actions.push({op:'compose',parent:parentId,child:{ref:'organ'}});
    const result=this.store.transact(actions);
    if(!result.ok)throw result.error;
    const organ=this.store.get(result.refs.organ);
    this._record('organ-formation',{parents:[organoid.id,...tissues.map(e=>e.id)],children:[organ.id],tissueCount:tissues.length});
    return organ;
  },
  formTissues(colonyId,options={}) {
    const colony=this.store.get(colonyId);
    if(!colony||colony.type!=='colony')throw Error('Tissue formation requires a colony');
    const cells=this.store.descendants(colonyId).map(id=>this.store.get(id)).filter(e=>e&&active(e)&&(e.type==='cell'||e.type==='protocell'));
    const groups=new Map();
    for(const cell of cells){const role=cell.properties.phenotype||'support';if(!groups.has(role))groups.set(role,[]);groups.get(role).push(cell)}
    const existing=this.store.outgoing(colonyId,'contains').map(id=>this.store.get(id)).filter(e=>e?.type==='tissue');
    if(existing.length)return existing;
    const actions=[],created=[];
    for(const[role,members]of groups)if(members.length>=Math.max(2,Math.floor(options.minimumCells||2))){
      const x=members.reduce((s,e)=>s+finite(e.properties.x),0)/members.length,y=members.reduce((s,e)=>s+finite(e.properties.y),0)/members.length,ref='tissue'+created.length;
      created.push({role,members,ref});
      actions.push({op:'create',type:'tissue',properties:{role,cellCount:members.length,x,y,catalogueId:'tissues',name:role+' tissue',categoryId:'multicell',catalogueColor:'#7ed4cf'},energy:0,as:ref},{op:'compose',parent:colonyId,child:{ref}});
      for(const cell of members)actions.push({op:'compose',parent:{ref},child:cell.id});
    }
    if(!actions.length)return[];
    const result=this.store.transact(actions);
    if(!result.ok)throw result.error;
    const tissues=created.map(x=>this.store.get(result.refs[x.ref]));
    this._record('tissue-formation',{parents:cells.map(e=>e.id),children:tissues.map(e=>e.id),roles:created.map(x=>x.role),count:tissues.length});
    return tissues;
  },
  formOrganoid(colonyId,options={}) {
    const colony=this.store.get(colonyId);
    if(!colony||colony.type!=='colony')throw Error('Organoid formation requires a colony');
    const existing=this.store.outgoing(colonyId,'contains').map(id=>this.store.get(id)).find(e=>e?.type==='organoid');
    if(existing)return existing;
    const tissues=this.store.outgoing(colonyId,'contains').map(id=>this.store.get(id)).filter(e=>e?.type==='tissue');
    if(tissues.length<2)return null;
    const actions=[{op:'create',type:'organoid',properties:{x:finite(colony.properties.x),y:finite(colony.properties.y),tissueCount:tissues.length,catalogueId:'organoids',name:'Organoid',categoryId:'multicell',catalogueColor:'#7ed4cf'},energy:0,as:'organoid'},...tissues.map(e=>({op:'compose',parent:{ref:'organoid'},child:e.id})),{op:'compose',parent:colonyId,child:{ref:'organoid'}}];
    const result=this.store.transact(actions);
    if(!result.ok)throw result.error;
    const organoid=this.store.get(result.refs.organoid);
    this._record('organoid-formation',{parents:tissues.map(e=>e.id),children:[organoid.id]});
    return organoid;
  },
  advanceMulticellularProcesses(options={}) {
    const radius=Math.max(1,finite(options.adhesionRadius,24)),minimum=Math.max(2,Math.floor(options.minimumCells||3)),cells=[...this.store.entities.values()].filter(e=>(e.type==='cell'||e.type==='protocell')&&active(e)&&this.lifecycle.stage(e)==='mature');
    const colonies=[...this.store.entities.values()].filter(e=>e.type==='colony'&&active(e)&&!e.parent);
    let recruited=0,formed=0,tissues=0,organoids=0;
    for(const cell of cells)if(!cell.parent){
      const nearby=colonies.find(c=>Math.hypot(finite(c.properties.x)-finite(cell.properties.x),finite(c.properties.y)-finite(cell.properties.y))<=radius);
      if(nearby){this.store.compose(nearby.id,cell.id);recruited++}
    }
    const free=cells.filter(e=>!e.parent),index=this.runtime.spatial.rebuild(free),adjacency=new Map(free.map(e=>[e.id,[]]));
    for(const a of free)for(const b of index.query(a.properties.x,a.properties.y,radius,[]))if(b.id>a.id&&Math.hypot(b.properties.x-a.properties.x,b.properties.y-a.properties.y)<=radius){adjacency.get(a.id).push(b.id);adjacency.get(b.id).push(a.id)}
    const seen=new Set();
    for(const cell of free){if(seen.has(cell.id))continue;const group=[],stack=[cell.id];seen.add(cell.id);while(stack.length){const id=stack.pop();group.push(id);for(const next of adjacency.get(id)||[])if(!seen.has(next)){seen.add(next);stack.push(next)}}
      if(group.length<minimum)continue;
      const colony=this.formColony(group,{radius});
      const members=group.map(id=>this.store.get(id)),cx=finite(colony.properties.x),cy=finite(colony.properties.y),field=this.runtime.fields.fields.has('morphogen')?'morphogen':null;
      if(field)for(const member of members){const distance=Math.hypot(finite(member.properties.x)-cx,finite(member.properties.y)-cy),value=Math.min(1,distance/radius);this.runtime.fields.add(field,finite(member.properties.x),finite(member.properties.y),value)}
      if(field)for(const member of members)if(!member.properties.phenotype)this.differentiateFromField(member.id,field,{defaultRole:'support',thresholds:options.thresholds||{neural:.98,sensory:.95,secretory:.9,motile:.85,contractile:.8,boundary:.5,interior:.12}});
      this.morphogenesis(colony.id,{pattern:options.pattern||'radial',radius:Math.max(2,finite(options.morphogenesisRadius, radius*.6)),stiffness:.2});
      formed++;
    }
    for(const colony of colonies.concat([...this.store.entities.values()].filter(e=>e.type==='colony'&&active(e)&&!e.parent&&!colonies.includes(e)))){
      const members=this.store.descendants(colony.id).map(id=>this.store.get(id)).filter(e=>e&&active(e)&&(e.type==='cell'||e.type==='protocell'));
      const field=this.runtime.fields.fields.has('morphogen')?'morphogen':null;
      if(field)for(const member of members)if(!member.properties.phenotype){const distance=Math.hypot(finite(member.properties.x)-finite(colony.properties.x),finite(member.properties.y)-finite(colony.properties.y)),value=Math.min(1,distance/radius);this.runtime.fields.add(field,finite(member.properties.x),finite(member.properties.y),value);this.differentiateFromField(member.id,field,{defaultRole:'support',thresholds:options.thresholds||{boundary:.5,secretory:.4,motile:.3,interior:.12}})}
      const newTissues=this.formTissues(colony.id,options);tissues+=newTissues.length;
      const organoid=this.formOrganoid(colony.id,options);if(organoid)organoids++;
    }
    return{cells:cells.length,recruited,formed,tissues,organoids};
  },
  differentiate(id,role,options={}){const e=this.store.get(id);if(!e||!active(e))throw Error("Unknown active cell");const allowed=options.roles||["boundary","interior","support","reproductive","motile","secretory","neural","sensory","contractile"];if(!allowed.includes(role))throw Error("Unknown differentiation role");const result=this.store.transact([{op:"set",id,key:"phenotype",value:role},{op:"set",id,key:"differentiation",value:{from:e.properties.phenotype||"undifferentiated",to:role,signal:options.signal||null}}]);if(!result.ok)throw result.error;this._record("differentiation",{entity:id,role,signal:options.signal||null});return e},
  differentiateFromField(id,field,options={}){const e=this.store.get(id);if(!e||!active(e))throw Error("Unknown active cell");const value=this.runtime.fields.sample(field,finite(e.properties.x),finite(e.properties.y)),thresholds=options.thresholds||{boundary:.8,secretory:.6,motile:.45,interior:.2};const role=Object.entries(thresholds).sort((a,b)=>b[1]-a[1]).find(([,threshold])=>value>=finite(threshold))?.[0]||options.defaultRole||"support";return this.differentiate(id,role,{signal:{field,value},roles:Object.keys(thresholds).concat(options.defaultRole||"support")})},
  morphogenesisFromField(id,field,options={}){const root=this.store.get(id);if(!root)throw Error("Unknown developing structure");const members=this.store.descendants(id).map(n=>this.store.get(n)).filter(e=>e&&active(e)),strength=finite(options.strength,.5),maxStep=Math.max(0,finite(options.maxStep,2)),actions=[];for(const e of members){const p=e.properties,g=this.runtime.fields.gradient(field,finite(p.x),finite(p.y)),m=Math.hypot(g.x,g.y)||1,dx=Math.max(-maxStep,Math.min(maxStep,g.x/m*strength)),dy=Math.max(-maxStep,Math.min(maxStep,g.y/m*strength));actions.push({op:"set",id:e.id,key:"x",value:finite(p.x)+dx},{op:"set",id:e.id,key:"y",value:finite(p.y)+dy},{op:"set",id:e.id,key:"morphogen",value:this.runtime.fields.sample(field,finite(p.x),finite(p.y))})}const result=this.store.transact(actions);if(!result.ok)throw result.error;this._record("field-morphogenesis",{entity:id,field,members:members.map(e=>e.id),strength});return root},
  morphogenesis(id,options={}){const root=this.store.get(id);if(!root)throw Error("Unknown developing structure");const members=this.store.descendants(id).map(n=>this.store.get(n)).filter(e=>e&&active(e)),pattern=options.pattern||"radial";if(!["radial","bilateral"].includes(pattern))throw Error("Unsupported morphogenesis pattern");const radius=Math.max(1,finite(options.radius,40)),n=Math.max(1,members.length),positions=members.map((e,i)=>{const angle=2*Math.PI*i/n,ring=pattern==="bilateral"?(i%2?1:-1):1;return{x:finite(root.properties.x)+Math.cos(angle)*radius*ring,y:finite(root.properties.y)+Math.sin(angle)*radius,morphogen:Math.sin(angle)+1,axis:pattern}}),actions=members.flatMap((e,i)=>Object.entries(positions[i]).map(([key,value])=>({op:"set",id:e.id,key,value}))),result=this.store.transact(actions);if(!result.ok)throw result.error;for(let i=1;i<members.length;i++)this.runtime.constraints.add({a:members[i-1].id,b:members[i].id,rest:Math.hypot(positions[i].x-positions[i-1].x,positions[i].y-positions[i-1].y),stiffness:finite(options.stiffness,.25)});this._record("morphogenesis",{entity:id,pattern,members:members.map(e=>e.id),radius});return root}
};
