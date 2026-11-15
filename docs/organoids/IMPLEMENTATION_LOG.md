# Organoids Implementation Log

## 14 November 2026: GolfCore foundation prototype

**Repository:** [gemquota/organoids](https://github.com/gemquota/organoids)  
**Branch:** `architecture/golfcore-foundation`  
**Pull request:** [#2 - Introduce GolfCore foundation and transactional rule kernel](https://github.com/gemquota/organoids/pull/2)  
**State:** open draft PR; not merged to `main`.

### Implemented in the branch

- Added a 677-character GolfCore block (669 non-whitespace characters).
- Added generic entity records with a minimal `id` / `type` header and extensible `s` payload.
- Added generic relations.
- Added declarative rule registration using predicate/effect operation registries.
- Added deterministic rule ordering by phase, priority and registration order.
- Rule evaluation reads a per-rule entity-array snapshot and stages effects.
- Added atomic commit/reject for staged effects, including invalid-target and duplicate-entity rejection.
- Migrated the particle records to the generic entity representation.
- Expressed particle drift through the rule evaluator.
- Retained pairwise particle interaction as specialised domain logic.
- Recorded particle absorption as a relation and used atomic commit for mass-weighted merging.
- Added `tests/core.test.js` using Node's built-in test runner.

### Verification performed

- 7 GolfCore tests passed.
- Full inline simulation JavaScript passed `node --check`.
- Browser rendering, frame rate and runtime behaviour have not yet been verified.
- The tests exercise the kernel contract, not the full particle simulation or browser environment.

### Character counts

| Artifact | Before | After |
|---|---:|---:|
| `accretion.html` characters | 976 | 1,987 |
| `accretion.html` non-whitespace | 942 | 1,922 |
| GolfCore block characters | n/a | 677 |
| GolfCore block non-whitespace | n/a | 669 |
| `tests/core.test.js` characters | n/a | 2,337 |
| `tests/core.test.js` non-whitespace | n/a | 2,126 |

The source change is an architectural foundation, not completion of the full specification. Generic state ownership, shared state containers, event queues, seeded randomness, replaceable physics/chemistry/biology modules and emergence experiments remain outstanding.


## 15 November 2026: Four-stage emergence implementation

**Branch:** feat/four-stage-emergence-completion  
**Base:** PR #5 head d0b2059784bce916daf183b73acd3d381ca91ed1  
**PR #5:** remains open and unmerged.

### Added source

- Added src/emergence.js with typed material contracts, a StateOwner facade, lifecycle transitions, module contract validation and AtomicExecutor.
- Added reusable contact aggregation, bond-component molecular formation, polymerisation, autocatalytic network assembly/rule registration, lipid-ring membrane assembly and protocell formation.
- Added seeded sequence replication/mutation, growth, lifecycle-gated reproduction, daughter membrane reassembly, colony composition, differentiation and radial/bilateral morphogenesis.
- Added LineageJournal and ExperimentHarness for seeded runs, interventions, replicate sweeps and descriptive statistics.
- Integrated the reusable aggregation/molecular-formation path into accretion.html and removed the bespoke merge callback.
- Added tests/emergence-progression.test.js and refreshed the feature catalogue, status, source audit, execution semantics, emergence architecture and consolidation assessment.

### Important boundaries

- The StateOwner facade is the preferred write path but does not yet encapsulate every public object in the legacy runtime.
- AtomicExecutor provides atomic module action batches, not whole-tick rollback.
- Membranes are discrete lipid rings; permeability is not yet a selective transport model.
- Genome inheritance is sequence copying with seeded mutation; no gene expression model exists.
- Differentiation and morphogenesis are explicit policies, not emergent developmental regulation.
- Blind emergence tests, bootstrap intervals and browser stress testing remain future work.

### Verification

Intermediate CI runs exposed and corrected two integration issues: the inline engine test extractor needed to stop before the dynamic browser-module bootstrap, and biological cells needed to remain lifecycle-active while compositionally bound in a colony. The final test result must be recorded against the final branch head after all documentation updates. Browser rendering remains unverified until exercised in a browser.


### Execution and measurement refinement

- Added DeterministicEventQueue and EventRuleRouter with sequenced immutable events, phase-aware FIFO delivery, stable handler ordering, per-event atomic action batches, deferred recursive emissions and retry after failed commits.
- Added seeded bootstrap confidence intervals for sample means and between-group differences, quartiles and type-diversity metrics.
- Tightened AtomicExecutor to reject duplicate writes to the same entity/property and ModuleContractRegistry to enforce exclusive declared write ownership.
- Removed duplicated mutable progression counters: the metrics surface is now derived from the canonical LineageJournal counts/totals.
- Extended experiment snapshots with lineage parent/child projections and pending event queue state.
- Added regression coverage for all of the above.


### Final transaction and lineage pass

- Extended EntityStore.transact rollback to preserve typed material quantities and unit metadata.
- Routed StateOwner material changes, material transfers and removals through the same transaction boundary.
- Made topology assembly, membrane/protocell construction, autocatalytic network assembly, replication with daughter membrane, growth, aggregation and morphogenesis atomic at their operation boundaries.
- Added rollback coverage for failed protocell assembly, topology composition, replication, lifecycle state and material transfers.
- Added monotonic RuleEngine reaction event IDs and captured committed reactions in experiment lineage histories.
- Removed the now-unused direct bond helper and made progression counters derived projections of the canonical lineage journal.


### Blind experiment and GolfCore contract completion

- Added randomized coded experiment arms with preregistered metric names and a sealed condition key that is revealed only through an explicit method.
- Added blind-result analysis by opaque arm code and verified treatment effects without exposing condition labels before reveal.
- Reduced the GolfCore evaluator to 552 ASCII bytes by moving validated staged commits into EntityStore.commitChanges; the evaluator retains ordered predicate/effect execution.
- Updated the architecture/specification gate audit with the measured core footprint and current blind-experiment implementation.
