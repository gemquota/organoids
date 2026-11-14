# Organoids Live Source Audit

**Audit date:** 14 November 2026  
**Repository:** [gemquota/organoids](https://github.com/gemquota/organoids)  
**Branch inspected:** `main`  
**Scope:** repository tree and current `accretion.html` contents.

## 1. Repository inventory

The recursive Git tree for `main` contains exactly one tracked file:

| Path | Type | Bytes reported by GitHub |
|---|---|---:|
| `accretion.html` | HTML with inline CSS and JavaScript | 976 |

No test files, package manifests, module directories, documentation or CI workflow files appear in the inspected tree.

## 2. Exact source measurements

The fetched UTF-8 text of `accretion.html` measures:

| Metric | Value |
|---|---:|
| Characters | 976 |
| Non-whitespace characters | 942 |

The repository tree reports a blob size of 976 bytes. The content is ASCII, so byte and character counts coincide for this file.

## 3. Implemented behaviour

The current file is a compact canvas particle simulation:
- Creates 800 randomly positioned particles.
- Gives each particle position, two velocity components and mass.
- Applies small random velocity perturbations with damping.
- Iterates pairwise over particles.
- Applies distance-dependent attraction/repulsion within a cutoff.
- Merges close particles, conserving mass and using mass-weighted position and velocity for the merge.
- Renders particles as circles whose radius scales with the square root of mass.
- Runs continuously through `requestAnimationFrame`.

This is a real executable prototype, but it is not yet the agreed general-purpose artificial-life substrate.

## 4. Specification coverage

| Architectural capability | Live source status |
|---|---|
| GolfCore universal operations | Not implemented as a distinct kernel |
| Generic entity header/payload model | Not present; particles are plain objects with fixed fields |
| Generic state containers and ownership relations | Not present |
| Shared/global/derived/transient lifecycle semantics | Not present |
| Generic relation representation | Not present |
| Declarative rule data/evaluator | Not present; simulation logic is imperative inline code |
| Event-triggered rule evaluation | Not present |
| Deterministic execution phases/conflict policy | Not present |
| Constraint validation and atomic transformation contract | Not present; particle merge is directly mutated in the pair loop |
| Approximate conservation policy and diagnostics | Some mass/momentum-style weighted merge behaviour exists, but no declared tolerance or accounting |
| Replaceable physics/chemistry/biology modules | Not present |
| Statistical, seeded, perturbation and intervention testing | Not present |
| Causal histories and lineage tracking | Not present |
| Automated tests/CI | No test or workflow files found in the inspected tree |

"Not present" means absent from the inspected repository tree and source file, not proof that no untracked local work exists.

## 5. Measurement discrepancy

The historical project record listed `accretion.html` at 3,179 characters and 3,087 non-whitespace characters. The live `main` version is 976 characters and 942 non-whitespace characters.

| Measurement | Historical report | Live main |
|---|---:|---:|
| Characters | 3,179 | 976 |
| Non-whitespace | 3,087 | 942 |

These values describe different snapshots or measurement scopes. The live GitHub file is the baseline for this audit. Do not merge the historical and live measurements into one trend line without locating the earlier snapshot.

## 6. Risks and implementation implications

1. The current pairwise loop mutates and splices the particle array during iteration. This is compact but makes update ordering and collision/merge semantics difficult to reason about.
2. Randomness is implicit through global `Math.random`, so runs are not reproducible from a seed.
3. The particle record is a fixed domain-specific object rather than a generic entity with payloads.
4. Physics, state mutation, merging and rendering are coupled in one animation callback.
5. No tests currently protect interaction, merge, conservation approximation, resizing or rendering assumptions.
6. The source is a useful visual/behavioural seed, not an implementation of the new architecture.

## 7. Recommended implementation sequence

1. Preserve the current simulation's visible baseline while extracting a tiny GolfCore vocabulary.
2. Introduce generic entity identity and extensible payloads without forcing domain fields into the common header.
3. Add generic state containers and explicit relations/lifecycle ownership.
4. Express particle interactions as declarative rules interpreted by a small evaluator.
5. Define deterministic phases, state snapshots, staged effects and atomic commits.
6. Move particle-specific laws into a replaceable physics policy.
7. Add seeded randomness and small tests for the kernel and particle behaviour.
8. Add chemistry and biology only after the shared contracts are tested.

## 8. Audit boundary

This is a static source/tree audit. No browser runtime, performance benchmark, test suite or CI run was available in this repository snapshot. Do not describe those as verified.
