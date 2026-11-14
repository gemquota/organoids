# Organoids Feature Catalogue

**Snapshot:** 14 November 2026

This catalogue separates intended capabilities from implementation evidence. A feature appearing here does not automatically mean it exists in working code.

### Status vocabulary

- **Design scope:** part of the agreed architectural direction.
- **Reported:** previously described as present or implemented, but not independently rechecked against current source.
- **In progress:** actively being consolidated, designed or integrated.
- **Unverified:** discussed or intended; no sufficient implementation evidence is available here.
- **Blocked / unresolved:** requires a decision, integration or verification step.

## 1. Foundational substrate

| Capability | Description | Evidence status |
|---|---|---|
| GolfCore | Minimal universal execution kernel: entities, state, relations and operations; higher-level behaviour expressed as composable data | Design scope |
| Entity representation | Minimal common header with extensible, composable payloads | Prototype on draft PR #2 |
| State containers | Generic state representation with ownership determined by relationships and lifecycle | Design scope; not yet implemented |
| State lifecycles | Local/intrinsic, shared/global, derived and transient state semantics | Design scope |
| Relations | Generic links for identity references, ownership, composition, dependency and interaction | Basic generic relation list prototyped; ownership semantics outstanding |
| Transformations | Constraints, validation and atomic commit/reject | Basic staged atomic commit/reject prototyped; full domain constraints outstanding |
| Shared substrate | Common mechanisms rather than isolated feature implementations | Design scope; size discrepancy measured |

## 2. Rules and execution

- Declarative rule data describing conditions, operations/effects and constraints.
- Shared rule evaluator.
- Event-triggered evaluation where dependencies are explicit.
- Deterministic phases/priorities for conflict resolution.
- Specialised domain predicates and effects behind stable contracts.
- Rules promoted to entities only when they need identity, lifecycle or independent state.

**Status:** hybrid rule kernel prototyped on draft PR #2: predicate/effect registries, per-rule snapshots, deterministic phase/priority/registration order and staged atomic commits. Event queues and seeded randomness remain outstanding. Seven kernel tests pass. Exact snapshot, ordering, conflict, event and commit semantics remain unverified.

## 3. Physics and interactions

- Independently replaceable physics module.
- Shared fields and constraints.
- Particle-level representation and interaction.
- Density, pressure and other interaction properties where required by the physical model.
- Energy/resource transfer and transformation.
- Approximate conservation with declared tolerances and meaningful sources/sinks.
- Reusable interaction mechanisms rather than per-species physics.

**Live source:** a simple particle interaction/merge loop exists in accretion.html. The specified replaceable physics module, numerical tolerances and diagnostics are not implemented.

## 4. Chemistry and transformation

- Independently replaceable chemistry module.
- Declarative chemical policies and reaction descriptions.
- General transformation/reaction mechanisms.
- Composition and decomposition.
- Interaction-driven formation of more complex structures.
- Domain-specific constraints implemented on shared transformation contracts.

**Evidence:** chemistry and declarative rules are design scope. Specific reaction catalogues and tested reaction behaviour are unverified.

## 5. Biological emergence

- Independently replaceable biology module.
- Emergence from particles into structures.
- Compound and protocell formation.
- Organism-like and colony organisation.
- Self-organisation through local interactions.
- Growth, structural change, reproduction and propagation as higher-order mechanisms.
- Life-like behaviour arising from shared rules and specialised biological policies.

**Evidence:** particle-to-protocell-to-colony emergence is design scope. Completeness of each stage is not verified.

## 6. Universal mechanisms and specialised policies

- Shared primitives for identity, state, relations, composition, transformation and execution.
- Specialised physics, chemistry and biology policies.
- Abstraction based on demonstrated semantic reuse, not superficial code similarity.
- Stable contracts that permit domain modules to be independently tested and replaced.

This is the governing design principle, not proof that all mechanisms have already been consolidated.

## 7. Emergence observability and verification

- Statistical measurements of populations, structures, diversity and distributions.
- Seeded reproducible experiments.
- Perturbation experiments.
- Intervention tests removing or changing mechanisms.
- Blind emergence tests with predefined metrics and no encoded target outcome.
- Causal histories, event traces and lineage tracking.
- Regression and interoperability tests.
- Runtime inspection and measured source-size reporting.

**Evidence:** seven GolfCore unit tests are present on draft PR #2. Statistical emergence experiments, browser/runtime tests and the wider verification programme remain unimplemented.

## 8. Engineering and delivery

- Single coherent implementation.
- Consolidation of semantically equivalent mechanisms.
- Progressive golfing and abstraction.
- Stable module contracts.
- Automated tests and CI.
- Runtime verification.
- Reproducible measurements.
- Before/after total and non-whitespace character counts for every consolidation pass.

## 9. Explicit exclusions

- Real-world biological organoid development or experimentation.
- Importing Boids implementation, source, dependencies or code.
- Folding Mocean or NEXUS Aquarium into this repository.
- Treating conceptual discussion as proof of implementation.
- Forcing superficially similar but semantically distinct mechanisms into one abstraction.

## 10. Feature completion rule

A feature should only be marked **complete** when:
1. Its implementation exists in the authoritative source.
2. Its contract and semantics are documented.
3. Relevant tests pass.
4. Integration with the shared substrate is demonstrated.
5. Runtime-dependent behaviour has been smoke-tested.

Until then, retain the appropriate weaker status.
