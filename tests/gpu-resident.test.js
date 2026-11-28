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
