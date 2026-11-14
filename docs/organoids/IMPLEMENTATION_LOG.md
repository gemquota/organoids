# Organoids Implementation Log

## 14 November 2026: GolfCore foundation prototype

**Repository:** [gemquota/organoids](https://github.com/gemquota/organoids)  
**Branch:** `architecture/golfcore-foundation`  
**Pull request:** [#2 - Introduce GolfCore foundation and transactional rule kernel](https://github.com/gemquota/organoids/pull/2)  
**State:** open draft PR; not merged to `main`.

### Implemented in the branch

- Added a 677-character GolfCore block (669 non-whitespace characters).
- Added generic entity records with a minimal `id` / `type` header and extensible `s` payload.
- Added generic relations.
- Added declarative rule registration using predicate/effect operation registries.
- Added deterministic rule ordering by phase, priority and registration order.
- Rule evaluation reads a per-rule entity-array snapshot and stages effects.
- Added atomic commit/reject for staged effects, including invalid-target and duplicate-entity rejection.
- Migrated the particle records to the generic entity representation.
- Expressed particle drift through the rule evaluator.
- Retained pairwise particle interaction as specialised domain logic.
- Recorded particle absorption as a relation and used atomic commit for mass-weighted merging.
- Added `tests/core.test.js` using Node's built-in test runner.

### Verification performed

- 7 GolfCore tests passed.
- Full inline simulation JavaScript passed `node --check`.
- Browser rendering, frame rate and runtime behaviour have not yet been verified.
- The tests exercise the kernel contract, not the full particle simulation or browser environment.

### Character counts

| Artifact | Before | After |
|---|---:|---:|
| `accretion.html` characters | 976 | 1,987 |
| `accretion.html` non-whitespace | 942 | 1,922 |
| GolfCore block characters | n/a | 677 |
| GolfCore block non-whitespace | n/a | 669 |
| `tests/core.test.js` characters | n/a | 2,337 |
| `tests/core.test.js` non-whitespace | n/a | 2,126 |

The source change is an architectural foundation, not completion of the full specification. Generic state ownership, shared state containers, event queues, seeded randomness, replaceable physics/chemistry/biology modules and emergence experiments remain outstanding.
