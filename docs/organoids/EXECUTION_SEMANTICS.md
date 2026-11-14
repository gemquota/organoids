# Organoids Rule and Execution Semantics

**Status:** confirmed hybrid rule architecture, with the concrete defaults below proposed as the implementation contract.
**Parent specification:** SPECIFICATION.md

## 1. Rule representation

A rule is declarative data, not an arbitrary callback bundle. Its record identifies:
- A stable rule identity.
- An execution phase and deterministic priority/order.
- A predicate operation identifier and serialisable arguments.
- An effect operation identifier and serialisable arguments.
- Optional event/dependency declarations.
- Optional domain/owner metadata.

Predicate and effect implementations are registered by domain modules. GolfCore stores and schedules rule descriptions; it does not contain physics, chemistry or biology laws.

Rules are promoted to full entities only when they need independent identity, lifecycle, state or relationships beyond their rule record.

## 2. Evaluation model

- Rules execute in ascending phase, then priority, then stable registration order.
- Each rule evaluation reads a stable snapshot of the entity set and authoritative state at the start of that rule evaluation.
- Predicates inspect the snapshot and may not mutate authoritative state.
- Effects produce proposed changes, not immediate mutations.
- Proposed changes are validated as one transaction for that rule evaluation.
- A valid transaction commits atomically. An invalid transaction is rejected entirely.
- Later rules observe earlier committed transactions. Entities created during a rule evaluation are not added to that rule's snapshot; they become visible to subsequent evaluations after commit.

This gives deterministic sequencing without requiring every rule to read one global frame snapshot. The rule is the transaction boundary.

## 3. Conflict policy

- A transaction containing an invalid target, invalid payload or violated declared constraint is rejected.
- Conflicting writes to the same entity/property within one transaction are rejected unless the operation explicitly declares a deterministic reducer.
- Across transactions, ordering is determined by phase, priority and stable registration order. Later transactions therefore see earlier commits; this is intentional sequential semantics, not accidental array iteration.
- Domain-specific constraints are supplied by the owning module.
- No implicit last-write-wins behaviour is allowed inside a single transaction.

## 4. Event-triggered evaluation

- Rules may declare the event types or state dependencies that activate them.
- Events are emitted only by successful commits.
- Events are queued and processed at defined phase boundaries, never recursively during a mutation.
- Event processing is deterministic: FIFO within a phase, with stable event identity/sequence.
- Duplicate events may be coalesced only when the event contract explicitly declares them equivalent.
- Rules without event dependencies may run on scheduled simulation phases.

This avoids missed updates and uncontrolled recursive cascades while preserving event-driven efficiency.

## 5. Randomness and reproducibility

Random choices are obtained from an explicit seeded simulation context, not ambient global randomness, once deterministic experiments are required. A run records its seed and relevant configuration. The same seed, configuration and execution order should reproduce the same choices within the same supported numerical/runtime envelope.

## 6. Ownership and state visibility

Predicates and effects access state through declared entity payloads, shared state containers and relations. Intrinsic state remains locally owned; shared state has explicit ownership/reference relationships; derived state is recomputed from declared inputs; transient state expires at its lifecycle boundary.

## 7. Required tests

- Rule ordering is stable.
- Predicates cannot mutate authoritative state.
- Invalid transactions leave all state unchanged.
- Conflicting writes are rejected or use an explicitly declared reducer.
- Later rules observe earlier committed changes.
- Newly created entities become visible only at the specified boundary.
- Events are emitted only after successful commits.
- Event queue ordering and coalescing are deterministic.
- Seeded runs reproduce expected state transitions.
- Domain-specific predicates/effects can be replaced without changing GolfCore.
