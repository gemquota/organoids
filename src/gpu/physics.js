const ELECTROSTATICS_WGSL = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  charge: f32,
  mass: f32,
  id: u32,
  _padding: u32,
};

struct Parameters {
  count: u32,
  gridCols: u32,
  gridRows: u32,
  gridCount: u32,
  radius: f32,
  strength: f32,
  softening: f32,
  maxAcceleration: f32,
  dt: f32,
  cellSize: f32,
  _padding: vec2<f32>,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> deltas: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: Parameters;
@group(0) @binding(3) var<storage, read_write> cellHeads: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> nextParticle: array<u32>;

@compute @workgroup_size(64)
fn clearCells(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let cell = invocation.x;
  if (cell < params.gridCount) {
    atomicStore(&cellHeads[cell], 0xffffffffu);
  }
}

@compute @workgroup_size(64)
fn insertParticles(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let i = invocation.x;
  if (i >= params.count) { return; }
  let position = max(particles[i].position, vec2<f32>(0.0));
  let cell = min(
    vec2<u32>(floor(position / params.cellSize)),
    vec2<u32>(params.gridCols - 1u, params.gridRows - 1u)
  );
  let cellIndex = cell.y * params.gridCols + cell.x;
  nextParticle[i] = atomicExchange(&cellHeads[cellIndex], i);
}

@compute @workgroup_size(64)
fn electrostatics(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let i = invocation.x;
  if (i >= params.count) { return; }

  let a = particles[i];
  let mass = max(0.001, a.mass);
  let radiusSquared = params.radius * params.radius;
  let softeningSquared = params.softening * params.softening;
  let position = max(a.position, vec2<f32>(0.0));
  let cell = min(
    vec2<i32>(floor(position / params.cellSize)),
    vec2<i32>(i32(params.gridCols - 1u), i32(params.gridRows - 1u))
  );
  var acceleration = vec2<f32>(0.0, 0.0);

  for (var oy = -1; oy <= 1; oy = oy + 1) {
    for (var ox = -1; ox <= 1; ox = ox + 1) {
      let neighbor = cell + vec2<i32>(ox, oy);
      if (neighbor.x < 0 || neighbor.y < 0 ||
          neighbor.x >= i32(params.gridCols) || neighbor.y >= i32(params.gridRows)) {
        continue;
      }
      let cellIndex = u32(neighbor.y) * params.gridCols + u32(neighbor.x);
      var j = atomicLoad(&cellHeads[cellIndex]);
      var traversed = 0u;
      loop {
        if (j == 0xffffffffu || traversed >= params.count) { break; }
        if (j != i) {
          let b = particles[j];
          let product = a.charge * b.charge;
          if (abs(product) >= 0.000000001) {
            let displacement = b.position - a.position;
            let distanceSquared = dot(displacement, displacement);
            if (distanceSquared <= radiusSquared) {
              let distance = sqrt(distanceSquared);
              let safeDistance = max(distance, params.softening);
              let magnitude = params.strength * product / (distanceSquared + softeningSquared);
              let force = sign(magnitude) * min(params.maxAcceleration * mass, abs(magnitude));
              acceleration -= displacement / safeDistance * (force / mass);
            }
          }
        }
        j = nextParticle[j];
        traversed = traversed + 1u;
      }
    }
  }

  deltas[i] = vec4<f32>(acceleration * params.dt, 0.0, 0.0);
}
`;

const FLOATS_PER_INPUT = 8;
const INPUT_BYTES = FLOATS_PER_INPUT * Float32Array.BYTES_PER_ELEMENT;
const OUTPUT_BYTES = 16;

export function packElectrostaticParticles(entities, isActive, target = null) {
  const source = entities instanceof Map ? entities : Array.from(entities);
  const isMap = entities instanceof Map;
  const capacity = isMap ? source.size : source.length;
  const storage = target && target.length >= capacity * FLOATS_PER_INPUT
    ? target
    : new Float32Array(capacity * FLOATS_PER_INPUT);
  const uints = new Uint32Array(storage.buffer, storage.byteOffset, storage.length);
  const ids = [];
  let count = 0;

  for (const entry of source) {
    const entity = isMap ? entry[1] : entry;
    if (!isActive(entity) || entity.parent) continue;
    const p = entity.properties || {};
    const charge = Number.isFinite(+p.charge) ? +p.charge : 0;
    if (Math.abs(charge) < 1e-9 || !Number.isFinite(+p.x) || !Number.isFinite(+p.y)) continue;

    const offset = count++ * FLOATS_PER_INPUT;
    storage[offset] = +p.x;
    storage[offset + 1] = +p.y;
    storage[offset + 2] = Number.isFinite(+p.vx) ? +p.vx : 0;
    storage[offset + 3] = Number.isFinite(+p.vy) ? +p.vy : 0;
    storage[offset + 4] = charge;
    storage[offset + 5] = Math.max(0.001, Number.isFinite(+p.mass) ? +p.mass : 1);
    uints[offset + 6] = Number.isSafeInteger(entity.id) && entity.id >= 0 ? entity.id : 0;
    uints[offset + 7] = 0;
    ids.push(entity.id);
  }

  return {data: storage.subarray(0, count * FLOATS_PER_INPUT), storage, ids, count};
}

export function applyElectrostaticDeltas(store, ids, deltas, isActive) {
  let applied = 0;
  for (let i = 0; i < ids.length; i++) {
    const entity = store.get(ids[i]);
    if (!entity || !isActive(entity) || entity.parent) continue;
    const p = entity.properties;
    p.vx = (Number.isFinite(+p.vx) ? +p.vx : 0) + deltas[i * 4];
    p.vy = (Number.isFinite(+p.vy) ? +p.vy : 0) + deltas[i * 4 + 1];
    applied++;
  }
  return applied;
}

export async function createGpuElectrostatics(device, options = {}) {
  if (!device || device.destroyed) throw new Error('A live WebGPU device is required');
  const shader = device.createShaderModule({label: 'Organoids electrostatics compute', code: ELECTROSTATICS_WGSL});
  const bindGroupLayout = device.createBindGroupLayout({entries: [
    {binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'read-only-storage'}},
    {binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'storage'}},
    {binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'uniform'}},
    {binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'storage'}},
    {binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: {type: 'storage'}},
  ]});
  const layout = device.createPipelineLayout({bindGroupLayouts: [bindGroupLayout]});
  const clearPipeline = await device.createComputePipelineAsync({label: 'Clear electrostatics grid', layout, compute: {module: shader, entryPoint: 'clearCells'}});
  const insertPipeline = await device.createComputePipelineAsync({label: 'Build electrostatics grid', layout, compute: {module: shader, entryPoint: 'insertParticles'}});
  const forcePipeline = await device.createComputePipelineAsync({label: 'Spatial electrostatics', layout, compute: {module: shader, entryPoint: 'electrostatics'}});

  const paramsBuffer = device.createBuffer({
    label: 'Electrostatics parameters',
    size: 48,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let inputBuffer = null;
  let outputBuffer = null;
  let readbackBuffer = null;
  let nextBuffer = null;
  let cellBuffer = null;
  let bindGroup = null;
  let capacity = 0;
  let gridCapacity = 0;
  let packedStorage = new Float32Array(0);
  let pending = null;
  let inFlight = false;
  let destroyed = false;
  let dispatches = 0;
  let lastError = null;

  function ensureCapacity(count, gridCount) {
    let changed = false;
    if (count > capacity) {
      const next = Math.max(64, 2 ** Math.ceil(Math.log2(count)));
      const inputSize = next * INPUT_BYTES;
      const outputSize = next * OUTPUT_BYTES;
      const indexSize = next * Uint32Array.BYTES_PER_ELEMENT;
      if (inputSize > device.limits.maxStorageBufferBindingSize ||
          outputSize > device.limits.maxStorageBufferBindingSize ||
          indexSize > device.limits.maxStorageBufferBindingSize ||
          Math.max(inputSize, outputSize, indexSize) > device.limits.maxBufferSize) {
        throw new Error('Electrostatics buffers exceed this GPU device limit');
      }
      inputBuffer?.destroy();
      outputBuffer?.destroy();
      readbackBuffer?.destroy();
      nextBuffer?.destroy();
      inputBuffer = device.createBuffer({label: 'Charged particle input', size: inputSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST});
      outputBuffer = device.createBuffer({label: 'Electrostatic velocity deltas', size: outputSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC});
      readbackBuffer = device.createBuffer({label: 'Electrostatic asynchronous readback', size: outputSize, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ});
      nextBuffer = device.createBuffer({label: 'Spatial grid particle links', size: indexSize, usage: GPUBufferUsage.STORAGE});
      capacity = next;
      changed = true;
    }
    if (gridCount > gridCapacity) {
      const nextGrid = Math.max(64, 2 ** Math.ceil(Math.log2(gridCount)));
      const gridBytes = nextGrid * Uint32Array.BYTES_PER_ELEMENT;
      if (gridBytes > device.limits.maxStorageBufferBindingSize || gridBytes > device.limits.maxBufferSize) {
        throw new Error('Electrostatics spatial grid exceeds this GPU device limit');
      }
      cellBuffer?.destroy();
      cellBuffer = device.createBuffer({label: 'Electrostatics spatial cell heads', size: gridBytes, usage: GPUBufferUsage.STORAGE});
      gridCapacity = nextGrid;
      changed = true;
    }
    if (changed) {
      bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {binding: 0, resource: {buffer: inputBuffer}},
          {binding: 1, resource: {buffer: outputBuffer}},
          {binding: 2, resource: {buffer: paramsBuffer}},
          {binding: 3, resource: {buffer: cellBuffer}},
          {binding: 4, resource: {buffer: nextBuffer}},
        ],
      });
    }
  }

  function consume(store, isActive) {
    if (!pending) return 0;
    const result = pending;
    pending = null;
    return applyElectrostaticDeltas(store, result.ids, result.deltas, isActive);
  }

  function dispatch(entities, isActive, parameters = {}) {
    if (destroyed) throw new Error('Electrostatics compute pipeline was destroyed');
    if (inFlight || pending) return false;

    const packed = packElectrostaticParticles(entities, isActive, packedStorage);
    packedStorage = packed.storage;
    if (!packed.count) return false;

    const radius = Math.max(0.001, Number.isFinite(parameters.radius) ? parameters.radius : 120);
    const strength = Number.isFinite(parameters.strength) ? parameters.strength : 1;
    const softening = Math.max(0.001, Number.isFinite(parameters.softening) ? parameters.softening : 6);
    const maxAcceleration = Math.max(0, Number.isFinite(parameters.maxAcceleration) ? parameters.maxAcceleration : 0.08);
    const dt = Math.max(0, Number.isFinite(parameters.dt) ? parameters.dt : 1);

    const worldWidth = Math.max(radius, Number.isFinite(parameters.worldWidth) ? parameters.worldWidth : radius);
    const worldHeight = Math.max(radius, Number.isFinite(parameters.worldHeight) ? parameters.worldHeight : radius);
    const gridCols = Math.max(1, Math.ceil(worldWidth / radius));
    const gridRows = Math.max(1, Math.ceil(worldHeight / radius));
    const gridCount = gridCols * gridRows;
    if (Math.ceil(gridCount / 64) > device.limits.maxComputeWorkgroupsPerDimension || Math.ceil(packed.count / 64) > device.limits.maxComputeWorkgroupsPerDimension) throw new Error('Electrostatics dispatch exceeds this GPU workgroup limit');
    ensureCapacity(packed.count, gridCount);
    device.queue.writeBuffer(inputBuffer, 0, packed.data);
    const uniforms = new ArrayBuffer(48);
    const f = new Float32Array(uniforms);
    const u = new Uint32Array(uniforms);
    u[0] = packed.count;
    u[1] = gridCols;
    u[2] = gridRows;
    u[3] = gridCount;
    f[4] = radius;
    f[5] = strength;
    f[6] = softening;
    f[7] = maxAcceleration;
    f[8] = dt;
    f[9] = radius;
    device.queue.writeBuffer(paramsBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder({label: 'Organoids spatial electrostatics dispatch'});
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(clearPipeline);
    pass.dispatchWorkgroups(Math.ceil(gridCount / 64));
    pass.setPipeline(insertPipeline);
    pass.dispatchWorkgroups(Math.ceil(packed.count / 64));
    pass.setPipeline(forcePipeline);
    pass.dispatchWorkgroups(Math.ceil(packed.count / 64));
    pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, packed.count * OUTPUT_BYTES);
    device.queue.submit([encoder.finish()]);

    const ids = packed.ids.slice();
    const count = packed.count;
    inFlight = true;
    dispatches++;
    readbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
      const mapped = readbackBuffer.getMappedRange();
      const deltas = new Float32Array(mapped.slice(0));
      readbackBuffer.unmap();
      if (!destroyed) pending = {ids, deltas, count};
      inFlight = false;
    }).catch(error => {
      lastError = error;
      inFlight = false;
      options.onError?.(error);
    });
    return true;
  }

  return {
    dispatch,
    consume,
    get capacity() { return capacity; },
    get gridCapacity() { return gridCapacity; },
    get dispatches() { return dispatches; },
    get pending() { return !!pending; },
    get inFlight() { return inFlight; },
    get lastError() { return lastError; },
    destroy() {
      destroyed = true;
      pending = null;
      inputBuffer?.destroy();
      outputBuffer?.destroy();
      readbackBuffer?.destroy();
      nextBuffer?.destroy();
      cellBuffer?.destroy();
      paramsBuffer.destroy();
    },
  };
}

export {ELECTROSTATICS_WGSL, INPUT_BYTES, OUTPUT_BYTES};
