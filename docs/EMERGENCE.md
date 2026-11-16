# Organoids runtime and emergence architecture

Organoids builds emergence from generic entities, typed relationships, physical reservoirs and transactional operations. The same substrate represents particles, molecules, polymers, membranes, protocells, cells and colonies. Domain-specific policies are layered on the shared mechanisms rather than implemented as parallel entity stores.

## 1. Runtime substrate

The authoritative base runtime remains in accretion.html.

- **GolfCore:** named predicates/effects, deterministic phase/priority/registration ordering, staged property patches and transactional commits.
- **EntityStore:** entity identity, typed links, containment, relationship indexes, immutable relationship event history, snapshots and journalled transactions.
- **SpatialIndex:** reusable uniform-grid neighbour queries.
- **InteractionEngine / ConstraintEngine:** separate continuous force accumulation and geometric projection services.
- **FieldGrid:** typed scalar fields, gradients, diffusion, advection, decay, scratch buffers and cell-level journals.
- **EnergyEngine:** entity energy, typed material quantities, energy-field flux authority, source/sink accounting and inventory audits.
- **GraphEngine / TopologyEngine:** graph analysis is separate from composition, assembly and division.
- **RuleEngine:** declarative reaction inputs, catalysts, conditions, rates, outputs and energy costs.
- **Scheduler:** ordered core, reaction and field phases.

## 2. Biology and progression module

src/emergence.js provides reusable domain mechanisms over the runtime rather than a second simulation kernel.

- **ContractRegistry:** typed schemas, defaults and validation for progression entities.
- **StateOwner:** the facade for validated entity creation, transactional property patches, energy/material transfers, field exchange, relationships and removal.
- **LifecycleEngine:** validated life-stage transitions and age progression. Lifecycle stage and active/inactive entity state commit in one EntityStore transaction.
- **ModuleContractRegistry:** required-service checks, declared read/write sets and conflicting write-owner detection.
- **AtomicExecutor:** collects prepared action arrays and commits them through EntityStore.transact.
- **DeterministicEventQueue / EventRuleRouter:** immutable sequenced events, phase-aware FIFO delivery, ordered handlers, one transaction per event and retry after failed action batches. Events emitted during dispatch wait for the next dispatch boundary.
- **LineageJournal:** immutable, sequenced formation, replication, lifecycle and intervention history with ancestor/descendant projections.
- **EmergenceProgression:** aggregation, bonding, molecular formation, polymerisation, autocatalytic network assembly, membrane/protocell formation, replication, growth, reproduction, colony assembly, differentiation and morphogenesis.
- **ExperimentHarness:** seeded runs, perturbations, interventions, replicate sweeps, descriptive statistics and effect-size comparisons.

The biological module does not maintain a second entity or energy inventory. It delegates identity, composition, physical flux and transactional mutation to the runtime.

## 3. Progression mechanisms

1. **Aggregation and bonding:** contact queries create typed bond relations. Connected bonded components can be assembled into molecular entities.
2. **Molecular formation:** a molecule becomes the composition parent of its constituents; energy is transferred into the aggregate through EnergyEngine.
3. **Polymerisation:** connected monomer components become polymer entities with an ordered monomer sequence.
4. **Autocatalysis:** network entities represent explicit catalytic cycles; reaction rules can declare catalysts and are evaluated by the existing RuleEngine.
5. **Membranes:** lipid entities are assembled into a closed discrete ring with a declared permeability value.
6. **Protocells:** a genome-bearing protocell contains a membrane and optional internal entities.
7. **Replication and heredity:** a parent sequence is copied with seeded point mutation; lineage events and a descends relation identify parentage. Daughter protocells receive a newly assembled membrane rather than sharing the parent's membrane; replication, membrane construction and energy allocation commit as one transaction.
8. **Growth and reproduction:** biomass increases through an explicit energy cost; reproduction is lifecycle-gated and transfers an explicit energy share.
9. **Colonies and morphogenesis:** cells are assembled by composition, assigned explicit phenotypes and positioned in radial or bilateral arrangements with geometric constraints.

These are operational primitives, not claims of complete biological fidelity. The membrane is not yet a fluid bilayer, permeability does not yet drive selective transport, and morphogenesis is an explicit placement policy rather than an endogenous developmental system.

## 4. State ownership and lifecycle

- Entity identity, composition and relations belong to EntityStore.
- Energy and energy-valued material inventories belong to EnergyEngine.
- Spatial fields belong to FieldGrid; energy-field writes require flux authority.
- Intrinsic biological state belongs to the entity payload and is changed through StateOwner/transaction APIs.
- Life stage is distinct from containment state. A cell can be compositionally bound inside a colony while remaining biologically active.
- Derived indexes and lineage ancestor/descendant maps are projections. They are rebuildable/query accelerators, not independent physical state.
- Transient calculations belong to a step or transaction and are not persisted as authoritative entity state.

The StateOwner facade is the intended write path, but legacy public entity objects are not yet fully encapsulated. Direct writes outside the owning engine are therefore an explicit boundary and can invalidate accounting or rollback assumptions.

## 5. Transactions and execution

EntityStore.transact is the atomic action boundary for entity creation/removal, property changes, lifecycle state, typed material quantities and transfers, relationships, energy operations, engine-managed field writes and supplied event arrays. Failed transactions restore the affected entity/property identities, relationship projections, field cells, energy ledger and event-array length.

AtomicExecutor stages module prepare results before one transaction. ModuleContractRegistry validates required services and conflicting declared write ownership. A module's prepare function must be side-effect-free and return actions; arbitrary side effects are not part of the transaction contract.

GolfCore and RuleEngine each commit at their own rule/reaction boundaries. Scheduler phases are ordered and sequential. The whole tick is not a single transaction, and external I/O or direct writes to public objects cannot be rolled back.

## 6. Conservation

EnergyEngine treats entity and energy-field values as physical reservoirs. Its ledger is accounting, not another reservoir:

E_entities + E_energy_fields + E_output - E_input = E_baseline

Internal transfers preserve the total. Conversion/dissipation moves energy into an energy field or accounts for external output. Audits only cover operations routed through EnergyEngine and require a baseline. Direct mutation outside the flux boundary is not visible to the audit.

Field transport uses the implemented numerical scheme and configured boundaries; tests cover the energy-field transport invariant. Do not generalise this to non-energy quantities or arbitrary future vector/tensor fields without their own conservation contract.

## 7. Experiments and evidence

ExperimentHarness accepts a runtime factory and optional deterministic configuration callback; it records the seed, interventions, time-series samples, committed reaction events and lineage snapshot. Its blind protocol runs coded randomized conditions against preregistered metrics and reveals the sealed condition map only on explicit request. Available interventions include energy pulses, field pulses, mutation-rate changes and entity knockouts. Summary statistics include sample count, mean, sample standard deviation, median, quartiles, minimum, maximum and type diversity. Seeded bootstrap intervals are available for means and between-group differences; comparisons also report relative change and a pooled descriptive effect size.

A reproducible run requires the same seed, initial state, runtime configuration, rule order and numerical/runtime envelope. Blind runs randomize coded condition arms, preregister metric names and keep the condition key sealed until explicit reveal. Seeded bootstrap intervals are available for means and between-group differences. Distributional hypothesis tests, fully preregistered analysis plans and automatic causal inference remain outside the current harness.

## 8. Tests and verification

- npm test runs the inline runtime suite and progression suite.
- The inline runtime suite extracts the engine from accretion.html before the browser bootstrap.
- Progression tests exercise the domain module directly.
- CI does not prove browser rendering, mobile layout, long-run stability or scientific validity.
- Browser smoke testing and sustained-load profiling must be reported separately from Node test results.

## 9. Design boundary

Prefer the existing EntityStore, EnergyEngine, FieldGrid, GraphEngine, TopologyEngine, RuleEngine and Scheduler whenever their semantics fit. New modules should add domain policy and orchestration, not duplicate foundational stores or solvers. Preserve separate abstractions where the semantics differ: interaction forces are not positional constraints; graph analysis is not topology mutation; lifecycle stage is not containment state; lineage history is not a physical reservoir.


## 4. Modular boundaries added after the four-stage implementation

`src/emergence.js` is the stable compatibility entry for focused modules under `src/emergence/`.

- **DependencyEventIndex:** indexes committed EntityStore property/state/material changes by entity type and property. Tick-level notifications are deferred until commit.
- **RuntimeTickTransaction:** checkpoints entity/link/field/ledger/scheduler/constraint/rule/lineage state and rolls back failed experiment ticks.
- **Physiology:** selective membrane transport and energy-bearing substrate conversion through EnergyEngine.
- **GeneRegulatoryEngine:** locus definition, signal-weighted expression and phenotype trait mapping.
- **Organismal/development policies:** resource-limited growth, fission partitioning, field-driven differentiation and gradient-following morphogenesis.
- **ExperimentHarness:** seeded runs, interventions, replicate and factorial campaigns, blind protocols and statistical summaries.

These are bounded simulation models, not complete biochemical or developmental fidelity. See [organoids/FEATURES.md](organoids/FEATURES.md) for the canonical source map, test evidence, limitations and proposed roadmap.
