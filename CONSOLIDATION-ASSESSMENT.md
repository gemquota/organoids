# Organoids Consolidation Assessment

**Snapshot:** 15 November 2026  
**Implementation branch:** feat/four-stage-emergence-completion  
**Audit basis:** live source and tests; see docs/organoids/SOURCE_MAPPED_AUDIT.md.

## 1. Consolidated architecture

The runtime has one authoritative owner for each shared concern:

| Concern | Owner | Consumers |
|---|---|---|
| Entity identity, properties, lifecycle state and typed relations | EntityStore | GolfCore, reactions, biology |
| Energy and energy-valued material flux | EnergyEngine | reactions, growth, reproduction, aggregation |
| Scalar fields and field transport | FieldGrid | EnergyEngine, scheduler, experiments |
| Neighbour lookup | SpatialIndex | InteractionEngine, EmergenceProgression |
| Graph analysis | GraphEngine | TopologyEngine, biology |
| Composition/assembly | TopologyEngine and EntityStore | molecular, colony and organism assembly |
| Declarative reactions | RuleEngine | autocatalytic network policies |
| Ordered execution | GolfCore and Scheduler | runtime rules and phases |
| Biological policy and experiments | src/emergence.js | runtime owners above |

The progression module does not create a parallel entity store, energy ledger, spatial index, graph solver or scheduler.

## 2. Post-completion simplification review

### Kept separate because semantics differ

- InteractionEngine and ConstraintEngine: force accumulation changes velocity; constraint projection corrects geometry.
- GraphEngine and TopologyEngine: graph queries are read-only analysis; topology changes composition.
- EntityStore containment state and biological lifeStage: a cell can be bound within a colony while still alive and active.
- EnergyEngine reservoirs and lineage history: lineage is evidence, not conserved physical inventory.
- RuleEngine reaction policies and GolfCore general predicates/effects: both use transactions but solve different rule domains.

### Reused instead of duplicated

- Molecular formation uses EntityStore composition and EnergyEngine transfer.
- Polymerisation uses the same composition/bond primitives.
- Membrane and protocell assembly use EntityStore and the same entity contracts.
- Replication uses the shared entity creation, energy transfer and typed lineage relation.
- Colony formation delegates to TopologyEngine.
- Morphogenesis uses the existing ConstraintEngine.
- Experiments use the runtime's seeded random source, EnergyEngine field operations and the same lineage journal.

### Simplification opportunities retained as explicit boundaries

- StateOwner is a facade over existing owners, not another storage layer. Full encapsulation of legacy public entity payloads remains future work.
- ModuleContractRegistry and AtomicExecutor are orchestration contracts over EntityStore.transact, not a second transaction engine.
- LineageJournal ancestor/descendant maps and lifetime metrics are projections of immutable event history. They are query/statistics projections, not duplicate truth.
- EmergenceProgression metrics are diagnostics. If long-running experiments need durable counters, derive them from event history or periodically reconcile them rather than treating both as authoritative.
- The current UI uses reusable aggregation and molecular formation. The bespoke merge loop has been removed.

## 3. Transaction and execution assessment

EntityStore.transact is the shared atomic action boundary. It restores affected entity/property identities, relationship projections, engine-managed field cells, energy-ledger values and supplied event arrays when an action fails. Lifecycle state is now part of that same action batch.

AtomicExecutor stages module action arrays, rejects duplicate entity/property writes and commits them together. ModuleContractRegistry validates required runtime services and enforces exclusive declared write ownership. DeterministicEventQueue/EventRuleRouter provide phase-aware FIFO dispatch and retry failed event batches.

This is not whole-tick atomicity. GolfCore, RuleEngine and field transport execute as ordered phases with their own mutation boundaries. External side effects and direct public-object writes are not rollback-safe. The system must not advertise stronger guarantees than this.

## 4. Four-stage review

| Stage | Consolidated mechanisms | Status |
|---|---|---|
| Substrate | EntityStore, energy/field owners, GolfCore, module contracts, StateOwner, AtomicExecutor, lifecycle | Implemented with public-state and whole-tick limitations |
| Emergence | contact aggregation, bonds, molecular components, polymers, autocatalytic network assembly, membranes, protocells | Implemented primitives; no selective transport/metabolism |
| Biology | sequence replication/mutation, lineage, growth, reproduction, colonies, differentiation, morphogenesis | Implemented primitives; no gene regulation or ecological model |
| Evidence | seeded experiments, perturbations, interventions, reaction/biological histories, bootstrap statistics, blind coded arms | Implemented and tested; larger parameter sweeps and stronger inference remain |

## 5. Scientific and behavioural limits

The current system demonstrates executable transformations, not a validated origin-of-life model. A lipid ring is a geometric membrane abstraction; protocell permeability is metadata until transport mechanisms are added; genome sequences are copied strings; growth is an explicit biomass increment; differentiation is an assigned phenotype; morphogenesis uses an explicit radial/bilateral layout. These are honest primitives on which more realistic models can be built.

## 6. Verification gates

The final branch must have:
1. All Node tests passing on its final head.
2. Runtime module syntax validated by CI.
3. Tests for energy inventory, transactional rollback, lifecycle, heredity, membrane formation and lineage.
4. A browser smoke test confirming dynamic module load and reusable aggregation.
5. Updated source maps and status docs tied to the same branch.

Node CI is not browser verification. Browser and sustained-load results remain unverified until exercised.

## 7. Net assessment

The main architectural gain is not merely a larger feature count. The same entity, relation, energy, field, topology and transaction primitives now support chemistry-like assembly and biological progression without introducing competing foundational stores. The remaining work is concentrated in stronger state encapsulation, event dispatch, realistic membrane/metabolic behaviour, gene regulation, emergent development and deeper statistical experiments.


## 8. Final transaction and abstraction pass

The final review found and corrected several partial-commit paths rather than merely documenting them:

- EntityStore transaction journals now preserve typed material quantity values and unit metadata, in addition to entity state, fields and energy ledger.
- StateOwner material changes, material transfers and removals now use the canonical transaction boundary.
- TopologyEngine assembly, contact-bond batches, autocatalytic network assembly, membrane/protocell construction, replication with daughter membrane, growth, polymerisation, differentiation and morphogenesis use atomic action batches at their natural operation boundary.
- Failed replication restores its seeded random stream; failed membrane/protocell assembly leaves no orphan lipids or partial containers.
- RuleEngine reaction events have stable sequence numbers and are captured in lineage histories during experiments.
- The obsolete direct bond helper was removed. Progression metrics are derived from LineageJournal lifetime counts/totals instead of a second mutable counter object.
- No parallel material store, lineage database, topology solver or energy ledger was introduced.
