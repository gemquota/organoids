# Organoids Source Audit

**Audit date:** 15 November 2026  
**Default branch audited separately:** main at fcc24e222a59bfc872c649bf62a6b5b80a342462  
**PR #5 audited separately:** feat/unified-emergence-substrate at d0b2059784bce916daf183b73acd3d381ca91ed1  
**Current implementation:** feat/four-stage-emergence-completion

## Main source inventory

main is not the former one-file 976-character prototype. Its tracked tree includes:
- accretion.html, the inline runtime and browser demo (24,977 text characters).
- emergent-life-atlas.html.
- package.json and the Node test runner.
- tests/emergence.test.js and the stale tests/core.test.js.
- .github/workflows/test.yml.
- docs/EMERGENCE.md and the docs/organoids architecture, feature, status, source-audit and roadmap documents.

The old claim that main contains no tests, package manifest, documentation or CI is false for this snapshot.

## Main implementation map

| Source | Implemented capability |
|---|---|
| accretion.html | EntityStore, GolfCore, SpatialIndex, FieldGrid, InteractionEngine, ConstraintEngine, EnergyEngine, GraphEngine, TopologyEngine, RuleEngine, Scheduler, createRuntime and particle/aggregation demo |
| tests/emergence.test.js | Inline runtime regression coverage |
| tests/core.test.js | Obsolete CommonJS suite for a deleted kernel; it is not the authoritative test path |
| docs/EMERGENCE.md | Partial runtime architecture and progression boundaries |
| docs/organoids/FEATURES.md | Stale feature catalogue |
| docs/organoids/STATUS.md | Stale status snapshot |
| docs/organoids/SOURCE_AUDIT.md | Stale 976-character one-file audit |

## PR #5 delta

PR #5 is five commits ahead of main and zero behind. It changes five paths:
1. .github/workflows/test.yml removes the obsolete emergence.js syntax check.
2. accretion.html adds transaction, relationship-history, energy, field and allocation improvements.
3. docs/EMERGENCE.md expands runtime and conservation notes, and explicitly marks biology as future work.
4. tests/core.test.js is removed.
5. tests/emergence.test.js receives regression coverage.

PR #5 does not change the docs/organoids feature catalogue or status/source-audit documents. Its own updated runtime document correctly acknowledges that polymerisation, autocatalysis, membranes, protocells, replication, heredity, signalling, differentiation and colonies are not demonstrated end-to-end.

## Current completion branch

The separate implementation branch adds src/emergence.js, tests/emergence-progression.test.js and this documentation refresh. It also updates accretion.html to dynamically load the reusable progression module and use its contact-aggregation and molecule-formation methods instead of the bespoke merge callback.

For the complete source-to-feature map, main/PR comparison, exact boundaries and verification gates, see SOURCE_MAPPED_AUDIT.md.
