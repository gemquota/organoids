# Organoids: canonical feature catalogue, verification and roadmap

**Canonical project record:** this document supersedes separate feature-status tables, progress snapshots, source-mapped status summaries and duplicated roadmaps.  
**Current implementation:** `main` (PR #7 merged; commit `a9c96c2233eec88e5c85798447b1062b387b7ad5`)  
**Base:** `main`, after PR #5, PR #6 and PR #7 were merged.  
**Snapshot:** 16 November 2026

This is the single authoritative catalogue for implemented capabilities, their source ownership, test evidence, limitations, audit history and proposed next features. Architecture and execution-semantics documents remain technical specifications; they must not maintain competing completion counts.

## 1. Status rules

- **Implemented / tested:** the capability is present in authoritative source and a named automated behavioural test exercises its contract. This is the only status counted as complete.
- **Implemented / bounded:** a working implementation and test exist, but the current model is intentionally narrower than the full capability.
- **Partial:** only some required behaviour exists, or an important contract is not yet fulfilled.
- **Design only:** documented but not implemented.
- **Unverified:** source may exist, but required runtime/browser/load evidence has not been obtained.

A method name, UI label, documentation statement or passing syntax check is not evidence of behavioural completion. A bounded implementation is not counted as complete.

## 2. Stage 1: substrate, ownership and execution

| # | Capability | Authoritative source | Behavioural evidence | Status | Boundary |
|---:|---|---|---|---|---|
| 1 | Generic entity identity and extensible payloads | `accretion.html: EntityStore` | `tests/emergence.test.js` entity creation and snapshot tests | Implemented / tested | Generic non-protected payload keys remain extensible |
| 2 | Typed relationships, containment and graph projections | `accretion.html: EntityStore`, `GraphEngine`, `TopologyEngine` | `tests/emergence.test.js` relation, cycle and topology tests | Implemented / tested | Relation-specific policies are declared per relation type |
| 3 | Declared biological state ownership | `accretion.html: EntityStore.protectType/_guardEntity`; `src/emergence/ownership.js` | `tests/emergence-boundaries.test.js` protected payload test | Implemented / bounded | Genome, age, biomass, life stage and phenotype fields are transaction-only and deeply immutable; arbitrary legacy payload fields and direct quantity-inventory mutations are not globally sealed |
| 4 | Lifecycle transitions and ageing | `src/emergence/lifecycle.js` | `tests/emergence-progression.test.js` lifecycle transition and rollback tests | Implemented / tested | Biological life stage is separate from containment/active state |
| 5 | Typed material schemas and validation | `src/emergence/contracts.js`, `src/emergence/progression.js` | `tests/emergence-progression.test.js` contract validation tests | Implemented / tested | Schemas cover progression entities, not every possible runtime entity type |
| 6 | Module service and write contracts | `src/emergence/contracts.js`, `src/emergence/execution.js` | `tests/emergence-progression.test.js` module contract and atomic executor tests | Implemented / bounded | Required services and exclusive declared writers are checked; declared read sets are metadata and are not enforced at every access |
| 7 | Transactional entity, relation, material and energy action batches | `accretion.html: EntityStore.transact` | `tests/emergence.test.js`, `tests/emergence-progression.test.js` rollback tests | Implemented / tested | Arbitrary external side effects are outside a store transaction |
| 8 | Deterministic phase, rule and event ordering | `accretion.html: GolfCore/Scheduler`; `src/emergence/events.js` | `tests/emergence.test.js`, `tests/emergence-progression.test.js` ordering tests | Implemented / tested | Scheduler phases are sequential; no universal conflict reducer |
| 9 | Energy/field accounting and energy-bearing material conversion | `accretion.html: EnergyEngine/FieldGrid` | `tests/emergence.test.js`, `tests/emergence-boundaries.test.js` conversion conservation test | Implemented / bounded | Runtime entity energy reservoirs are guarded and flux-routed; direct mutation of exposed typed quantity maps and non-energy field values remains outside the energy audit |
| 10 | Indexed entity-property dependency notifications | `accretion.html: EntityStore change batches`; `src/emergence/events.js: DependencyEventIndex` | `tests/emergence-boundaries.test.js` dependency index and tick rollback tests | Implemented / bounded | All transactional property/state/material changes publish indexed notifications; direct unguarded legacy writes and non-transactional physics updates do not enter the index |
| 11 | Whole-tick runtime rollback | `src/emergence/transactions.js: RuntimeTickTransaction`; `src/emergence/experiments.js` | `tests/emergence-boundaries.test.js` whole-tick rollback test | Implemented / bounded | Experiment ticks are checkpointed across entities, links, fields, energy ledger, scheduler, constraints, rule events, lineage, RNG and deferred notifications; the interactive browser loop is not yet wrapped by this coordinator |

## 3. Stage 2: emergence progression and protocell physiology

| # | Capability | Authoritative source | Behavioural evidence | Status | Boundary |
|---:|---|---|---|---|---|
| 12 | Reusable contact aggregation | `src/emergence/aggregation.js` | `tests/emergence-progression.test.js` contact aggregation test | Implemented / tested | Contact uses a configurable spatial radius |
| 13 | Bonding and reusable connectivity | `src/emergence/aggregation.js`; `accretion.html: EntityStore` | `tests/emergence-progression.test.js` aggregation and membrane tests | Implemented / tested | Bond energetics are relation metadata plus explicit energy operations |
| 14 | Molecular formation from bonded components | `src/emergence/molecular.js` | `tests/emergence-progression.test.js` molecular formation test | Implemented / tested | Connected-component assembly, not quantum chemistry |
| 15 | Polymerisation with resource/energy costs | `src/emergence/molecular.js` | `tests/emergence-progression.test.js` polymer energy and inventory tests | Implemented / tested | Requires pre-bonded monomers |
| 16 | Autocatalytic network assembly and rule registration | `src/emergence/molecular.js`; `accretion.html: RuleEngine` | `tests/emergence-progression.test.js` autocatalytic network test | Implemented / bounded | Explicitly assembled catalytic cycles; no autonomous network discovery or stability analysis |
| 17 | Membrane boundary assembly | `src/emergence/membranes.js` | `tests/emergence-progression.test.js` membrane construction and daughter membrane tests | Implemented / bounded | Discrete lipid ring, not a fluid bilayer with mechanics |
| 18 | Protocell construction and containment | `src/emergence/membranes.js` | `tests/emergence-progression.test.js` protocell rollback/containment tests | Implemented / bounded | Container, genome, membrane, contents and transport/flux policies exist; no full homeostatic physiology |
| 19 | Selective, permeability-limited membrane transport | `src/emergence/physiology.js` | `tests/emergence-boundaries.test.js` selective membrane transport test | Implemented / tested | Passive gradient transport and channel/selectivity gates; no electrogenic pumps or membrane potentials |
| 20 | Energy-bearing substrate conversion and metabolic flux | `accretion.html: EnergyEngine.convertQuantity`; `src/emergence/physiology.js` | `tests/emergence-boundaries.test.js` substrate-to-energy conservation test | Implemented / tested | Explicit substrate-to-energy conversion with heat/output accounting; no integrated metabolic pathway network |

## 4. Stage 3: biological behaviour and development

| # | Capability | Authoritative source | Behavioural evidence | Status | Boundary |
|---:|---|---|---|---|---|
| 21 | Seeded genome replication | `src/emergence/heredity.js` | `tests/emergence-progression.test.js` replication test | Implemented / tested | Sequence-copying model |
| 22 | Heredity, mutation and ancestry | `src/emergence/heredity.js`, `src/emergence/lineage.js` | `tests/emergence-progression.test.js` seeded mutation and lineage tests | Implemented / tested | No recombination or horizontal gene transfer |
| 23 | Locus-based gene expression and regulatory signals | `src/emergence/genetics.js` | `tests/emergence-boundaries.test.js` gene regulation test | Implemented / bounded | Loci, signal-weighted expression and trait mapping work; no dynamic transcription/translation or regulatory network kinetics |
| 24 | Lifecycle-gated biomass growth | `src/emergence/organismal.js` | `tests/emergence-progression.test.js` growth/reproduction test | Implemented / tested | Basic biomass increments with explicit energy cost |
| 25 | Resource-limited growth | `src/emergence/organismal.js` | `tests/emergence-boundaries.test.js` resource-limited growth test | Implemented / tested | Explicit precursor inventory is consumed; no spatial nutrient uptake field coupling yet |
| 26 | Reproduction with hereditary and membrane inheritance | `src/emergence/organismal.js`, `src/emergence/heredity.js` | `tests/emergence-progression.test.js` reproduction and daughter membrane tests | Implemented / tested | Daughter membrane is reassembled; complete organelle inheritance is not modelled |
| 27 | Fission with biomass, energy and material partition | `src/emergence/organismal.js`, `src/emergence/heredity.js` | `tests/emergence-boundaries.test.js` fission partition test | Implemented / tested | Partition fraction is explicit; geometry and organelle partition remain simplified |
| 28 | Colony composition | `src/emergence/development.js`; `accretion.html: TopologyEngine` | `tests/emergence-progression.test.js` colony test | Implemented / tested | Composition-based colony, not a full multicellular tissue model |
| 29 | Cell differentiation | `src/emergence/development.js` | `tests/emergence-progression.test.js`, `tests/emergence-boundaries.test.js` differentiation tests | Implemented / bounded | Explicit role assignment and field-threshold response; not a fully endogenous fate network |
| 30 | Radial and bilateral morphogenesis | `src/emergence/development.js` | `tests/emergence-progression.test.js` morphogenesis test | Implemented / bounded | Deterministic geometric placement and constraints |
| 31 | Field-driven differentiation and morphogenetic movement | `src/emergence/development.js`; `accretion.html: FieldGrid` | `tests/emergence-boundaries.test.js` field-driven development test | Implemented / bounded | Gradient following and thresholded fate; no reaction-diffusion self-organisation or Turing-pattern formation |

## 5. Stage 4: reproducible emergence evidence

| # | Capability | Authoritative source | Behavioural evidence | Status | Boundary |
|---:|---|---|---|---|---|
| 32 | Seeded random streams | `src/emergence/random.js` | `tests/emergence-progression.test.js` seeded stream and restore tests | Implemented / tested | Determinism within the same runtime/numerical envelope |
| 33 | Reproducible experiment runs | `src/emergence/experiments.js` | `tests/emergence-progression.test.js` repeated seeded run tests | Implemented / tested | Experiment factory must create deterministic initial conditions |
| 34 | Energy, field, knockout and mutation interventions | `src/emergence/experiments.js` | `tests/emergence-progression.test.js` intervention tests | Implemented / tested | Only declared intervention types are supported |
| 35 | Formation, reaction and biological lineage histories | `src/emergence/lineage.js`, `src/emergence/experiments.js` | `tests/emergence-progression.test.js` lineage/reaction tests | Implemented / tested | Records implemented events; it does not infer unobserved causality |
| 36 | Descriptive statistics and bootstrap comparisons | `src/emergence/statistics.js` | `tests/emergence-progression.test.js` seeded bootstrap tests | Implemented / tested | Descriptive/bootstrap intervals, not a complete inferential statistics suite |
| 37 | Replicate sweeps | `src/emergence/experiments.js` | `tests/emergence-progression.test.js` replicate seed tests | Implemented / bounded | Sequential execution; no parallel/distributed execution or campaign scheduler |
| 38 | Factorial parameter campaigns | `src/emergence/experiments.js` | `tests/emergence-boundaries.test.js` factorial campaign test | Implemented / tested | Cartesian factor combinations; no adaptive design or automatic multiplicity correction |
| 39 | Blinded experiments with preregistered metrics | `src/emergence/experiments.js` | `tests/emergence-progression.test.js` blind experiment tests | Implemented / tested | Condition key is private to the harness instance; external secure escrow is not claimed |
| 40 | Browser rendering, mobile interaction and sustained-load stability | `accretion.html`, browser runtime | No browser automation or sustained-load result recorded | Unverified | Node CI does not establish browser rendering or long-run stability |

## 6. Completion audit and source map

### Audit rule

All 26 rows marked **Implemented / tested** above were checked against their authoritative source and a named automated behavioural test. The 14 remaining rows are not silently promoted to complete: 13 are explicitly bounded and one remains unverified. The new boundary tests cover transaction-only protected payload writes, nested genome immutability, indexed notifications, tick rollback with deferred notifications, membrane selectivity/transport, conserved substrate conversion, gene expression, resource-limited growth, fission, field-driven development and factorial campaigns.

**Current CI evidence:** GitHub Actions run [43723093293](https://github.com/gemquota/organoids/actions/runs/43723093293) on final PR #7 head `2d3f39bf2aa3815017cc341b4368e320f0849e58` passed 108/108 tests (0 failures); the inline browser module syntax check also passed. This run includes runtime physics dependency notifications, lazy listener binding, energy-bearing quantity sources/sinks and fission conservation. Browser rendering and sustained-load validation remain unverified.

### Current module map

```text
accretion.html                  authoritative physical/runtime substrate
src/emergence.js                stable public compatibility entry
src/emergence/
  index.js                      public exports
  factory.js                    construction entry
  shared.js                     pure helpers
  random.js                     deterministic random stream
  contracts.js                  schemas and module contracts
  ownership.js                  StateOwner facade
  execution.js                  atomic module batch executor
  transactions.js               whole-tick checkpoint/rollback coordinator
  events.js                     deterministic event queue, router and dependency index
  lifecycle.js                  lifecycle transitions and ageing
  lineage.js                    historical lineage journal
  progression.js                composition root and public facade
  aggregation.js                contact aggregation and bonds
  molecular.js                  molecules, polymers and catalytic networks
  membranes.js                  membrane and protocell construction
  physiology.js                 selective transport and metabolic flux
  heredity.js                   replication, mutation and partition
  genetics.js                   locus expression and regulation
  organismal.js                  growth, reproduction and fission
  development.js                colonies, differentiation and morphogenesis
  experiments.js                seeded protocols, interventions and campaigns
  statistics.js                 descriptive and bootstrap analysis
tests/
  emergence.test.js
  emergence-progression.test.js
  emergence-boundaries.test.js
```

### Main and PR #5, audited separately

- **Main before PR #5 reconciliation:** historical baseline `fcc24e222a59bfc872c649bf62a6b5b80a342462`; `accretion.html` was 24,977 characters / 24,516 non-whitespace. It contained the earlier runtime and stale project documentation.
- **PR #5 head:** historical head `d0b2059784bce916daf183b73acd3d381ca91ed1`; `accretion.html` was 35,243 characters / 34,563 non-whitespace. It introduced the transaction/performance/energy-flux improvements and updated the inline runtime tests, but did not implement the four-stage biology or experiment harness.
- **PR #5 merge:** merge commit `39f9e00cfcfdaab8d00e911df42735f46fa7336c`. PR #5 is merged, not open.
- **PR #6 merge:** merge commit `89a41f4c1c5fe0a29132cc72edd9c99a62c849a4`. It adds the four-stage progression and modular source structure to main.
- **Main immediately after PR #6 (before PR #7):** `accretion.html` was 36,472 characters / 35,756 non-whitespace. The historical PR #5 head remains independently identifiable as a separate source snapshot; it is an ancestor in the merged history, not a second active base branch.
- **Current main after PR #7:** `accretion.html` is 43,034 characters / 42,196 non-whitespace. PR #7 was squash-merged as `a9c96c2233eec88e5c85798447b1062b387b7ad5`; the ownership, transaction, physiology, genetics, organismal and development boundary work is now on `main`.

### Historical feature/status documentation

Earlier `STATUS.md`, `ROADMAP.md` and `SOURCE_MAPPED_AUDIT.md` contained mutually inconsistent snapshots and stale references to the former monolithic `src/emergence.js`. This document replaces those duplicated status tables and backlog lists. Technical design detail remains in SPECIFICATION.md, EXECUTION_SEMANTICS.md, ARCHITECTURE.md and MODULARITY.md.

## 7. Consolidation and simplification findings

The following changes have been implemented rather than merely recommended:

1. Shared physical state remains in EntityStore, EnergyEngine, FieldGrid, TopologyEngine, ConstraintEngine, RuleEngine and Scheduler. No parallel biology store was introduced.
2. Transactional EntityStore change notifications feed one indexed dependency service. Change notifications are deferred during whole-tick checkpoints and discarded on rollback.
3. Declared biological payload fields are protected by transaction-only setters and deep-frozen nested values. This closes the common direct-write bypass for genome, age, biomass, life stage and phenotype while leaving unrelated extensible payloads alone.
4. Energy-bearing material conversion now runs through EnergyEngine flux accounting, including efficiency loss and heat/output.
5. Membrane transport, metabolism, genetics, fission, field-driven development, whole-tick rollback and factorial campaigns are separate focused modules/policies, not new runtimes.
6. Statistical analysis remains separate from experiment orchestration.
7. The compatibility entry remains stable; the source map is explicit and module responsibilities are documented.
8. The architecture deliberately does not claim byte compression. The extra module boundaries are a modest source-size cost for semantic cohesion and independent verification.

### Known remaining engineering boundaries

- Guarding every arbitrary entity property and all direct energy writes would require migrating the remaining legacy runtime writers to explicit owners. The protected biological fields are enforced; universal state encapsulation is not claimed.
- Dependency notifications cover EntityStore transactional changes. Direct physics writes to positions/velocities and arbitrary external mutations are not all routed through the index.
- Whole-tick rollback is used by experiment runs. The browser's interactive main loop is not yet wrapped, and arbitrary external side effects remain outside rollback.
- Membranes are discrete ring structures. Transport and metabolism are functional abstractions, not fluid membrane biophysics.
- Gene regulation is locus-based and signal-weighted, not a complete transcription/translation simulator.
- Field-driven development follows gradients; it is not yet a coupled reaction-diffusion developmental system.
- Browser, mobile and sustained-load verification remain unperformed.

## 8. Remaining feature count and proposed expansion

### Current incomplete count

There are **14 incomplete or bounded capabilities** in sections 2–5: **13 Implemented / bounded** and **1 Unverified**. Only 26 of the 40 catalogue entries currently meet the strict complete-and-tested rule.

The requested 50% expansion is therefore **21 new feature proposals** (14 × 1.5 = 21). These are genuinely additional capabilities, not renamed versions of existing rows.

### Proposed features (21)

| # | Proposed feature | Why it adds distinct capability | Suggested dependency / order |
|---:|---|---|---|
| P1 | Universal write-owner migration | Bring every mutable entity field under declared ownership and remove remaining legacy bypasses | First; extends StateOwner and EntityStore |
| P2 | Energy reservoir encapsulation | Make direct entity-energy mutation impossible outside EnergyEngine flux authority | P1; EntityStore/EnergyEngine |
| P3 | Dependency-aware rule scheduling | Subscribe GolfCore and RuleEngine modules to indexed read dependencies and invalidate only affected rules | P1, current dependency index |
| P4 | Transactional interactive browser ticks | Apply the tick checkpoint coordinator to the browser loop with bounded checkpoint policies | Current RuntimeTickTransaction |
| P5 | Fluid bilayer membrane mechanics | Add leaflet structure, curvature, tension, deformation and membrane repair | Current membrane assembly |
| P6 | Active membrane pumps and electrochemical gradients | Model ATP-driven transport, charge separation and membrane potential | P5, current physiology |
| P7 | Protocell homeostasis controller | Stabilise volume, pH-like scalar, ion balance and internal energy within declared limits | P5–P6 |
| P8 | Reaction-network discovery | Search for autocatalytic cycles and quantify closure, persistence and perturbation resistance | Current RuleEngine and network assembly |
| P9 | Metabolic pathway graph compiler | Compile reaction graphs into stoichiometric flux constraints and resource budgets | Current physiology and RuleEngine |
| P10 | Dynamic gene expression kinetics | Add transcription/translation delays, mRNA/protein turnover and regulatory feedback | Current genetics |
| P11 | Epigenetic inheritance | Add heritable expression-state marks with controlled reset and drift | P10 and heredity |
| P12 | Genome recombination and horizontal transfer | Add crossover, plasmid-like transfer and inheritance competition | Current heredity |
| P13 | Organelle biogenesis and partition | Model organelle replication, allocation and daughter-cell inheritance | Current fission |
| P14 | Reaction-diffusion morphogens | Couple field transport, production, decay and cell response to generate endogenous spatial patterns | Current FieldGrid and development |
| P15 | Mechanical tissue morphogenesis | Add adhesion, differential growth, bending and topology-changing tissue mechanics | P13–P14, ConstraintEngine |
| P16 | Spatial nutrient uptake and ecological competition | Couple membrane transport and resource fields to population-level competition | Current physiology and FieldGrid |
| P17 | Population genetics and selection analysis | Track allele frequencies, selection coefficients, diversity and drift across lineages | Current heredity and statistics |
| P18 | Ecological trophic networks | Add resource producers/consumers, predation, cross-feeding and ecosystem stability | Current metabolic pathways |
| P19 | Survival, ageing and hazard models | Add stochastic mortality, senescence distributions and demographic projections | Current lifecycle |
| P20 | Stronger causal experiment analysis | Add randomisation checks, permutation tests, multiple-comparison control and preregistered stopping rules | Current blinded campaigns/statistics |
| P21 | Deterministic save/replay and schema migration | Persist complete simulation checkpoints and replay across versioned schemas | Current tick transaction and seeded runtime |

These proposals are not marked implemented. They are a ranked design backlog, with dependencies to prevent building parallel abstractions.

## 9. Verification and change discipline

- Update this document whenever a feature status changes.
- Every **Implemented / tested** row must name its source and behavioural test.
- Every **Implemented / bounded** row must state the specific limitation.
- Do not mark browser behaviour complete from Node-only CI.
- Do not create a second owner for state already governed by an existing engine.
- Add one focused test for each new contract and an integration test for each cross-module transaction.
- Record exact commit SHA, CI run and test totals after the final implementation commit.


## 10. Related evolutionary ecology requirements

The earlier evolutionary ecology workstream contains a separate **161-item** checklist covering genetics, neuroevolution, population genetics, ecology, experimentation, observatory tooling and release validation. Its original source snapshot recorded **115 checked / 46 unchecked (71.4%)** on 16 November 2026.

That checklist is preserved in [EVOLUTION_BACKLOG.md](EVOLUTION_BACKLOG.md), including its original checkbox state and source attribution. Those completion marks are historical upstream claims, not Organoids implementation evidence. Organoids must independently re-express adopted mechanisms and verify them against this repository's source, tests, persistence and browser behaviour. The 161-item requirements lineage and this 40-capability emergence-engine catalogue describe different scopes and must never be added together or substituted for one another.
