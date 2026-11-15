# Modularity and module-contract architecture

**Snapshot:** 15 November 2026  
**Implementation branch:** `feat/remaining-emergence-boundaries`  
**Compatibility entry:** `src/emergence.js`

## Intent

The refactor turns the former emergence implementation into small, domain-owned modules without creating a second runtime or forcing unrelated concepts into one generic abstraction. The existing entity store, energy authority, spatial fields, topology, constraints, reactions and scheduler remain the shared substrate.

The architectural rule is: **small policy modules, explicit shared authorities, stable semantic contracts, and nested meta-modules only where a domain has enough internal structure to justify them.**

## Module topology

```text
src/
  emergence.js                 stable public compatibility barrel
  emergence/
    index.js                   public export aggregation
    factory.js                 construction entry point
    shared.js                  pure cross-domain primitives
    random.js                  deterministic random stream
    contracts.js               entity schemas + module contracts
    lineage.js                 append-oriented ancestry/event history
    lifecycle.js               legal state transitions and ageing
    events.js                  deterministic queue, router and dependency index
    transactions.js             whole-tick checkpoint and rollback
    ownership.js               validated state/energy/relation facade
    execution.js               atomic module batch executor
    progression.js             composition root and public facade
    aggregation.js             contact detection and bond components
    molecular.js               molecules, polymers and catalytic networks
    membranes.js               membrane plans and protocell assembly
    physiology.js              selective transport and metabolic flux
    heredity.js                replication, mutation and partition
    genetics.js                locus expression and regulation
    organismal.js              biomass growth and reproduction
    development.js             colonies, differentiation and morphogenesis
    experiments.js             seeded protocols and interventions
    statistics.js              descriptive and bootstrap summaries
```

The eight nested progression domains are a deliberately small meta-module family. Their exported method sets are attached to the `EmergenceProgression` facade once at module load. They share the same runtime, owner, lifecycle, lineage and transaction authorities; they do not own shadow stores or duplicate biological state.

## Semantic boundaries

| Module | Owns | Must not own |
|---|---|---|
| `shared` | Pure numeric, cloning, path and activity helpers | Runtime state or policy |
| `contracts` | Schema validation and declared module read/write contracts | Entity mutation |
| `ownership` | Validated state, material, energy and relation writes | Independent copies of authoritative state |
| `execution` | Atomic preparation/commit coordination | Biological policy |
| `events` | Ordered event delivery and handler coordination | Event-specific domain state |
| `lineage` | Historical events and ancestry projections | Live entity payloads |
| `lifecycle` | Legal lifecycle transitions and age semantics | Replication or developmental policy |
| `aggregation` | Contact discovery and reusable bond connectivity | Molecule-specific semantics |
| `molecular` | Molecule/polymer/network formation | Duplicate bond storage |
| `membranes` | Membrane construction plans and protocell assembly | General-purpose entity storage |
| `heredity` | Genome copying and mutation | Independent random source |
| `organismal` | Growth and reproduction policy | Independent lifecycle or energy authority |
| `development` | Colony/differentiation/morphogenesis policy | Duplicate topology or constraint engine |
| `experiments` | Seeded protocols, intervention orchestration and summaries | Mutation of production runtime state outside the protocol |
| `progression` | Dependency composition and stable facade | Domain implementation details |

## Interoperability contracts

1. **Identity:** entity IDs and relationship endpoints are the shared references. Modules pass IDs or entity handles, never private shadow objects.
2. **State ownership:** writes go through `StateOwner`, `EntityStore`, `EnergyEngine`, `TopologyEngine` or `ConstraintEngine` according to the state domain.
3. **Transactions:** multi-entity construction and resource transfers use the existing transaction authority. A module must not emulate rollback by independently restoring partial copies.
4. **Lifecycle:** biological operations request transitions from `LifecycleEngine`; they do not directly invent lifecycle state changes.
5. **Events and history:** domain modules emit semantic events; `LineageJournal` records ancestry and history. Current metrics are projections of that history, not parallel mutable counters.
6. **Randomness:** stochastic modules consume the injected seeded stream. They must not call ambient randomness.
7. **Contracts:** a module declares required runtime services, read sets, write sets and phase. Conflicting declared state writers and missing required runtime services are rejected during validation. Read sets are recorded as contract metadata but are not yet enforced at every read boundary; that remains an explicit future hardening task.
8. **Compatibility:** consumers import the existing `src/emergence.js` entry point. Internal file movement does not force callers to migrate.

## Future-proofing rules

- New domains should be nested only after they have at least two coherent submodules or a meaningful internal contract boundary.
- Keep module APIs semantic: `replicate`, `transport`, `differentiate`, not generic `process` or `update` hooks.
- Prefer capability interfaces and injected authorities over importing the entire runtime into leaf modules.
- Treat materialized indexes and caches as projections with a named source of truth, invalidation rule and rebuild path.
- Add a module contract test for every new writer and an interoperability test for every cross-domain transaction.
- Keep experimental protocols versioned and seeded; report sample size and uncertainty rather than presenting one run as evidence.
- Do not split a module merely to satisfy a line-count target. Split when ownership, lifecycle, failure semantics or change cadence differ.
- Do not compress away domain names or semantic boundaries to save bytes. Compression is justified only after the abstractions are stable and measured.

## Consolidation findings and actions

- Shared helper implementations now live in one pure module rather than being copied between domains.
- The old combined biology implementation was removed after heredity, organismal behaviour and development were split into distinct modules.
- The public compatibility entry point is a two-line re-export; public names are assembled by the nested index.
- The progression facade is the sole composition root. Domain modules contribute cohesive method sets without constructing duplicate runtime services.
- Existing substrate authorities are reused for energy, topology, constraints, state writes and transactions.
- Metrics remain derived from lineage rather than duplicated mutable counters.
- The previous one-file implementation is no longer the source of truth.

## Deliberately not claimed

This is modular source architecture, not a claim that all future biology is implemented. Selective membrane transport, metabolism, gene regulation, whole-tick rollback, large-scale parameter campaigns, and browser/load validation remain separate engineering work. The modules provide places to add those capabilities without reopening a monolith.


## Remaining-boundaries module extensions

The current focused module family also includes:

- `transactions.js`: whole-tick checkpoint and rollback coordinator.
- `physiology.js`: selective membrane transport and energy-bearing substrate conversion.
- `genetics.js`: locus definition, signal-weighted expression and phenotype trait mapping.

The EntityStore now protects declared biological payload keys with transaction-only setters and deeply immutable nested values. Runtime entity energy is guarded by a private store capability bound to EnergyEngine. The dependency index subscribes to committed transactional property/state/material changes; tick-level change batches are delivered only after successful commit and discarded on rollback.

The current module topology is intentionally not a claim of universal ownership. Unprotected generic payloads remain extensible, direct non-transactional physics writes are not indexed, and the browser animation loop is not yet wrapped by RuntimeTickTransaction. The canonical capability boundaries are in [FEATURES.md](FEATURES.md).
