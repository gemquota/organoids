# Organoids consolidation assessment

## Scope completed

This pass consolidates four architectural seams in the emergence substrate. It does not implement the new opportunities listed below.

### 1. Pair mechanics: interactions + constraints

- `PairEngine` is the shared implementation.
- `InteractionEngine` and `ConstraintEngine` are compatibility exports of the same class.
- One runtime instance is exposed as both `interactions` and `constraints`.
- Force rules and distance constraints remain distinct data/policies, while sharing the same solver object and entity/property model.
- Constructor compatibility is retained: definitions containing `rest` are interpreted as constraints; other definitions as interaction rules.

**Assessment:** runtime identity is unified; candidate traversal and numerical solving are not yet one generic policy pipeline. Force accumulation changes velocity, while constraints correct position. Keeping those operations semantically distinct is correct.

### 2. Structure: graph + topology

- `GraphEngine` now also owns assembly, closure checks and division entry points.
- `TopologyEngine` is a compatibility export of the same class.
- Runtime exposes one object as both `graph` and `topology`.
- Graph traversal understands both explicit links and containment relationships.
- Typed component queries can traverse through structural intermediary entities without returning those intermediary entities as members.

**Assessment:** query and topology operations share one structural API. Storage is not fully canonical: containment still lives in `parent/children`, while other relationships live in `links`. `closed()` detects graph cycles, not geometric membrane closure. `divide()` currently assembles groups without consuming or detaching the parent.

### 3. Rules + scheduler

- Rule execution is now a named scheduler phase rather than a separate call in the runtime step.
- Field diffusion is another ordered scheduler phase.
- The scheduler owns phase order and simulation time; the rule engine owns reaction matching and transformation semantics.

**Assessment:** orchestration is unified without collapsing two different responsibilities. Rules still need a more general action model before state changes, composition, signalling and replication can all use the same declarative language.

### 4. Energy + fields

- `EnergyEngine` receives the runtime `FieldGrid`.
- Dissipation and conversion losses are deposited into the spatial heat field when an entity has a valid position.
- Reaction energy costs use the same heat path.
- Generic field deposit/harvest methods transfer quantities between entity stores and fields.
- Heat diffusion is scheduled as a normal simulation phase.
- The ledger distinguishes energy input, transfer, conversion loss, external output and fielded heat.

**Assessment:** energy and spatial fields now exchange quantities. This is a first coupling, not a complete thermodynamic model. Field units, energy units, boundary flux, temperature coupling and global conservation auditing remain undefined.

## Semantic interoperability review

| Seam | Shared semantics achieved | Remaining mismatch |
|---|---|---|
| Pair mechanics | Same entities, properties, pair engine and runtime object | Force and positional constraint solvers still use separate loops |
| Graph/topology | Same graph object and traversal API; containment is visible | Two underlying relationship stores; geometry is not topology |
| Rules/scheduler | Rules execute inside ordered phases | Rule actions are still mostly consume/create; scheduler does not own rule semantics |
| Energy/fields | Shared field instance and quantity transfer | No universal units, temperature coupling or global conservation proof |

## New opportunities identified, not implemented

1. **Canonical relationship store.** Represent containment, bonds, adhesion, ancestry, signalling and compartment membership as typed edges. Derive parent/children views and enforce acyclic containment separately from cyclic bonds.
2. **Policy-driven pair solver.** Share candidate enumeration and pair filtering across attraction, repulsion, springs, collision response, adhesion and geometry. Keep force and positional correction as explicit solver policies.
3. **Transactional rule actions.** Give rules a common action vocabulary: set property, create/remove entity, compose, link/unlink, transfer energy, deposit/harvest field quantity, emit event. Validate and commit each reaction atomically.
4. **Typed field transport.** Add field metadata for units, diffusion, advection, decay, boundary conditions, source/sink accounting and gradient sampling.
5. **Global conservation audit.** Track entity stores, field stores, reaction inputs/outputs, external sources and sinks in one ledger. Detect unaccounted energy/matter rather than merely recording selected transfers.
6. **Composable material schemas.** Define material properties and behaviours as data templates inherited or combined through composition, avoiding special-case particle/molecule/cell code.
7. **Multi-rate scheduler.** Support physical, chemical, field and population clocks with stable substeps and deterministic ordering.
8. **Transactional topology operations.** Make fusion, fission and compartment division conserve contents, energy and relationships; distinguish graph cycles from geometric enclosure.
9. **Deterministic replay.** Seed and record random decisions, rule events and external inputs so emergent failures can be reproduced.
10. **Incremental adjacency and spatial caches.** Avoid repeated full-link scans and redundant spatial rebuilds as entity counts and relationship networks grow.
11. **Rule registry and compositional behaviours.** Make materials, reactions, signalling and adaptive behaviours declarative data packs validated against the shared action schema.

## Recommended order

1. Canonical relationship store, with containment invariants.
2. Transactional rule actions, because they unlock chemistry, signalling, inheritance and state transitions.
3. Typed field transport plus global conservation audit.
4. Policy-driven pair solver and multi-rate scheduling.
5. Transactional topology, then composable material schemas and deterministic replay.

This order prioritises semantic interoperability and correctness before adding more emergent categories.

## Verification boundaries

- Source syntax and targeted runtime integration assertions were checked in this pass.
- The repository's GitHub Actions workflow runs `npm test` and `node --check emergence.js`; its result must be checked for the final commit.
- Browser rendering, numerical stability under sustained load and full conservation remain unverified.
