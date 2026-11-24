const PARTICLE_BYTES = 24;
const MAX_CANDIDATES_PER_PARTICLE = 16;
const OUTPUT_STRIDE = MAX_CANDIDATES_PER_PARTICLE + 1;

export const MOLECULAR_CANDIDATES_WGSL = `
struct Particle { position: vec2<f32>, atomicNumber: u32, id: u32, remainingValence: u32, _padding: u32 };
struct Parameters { count: u32, gridCols: u32, gridRows: u32, gridCount: u32, radius: f32, cellSize: f32, _padding: vec2<f32> };
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Parameters;
@group(0) @binding(2) var<storage, read_write> cellHeads: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> nextParticle: array<u32>;
@group(0) @binding(4) var<storage, read_write> candidates: array<u32>;

@compute @workgroup_size(64)
fn clearCells(@builtin(global_invocation_id) invocation: vec3<u32>) {
  if (invocation.x < params.gridCount) { atomicStore(&cellHeads[invocation.x], 0xffffffffu); }
}
@compute @workgroup_size(64)
fn insertParticles(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let i = invocation.x;
  if (i >= params.count) { return; }
  let position = max(particles[i].position, vec2<f32>(0.0));
  let cell = min(vec2<u32>(floor(position / params.cellSize)), vec2<u32>(params.gridCols - 1u, params.gridRows - 1u));
  let index = cell.y * params.gridCols + cell.x;
  nextParticle[i] = atomicExchange(&cellHeads[index], i);
}
@compute @workgroup_size(64)
fn findCandidates(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let i = invocation.x;
  if (i >= params.count) { return; }
  let base = i * ${OUTPUT_STRIDE}u;
  for (var slot = 0u; slot < ${MAX_CANDIDATES_PER_PARTICLE}u; slot = slot + 1u) { candidates[base + slot] = 0xffffffffu; }
  candidates[base + ${MAX_CANDIDATES_PER_PARTICLE}u] = 0u;
  let position = particles[i].position;
  let cell = min(vec2<i32>(floor(max(position, vec2<f32>(0.0)) / params.cellSize)), vec2<i32>(i32(params.gridCols - 1u), i32(params.gridRows - 1u)));
  let radiusSquared = params.radius * params.radius;
  var found = 0u;
  for (var oy = -1; oy <= 1; oy = oy + 1) {
    for (var ox = -1; ox <= 1; ox = ox + 1) {
      let neighbor = cell + vec2<i32>(ox, oy);
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= i32(params.gridCols) || neighbor.y >= i32(params.gridRows)) { continue; }
      let cellIndex = u32(neighbor.y) * params.gridCols + u32(neighbor.x);
      var j = atomicLoad(&cellHeads[cellIndex]);
      var traversed = 0u;
      loop {
        if (j == 0xffffffffu || traversed >= params.count) { break; }
        if (j > i && particles[i].remainingValence > 0u && particles[j].remainingValence > 0u) {
          let delta = particles[j].position - position;
          if (dot(delta, delta) <= radiusSquared) {
            if (found < ${MAX_CANDIDATES_PER_PARTICLE}u) {
              candidates[base + found] = particles[j].id;
              found = found + 1u;
            } else {
              candidates[base + ${MAX_CANDIDATES_PER_PARTICLE}u] = 1u;
            }
          }
        }
        j = nextParticle[j];
        traversed = traversed + 1u;
      }
    }
  }
}
`;

export function packMolecularParticles(entities, isActive) {
  const collection = entities instanceof Map ? entities : entities?.entities instanceof Map ? entities.entities : entities;
  const source = collection instanceof Map ? collection.values() : collection;
  const valence = new Map([[1, 1], [2, 0], [3, 1], [4, 2], [5, 3], [6, 4], [7, 3], [8, 2], [9, 1], [10, 0]]);
  const degree = new Map();
  for (const link of entities?.activeLinks || []) {
    if (link.type !== 'bond') continue;
    const order = Math.max(1, Number(link.properties?.order) || 1);
    degree.set(link.a, (degree.get(link.a) || 0) + order);
    degree.set(link.b, (degree.get(link.b) || 0) + order);
  }
  const records = [];
  const ids = [];
  for (const entity of source) {
    if (entity.type !== 'atom' || entity.state !== 'active' || entity.parent || !isActive(entity)) continue;
    const p = entity.properties || {};
    const atomicNumber = Number(p.atomicNumber);
    if (!Number.isInteger(entity.id) || entity.id < 0 || entity.id > 0xffffffff ||
        !Number.isFinite(+p.x) || !Number.isFinite(+p.y) || !Number.isInteger(atomicNumber) || atomicNumber < 1 || atomicNumber > 118) continue;
    const remainingValence = Math.max(0, (valence.get(atomicNumber) || 0) - (degree.get(entity.id) || 0));
    records.push([+p.x, +p.y, atomicNumber, entity.id, remainingValence, 0]);
    ids.push(entity.id);
  }
  const packed = new ArrayBuffer(records.length * PARTICLE_BYTES);
  const floats = new Float32Array(packed);
  const uints = new Uint32Array(packed);
  for (let i = 0; i < records.length; i++) {
    const offset = i * 6, record = records[i];
    floats[offset] = record[0]; floats[offset + 1] = record[1];
    uints[offset + 2] = record[2]; uints[offset + 3] = record[3];
    uints[offset + 4] = record[4]; uints[offset + 5] = record[5];
  }
  return {data: floats, ids, count: ids.length};
}

export function unpackMolecularCandidates(ids, output, overflowed = false) {
  if (overflowed) return null;
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    const base = i * OUTPUT_STRIDE;
    if (output[base + MAX_CANDIDATES_PER_PARTICLE]) return null;
    for (let slot = 0; slot < MAX_CANDIDATES_PER_PARTICLE; slot++) {
      const other = output[base + slot];
      if (other !== 0xffffffff && other !== undefined) pairs.push([ids[i], other]);
    }
  }
  return pairs;
}

export async function createGpuMolecularCandidates(device) {
  if (!device || device.destroyed) throw new Error('A live WebGPU device is required');
  const shader = device.createShaderModule({label: 'Organoids molecular neighbour search', code: MOLECULAR_CANDIDATES_WGSL});
  const layout = device.createBindGroupLayout({entries: [
    {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'read-only-storage'}},
    {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'uniform'}},
    {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'storage'}},
    {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'storage'}},
    {binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'storage'}},
  ]});
  const pipelineLayout = device.createPipelineLayout({bindGroupLayouts: [layout]});
  const clear = await device.createComputePipelineAsync({layout: pipelineLayout, compute: {module: shader, entryPoint: 'clearCells'}});
  const insert = await device.createComputePipelineAsync({layout: pipelineLayout, compute: {module: shader, entryPoint: 'insertParticles'}});
  const find = await device.createComputePipelineAsync({layout: pipelineLayout, compute: {module: shader, entryPoint: 'findCandidates'}});
  const paramsBuffer = device.createBuffer({size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  let input = null, cells = null, next = null, output = null, readback = null, bindGroup = null;
  let capacity = 0, gridCapacity = 0, pending = null, inFlight = false, destroyed = false, dispatches = 0, lastError = null;

  function ensure(count, gridCount) {
    let changed = false;
    if (count > capacity) {
      const size = Math.max(64, 2 ** Math.ceil(Math.log2(count)));
      const inputBytes = size * PARTICLE_BYTES, outputBytes = size * OUTPUT_STRIDE * 4, indexBytes = size * 4;
      if ([inputBytes, outputBytes, indexBytes].some(n => n > device.limits.maxStorageBufferBindingSize || n > device.limits.maxBufferSize)) throw new Error('Molecular candidate buffers exceed GPU limits');
      input?.destroy(); next?.destroy(); output?.destroy(); readback?.destroy();
      input = device.createBuffer({size: inputBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
      next = device.createBuffer({size: indexBytes, usage: GPUBufferUsage.STORAGE});
      output = device.createBuffer({size: outputBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});
      readback = device.createBuffer({size: outputBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ});
      capacity = size; changed = true;
    }
    if (gridCount > gridCapacity) {
      const size = Math.max(64, 2 ** Math.ceil(Math.log2(gridCount))), bytes = size * 4;
      if (bytes > device.limits.maxStorageBufferBindingSize || bytes > device.limits.maxBufferSize) throw new Error('Molecular spatial grid exceeds GPU limits');
      cells?.destroy(); cells = device.createBuffer({size: bytes, usage: GPUBufferUsage.STORAGE}); gridCapacity = size; changed = true;
    }
    if (changed) bindGroup = device.createBindGroup({layout, entries: [
      {binding: 0, resource: {buffer: input}}, {binding: 1, resource: {buffer: paramsBuffer}},
      {binding: 2, resource: {buffer: cells}}, {binding: 3, resource: {buffer: next}}, {binding: 4, resource: {buffer: output}},
    ]});
  }

  function consume() {
    if (!pending) return null;
    const result = pending; pending = null;
    return unpackMolecularCandidates(result.ids, result.output);
  }

  function dispatch(entities, isActive, options = {}) {
    if (destroyed) throw new Error('Molecular candidate pipeline was destroyed');
    if (lastError) throw lastError;
    if (inFlight || pending) return false;
    const packed = packMolecularParticles(entities, isActive);
    if (!packed.count) return false;
    const radius = Math.max(.001, Number.isFinite(options.radius) ? options.radius : 13);
    const width = Math.max(radius, Number.isFinite(options.worldWidth) ? options.worldWidth : radius);
    const height = Math.max(radius, Number.isFinite(options.worldHeight) ? options.worldHeight : radius);
    const cols = Math.max(1, Math.ceil(width / radius)), rows = Math.max(1, Math.ceil(height / radius)), gridCount = cols * rows;
    if (Math.ceil(Math.max(gridCount, packed.count) / 64) > device.limits.maxComputeWorkgroupsPerDimension) throw new Error('Molecular candidate dispatch exceeds GPU workgroup limits');
    ensure(packed.count, gridCount);
    device.queue.writeBuffer(input, 0, packed.data);
    const uniforms = new ArrayBuffer(32), u = new Uint32Array(uniforms), f = new Float32Array(uniforms);
    u[0] = packed.count; u[1] = cols; u[2] = rows; u[3] = gridCount; f[4] = radius; f[5] = radius;
    device.queue.writeBuffer(paramsBuffer, 0, uniforms);
    const encoder = device.createCommandEncoder({label: 'Organoids molecular candidate search'}), pass = encoder.beginComputePass();
    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(clear); pass.dispatchWorkgroups(Math.ceil(gridCount / 64));
    pass.setPipeline(insert); pass.dispatchWorkgroups(Math.ceil(packed.count / 64));
    pass.setPipeline(find); pass.dispatchWorkgroups(Math.ceil(packed.count / 64));
    pass.end(); encoder.copyBufferToBuffer(output, 0, readback, 0, packed.count * OUTPUT_STRIDE * 4); device.queue.submit([encoder.finish()]);
    const ids = packed.ids.slice(), count = packed.count; inFlight = true; dispatches++;
    readback.mapAsync(GPUMapMode.READ).then(() => {
      const outputData = new Uint32Array(readback.getMappedRange().slice(0)); readback.unmap();
      if (!destroyed) pending = {ids, output: outputData, count};
      inFlight = false;
    }).catch(error => { inFlight = false; lastError = error; options.onError?.(error); });
    return true;
  }
  return {dispatch, consume, get capacity() { return capacity; }, get dispatches() { return dispatches; }, get pending() { return !!pending; }, get inFlight() { return inFlight; }, get lastError() { return lastError; }, destroy() { destroyed = true; pending = null; input?.destroy(); cells?.destroy(); next?.destroy(); output?.destroy(); readback?.destroy(); paramsBuffer.destroy(); }};
}

export {MAX_CANDIDATES_PER_PARTICLE, OUTPUT_STRIDE};
