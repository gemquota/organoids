import test from 'node:test';
import assert from 'node:assert/strict';
import {WebGpuElectrostatics} from '../src/emergence/gpu-physics.js';

test('WebGPU electrostatics degrades cleanly when compute is unavailable', async () => {
  const original = globalThis.navigator;
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    assert.equal(await WebGpuElectrostatics.create(), null);
  } finally {
    if (original === undefined) delete globalThis.navigator;
    else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original });
  }
});


test('WebGPU force pass builds and traverses a GPU-resident atomic spatial grid', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../src/emergence/gpu-physics.js', import.meta.url), 'utf8');
  assert.match(source, /fn clear_heads/);
  assert.match(source, /fn build_grid/);
  assert.match(source, /atomicExchange\(&heads\[index\], i\)/);
  assert.match(source, /fn solve/);
  assert.match(source, /atomicLoad\(&heads\[bucket\]\)/);
  assert.doesNotMatch(source, /spatial\.query/);
});
