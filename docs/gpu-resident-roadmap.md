# GPU-resident simulation roadmap

## Status

`src/gpu/resident.js` is an experimental, opt-in compute foundation. It is **not connected to the live runtime** and is not a replacement for the current GPU electrostatics pipeline. It must remain isolated until a real WebGPU device validates shader compilation, numerical agreement, stability, and performance.

## State contract

- The experimental buffer stores charged root particles in an 8-word / 32-byte record: position, velocity, charge, mass, unsigned entity ID, padding.
- `upload()` creates an explicit CPU snapshot. Subsequent `step()` calls integrate state and charged-particle forces on-device, rebuilding a linked-cell grid each step.
- GPU state is authoritative only inside this experimental instance. Chemistry, relationships, entity creation/removal, valence, thermal exchange and the energy ledger remain CPU-owned.
- `requestSnapshot()` is explicit and asynchronous. It blocks additional resident steps until the readback completes and is consumed, preventing buffer-map races. `consumeSnapshot()` applies positions/velocities only to still-active, root entities.
- CPU-to-GPU upload and GPU-to-CPU snapshot are synchronization boundaries. The intended production direction is to reduce their frequency, not to call them every frame.

## Migration sequence

1. Validate the isolated resident kernel against the CPU electrostatics reference for identical initial state, timestep and parameters. Check finite state, momentum behaviour, boundary handling and deterministic tolerance.
2. Introduce stable entity-ID mapping and explicit dirty ranges. Upload only changed or newly created charged roots; remove dead entities through compact/rebuild operations.
3. Make the renderer consume the resident position buffer directly when layouts and ownership are compatible, avoiding repacking and `queue.writeBuffer()` each frame.
4. Integrate the GPU physics step behind a runtime feature flag. Keep CPU-authoritative interactions/chemistry at explicit synchronization barriers; don't run CPU and GPU motion on the same particles simultaneously.
5. Move reusable spatial-grid construction to shared GPU buffers and have force, molecular, and thermal kernels consume the common index where their eligibility filters allow.
6. Only enable by default after browser/device tests and population-scale benchmarks demonstrate a win and parity. Keep CPU fallback.

## Current limitations

- Snapshot packing still allocates an ID snapshot; the float packing buffer can be reused.
- No live runtime integration, no device validation, and no CPU-vs-GPU parity benchmark yet.
- The prototype models charged particles only; it does not represent chemistry, energy accounting or topology.
- GPU compute must not be enabled concurrently with the existing CPU integrator for the same entities.

## Five follow-up engineering passes (2026-11-28)

1. **Input correctness:** generic iterables now grow packing storage safely; activity predicates are validated; ID and packed-state views are kept distinct. Added iterable-overflow tests.
2. **Parameter consistency:** upload and step share one normalizer for radius, world dimensions, grid dimensions, softening, acceleration cap and timestep. Added normalization tests.
3. **Synchronization correctness:** CPU snapshot application validates payload shape, finite values, active/root entity status and stale IDs. Device-loss and snapshot telemetry are recorded.
4. **Lifecycle hardening:** snapshot mapping is protected against teardown races; destruction is idempotent; empty uploads clear the entity mapping. Added guarded async teardown handling.
5. **Numerical reference and finalization:** added a CPU reference step for the resident kernel's force/integration contract and tests for like-charge repulsion, opposite-charge attraction and bounded finite state. This is a reference oracle, not a substitute for actual WGSL/device parity testing.

Latest automated suite after these passes: 215 tests passing. Real WebGPU shader execution, numerical GPU-vs-reference parity and hardware performance remain explicit release gates. The resident path remains opt-in and disconnected from the live runtime.
