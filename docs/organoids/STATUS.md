# Organoids Project Status

**Status snapshot:** 14 November 2026  
**Source confidence:** live `gemquota/organoids` `main` tree and `accretion.html` were statically inspected on 14 November 2026; runtime and test execution remain unverified.

## 1. Executive status

Organoids is in architectural consolidation and foundational implementation. The architectural direction is now substantially clearer: a minimal universal GolfCore, generic entities with extensible payloads, relationship/lifecycle-based state ownership, atomic transformations, approximate physical conservation, specialised domain policies on universal primitives, replaceable modules and systematic emergence testing.

The rules model was subsequently approved and is now a confirmed architectural decision. The consolidated specification is documented; this does not establish that the current source implements it.

## 2. Historical source measurements

The following measurements were reported in project discussion on 13 November 2026:

| Artifact | Characters | Non-whitespace |
|---|---:|---:|
| `emergence.js` | 10,531 | 10,126 |
| `accretion.html` | 3,179 | 3,087 |
| Tests | 3,997 | 3,786 |
| Documentation | 2,730 | 2,383 |

These are reported measurements, not estimates. Re-run them against current files before treating them as the present baseline.

A separate comparison exposed a major estimate/measurement discrepancy:

| Measure | Estimate | Actual |
|---|---:|---:|
| Shared substrate | 710 | 12,350 |

The actual was approximately 17.4 times the estimate. The 12,350-character figure is a separate reported measurement; do not assume it is the sum of the artifact rows above without confirming scope and counting method.

## 3. Live source audit (14 November 2026)\n\nThe current `gemquota/organoids` `main` tree contains exactly one tracked file, `accretion.html`. Its live content measures **976 characters / 942 non-whitespace characters** (976 bytes; ASCII). It creates 800 canvas particles, applies randomised pairwise attraction/repulsion, merges close particles using mass-weighted position and velocity, and renders them. It is a compact particle prototype, not yet the specified generic substrate. No tests, package manifests, module directories or CI workflow files appear in the inspected tree. See [SOURCE_AUDIT.md](SOURCE_AUDIT.md) for the full inventory and capability mapping.\n\nThe live measurement differs from the historical 3,179 / 3,087 report; these are different snapshots or scopes and must not be conflated.\n\n## 4. Artifact lineage

### `accretion.html`

Project discussion identifies this as the central and authoritative Organoids artifact. The stated approach is to build the system up from a golfed foundation in this file.

### `emergence.js`

Discussed as a previous implementation attempt. Its exact relationship to the current `accretion.html` implementation, including whether it is superseded, partially reusable as reference or still active, requires source-level reconciliation.

Do not silently treat both as current parallel implementations.

### Tests and documentation

Historical measurements exist, but current paths, test coverage and whether documentation reflects the latest implementation remain unverified.

## 4. Architecture decisions consolidated

The nine-question review produced the following user-confirmed decisions:

| Area | Decision | Status |
|---|---|---|
| GolfCore | Minimal universal execution kernel: entities, state, relations, operations; higher-level behaviour as composable data | Confirmed |
| Entity schema | Minimal common header plus extensible, composable payloads | Confirmed |
| State ownership | Generic containers and relationship-based ownership, governed by lifecycle | Confirmed; D and E reconciled |
| Rules | Lightweight hybrid: declarative data, shared evaluator, event triggers where reliable, deterministic conflict phases; rules become entities only when lifecycle/identity/state is needed | Confirmed after user approval |
| Transformations | Constraints, validation and atomic commits | Confirmed |
| Conservation | Approximate conservation prioritising emergence and performance | Confirmed |
| Universalisation | Universal primitives, specialised policies; generalise after demonstrated reuse | Confirmed; B/D/E reconciled |
| Module boundaries | Replaceable physics, chemistry and biology; boundaries follow contracts and independent testability | Confirmed |
| Emergence testing | Statistical, seeded, perturbation, intervention, blind and lineage/history methods | Confirmed |

### Important clarifications

- State ownership D and E are complementary: generic containers/relationships provide representation; lifecycle determines ownership policy.
- Universalisation B, D and E are reconciled by adopting universal primitives and specialised policies, with demonstrated semantic reuse as the gate for generalisation. "Universalise almost everything" is an exploration goal, not permission to erase domain distinctions.
- Rule evaluation is not yet a confirmed user decision. The proposed hybrid uses declarative rule data, a shared evaluator, event triggers where reliable, deterministic phases for conflicts, and rules-as-entities only when lifecycle/identity/state is needed.

## 5. Work reported or requested

- Established Organoids as a VEPA architectural successor rather than a sequel.
- Established the GolfCore minimal-core philosophy (approximately 600–700 bytes).
- Identified a unified entity/composition model and shared physical substrate.
- Reviewed implementation footprint and exposed the estimate-versus-actual discrepancy.
- Investigated `emergence.js` lineage.
- Requested a golfed, maximally abstracted review/rewrite.
- Requested consolidation and further assessments focused on semantic interoperability, modularisation, primitive generalisation, universal abstraction and simplification.
- Consolidated the nine architectural decision areas into a coherent documented specification.

This list distinguishes discussion and documentation from verified merged implementation. No source code, tests or runtime behaviour were changed or verified by this documentation update.

## 7. Current completion assessment

| Area | Current assessment |
|---|---|
| Project identity and lineage | Established |
| Boids implementation exclusion | Explicit constraint |
| GolfCore conceptual contract | Specified; 677-character prototype on draft PR #2 |
| Canonical entity model | Minimal header/payload prototype on draft PR #2; full ownership model outstanding |
| State ownership/lifecycle | Specification complete; implementation outstanding |
| Rule execution | Declarative predicate/effect prototype and deterministic phases/priorities on draft PR #2; event semantics outstanding |
| Atomic transformations | Staged atomic commit/reject prototype and seven passing kernel tests on draft PR #2 |
| Approximate conservation | Policy selected; tolerances and accounting outstanding |
| Universal primitives/specialised policies | Specified; reuse evidence outstanding |
| Replaceable module boundaries | Specified; implementation outstanding/unverified |
| Emergence test strategy | Specified; implementation outstanding/unverified |
| Current source reconciliation | Initial static audit complete; full source-to-contract mapping outstanding |
| Current tests and CI | 7 GolfCore tests pass on PR branch; CI configuration absent/unverified |
| Runtime smoke test | Unverified |
| Current measured size baseline | Live baseline established: 976 / 942 for accretion.html |

## 8. Immediate risks

1. Competing or overlapping artifacts: `emergence.js` and `accretion.html`.
2. Measurement ambiguity around the 12,350-character shared-substrate figure.
3. Status inflation: documentation can be mistaken for implementation.
4. Abstraction without semantic equivalence can erase meaningful domain differences.
5. Generic state containers can obscure ownership unless relationships and lifecycle are explicit.
6. Rule scheduling can become nondeterministic unless snapshots, phases, conflicts and commits are specified.
7. Approximate conservation can become uncontrolled drift without tolerances and diagnostics.
8. Modules can appear modular while retaining hidden representation or lifecycle assumptions.
9. Scope contamination from related projects.

## 9. Next verification actions

1. Inspect current authoritative `accretion.html`.
2. Establish whether `emergence.js` is active, superseded or historical reference.
3. Inventory primitives, shared mechanisms, consumers and duplicated implementations.
4. Re-run character and non-whitespace measurements with documented counting.
5. Map every specification item to source locations and tests.
6. Define exact GolfCore operations and verify the byte target.
7. Specify the confirmed rule model's snapshot, ordering, conflict, event and commit semantics.
8. Run tests and report actual results.
9. Run the simulation and perform a runtime smoke test.
10. Update status from source and test evidence.

## 10. Reporting rule

Every consolidation report must include pass number/scope, actual changes, features/primitives consolidated, semantic effects, tests/results, before/after character counts, before/after non-whitespace counts, regressions and unresolved work.

Never report an assessment or proposal as a completed implementation pass.
