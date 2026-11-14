# Organoids Roadmap

**Planning snapshot:** 14 November 2026  
**Ordering:** architectural contracts and evidence before feature expansion.

## Phase 1: Establish the real baseline

- [x] Inspect current `accretion.html` (static source audit completed; 976 characters / 942 non-whitespace).
- [ ] Locate and classify `emergence.js`.
- [x] Confirm `gemquota/organoids` `main` contains only `accretion.html`; treat it as the live source baseline pending any undisclosed local work.
- [ ] Inventory current primitives, consumers and duplicated mechanisms.
- [x] Record live character and non-whitespace counts.
- [ ] Identify test commands, coverage and current CI state.
- [ ] Run a baseline runtime smoke test.

**Exit condition:** source-backed inventory with reproducible measurements and verified baseline. Static inventory and size baseline are complete; runtime/test baseline remains open.

## Phase 2: Specify and map the substrate

- [ ] Map the consolidated architecture in ARCHITECTURE.md to source.
- [x] Verify the initial GolfCore primitive slice and byte count (677 characters / 669 non-whitespace on draft PR #2).\n- [ ] Review/merge the foundational PR after browser/runtime verification.
- [ ] Define the minimal entity header and payload contract.
- [ ] Implement generic state containers and lifecycle ownership (generic entities/relations are prototyped on draft PR #2).
- [ ] Define local, shared, derived and transient state semantics.
- [ ] Specify atomic transformation and validation behaviour.
- [x] Prototype declarative rules, per-rule snapshots, deterministic phase/priority order and atomic staged commits (draft PR #2).\n- [ ] Implement event queues, event-triggered activation and seeded randomness.
- [ ] Define quantity-specific tolerances and accounting.
- [ ] Define module contracts and dependency direction.

**Exit condition:** every foundational contract is precise, source-mapped and independently testable. Confirmed rule semantics are specified precisely before implementation is considered stable.

## Phase 3: Consolidation and abstraction

Continue the requested consolidation programme.

- [ ] Compare repeated mechanisms by semantic equivalence.
- [ ] Generalise primitives only where reuse is demonstrated.
- [ ] Preserve specialised policies and domain meaning.
- [ ] Consolidate state, relation, transformation and evaluation mechanisms where contracts genuinely match.
- [ ] Establish stable module interfaces and remove accidental coupling.
- [ ] Eliminate redundant representations and competing implementations.
- [ ] Test local behaviour and cross-module interoperability.

For every pass, publish actual changes and before/after character counts, including non-whitespace counts.

**Exit condition:** measurable reduction in duplication/complexity without semantic regressions or loss of domain meaning.

## Phase 4: Stabilise replaceable modules

- [ ] Establish independently testable physics module.
- [ ] Establish independently testable chemistry module.
- [ ] Establish independently testable biology module.
- [ ] Verify each module can be replaced behind its contract.
- [ ] Verify shared entities, state, relations, units and transformations interoperate.
- [ ] Test bounded numerical error and declared tolerances.
- [ ] Test deterministic scheduling and seeded stochastic behaviour.

**Exit condition:** modules are independently testable and replaceable without hidden shared assumptions.

## Phase 5: Demonstrate emergence

- [ ] Demonstrate particle-level interactions.
- [ ] Demonstrate formation of structures and compounds.
- [ ] Demonstrate protocell-like organisation.
- [ ] Investigate organism/colony organisation.
- [ ] Record causal mechanisms and lineage.
- [ ] Run seeded, perturbed and intervention experiments.
- [ ] Define blind evaluation metrics before examining outcomes.
- [ ] Preserve and analyse unexpected emergent outcomes.

**Exit condition:** reproducible evidence that higher-order behaviour arises from the general substrate rather than hidden scripted outcomes.

## Phase 6: Delivery and maintenance

- [ ] Confirm CI on the authoritative branch.
- [ ] Run regression and runtime checks.
- [ ] Document setup and execution.
- [ ] Keep feature, architecture and status documents current.
- [ ] Record completed consolidation passes and measurements.

## Priority rule

Do not expand the feature catalogue merely to make it longer. First make the substrate smaller, more general, interoperable and verifiably correct. Add higher-order capabilities when the substrate expresses them cleanly.
