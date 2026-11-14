# Organoids Architecture

**Status:** consolidated target architecture; implementation mapping remains pending source verification.
**Decision basis:** user-confirmed selections from the nine-question architecture review, 14 November 2026.

## 1. Architectural objective

Build one compact, composable substrate capable of representing and evolving multiple levels of organisation. Avoid bespoke systems for particles, compounds, cells, organisms and colonies where shared semantics genuinely apply.

The governing principle is: **universal primitives, specialised policies, and abstraction justified by demonstrated semantic reuse.**

## 2. GolfCore: minimal universal execution kernel

GolfCore is the smallest useful execution substrate, with an approximately 600–700-byte design target/philosophy. The target is a constraint and design instrument, not permission to omit necessary semantics or cram domain logic into the kernel.

The kernel's conceptual vocabulary is:
- **Entities:** identifiable participants in the system.
- **State:** values associated with entities or shared contexts.
- **Relations:** links expressing ownership, reference, composition, dependency or interaction.
- **Operations:** the minimal generic means to inspect and transform state and relations.

Everything else should be expressed as composable data and higher-level operations built on this substrate. Physics, chemistry, biology, rendering, observation and domain-specific policies are not intrinsic GolfCore responsibilities.

The exact primitive list and byte count must be established from the authoritative implementation, not inferred from this conceptual contract.

## 3. Canonical entity model

Use a **minimal common header plus extensible, composable payloads**.

The common header should contain only fields required for universal identity and addressing. Domain-specific properties belong in payloads/components or referenced state containers. Composition must not require a privileged organism hierarchy: particles, structures, compounds, cells and colonies should be representable through the same entity and relation machinery.

Payloads may be specialised, nested or shared. Their interpretation is defined by stable contracts, not by expanding the universal header every time a new domain appears.

## 4. State ownership and lifecycle

Use generic state containers and relationships as the representation model, with lifecycle-based ownership as the governing policy. These are complementary decisions, not competing schemas.

- **Local/intrinsic state:** owned by the entity whose identity and lifecycle it describes.
- **Shared/global state:** owned by a shared context, field or explicitly shared container; entities reference it rather than duplicating it.
- **Derived state:** computed from authoritative state and dependencies; it is cacheable but must not silently become a second source of truth.
- **Transient state:** scoped to an operation, evaluation or simulation step and discarded when its lifecycle ends.

Ownership follows relationships and lifetime, not a hard-coded list of entity classes. A field may own environmental state; an engine may calculate derived values; neither should become an implicit owner of unrelated intrinsic entity state.

Derived values need identifiable inputs and invalidation/recomputation rules. Shared state needs explicit ownership and access semantics. Avoid global mutable state merely because it is convenient.

## 5. Rules and execution semantics

**Status:** confirmed by the user on 14 November 2026.

Use a lightweight hybrid:
1. Rules are primarily declarative data describing conditions, operations/effects, constraints and optional scheduling metadata.
2. A shared evaluator interprets those descriptions.
3. Event-triggered evaluation is available where dependencies are known and reliable.
4. Deterministic phases or priorities resolve conflicts and operations that require ordering.
5. Domain modules may provide specialised predicates/effects through contracts without changing GolfCore.
6. Rules become full entities only when they need independent identity, lifecycle, state or relationships.

Do not require every rule to be an entity. Do not make every operation event-driven. Do not rely on unspecified iteration order.

The concrete proposed defaults are specified in [EXECUTION_SEMANTICS.md](EXECUTION_SEMANTICS.md): per-rule snapshots, staged atomic effects, deterministic phase/priority/order, explicit conflict rejection, phase-boundary event queues and seeded randomness. Treat these as the implementation contract unless a later test or measured requirement demonstrates a necessary revision.

## 6. Safe composition and transformation

Combine constraints, validation and atomic commits:
- Check preconditions, type/shape compatibility and domain constraints before mutation.
- Stage proposed changes separately from authoritative state.
- Commit a valid change as one logical operation.
- Reject invalid changes without leaving partial mutations.
- Make postconditions and emitted events explicit.
- Keep domain-specific validity policies outside GolfCore.

Transactions or rollback may be implementation techniques, but the externally visible contract is atomic success or no change.

## 7. Physical quantities and conservation

The selected policy is **approximate conservation**, prioritising emergent behaviour and performance over strict conservation in every subsystem.

This is not permission for unbounded numerical drift. Domain modules should declare relevant quantities, tolerances, numerical assumptions and meaningful sources/sinks. Track errors where they materially affect interpretation. Apply stricter invariants selectively when a mechanism requires them; do not impose a universal energy-only accounting model on unrelated quantities.

## 8. Universal primitives and specialised policies

Use universal primitives with specialised policies and extensions. Generalise a mechanism after demonstrating semantic reuse across multiple domains. Broad universalisation is an exploration goal, not a mandate to flatten distinct meanings.

Examples:
- A shared transformation mechanism may support reactions, growth and structural change.
- Chemistry, biology and physics retain their own validity rules and interpretations.
- A common relation representation does not imply every relation has identical semantics.
- Similar-looking code is not sufficient evidence for a shared abstraction; the invariant meaning must match.

Prefer the smallest abstraction that captures the proven common semantics. Keep specialised behaviour behind stable extension contracts.

## 9. Module boundaries

Support independently replaceable physics, chemistry and biology modules, while defining actual boundaries by stable contracts and independent testability.

Use the smallest independently testable primitive as the starting unit. Combine primitives into modules only when a real responsibility, lifecycle or contract boundary exists. Do not split code merely to create folders, nor fuse independent responsibilities merely to reduce file count.

The shared kernel and contracts should allow alternative domain implementations without changing unrelated modules. Interoperability means agreement on identity, state, relations, units, constraints, operation semantics and lifecycle, not simply the ability to call another module's functions.

## 10. Emergence: observation and tests

Use all of the following while making minimal assumptions about what valid emergence looks like:
- Statistical measurements of populations, structures, diversity and distributions.
- Seeded reproducible experiments.
- Perturbation experiments.
- Intervention tests that remove or alter mechanisms.
- Blind tests with metrics defined before observing outcomes.
- Causal histories, event traces and lineage tracking.

Metrics should characterise outcomes rather than encode a required organism, shape, population curve or evolutionary endpoint. Distinguish observation from optimisation targets. Preserve unexpected outcomes for analysis rather than automatically classifying them as failures.

## 11. Conceptual emergence ladder

The intended progression remains:

`particles → structures → compounds → protocells → organisms → colonies`

This is a research trajectory, not a scripted sequence or a requirement that every run produce every stage. Each transition should be attributable to interactions, composition, constraints, energy/resource flows and rule evaluation on the shared substrate.

## 12. Consolidation and implementation strategy

For each candidate abstraction:
1. Identify implementations and consumers.
2. Compare semantics, not just syntax.
3. Identify the true invariant.
4. Define the smallest shared primitive or contract.
5. Keep domain-specific policies specialised.
6. Migrate consumers and remove obsolete duplication.
7. Test local behaviour and cross-module interoperability.
8. Measure source size and complexity before/after.

Golfing remains a design instrument: compress repetition, remove redundant state and simplify control paths. Do not sacrifice correctness, inspectability, reproducibility or stable contracts for a smaller character count.

## 13. Source-of-truth policy

Project discussion identifies `accretion.html` as the central artifact. The relationship to historical `emergence.js` still requires source-level reconciliation. The intended end state is one coherent architecture, not competing implementations.

## 14. Open implementation questions

- Exact GolfCore primitive list and verified byte count.
- Exact minimal entity header and payload encoding.
- Concrete ownership/reference representation and derived-state invalidation.
- Rule snapshot, conflict, phase, event and commit semantics.
- Numerical tolerances and accounting policy by physical quantity.
- Module contracts and dependency direction.
- Reproducibility and observability implementation.
- Mapping of this specification to current source and tests.
