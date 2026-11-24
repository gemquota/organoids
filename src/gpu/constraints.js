const PARTICLE_BYTES = 16;
const BOND_BYTES = 16;
export const MAX_BONDS_PER_PARTICLE = 8;

export const MOLECULAR_CONSTRAINTS_WGSL = `
struct Particle { position: vec2<f32>, mass: f32, degree: u32 };
struct Bond { a: u32, b: u32, rest: f32, stiffness: f32 };
struct Parameters { count: u32, bondCount: u32, adjacencyStride: u32, _padding: u32 };
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read> bonds: array<Bond>;
@group(0) @binding(2) var<storage, read> adjacency: array<u32>;
@group(0) @binding(3) var<uniform> params: Parameters;
@group(0) @binding(4) var<storage, read_write> corrected: array<vec2<f32>>;

@compute @workgroup_size(64)
fn solveConstraints(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let i = invocation.x;
  if (i >= params.count) { return; }
  let particle = particles[i];
  let inverseMass = 1.0 / max(0.001, particle.mass);
  var correction = vec2<f32>(0.0);
  for (var slot = 0u; slot < particle.degree; slot = slot + 1u) {
    let bond = bonds[adjacency[i * params.adjacencyStride + slot]];
    let otherIndex = select(bond.a, bond.b, bond.a == i);
    let other = particles[otherIndex];
    let delta = other.position - particle.position;
    let distance = length(delta);
    if (distance > 0.0001) {
      let otherInverseMass = 1.0 / max(0.001, other.mass);
      let error = (distance - bond.rest) / distance * clamp(bond.stiffness, 0.0, 1.0);
      correction += delta * error * inverseMass / (inverseMass + otherInverseMass);
    }
  }
  corrected[i] = particle.position + correction;
}
`;

export function packMolecularConstraints(entities, constraints, isActive) {
  const source = entities instanceof Map ? entities.values() : entities;
  const particles = [], ids = [], indexById = new Map();
  for (const entity of source) {
    if (entity.type !== 'atom' || entity.state !== 'active' || entity.parent || !isActive(entity)) continue;
    const p = entity.properties || {}, mass = Number(p.mass);
    if (!Number.isInteger(entity.id) || entity.id < 0 || entity.id > 0xffffffff ||
        !Number.isFinite(+p.x) || !Number.isFinite(+p.y) || !Number.isFinite(mass) || mass <= 0) continue;
    indexById.set(entity.id, ids.length);
    ids.push(entity.id);
    particles.push(+p.x, +p.y, mass, 0);
  }
  const bonds = [], adjacency = Array.from({length: ids.length}, () => []);
  for (const constraint of constraints || []) {
    if (!constraint.gpu) continue;
    const a = indexById.get(constraint.a), b = indexById.get(constraint.b);
    if (a === undefined || b === undefined) continue;
    const rest = Number(constraint.rest), stiffness = Number(constraint.stiffness ?? 1);
    if (!Number.isFinite(rest) || rest < 0 || !Number.isFinite(stiffness)) continue;
    const bondIndex = bonds.length / 4;
    bonds.push(a, b, rest, stiffness);
    adjacency[a].push(bondIndex);
    adjacency[b].push(bondIndex);
    if (adjacency[a].length > MAX_BONDS_PER_PARTICLE || adjacency[b].length > MAX_BONDS_PER_PARTICLE) {
      return {overflow: true, ids, count: ids.length, bondCount: bonds.length / 4};
    }
  }
  const flatAdjacency = new Uint32Array(ids.length * MAX_BONDS_PER_PARTICLE);
  for (let i = 0; i < adjacency.length; i++) {
    particles[i * 4 + 3] = adjacency[i].length;
    flatAdjacency.set(adjacency[i], i * MAX_BONDS_PER_PARTICLE);
  }
  const particleData = new Float32Array(particles);
  const particleWords = new Uint32Array(particleData.buffer);
  for (let i = 0; i < adjacency.length; i++) particleWords[i * 4 + 3] = adjacency[i].length;
  const bondBuffer = new ArrayBuffer(bonds.length * 4);
  const bondFloats = new Float32Array(bondBuffer), bondInts = new Uint32Array(bondBuffer);
  for (let i = 0; i < bonds.length; i += 4) {
    bondInts[i] = bonds[i]; bondInts[i + 1] = bonds[i + 1];
    bondFloats[i + 2] = bonds[i + 2]; bondFloats[i + 3] = bonds[i + 3];
  }
  return {ids, count: ids.length, bondCount: bonds.length / 4, particles: particleData, bonds: bondFloats, adjacency: flatAdjacency};
}

export function applyMolecularConstraintResults(result, entities, isActive) {
  if (!result) return 0;
  let applied = 0;
  for (let i = 0; i < result.ids.length; i++) {
    const entity = entities.get(result.ids[i]);
    if (!entity || entity.type !== 'atom' || entity.parent || !isActive(entity)) continue;
    const offset = i * 2, dx = result.positions[offset] - result.baseline[offset], dy = result.positions[offset + 1] - result.baseline[offset + 1];
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
    entity.properties.x += dx;
    entity.properties.y += dy;
    applied++;
  }
  return applied;
}

export async function createGpuMolecularConstraints(device) {
  if (!device || device.destroyed) throw new Error('A live WebGPU device is required');
  const shader = device.createShaderModule({label: 'Organoids molecular bond constraints', code: MOLECULAR_CONSTRAINTS_WGSL});
  const layout = device.createBindGroupLayout({entries: [
    {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'read-only-storage'}},
    {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'read-only-storage'}},
    {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'read-only-storage'}},
    {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'uniform'}},
    {binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'storage'}},
  ]});
  const pipeline = await device.createComputePipelineAsync({
    layout: device.createPipelineLayout({bindGroupLayouts: [layout]}),
    compute: {module: shader, entryPoint: 'solveConstraints'},
  });
  const paramsBuffer = device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  let particleBuffer = null, bondBuffer = null, adjacencyBuffer = null, outputBuffer = null, readbackBuffer = null, bindGroup = null;
  let particleCapacity = 0, bondCapacity = 0, pending = null, inFlight = false, destroyed = false, dispatches = 0, lastError = null;

  function ensure(count, bondCount) {
    let changed = false;
    if (count > particleCapacity) {
      const size = Math.max(64, 2 ** Math.ceil(Math.log2(count)));
      const particleBytes = size * PARTICLE_BYTES, adjacencyBytes = size * MAX_BONDS_PER_PARTICLE * 4, outputBytes = size * 8;
      if ([particleBytes, adjacencyBytes, outputBytes].some(n => n > device.limits.maxStorageBufferBindingSize || n > device.limits.maxBufferSize)) throw new Error('Molecular constraint particle buffers exceed GPU limits');
      particleBuffer?.destroy(); adjacencyBuffer?.destroy(); outputBuffer?.destroy(); readbackBuffer?.destroy();
      particleBuffer = device.createBuffer({size: particleBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
      adjacencyBuffer = device.createBuffer({size: adjacencyBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
      outputBuffer = device.createBuffer({size: outputBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});
      readbackBuffer = device.createBuffer({size: outputBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ});
      particleCapacity = size; changed = true;
    }
    if (bondCount > bondCapacity) {
      const size = Math.max(64, 2 ** Math.ceil(Math.log2(bondCount))), bytes = size * BOND_BYTES;
      if (bytes > device.limits.maxStorageBufferBindingSize || bytes > device.limits.maxBufferSize) throw new Error('Molecular constraint bond buffer exceeds GPU limits');
      bondBuffer?.destroy(); bondBuffer = device.createBuffer({size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
      bondCapacity = size; changed = true;
    }
    if (changed) bindGroup = device.createBindGroup({layout, entries: [
      {binding: 0, resource: {buffer: particleBuffer}}, {binding: 1, resource: {buffer: bondBuffer}},
      {binding: 2, resource: {buffer: adjacencyBuffer}}, {binding: 3, resource: {buffer: paramsBuffer}},
      {binding: 4, resource: {buffer: outputBuffer}},
    ]});
  }

  function consume(entities, isActive) {
    if (!pending) return false;
    const result = pending; pending = null;
    applyMolecularConstraintResults(result, entities, isActive);
    return true;
  }

  function dispatch(entities, constraints, isActive, options = {}) {
    if (destroyed) throw new Error('Molecular constraint pipeline was destroyed');
    if (lastError) throw lastError;
    if (inFlight || pending) return false;
    const packed = packMolecularConstraints(entities, constraints, isActive);
    if (packed.overflow) throw new Error('Molecular constraint adjacency capacity exceeded; use CPU solver');
    if (!packed.count || !packed.bondCount) return false;
    if (Math.ceil(packed.count / 64) > device.limits.maxComputeWorkgroupsPerDimension) throw new Error('Molecular constraint dispatch exceeds GPU workgroup limits');
    ensure(packed.count, packed.bondCount);
    const baseline = new Float32Array(packed.count * 2);
    for (let i = 0; i < packed.count; i++) { baseline[i * 2] = packed.particles[i * 4]; baseline[i * 2 + 1] = packed.particles[i * 4 + 1]; }
    device.queue.writeBuffer(particleBuffer, 0, packed.particles);
    device.queue.writeBuffer(bondBuffer, 0, packed.bonds);
    device.queue.writeBuffer(adjacencyBuffer, 0, packed.adjacency);
    const uniforms = new Uint32Array([packed.count, packed.bondCount, MAX_BONDS_PER_PARTICLE, 0]);
    device.queue.writeBuffer(paramsBuffer, 0, uniforms);
    const encoder = device.createCommandEncoder({label: 'Organoids molecular constraint solve'}), pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup); pass.dispatchWorkgroups(Math.ceil(packed.count / 64)); pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, packed.count * 8);
    device.queue.submit([encoder.finish()]);
    const ids = packed.ids.slice(); inFlight = true; dispatches++;
    readbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
      const positions = new Float32Array(readbackBuffer.getMappedRange().slice(0)); readbackBuffer.unmap();
      if (!destroyed) pending = {ids, positions, baseline};
      inFlight = false;
    }).catch(error => { inFlight = false; lastError = error; options.onError?.(error); });
    return true;
  }
  return {dispatch, consume, get dispatches() { return dispatches; }, get pending() { return !!pending; }, get inFlight() { return inFlight; }, get lastError() { return lastError; }, destroy() { destroyed = true; pending = null; particleBuffer?.destroy(); bondBuffer?.destroy(); adjacencyBuffer?.destroy(); outputBuffer?.destroy(); readbackBuffer?.destroy(); paramsBuffer.destroy(); }};
}
