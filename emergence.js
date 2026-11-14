// Organoids: reusable, data-driven emergence substrate.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
const clone=v=>structuredClone(v);
export class EntityStore{
  constructor(){this.entities=new Map();this.links=[];this.next=1;this.kinds=new Map([['contains',{direction:'directed',acyclic:true,maxIncoming:1}],['bond',{direction:'undirected'}],['signals',{direction:'directed'}]]);this.out=new Map();this.in=new Map();this.adj=new Map()}
  get(id){return this.entities.get(id)}
  defineRelation(type,spec={}){this.kinds.set(type,{direction:'directed',...spec});return this}
  _bucket(index,id){let set=index.get(id);if(!set)index.set(id,set=new Set());return set}
  _index(e,add=true){const op=add?'add':'delete';this._bucket(this.out,e.a)[op](e);this._bucket(this.in,e.b)[op](e);this._bucket(this.adj,e.a)[op](e);this._bucket(this.adj,e.b)[op](e);if(this.kinds.get(e.type)?.direction==='undirected'){this._bucket(this.out,e.b)[op](e);this._bucket(this.in,e.a)[op](e)}}
  _rebuild(){this.out.clear();this.in.clear();this.adj.clear();for(const e of this.links)this._index(e);return this}
  edges(id,direction='both',type){const sets=direction==='out'?[this.out.get(id)]:direction==='in'?[this.in.get(id)]:[this.out.get(id),this.in.get(id)];return [...new Set(sets.flatMap(s=>s?[...s]:[]))].filter(e=>!type||e.type===type)}
  create(type,properties={},options={}){const e={id:this.next++,type,properties:{...properties},state:options.state??'active',energy:num(options.energy),parent:null,children:[]};this.entities.set(e.id,e);return e}
  remove(id,discardEnergy=false){const e=this.get(id);if(!e)return false;const edges=[...(this.adj.get(id)||[])],children=this.outgoing(id,'contains');for(const child of children){const c=this.get(child);if(c){c.parent=null;c.state='active';if(!discardEnergy)c.energy+=e.energy/Math.max(1,children.length)}}for(const edge of edges){this._index(edge,false);const p=this.get(edge.a),c=this.get(edge.b);if(edge.type==='contains'){if(p)p.children=p.children.filter(x=>x!==edge.b);if(c&&c.parent===edge.a){c.parent=null;c.state='active'}}}this.links=this.links.filter(l=>l.a!==id&&l.b!==id);this.out.delete(id);this.in.delete(id);this.adj.delete(id);return this.entities.delete(id)}
  compose(parent,child){this.link(parent,child,'contains');return this.get(parent)}
  link(a,b,type='bond',properties={}){const x=this.get(a),y=this.get(b),spec=this.kinds.get(type)||{direction:'undirected'};if(!x||!y||a===b)throw Error('Invalid relationship');if(spec.acyclic&&this.descendants(b).includes(a))throw Error('Composition cycle');if(type==='contains'&&y.parent&&y.parent!==a)this.unlink(y.parent,b,type);if(spec.maxIncoming&&this.edges(b,'in',type).some(e=>e.a!==a))throw Error('Relationship cardinality exceeded');if(!this.kinds.has(type))this.kinds.set(type,spec);if(spec.direction==='undirected'&&a>b)[a,b]=[b,a];if(!this.links.some(e=>e.a===a&&e.b===b&&e.type===type)){const e={a,b,type,properties:{...properties}};this.links.push(e);this._index(e);if(type==='contains'){const c=this.get(b),p=this.get(a);c.parent=a;c.state='bound';if(!p.children.includes(b))p.children.push(b)}}return this}
  unlink(a,b,type){const undirected=type&&this.kinds.get(type)?.direction==='undirected',gone=this.links.filter(e=>(type?e.type===type:true)&&(e.a===a&&e.b===b||(!type||undirected)&&e.a===b&&e.b===a));for(const e of gone)this._index(e,false);this.links=this.links.filter(e=>!gone.includes(e));for(const e of gone)if(e.type==='contains'){const p=this.get(e.a),c=this.get(e.b);if(p)p.children=p.children.filter(x=>x!==e.b);if(c&&c.parent===e.a){c.parent=null;c.state='active'}}return this}
  outgoing(id,type){return this.edges(id,'out',type).map(e=>e.a===id?e.b:e.a)}
  incoming(id,type){return this.edges(id,'in',type).map(e=>e.a===id?e.b:e.a)}
  neighbours(id,type){return [...new Set((this.adj.get(id)||[]).filter(e=>!type||e.type===type).map(e=>e.a===id?e.b:e.a))]}
  descendants(id){const out=[],seen=new Set(),visit=n=>{for(const c of this.outgoing(n,'contains'))if(!seen.has(c)){seen.add(c);out.push(c);visit(c)}};visit(id);return out}
  snapshot(){return{next:this.next,entities:[...this.entities.values()].map(clone),links:clone(this.links),kinds:[...this.kinds]}}
  static restore(s){const store=new EntityStore();store.next=s.next;store.entities=new Map(s.entities.map(e=>[e.id,clone(e)]));store.links=clone(s.links);if(s.kinds)store.kinds=new Map(s.kinds);return store._rebuild()}
  transact(actions,context={}){
    if(!Array.isArray(actions))return{ok:false,error:Error('Actions must be an array'),refs:{}};
    const valid=new Set(['create','remove','set','compose','link','unlink','transfer','deposit','harvest','dissipate','emit']),ids=new Set(),created=this.next,refs={},resolve=v=>v&&typeof v==='object'&&v.ref?refs[v.ref]:v;
    for(const a of actions){if(!a||!valid.has(a.op))return{ok:false,error:Error('Invalid action'),refs:{}};if(['transfer','deposit','harvest','dissipate'].includes(a.op)&&(!Number.isFinite(a.amount)||a.amount<0))return{ok:false,error:Error('Invalid amount'),refs:{}};for(const k of ['id','from','to','parent','child','target'])if(Number.isInteger(a[k]))ids.add(a[k])}
    for(const id of [...ids])for(const edge of this.adj.get(id)||[]){ids.add(edge.a);ids.add(edge.b)}
    const entityRefs=new Map([...ids].filter(id=>this.get(id)).map(id=>[id,this.get(id)])),propertyRefs=new Map([...ids].filter(id=>this.get(id)).map(id=>[id,this.get(id).properties])),propertyValues=new Map([...ids].filter(id=>this.get(id)).map(id=>[id,new Map(Object.entries(this.get(id).properties))])),childRefs=new Map([...ids].filter(id=>this.get(id)).map(id=>[id,this.get(id).children])),saved=new Map([...ids].filter(id=>this.get(id)).map(id=>[id,clone(this.get(id))])),edges=this.links.filter(e=>ids.has(e.a)||ids.has(e.b)).map(clone),kinds=new Map(this.kinds),ledger=context.energy?clone(context.energy.ledger):null,eventCount=context.events?.length??0;
    context.fields?.begin?.();
    try{
      for(const a of actions){const n=resolve(a.id),from=resolve(a.from),to=resolve(a.to);
        switch(a.op){
          case'create':{if(typeof a.type!=='string'||!a.type)throw Error('Invalid entity type');const e=this.create(a.type,a.properties||{},{energy:a.energy||0,state:a.state});if(a.as)refs[a.as]=e.id;break}
          case'remove':if(!this.remove(n,!!a.discardEnergy))throw Error('Unknown entity '+n);break;
          case'set':{const e=this.get(n);if(!e||typeof a.key!=='string')throw Error('Invalid set');e.properties[a.key]=clone(a.value);break}
          case'compose':this.compose(resolve(a.parent),resolve(a.child));break;
          case'link':this.link(from!==undefined?from:n,to!==undefined?to:resolve(a.target),a.type||'bond',a.properties||{});break;
          case'unlink':this.unlink(from!==undefined?from:n,to!==undefined?to:resolve(a.target),a.type);break;
          case'transfer':{const x=this.get(from),y=this.get(to);if(!x||!y||x.energy<a.amount)throw Error('Invalid energy transfer');if(context.energy)context.energy.transfer(x,y,a.amount);else{x.energy-=a.amount;y.energy+=a.amount}break}
          case'deposit':{const e=this.get(n);if(!e||!context.energy)throw Error('Deposit requires energy engine');context.energy.deposit(a.field,e,a.amount);break}
          case'harvest':{const e=this.get(n);if(!e||!context.energy)throw Error('Harvest requires energy engine');context.energy.harvest(a.field,e,a.amount);break}
          case'dissipate':{const e=this.get(n);if(!e||!context.energy)throw Error('Dissipation requires energy engine');context.energy.dissipate(e,a.amount);break}
          case'emit':context.events?.push(clone(a.event));break
        }
      }
      context.fields?.commit?.();return{ok:true,refs};
    }catch(error){
      for(const id of [...this.entities.keys()])if(id>=created)this.entities.delete(id);
      for(const [id,state] of saved){const e=entityRefs.get(id),p=propertyRefs.get(id),values=propertyValues.get(id),children=childRefs.get(id);for(const k of Object.keys(p))delete p[k];for(const [k,v] of values)p[k]=v;children.splice(0,children.length,...state.children);for(const k of Object.keys(e))if(k!=='properties'&&k!=='children'&&!(k in state))delete e[k];for(const [k,v] of Object.entries(state))if(k!=='properties'&&k!=='children')e[k]=clone(v);e.properties=p;e.children=children;this.entities.set(id,e)}
      this.next=created;this.links=this.links.filter(e=>this.entities.has(e.a)&&this.entities.has(e.b)&&!ids.has(e.a)&&!ids.has(e.b));this.links.push(...edges);this.kinds=kinds;this._rebuild();
      context.fields?.rollback?.();if(ledger){for(const k of Object.keys(context.energy.ledger))delete context.energy.ledger[k];Object.assign(context.energy.ledger,ledger)}if(context.events)context.events.length=eventCount;
      return{ok:false,error,refs:{}};
    }
  }
}
export class SpatialIndex{
  constructor(cell=32){this.cell=Math.max(1,cell);this.buckets=new Map()}
  key(x,y){return Math.floor(x/this.cell)+','+Math.floor(y/this.cell)}
  rebuild(entities){this.buckets.clear();for(const e of entities){if(e.state!=='active')continue;const p=e.properties;if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const k=this.key(p.x,p.y);if(!this.buckets.has(k))this.buckets.set(k,[]);this.buckets.get(k).push(e)}return this}
  query(x,y,r){const out=[],c=this.cell;for(let iy=Math.floor((y-r)/c);iy<=Math.floor((y+r)/c);iy++)for(let ix=Math.floor((x-r)/c);ix<=Math.floor((x+r)/c);ix++)for(const e of this.buckets.get(ix+','+iy)||[])if(Math.hypot(e.properties.x-x,e.properties.y-y)<=r)out.push(e);return out}
}
export class FieldGrid{
  constructor(cols,rows,width=cols,height=rows){this.cols=cols;this.rows=rows;this.width=width;this.height=height;this.fields=new Map();this.meta=new Map();this.journal=null}
  define(name,initial=0,meta={}){this.fields.set(name,new Float32Array(this.cols*this.rows).fill(initial));this.meta.set(name,{unit:meta.unit||'quantity',diffusion:Math.max(0,num(meta.diffusion)),decay:Math.max(0,num(meta.decay)),boundary:meta.boundary||'clamp',advection:meta.advection||null});return this}
  index(x,y){return clamp(Math.floor(y/this.height*this.rows),0,this.rows-1)*this.cols+clamp(Math.floor(x/this.width*this.cols),0,this.cols-1)}
  _write(name,i,value){const a=this.fields.get(name);if(!a)throw Error('Unknown field: '+name);if(this.journal){const key=name+':'+i;if(!this.journal.has(key))this.journal.set(key,[a,i,a[i]])}a[i]=value}
  begin(){if(this.journal)throw Error('Nested field transaction');this.journal=new Map();return this}
  commit(){this.journal=null;return this}
  rollback(){if(this.journal)for(const [a,i,v] of this.journal.values())a[i]=v;this.journal=null;return this}
  add(name,x,y,value){const a=this.fields.get(name);if(!a)throw Error('Unknown field: '+name);const i=this.index(x,y);this._write(name,i,a[i]+value);return this}
  sample(name,x,y){const a=this.fields.get(name);if(!a)throw Error('Unknown field: '+name);return a[this.index(x,y)]}
  take(name,x,y,value){const a=this.fields.get(name);if(!a)throw Error('Unknown field: '+name);const i=this.index(x,y),n=Math.min(Math.max(0,value),Math.max(0,a[i]));this._write(name,i,a[i]-n);return n}
  gradient(name,x,y){const dx=this.width/this.cols,dy=this.height/this.rows;return{x:(this.sample(name,x+dx,y)-this.sample(name,x-dx,y))/(2*dx),y:(this.sample(name,x,y+dy)-this.sample(name,x,y-dy))/(2*dy)}}
  diffuse(name,rate){const a=this.fields.get(name);if(!a)throw Error('Unknown field: '+name);const b=Float32Array.from(a),k=clamp(rate)*.25;for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){const i=y*this.cols+x;for(const j of [x+1<this.cols?i+1:-1,y+1<this.rows?i+this.cols:-1])if(j>=0){const f=(a[j]-a[i])*k;b[i]+=f;b[j]-=f}}for(let i=0;i<a.length;i++)this._write(name,i,b[i]);return this}
  advect(name,vx,vy,dt=1){const a=this.fields.get(name);if(!a)throw Error('Unknown field: '+name);const b=Float32Array.from(a),sx=this.cols/this.width,sy=this.rows/this.height,wrap=this.meta.get(name)?.boundary==='wrap';for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){const bx=x-vx*dt*sx,by=y-vy*dt*sy,px=wrap?(bx%this.cols+this.cols)%this.cols:clamp(bx,0,this.cols-1),py=wrap?(by%this.rows+this.rows)%this.rows:clamp(by,0,this.rows-1),x0=Math.floor(px),y0=Math.floor(py),x1=(x0+1)%this.cols,y1=(y0+1)%this.rows,fx=px-x0,fy=py-y0;b[y*this.cols+x]=(a[y0*this.cols+x0]*(1-fx)+a[y0*this.cols+x1]*fx)*(1-fy)+(a[y1*this.cols+x0]*(1-fx)+a[y1*this.cols+x1]*fx)*fy}for(let i=0;i<a.length;i++)this._write(name,i,b[i]);return this}
  transport(dt=1){for(const [name,meta] of this.meta){if(meta.advection)this.advect(name,meta.advection.x||0,meta.advection.y||0,dt);if(meta.diffusion)this.diffuse(name,meta.diffusion*dt);if(meta.decay){const a=this.fields.get(name),k=Math.exp(-meta.decay*dt);for(let i=0;i<a.length;i++)this._write(name,i,a[i]*k)}}return this}
  total(name){const a=this.fields.get(name);if(!a)throw Error('Unknown field: '+name);return a.reduce((x,y)=>x+y,0)}
}
class PairEngine{
  constructor(items=[]){this.rules=[];this.constraints=[];for(const item of items)(Object.hasOwn(item,'rest')?this.constraints:this.rules).push(clone(item))}
  register(rule){this.rules.push(clone(rule));return this}
  add(c){this.constraints.push(clone(c));return this}
  *candidates(store,index,r){const seen=new Set();for(const a of store.entities.values()){if(a.state!=='active'||(r.a!=='*'&&a.type!==r.a))continue;const p=a.properties;for(const b of index.query(p.x,p.y,r.radius)){if(a.id===b.id||b.state!=='active'||(r.b!=='*'&&b.type!==r.b))continue;const key=a.id<b.id?a.id+':'+b.id:b.id+':'+a.id;if(seen.has(key))continue;seen.add(key);const q=b.properties,dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);if(d<=r.radius)yield[a,b,dx,dy,d||.0001]}}}
  apply(store,index,dt=1){const force=new Map();for(const r of this.rules)for(const [a,b,dx,dy,d] of this.candidates(store,index,r)){const sign=r.mode==='repel'?-1:1,m=(1-d/r.radius)*num(r.strength,1)*sign*dt,fx=dx/d*m,fy=dy/d*m;for(const [e,x,y] of [[a,fx,fy],[b,-fx,-fy]]){const f=force.get(e.id)||{x:0,y:0};f.x+=x;f.y+=y;force.set(e.id,f)}}for(const [id,f] of force){const p=store.get(id).properties,m=Math.max(.001,num(p.mass,1));p.vx=num(p.vx)+f.x/m;p.vy=num(p.vy)+f.y/m}return force.size}
  solve(store,iterations=1){for(let n=0;n<iterations;n++)for(const c of this.constraints){const a=store.get(c.a)?.properties,b=store.get(c.b)?.properties;if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.0001,err=(d-num(c.rest))/d*clamp(num(c.stiffness,1)),ia=1/Math.max(.001,num(a.mass,1)),ib=1/Math.max(.001,num(b.mass,1)),sum=ia+ib;a.x+=dx*err*ia/sum;a.y+=dy*err*ia/sum;b.x-=dx*err*ib/sum;b.y-=dy*err*ib/sum}return this}
}
export {PairEngine as InteractionEngine,PairEngine as ConstraintEngine};
export class EnergyEngine{
  constructor(fields){this.fields=fields;this.ledger={input:0,transferred:0,converted:0,output:0,fielded:0}}
  heat(e,n){const p=e.properties||{};if(this.fields?.fields.has('heat')&&Number.isFinite(p.x)&&Number.isFinite(p.y)){this.fields.add('heat',p.x,p.y,n);this.ledger.fielded+=n}else this.ledger.output+=n;return n}
  deposit(name,e,n){n=Math.min(Math.max(0,num(n)),Math.max(0,e.energy));const p=e.properties||{};if(!this.fields?.fields.has(name)||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid field deposit');this.fields.add(name,p.x,p.y,n);e.energy-=n;this.ledger.transferred+=n;return n}
  harvest(name,e,n){const p=e.properties||{};if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid field harvest');const v=this.fields.take(name,p.x,p.y,n);e.energy+=v;this.ledger.transferred+=v;return v}
  source(e,n){n=Math.max(0,num(n));e.energy+=n;this.ledger.input+=n;return n}
  transfer(a,b,n){n=clamp(n,0,Math.max(0,a.energy));a.energy-=n;b.energy+=n;this.ledger.transferred+=n;return n}
  quantity(e,key){return key==='energy'?num(e.energy):num(e.quantities?.[key])}
  change(e,key,delta){if(key==='energy')e.energy=Math.max(0,this.quantity(e,key)+delta);else{e.quantities||={};e.quantities[key]=Math.max(0,this.quantity(e,key)+delta)}return this.quantity(e,key)}
  transferQuantity(a,b,key,n){n=Math.min(Math.max(0,num(n)),this.quantity(a,key));this.change(a,key,-n);this.change(b,key,n);this.ledger.transferred+=key==='energy'?n:0;return n}
  convert(e,n,efficiency=1){n=clamp(n,0,Math.max(0,e.energy));const out=n*clamp(efficiency);e.energy+=out-n;this.ledger.converted+=out;this.heat(e,n-out);return out}
  dissipate(e,n){n=clamp(n,0,Math.max(0,e.energy));e.energy-=n;this.heat(e,n);return n}
  inventory(store){const entities=[...store.entities.values()].reduce((sum,e)=>sum+num(e.energy)+Object.entries(e.quantities||{}).reduce((a,[k,v])=>a+(k==='energy'?0:num(v)),0),0),fields=[...this.fields.fields].reduce((sum,[name])=>sum+(this.fields.meta.get(name)?.unit==='energy'?this.fields.total(name):0),0);return{entities,fields,total:entities+fields}}
  audit(store,baseline=0){const inventory=this.inventory(store),residual=inventory.total+this.ledger.output-this.ledger.input-baseline;return{...inventory,input:this.ledger.input,output:this.ledger.output,residual,balanced:Math.abs(residual)<1e-5}}
}
export class GraphEngine{
  constructor(store){this.store=store}
  neighbours(id,type,direction='both'){return direction==='out'?this.store.outgoing(id,type):direction==='in'?this.store.incoming(id,type):this.store.neighbours(id,type)}
  components(type){const nodes=[...this.store.entities.values()].filter(e=>!type||e.type===type),seen=new Set(),out=[];for(const e of nodes)if(!seen.has(e.id)){const group=[],stack=[e.id];seen.add(e.id);while(stack.length){const id=stack.pop();group.push(id);for(const n of this.neighbours(id))if((!type||this.store.get(n)?.type===type)&&!seen.has(n)){seen.add(n);stack.push(n)}}out.push(group)}return out}
  hasCycle(ids){const set=new Set(ids),seen=new Set();const visit=(id,parent)=>{seen.add(id);for(const n of this.neighbours(id))if(set.has(n)){if(!seen.has(n)){if(visit(n,id))return true}else if(n!==parent)return true}return false};for(const id of ids)if(!seen.has(id)&&visit(id,null))return true;return false}
  assemble(type,ids,properties={}){const root=this.store.create(type,properties);try{for(const id of ids)this.store.compose(root.id,id)}catch(error){this.store.remove(root.id,true);throw error}return root}
  closed(id){const ids=[id,...this.store.descendants(id)];return ids.length>2&&this.hasCycle(ids)}
  divide(id,groups){const parent=this.store.get(id);if(!parent)throw Error('Unknown entity');return groups.map(group=>this.assemble(parent.type,group,parent.properties))}
}
export {GraphEngine as TopologyEngine};
export class RuleEngine{
  constructor(options={}){this.rules=[];this.random=options.random||Math.random;this.energy=options.energy;this.events=[]}
  register(r){if(!r.id||!Array.isArray(r.inputs)||!Array.isArray(r.outputs))throw Error('Rule requires id, inputs and outputs');this.rules.push(clone(r));return this}
  match(e,s){if(!e)return false;if(typeof s==='string')return e.type===s;return e.type===(s.type||e.type)&&Object.entries(s.where||{}).every(([k,v])=>e.properties[k]===(typeof v==='object'?v.value:v))}
  run(store,dt=1){let count=0;for(const r of this.rules){if(this.random()>1-Math.exp(-Math.max(0,num(r.rate,1))*Math.max(0,dt)))continue;const pool=[...store.entities.values()].filter(e=>e.state==='active'),used=new Set(),chosen=[];for(const spec of r.inputs){const e=pool.find(x=>!used.has(x.id)&&this.match(x,spec));if(!e){chosen.length=0;break}chosen.push(e);used.add(e.id)}if(chosen.length!==r.inputs.length)continue;const catalysts=(r.catalysts||[]).map(spec=>pool.find(e=>this.match(e,spec)));if(catalysts.some(e=>!e))continue;if((r.conditions||[]).some(c=>{const v=chosen[c.input||0]?chosen[c.input||0].properties[c.property]:undefined;return c.op==='gt'?!(v>c.value):c.op==='eq'?v!==c.value:!(v>=c.value)}))continue;const cost=Math.max(0,num(r.energyCost)),payer=chosen[0];if(cost&&(!payer||payer.energy<cost))continue;const budget=Math.max(0,chosen.reduce((sum,e)=>sum+e.energy,0)-cost),energy=Math.max(0,num(r.productEnergy,budget)),outputs=r.outputs.reduce((sum,o)=>sum+Math.max(0,num(o.energy,energy/Math.max(1,r.outputs.length))),0);if(outputs>budget+1e-8||outputs<budget-1e-8&&(!this.energy||r.energySink!=='external'))continue;const actions=[];if(cost)actions.push({op:'dissipate',id:payer.id,amount:cost});actions.push(...chosen.map(e=>({op:'remove',id:e.id,discardEnergy:true})));r.outputs.forEach((o,i)=>actions.push({op:'create',type:o.type,properties:o.properties||{},energy:num(o.energy,energy/Math.max(1,r.outputs.length)),as:'product'+i}));actions.push({op:'emit',event:{rule:r.id,inputs:chosen.map(e=>e.id),outputs:r.outputs.map((_,i)=>({ref:'product'+i}))}});const result=store.transact(actions,{energy:this.energy,fields:this.energy?this.energy.fields:null,events:this.events});if(result.ok){this.events[this.events.length-1].outputs=this.events[this.events.length-1].outputs.map(x=>result.refs[x.ref]);if(outputs<budget)this.energy.ledger.output+=budget-outputs;count++}}return count}
}
export class Scheduler{
  constructor(){this.phases=[];this.time=0;this.tick=0}
  add(name,fn,priority=0){this.phases.push({name,fn,priority,order:this.phases.length});this.phases.sort((a,b)=>a.priority-b.priority||a.order-b.order);return this}
  step(dt,context){for(const p of this.phases)p.fn(dt,context);this.time+=dt;this.tick++;return this}
}
export function createRuntime(options={}){const store=new EntityStore(),fields=new FieldGrid(options.cols||64,options.rows||36,options.width||640,options.height||360),energy=new EnergyEngine(fields),spatial=new SpatialIndex(options.cellSize||24),interactions=new PairEngine(),constraints=interactions,rules=new RuleEngine({random:options.random,energy}),graph=new GraphEngine(store),topology=graph,scheduler=new Scheduler();fields.define('heat',0,{unit:'energy',diffusion:options.diffusion??.08});scheduler.add('reactions',(dt)=>rules.run(store,dt),options.reactionPriority??10).add('field-transport',(dt)=>fields.transport(dt),options.fieldPriority??20);return{store,energy,fields,spatial,interactions,constraints,rules,graph,topology,scheduler,step(dt=1){spatial.rebuild(store.entities.values());interactions.apply(store,spatial,dt);constraints.solve(store,options.constraintIterations||1);for(const e of store.entities.values()){if(e.state!=='active')continue;const p=e.properties;p.vx=num(p.vx);p.vy=num(p.vy);p.x=num(p.x)+p.vx*dt;p.y=num(p.y)+p.vy*dt}scheduler.step(dt,this);return this}}}
