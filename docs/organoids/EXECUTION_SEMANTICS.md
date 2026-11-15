# Execution Semantics

**Snapshot:** 15 November 2026  
**Design authority:** docs/organoids/SPECIFICATION.md  
**Implementation evidence:** `accretion.html` and focused modules under `src/emergence/`; see [FEATURES.md](FEATURES.md).

## 1. Rule representation and order

GolfCore stores named predicate/effect registrations and orders rules by phase, priority and stable registration order. RuleEngine separately evaluates declarative chemical reaction records. Both use the existing EntityStore transaction boundary for committed changes.

The two evaluators remain separate because general property effects and multi-reactant chemical transformations have different semantics. They share entity identity, state and transaction primitives.

## 2. Read and commit boundaries

- GolfCore stages property patches for a rule and commits them through EntityStore.
- RuleEngine selects reactants/catalysts, checks conditions and energy budgets, then commits one reaction batch.
- AtomicExecutor asks registered modules to prepare action arrays before committing the combined array as one EntityStore transaction.
- A failed action batch rolls back the state covered by EntityStore.transact.
- Later rules/phases observe earlier successful commits according to the scheduler's ordered sequential semantics.

EntityStore actions remain per-operation atomic. `RuntimeTickTransaction` adds a wider checkpoint around experimental ticks: it snapshots entity payloads and identity, relation history/projections, fields, energy ledger, scheduler counters, constraints, rule events and registered participants. A failure restores the checkpoint in place, preserving references to pre-existing entities. The interactive browser loop is not yet wrapped by this coordinator, and arbitrary external side effects remain outside rollback.

## 3. Conflict policy

AtomicExecutor's ModuleContractRegistry rejects duplicate declared write ownership. AtomicExecutor also rejects duplicate writes to the same entity/property within a staged batch. EntityStore transaction action validation rejects invalid actions and failed preconditions; the transaction is rolled back as a unit.

Legacy GolfCore commit rejects duplicate entity writes in one staged commit. The runtime does not implement a universal property-level conflict reducer. `DependencyEventIndex` indexes transactional EntityStore changes by entity type/property; runtime physics position/velocity updates are indexed by the step boundary; arbitrary direct external mutation remains unindexed. Declared read sets remain metadata rather than enforced access control.

## 4. Event and lineage semantics

EntityStore maintains immutable relationship event history and active relationship projections. RuleEngine emits reaction events only after a successful reaction transaction. LineageJournal records immutable, sequenced biological formation, lifecycle, replication, differentiation and morphogenesis events.

DeterministicEventQueue and EventRuleRouter provide sequenced FIFO events, phase-boundary dispatch, stable handler priority, one atomic action batch per event, and retry when a handler batch fails. Events emitted while dispatching are deferred to the next dispatch call. Automatic dependency indexing covers committed EntityStore property/state/material actions. It is not yet wired to arbitrary direct writes outside EntityStore transactions and the runtime physics step. LineageJournal remains a separate historical evidence log, not an event bus; lifetime metrics and lineage projections are derived from that journal.

## 5. State ownership and lifecycle

- EntityStore owns identity, property dictionaries, lifecycle state, typed material quantity inventories and typed relations.
- EnergyEngine owns energy and typed quantity changes.
- FieldGrid owns field reservoirs; energy-valued fields are mutated through EnergyEngine flux authority.
- StateOwner is the preferred facade for biology modules. EntityStore also guards declared biological payload keys with transaction-only setters and deep-frozen nested values; EnergyEngine is the exclusive writer for runtime entity energy. Unprotected generic payload keys remain extensible.
- LifecycleEngine validates transitions between nascent, growing, mature, reproducing, dormant, senescent and dead. The life stage is separate from containment state.
- A contained biological cell remains biologically active; molecular constituents may be bound and inactive as independent agents.

The facade does not yet prevent all direct writes to public legacy entity objects. Such writes are outside the transactional and accounting guarantees.

## 6. Randomness and reproducibility

SeededRandom supplies a serialisable deterministic stream. ExperimentHarness records the seed, runtime configuration, interventions, samples, committed reaction events and lineage snapshot; RuleEngine reaction events have monotonic sequence numbers and are folded into the lineage journal. A repeated run requires the same factory, initial state, seed, rule order and numerical/runtime envelope; the configure callback is run before interventions and stepping.

The existing RuleEngine accepts an injected random function; the harness supplies a seeded function when constructing the runtime. The live interactive demo uses its own seeded biological module for initial positions and aggregation setup.

## 7. Tests

Automated tests cover:
- stable GolfCore ordering and transactional commits;
- reaction atomicity and energy accounting;
- lifecycle transition validation and rollback;
- module contract validation and atomic action preparation;
- aggregation, molecular formation and polymerisation;
- autocatalytic network construction;
- membrane/protocell assembly;
- replication, mutation, growth, reproduction and lineage;
- colony composition, differentiation and morphogenesis;
- experiment interventions and descriptive statistics.

Not yet covered: automatic event dependency indexing across every legacy module, global conflict reduction, whole-tick rollback, distributional hypothesis tests, large blind replicate campaigns, browser stress tests and cross-platform floating-point equivalence. The current blind harness, seeded bootstrap intervals and generic event router are implemented and tested.


## 8. New physiology and developmental semantics

EnergyEngine converts energy-unit substrate quantities into entity energy through `convertQuantity`; efficiency loss is accounted as heat when a spatial heat field is available, otherwise as external output. Membrane transport applies permeability, selectivity, optional channel conductance and passive concentration gradients. Resource-limited growth consumes declared precursor quantities, while fission partitions biomass, energy and typed materials in the replication transaction. Locus-based gene expression and field-gradient developmental policies are implemented but bounded; full kinetic regulation and reaction-diffusion morphogenesis remain future work. See FEATURES.md for the test evidence and exact boundaries.
