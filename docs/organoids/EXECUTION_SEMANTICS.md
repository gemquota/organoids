# Execution Semantics

**Snapshot:** 15 November 2026  
**Design authority:** docs/organoids/SPECIFICATION.md  
**Implementation evidence:** accretion.html and src/emergence.js; see SOURCE_MAPPED_AUDIT.md.

## 1. Rule representation and order

GolfCore stores named predicate/effect registrations and orders rules by phase, priority and stable registration order. RuleEngine separately evaluates declarative chemical reaction records. Both use the existing EntityStore transaction boundary for committed changes.

The two evaluators remain separate because general property effects and multi-reactant chemical transformations have different semantics. They share entity identity, state and transaction primitives.

## 2. Read and commit boundaries

- GolfCore stages property patches for a rule and commits them through EntityStore.
- RuleEngine selects reactants/catalysts, checks conditions and energy budgets, then commits one reaction batch.
- AtomicExecutor asks registered modules to prepare action arrays before committing the combined array as one EntityStore transaction.
- A failed action batch rolls back the state covered by EntityStore.transact.
- Later rules/phases observe earlier successful commits according to the scheduler's ordered sequential semantics.

This is per-rule/per-module atomicity, not whole-tick atomicity. A failed later phase does not undo earlier committed phases.

## 3. Conflict policy

AtomicExecutor's ModuleContractRegistry rejects duplicate declared write ownership. AtomicExecutor also rejects duplicate writes to the same entity/property within a staged batch. EntityStore transaction action validation rejects invalid actions and failed preconditions; the transaction is rolled back as a unit.

Legacy GolfCore commit rejects duplicate entity writes in one staged commit. The runtime does not yet implement a universal property-level conflict reducer or a global dependency-aware conflict graph.

## 4. Event and lineage semantics

EntityStore maintains immutable relationship event history and active relationship projections. RuleEngine emits reaction events only after a successful reaction transaction. LineageJournal records immutable, sequenced biological formation, lifecycle, replication, differentiation and morphogenesis events.

DeterministicEventQueue and EventRuleRouter provide sequenced FIFO events, phase-boundary dispatch, stable handler priority, one atomic action batch per event, and retry when a handler batch fails. Events emitted while dispatching are deferred to the next dispatch call. Automatic dependency indexing, event coalescing and subscriptions across every legacy rule/module remain outstanding. LineageJournal remains a separate historical evidence log, not an event bus; lifetime metrics and lineage projections are derived from that journal.

## 5. State ownership and lifecycle

- EntityStore owns identity, property dictionaries, lifecycle state, typed material quantity inventories and typed relations.
- EnergyEngine owns energy and typed quantity changes.
- FieldGrid owns field reservoirs; energy-valued fields are mutated through EnergyEngine flux authority.
- StateOwner is the preferred facade for biology modules.
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
