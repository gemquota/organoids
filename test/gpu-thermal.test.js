import test from 'node:test';
import assert from 'node:assert/strict';
import {packThermalParticles, unpackThermalCandidates, THERMAL_CANDIDATES_WGSL, MAX_THERMAL_CANDIDATES} from '../src/gpu/thermal.js';

const active = entity => entity.state === 'active';
const particle = (id, x, heatCapacity = 1, parent = null) => ({id, type: 'particle', state: 'active', parent, properties: {x, y: 0, heatCapacity}});

test('packs active root entities with finite thermal capacity', () => {
  const entities = new Map([[1, particle(1, 0)], [2, particle(2, 2, 0)], [3, particle(3, 3, 1, 1)], [4, particle(4, NaN)]]);
  const packed = packThermalParticles(entities, active);
  assert.equal(packed.count, 1);
  assert.deepEqual(packed.ids, [1]);
  assert.equal(packed.data[0], 0);
  assert.equal(new Uint32Array(packed.data.buffer)[2], 1);
});

test('accepts the EntityStore wrapper used by the live simulation', () => {
  const entities = new Map([[7, particle(7, 4)]]);
  const packed = packThermalParticles({entities}, active);
  assert.equal(packed.count, 1);
  assert.deepEqual(packed.ids, [7]);
});

test('unpacks unique nearby pairs and falls back on overflow', () => {
  const ids = [1, 2], output = new Uint32Array(ids.length * (MAX_THERMAL_CANDIDATES + 1));
  output.fill(0xffffffff);
  for (let i = 0; i < ids.length; i++) output[i * (MAX_THERMAL_CANDIDATES + 1) + MAX_THERMAL_CANDIDATES] = 0;
  output[0] = 2;
  assert.deepEqual(unpackThermalCandidates(ids, output), [[1, 2]]);
  output[MAX_THERMAL_CANDIDATES] = 1;
  assert.equal(unpackThermalCandidates(ids, output), null);
});

test('WGSL builds a linked-cell spatial grid and bounds candidate output', () => {
  assert.match(THERMAL_CANDIDATES_WGSL, /atomicExchange/);
  assert.match(THERMAL_CANDIDATES_WGSL, /atomicLoad/);
  assert.match(THERMAL_CANDIDATES_WGSL, /findCandidates/);
  assert.match(THERMAL_CANDIDATES_WGSL, /dot\(delta, delta\) <= radiusSquared/);
});
