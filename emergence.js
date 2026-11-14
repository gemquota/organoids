// Organoids: reusable, data-driven emergence substrate.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
const clone=v=>structuredClone(v);
export const V={
  add:(a,b)=>({x:a.x+b.x,y:a.y+b.y}),
  sub:(a,b)=>({x:a.x-b.x,y:a.y-b.y}),
  scale:(a,s)=>({x:a.x*s,y:a.y*s}),
  len:a=>Math.hypot(a.x,a.y),
  norm:a=>{const n=Math.hypot(a.x,a.y)||1;return{x:a.x/n,y:a.y/n}}
};
export class EntityStore{
  constructor(){this.entities=new Map();this.links=[];this.next=1}
  create(type,properties={},options={}){const e={id:this.next++,type,properties:{...properties},state:options.state??'active',energy:num(options.energy),parent:null,children:[]};this.entities.set(e.id,e);return e}
  get(id){return this.entities.get(id)}
  remove(id,discardEnergy=false){const e=this.get(id);if(!e)return false;const children=this.links.filter(l=>l.type==='contains'&&l.a===id).map(l=>l.b);for(const c of children){const child=this.get(c);if(child){child.parent=null;child.state='active';if(!discardEnergy)child.energy+=e.energy/Math.max(1,children.length)}}this.links=this.links.filter(l=>l.a!==id&&l.b!==id);for(const n of this.entities.values()){n.children=n.children.filter(x=>x!==id);if(n.parent===id)n.parent=null}return this.entities.delete(id)}
  compose(parent,child){this.link(parent,child,'contains');return this.get(parent)}
  link(a,b,type='bond',properties={}){if(!this.get(a)||!this.get(b)||a===b)throw Error('Invalid relationship');if(type==='contains'){for(let n=this.get(a);n;n=n.parent?this.get(n.parent):null)if(n.id===b)throw Error('Composition cycle');const c=this.get(b);if(c.parent&&c.parent!==a)this.unlink(c.parent,b,'contains');c.parent=a;c.state='bound';const p=this.get(a);if(!p.children.includes(b))p.children.push(b)}if(!this.links.some(l=>l.a===a&&l.b===b&&l.type===type))this.links.push({a,b,type,properties:{...properties}});return this}
  unlink(a,b,type){const removed=this.links.filter(l=>l.type==='contains'&&((l.a===a&&l.b===b)||(l.a===b&&l.b===a))&&(!type||type==='contains'));this.links=this.links.filter(l=>!(l.a===a&&l.b===b&&(!type||l.type===type))&&!(l.a===b&&l.b===a&&(!type||l.type===type)));for(const l of removed){const p=this.get(l.a),c=this.get(l.b);if(p)p.children=p.children.filter(x=>x!==l.b);if(c&&c.parent===l.a){c.parent=null;c.state='active'}}return this}
  descendants(id){const out=[],visit=n=>{for(const c of this.links.filter(l=>l.type==='contains'&&l.a===n).map(l=>l.b)){out.push(c);visit(c)}};visit(id);return out}
  snapshot(){return{next:this.next,entities:[...this.entities.values()].map(clone),links:clone(this.links)}}
  static restore(s){const store=new EntityStore();store.next=s.next;store.entities=new Map(s.entities.map(e=>[e.id,clone(e)]));store.links=clone(s.links);return store}
  transact(actions,context={}){const snap=this.snapshot(),fields=context.fields,fieldSnap=fields?new Map([...fields.fields].map(([k,v])=>[k,Float32Array.from(v)])):null,ledgerSnap=context.energy?clone(context.energy.ledger):null,eventCount=context.events?context.events.length:0,refs={};const resolve=v=>v&&typeof v==='object'&&v.ref?refs[v.ref]:v;try{for(const a of actions){const n=resolve(a.id),from=resolve(a.from),to=resolve(a.to);switch(a.op){case'create':{const e=this.create(a.type,a.properties||{},{energy:a.energy||0,state:a.state});if(a.as)refs[a.as]=e.id;break}case'remove':if(!this.remove(n,!!a.discardEnergy))throw Error('Unknown entity '+n);break;case'set':{const e=this.get(n);if(!e)throw Error('Unknown entity '+n);e.properties[a.key]=clone(a.value);break}case'compose':this.compose(resolve(a.parent),resolve(a.child));break;case'link':this.link(from!==undefined?from:n,to!==undefined?to:resolve(a.target),a.type||'bond',a.properties||{});break;case'unlink':this.unlink(from!==undefined?from:n,to!==undefined?to:resolve(a.target),a.type);break;case'transfer':{const x=this.get(from),y=this.get(to);if(!x||!y||a.amount<0||x.energy<a.amount)throw Error('Invalid energy transfer');if(context.energy)context.energy.transfer(x,y,a.amount);else{x.energy-=a.amount;y.energy+=a.amount}break}case'deposit':{const e=this.get(n);if(!e||!context.energy)throw Error('Deposit requires energy engine');context.energy.deposit(a.field,e,a.amount);break}case'harvest':{const e=this.get(n);if(!e||!context.energy)throw Error('Harvest requires energy engine');context.energy.harvest(a.field,e,a.amount);break}case'dissipate':{const e=this.get(n);if(!e||!context.energy)throw Error('Dissipation requires energy engine');context.energy.dissipate(e,a.amount);break}case'emit':if(context.events)context.events.push(clone(a.event));break;default:throw Error('Unknown action '+a.op)}}return{ok:true,refs:refs}}catch(error){this.next=snap.next;this.entities=new Map(snap.entities.map(e=>[e.id,e]));this.links=snap.links;if(fieldSnap)fields.fields=fieldSnap;if(ledgerSnap)context.energy.ledger=ledgerSnap;if(context.events)context.events.length=eventCount;return{ok:false,error:error,refs:{}}}}
}
export class SpatialIndex{
  constructor(cell=32){this.cell=Math.max(1,cell);this.buckets=new Map()}
  key(x,y){return Math.floor(x/this.cell)+','+Math.floor(y/this.cell)}
  rebuild(entities){this.buckets.clear();for(const e of entities){if(e.state!=='active')continue;const p=e.properties;if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const k=this.key(p.x,p.y);if(!this.buckets.has(k))this.buckets.set(k,[]);this.buckets.get(k).push(e)}return this}
  query(x,y,r){const out=[],c=this.cell;for(let iy=Math.floor((y-r)/c);iy<=Math.floor((y+r)/c);iy++)for(let ix=Math.floor((x-r)/c);ix<=Math.floor((x+r)/c);ix++)for(const e of this.buckets.get(ix+','+iy)||[])if(Math.hypot(e.properties.x-x,e.properties.y-y)<=r)out.push(e);return out}
}
export class FieldGrid{
  constructor(cols,rows,width=cols,height=rows){this.cols=cols;this.rows=rows;this.width=width;this.height=height;this.fields=new Map()}
  define(name,initial=0){this.fields.set(name,new Float32Array(this.cols*this.rows).fill(initial));return this}
  index(x,y){return clamp(Math.floor(y/this.height*this.rows),0,this.rows-1)*this.cols+clamp(Math.floor(x/this.width*this.cols),0,this.cols-1)}
  add(name,x,y,value){this.fields.get(name)[this.index(x,y)]+=value;return this}
  sample(name,x,y){return this.fields.get(name)[this.index(x,y)]}
  take(name,x,y,value){const a=this.fields.get(name),i=this.index(x,y),n=Math.min(Math.max(0,value),Math.max(0,a[i]));a[i]-=n;return n}
  diffuse(name,rate){const a=this.fields.get(name),b=Float32Array.from(a),k=clamp(rate)*.25;for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++){const i=y*this.cols+x;for(const j of [x+1<this.cols?i+1:-1,y+1<this.rows?i+this.cols:-1])if(j>=0){const f=(a[j]-a[i])*k;b[i]+=f;b[j]-=f}}this.fields.set(name,b);return this}
}
class PairEngine{
  constructor(items=[]){this.rules=[];this.constraints=[];for(const item of items)(Object.hasOwn(item,'rest')?this.constraints:this.rules).push(clone(item))}
  register(rule){this.rules.push(clone(rule));return this}
  add(c){this.constraints.push(clone(c));return this}
  apply(store,index,dt=1){const force=new Map();for(const r of this.rules){for(const a of store.entities.values()){if(a.state!=='active'||(r.a!=='*'&&a.type!==r.a))continue;const p=a.properties;for(const b of index.query(p.x,p.y,r.radius)){if(a.id===b.id||b.state!=='active'||(r.b!=='*'&&b.type!==r.b)||((r.a===r.b||r.a==='*'&&r.b==='*')&&b.id<=a.id))continue;const q=b.properties,dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||.0001;if(d>r.radius)continue;const sign=r.mode==='repel'?-1:1,m=(1-d/r.radius)*num(r.strength,1)*sign*dt,fx=dx/d*m,fy=dy/d*m;for(const [e,x,y] of [[a,fx,fy],[b,-fx,-fy]]){const f=force.get(e.id)||{x:0,y:0};f.x+=x;f.y+=y;force.set(e.id,f)}}}}for(const [id,f] of force){const p=store.get(id).properties,m=Math.max(.001,num(p.mass,1));p.vx=num(p.vx)+f.x/m;p.vy=num(p.vy)+f.y/m}return force.size}
  solve(store,iterations=1){for(let n=0;n<iterations;n++)for(const c of this.constraints){const a=store.get(c.a)?.properties,b=store.get(c.b)?.properties;if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.0001,err=(d-num(c.rest))/d*clamp(num(c.stiffness,1)),ia=1/Math.max(.001,num(a.mass,1)),ib=1/Math.max(.001,num(b.mass,1)),sum=ia+ib;a.x+=dx*err*ia/sum;a.y+=dy*err*ia/sum;b.x-=dx*err*ib/sum;b.y-=dy*err*ib/sum}return this}
}
export {PairEngine as InteractionEngine,PairEngine as ConstraintEngine};
export class EnergyEngine{
  constructor(fields){this.fields=fields;this.ledger={input:0,transferred:0,converted:0,output:0,fielded:0}}
  heat(e,n){const p=e.properties||{};if(this.fields?.fields.has('heat')&&Number.isFinite(p.x)&&Number.isFinite(p.y)){this.fields.add('heat',p.x,p.y,n);this.ledger.fielded+=n}else this.ledger.output+=n;return n}
  deposit(name,e,n){n=Math.min(Math.max(0,num(n)),Math.max(0,e.energy));e.energy-=n;const p=e.properties||{};this.fields.add(name,p.x,p.y,n);this.ledger.transferred+=n;return n}
  harvest(name,e,n){const p=e.properties||{},v=this.fields.take(name,p.x,p.y,n);e.energy+=v;this.ledger.transferred+=v;return v}
  source(e,n){n=Math.max(0,num(n));e.energy+=n;this.ledger.input+=n;return n}
  transfer(a,b,n){n=clamp(n,0,Math.max(0,a.energy));a.energy-=n;b.energy+=n;this.ledger.transferred+=n;return n}
  convert(e,n,efficiency=1){n=clamp(n,0,Math.max(0,e.energy));const out=n*clamp(efficiency);e.energy+=out-n;this.ledger.converted+=out;this.heat(e,n-out);return out}
  dissipate(e,n){n=clamp(n,0,Math.max(0,e.energy));e.energy-=n;this.heat(e,n);return n}
}
export class GraphEngine{
  constructor(store){this.store=store}
  neighbours(id,type){return [...new Set(this.store.links.filter(l=>(l.a===id||l.b===id)&&(!type||l.type===type)).map(l=>l.a===id?l.b:l.a))] }
  components(type){const nodes=[...this.store.entities.values()].filter(e=>!type||e.type===type),seen=new Set(),out=[];for(const e of nodes)if(!seen.has(e.id)){const group=[],stack=[e.id];seen.add(e.id);while(stack.length){const id=stack.pop();if(!type||this.store.get(id)?.type===type)group.push(id);for(const n of this.neighbours(id))if(!seen.has(n)){seen.add(n);stack.push(n)}}out.push(group)}return out}
  hasCycle(ids){const set=new Set(ids),seen=new Set();const visit=(id,parent)=>{seen.add(id);for(const n of this.neighbours(id))if(set.has(n)){if(!seen.has(n)){if(visit(n,id))return true}else if(n!==parent)return true}return false};for(const id of ids)if(!seen.has(id)&&visit(id,null))return true;return false}
  assemble(type,ids,properties={}){const root=this.store.create(type,properties);for(const id of ids)this.store.compose(root.id,id);return root}
  closed(id){const ids=[id,...this.store.descendants(id)];return ids.length>2&&this.hasCycle(ids)}
  divide(id,groups){const parent=this.store.get(id);if(!parent)throw Error('Unknown entity');return groups.map(group=>this.assemble(parent.type,group,parent.properties))}
}
export {GraphEngine as TopologyEngine};
export class RuleEngine{
  constructor(options={}){this.rules=[];this.random=options.random||Math.random;this.energy=options.energy;this.events=[]}
  register(r){if(!r.id||!Array.isArray(r.inputs)||!Array.isArray(r.outputs))throw Error('Rule requires id, inputs and outputs');this.rules.push(clone(r));return this}
  match(e,s){if(!e)return false;if(typeof s==='string')return e.type===s;return e.type===(s.type||e.type)&&Object.entries(s.where||{}).every(([k,v])=>e.properties[k]===(typeof v==='object'?v.value:v))}
  run(store,dt=1){let count=0;for(const r of this.rules){if(this.random()>1-Math.exp(-Math.max(0,num(r.rate,1))*Math.max(0,dt)))continue;const pool=[...store.entities.values()].filter(e=>e.state==='active'),used=new Set(),chosen=[];for(const spec of r.inputs){const e=pool.find(x=>!used.has(x.id)&&this.match(x,spec));if(!e){chosen.length=0;break}chosen.push(e);used.add(e.id)}if(chosen.length!==r.inputs.length)continue;const catalysts=(r.catalysts||[]).map(spec=>pool.find(e=>this.match(e,spec)));if(catalysts.some(e=>!e))continue;if((r.conditions||[]).some(c=>{const v=chosen[c.input||0]?chosen[c.input||0].properties[c.property]:undefined;return c.op==='gt'?!(v>c.value):c.op==='eq'?v!==c.value:!(v>=c.value)}))continue;const cost=Math.max(0,num(r.energyCost)),payer=chosen[0];if(cost&&(!payer||payer.energy<cost))continue;const energy=Math.max(0,num(r.productEnergy,chosen.reduce((sum,e)=>sum+e.energy,0)-cost)),actions=[];if(cost)actions.push({op:'dissipate',id:payer.id,amount:cost});actions.push(...chosen.map(e=>({op:'remove',id:e.id,discardEnergy:true})));r.outputs.forEach((o,i)=>actions.push({op:'create',type:o.type,properties:o.properties||{},energy:num(o.energy,energy/Math.max(1,r.outputs.length)),as:'product'+i}));actions.push({op:'emit',event:{rule:r.id,inputs:chosen.map(e=>e.id),outputs:r.outputs.map((_,i)=>({ref:'product'+i}))}});const result=store.transact(actions,{energy:this.energy,fields:this.energy?this.energy.fields:null,events:this.events});if(result.ok){this.events[this.events.length-1].outputs=this.events[this.events.length-1].outputs.map(x=>result.refs[x.ref]);count++}}return count}
}
export class Scheduler{
  constructor(){this.phases=[];this.time=0;this.tick=0}
  add(name,fn,priority=0){this.phases.push({name,fn,priority,order:this.phases.length});this.phases.sort((a,b)=>a.priority-b.priority||a.order-b.order);return this}
  step(dt,context){for(const p of this.phases)p.fn(dt,context);this.time+=dt;this.tick++;return this}
}
export function createRuntime(options={}){const store=new EntityStore(),fields=new FieldGrid(options.cols||64,options.rows||36,options.width||640,options.height||360),energy=new EnergyEngine(fields),spatial=new SpatialIndex(options.cellSize||24),interactions=new PairEngine(),constraints=interactions,rules=new RuleEngine({random:options.random,energy}),graph=new GraphEngine(store),topology=graph,scheduler=new Scheduler();fields.define('heat');scheduler.add('reactions',(dt)=>rules.run(store,dt),options.reactionPriority??10).add('field-diffusion',()=>fields.diffuse('heat',options.diffusion??.08),options.fieldPriority??20);return{store,energy,fields,spatial,interactions,constraints,rules,graph,topology,scheduler,step(dt=1){spatial.rebuild(store.entities.values());interactions.apply(store,spatial,dt);constraints.solve(store,options.constraintIterations||1);for(const e of store.entities.values()){if(e.state!=='active')continue;const p=e.properties;p.vx=num(p.vx);p.vy=num(p.vy);p.x=num(p.x)+p.vx*dt;p.y=num(p.y)+p.vy*dt}scheduler.step(dt,this);return this}}}
