import test from 'node:test';
import assert from 'node:assert/strict';
import {
  packMolecularConstraints,
  applyMolecularConstraintResults,
  MOLECULAR_CONSTRAINTS_WGSL,
  MAX_BONDS_PER_PARTICLE,
} from '../src/gpu/constraints.js';

const active = entity => entity.state === 'active';
const atom = (id, x, mass = 1) => ({id, type: 'atom', state: 'active', properties: {x, y: 0, mass}});

test('packs GPU molecular bonds into particle and adjacency buffers', () => {
  const entities = new Map([[1, atom(1, 0, 12)], [2, atom(2, 10, 1)], [3, atom(3, 20, 16)]]);
  const constraints = [
    {a: 1, b: 2, rest: 5, stiffness: .5, gpu: true},
    {a: 2, b: 3, rest: 6, stiffness: .75, gpu: true},
    {a: 1, b: 3, rest: 20, stiffness: 1},
  ];
  const packed = packMolecularConstraints(entities, constraints, active);
  assert.equal(packed.count, 3);
  assert.equal(packed.bondCount, 2);
  assert.deepEqual(packed.ids, [1, 2, 3]);
  assert.equal(packed.particles[2], 12);
  assert.equal(new Uint32Array(packed.particles.buffer)[3], 1);
  assert.deepEqual([...packed.adjacency.slice(0, 8)], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...packed.adjacency.slice(8, 16)], [0, 1, 0, 0, 0, 0, 0, 0]);
});

test('GPU constraint results apply positional deltas without overwriting newer motion', () => {
  const entities = new Map([[1, atom(1, 3)], [2, atom(2, 12)]]);
  const result = {ids: [1, 2], baseline: new Float32Array([0, 0, 10, 0]), positions: new Float32Array([1, 2, 9, -1])};
  assert.equal(applyMolecularConstraintResults(result, entities, active), 2);
  assert.deepEqual([entities.get(1).properties.x, entities.get(1).properties.y], [4, 2]);
  assert.deepEqual([entities.get(2).properties.x, entities.get(2).properties.y], [11, -1]);
});

test('falls back when a particle exceeds the fixed constraint adjacency capacity', () => {
  const entities = new Map([[1, atom(1, 0)], ...Array.from({length: MAX_BONDS_PER_PARTICLE + 1}, (_, i) => [i + 2, atom(i + 2, i + 1)])]);
  const constraints = Array.from({length: MAX_BONDS_PER_PARTICLE + 1}, (_, i) => ({a: 1, b: i + 2, rest: 1, stiffness: 1, gpu: true}));
  assert.equal(packMolecularConstraints(entities, constraints, active).overflow, true);
});

test('WGSL computes mass-weighted Jacobi corrections from the bond adjacency list', () => {
  assert.match(MOLECULAR_CONSTRAINTS_WGSL, /@compute @workgroup_size\(64\)/);
  assert.match(MOLECULAR_CONSTRAINTS_WGSL, /adjacency\[i \* params\.adjacencyStride \+ slot\]/);
  assert.match(MOLECULAR_CONSTRAINTS_WGSL, /inverseMass \/ \(inverseMass \+ otherInverseMass\)/);
  assert.match(MOLECULAR_CONSTRAINTS_WGSL, /corrected\[i\] = particle\.position \+ correction/);
});
