const PARTICLE_WGSL = `
struct Particle {
  position: vec2<f32>,
  radius: f32,
  _padding: f32,
  color: vec4<f32>,
};

struct View {
  resolution: vec2<f32>,
  worldSize: vec2<f32>,
  camera: vec2<f32>,
  scale: f32,
  count: u32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> view: View;

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32,
              @builtin(instance_index) instanceIndex: u32) -> VertexOut {
  let corners = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
  );
  let p = particles[instanceIndex];
  let corner = corners[vertexIndex];
  let pixel = view.camera + p.position * view.scale + corner * p.radius * view.scale;
  let clip = vec2<f32>(
    pixel.x / view.resolution.x * 2.0 - 1.0,
    1.0 - pixel.y / view.resolution.y * 2.0
  );
  var out: VertexOut;
  out.position = vec4<f32>(clip, 0.0, 1.0);
  out.local = corner;
  out.color = p.color;
  return out;
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4<f32> {
  let d = length(in.local);
  let alpha = 1.0 - smoothstep(0.88, 1.0, d);
  return vec4<f32>(in.color.rgb, in.color.a * alpha);
}
`;

const FLOATS_PER_PARTICLE = 8;
const BYTES_PER_PARTICLE = FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT;
const DEFAULT_COLOR = [0.447, 0.851, 0.816];

function hexColor(value) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return DEFAULT_COLOR;
  return [
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  ];
}

function particleColor(entity, cache) {
  const value = entity.properties?.catalogueColor ||
    (entity.type === 'molecule' ? '#b0a6ed' : '#72d9d0');
  let color = cache.get(value);
  if (!color) {
    color = hexColor(value);
    cache.set(value, color);
  }
  return color;
}

export function packParticles(entities, isActive, cameraScale = 1, target = null) {
  let count = 0;
  for (const entity of entities) if (isActive(entity)) count++;
  const required = count * FLOATS_PER_PARTICLE;
  const storage = target && target.length >= required ? target : new Float32Array(required);
  const data = storage.subarray(0, required);
  const scale = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1;
  const colors = new Map();
  let index = 0;
  for (const entity of entities) {
    if (!isActive(entity)) continue;
    const p = entity.properties || {};
    const mass = Number.isFinite(+p.mass) ? +p.mass : 1;
    const offset = index++ * FLOATS_PER_PARTICLE;
    const color = particleColor(entity, colors);
    data[offset] = Number.isFinite(+p.x) ? +p.x : 0;
    data[offset + 1] = Number.isFinite(+p.y) ? +p.y : 0;
    data[offset + 2] = Math.max(1.1 / scale, 3 * Math.sqrt(Math.max(0, mass)));
    data[offset + 3] = 0;
    data[offset + 4] = color[0];
    data[offset + 5] = color[1];
    data[offset + 6] = color[2];
    data[offset + 7] = 0.55 + Math.min(0.4, Math.max(0, mass) / 35);
  }
  return {data, storage, count};
}

export async function createGpuParticleRenderer(canvas, options = {}) {
  if (!globalThis.navigator?.gpu) throw new Error('WebGPU is unavailable in this browser');
  const adapter = await navigator.gpu.requestAdapter({powerPreference: options.powerPreference || 'high-performance'});
  if (!adapter) throw new Error('No compatible WebGPU adapter was found');
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('Could not create a WebGPU canvas context');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({device, format, alphaMode: 'premultiplied'});

  const shader = device.createShaderModule({label: 'Organoids particle renderer', code: PARTICLE_WGSL});
  const pipeline = await device.createRenderPipelineAsync({
    label: 'Organoids instanced particles',
    layout: 'auto',
    vertex: {module: shader, entryPoint: 'vertexMain'},
    fragment: {
      module: shader,
      entryPoint: 'fragmentMain',
      targets: [{format, blend: {
        color: {srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add'},
        alpha: {srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add'},
      }}],
    },
    primitive: {topology: 'triangle-list'},
  });

  const uniformBuffer = device.createBuffer({
    label: 'Organoids view uniforms',
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let particleBuffer = null;
  let bindGroup = null;
  let capacity = 0;
  let packedStorage = new Float32Array(0);
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let lost = false;
  device.lost.then(info => { lost = true; options.onDeviceLost?.(info); });

  function ensureCapacity(count) {
    if (count <= capacity) return;
    const next = Math.max(256, 2 ** Math.ceil(Math.log2(count)));
    const bytes = next * BYTES_PER_PARTICLE;
    if (bytes > device.limits.maxStorageBufferBindingSize) {
      throw new Error('Particle buffer exceeds this device storage-buffer limit');
    }
    particleBuffer?.destroy();
    particleBuffer = device.createBuffer({
      label: 'Organoids particle storage',
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    capacity = next;
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {binding: 0, resource: {buffer: particleBuffer}},
        {binding: 1, resource: {buffer: uniformBuffer}},
      ],
    });
  }

  function resize(cssWidth, cssHeight, dpr = 1) {
    width = Math.max(1, cssWidth);
    height = Math.max(1, cssHeight);
    pixelRatio = Math.max(1, Math.min(2, dpr));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
  }

  function render(entities, isActive, camera) {
    if (lost) throw new Error('WebGPU device was lost');
    const packed = packParticles(entities, isActive, camera.scale, packedStorage);
    packedStorage = packed.storage;
    const {data, count} = packed;
    if (count) {
      ensureCapacity(count);
      device.queue.writeBuffer(particleBuffer, 0, data);
      const uniforms = new Float32Array(8);
      uniforms[0] = width * pixelRatio;
      uniforms[1] = height * pixelRatio;
      uniforms[2] = camera.worldWidth;
      uniforms[3] = camera.worldHeight;
      uniforms[4] = camera.x * pixelRatio;
      uniforms[5] = camera.y * pixelRatio;
      uniforms[6] = camera.scale * pixelRatio;
      new Uint32Array(uniforms.buffer)[7] = count;
      device.queue.writeBuffer(uniformBuffer, 0, uniforms);
    }

    const encoder = device.createCommandEncoder({label: 'Organoids particle frame'});
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: {r: 0, g: 0, b: 0, a: 0},
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    if (count) {
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6, count);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  resize(canvas.clientWidth || globalThis.innerWidth || 1, canvas.clientHeight || globalThis.innerHeight || 1);
  return {
    adapter,
    device,
    format,
    resize,
    render,
    get particleCapacity() { return capacity; },
    get isLost() { return lost; },
    destroy() {
      particleBuffer?.destroy();
      uniformBuffer.destroy();
      device.destroy();
    },
  };
}

export {PARTICLE_WGSL, BYTES_PER_PARTICLE};
