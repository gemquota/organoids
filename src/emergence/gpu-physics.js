const SHADER = /* wgsl */ `
struct Particle { position: vec2f, velocity: vec2f, charge: f32, mass: f32, flags: vec2f };
struct Params { count: u32, gridCols: u32, gridRows: u32, pad0: u32, cellSize: f32, forceRadius: f32, strength: f32, softening: f32, maxAcceleration: f32, dt: f32, nuclearStrength: f32, nuclearRange: f32, nuclearMaxForce: f32, pad1: f32, pad2: f32, pad3: f32, collisionRadius: f32, restitution: f32, maxCorrection: f32, pad4: f32, candidateRadius: f32, pad5: f32, pad6: f32, pad7: f32 };
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> velocities: array<vec2f>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read_write> heads: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> nextParticle: array<u32>;
@group(0) @binding(5) var<storage, read> collisionSnapshot: array<Particle>;
@group(0) @binding(6) var<storage, read_write> thermalPairs: array<vec2u>;
@group(0) @binding(7) var<storage, read_write> thermalPairCount: atomic<u32>;
@group(0) @binding(8) var<storage, read_write> packedState: array<vec4f>;
@compute @workgroup_size(256)
fn clear_heads(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i < params.gridCols * params.gridRows) { atomicStore(&heads[i], 0xffffffffu); }
}
@compute @workgroup_size(64)
fn build_grid(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let p = particles[i].position;
  let cell = vec2u(clamp(floor(p / params.cellSize), vec2f(0.0), vec2f(f32(params.gridCols - 1u), f32(params.gridRows - 1u))));
  let index = cell.y * params.gridCols + cell.x;
  nextParticle[i] = atomicExchange(&heads[index], i);
}
@compute @workgroup_size(64)
fn solve(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let a = particles[i];
  let cell = vec2i(clamp(floor(a.position / params.cellSize), vec2f(0.0), vec2f(f32(params.gridCols - 1u), f32(params.gridRows - 1u))));
  var delta = vec2f(0.0);
  for (var oy = -1; oy <= 1; oy++) {
    for (var ox = -1; ox <= 1; ox++) {
      let neighbourCell = cell + vec2i(ox, oy);
      if (neighbourCell.x < 0 || neighbourCell.y < 0 || neighbourCell.x >= i32(params.gridCols) || neighbourCell.y >= i32(params.gridRows)) { continue; }
      let bucket = u32(neighbourCell.y) * params.gridCols + u32(neighbourCell.x);
      var j = atomicLoad(&heads[bucket]);
      loop {
        if (j == 0xffffffffu) { break; }
        if (j != i) {
          let b = particles[j];
          let offset = b.position - a.position;
          let d2 = dot(offset, offset);
          if (d2 <= params.forceRadius * params.forceRadius && d2 > 1e-12) {
            let d = sqrt(d2);
            if (abs(a.charge) > 1e-9 && abs(b.charge) > 1e-9) {
              let product = a.charge * b.charge;
              let magnitude = params.strength * product / (d2 + params.softening * params.softening);
              let capMass = min(a.mass, b.mass);
              let force = sign(magnitude) * min(params.maxAcceleration * capMass, abs(magnitude));
              delta -= offset / d * (force / a.mass) * params.dt;
            }
            if (a.flags.x > 0.5 && b.flags.x > 0.5 && params.nuclearStrength > 0.0 && d <= params.nuclearRange) {
              let force = min(params.nuclearMaxForce * min(a.mass, b.mass), params.nuclearStrength * exp(-d / params.nuclearRange));
              delta += offset / d * (force / a.mass) * params.dt;
            }
          }
        }
        j = nextParticle[j];
      }
    }
  }
  velocities[i] = a.velocity + delta;
}
@compute @workgroup_size(64)
fn integrate_gpu(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let oldVelocity = particles[i].velocity;
  let newVelocity = velocities[i];
  // The host already integrated the previous velocity. Apply only the
  // GPU-computed velocity correction across the accumulated force interval.
  particles[i].position += (newVelocity - oldVelocity) * params.dt;
  particles[i].velocity = newVelocity;
}
@compute @workgroup_size(64)
fn collide_gpu(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let a = collisionSnapshot[i];
  let ra = params.collisionRadius * sqrt(max(0.01, a.mass));
  let cell = vec2i(clamp(floor(a.position / params.cellSize), vec2f(0.0), vec2f(f32(params.gridCols - 1u), f32(params.gridRows - 1u))));
  var velocityDelta = vec2f(0.0);
  var positionDelta = vec2f(0.0);
  for (var oy = -1; oy <= 1; oy++) {
    for (var ox = -1; ox <= 1; ox++) {
      let nc = cell + vec2i(ox, oy);
      if (nc.x < 0 || nc.y < 0 || nc.x >= i32(params.gridCols) || nc.y >= i32(params.gridRows)) { continue; }
      var j = atomicLoad(&heads[u32(nc.y) * params.gridCols + u32(nc.x)]);
      loop {
        if (j == 0xffffffffu) { break; }
        if (j != i) {
          let b = collisionSnapshot[j];
          let offset = b.position - a.position;
          let distanceSquared = dot(offset, offset);
          let rb = params.collisionRadius * sqrt(max(0.01, b.mass));
          let target = ra + rb;
          if (distanceSquared < target * target) {
            let distance = max(1e-6, sqrt(distanceSquared));
            let normal = offset / distance;
            let overlap = target - distance;
            let invMassA = 1.0 / max(0.001, a.mass);
            let invMassB = 1.0 / max(0.001, b.mass);
            let shareA = invMassA / (invMassA + invMassB);
            positionDelta -= normal * min(params.maxCorrection, overlap * shareA);
            let relativeVelocity = b.velocity - a.velocity;
            let normalVelocity = dot(relativeVelocity, normal);
            if normalVelocity < 0.0 {
              let impulse = (1.0 + params.restitution) * normalVelocity / (invMassA + invMassB);
              velocityDelta += normal * impulse * invMassA;
            }
          }
        }
        j = nextParticle[j];
      }
    }
  }
  let correctionLength = length(positionDelta);
  if (correctionLength > params.maxCorrection) { positionDelta *= params.maxCorrection / correctionLength; }
  particles[i].position += positionDelta;
  particles[i].velocity += velocityDelta;
}

@compute @workgroup_size(64)
fn clear_thermal_pairs(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x == 0u) { atomicStore(&thermalPairCount, 0u); }
}
@compute @workgroup_size(64)
fn generate_thermal_pairs(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let a = particles[i];
  let cell = vec2i(clamp(floor(a.position / params.cellSize), vec2f(0.0), vec2f(f32(params.gridCols - 1u), f32(params.gridRows - 1u))));
  for (var oy = -1; oy <= 1; oy++) {
    for (var ox = -1; ox <= 1; ox++) {
      let nc = cell + vec2i(ox, oy);
      if (nc.x < 0 || nc.y < 0 || nc.x >= i32(params.gridCols) || nc.y >= i32(params.gridRows)) { continue; }
      var j = atomicLoad(&heads[u32(nc.y) * params.gridCols + u32(nc.x)]);
      loop {
        if (j == 0xffffffffu) { break; }
        if (j > i) {
          let b = particles[j];
          if (dot(b.position - a.position, b.position - a.position) <= params.candidateRadius * params.candidateRadius) {
            let slot = atomicAdd(&thermalPairCount, 1u);
            if (slot < params.count * 8u) { thermalPairs[slot] = vec2u(i, j); }
          }
        }
        j = nextParticle[j];
      }
    }
  }
}

@compute @workgroup_size(64)
fn pack_state(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.count) { return; }
  packedState[i] = vec4f(particles[i].position, particles[i].velocity);
}
`;


export function createTypeGPUSchemas(d) {
  const particle = d.struct({ position: d.vec2f, velocity: d.vec2f, charge: d.f32, mass: d.f32, flags: d.vec2f });
  const params = d.struct({ count: d.u32, gridCols: d.u32, gridRows: d.u32, pad0: d.u32, cellSize: d.f32, forceRadius: d.f32, strength: d.f32, softening: d.f32, maxAcceleration: d.f32, dt: d.f32, nuclearStrength: d.f32, nuclearRange: d.f32, nuclearMaxForce: d.f32, pad1: d.f32, pad2: d.f32, pad3: d.f32, collisionRadius: d.f32, restitution: d.f32, maxCorrection: d.f32, pad4: d.f32, candidateRadius: d.f32, pad5: d.f32, pad6: d.f32, pad7: d.f32 });
  return { particle, params, vec2: d.vec2f, u32: d.u32, atomicU32: d.atomic(d.u32) };
}

/** GPU implementation of the independent per-particle electrostatic force sum. */
export class WebGpuElectrostatics {
  static async create() {
    if (!globalThis.navigator?.gpu) return null;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      // TypeGPU supplies typed resource schemas and a stable, named bind layout.
      // Shader code remains WGSL during this incremental migration.
      const { tgpu, d } = await import('https://esm.sh/typegpu@0.12.11');
      const root = tgpu.initFromDevice({ device });
      const schemas = createTypeGPUSchemas(d);
      const layout = tgpu.bindGroupLayout({
        particles: { storage: d.arrayOf(schemas.particle), access: 'mutable' },
        velocities: { storage: d.arrayOf(d.vec2f), access: 'mutable' },
        params: { uniform: schemas.params },
        heads: { storage: d.arrayOf(d.atomic(d.u32)), access: 'mutable' },
        nextParticle: { storage: d.arrayOf(d.u32), access: 'mutable' },
        collisionSnapshot: { storage: d.arrayOf(schemas.particle), access: 'readonly' },
        thermalPairs: { storage: d.arrayOf(d.vec2u), access: 'mutable' },
        thermalPairCount: { storage: d.atomic(d.u32), access: 'mutable' },
        packedState: { storage: d.arrayOf(d.vec4f), access: 'mutable' },
      }).$idx(0);
      const rawLayout = root.unwrap(layout);
      const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [rawLayout] });
      const module = device.createShaderModule({ code: SHADER });
      const pipelines = {};
      for (const entryPoint of ['clear_heads', 'build_grid', 'solve', 'integrate_gpu', 'collide_gpu', 'clear_thermal_pairs', 'generate_thermal_pairs', 'pack_state']) {
        pipelines[entryPoint] = await device.createComputePipelineAsync({ layout: pipelineLayout, compute: { module, entryPoint } });
      }
      return new WebGpuElectrostatics(device, pipelines, root, d, schemas, layout, rawLayout);
    } catch (error) {
      console.warn('[Organoids] WebGPU electrostatics unavailable; using CPU', error);
      return null;
    }
  }

  constructor(device, pipeline, typegpuRoot, typegpuData, schemas, typedLayout, rawLayout) {
    this.device = device;
    this.pipelines = pipeline;
    this.typegpuRoot = typegpuRoot;
    this.typegpuData = typegpuData;
    this.schemas = schemas;
    this.typedLayout = typedLayout;
    this.rawLayout = rawLayout;
    this.capacity = 0;
    this.gridCapacity = 0;
    this.headBuffer = null;
    this.nextBuffer = null;
    this.particleBuffer = null;
    this.collisionSnapshotBuffer = null;
    this.thermalPairsBuffer = null;
    this.thermalPairCountBuffer = null;
    this.thermalPairReadback = null;
    this.packedStateBuffer = null;
    this.thermalPairsCapacity = 0;
    this.lastThermalPairs = [];
    this.velocityBuffer = null;
    this.uniformBuffer = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.readbackBuffer = null;
    this.inputData = new Float32Array(0);
    this.outputData = new Float32Array(0);
    this.uniformData = new ArrayBuffer(96);
    this.uniformView = new DataView(this.uniformData);
    this.bindGroup = null;
    this.typedParams = this.typegpuRoot.createBuffer(this.schemas.params, this.uniformBuffer);
    this.dispatchCount = 0;
    this.lastDispatchMs = 0;
  }

  ensureCapacity(count, gridCells) {
    if (count > this.capacity) {
      this.particleBuffer?.destroy(); this.collisionSnapshotBuffer?.destroy(); this.packedStateBuffer?.destroy(); this.thermalPairsBuffer?.destroy(); this.thermalPairCountBuffer?.destroy(); this.thermalPairReadback?.destroy(); this.velocityBuffer?.destroy(); this.nextBuffer?.destroy();
      this.capacity = Math.max(256, 2 ** Math.ceil(Math.log2(count)));
      this.particleBuffer = this.device.createBuffer({ size: this.capacity * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
      this.collisionSnapshotBuffer = this.device.createBuffer({ size: this.capacity * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      this.packedStateBuffer = this.device.createBuffer({ size: this.capacity * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      this.thermalPairsCapacity = this.capacity * 8;
      this.thermalPairsBuffer = this.device.createBuffer({ size: this.thermalPairsCapacity * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      this.thermalPairCountBuffer = this.device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      this.thermalPairReadback = this.device.createBuffer({ size: this.thermalPairsCapacity * 8 + 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      this.velocityBuffer = this.device.createBuffer({ size: this.capacity * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
      this.nextBuffer = this.device.createBuffer({ size: this.capacity * 4, usage: GPUBufferUsage.STORAGE });
      this.readbackBuffer?.destroy();
      this.readbackBuffer = this.device.createBuffer({ size: this.capacity * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      this.inputData = new Float32Array(this.capacity * 8);
      this.outputData = new Float32Array(this.capacity * 4);
      this.bindGroup = null;
      this.typedParticles = this.typegpuRoot.createBuffer(this.typegpuArray(this.schemas.particle, this.capacity), this.particleBuffer);
      this.typedVelocities = this.typegpuRoot.createBuffer(this.typegpuArray(this.schemas.vec2, this.capacity), this.velocityBuffer);
      this.typedNext = this.typegpuRoot.createBuffer(this.typegpuArray(this.schemas.u32, this.capacity), this.nextBuffer);
    }
    if (!this.headBuffer || gridCells > this.gridCapacity) {
      this.headBuffer?.destroy();
      this.gridCapacity = Math.max(256, 2 ** Math.ceil(Math.log2(gridCells)));
      this.headBuffer = this.device.createBuffer({ size: this.gridCapacity * 4, usage: GPUBufferUsage.STORAGE });
      this.typedHeads = this.typegpuRoot.createBuffer(this.typegpuArray(this.schemas.atomicU32, this.gridCapacity), this.headBuffer);
      this.bindGroup = null;
    }
    if (!this.bindGroup) this.bindGroup = this.device.createBindGroup({ layout: this.rawLayout, entries: [
      { binding: 0, resource: { buffer: this.particleBuffer } },
      { binding: 1, resource: { buffer: this.velocityBuffer } },
      { binding: 2, resource: { buffer: this.uniformBuffer } },
      { binding: 3, resource: { buffer: this.headBuffer } },
      { binding: 4, resource: { buffer: this.nextBuffer } },
      { binding: 5, resource: { buffer: this.collisionSnapshotBuffer } },
      { binding: 6, resource: { buffer: this.thermalPairsBuffer } },
      { binding: 7, resource: { buffer: this.thermalPairCountBuffer } },
      { binding: 8, resource: { buffer: this.packedStateBuffer } }
    ] });
  }

  typegpuArray(schema, length) {
    return this.typegpuData.arrayOf(schema, length);
  }

  async apply(entities, options, spatial, isActive = entity => entity.state === 'active' || entity.state === 'bound') {
    const charged = [];
    for (const entity of entities) {
      if (entity.parent || !isActive(entity)) continue;
      const p = entity.properties;
      const nucleon = entity.type === 'proton' || entity.type === 'neutron' || entity.type === 'isotope';
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      charged.push(entity);
    }
    const count = charged.length;
    this.lastEntities = charged;
    if (count < 2) { this.lastThermalPairs = []; return 0; }
    const cellSize = Math.max(1, Number(options.candidateRadius) || Number(options.radius) || 1);
    let maxX = cellSize, maxY = cellSize;
    if (!options.worldWidth || !options.worldHeight) for (const entity of charged) { maxX = Math.max(maxX, entity.properties.x); maxY = Math.max(maxY, entity.properties.y); }
    const gridCols = Math.max(1, Math.ceil((Number(options.worldWidth) || maxX + cellSize) / cellSize));
    const gridRows = Math.max(1, Math.ceil((Number(options.worldHeight) || maxY + cellSize) / cellSize));
    const gridCells = gridCols * gridRows;
    this.ensureCapacity(count, gridCells);
    // TypeGPU wrappers enforce resource schemas; raw buffers are unwrapped for
    // the existing WGSL pass while preserving a migration path to typed passes.
    const input = this.inputData;
    for (let i = 0; i < count; i++) {
      const p = charged[i].properties, k = i * 8;
      input[k] = p.x; input[k + 1] = p.y;
      input[k + 2] = Number(p.vx) || 0; input[k + 3] = Number(p.vy) || 0;
      input[k + 4] = Number(p.charge) || 0; input[k + 5] = Math.max(.001, Number(p.mass) || 1);
      input[k + 6] = ['proton', 'neutron', 'isotope'].includes(charged[i].type) ? 1 : 0;
      input[k + 7] = 0;
    }
    const view = this.uniformView;
    view.setUint32(0, count, true); view.setUint32(4, gridCols, true); view.setUint32(8, gridRows, true);
    view.setFloat32(16, cellSize, true); view.setFloat32(20, options.forceRadius ?? options.radius, true);
    view.setFloat32(24, options.strength, true); view.setFloat32(28, options.softening, true);
    view.setFloat32(32, options.maxAcceleration, true); view.setFloat32(36, options.dt, true);
    view.setFloat32(40, Math.max(0, Number(options.nuclearStrength) || 0), true);
    view.setFloat32(44, Math.max(.001, Number(options.nuclearRange) || options.radius * .4), true);
    view.setFloat32(48, Math.max(0, Number(options.nuclearMaxForce) || 0), true);
    view.setFloat32(64, Math.max(0.01, Number(options.collisionRadius) || 1.2), true);
    view.setFloat32(68, Math.max(0, Math.min(1, Number(options.restitution) || 0.15)), true);
    view.setFloat32(72, Math.max(0.01, Number(options.maxCorrection) || 1.5), true);
    view.setFloat32(80, Math.max(0.01, Number(options.candidateRadius) || options.radius), true);
    this.device.queue.writeBuffer(this.particleBuffer, 0, input, 0, count * 32);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
    const encoder = this.device.createCommandEncoder();
    const dispatch = (name, groups) => {
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipelines[name]);
      pass.setBindGroup(0, this.bindGroup);
      pass.dispatchWorkgroups(groups); pass.end();
    };
    dispatch('clear_heads', Math.ceil(gridCells / 256));
    dispatch('build_grid', Math.ceil(count / 64));
    dispatch('solve', Math.ceil(count / 64));
    dispatch('integrate_gpu', Math.ceil(count / 64));
    dispatch('clear_heads', Math.ceil(gridCells / 256));
    dispatch('build_grid', Math.ceil(count / 64));
    encoder.copyBufferToBuffer(this.particleBuffer, 0, this.collisionSnapshotBuffer, 0, count * 32);
    dispatch('collide_gpu', Math.ceil(count / 64));
    dispatch('clear_heads', Math.ceil(gridCells / 256));
    dispatch('build_grid', Math.ceil(count / 64));
    dispatch('clear_thermal_pairs', 1);
    dispatch('generate_thermal_pairs', Math.ceil(count / 64));
    dispatch('pack_state', Math.ceil(count / 64));
    encoder.copyBufferToBuffer(this.packedStateBuffer, 0, this.readbackBuffer, 0, count * 16);
    encoder.copyBufferToBuffer(this.thermalPairCountBuffer, 0, this.thermalPairReadback, 0, 4);
    encoder.copyBufferToBuffer(this.thermalPairsBuffer, 0, this.thermalPairReadback, 4, this.thermalPairsCapacity * 8);
    const started = performance.now();
    this.device.queue.submit([encoder.finish()]);
    await this.readbackBuffer.mapAsync(GPUMapMode.READ, 0, count * 16);
    const mapped = new Float32Array(this.readbackBuffer.getMappedRange(0, count * 16));
    this.outputData.set(mapped.subarray(0, count * 4), 0);
    this.readbackBuffer.unmap();
    const output = this.outputData;
    for (let i = 0; i < count; i++) {
      const k = i * 4, p = charged[i].properties;
      p.x = output[k]; p.y = output[k + 1];
      p.vx = output[k + 2]; p.vy = output[k + 3];
    }
    await this.thermalPairReadback.mapAsync(GPUMapMode.READ, 0, 4 + this.thermalPairsCapacity * 8);
    const pairView = new DataView(this.thermalPairReadback.getMappedRange(0, 4 + this.thermalPairsCapacity * 8));
    const rawPairCount = pairView.getUint32(0, true);
    const pairCount = Math.min(rawPairCount, this.thermalPairsCapacity);
    this.lastThermalPairs = rawPairCount > this.thermalPairsCapacity ? null : new Array(pairCount);
    if (this.lastThermalPairs) for (let pair = 0; pair < pairCount; pair++) this.lastThermalPairs[pair] = [pairView.getUint32(4 + pair * 8, true), pairView.getUint32(8 + pair * 8, true)];
    this.thermalPairReadback.unmap();
    this.dispatchCount++;
    this.lastDispatchMs = performance.now() - started;
    return count;
  }

  destroy() {
    this.particleBuffer?.destroy(); this.collisionSnapshotBuffer?.destroy(); this.packedStateBuffer?.destroy(); this.thermalPairsBuffer?.destroy(); this.thermalPairCountBuffer?.destroy(); this.thermalPairReadback?.destroy(); this.velocityBuffer?.destroy(); this.nextBuffer?.destroy(); this.headBuffer?.destroy(); this.uniformBuffer?.destroy(); this.readbackBuffer?.destroy();
    this.typegpuRoot?.destroy();
    this.device.destroy();
  }
}
