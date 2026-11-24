import test from 'node:test';
import assert from 'node:assert/strict';
import {
  packMolecularParticles,
  unpackMolecularCandidates,
  MOLECULAR_CANDIDATES_WGSL,
  MAX_CANDIDATES_PER_PARTICLE,
  OUTPUT_STRIDE,
} from '../src/gpu/molecular.js';

const active = entity => entity.state === 'active';

test('packs active, unbound atoms with finite positions and valid atomic numbers', () => {
  const entities = new Map([
    [1, {id: 1, type: 'atom', state: 'active', properties: {x: 2.5, y: 3.5, atomicNumber: 8}}],
    [2, {id: 2, type: 'atom', state: 'active', parent: 9, properties: {x: 1, y: 1, atomicNumber: 1}}],
    [3, {id: 3, type: 'atom', state: 'inactive', properties: {x: 1, y: 1, atomicNumber: 1}}],
    [4, {id: 4, type: 'quark', state: 'active', properties: {x: 1, y: 1, atomicNumber: 1}}],
    [5, {id: 5, type: 'atom', state: 'active', properties: {x: NaN, y: 1, atomicNumber: 1}}],
  ]);
  const packed = packMolecularParticles(entities, active);
  assert.equal(packed.count, 1);
  assert.deepEqual(packed.ids, [1]);
  assert.equal(packed.data[0], 2.5);
  assert.equal(packed.data[1], 3.5);
  assert.equal(new Uint32Array(packed.data.buffer)[2], 8);
  assert.equal(new Uint32Array(packed.data.buffer)[3], 1);
});

test('unpacks unique upper-triangle candidate pairs', () => {
  const ids = [11, 22, 33];
  const output = new Uint32Array(ids.length * OUTPUT_STRIDE);
  output.fill(0xffffffff);
  for (let i = 0; i < ids.length; i++) output[i * OUTPUT_STRIDE + MAX_CANDIDATES_PER_PARTICLE] = 0;
  output[0] = 22;
  output[1] = 33;
  output[OUTPUT_STRIDE] = 33;
  assert.deepEqual(unpackMolecularCandidates(ids, output), [[11, 22], [11, 33], [22, 33]]);
});

test('falls back to CPU search when a candidate row overflows its fixed capacity', () => {
  const output = new Uint32Array(OUTPUT_STRIDE);
  output.fill(0xffffffff);
  output[MAX_CANDIDATES_PER_PARTICLE] = 1;
  assert.equal(unpackMolecularCandidates([1], output), null);
  assert.equal(unpackMolecularCandidates([1], output, true), null);
});

test('WGSL builds a spatial grid and emits bounded atom-pair candidates', () => {
  assert.match(MOLECULAR_CANDIDATES_WGSL, /atomicExchange/);
  assert.match(MOLECULAR_CANDIDATES_WGSL, /atomicLoad/);
  assert.match(MOLECULAR_CANDIDATES_WGSL, /findCandidates/);
  assert.match(MOLECULAR_CANDIDATES_WGSL, /dot\(delta, delta\) <= radiusSquared/);
  assert.match(MOLECULAR_CANDIDATES_WGSL, /candidates\[base \+ 16u\] = 1u/);
});
