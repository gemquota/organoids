const SHADER = /* wgsl */ `
struct Particle { position: vec2f, velocity: vec2f, charge: f32, mass: f32, padding: vec2f };
struct Params { count: u32, radius: f32, strength: f32, softening: f32, maxAcceleration: f32, dt: f32, pad0: f32, pad1: f32 };
@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> velocities: array<vec2f>;
@group(0) @binding(2) var<uniform> params: Params;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= params.count) { return; }
  let a = particles[i];
  var delta = vec2f(0.0);
  if (abs(a.charge) > 1e-9 && a.mass > 0.0) {
    for (var j = 0u; j < params.count; j++) {
      if (j == i) { continue; }
      let b = particles[j];
      let product = a.charge * b.charge;
      if (abs(product) < 1e-9) { continue; }
      let offset = b.position - a.position;
      let d2 = dot(offset, offset);
      if (d2 > params.radius * params.radius) { continue; }
      let d = select(params.softening, sqrt(d2), d2 > 0.0);
      let magnitude = params.strength * product / (d2 + params.softening * params.softening);
      let capMass = select(a.mass, b.mass, j < i);
      let force = sign(magnitude) * min(params.maxAcceleration * capMass, abs(magnitude));
      let direction = select(offset, -offset, i < j);
      delta += direction / d * (force / a.mass) * params.dt;
    }
  }
  velocities[i] = a.velocity + delta;
}`;

/** GPU implementation of the independent per-particle electrostatic force sum. */
export class WebGpuElectrostatics {
  static async create() {
    if (!globalThis.navigator?.gpu) return null;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      const module = device.createShaderModule({ code: SHADER });
      const pipeline = await device.createComputePipelineAsync({
        layout: 'auto', compute: { module, entryPoint: 'main' }
      });
      return new WebGpuElectrostatics(device, pipeline);
    } catch (error) {
      console.warn('[Organoids] WebGPU electrostatics unavailable; using CPU', error);
      return null;
    }
  }

  constructor(device, pipeline) {
    this.device = device;
    this.pipeline = pipeline;
    this.capacity = 0;
    this.particleBuffer = null;
    this.velocityBuffer = null;
    this.uniformBuffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.dispatchCount = 0;
    this.lastDispatchMs = 0;
  }

  ensureCapacity(count) {
    if (count <= this.capacity) return;
    this.particleBuffer?.destroy();
    this.velocityBuffer?.destroy();
    this.capacity = Math.max(256, 2 ** Math.ceil(Math.log2(count)));
    this.particleBuffer = this.device.createBuffer({ size: this.capacity * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.velocityBuffer = this.device.createBuffer({ size: this.capacity * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
  }

  async apply(entities, options, isActive = entity => entity.state === 'active' || entity.state === 'bound') {
    const charged = [];
    for (const entity of entities) {
      if (entity.parent || !isActive(entity)) continue;
      const p = entity.properties;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(Number(p.charge) || 0) < 1e-9) continue;
      charged.push(entity);
    }
    const count = charged.length;
    if (count < 2) return 0;
    this.ensureCapacity(count);
    const input = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) {
      const p = charged[i].properties, k = i * 8;
      input[k] = p.x; input[k + 1] = p.y;
      input[k + 2] = Number(p.vx) || 0; input[k + 3] = Number(p.vy) || 0;
      input[k + 4] = Number(p.charge) || 0; input[k + 5] = Math.max(.001, Number(p.mass) || 1);
    }
    const uniform = new ArrayBuffer(32), view = new DataView(uniform);
    view.setUint32(0, count, true);
    view.setFloat32(4, options.radius, true);
    view.setFloat32(8, options.strength, true);
    view.setFloat32(12, options.softening, true);
    view.setFloat32(16, options.maxAcceleration, true);
    view.setFloat32(20, options.dt, true);
    this.device.queue.writeBuffer(this.particleBuffer, 0, input);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniform);
    const readback = this.device.createBuffer({ size: count * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.particleBuffer } },
      { binding: 1, resource: { buffer: this.velocityBuffer } },
      { binding: 2, resource: { buffer: this.uniformBuffer } }
    ] }));
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();
    encoder.copyBufferToBuffer(this.velocityBuffer, 0, readback, 0, count * 8);
    const started = performance.now();
    this.device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const output = new Float32Array(readback.getMappedRange().slice(0));
    readback.unmap(); readback.destroy();
    for (let i = 0; i < count; i++) {
      charged[i].properties.vx = output[i * 2];
      charged[i].properties.vy = output[i * 2 + 1];
    }
    this.dispatchCount++;
    this.lastDispatchMs = performance.now() - started;
    return count;
  }

  destroy() {
    this.particleBuffer?.destroy(); this.velocityBuffer?.destroy(); this.uniformBuffer?.destroy();
    this.device.destroy();
  }
}
