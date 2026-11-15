# Organoids Project Status

**Snapshot:** 15 November 2026  
**Implementation branch:** feat/four-stage-emergence-completion  
**Base:** PR #5 head d0b2059784bce916daf183b73acd3d381ca91ed1  
**PR #5:** open and unmerged; this implementation remains on a separate stacked branch.

## 1. Executive status

The four requested stages have reusable implementations and automated behavioural coverage. The runtime and progression module share the existing entity, relation, energy, field, topology, constraint, reaction and scheduling systems. The final consolidation pass removed the bespoke demo merge path and redundant mutable metrics, and moved incomplete construction paths behind atomic transactions.

The older project status and source audit were stale. main and PR #5 have been inspected separately; see SOURCE_MAPPED_AUDIT.md. The feature catalogue now maps capabilities to current source and tests.

## 2. Four-stage implementation status

| Stage | Implemented work | Verification | Remaining boundary |
|---|---|---|---|
| 1. Substrate | StateOwner facade; validated entity creation; transactional entity/lifecycle/material state; module contracts; AtomicExecutor; deterministic event queue/router; GolfCore evaluator | Automated rollback, ownership and ordering tests | Legacy public payloads are not fully encapsulated; event dependency indexing and whole-tick rollback remain |
| 2. Emergence | Contact aggregation, bonding, molecular assembly, polymerisation with energy cost, autocatalytic network assembly/rule registration, atomic lipid-ring membranes and protocells | Automated composition, energy and rollback tests | No fluid bilayer, selective membrane transport or protocell metabolism |
| 3. Biology | Seeded replication/mutation, heredity, growth, reproduction with daughter membrane, colonies, differentiation and radial/bilateral morphogenesis | Automated lifecycle, energy, lineage and morphology tests | No gene expression/regulatory network, complete organelle partitioning or endogenous morphogen development |
| 4. Evidence | Seeded experiments, energy/field/knockout/mutation interventions, reaction and biological lineage, replicate sweeps, descriptive/bootstrap statistics, blind coded experiments with preregistered metrics | Automated reproducibility, intervention, lineage, bootstrap and blinding tests | Large parameter sweeps and stronger statistical inference remain |

These are operational artificial-life primitives, not claims of complete biological fidelity. A discrete lipid ring is not a fluid bilayer; sequence mutation is not gene expression; explicit phenotype assignment is not developmental regulation.

## 3. Source of truth

| Path | Responsibility |
|---|---|
| accretion.html | Shared runtime, GolfCore, EntityStore, energy/field/physics/reaction services, browser prototype and module bootstrap |
| src/emergence.js | State ownership facade, contracts, lifecycle, emergence progression, event routing, lineage and experiment harness |
| tests/emergence.test.js | Existing inline runtime regression suite |
| tests/emergence-progression.test.js | Four-stage progression, rollback, blind experiment and statistical tests |
| scripts/check-inline.mjs | Syntax validation of the complete inline browser module |
| docs/organoids/FEATURES.md | Capability catalogue with source and evidence |
| docs/organoids/SOURCE_MAPPED_AUDIT.md | Independent main/PR #5 audit and current source map |
| docs/organoids/POST_COMPLETION_REVIEW.md | Redundancy removal and abstraction review |
| docs/EMERGENCE.md | Runtime architecture and execution guarantees |

## 4. Main versus PR #5

- main at fcc24e222a59bfc872c649bf62a6b5b80a342462: accretion.html 24,977 characters; stale tests/core.test.js remains; older feature/status/source-audit documents incorrectly describe the former 976-character prototype.
- PR #5 at d0b2059784bce916daf183b73acd3d381ca91ed1: five commits ahead, zero behind; accretion.html 35,243 characters; removes the stale CommonJS suite and obsolete syntax-check step; updates docs/EMERGENCE.md but explicitly leaves biology and experiments as future work.
- This implementation branch is based on PR #5, does not modify or merge PR #5, and adds the four-stage progression plus the refreshed source-mapped documents.

## 5. Final automated verification

**97 / 97 tests passed.**

- GitHub Actions run 372 at 3298419a729315b849dcb8f5071a54db240e2e62: npm test passed, 97 tests, 0 failures.
- scripts/check-inline.mjs parsed the complete inline browser module successfully.
- The final test suite covers substrate contracts, transactional rollback, typed material ownership, energy accounting, aggregation, molecular formation, polymerisation, autocatalytic networks, membranes, protocells, replication, heredity, growth, reproduction, colonies, differentiation, morphogenesis, event routing, seeded experiments, interventions, reaction lineage, bootstrap statistics, blind experiments and the GolfCore byte-budget assertion.
- Browser rendering and sustained-load behaviour remain unverified until exercised in an actual browser.

## 6. Measured source footprint

| Artifact | Main | PR #5 | Completion branch |
|---|---:|---:|---:|
| accretion.html characters | 24,977 | 35,243 | 36,472 |
| accretion.html non-whitespace | 24,516 | 34,563 | 35,756 |
| pre-refactor src/emergence.js characters / non-whitespace | — | — | 38,607 / 37,560 |
| tests/emergence-progression.test.js characters / non-whitespace | — | — | 20,242 / 19,704 |
| GolfCore evaluator | — | — | 552 ASCII bytes / 538 non-whitespace |

GolfCore is slightly below the approximate 600–700-byte target; it was not padded to meet a number. EntityStore owns validated transactional commits.

## 7. Remaining risks and follow-on work

1. Enforce state ownership across all legacy public entity writes, not only through the StateOwner facade and owning engines.
2. Add dependency indexing and automatic event subscriptions for every legacy GolfCore/RuleEngine module.
3. Decide whether whole-tick rollback is required beyond per-operation/per-rule/per-module atomicity.
4. Add membrane transport, selective permeability and protocell metabolic flux.
5. Extend sequence-string heredity into genotype/phenotype, expression and regulatory networks.
6. Implement resource-limited growth and true fission with material/organelle partition policies.
7. Replace explicit differentiation/morphogenesis policies with field-driven developmental dynamics.
8. Expand replicate sweeps, distributional tests and uncertainty analysis.
9. Exercise the browser build on desktop/mobile and run sustained-load profiling.

## 8. Reporting discipline

Keep source measurements, CI results and browser observations tied to exact commits. Do not carry forward historical counts as current measurements. Do not describe a bounded primitive as a full biological model. See SOURCE_MAPPED_AUDIT.md for the complete audit, FEATURES.md for capability evidence and POST_COMPLETION_REVIEW.md for the final consolidation review.

## 9. Modularization status

The former single emergence source has been extracted into focused ES modules under `src/emergence/`. The public `src/emergence.js` entry remains as a compatibility barrel. Aggregation, molecular assembly, membranes, heredity, organismal behaviour, development, lifecycle, lineage, event routing, state ownership, execution and experiments now have separate source boundaries. The old combined biology module was deleted after its responsibilities were separated.

The source split is complete at the current domain boundaries. Final refactor CI run 43708650558 passed 98/98 tests (0 failures) on final commit ff22fb31b15898bcb4e3535e8e51b725473bf66e. Browser and sustained-load verification remain unperformed. See MODULARITY.md.


## 10. Modular source footprint

The compatibility entry `src/emergence.js` is now 38 bytes. The 19 implementation files under `src/emergence/` total 41,629 bytes; with the 38-byte compatibility entry, the full modular source totals 41,667 bytes. The largest leaf is the experiment harness at 6,476 bytes. The progression composition root is 4,472 bytes. This is a modest size cost versus the former single-file source in exchange for explicit ownership, domain boundaries and stable interoperability contracts; it is not claimed as byte compression.
