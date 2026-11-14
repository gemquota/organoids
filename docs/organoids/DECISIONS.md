# Organoids Decisions and Constraints

**Last consolidated:** 14 November 2026

This document records project boundaries and architecture decisions. A decision marked **recommended** resolves an unanswered question provisionally; it is not represented as a user-confirmed choice.

## Identity and lineage

1. Organoids is the successor, not sequel, to VEPA.
2. Organoids carries forward VEPA's architectural lineage and generalisation philosophy.
3. GolfCore and the approximately 600–700-byte minimal functional core philosophy belong to Organoids.
4. Organoids is an artificial-life software simulation, not a real-world organoid brain development project.

## Repository and implementation boundaries

5. `accretion.html` is identified in project discussion as the central Organoids artifact.
6. `emergence.js` is a historical/previous implementation attempt whose exact current status must be verified.
7. The intended direction is one coherent architecture, not parallel competing implementations.
8. No Boids code, dependencies, inherited implementation or cross-project changes may enter Organoids.
9. Boids-related concepts may only be independently re-expressed where they fit Organoids' own architecture.
10. Mocean and NEXUS Aquarium remain separate projects.

## Confirmed architecture decisions

11. **GolfCore:** minimal universal execution kernel comprising entities, state, relations and operations; higher-level functionality is composable data.
12. **Entity schema:** minimal common header plus extensible, composable payloads.
13. **State model:** generic state containers and relationship-determined ownership, governed by lifecycle. Intrinsic state remains local; shared/global state is shared; derived state is recomputed; transient state expires with its operation/step.
14. **Transformations:** combine constraints, validation and atomic commits. Invalid transformations must not leave partial state.
15. **Physical invariants:** approximate conservation is preferred to strict conservation everywhere, prioritising emergence and performance. Numerical drift must still be bounded and meaningful sources/sinks and tolerances made observable.
16. **Universalisation:** universal primitives with specialised policies/extensions; generalise mechanisms after demonstrated semantic reuse across multiple domains.
17. **Modules:** support replaceable physics, chemistry and biology modules, but define boundaries by stable contracts and independent testability. Start with the smallest independently testable primitive and combine only where a real boundary exists.
18. **Emergence testing:** use statistical observation, seeded experiments, perturbations, interventions, blind tests and causal/lineage histories, with minimal assumptions about valid outcomes.

## Confirmed rule and execution decisions

19. **Rules:** use a lightweight hybrid of declarative data, shared evaluation, event-triggered evaluation where dependencies are known, and deterministic phases/priorities for conflicts. Rules are data by default and become entities only when they need identity, lifecycle, state or relationships. The user explicitly approved this recommendation on 14 November 2026.
20. The rule execution contract must specify read snapshots, effect ordering, conflict resolution, event handling, commit timing and reproducible stochastic behaviour before implementation is considered stable.

## Engineering and reporting

21. Estimates and measurements must be labelled separately.
22. Preserve both total and non-whitespace character counts.
23. Every consolidation pass must include before/after counts.
24. A feature is not complete merely because it has been proposed, discussed or documented.
25. Report tests and runtime verification accurately.
26. Keep unresolved questions visible instead of silently choosing an unsupported implementation.

## Change control

When a proposed change conflicts with these decisions, reconcile the conflict before implementing it. Do not solve a missing Organoids capability by importing another project's implementation.
