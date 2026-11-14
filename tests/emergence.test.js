import test from 'node:test';
import assert from 'node:assert/strict';
import {EntityStore,SpatialIndex,FieldGrid,InteractionEngine,ConstraintEngine,EnergyEngine,RuleEngine,GraphEngine,TopologyEngine,Scheduler,createRuntime} from '../emergence.js';

test('recursive composition, cycle prevention and snapshots',()=>{
  const s=new EntityStore(),p=s.create('particle'),m=s.create('molecule',{}, {energy:4}),c=s.create('cell');
  s.compose(m.id,p.id);s.compose(c.id,m.id);
  assert.deepEqual(s.descendants(c.id),[m.id,p.id]);
  assert.throws(()=>s.compose(p.id,c.id),/cycle/i);
  const restored=EntityStore.restore(s.snapshot());assert.deepEqual(restored.descendants(c.id),[m.id,p.id]);restored.remove(m.id);assert.equal(restored.get(p.id).state,'active');assert.equal(restored.get(p.id).energy,4);
});
test('spatial index returns only neighbours in radius',()=>{
  const s=new EntityStore();s.create('a',{x:2,y:3});s.create('b',{x:50,y:50});
  const i=new SpatialIndex(10).rebuild(s.entities.values());
  assert.deepEqual(i.query(0,0,8).map(e=>e.type),['a']);
});
test('field diffusion conserves total quantity',()=>{
  const f=new FieldGrid(4,4,4,4).define('heat');f.add('heat',0,0,8);
  const sum=()=>[...f.fields.get('heat')].reduce((a,b)=>a+b,0),before=sum();
  f.diffuse('heat',.5);assert.ok(Math.abs(sum()-before)<1e-6);
});
test('pair interactions apply equal and opposite forces',()=>{
  const s=new EntityStore(),a=s.create('p',{x:0,y:0,vx:0,vy:0,mass:1}),b=s.create('p',{x:5,y:0,vx:0,vy:0,mass:1}),i=new SpatialIndex(10).rebuild(s.entities.values());
  new InteractionEngine([{a:'p',b:'p',radius:10,strength:2,mode:'attract'}]).apply(s,i,1);
  assert.ok(a.properties.vx>0&&b.properties.vx<0);
  assert.ok(Math.abs(a.properties.vx+b.properties.vx)<1e-9);
});
test('distance constraints converge toward rest length',()=>{
  const s=new EntityStore(),a=s.create('p',{x:0,y:0,mass:1}),b=s.create('p',{x:10,y:0,mass:1});
  new ConstraintEngine([{a:a.id,b:b.id,rest:4,stiffness:.5}]).solve(s,4);
  assert.ok(Math.abs(Math.hypot(b.properties.x-a.properties.x,b.properties.y-a.properties.y)-4)<1);
});
test('energy ledger tracks source, transfer, conversion and dissipation',()=>{
  const e=new EnergyEngine(),a={energy:0},b={energy:0};e.source(a,5);e.transfer(a,b,2);e.convert(b,1,.5);e.dissipate(a,1);
  assert.equal(a.energy,2);assert.equal(b.energy,1.5);assert.equal(e.ledger.input,5);assert.equal(e.ledger.transferred,2);
});
test('declarative reaction consumes reactants, preserves catalyst and accounts energy',()=>{
  const s=new EntityStore(),a=s.create('A',{purity:1},{energy:3}),b=s.create('B'),cat=s.create('catalyst');
  const energy=new EnergyEngine(),rules=new RuleEngine({random:()=>0,energy});
  rules.register({id:'make-AB',inputs:['A','B'],catalysts:['catalyst'],conditions:[{input:0,property:'purity',value:1}],outputs:[{type:'AB'}],rate:10,energyCost:1});
  assert.equal(rules.run(s,1),1);assert.equal(s.get(a.id),undefined);assert.equal(s.get(b.id),undefined);
  assert.equal(s.get(cat.id).type,'catalyst');assert.equal([...s.entities.values()].find(e=>e.type==='AB').energy,2);
});
test('graph detects connected components and cycles',()=>{
  const s=new EntityStore(),a=s.create('unit'),b=s.create('unit'),c=s.create('unit');s.link(a.id,b.id);s.link(b.id,c.id);s.link(c.id,a.id);
  const g=new GraphEngine(s);assert.deepEqual(g.components('unit').map(group=>group.sort((x,y)=>x-y)),[[a.id,b.id,c.id]]);assert.equal(g.hasCycle([a.id,b.id,c.id]),true);
});
test('topology composes structures and scheduler preserves phase order',()=>{
  const s=new EntityStore(),a=s.create('unit'),b=s.create('unit'),c=s.create('unit');s.link(a.id,b.id);s.link(b.id,c.id);s.link(c.id,a.id);
  const t=new TopologyEngine(s),root=t.assemble('colony',[a.id,b.id,c.id]);assert.equal(t.closed(root.id),true);
  const q=new Scheduler(),order=[];q.add('late',()=>order.push('late'),10).add('early',()=>order.push('early'),-1);q.step(.5,{});
  assert.deepEqual(order,['early','late']);assert.equal(q.tick,1);
});
test('pair and constraint APIs are one shared solver',()=>{
  assert.equal(InteractionEngine,ConstraintEngine);
  const s=new EntityStore(),a=s.create('p',{x:0,y:0,vx:0,vy:0,mass:1}),b=s.create('p',{x:10,y:0,vx:0,vy:0,mass:1});
  const i=new SpatialIndex(10).rebuild(s.entities.values()),solver=new InteractionEngine([{a:'p',b:'p',radius:20,strength:1}]);
  solver.add({a:a.id,b:b.id,rest:4,stiffness:.5});solver.apply(s,i,1);solver.solve(s,2);
  assert.ok(Math.abs(b.properties.x-a.properties.x)<10);
});
test('graph and topology are one composition-aware structure engine',()=>{
  const r=createRuntime(),a=r.store.create('unit'),b=r.store.create('unit'),c=r.store.create('unit');
  r.topology.assemble('colony',[a.id,b.id,c.id]);
  assert.equal(r.graph,r.topology);assert.deepEqual(r.graph.components('unit').map(x=>x.length),[3]);
  r.store.link(a.id,b.id);r.store.link(b.id,c.id);r.store.link(c.id,a.id);
  assert.equal(r.topology.closed(r.store.get(a.id).parent),true);
});
test('scheduler owns reaction and field phases',()=>{
  const r=createRuntime({random:()=>0,cols:4,rows:4,width:4,height:4});
  const a=r.store.create('A',{x:1,y:1},{energy:2}),b=r.store.create('B',{x:1,y:1});
  r.rules.register({id:'AB',inputs:['A','B'],outputs:[{type:'AB'}],rate:10,energyCost:1});
  r.step(1);assert.equal([...r.store.entities.values()].some(e=>e.type==='AB'),true);
  assert.ok(r.fields.sample('heat',1,1)>0);assert.equal(r.scheduler.tick,1);
});
test('energy and fields exchange stored quantities',()=>{
  const r=createRuntime({cols:2,rows:2,width:2,height:2}),e=r.store.create('unit',{x:0,y:0},{energy:5});
  r.energy.deposit('heat',e,3);assert.equal(e.energy,2);assert.equal(r.energy.harvest('heat',e,2),2);
  assert.equal(e.energy,4);assert.ok(r.fields.sample('heat',0,0)>0);
});

test('typed relationship edges are canonical and containment is acyclic',()=>{
 const s=new EntityStore(),root=s.create('cell'),a=s.create('molecule'),b=s.create('particle');
 s.link(root.id,a.id,'contains');s.link(a.id,b.id,'contains');s.link(root.id,b.id,'signals',{strength:2});
 assert.deepEqual(s.descendants(root.id),[a.id,b.id]);assert.throws(()=>s.link(b.id,root.id,'contains'),/cycle/i);
 assert.equal(s.links.filter(l=>l.type==='contains').length,2);s.unlink(a.id,b.id,'contains');assert.equal(s.get(b.id).parent,null);assert.deepEqual(s.descendants(root.id),[a.id]);
});
test('entity transactions commit typed actions and roll back all state on failure',()=>{
 const s=new EntityStore(),a=s.create('cell',{x:1,y:2},{energy:5}),b=s.create('cell'),f=new FieldGrid(2,2,2,2).define('heat'),energy=new EnergyEngine(f),events=[];
 const ok=s.transact([{op:'transfer',from:a.id,to:b.id,amount:2},{op:'create',type:'molecule',as:'m'},{op:'link',from:a.id,to:{ref:'m'},type:'bond'},{op:'deposit',id:a.id,field:'heat',amount:1}],{energy,fields:f,events});
 assert.equal(ok.ok,true);assert.equal(s.get(a.id).energy,2);assert.equal(s.get(b.id).energy,2);assert.equal(s.links.at(-1).type,'bond');
 const before=s.snapshot(),heat=[...f.fields.get('heat')],ledger=structuredClone(energy.ledger);
 const bad=s.transact([{op:'set',id:a.id,key:'x',value:99},{op:'remove',id:999}],{energy,fields:f,events});
 assert.equal(bad.ok,false);assert.deepEqual(s.snapshot(),before);assert.deepEqual([...f.fields.get('heat')],heat);assert.deepEqual(energy.ledger,ledger);
});
test('reaction action batches are atomic and emit resolved product identities',()=>{
 const s=new EntityStore(),a=s.create('A',{purity:1,x:0,y:0},{energy:3}),b=s.create('B'),cat=s.create('catalyst'),fields=new FieldGrid(2,2,2,2).define('heat'),energy=new EnergyEngine(fields),rules=new RuleEngine({random:()=>0,energy});
 rules.register({id:'make',inputs:['A','B'],catalysts:['catalyst'],energyCost:1,outputs:[{type:'AB'}],rate:10});
 assert.equal(rules.run(s,1),1);assert.equal(s.get(a.id),undefined);assert.equal(s.get(b.id),undefined);assert.equal(s.get(cat.id).type,'catalyst');
 const event=rules.events[0],product=s.get(event.outputs[0]);assert.equal(product.type,'AB');assert.equal(product.energy,2);assert.equal(energy.ledger.fielded,1);
});

test('reaction consumption conserves energy when reactants contain components',()=>{
 const s=new EntityStore(),a=s.create('A',{x:0,y:0},{energy:3}),part=s.create('part',{}, {energy:1}),b=s.create('B'),f=new FieldGrid(2,2,2,2).define('heat'),energy=new EnergyEngine(f),rules=new RuleEngine({random:()=>0,energy});
 s.compose(a.id,part.id);rules.register({id:'consume',inputs:['A','B'],energyCost:1,outputs:[{type:'AB'}],rate:10});
 assert.equal(rules.run(s,1),1);const product=s.get(rules.events[0].outputs[0]);
 assert.equal(s.get(part.id).energy,1);assert.equal(product.energy,2);assert.equal(energy.ledger.fielded,1);
 assert.equal(s.get(part.id).state,'active');
});

test('relationship schemas index direction and symmetric adjacency',()=>{
 const s=new EntityStore(),a=s.create('cell'),b=s.create('cell'),c=s.create('cell');
 s.defineRelation('signals',{direction:'directed'}).link(a.id,b.id,'signals').link(b.id,c.id,'bond');
 assert.deepEqual(s.outgoing(a.id,'signals'),[b.id]);assert.deepEqual(s.incoming(b.id,'signals'),[a.id]);
 assert.deepEqual(s.outgoing(b.id,'bond'),[c.id]);assert.deepEqual(s.incoming(c.id,'bond'),[b.id]);
 assert.deepEqual(s.neighbours(c.id,'bond'),[b.id]);
});
test('containment cardinality reparents safely and rejects cycles',()=>{
 const s=new EntityStore(),a=s.create('cell'),b=s.create('cell'),c=s.create('molecule');
 s.compose(a.id,c.id);s.compose(b.id,c.id);assert.equal(s.get(c.id).parent,b.id);
 assert.deepEqual(s.descendants(a.id),[]);assert.deepEqual(s.descendants(b.id),[c.id]);
 assert.throws(()=>s.compose(c.id,b.id),/cycle/i);
});
test('failed transactions preserve entity, property and field-array identity',()=>{
 const s=new EntityStore(),a=s.create('cell',{x:1},{energy:3}),entity=a,props=a.properties;
 const f=new FieldGrid(2,2,2,2).define('heat'),array=f.fields.get('heat'),energy=new EnergyEngine(f);
 const result=s.transact([{op:'set',id:a.id,key:'x',value:9},{op:'deposit',id:a.id,field:'heat',amount:1},{op:'remove',id:999}],{energy,fields:f});
 assert.equal(result.ok,false);assert.equal(s.get(a.id),entity);assert.equal(entity.properties,props);assert.equal(props.x,1);
 assert.equal(f.fields.get('heat'),array);assert.equal(array.reduce((x,y)=>x+y,0),0);
});
test('wildcard pair matching processes each unordered pair once',()=>{
 const s=new EntityStore(),a=s.create('A',{x:0,y:0,vx:0,vy:0,mass:1}),b=s.create('A',{x:5,y:0,vx:0,vy:0,mass:1});
 const i=new SpatialIndex(10).rebuild(s.entities.values()),solver=new InteractionEngine([{a:'*',b:'A',radius:10,strength:1}]);
 solver.apply(s,i,1);assert.ok(Math.abs(a.properties.vx-.5)<1e-9);assert.ok(Math.abs(b.properties.vx+.5)<1e-9);
});
test('assembly rolls back its new root when a member is invalid',()=>{
 const s=new EntityStore(),a=s.create('unit'),g=new GraphEngine(s),before=s.entities.size;
 assert.throws(()=>g.assemble('colony',[a.id,999]));assert.equal(s.entities.size,before);
});
