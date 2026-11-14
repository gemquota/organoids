# Organoids: Project Overview

**Snapshot:** 14 November 2026  
**Project identity:** Organoids  
**Lineage:** VEPA architectural successor  
**Primary artifact identified in project discussion:** `accretion.html`

## 1. Purpose

Organoids is an artificial-life simulation built around a compact, reusable substrate from which increasingly complex structures and behaviours can emerge.

Rather than building a collection of unrelated simulation features, the project aims to establish a common representational and operational foundation. Particles, compounds, protocells, organisms and colonies should be different organisations or states of entities participating in shared rules and interactions.

The goal is not merely to simulate a collection of predefined organisms. It is to create conditions in which organisation, complexity and life-like behaviour arise from general mechanisms.

This is a software simulation project. It does not entail culturing, controlling or developing real biological organoid brains.

## 2. Architectural lineage

Organoids is the successor, not a sequel, to VEPA. It carries forward VEPA's architectural direction and generalisation ambitions while establishing its own implementation and domain.

GolfCore and the approximately 600–700-byte minimal functional core philosophy belong to Organoids.

Boids contributed conceptual discussion around biological and emergent systems, but the implementation boundary is explicit:
- No Boids source code.
- No Boids dependencies.
- No inherited Boids implementation.
- No cross-project modifications.
- Re-express useful general concepts independently inside Organoids.

Mocean and NEXUS Aquarium remain separate projects. Similarities in simulation concepts do not make their implementations part of Organoids.

## 3. Governing principles

1. **Primitive generalisation:** prefer a small number of general mechanisms over feature-specific machinery.
2. **Universal composition:** structures should be assembled from interoperable primitives.
3. **Emergence:** higher-order behaviour should arise from lower-level interactions wherever practical.
4. **Semantic interoperability:** independently developed modules should share compatible representations and contracts.
5. **Progressive abstraction:** consolidate duplicated mechanisms before adding new specialised systems.
6. **Measured optimisation:** record actual source size and behaviour; never present estimates as measurements.
7. **Minimal core, extensible system:** keep the foundational core small without forcing every higher-level capability into it.
8. **Observable behaviour:** features need tests or runtime evidence, not merely descriptive names.
9. **Single coherent architecture:** avoid parallel implementations of the same underlying mechanism.

## 4. Core conceptual progression

The intended emergence ladder is:

`particles → interactions → structures → compounds → protocells → organisms → colonies`

This is a conceptual progression, not a claim that every stage is currently implemented or biologically accurate.

## 5. Development method

The project is being built up from a golfed foundation. Golfing is used to expose unnecessary complexity and reveal reusable primitives, not as an excuse to sacrifice correctness, clarity of semantics or testability.

The expected loop is:

1. Establish a minimal working mechanism.
2. Measure its actual source footprint.
3. Identify duplicated or positional/specialised representations.
4. Generalise the primitive or contract.
5. Consolidate consumers around the shared abstraction.
6. Test semantic equivalence and behaviour.
7. Measure before/after size and complexity.
8. Repeat without expanding scope unnecessarily.

## 6. Definition of success

Organoids should ultimately provide a coherent artificial-life substrate in which new forms of matter, organisation, behaviour and ecology can be expressed through composition and rules rather than a proliferation of bespoke subsystems.
