# Source-mapped implementation audit

**Audit snapshot:** 15 November 2026  
**Comparison targets:** main and PR #5 (feat/unified-emergence-substrate) are assessed independently.  
**Implementation under review:** feat/four-stage-emergence-completion, branched from PR #5 head; PR #5 itself remains open and untouched.

## Executive finding

The repository's earlier feature and status documents were not current. They still described the 976-character particle prototype and draft PR #2, even though main had since acquired a 24,977-character inline runtime, tests, CI, an atlas, and a multi-document specification. PR #5 then added a materially larger runtime and transaction/performance work. Neither main nor PR #5 implemented the biological progression or the experimental programme. The new implementation branch adds those as a reusable module and integrates its aggregation/molecular-formation path into the browser prototype.

A capability is only marked complete where source, tests and a clear contract agree. Browser rendering, long-run biological stability and scientific validity are not inferred from Node tests.

## 1. Snapshot and lineage

| Target | Ref / head | Relationship | State |
|---|---|---|---|
| Main | main / fcc24e222a59bfc872c649bf62a6b5b80a342462 | Baseline | Default branch |
| PR #5 | feat/unified-emergence-substrate / d0b2059784bce916daf183b73acd3d381ca91ed1 | 5 commits ahead, 0 behind main | Open, unmerged |
| Completion work | feat/four-stage-emergence-completion | Created from PR #5 head | Separate implementation branch |

PR #5 changes five paths: .github/workflows/test.yml, accretion.html, docs/EMERGENCE.md, removal of tests/core.test.js, and tests/emergence.test.js. It does not update the docs/organoids feature catalogue, status, source audit, architecture or roadmap documents.

## 2. Main and PR #5 are not interchangeable

| Evidence | Main | PR #5 |
|---|---:|---:|
| accretion.html characters | 24,977 | 35,243 |
| docs/EMERGENCE.md characters | 2,438 | 3,667 |
| tests/emergence.test.js characters | 15,685 | 25,582 |
| tests/core.test.js | Present (2,337 bytes; obsolete CommonJS suite) | Removed |
| CI | npm test plus obsolete node --check emergence.js step | npm test; inline module is tested from accretion.html |
| Biological progression | Not implemented end-to-end | Explicitly listed as future work |
| Experiments / lineage programme | Not implemented | Not implemented |

The size figures are text-character counts from fetched source, not estimates. The inline engine is largely minified onto long lines, so GitHub's line-oriented diff statistics understate the size and semantic breadth of the source change. Do not compare line counts as a proxy for code volume.

### Main-specific audit

main contains:
- accretion.html: inline EntityStore, GolfCore, SpatialIndex, FieldGrid, interaction/constraint solvers, EnergyEngine, graph/topology services, RuleEngine, Scheduler, createRuntime, and a particle/aggregation canvas demo.
- tests/emergence.test.js: tests that extract the inline engine.
- tests/core.test.js: stale CommonJS tests targeting a deleted kernel.
- docs/organoids/FEATURES.md, STATUS.md, and SOURCE_AUDIT.md: stale descriptions that still claim the repository has only one 976-character file and no tests, package manifest or CI.
- CONSOLIDATION-ASSESSMENT.md and docs/EMERGENCE.md: partial architecture notes, not a current feature-completion audit.

### PR #5-specific audit

PR #5 improves the runtime's energy-flux authority, immutable relationship event history and indexed projections, transaction journalling, field scratch reuse/totals, spatial query allocation, reaction candidate indexing, constraint cleanup and regression tests. It removes the stale CommonJS suite and obsolete syntax-check step. Its own updated docs/EMERGENCE.md correctly says the later biological stages remain future work. The PR does not add a reusable chemistry-to-life progression, heredity, reproduction, morphogenesis or seeded experiments.

The PR's consolidation notes and source must still be read together: the runtime's individual transaction boundaries are not equivalent to one atomic whole-frame transaction, and arbitrary external side effects remain outside rollback.

## 3. Current implementation source map

| Capability | Authoritative source | Tests / evidence | Status |
|---|---|---|---|
| Entity identity, typed relations, composition, indexes, snapshots | accretion.html — EntityStore | tests/emergence.test.js | Implemented |
| Generic predicates/effects and deterministic rule order | accretion.html — GolfCore | Existing emergence tests | Implemented; event dependency subscriptions remain limited |
| Fields, energy flux, inventory audit | accretion.html — FieldGrid, EnergyEngine | Existing emergence tests | Implemented with documented numerical boundaries |
| Spatial interaction and geometric constraints | accretion.html — SpatialIndex, InteractionEngine, ConstraintEngine | Existing emergence tests | Implemented |
| Lifecycle and state-owner facade | src/emergence.js — LifecycleEngine, StateOwner; accretion.html — transactional state action | tests/emergence-progression.test.js | Implemented at biology boundary; base entity payloads remain publicly mutable |
| Module contracts and staged action execution | src/emergence.js — ModuleContractRegistry, AtomicExecutor | tests/emergence-progression.test.js | Implemented for modules using prepare/action contract; not a global scheduler transaction |
| Reusable contact aggregation and molecule formation | src/emergence.js — aggregateContacts, formMolecules; browser integration in accretion.html | Progression tests and live demo path | Implemented |
| Polymerisation | src/emergence.js — polymerize | Progression tests | Implemented for bonded monomer components |
| Autocatalytic networks | src/emergence.js — buildAutocatalyticNetwork, registerAutocatalysis | Progression tests | Implemented as explicit network assembly/rule registration; no spontaneous network-discovery claim |
| Membranes and protocells | src/emergence.js — assembleMembrane, formProtocell | Progression tests | Implemented as discrete lipid-ring structures; selective transport is not yet modelled |
| Replication and heredity | src/emergence.js — replicate | Progression tests | Implemented as sequence copying with seeded mutation; no gene-expression model |
| Growth, reproduction, colonies | src/emergence.js — grow, reproduce, formColony | Progression tests | Implemented at primitive level; no ecological population model |
| Differentiation and morphogenesis | src/emergence.js — differentiate, morphogenesis | Progression tests | Implemented as explicit role assignment and radial/bilateral placement, not emergent developmental regulation |
| Seeded runs, perturbations, interventions, statistics and blind tests | src/emergence.js — SeededRandom, ExperimentHarness.runBlind, analyzeBlind, revealBlind, bootstrap | Progression tests | Implemented with preregistered metrics, randomized coded arms, sealed condition key and seeded bootstrap intervals |
| Lineage histories | src/emergence.js — LineageJournal | Progression tests | Implemented for recorded formation/replication/lifecycle events |
| Deterministic event dispatch | src/emergence.js — DeterministicEventQueue, EventRuleRouter | Progression tests | Implemented; automatic dependency subscriptions remain outstanding |

## 4. Transaction and execution guarantees

- EntityStore.transact is the authoritative transaction boundary for entity actions, relationship projections, engine-managed field writes, energy-ledger changes and supplied event arrays.
- Lifecycle stage and active/inactive entity state now commit in the same entity transaction.
- AtomicExecutor accepts only prepared action batches, rejects duplicate entity/property writes and commits them through EntityStore.transact.
- ModuleContractRegistry validates required runtime services and enforces exclusive declared write ownership. DeterministicEventQueue/EventRuleRouter provide sequenced phase-aware FIFO dispatch and retry failed batches.
- GolfCore rules and chemical reactions each stage their own changes and commit separately. Scheduler phases execute in deterministic priority/registration order; the whole simulation tick is not one global transaction.
- Arbitrary callbacks, external I/O, direct writes to public entity objects, and unjournalled state in third-party modules are not rollback-safe. The state-owner facade is the intended path, not a language-enforced membrane around every legacy object.
- Event/lineage history is observational. It must not be mistaken for a second physical reservoir. Lineage counts and ancestor/descendant maps are projections of the canonical event journal.

## 5. Remaining limits and honest completion boundary

The four requested stages now have reusable implementations and automated behavioural coverage, but the following are deliberately not claimed as complete:
1. Strict encapsulation of all entity payload writes across the legacy inline runtime.
2. A whole-tick atomic scheduler or rollback of arbitrary module side effects.
3. Automatic event-dependency indexing/subscriptions for every rule; larger blind replicate studies and advanced inference remain.
4. Selective membrane permeability, transport channels and protocell metabolism.
5. Genome encoding beyond a mutable sequence string, transcription/translation or regulatory networks.
6. Resource-coupled growth, complete fission/partitioning of organelles and long-run population ecology.
7. Emergent differentiation and morphogenesis driven by endogenous morphogen fields rather than explicit pattern assignment.
8. Large replicate sweeps beyond the sequential runner and browser stress testing.

These are follow-on research capabilities, not reasons to mislabel the implemented primitives as absent. Equally, the presence of a method name is not evidence for the stronger biological interpretation.

## 6. Verification gate

The branch is considered implementation-ready only after:
- npm test passes on the final head;
- the inline engine extraction still passes;
- the browser prototype loads the external module and runs the reusable aggregation path;
- transaction rollback, energy inventory, lifecycle, membrane and lineage tests pass;
- the feature catalogue and status documents point to the same source locations and use the same status vocabulary.

CI and browser evidence must be recorded against the final commit, not inferred from an earlier intermediate run.


## 7. Measured implementation footprint

Counts below are measured from fetched UTF-8 text. Non-whitespace means all characters after JavaScript whitespace removal; these are source-footprint measurements, not complexity scores.

| Artifact | Main | PR #5 | Completion branch |
|---|---:|---:|---:|
| accretion.html characters | 24,977 | 35,243 | 36,472 |
| accretion.html non-whitespace | 24,516 | 34,563 | 35,756 |
| tests/emergence.test.js characters | 15,685 | 25,582 | 25,960 |
| tests/emergence.test.js non-whitespace | 15,336 | 24,895 | 25,260 |
| src/emergence.js | — | — | 38,607 / 37,560 |
| tests/emergence-progression.test.js | — | — | 20,242 / 19,704 |
| src/emergence.js | — | — | 32,237 / 31,290 |

The progression test and module values are characters / non-whitespace respectively.

The completion branch's accretion.html is 1,229 characters and 1,193 non-whitespace characters larger than PR #5. That increase is the cost of transactional lifecycle/material ownership, atomic topology operations, stable reaction event sequencing, the browser module bootstrap and error reporting. The bespoke pairwise merge callback was removed and replaced by calls to shared contact-aggregation and molecular-formation mechanisms. The bulk of biological progression remains extracted into src/emergence.js.

## 8. Final automated verification snapshot

- GitHub Actions run 372: successful.
- npm test: 97 tests passed, 0 failed.
- scripts/check-inline.mjs: full inline browser module syntax check passed.
- The progression suite tests aggregation, bonding, molecular assembly, polymerisation energy, autocatalytic network assembly, membranes, protocells, seeded replication, growth, reproduction, colonies, differentiation, morphogenesis, event dispatch, interventions, bootstrap statistics and lineage projections.
- This is Node/CI evidence. Browser rendering and sustained-load behaviour remain unverified.


## 9. GolfCore measurement

The GolfCore evaluator in accretion.html is 552 ASCII bytes (552 characters; 538 non-whitespace). EntityStore owns validated commitChanges, leaving GolfCore as the small generic rule registration/evaluation layer. This is slightly below the approximate 600–700-byte design band; no padding was added merely to hit a number.

## 10. Post-completion review

The dedicated POST_COMPLETION_REVIEW.md records the redundancy audit and changes made: metrics now derive from lineage history, the unused direct bond helper and bespoke demo merge loop were removed, operation boundaries are transactional, and existing EntityStore/EnergyEngine/TopologyEngine/ConstraintEngine/RuleEngine services are reused rather than duplicated.

## 8. Modularization source mapping

The completion branch now uses `src/emergence.js` as a compatibility barrel and `src/emergence/index.js` as the export aggregator. The implementation is split into focused modules: `shared.js`, `random.js`, `contracts.js`, `lineage.js`, `lifecycle.js`, `events.js`, `ownership.js`, `execution.js`, `progression.js`, `aggregation.js`, `molecular.js`, `membranes.js`, `heredity.js`, `organismal.js`, `development.js`, `experiments.js`, `statistics.js`, and `factory.js` under `src/emergence/`.

This is an extraction of the same implementation, not a second parallel implementation. The original combined biology source was removed after the policy split. The module boundaries, responsibilities and cross-module contracts are documented in [MODULARITY.md](MODULARITY.md). CI acceptance for the final refactor commit is tracked separately from the earlier pre-refactor green commit; see STATUS.md for the current run result.
