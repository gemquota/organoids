# Organoids consolidation assessment

## Current implementation inventory

The authoritative simulation is the self-contained `accretion.html`. `emergence.js` is the reference/exportable substrate and test target; the browser page currently carries an inline copy rather than importing the module at runtime.

| Area | Implemented |
|---|---|
| Entity model | Typed entities, properties, state, energy, IDs, create/remove, snapshots and restore |
| Composition | Recursive containment, descendants, reparenting and cycle prevention |
| Relationships | Typed edge records for containment and arbitrary relationship kinds |
| Transactions | Create, remove, set, compose, link/unlink, energy transfer, field deposit/harvest, dissipation and event emission |
| Rollback | Entity map, edges, field arrays, energy ledger and event length |
| Spatial | Uniform-grid index and radius neighbour queries |
| Pair mechanics | Shared PairEngine class for attraction/repulsion and distance constraints |
| Fields | Named scalar grids, sample/add/take and conservative nearest-neighbour diffusion |
| Energy | External source, transfer, conversion, dissipation, field deposit/harvest and partial ledger |
| Graph/topology | Neighbours, connected components, cycle checks, assembly, closure predicate and division entry point |
| Chemistry | Data-defined input/output matching, catalysts, property conditions, stochastic rates and energy costs |
| Scheduling | Ordered named phases, time and tick |
| Runtime | Shared engine instances, spatial rebuild, pair forces, constraints, integration and scheduled reactions/heat diffusion |
| Browser demo | Particle motion, attraction/repulsion, environmental energy flux, aggregation into molecule entities and rendering |
| Regression | 17 automated tests; latest recorded CI run #77 passed `npm test` and `node --check emergence.js` |

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
- Field diffusion runs as another ordered phase.
- Scheduler owns phase ordering and time; RuleEngine owns matching and reaction semantics.

### Energy + fields
- EnergyEngine shares the runtime FieldGrid.
- Conversion losses and dissipation can enter the heat field when entity coordinates are valid.
- Energy can move between entity stores and named fields.
- The ledger distinguishes external input, transfers, useful conversion, external output and fielded heat. It is not yet a complete conservation proof.

### Canonical typed relationships
- `EntityStore.links` is now the authoritative relationship record store.
- Containment uses directed `contains` edges and rejects ancestor cycles.
- Other relationship kinds use the same edge representation.
- `parent` and `children` remain synchronised compatibility fields. They are mirrors, not the intended long-term source of truth.

### Transactional rule actions
- `EntityStore.transact(actions, context)` provides a shared action vocabulary for entity, relationship, energy, field and event operations.
- Failed action batches restore the entity store, edge list, field arrays, energy ledger and event length.
- Reactions compile into action batches; product references are resolved after commit and catalysts are preserved.
- Composite reactants are detached without redistributing consumed reactant energy into their children.

## Further consolidation investigation

This investigation inspects the current implementation and identifies the next semantic seams. It does not implement these changes.

### 1. Relationship semantics need direction, schema and adjacency

**Current state**
- Edges are records of `{a,b,type,properties}`.
- Containment is treated as directed by its dedicated methods.
- `GraphEngine.neighbours()` treats every relationship as undirected, regardless of type.
- `descendants()`, `neighbours()` and graph traversals repeatedly scan the full edge array.
- Parent pointers are still consulted for containment-cycle checks, while traversal reads edge records.

**Interoperability gap**
A signalling edge, an ancestry edge, a symmetric bond and a containment edge do not have the same semantics. A single edge shape is useful, but a single undirected traversal rule is not. Consumers cannot currently ask for incoming versus outgoing signals, enforce relationship-specific cardinality, or distinguish directed and symmetric edge kinds through a shared schema.

**Opportunity**
Introduce a relationship-kind registry describing directionality, symmetry, endpoint constraints, multiplicity and removal policy. Add explicit `outgoing`, `incoming` and undirected `neighbours` queries. Maintain adjacency indexes from the canonical edge store and derive legacy parent/children views from containment edges. Keep containment acyclic while allowing cyclic bonds and signalling networks.

**Priority:** very high. This is the common structural language for chemistry, membranes, lineage, signalling and colonies.

### 2. Transactions need stable identity and validated action contracts

**Current state**
- Transactions snapshot the entire entity map, edge list, field arrays, energy ledger and event length.
- Rollback replaces the entity map with cloned entities and replaces field maps with cloned arrays.
- The action switch validates some references but does not validate a complete action schema before execution.
- Numeric amounts are not consistently checked for finiteness and valid ranges.
- A missing relationship removal currently succeeds as a no-op.
- Transactional removal has an implicit energy-distribution policy unless `discardEnergy` is set.

**Interoperability gap**
Replacing objects on rollback means callers holding references to entity objects or field arrays can retain stale objects after a failed transaction. Whole-store snapshots also scale with total world size, not transaction size. Without validated action contracts, each new behaviour can introduce slightly different validation and failure semantics.

**Opportunity**
Define one action schema with required fields, numeric domains, reference types and preconditions. Validate the full batch before mutation where possible. Replace whole-world rollback with an undo journal or copy-on-write transaction that restores objects in place and preserves identity. Make removal energy policy explicit, such as transfer-to-children, transfer-to-products, deposit-to-field or external sink. Add nested transaction policy only if a real use case requires it.

**Priority:** very high. This underpins every reaction, division, fusion, replication and behavioural transition.

### 3. Energy accounting is not yet conservation accounting

**Current state**
- Entity energy is a scalar.
- Fields are scalar arrays without units or transport metadata.
- The ledger records selected flows but does not calculate total energy held in entities plus all fields plus external output.
- Generic field deposits are counted as transfers, while the `fielded` counter is used for heat output specifically.
- Reaction product energy can be explicitly overridden per output; the engine does not verify that explicit product totals equal reactant energy minus costs and declared sinks.
- Energy operations assume valid field names and usable entity coordinates; invalid coordinates can cause a field write to miss its intended cell.

**Interoperability gap**
A ledger of events is not an invariant. The system cannot currently prove that energy entering, leaving, stored in entities and stored in fields balances. Nor can it distinguish energy from arbitrary resource quantities because both are represented as untyped numbers.

**Opportunity**
Define typed quantities and material/energy stores with explicit units. Track external inputs, external outputs, entity inventory, field inventory, conversion, dissipation and reaction stoichiometry. Add an audit that computes residual error after each transaction or tick. Require reaction products plus declared sinks to balance consumed inputs, with an explicit exception for external sources. Validate coordinates and field existence before debiting a source store.

**Priority:** very high, before adding more chemistry. It is the numerical equivalent of type safety.

### 4. Field transport is a grid primitive, not a reusable field system

**Current state**
- FieldGrid supports named scalar arrays, clamped cell lookup, add, sample, take and pairwise conservative diffusion.
- Diffusion is a no-flux interior exchange: edge cells do not exchange with an exterior reservoir.
- There is no field metadata, advection, decay, vector field, gradient API, source/sink accounting or boundary-condition policy.
- The scheduler currently diffuses heat only.

**Interoperability gap**
Chemotaxis, nutrient uptake, waste export, osmotic gradients, temperature and signalling all need fields, but not necessarily the same transport law. Treating every field as an untyped scalar makes units and transport assumptions implicit.

**Opportunity**
Represent a field as data plus policies: quantity unit, scalar/vector/tensor shape, diffusion coefficient, advection mode, decay, boundary conditions and source/sink accounting. Share sampling, gradient and transfer APIs across field types. Make transport a scheduled operator selected by field metadata, rather than a hard-coded heat phase.

**Priority:** high, coupled to the conservation audit.

### 5. Pair mechanics share a class, but not yet a common interaction pipeline

**Current state**
- One PairEngine contains force rules and distance constraints.
- Force candidate traversal and constraint solving remain separate loops.
- Pair filtering is encoded inside the force loop.
- The wildcard rule combination `a:'*', b:'A'` can visit A-to-A pairs from both endpoints because the duplicate-pair guard only covers equal selectors and wildcard/wildcard.
- Unknown force modes currently fall through to attraction.

**Interoperability gap**
Attraction, repulsion, springs, adhesion, collision response and geometric constraints need common candidate selection and validation, but different update policies. The current class alias unifies identity more than semantics.

**Opportunity**
Extract a deterministic pair-candidate iterator with canonical pair ordering, selector matching and shared exclusions. Make each operation a policy over the candidate stream: force accumulation, positional correction, impulse, adhesion or measurement. Validate modes and parameters at registration. Preserve distinct numerical solvers where their mathematics differs.

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
- Assembly is not atomic if a later member is invalid.
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

1. **Relationship contract v2:** directionality/schema, adjacency indexes, derived containment views and traversal tests.
2. **Transaction contract v2:** action validation, stable object identity on rollback, explicit removal-energy policy and undo journal.
3. **Conservation contract:** typed quantities, entity/field inventory totals, reaction balance and per-tick residual audit.
4. **Field transport:** field metadata, boundary conditions, gradients, advection/decay operators and scheduler integration.
5. **Pair pipeline:** deterministic candidate iterator, wildcard duplicate fix and explicit force/constraint policies.
6. **Multi-rate scheduler:** stable substeps, event queue and phase failure semantics.
7. **Transactional topology:** atomic fusion/fission/division with conserved contents and relationships.
8. **Generic aggregation demonstration:** move the demo's imperative merge semantics into reusable operators and actions.
9. **Material schemas and deterministic replay:** data-driven capability composition, seeded execution and reproducible event logs.
10. **Measured optimisation:** adjacency/spatial cache maintenance and transaction journalling based on instrumentation.

## Verification boundaries

- Latest recorded GitHub Actions run #77 passed `npm test` and `node --check emergence.js`; the suite contains 17 tests.
- Targeted earlier runtime assertions covered typed-edge traversal, containment-cycle rejection, transaction commit/rollback, reaction execution, heat accounting and composite-reactant energy handling.
- This investigation is a source-level architectural review, not a new runtime benchmark or browser verification.
- Sustained-load stability, global energy/matter conservation, deterministic replay and full biological progression remain unverified.

## Measurement discipline

Always report actual measured source size, separately from estimates and from tests/documentation. Report both total characters and non-whitespace characters; use UTF-8 bytes only when explicitly labelled as bytes. Compare like-for-like scopes.

The previous 710/1,925-character figures were planning estimates, not measured implementation sizes. The earlier Boids branch's 12,803-character `emergence.js` was a different branch and is not the authoritative Organoids baseline.
