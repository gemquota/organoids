# Post-completion architecture review

**Review date:** 15 November 2026  
**Implementation:** feat/four-stage-emergence-completion  
**Review basis:** current source, progression tests, CI and source-size comparison.  
**Detailed source audit:** SOURCE_MAPPED_AUDIT.md

## Executive result

The implementation adds biological and experimental policy without creating a second simulation substrate. The post-completion pass also removed redundant state projections, eliminated unused code and moved partial construction paths behind the existing transaction authority.

## 1. Redundancies identified and removed

### Mutable progression counters versus lineage history

**Problem:** progression counters were incremented independently from the event history. The counters and event stream could disagree after rollback or future changes.

**Change:** progression metrics are now derived from LineageJournal lifetime counts/totals. The journal remains the historical source; metrics are a read-only projection. The obsolete mutable metrics object was removed.

### Duplicate bonding path

**Problem:** a private direct-mutation bond helper duplicated the EntityStore link operation and could bypass transaction batching.

**Change:** the helper was removed. Contact aggregation stages relation actions through EntityStore.transact; membrane construction stages its ring bonds in the same transaction as the lipid and membrane entities.

### Bespoke demo aggregation

**Problem:** the browser prototype had its own pairwise merge implementation alongside the new reusable aggregation and molecule-formation mechanisms.

**Change:** the bespoke merge loop was removed. The live prototype calls aggregateContacts and formMolecules. The inline file grew only modestly relative to PR #5 despite gaining transactional lifecycle/material support and module bootstrap.

### Separate biological storage

**Problem considered:** a biology-specific entity store, energy pool, graph or scheduler would duplicate foundational state and create another reconciliation boundary.

**Change:** none was introduced. EntityStore owns identity/composition/relations, EnergyEngine owns energy and typed quantities, FieldGrid owns fields, TopologyEngine owns assembly, ConstraintEngine owns geometric constraints, RuleEngine owns reaction execution, and Scheduler owns ordered phases.

## 2. Existing abstractions reused

| New behaviour | Existing abstraction reused |
|---|---|
| Aggregation and bonding | SpatialIndex + EntityStore typed relations |
| Molecule and polymer formation | EntityStore composition + EnergyEngine transfers/dissipation |
| Autocatalytic reaction policies | RuleEngine |
| Membrane/protocell composition | EntityStore transactions and composition |
| Replication and lineage | EntityStore identity/relations + SeededRandom + LineageJournal |
| Growth/reproduction energy | EnergyEngine + transactional entity actions |
| Colonies | TopologyEngine atomic assembly |
| Morphogenesis | EntityStore transaction + ConstraintEngine |
| Experiment perturbations | EnergyEngine, FieldGrid, lifecycle and rule-event history |
| Module execution | ModuleContractRegistry + AtomicExecutor over EntityStore.transact |

## 3. Transaction audit

The final pass found partial-commit risks in membrane/protocell construction, replication, growth, aggregation and topology assembly. These paths now use one transaction per natural operation boundary. The transaction journal also snapshots typed material quantities and their unit metadata, not only entity energy and properties.

Tests verify that failed:
- protocell construction leaves no orphan membrane/lipid entities;
- topology assembly restores the original child ownership;
- replication restores the seeded random stream and leaves no partial daughter;
- lifecycle state and life-stage payload changes roll back together;
- material transfers restore quantities and unit metadata;
- event-handler action batches remain queued when their transaction fails.

This still does not make an entire scheduler tick atomic. The documented guarantee is operation/rule/module-batch atomicity, not global frame rollback.

## 4. Ownership and semantic separation retained

The following are intentionally separate because combining them would erase important semantics:

- Containment state versus biological life stage: a cell can be contained in a colony and still be alive/active.
- Energy reservoirs versus accounting ledger: the ledger measures flux and is not a second reservoir.
- Lineage journal versus event queue: one is durable history, the other is pending dispatch.
- Graph analysis versus topology mutation.
- Force accumulation versus geometric constraint projection.
- General-purpose GolfCore rules versus declarative chemical reactions.
- Intrinsic state versus derived indexes and cached projections.

## 5. Remaining simplification/abstraction opportunities

These are real next-stage opportunities, not hidden implementation claims:

1. Fully encapsulate legacy public entity objects so all writes pass through their declared owner.
2. Add property-level read/write contracts and dependency indexing for all existing GolfCore/RuleEngine modules.
3. Decide whether whole-tick rollback is required; if so, move all scheduler phases to a common prepared-action boundary.
4. Extend typed material accounting to explicit environmental sources/sinks and conservation audits for mass/charge, not just energy.
5. Make membrane transport, metabolic reactions and resource uptake use the same typed material/field flux contracts.
6. Replace sequence-string heredity with a structured genotype/phenotype model, retaining the same entity and lineage owners.
7. Drive differentiation and morphogenesis from field and regulatory dynamics while continuing to reuse FieldGrid and ConstraintEngine.
8. Expand the blind protocol to support preregistered outcome definitions and analysis plans, then add stronger distributional inference; the current randomized coded arms, bootstrap intervals and descriptive comparisons are a foundation, not a complete scientific inference stack.

## 6. Verification and measured footprint

- Final modularized CI run 43708650558 on ff22fb31b15898bcb4e3535e8e51b725473bf66e: 98 tests passed, 0 failed. Earlier run 372 predates modularization and is not the acceptance result.
- The full inline browser module syntax check passed.
- GolfCore evaluator: 552 ASCII bytes / 538 non-whitespace, with transaction ownership moved to EntityStore and an exact-size regression test.
- Browser rendering and sustained-load behaviour remain unverified.
- Current accretion.html: 36,472 characters / 35,756 non-whitespace.
- PR #5 accretion.html: 35,243 / 34,563.
- Current src/emergence.js: 38,607 / 37,560.
- Current progression tests: 20,242 / 19,704.

The size increase is explicit and attributable to the additional transactional substrate guarantees and biological/experimental module. The simplification gains are architectural: shared ownership, fewer duplicate pathways, atomic assembly and derived projections rather than parallel mutable state.

## 7. Modularity and post-refactor consolidation

The original `src/emergence.js` mixed the substrate, biological policy and experiment harness. It has been reduced to a compatibility re-export. Domain implementations now live in focused files under `src/emergence/`, with a nested progression family for aggregation, molecular chemistry, membranes, heredity, organismal behaviour and development.

### Findings and actions

- **Duplicated helpers:** centralized pure numeric, cloning, activity and path helpers in `shared.js`.
- **Oversized progression class:** reduced its implementation to composition, contracts, common lifecycle/lineage operations and the public facade; domain methods moved into focused modules.
- **Combined biology policy:** split heredity, organismal growth/reproduction and development into separate modules; deleted the superseded combined file.
- **Duplicated authorities:** retained the existing entity store, energy, topology, constraints, fields, scheduler and reaction engine as the only authorities.
- **Redundant metrics:** retained lineage-derived metrics rather than parallel counters.
- **Public compatibility:** preserved the old import path through the barrel and nested index.
- **Implicit coupling:** made dependencies explicit through imports and a single composition root. Module read/write declarations remain validated by the module contract registry.

### Remaining review cautions

The domain method sets are composed onto the public progression facade at module load. Statistical summaries and bootstrap comparisons were subsequently extracted into the dedicated `statistics.js` module, leaving experiment orchestration separate. This keeps a stable API and avoids a dependency-heavy class file, but should remain static and deterministic. Do not add runtime plugin discovery or mutable module registration without a versioned contract and tests. Whole-tick rollback, membrane transport/metabolism, gene regulation, large experimental campaigns and browser/load verification remain separate scope, not cleanup debt.

The full module topology and boundary rules are in [MODULARITY.md](MODULARITY.md).


### Quantified modularization result

The public compatibility entry is 38 bytes. The 19 implementation files under `src/emergence/` total 41,629 bytes; with the 38-byte compatibility entry, the full modular source totals 41,667 bytes. The largest focused leaf is `experiments.js` at 6,476 bytes, with statistical calculations isolated in `statistics.js` at 2,370 bytes. The composition root is 4,472 bytes. The extraction increases total source bytes modestly because imports, exports and explicit module boundaries have a cost. This is an intentional trade for cohesion and independent change boundaries, not a compression claim.
