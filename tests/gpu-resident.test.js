import test from 'node:test';
import assert from 'node:assert/strict';
import {packResidentParticles,RESIDENT_PARTICLE_STRIDE,RESIDENT_PARTICLE_BYTES,RESIDENT_PHYSICS_WGSL} from '../src/gpu/resident.js';
const active=e=>e.state==='active';
const entities=[
 {id:12,type:'quark',state:'active',properties:{x:2,y:3,vx:4,vy:5,charge:-1,mass:2}},
 {id:13,type:'electron',state:'active',parent:12,properties:{x:2,y:3,charge:-1,mass:1}},
 {id:14,type:'neutral',state:'active',properties:{x:1,y:1,charge:0,mass:1}},
 {id:15,type:'bad',state:'active',properties:{x:NaN,y:1,charge:1,mass:1}},
 {id:16,type:'badmass',state:'active',properties:{x:1,y:1,charge:1,mass:0}},
 {id:17,type:'inactive',state:'inactive',properties:{x:1,y:1,charge:1,mass:1}},
];
test('resident packing selects finite, active, charged root particles and stores ids as uints',()=>{
 const p=packResidentParticles(entities,active);assert.equal(p.count,1);assert.deepEqual(p.ids,[12]);assert.equal(p.data.byteLength,RESIDENT_PARTICLE_BYTES);assert.equal(RESIDENT_PARTICLE_STRIDE,8);assert.deepEqual(Array.from(p.data.slice(0,6)),[2,3,4,5,-1,2]);assert.equal(new Uint32Array(p.data.buffer)[6],12);
});
test('resident packing accepts EntityStore wrappers and missing velocities',()=>{
 const wrapper={entities:new Map([[1,{id:1,state:'active',properties:{x:8,y:9,charge:2,mass:1}}]])};const p=packResidentParticles(wrapper,active);assert.equal(p.count,1);assert.deepEqual(Array.from(p.data.slice(0,4)),[8,9,0,0]);
});
test('resident WGSL keeps position and velocity on-device and shares a linked-cell grid',()=>{
 for(const token of ['clearCells','insertParticles','integrateCharged','atomicExchange','atomicLoad','particles[i].velocity=v','particles[i].position=pos'])assert.ok(RESIDENT_PHYSICS_WGSL.includes(token),`missing ${token}`);
});

test('resident packer reuses caller storage while returning a compact active view',()=>{
 const first=packResidentParticles(entities,active);const second=packResidentParticles(entities,active,first);assert.equal(second.storage,first.storage);assert.equal(second.count,first.count);assert.equal(second.data.length,second.count*RESIDENT_PARTICLE_STRIDE);assert.deepEqual(second.ids,first.ids);
});

test('resident packer grows safely for large generic iterables',()=>{
 const generated=(function*(){for(let i=0;i<130;i++)yield {id:i,state:'active',properties:{x:i,y:i,charge:1,mass:1}}})();
 const p=packResidentParticles(generated,active);assert.equal(p.count,130);assert.equal(p.ids[129],129);assert.equal(p.data.length,130*RESIDENT_PARTICLE_STRIDE);
});

test('resident packer rejects a missing activity predicate',()=>{
 assert.throws(()=>packResidentParticles([],null),/isActive must be a function/);
});

test('resident physics options normalize dimensions and reject invalid grids',async()=>{
 const {normalizeResidentPhysicsOptions}=await import('../src/gpu/resident.js');
 const p=normalizeResidentPhysicsOptions({radius:10,worldWidth:101,worldHeight:51,softening:0,maxAcceleration:-1},0.25);
 assert.deepEqual([p.gridCols,p.gridRows,p.gridCount,p.softening,p.maxAcceleration,p.dt],[11,6,66,0.001,0,0.25]);
 const fallback=normalizeResidentPhysicsOptions({radius:0,worldWidth:Infinity,worldHeight:NaN});assert.deepEqual([fallback.radius,fallback.worldWidth,fallback.worldHeight],[0.001,0.001,0.001]);
});

test('resident snapshots apply only to live root entities with finite state',async()=>{
 const {applyResidentSnapshot}=await import('../src/gpu/resident.js');
 const store=new Map([[1,{id:1,state:'active',properties:{}}],[2,{id:2,state:'inactive',properties:{}}],[3,{id:3,state:'active',parent:1,properties:{}}],[4,{id:4,state:'active',properties:{}}]]);
 const ids=[1,2,3,4],data=new Float32Array(32);for(let i=0;i<4;i++){data[i*8]=i+10;data[i*8+1]=i+20;data[i*8+2]=i+30;data[i*8+3]=i+40;}data[24]=NaN;
 const result=applyResidentSnapshot(store,ids,data,4,active);assert.deepEqual(result,{applied:1,stale:3});assert.deepEqual([store.get(1).properties.x,store.get(1).properties.y,store.get(1).properties.vx,store.get(1).properties.vy],[10,20,30,40]);
});

test('resident snapshot application rejects malformed payloads',async()=>{
 const {applyResidentSnapshot}=await import('../src/gpu/resident.js');assert.throws(()=>applyResidentSnapshot(new Map(),[1],new Float32Array(2),1,active),/shape is invalid/);
});
