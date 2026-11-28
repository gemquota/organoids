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
  assert.equal(d.sizeOf(schemas.params), 96);
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
  assert.match(source, /particles: \{ storage: d\.arrayOf\(schemas\.particle\), access: 'mutable' \}/);
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

test('GPU force signs match physical repulsion and nuclear attraction conventions', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../src/emergence/gpu-physics.js', import.meta.url), 'utf8');
  assert.match(source, /delta -= offset \/ d \* \(force \/ a\.mass\)/);
  assert.match(source, /delta \+= offset \/ d \* \(force \/ a\.mass\)/);
  assert.doesNotMatch(source, /select\(offset, -offset, i < j\)/);
});


test('GPU compute now includes position integration and returns full particle state', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../src/emergence/gpu-physics.js', import.meta.url), 'utf8');
  assert.match(source, /fn integrate_gpu/);
  assert.match(source, /particles\[i\]\.position \+= \(newVelocity - oldVelocity\) \* params\.dt/);
  assert.match(source, /dispatch\('integrate_gpu'/);
  assert.match(source, /copyBufferToBuffer\(this\.particleBuffer/);
  assert.match(source, /const k = i \* 4, p = charged\[i\]\.properties/);
  assert.match(source, /p\.x = output\[k\]; p\.y = output\[k \+ 1\]/);
  const html = readFileSync(new URL('../accretion.html', import.meta.url), 'utf8');
  assert.match(html, /gpuForceInterval\+=dt\*60/);
});


test('GPU collision stage computes mass-weighted overlap correction and inelastic impulse', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../src/emergence/gpu-physics.js', import.meta.url), 'utf8');
  assert.match(source, /fn collide_gpu/);
  assert.match(source, /invMassA \/ \(invMassA \+ invMassB\)/);
  assert.match(source, /let impulse = \(1\.0 \+ params\.restitution\) \* normalVelocity/);
  assert.match(source, /positionDelta \*= params\.maxCorrection \/ correctionLength/);
  assert.match(source, /dispatch\('collide_gpu'/);
  assert.match(source, /collisionRadius: f32, restitution: f32, maxCorrection: f32/);
});

test('GPU dispatch reuses host staging arrays and its uniform memory', async () => {
  const {readFileSync} = await import('node:fs');
  const source = readFileSync(new URL('../src/emergence/gpu-physics.js', import.meta.url), 'utf8');
  assert.match(source, /this\.inputData = new Float32Array\(this\.capacity \* 8\)/);
  assert.match(source, /this\.outputData = new Float32Array\(this\.capacity \* 4\)/);
  assert.match(source, /this\.uniformData = new ArrayBuffer\(96\)/);
  assert.match(source, /this\.device\.queue\.writeBuffer\(this\.particleBuffer, 0, input, 0, count \* 32\)/);
  assert.doesNotMatch(source, /const input = new Float32Array\(count \* 8\)/);
  assert.doesNotMatch(source, /const uniform = new ArrayBuffer\(80\)/);
});


test('GPU broadphase produces bounded thermal candidate pairs for CPU energy-ledger transfers', async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../src/emergence/gpu-physics.js',import.meta.url),'utf8');
  assert.match(source,/fn generate_thermal_pairs/);
  assert.match(source,/atomicAdd\(&thermalPairCount, 1u\)/);
  assert.match(source,/slot < params\.count \* 8u/);
  assert.match(source,/lastThermalPairs = rawPairCount > this\.thermalPairsCapacity \? null/);
  const physics=readFileSync(new URL('../src/emergence/physics.js',import.meta.url),'utf8');
  assert.match(physics,/candidatePairs.*candidateEntities/);
});

test('GPU TypeGPU layouts use aligned particle thermal fields and expanded parameters', async () => {
  const {d}=await import('typegpu');
  const {createTypeGPUSchemas}=await import('../src/emergence/gpu-physics.js');
  const s=createTypeGPUSchemas(d);
  assert.equal(d.sizeOf(s.particle),32);
  assert.equal(d.sizeOf(s.params),96);
});

test('GPU collision pass reads a stable snapshot and thermal broadphase is included', async()=>{
  const {readFileSync}=await import('node:fs');
  const s=readFileSync(new URL('../src/emergence/gpu-physics.js',import.meta.url),'utf8');
  assert.ok(s.includes("collisionSnapshot[i]"));
  assert.ok(s.includes("collisionSnapshot[j]"));
  assert.ok(s.includes("encoder.copyBufferToBuffer(this.particleBuffer, 0, this.collisionSnapshotBuffer"));
  assert.match(s,/fn generate_thermal_pairs/);
  assert.ok(s.includes("lastThermalPairs = rawPairCount > this.thermalPairsCapacity ? null"));
  assert.ok(s.includes("thermalPairReadback.mapAsync"));
});


test('GPU readback packs only position and velocity, reducing synchronization bytes',async()=>{
 const {readFileSync}=await import('node:fs');const s=readFileSync(new URL('../src/emergence/gpu-physics.js',import.meta.url),'utf8');
 assert.match(s,/fn pack_state/);assert.match(s,/packedState\[i\] = vec4f\(particles\[i\]\.position, particles\[i\]\.velocity\)/);
 assert.ok(s.includes('copyBufferToBuffer(this.packedStateBuffer, 0, this.readbackBuffer, 0, count * 16)'));
 assert.ok(s.includes('new Float32Array(this.capacity * 4)'));
});
