import test from 'node:test';
import assert from 'node:assert/strict';
import {EntityStore,SpatialIndex,FieldGrid,InteractionEngine,ConstraintEngine,EnergyEngine,RuleEngine,GraphEngine,TopologyEngine,Scheduler} from '../emergence.js';

test('recursive composition, cycle prevention and snapshots',()=>{
  const s=new EntityStore(),p=s.create('particle'),m=s.create('molecule'),c=s.create('cell');
  s.compose(m.id,p.id);s.compose(c.id,m.id);
  assert.deepEqual(s.descendants(c.id),[m.id,p.id]);
  assert.throws(()=>s.compose(p.id,c.id),/cycle/i);
  assert.deepEqual(EntityStore.restore(s.snapshot()).descendants(c.id),[m.id,p.id]);
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
  new ConstraintEngine([{a:a.id,b:b.id,rest:4,stiffness:.5}]).solve(s,2);
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
  const g=new GraphEngine(s);assert.deepEqual(g.components('unit'),[[a.id,b.id,c.id]]);assert.equal(g.hasCycle([a.id,b.id,c.id]),true);
});
test('topology composes structures and scheduler preserves phase order',()=>{
  const s=new EntityStore(),a=s.create('unit'),b=s.create('unit'),c=s.create('unit');s.link(a.id,b.id);s.link(b.id,c.id);s.link(c.id,a.id);
  const t=new TopologyEngine(s),root=t.assemble('colony',[a.id,b.id,c.id]);assert.equal(t.closed(root.id),true);
  const q=new Scheduler(),order=[];q.add('late',()=>order.push('late'),10).add('early',()=>order.push('early'),-1);q.step(.5,{});
  assert.deepEqual(order,['early','late']);assert.equal(q.tick,1);
});