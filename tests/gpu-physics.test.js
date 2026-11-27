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

test('TypeGPU schemas match the raw WebGPU particle and uniform memory layouts', async () => {
  const {d} = await import('typegpu');
  const {createTypeGPUSchemas} = await import('../src/emergence/gpu-physics.js');
  const schemas = createTypeGPUSchemas(d);
  assert.equal(d.sizeOf(schemas.particle), 32);
  assert.equal(d.sizeOf(schemas.params), 64);
  assert.equal(d.sizeOf(d.arrayOf(schemas.particle, 256)), 8192);
  assert.equal(d.sizeOf(d.arrayOf(schemas.vec2, 256)), 2048);
  assert.equal(d.sizeOf(d.arrayOf(schemas.atomicU32, 256)), 1024);
});

test('GPU physics uses TypeGPU typed layouts and named resource schemas', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../src/emergence/gpu-physics.js', import.meta.url), 'utf8');
  assert.match(source, /typegpu@0\.12\.11/);
  assert.match(source, /tgpu\.initFromDevice\(\{ device \}\)/);
  assert.match(source, /tgpu\.bindGroupLayout\(/);
  assert.match(source, /typedParticles/);
  assert.match(source, /typedVelocities/);
  assert.match(source, /typedHeads/);
  assert.match(source, /createPipelineLayout\(\{ bindGroupLayouts: \[rawLayout\] \}\)/);
});

test('GPU dispatch reuses bind groups and readback storage between capacity changes', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../src/emergence/gpu-physics.js', import.meta.url), 'utf8');
  assert.match(source, /this\.readbackBuffer = null/);
  assert.match(source, /this\.readbackBuffer = this\.device\.createBuffer/);
  assert.match(source, /if \(!this\.bindGroup\) this\.bindGroup = this\.device\.createBindGroup/);
  assert.doesNotMatch(source, /const readback = this\.device\.createBuffer/);
  assert.doesNotMatch(source, /createBindGroup\(\{ layout: this\.rawLayout, entries \}\)/);
});
