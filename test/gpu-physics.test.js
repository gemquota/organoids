import test from 'node:test';
import assert from 'node:assert/strict';
import {
  packElectrostaticParticles,
  applyElectrostaticDeltas,
  ELECTROSTATICS_WGSL,
  INPUT_BYTES,
  OUTPUT_BYTES,
} from '../src/gpu/physics.js';

const active = entity => entity.state === 'active';

test('packs only active, charged, root entities for electrostatics', () => {
  const entities = new Map([
    [1, {id: 1, state: 'active', properties: {x: 2, y: 3, vx: 4, vy: 5, charge: -1, mass: 2}}],
    [2, {id: 2, state: 'active', properties: {x: 7, y: 8, charge: 0, mass: 1}}],
    [3, {id: 3, state: 'inactive', properties: {x: 9, y: 10, charge: 1, mass: 1}}],
    [4, {id: 4, state: 'active', parent: 1, properties: {x: 1, y: 1, charge: 1, mass: 1}}},
  ]);
  const {data, ids, count} = packElectrostaticParticles(entities, active);
  assert.equal(count, 1);
  assert.deepEqual(ids, [1]);
  assert.equal(data[0], 2);
  assert.equal(data[1], 3);
  assert.equal(data[2], 4);
  assert.equal(data[3], 5);
  assert.equal(data[4], -1);
  assert.equal(data[5], 2);
  assert.equal(INPUT_BYTES, 32);
  assert.equal(OUTPUT_BYTES, 16);
});

test('uses finite defaults and excludes entities without positions', () => {
  const {data, ids, count} = packElectrostaticParticles([
    {id: 1, state: 'active', properties: {x: 1, y: 2, charge: 1}},
    {id: 2, state: 'active', properties: {x: NaN, y: 2, charge: 1}},
  ], active);
  assert.equal(count, 1);
  assert.deepEqual(ids, [1]);
  assert.equal(data[2], 0);
  assert.equal(data[3], 0);
  assert.equal(data[5], 1);
});

test('applies asynchronous velocity deltas to surviving active entities', () => {
  const store = new Map([
    [1, {id: 1, state: 'active', properties: {vx: 1, vy: 2}}],
    [2, {id: 2, state: 'inactive', properties: {vx: 3, vy: 4}}],
  ]);
  const applied = applyElectrostaticDeltas(
    store,
    [1, 2, 3],
    new Float32Array([0.5, -0.25, 9, 9, 1, 1]),
    active,
  );
  assert.equal(applied, 1);
  assert.equal(store.get(1).properties.vx, 1.5);
  assert.equal(store.get(1).properties.vy, 1.75);
  assert.equal(store.get(2).properties.vx, 3);
});

test('WGSL computes pairwise Coulomb-like velocity deltas on the GPU', () => {
  assert.match(ELECTROSTATICS_WGSL, /@compute @workgroup_size\(64\)/);
  assert.match(ELECTROSTATICS_WGSL, /params\.strength \* product/);
  assert.match(ELECTROSTATICS_WGSL, /deltas\[i\]/);
});
