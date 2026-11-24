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
  radius: f32,
  strength: f32,
  softening: f32,
  maxAcceleration: f32,
  dt: f32,
  _padding: vec2<f32>,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> deltas: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: Parameters;

@compute @workgroup_size(64)
fn electrostatics(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let i = invocation.x;
  if (i >= params.count) { return; }

  let a = particles[i];
  let mass = max(0.001, a.mass);
  let radiusSquared = params.radius * params.radius;
  let softeningSquared = params.softening * params.softening;
  var acceleration = vec2<f32>(0.0, 0.0);

  for (var j = 0u; j < params.count; j = j + 1u) {
    if (i == j) { continue; }
    let b = particles[j];
    let product = a.charge * b.charge;
    if (abs(product) < 0.000000001) { continue; }

    let displacement = b.position - a.position;
    let distanceSquared = dot(displacement, displacement);
    if (distanceSquared > radiusSquared) { continue; }

    let distance = sqrt(distanceSquared);
    let safeDistance = max(distance, params.softening);
    let magnitude = params.strength * product / (distanceSquared + softeningSquared);
    let force = sign(magnitude) * min(params.maxAcceleration * mass, abs(magnitude));
    acceleration -= displacement / safeDistance * (force / mass);
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
  const pipeline = await device.createComputePipelineAsync({
    label: 'Organoids pairwise electrostatics',
    layout: 'auto',
    compute: {module: shader, entryPoint: 'electrostatics'},
  });

  const paramsBuffer = device.createBuffer({
    label: 'Electrostatics parameters',
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let inputBuffer = null;
  let outputBuffer = null;
  let readbackBuffer = null;
  let bindGroup = null;
  let capacity = 0;
  let packedStorage = new Float32Array(0);
  let pending = null;
  let inFlight = false;
  let destroyed = false;
  let dispatches = 0;
  let lastError = null;

  function ensureCapacity(count) {
    if (count <= capacity) return;
    const next = Math.max(64, 2 ** Math.ceil(Math.log2(count)));
    const inputSize = next * INPUT_BYTES;
    const outputSize = next * OUTPUT_BYTES;
    if (inputSize > device.limits.maxStorageBufferBindingSize ||
        outputSize > device.limits.maxStorageBufferBindingSize ||
        outputSize > device.limits.maxBufferSize) {
      throw new Error('Electrostatics buffers exceed this GPU device limit');
    }
    inputBuffer?.destroy();
    outputBuffer?.destroy();
    readbackBuffer?.destroy();
    inputBuffer = device.createBuffer({
      label: 'Charged particle input',
      size: inputSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    outputBuffer = device.createBuffer({
      label: 'Electrostatic velocity deltas',
      size: outputSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    readbackBuffer = device.createBuffer({
      label: 'Electrostatic asynchronous readback',
      size: outputSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    capacity = next;
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {binding: 0, resource: {buffer: inputBuffer}},
        {binding: 1, resource: {buffer: outputBuffer}},
        {binding: 2, resource: {buffer: paramsBuffer}},
      ],
    });
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

    ensureCapacity(packed.count);
    device.queue.writeBuffer(inputBuffer, 0, packed.data);
    const uniforms = new ArrayBuffer(32);
    const f = new Float32Array(uniforms);
    const u = new Uint32Array(uniforms);
    u[0] = packed.count;
    f[1] = radius;
    f[2] = strength;
    f[3] = softening;
    f[4] = maxAcceleration;
    f[5] = dt;
    device.queue.writeBuffer(paramsBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder({label: 'Organoids electrostatics dispatch'});
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
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
      paramsBuffer.destroy();
    },
  };
}

export {ELECTROSTATICS_WGSL, INPUT_BYTES, OUTPUT_BYTES};
