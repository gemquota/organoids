# Organoids consolidation assessment

## Architecture and lineage

`main` is the original 976-character particle prototype. `architecture/golfcore-foundation` is its direct architectural continuation: a 677-character generic kernel for entities, relations, predicate/effect rules, ordered execution and atomic staged commits. `biology-entity-registry` is an independent exploratory UI/model branch, not the implementation lineage.

`feat/unified-emergence-substrate` is the implementation base. It expanded into a reusable simulation engine but initially displaced rather than fully subsuming GolfCore. The generic predicate/effect kernel is now restored as `GolfCore`, exposed as `runtime.core`. Its original state payload maps to entity `properties`; typed relations remain owned by EntityStore.

## Implemented substrate

| Layer | Contract |
|---|---|
| GolfCore | Named predicates/effects, ordered phase/priority rules, staged property patches, atomic commit |
| EntityStore | Entity lifecycle, recursive containment, typed links, adjacency indexes, snapshots, journalled transactions |
| SpatialIndex | Uniform-grid neighbour lookup |
| PairEngine | Shared attraction/repulsion and positional constraint solver; legacy API aliases |
| FieldGrid | Typed scalar fields, diffusion, decay, gradients, advection, boundary sampling and cell-level rollback journal |
| EnergyEngine | Source, transfer, conversion, dissipation, field exchange, typed quantities and inventory audit |
| GraphEngine | Typed neighbourhoods, connected components, cycle checks, assembly and division; topology alias |
| RuleEngine | Data-defined reactions, reactants, catalysts, conditions, rates, energy costs and product events |
| Scheduler | Ordered core, reaction and field-transport phases |

## GolfCore reconciliation

Entity and relation primitives are covered by EntityStore and typed links. General predicate/effect registries, rule ordering and arbitrary staged patches were missing; biological reaction rules were not an equivalent replacement. The restored core validates entity identity, rejects duplicate entity writes, and commits through EntityStore transactions. Core execution runs before domain reactions.

## Important limits

- Transactions cover engine-managed entities, relationships, fields, energy ledger and events. Arbitrary external side effects and complete per-operation schema validation are not transactional.
- Energy audits cover EnergyEngine-routed flows and require an explicit baseline. Direct external mutation is invisible.
- Diffusion uses conservative no-flux neighbour exchange. Interpolation-based advection is not strictly conservative; field source/sink accounting and vector/tensor fields remain future work.
- Boundary metadata currently controls advection sampling; diffusion uses no-flux exchange.
- RuleEngine is a domain reaction system, distinct from GolfCore's general execution rules.
- The browser prototype is a standalone inline copy of the reference engine. Keep both synchronised.

## Demonstrated behaviour

The page demonstrates particle motion, pair interactions, energy flux, dissipation and aggregation into molecules. Aggregation still lives in the demo callback rather than a reusable contact/adhesion transformation. Polymers, autocatalytic networks, membranes, protocells, replication, heredity, signalling, differentiation and colonies are not demonstrated end-to-end.

## Next progression

1. Express aggregation as reusable contact/adhesion triggers and transactional transformations.
2. Add material schemas and capability fragments with units, defaults and validation.
3. Extend transactional topology for fusion, fission and division with explicit material/energy policies.
4. Add deterministic seeded execution, event replay and phase-failure semantics.
5. Instrument pair candidates, graph work, transaction sizes and field operations before further optimisation.
6. Expand the demonstration through polymers, membranes, protocells, metabolism, replication and multicellular organisation.

## Verification boundaries

GitHub Actions run 137 passed all 32 tests and `node --check emergence.js` after GolfCore recovery. Browser rendering, sustained-load stability, complete energy/matter conservation and full biological progression are not claimed as verified.

## Measurement discipline

Report actual characters and non-whitespace characters for matching file scopes. Keep estimates separate. The former 710/1,925 figures were planning estimates, not measured implementation sizes.
