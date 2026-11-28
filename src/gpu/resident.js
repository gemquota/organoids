/**
 * Experimental GPU-resident charged-particle state.
 *
 * This module deliberately does not own EntityStore or chemistry. Callers upload
 * a snapshot, run GPU steps, and explicitly request a snapshot when a CPU-owned
 * subsystem needs to observe the state. It is a staging boundary for gradually
 * moving hot physics loops off the CPU without making topology transactional on
 * the GPU.
 */
export const RESIDENT_PARTICLE_STRIDE = 8; // x,y,vx,vy,charge,mass,id-as-u32,padding
export const RESIDENT_PARTICLE_BYTES = RESIDENT_PARTICLE_STRIDE * 4;

export function packResidentParticles(entities, isActive, target = null) {
  if (typeof isActive !== 'function') throw new TypeError('isActive must be a function');
  const collection = entities instanceof Map ? entities : entities?.entities instanceof Map ? entities.entities : entities;
  const source = collection instanceof Map ? collection.values() : collection;
  const estimate = collection instanceof Map ? collection.size : Array.isArray(collection) ? collection.length : Number.isSafeInteger(collection?.length) ? collection.length : 0;
  const required = estimate * RESIDENT_PARTICLE_STRIDE;
  let storage = target?.storage && target.storage.length >= required ? target.storage : new Float32Array(Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, required)))));
  let idsStorage = target?.idsStorage && target.idsStorage.length >= estimate ? target.idsStorage : new Array(Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(1, estimate)))));
  let words = new Uint32Array(storage.buffer, storage.byteOffset, storage.length);
  let count = 0;
  for (const entity of source) {
    if (!isActive(entity) || entity.parent) continue;
    const p = entity.properties || {};
    const charge = Number(p.charge), mass = Number(p.mass);
    if (!Number.isInteger(entity.id) || entity.id < 0 || entity.id > 0xffffffff ||
        !Number.isFinite(+p.x) || !Number.isFinite(+p.y) || !Number.isFinite(charge) ||
        !Number.isFinite(mass) || mass <= 0 || Math.abs(charge) < 1e-9) continue;
    const o = count * RESIDENT_PARTICLE_STRIDE;
    if (o + RESIDENT_PARTICLE_STRIDE > storage.length) {
      const next = new Float32Array(Math.max(storage.length * 2, o + RESIDENT_PARTICLE_STRIDE));
      next.set(storage); storage = next;
      words = new Uint32Array(storage.buffer);
    }
    if (count >= idsStorage.length) idsStorage.length = Math.max(64, idsStorage.length * 2);
    storage[o] = +p.x; storage[o+1] = +p.y;
    storage[o+2] = Number.isFinite(+p.vx) ? +p.vx : 0;
    storage[o+3] = Number.isFinite(+p.vy) ? +p.vy : 0;
    storage[o+4] = charge; storage[o+5] = mass;
    words[o+6] = entity.id; words[o+7] = 0;
    idsStorage[count++] = entity.id;
  }
  return {data: storage.subarray(0,count*RESIDENT_PARTICLE_STRIDE),storage,ids:idsStorage.slice(0,count),idsStorage,count};
}

export function normalizeResidentPhysicsOptions(options = {}, dt = options.dt ?? 1) {
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const radius = Math.max(0.001, finite(options.radius, 180));
  const worldWidth = Math.max(radius, finite(options.worldWidth, radius));
  const worldHeight = Math.max(radius, finite(options.worldHeight, radius));
  const gridCols = Math.max(1, Math.ceil(worldWidth / radius));
  const gridRows = Math.max(1, Math.ceil(worldHeight / radius));
  const gridCount = gridCols * gridRows;
  if (!Number.isSafeInteger(gridCount) || gridCount < 1) throw new RangeError('Resident spatial grid dimensions are invalid');
  return {radius,worldWidth,worldHeight,gridCols,gridRows,gridCount,
    strength:finite(options.strength,1),softening:Math.max(0.001,finite(options.softening,6)),
    maxAcceleration:Math.max(0,finite(options.maxAcceleration,0.08)),dt:Math.max(0,finite(dt,1))};
}

export function applyResidentSnapshot(store, ids, data, count, isActive) {
  if (typeof isActive !== 'function') throw new TypeError('isActive must be a function');
  if (!store || !data || !Array.isArray(ids) || !Number.isInteger(count) || count < 0 || ids.length < count || data.length < count * RESIDENT_PARTICLE_STRIDE) {
    throw new TypeError('Resident snapshot shape is invalid');
  }
  let applied = 0, stale = 0;
  for (let i = 0; i < count; i++) {
    const id = ids[i];
    const entity = store.get?.(id) ?? store.entities?.get?.(id);
    if (!entity || !isActive(entity) || entity.parent || !entity.properties) { stale++; continue; }
    const o = i * RESIDENT_PARTICLE_STRIDE, p = entity.properties;
    const x = data[o], y = data[o+1], vx = data[o+2], vy = data[o+3];
    if (![x,y,vx,vy].every(Number.isFinite)) { stale++; continue; }
    p.x=x; p.y=y; p.vx=vx; p.vy=vy; applied++;
  }
  return {applied,stale};
}

export const RESIDENT_PHYSICS_WGSL = `
struct Particle { position: vec2<f32>, velocity: vec2<f32>, charge: f32, mass: f32, id: u32, _padding: u32 };
struct Params { count: u32, gridCols: u32, gridRows: u32, gridCount: u32, radius: f32, strength: f32, softening: f32, maxAcceleration: f32, dt: f32, cellSize: f32, worldWidth: f32, worldHeight: f32 };
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read_write> cellHeads: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> nextParticle: array<u32>;
@compute @workgroup_size(64) fn clearCells(@builtin(global_invocation_id) gid: vec3<u32>) { if(gid.x<params.gridCount){atomicStore(&cellHeads[gid.x],0xffffffffu);} }
@compute @workgroup_size(64) fn insertParticles(@builtin(global_invocation_id) gid: vec3<u32>) {
 let i=gid.x; if(i>=params.count){return;} let p=max(particles[i].position,vec2<f32>(0.0));
 let cell=min(vec2<u32>(floor(p/params.cellSize)),vec2<u32>(params.gridCols-1u,params.gridRows-1u));
 nextParticle[i]=atomicExchange(&cellHeads[cell.y*params.gridCols+cell.x],i);
}
@compute @workgroup_size(64) fn integrateCharged(@builtin(global_invocation_id) gid: vec3<u32>) {
 let i=gid.x; if(i>=params.count){return;} var a=vec2<f32>(0.0); let p=particles[i];
 let cell=min(vec2<i32>(floor(max(p.position,vec2<f32>(0.0))/params.cellSize)),vec2<i32>(i32(params.gridCols-1u),i32(params.gridRows-1u)));
 for(var oy=-1;oy<=1;oy++){for(var ox=-1;ox<=1;ox++){let c=cell+vec2<i32>(ox,oy);if(c.x<0||c.y<0||c.x>=i32(params.gridCols)||c.y>=i32(params.gridRows)){continue;}
 var j=atomicLoad(&cellHeads[u32(c.y)*params.gridCols+u32(c.x)]);var walked=0u;loop{if(j==0xffffffffu||walked>=params.count){break;}if(j!=i){let q=particles[j];let product=p.charge*q.charge;if(abs(product)>1e-9){let d=q.position-p.position;let r2=dot(d,d);if(r2<=params.radius*params.radius){let r=sqrt(r2);let mag=params.strength*product/(r2+params.softening*params.softening);let force=sign(mag)*min(params.maxAcceleration*p.mass,abs(mag));a-=d/max(r,params.softening)*(force/p.mass);}}}j=nextParticle[j];walked++;}
 }}
 var v=p.velocity+a*params.dt;v*=0.994;var pos=p.position+v*params.dt;
 if(pos.x<0.0||pos.x>params.worldWidth){v.x*=-0.8;}if(pos.y<0.0||pos.y>params.worldHeight){v.y*=-0.8;}
 pos=clamp(pos,vec2<f32>(0.0),vec2<f32>(params.worldWidth,params.worldHeight));particles[i].velocity=v;particles[i].position=pos;
}
`;

/** Allocate GPU state. device remains owned by the renderer/runtime. */
export async function createGpuResidentPhysics(device, options = {}) {
  if (!device || device.destroyed) throw new Error('A live WebGPU device is required');
  const module = device.createShaderModule({label:'Organoids resident particle physics',code:RESIDENT_PHYSICS_WGSL});
  const layout = device.createBindGroupLayout({entries:[
    {binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
    {binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}},
    {binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
    {binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
  ]});
  const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
  const make=entry=>device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:entry}});
  const [clear,insert,integrate]=await Promise.all([make('clearCells'),make('insertParticles'),make('integrateCharged')]);
  const params=device.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.lost?.then(info=>{destroyed=true;lastError=`WebGPU device lost: ${info?.message||info?.reason||'unknown reason'}`;pending=null;}).catch(error=>{lastError=String(error?.message||error);});
  let particleBuffer=null,cellBuffer=null,nextBuffer=null,readback=null,bindGroup=null,capacity=0,gridCapacity=0,count=0,ids=[],packedStorage=null,packedIdsStorage=null,inFlight=false,pending=null,destroyed=false,steps=0,readbacks=0,lastError=null,resourceEpoch=0;
  function ensure(n,g){if(Math.ceil(n/64)>device.limits.maxComputeWorkgroupsPerDimension)throw Error('Resident particle dispatch exceeds compute limit');if(g>device.limits.maxComputeWorkgroupsPerDimension*64)throw Error('Resident spatial grid exceeds compute dispatch limit');let changed=false;if(n>capacity){capacity=Math.max(64,2**Math.ceil(Math.log2(n)));const bytes=capacity*RESIDENT_PARTICLE_BYTES;if(bytes>device.limits.maxStorageBufferBindingSize||bytes>device.limits.maxBufferSize)throw Error('Resident particle state exceeds device buffer limits');particleBuffer?.destroy();nextBuffer?.destroy();readback?.destroy();particleBuffer=device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});nextBuffer=device.createBuffer({size:capacity*4,usage:GPUBufferUsage.STORAGE});readback=device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});changed=true;}if(g>gridCapacity){gridCapacity=Math.max(64,2**Math.ceil(Math.log2(g)));const bytes=gridCapacity*4;if(bytes>device.limits.maxStorageBufferBindingSize||bytes>device.limits.maxBufferSize)throw Error('Resident spatial grid exceeds device buffer limits');cellBuffer?.destroy();cellBuffer=device.createBuffer({size:bytes,usage:GPUBufferUsage.STORAGE});changed=true;}if(changed)bindGroup=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:particleBuffer}},{binding:1,resource:{buffer:params}},{binding:2,resource:{buffer:cellBuffer}},{binding:3,resource:{buffer:nextBuffer}}]});}
  function upload(entities,isActive){if(destroyed)throw Error('Resident physics has been destroyed');if(inFlight||pending)throw Error('Cannot upload while a resident snapshot is pending');const packed=packResidentParticles(entities,isActive,{storage:packedStorage,idsStorage:packedIdsStorage});packedStorage=packed.storage;packedIdsStorage=packed.idsStorage;count=packed.count;ids=packed.ids; if(!count){ids=[];return 0;}const cfg=normalizeResidentPhysicsOptions(options);ensure(count,cfg.gridCount);device.queue.writeBuffer(particleBuffer,0,packed.data);const raw=new ArrayBuffer(48),f=new Float32Array(raw),u=new Uint32Array(raw);u[0]=count;u[1]=cfg.gridCols;u[2]=cfg.gridRows;u[3]=cfg.gridCount;f[4]=cfg.radius;f[5]=cfg.strength;f[6]=cfg.softening;f[7]=cfg.maxAcceleration;f[8]=cfg.dt;f[9]=cfg.radius;f[10]=cfg.worldWidth;f[11]=cfg.worldHeight;device.queue.writeBuffer(params,0,raw);return count;}
  function step(dt,overrides={}){if(destroyed)throw Error('Resident physics has been destroyed');if(!count)return false;if(inFlight||pending)return false;if(!Number.isFinite(dt)||dt<0)throw Error('Resident physics requires a finite non-negative timestep');const cfg=normalizeResidentPhysicsOptions({...options,...overrides},dt);const f=new Float32Array(12);const u=new Uint32Array(f.buffer);u[0]=count;u[1]=cfg.gridCols;u[2]=cfg.gridRows;u[3]=cfg.gridCount;f[4]=cfg.radius;f[5]=cfg.strength;f[6]=cfg.softening;f[7]=cfg.maxAcceleration;f[8]=cfg.dt;f[9]=cfg.radius;f[10]=cfg.worldWidth;f[11]=cfg.worldHeight;ensure(count,cfg.gridCount);device.queue.writeBuffer(params,0,f);const encoder=device.createCommandEncoder();const pass=encoder.beginComputePass();pass.setBindGroup(0,bindGroup);pass.setPipeline(clear);pass.dispatchWorkgroups(Math.ceil(u[3]/64));pass.setPipeline(insert);pass.dispatchWorkgroups(Math.ceil(count/64));pass.setPipeline(integrate);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();device.queue.submit([encoder.finish()]);steps++;return true;}
  async function requestSnapshot(){if(destroyed)throw Error('Resident physics has been destroyed');if(inFlight||pending)return false;if(!count)return false;inFlight=true;const started=performance.now(),buffer=readback,epoch=resourceEpoch;const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(particleBuffer,0,buffer,0,count*RESIDENT_PARTICLE_BYTES);device.queue.submit([encoder.finish()]);try{await buffer.mapAsync(GPUMapMode.READ);const copy=buffer.getMappedRange().slice(0);buffer.unmap();if(destroyed||epoch!==resourceEpoch)return false;lastSnapshotMs=performance.now()-started;totalSnapshotMs+=lastSnapshotMs;maxSnapshotMs=Math.max(maxSnapshotMs,lastSnapshotMs);pending={ids:ids.slice(),data:new Float32Array(copy),count};readbacks++;return true;}catch(error){lastError=String(error?.message||error);throw error;}finally{inFlight=false;if(destroyed)buffer.destroy();}}
  function consumeSnapshot(store,isActive){if(!pending)return 0;const snapshot=pending;const result=applyResidentSnapshot(store,snapshot.ids,snapshot.data,snapshot.count,isActive);pending=null;lastSnapshotApplied=result.applied;lastSnapshotStale=result.stale;return result.applied;}
  return {upload,step,requestSnapshot,consumeSnapshot,get count(){return count;},get capacity(){return capacity;},get steps(){return steps;},get readbacks(){return readbacks;},get telemetry(){return {steps,readbacks,lastSnapshotMs,averageSnapshotMs:readbacks?totalSnapshotMs/readbacks:0,maxSnapshotMs,lastSnapshotApplied,lastSnapshotStale,lastError,capacity,gridCapacity,count};},get inFlight(){return inFlight;},get lastError(){return lastError;},get pending(){return !!pending;},destroy(){if(destroyed)return;destroyed=true;resourceEpoch++;pending=null;particleBuffer?.destroy();cellBuffer?.destroy();nextBuffer?.destroy();if(!inFlight)readback?.destroy();params.destroy();}};
}
