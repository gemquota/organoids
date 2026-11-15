# Organoids Feature Catalogue

**Snapshot:** 15 November 2026  
**Implementation branch:** feat/four-stage-emergence-completion  
**Evidence authority:** source-mapped audit in SOURCE_MAPPED_AUDIT.md

This catalogue separates implementation from design scope. A method name or documented intention is not sufficient evidence of completion.

## Status vocabulary

- **Implemented / tested:** authoritative source exists and automated behavioural tests cover the contract.
- **Implemented / bounded:** working implementation exists, but its scope is deliberately narrower than the full research capability.
- **Partial:** some primitives exist, but a required ownership, integration or execution guarantee remains incomplete.
- **Design only:** specified but not implemented.
- **Unverified:** runtime-dependent behaviour has not been smoke-tested in a browser or under sustained load.

## Stage 1 — Substrate and execution guarantees

| Capability | Source map | Status | Boundary |
|---|---|---|---|
| Generic entity identity and payloads | accretion.html: EntityStore | Implemented / tested | Public entity objects remain mutable |
| Typed relationships and composition | accretion.html: EntityStore link, compose, indexes, immutable edge log | Implemented / tested | Relation policies remain explicit per type |
| State ownership facade | src/emergence.js: StateOwner | Partial | Legacy engines can still mutate public payloads directly |
| Lifecycle semantics | src/emergence.js: LifecycleEngine; accretion.html: transactional state action | Implemented / tested | Biology stages are separate from containment state |
| Material schemas and validation | src/emergence.js: ContractRegistry | Implemented / tested | Schemas cover current progression entities, not every runtime type |
| Module contracts | src/emergence.js: ModuleContractRegistry | Implemented / tested | Contracts are enforced for registered modules, not every legacy callback |
| Transactional action batches | accretion.html: EntityStore.transact; src/emergence.js: AtomicExecutor | Implemented / tested | Whole scheduler tick and arbitrary external side effects are not atomic |
| Deterministic phase ordering | accretion.html: GolfCore and Scheduler | Implemented / tested | Deterministic event queue/router exists; dependency indexing is not comprehensive |
| Energy and field accounting | accretion.html: EnergyEngine and FieldGrid | Implemented / tested | Audits cover flux-authority operations; direct external mutation is invisible |

## Stage 2 — Emergence progression

| Capability | Source map | Status | Boundary |
|---|---|---|---|
| Reusable contact aggregation | src/emergence.js: aggregateContacts | Implemented / tested | Contact geometry is a configurable radius rule |
| Bonding | accretion.html: EntityStore transactions; src/emergence.js: aggregateContacts, _membranePlan | Implemented / tested | Bond energetics are represented as relation metadata |
| Molecular formation | src/emergence.js: formMolecules | Implemented / tested | Forms connected bonded components |
| Polymerisation | src/emergence.js: polymerize | Implemented / tested | Requires pre-bonded monomers |
| Autocatalytic networks | src/emergence.js: buildAutocatalyticNetwork, registerAutocatalysis | Implemented / bounded | Explicit assembly and rule registration, not spontaneous discovery |
| Membrane assembly | src/emergence.js: assembleMembrane | Implemented / bounded | Discrete lipid ring; no bilayer fluid mechanics |
| Protocell formation | src/emergence.js: formProtocell | Implemented / bounded | Container, genome, membrane and contents; no selective transport/metabolism |

## Stage 3 — Biological behaviour

| Capability | Source map | Status | Boundary |
|---|---|---|---|
| Replication | src/emergence.js: replicate | Implemented / tested | Sequence-copying model |
| Heredity and mutation | src/emergence.js: SeededRandom, replicate, LineageJournal | Implemented / tested | No gene expression or regulatory genome |
| Growth | src/emergence.js: grow | Implemented / tested | Biomass increment with explicit energy cost |
| Reproduction | src/emergence.js: reproduce | Implemented / tested | Parent/daughter energy split and membrane reassembly; not complete organelle partitioning |
| Colonies | src/emergence.js: formColony | Implemented / tested | Composition-based multicellular group |
| Differentiation | src/emergence.js: differentiate | Implemented / bounded | Explicit role assignment, not gene-regulated fate choice |
| Morphogenesis | src/emergence.js: morphogenesis | Implemented / bounded | Radial/bilateral placement and constraints; not a self-organising morphogen model |

## Stage 4 — Emergence evidence

| Capability | Source map | Status | Boundary |
|---|---|---|---|
| Seeded random streams | src/emergence.js: SeededRandom | Implemented / tested | Deterministic within the same runtime/numerical envelope |
| Reproducible experiments | src/emergence.js: ExperimentHarness.run | Implemented / tested | Factory must supply deterministic initial state |
| Perturbations/interventions | ExperimentHarness.intervene | Implemented / tested | Energy pulse, knockout, mutation-rate and field pulse |
| Lineage histories | LineageJournal | Implemented / tested | Records implemented lifecycle and formation events |
| Statistical measurements | ExperimentHarness.summarize, compare | Implemented / tested | Descriptive statistics, seeded bootstrap intervals and pooled effect size |
| Replicate sweeps | ExperimentHarness.replicate | Implemented / bounded | Sequential runner; no parallel statistical pipeline |
| Blind emergence tests | src/emergence.js: ExperimentHarness.runBlind, analyzeBlind, revealBlind | Implemented / tested | Preregistered metrics, randomized coded arms and sealed condition key |
| Browser stress and long-run stability | Browser/runtime | Unverified | CI does not exercise sustained visual execution |

## Cross-cutting exclusions

- This is a fictional/software artificial-life simulation, not real-world organoid development.
- No Boids implementation, source or dependencies are imported.
- Mocean and NEXUS Aquarium remain separate projects.
- The feature catalogue does not claim that discrete membranes, sequence mutation or explicit morphogenesis reproduce their full biological counterparts.

## Completion rule

Mark a capability complete only when its authoritative source, documented contract, relevant passing tests and integration evidence agree. Mark browser-dependent behaviour unverified until it has actually been exercised in a browser. See SOURCE_MAPPED_AUDIT.md for the independent main versus PR #5 comparison.

## Modular source map

| Concern | Source | Contract |
|---|---|---|
| Stable API and composition | `src/emergence.js`, `src/emergence/index.js`, `src/emergence/progression.js` | Compatibility exports and one composition root |
| Aggregation and connectivity | `src/emergence/aggregation.js` | Reusable contact and bond components |
| Molecular emergence | `src/emergence/molecular.js` | Molecule, polymer and catalytic network policy |
| Membrane/protocell construction | `src/emergence/membranes.js` | Transactional boundary construction |
| Heredity | `src/emergence/heredity.js` | Seeded genome replication and mutation |
| Growth/reproduction | `src/emergence/organismal.js` | Lifecycle-gated biomass and reproduction |
| Development | `src/emergence/development.js` | Colony, differentiation and morphogenesis policy |
| Lifecycle/lineage | `src/emergence/lifecycle.js`, `src/emergence/lineage.js` | Legal transitions and historical truth |
| Ownership/execution | `src/emergence/ownership.js`, `src/emergence/execution.js` | State authorities and atomic module batches |
| Events/contracts | `src/emergence/events.js`, `src/emergence/contracts.js` | Deterministic event delivery and module interfaces |
| Experiments | `src/emergence/experiments.js` | Seeded protocols and intervention orchestration |\n| Statistical analysis | `src/emergence/statistics.js` | Descriptive summaries, bootstrap intervals and comparisons |

The module boundaries and future extension rules are specified in [MODULARITY.md](MODULARITY.md).
