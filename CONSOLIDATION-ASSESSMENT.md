# Organoids consolidation assessment

## Current implementation inventory

The authoritative simulation is the self-contained `accretion.html`. `emergence.js` is the reference/exportable substrate and test target; the browser page currently carries an inline copy rather than importing the module at runtime.

| Area | Implemented |
|---|---|
| Entity model | Typed entities, properties, state, energy, IDs, create/remove, snapshots and restore |
| Composition | Recursive containment, descendants, reparenting and cycle prevention |
| Relationships | Typed edges, relationship schemas, directed queries, symmetric adjacency and indexed traversal |
| Transactions | Create, remove, set, compose, link/unlink, energy transfer, field deposit/harvest, dissipation and event emission |
| Rollback | Touched-state entity/edge journal, per-cell field journal, identity-preserving restoration and ledger/event rollback |
| Spatial | Uniform-grid index and radius neighbour queries |
| Pair mechanics | Shared PairEngine, canonical unordered-pair candidate stream, attraction/repulsion and distance constraints |
| Fields | Unit-tagged scalar grids, gradient sampling, metadata-driven diffusion/decay/advection and in-place transport |
| Energy | Generic named quantities, transfer, unit-aware inventory and residual audit against an initial baseline |
| Graph/topology | Neighbours, connected components, cycle checks, assembly, closure predicate and division entry point |
| Chemistry | Data-defined input/output matching, catalysts, property conditions, stochastic rates and energy costs |
| Scheduling | Ordered named phases, time and tick |
| Runtime | Shared engine instances, spatial rebuild, pair forces, constraints, integration, reactions and metadata-driven field transport |
| Browser demo | Particle motion, attraction/repulsion, environmental energy flux, aggregation into molecule entities and rendering |
| Regression | 28 automated tests; CI run #117 passed `npm test` and `node --check emergence.js` |

The browser demo demonstrates an early aggregation stage. It does not yet demonstrate polymerisation, membrane assembly, protocells, autocatalytic metabolism, replication, heredity, signalling networks, differentiation or colonial organisation. Those remain target capabilities, not completed features.

## Completed consolidation history

### Pair mechanics: interactions + constraints
- `PairEngine` is the shared class; `InteractionEngine` and `ConstraintEngine` are compatibility exports.
- The runtime exposes one instance as both `interactions` and `constraints`.
- Force rules and positional constraints share entity/property conventions and the solver object, but retain separate numerical passes. This distinction is appropriate: one accumulates velocity changes, the other corrects positions.

### Graph + topology
- `GraphEngine` and `TopologyEngine` are aliases of one class and one runtime object.
- Graph traversal reads typed relationship edges, including containment.
- Assembly, cycle detection, connected components, closure checks and division entry points are present.
- `closed()` means graph-cycle detection, not geometric membrane enclosure. `divide()` currently assembles groups without consuming or detaching the parent.

### Rules + scheduler
- Reactions run as a named scheduler phase.
- Metadata-driven field transport runs as another ordered phase.
- Scheduler owns phase ordering and time; RuleEngine owns matching and reaction semantics.

### Energy + fields
- EnergyEngine shares the runtime FieldGrid.
- Conversion losses and dissipation can enter the heat field when entity coordinates are valid.
- Energy can move between entity stores and named fields.
- The ledger distinguishes external input, transfers, useful conversion, external output and fielded heat. `audit()` compares energy-only entity/field inventory against an explicit baseline, but cannot account for arbitrary direct mutations outside EnergyEngine.

### Canonical typed relationships
- `EntityStore.links` is now the authoritative relationship record store.
- Containment uses directed `contains` edges and rejects ancestor cycles.
- Other relationship kinds use the same edge representation.
- `parent` and `children` remain synchronised compatibility fields. They are mirrors, not the intended long-term source of truth.

### Transactional rule actions
- `EntityStore.transact(actions, context)` provides a shared action vocabulary for entity, relationship, energy, field and event operations.
- Failed action batches restore touched entities and relationship edges, journalled field cells, the energy ledger and event length without cloning unrelated entities or field cells.
- Reactions compile into action batches; product references are resolved after commit and catalysts are preserved.
- Composite reactants are detached without redistributing consumed reactant energy into their children.

## Latest consolidation pass: primitive generalisation and simplification

Implemented in the shared substrate and mirrored into the standalone browser engine:

- Relationship kinds declare directed or undirected semantics; directed unlink preserves edge orientation, while containment is directed, acyclic and single-parent.
- Canonical edges feed outgoing, incoming and undirected-neighbour indexes. Descendant and graph queries use indexed adjacency rather than scanning the full edge list.
- Reparenting updates the previous containment edge before applying the new edge; compatibility parent/children views remain synchronised.
- Pair interactions use one candidate iterator with unordered-pair deduplication, fixing wildcard selector double-processing while preserving selector roles.
- Failed transactions restore existing entity and properties objects in place, preserve original field-array identities, rebuild indexes, and prevalidate action names and numeric amounts.
- Assembly removes its partial root if a member cannot be composed. Typed graph component queries no longer traverse through unrelated entity types.

These are implemented substrate improvements, not claims that later biological stages are complete.

## Three-pass consolidation overhaul

### Pass 1: transaction journal
- Replaced whole-store snapshots with a journal of touched entities, their relationship endpoints and affected edges. New entities are removed by transaction ID range on rollback.
- Rollback preserves entity, properties, nested property and children-array identities for touched entities.
- FieldGrid journals individual changed cells, avoiding full-field copies for transactional deposits and harvests.
- Removal updates adjacent endpoints rather than scanning every entity.

### Pass 2: quantity and conservation primitives
- Added unit-tagged named entity quantities and transfer operations while retaining `energy` as the compatibility quantity.
- Entity quantity metadata distinguishes mass/material stores from energy; energy inventory includes only entity quantities tagged as energy and fields marked as energy.
- EnergyEngine exposes an energy-only inventory and residual audit against an explicit initial baseline; generic mass quantities are excluded unless explicitly tagged as energy.
- Reactions reject energy overdraw and require an explicit external sink for unallocated product-energy remainder.
- Field deposits and harvests validate field names and coordinates before changing stores.

### Pass 3: metadata-driven field transport
- Fields carry unit, diffusion, decay, advection and boundary metadata; boundary mode currently controls advection sampling.
- Added finite-difference gradients and metadata-selected constant-velocity advection with clamp or periodic-wrap boundaries.
- Diffusion, decay and advection mutate existing typed arrays in place.
- Runtime schedules a shared transport phase across configured fields rather than a heat-only diffusion callback.

These are reusable infrastructure primitives, not a complete proof of global matter or energy conservation under arbitrary external mutation.

## Further consolidation investigation

The following items remain future work after this three-pass overhaul.

### 1. Relationship semantics need direction, schema and adjacency

**Current state**
- Edges are records of `{a,b,type,properties}`.
- Containment is treated as directed by its dedicated methods.
- Relationship schemas now distinguish directed and undirected edges; graph-neighbour traversal remains intentionally undirected, while incoming/outgoing queries preserve direction.
- Descendant and graph queries now use adjacency indexes; index rebuilds are currently used after rollback.

**Interoperability gap**
A signalling edge, an ancestry edge, a symmetric bond and a containment edge do not have the same semantics. A single edge shape is useful, but a single undirected traversal rule is not. Consumers cannot currently ask for incoming versus outgoing signals, enforce relationship-specific cardinality, or distinguish directed and symmetric edge kinds through a shared schema.

**Opportunity**
Extend the relationship-kind registry with endpoint-type constraints and configurable multiplicity/removal policies. Consider deriving compatibility parent/children views rather than maintaining mirrors.

**Priority:** very high. This is the common structural language for chemistry, membranes, lineage, signalling and colonies.

### 2. Transactions need stable identity and validated action contracts

**Current state**
- Transactions journal touched entities, relationship endpoints, changed field cells, the energy ledger and event length.
- Rollback restores touched entity, property, nested property and children-array identities in place.
- Action names and numeric amounts are prevalidated, but operation-specific required fields and references are still checked during execution.
- Numeric amounts are not consistently checked for finiteness and valid ranges.
- A missing relationship removal currently succeeds as a no-op.
- Transactional removal has an implicit energy-distribution policy unless `discardEnergy` is set.

**Interoperability gap**
Stable object identity is now preserved for pre-existing entities, properties and field arrays. Journal cost now scales with touched entities, edges and field cells rather than the whole world. Without validated action contracts, each new behaviour can introduce slightly different validation and failure semantics.

**Opportunity**
Define one action schema with required fields, numeric domains, reference types and preconditions. Validate the full batch before mutation where possible. Extend the journal to cover arbitrary external side effects and validate complete operation-specific action schemas before mutation. Make removal energy policy explicit, such as transfer-to-children, transfer-to-products, deposit-to-field or external sink. Add nested transaction policy only if a real use case requires it.

**Priority:** very high. This underpins every reaction, division, fusion, replication and behavioural transition.

### 3. Energy accounting is not yet conservation accounting

**Current state**
- Energy remains a compatibility scalar; entities also support generic named quantity stores.
- Fields are scalar arrays with unit and transport metadata.
- EnergyEngine calculates entity/field energy inventory and a residual audit against an explicit initial baseline; coverage remains limited to stores and flows routed through the engine.
- Generic field deposits are counted as transfers, while the `fielded` counter is used for heat output specifically.
- Reaction output totals are checked against the reactant energy budget; any unallocated remainder requires an explicit external sink.
- Field deposits and harvests validate field names and finite coordinates before changing entity stores.

**Interoperability gap**
A ledger of events is not an invariant. The system cannot currently prove that energy entering, leaving, stored in entities and stored in fields balances. Nor can it distinguish energy from arbitrary resource quantities because both are represented as untyped numbers.

**Opportunity**
Define typed quantities and material/energy stores with explicit units. Track external inputs, external outputs, entity inventory, field inventory, conversion, dissipation and reaction stoichiometry. Add an audit that computes residual error after each transaction or tick. Require reaction products plus declared sinks to balance consumed inputs, with an explicit exception for external sources. Validate coordinates and field existence before debiting a source store.

**Priority:** very high, before adding more chemistry. It is the numerical equivalent of type safety.

### 4. Field transport is a grid primitive, not a reusable field system

**Current state**
- FieldGrid supports named scalar arrays, units, metadata-driven diffusion/decay/advection, gradients, add/sample/take and per-cell transaction journalling.
- Diffusion is a no-flux interior exchange: edge cells do not exchange with an exterior reservoir.
- Vector/tensor fields, richer boundary policies and field source/sink ledgers remain future work.
- The scheduler transports all configured fields according to their metadata.

**Interoperability gap**
Chemotaxis, nutrient uptake, waste export, osmotic gradients, temperature and signalling all need fields, but not necessarily the same transport law. Treating every field as an untyped scalar makes units and transport assumptions implicit.

**Opportunity**
Represent a field as data plus policies: quantity unit, scalar/vector/tensor shape, diffusion coefficient, advection mode, decay, boundary conditions and source/sink accounting. Share sampling, gradient and transfer APIs across field types. Make transport a scheduled operator selected by field metadata, rather than a hard-coded heat phase.

**Priority:** high, coupled to the conservation audit.

### 5. Pair mechanics share a class, but not yet a common interaction pipeline

**Current state**
- One PairEngine contains force rules and distance constraints.
- Force candidates now come from one reusable iterator with unordered-pair deduplication; constraint solving remains a separate positional pass.
- Force and constraint policies share the solver but retain distinct numerical update rules.
- Unknown force modes currently fall through to attraction.

**Interoperability gap**
Attraction, repulsion, springs, adhesion, collision response and geometric constraints need common candidate selection and validation, but different update policies. The current class alias unifies identity more than semantics.

**Opportunity**
Extend the candidate stream to collision, impulse, adhesion and measurement policies. Validate modes and parameters at registration.

**Priority:** high after transaction and invariant work. Fix pair duplication as part of the shared candidate iterator.

### 6. Scheduler ordering is present; simulation clocks and failure semantics are not

**Current state**
- Scheduler orders named phases by priority and insertion order.
- Every phase runs once per call, regardless of its natural timescale.
- Scheduler time and tick advance only after all phases return.
- A phase failure can leave earlier phase mutations applied while time and tick remain unchanged.
- Runtime integration, constraints, reactions and field diffusion use one outer timestep.

**Interoperability gap**
Mechanical integration, fast chemistry, slow gene regulation, field transport and population events have different stability and frequency requirements. A single global dt forces an awkward compromise.

**Opportunity**
Add fixed-step or bounded-substep clocks per phase group, deterministic phase boundaries, and explicit failure policy. Transactional phases can commit independently; non-transactional physics phases need checkpoint or fail-stop semantics. Use a deterministic event queue for delayed reactions and scheduled population transitions.

**Priority:** high, but only after action transactions and conservation invariants are stable.

### 7. Topology operations are graph manipulations, not yet conserved transformations

**Current state**
- Assembly creates a new root and composes members.
- Division creates new structures from supplied groups but does not detach or consume the parent.
- Assembly now removes its newly-created root if a later member is invalid; rollback of all pre-existing members remains unnecessary because failed composition validates before mutation.
- Closure is graph-cycle based, not a spatial enclosure test.

**Interoperability gap**
Fusion, fission, membrane closure and compartment division need coordinated changes to entity ownership, bonds, fields, energy and contents. A graph helper cannot safely perform these as unrelated mutations.

**Opportunity**
Make topology operations transaction plans over the shared action model. Define explicit ownership and partition rules for contents, energy, relationships and fields. Keep graph connectivity, graph cycles and geometric enclosure as separate predicates.

**Priority:** medium-high, after transactional actions and conservation audit.

### 8. The demo still contains an app-specific aggregation rule

**Current state**
- The browser demo uses the shared pair solver and runtime, but aggregation is performed by an imperative `merge()` function in `accretion.html`.
- That function calculates contact, mass-weighted position and velocity, creates a molecule, composes the particles and moves their energy into the molecule.
- This is currently the only demonstrated transformation beyond particle motion.

**Interoperability gap**
The engine has a declarative reaction system, but the visible aggregation step bypasses it. The same biological transition can therefore be implemented once as app-specific code and again as a generic rule.

**Opportunity**
Express aggregation as a reusable contact/adhesion trigger plus a transactional transformation policy. Keep mass-weighted centre-of-mass and momentum calculations in a reusable merge operator, not in a particle-specific app callback. The demo then becomes a configuration of the substrate rather than a second source of biological semantics.

**Priority:** medium-high. This is the best end-to-end proof that the abstractions are actually reusable.

### 9. Material schemas are the missing bridge between entities and biology

**Current state**
- Entity type and arbitrary properties are free-form.
- Mass, energy, position, velocity and chemical traits have no common schema or validation.
- Composition does not imply a material or behavioural inheritance model.

**Interoperability gap**
Molecules, membranes, compartments, catalysts, cells and colonies need shared properties and composable capabilities without hardcoding a class for every category.

**Opportunity**
Add data-defined material schemas and capability fragments. Schemas should declare properties, units, defaults, constraints and optional behaviours, while composition combines capabilities without requiring inheritance-heavy entity classes. This should follow the action and conservation contracts so schemas cannot silently bypass them.

**Priority:** medium, after field and energy contracts.

### 10. Deterministic replay and performance instrumentation

**Current state**
- RuleEngine accepts an injectable random function, but the runtime does not expose a complete seed/replay contract.
- Spatial indexing is rebuilt as a whole.
- Relationship queries scan the edge array.
- Transactions clone the whole store.
- There are no standard counters for pair candidates, edge scans, transaction size, field operations or phase duration.

**Opportunity**
Provide a seeded random source and record external inputs plus committed action batches. Add deterministic replay tests. Instrument candidate counts and work per phase before introducing incremental caches or more complex data structures. Optimise from measured bottlenecks rather than guessing.

**Priority:** medium. Instrument first; cache only where measurements justify it.

## Recommended consolidation sequence

1. **Relationship contract v3:** endpoint constraints, configurable multiplicity/removal policies and fully derived containment views.
2. **Transaction contract v3:** complete per-operation schemas, explicit removal-energy policy and undo journal.
3. **Conservation contract:** typed quantities, entity/field inventory totals, reaction balance and per-tick residual audit.
4. **Field transport:** field metadata, boundary conditions, gradients, advection/decay operators and scheduler integration.
5. **Pair pipeline:** collision/impulse/adhesion policies over the shared candidate stream.
6. **Multi-rate scheduler:** stable substeps, event queue and phase failure semantics.
7. **Transactional topology:** atomic fusion/fission/division with conserved contents and relationships.
8. **Generic aggregation demonstration:** move the demo's imperative merge semantics into reusable operators and actions.
9. **Material schemas and deterministic replay:** data-driven capability composition, seeded execution and reproducible event logs.
10. **Measured optimisation:** adjacency/spatial cache maintenance and transaction journalling based on instrumentation.

## Verification boundaries

- GitHub Actions run #117 passed both `npm test` (28 tests) and `node --check emergence.js` after the unit-aware quantity correction. Browser interaction and sustained-load performance have not been separately benchmarked.
- Targeted earlier runtime assertions covered typed-edge traversal, containment-cycle rejection, transaction commit/rollback, reaction execution, heat accounting and composite-reactant energy handling.
- This investigation is a source-level architectural review, not a new runtime benchmark or browser verification.
- Sustained-load stability, global energy/matter conservation, deterministic replay and full biological progression remain unverified.

## Measurement discipline

Always report actual measured source size, separately from estimates and from tests/documentation. Report both total characters and non-whitespace characters; use UTF-8 bytes only when explicitly labelled as bytes. Compare like-for-like scopes.

The previous 710/1,925-character figures were planning estimates, not measured implementation sizes. The earlier Boids branch's 12,803-character `emergence.js` was a different branch and is not the authoritative Organoids baseline.
