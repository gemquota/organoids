import test from 'node:test';
import assert from 'node:assert/strict';
import {packParticles, BYTES_PER_PARTICLE, PARTICLE_WGSL} from '../src/gpu/renderer.js';

const active = entity => entity.state === 'active';

test('packs active entities into the GPU particle layout', () => {
  const entities = [
    {type: 'quark', state: 'active', properties: {x: 12, y: 24, mass: 4, catalogueColor: '#ff8040'}},
    {type: 'lepton', state: 'inactive', properties: {x: 1, y: 2, mass: 1}},
    {type: 'molecule', state: 'active', properties: {x: 30, y: 40, mass: 9}},
  ];
  const {data, count} = packParticles(entities, active, 0.5);
  assert.equal(count, 2);
  assert.equal(data.length, 16);
  assert.equal(data[0], 12);
  assert.equal(data[1], 24);
  assert.equal(data[2], 2.2);
  assert.equal(data[4], 1);
  assert.ok(Math.abs(data[5] - 128 / 255) < 1e-6);
  assert.equal(data[8], 30);
  assert.equal(data[12], 0.6901960784313725);
});

test('uses finite defaults for incomplete particle properties', () => {
  const {data, count} = packParticles([
    {type: 'particle', state: 'active', properties: {x: NaN, y: undefined, mass: -1}},
  ], active);
  assert.equal(count, 1);
  assert.ok([...data].every(Number.isFinite));
  assert.equal(data[0], 0);
  assert.equal(data[1], 0);
});

test('WGSL renderer declares storage-backed instanced particles', () => {
  assert.match(PARTICLE_WGSL, /var<storage, read> particles/);
  assert.match(PARTICLE_WGSL, /@builtin\(instance_index\)/);
  assert.equal(BYTES_PER_PARTICLE, 32);
});
