# Organoids Consolidated Architecture Specification

**Date:** 14 November 2026  
**Authority:** consolidated from the user's nine architectural selections and subsequent explicit approval of the proposed rule model.

## Executive model

Organoids uses a minimal universal execution kernel, generic entities with extensible payloads, relationship/lifecycle-based state ownership, safe atomic transformations, approximate physical conservation, specialised domain policies, replaceable modules and outcome-neutral emergence testing.

The central design rule is: **share mechanisms when their semantics are genuinely common; preserve specialised meaning in policies and extensions.**

## 1. GolfCore

GolfCore is the minimal universal execution kernel. Its conceptual primitives are entities, state, relations and operations. Higher-level functionality is composed from data and operations over those primitives.

The kernel must not absorb physics, chemistry, biology, rendering, observation or organism-specific logic. Its exact primitive list and approximately 600–700-byte target must be measured against the implementation.

## 2. Entities

Every entity has a minimal common header for universal identity/addressing and extensible composable payloads for domain-specific data. Composition and relationships, not a privileged organism class hierarchy, represent structures from particles through colonies.

## 3. State

Use generic state containers and relationships as the representation. Lifecycle determines ownership:
- Local/intrinsic state belongs to the entity whose lifecycle it describes.
- Shared/global state belongs to an explicitly shared context/container.
- Derived state is recomputed from authoritative inputs and has identifiable dependencies/invalidation.
- Transient state expires with its operation or simulation step.

This reconciles the user's state choices D and E: E is the generic representation; D is the ownership policy.

## 4. Rules

**Confirmed decision:** a lightweight hybrid. Rules are declarative data interpreted by a shared evaluator. Trigger them from relevant events when dependencies are known; use deterministic phases/priorities where conflicts require ordering. Domain modules supply specialised predicates/effects. Rules become entities only when they need identity, lifecycle, independent state or relationships.

The concrete execution defaults are specified in [EXECUTION_SEMANTICS.md](EXECUTION_SEMANTICS.md): per-rule snapshots, staged atomic effects, deterministic ordering, explicit conflict rejection, phase-boundary event queues and seeded randomness.

## 5. Transformations

Validate constraints and preconditions before mutation. Stage changes, then atomically commit or reject. Invalid transformations leave no partial changes. Domain policies define validity; GolfCore provides generic execution semantics.

## 6. Physical invariants

Use approximate conservation to prioritise emergent behaviour and performance. Bound numerical drift with declared tolerances, meaningful source/sink accounting and diagnostics. Apply stricter invariants only where a particular model requires them.

## 7. Universal versus specialised

Use universal primitives with specialised policies and extensions. Generalise after demonstrating semantic reuse across domains. Similar syntax or shape is insufficient evidence. This reconciles broad universalisation (B), demonstrated reuse (D) and universal primitives with specialised policies (E): universalisation is an investigation goal, while semantic equivalence is the admission test.

## 8. Modules

Support independently replaceable physics, chemistry and biology modules. Actual boundaries follow stable contracts and independent testability, not labels alone. Start with the smallest independently testable primitive; combine only where a real responsibility or contract boundary exists.

## 9. Emergence and evidence

Use statistical measurements, seeded reproducible runs, perturbations, interventions, blind tests with predefined metrics, and causal histories/lineage. Metrics describe outcomes rather than encode a desired organism, morphology or population curve. Unexpected outcomes are evidence to inspect, not automatically failures.

## 10. Research trajectory

The intended emergence ladder is particles → structures → compounds → protocells → organisms → colonies. It is a research trajectory, not a scripted guarantee for every run.

## 11. Implementation gates

1. Reconcile `accretion.html` and historical `emergence.js`.
2. Map every contract to source and tests.
3. Verify GolfCore's exact operations and size.
4. Define entity, state, relation and transformation semantics.
5. Confirm or revise the provisional rule model.
6. Specify numerical tolerances and module contracts.
7. Test primitive behaviour and cross-module interoperability.
8. Run seeded, perturbation, intervention and blind emergence experiments.

A documented capability is not an implemented capability. Mark features complete only with source, contract, passing tests and runtime evidence.
