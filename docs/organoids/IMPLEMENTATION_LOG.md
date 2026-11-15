# Organoids implementation history

This file is a chronological engineering log, not a live status catalogue. Current feature state, source maps, test evidence, limitations and roadmap are maintained exclusively in [FEATURES.md](FEATURES.md).

## 14 November 2026: GolfCore foundation

- Established the minimal entity/state/relation/operation execution model.
- Added declarative predicate/effect rules, deterministic ordering and staged commits.
- Migrated the particle prototype to generic entities.
- Kept domain physics outside the minimal evaluator.

## 15 November 2026: substrate reconciliation (PR #5)

**PR:** [#5 Optimize accretion transport and runtime allocation](https://github.com/gemquota/organoids/pull/5)  
**Merge commit:** `39f9e00cfcfdaab8d00e911df42735f46fa7336c`

- Reconciled the substrate with current mainline.
- Improved entity relationship projections and transaction journals.
- Consolidated energy flux authority and accounting.
- Separated interaction forces from geometric constraints and graph analysis from topology.
- Reused field and spatial-query buffers and improved reaction candidate indexing.
- Removed obsolete CommonJS tests and the invalid inline syntax-check workflow step.
- PR #5 was reviewed and merged into main.

## 15 November 2026: four-stage emergence and modularization (PR #6)

**PR:** [#6 Complete four-stage emergence and modularize progression](https://github.com/gemquota/organoids/pull/6)  
**Merge commit:** `89a41f4c1c5fe0a29132cc72edd9c99a62c849a4`

- Implemented substrate ownership facade, lifecycle, contracts, atomic module execution and deterministic events.
- Implemented aggregation, molecular formation, polymerisation, autocatalytic network assembly, membranes and protocells.
- Implemented replication, heredity, growth, reproduction, colonies, differentiation and morphogenesis.
- Added seeded experiments, interventions, lineage, blind protocols and statistical analysis.
- Extracted focused modules under `src/emergence/` while preserving `src/emergence.js` as a compatibility entry.
- Updated the source-mapped audit and architecture documents.
- PR #6 was rebased onto main, passed CI and merged.

## 15 November 2026: remaining-boundaries implementation

**Branch:** `feat/remaining-emergence-boundaries`  
**Base:** merged main after PR #5 and PR #6.

- Added transaction-only guards and deep immutability for declared biological payload keys.
- Bound runtime entity energy writes to EnergyEngine through a private EntityStore capability.
- Added EntityStore change notifications, indexed dependency subscriptions and commit-deferred notification batches.
- Added whole-tick runtime checkpoint/rollback and integrated it into experimental runs.
- Added energy-bearing quantity source/sink accounting, internal material transfer and substrate conversion with heat/output accounting.
- Added selective membrane transport with permeability, selectivity, channel and gradient controls.
- Added locus-based gene expression and signal-weighted phenotype traits.
- Added resource-limited growth and fission with biomass, energy and material partition.
- Added field-driven differentiation and gradient-following morphogenetic movement.
- Added factorial experiment campaigns.
- Added focused behavioural tests and consolidated duplicate status/roadmap/audit tables into FEATURES.md.

The implementation deliberately retains bounded labels where universal legacy ownership, browser-loop rollback, fluid membrane mechanics, kinetic gene regulation or reaction-diffusion development have not been delivered. See FEATURES.md for the exact completion audit and current test run.
