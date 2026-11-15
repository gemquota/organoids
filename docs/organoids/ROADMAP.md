# Organoids Roadmap

**Snapshot:** 15 November 2026  
**Implementation branch:** feat/four-stage-emergence-completion  
**Status authority:** FEATURES.md and STATUS.md  
**Source audit:** SOURCE_MAPPED_AUDIT.md  
**Post-completion review:** POST_COMPLETION_REVIEW.md

## Delivered four-stage implementation

- **Substrate:** EntityStore transactions, StateOwner facade, lifecycle semantics, typed material ownership, module contracts, AtomicExecutor, deterministic event queue/router, GolfCore and scheduler ordering.
- **Emergence:** reusable aggregation/bonding, molecular formation, polymerisation, autocatalytic network construction/rules, membrane and protocell assembly.
- **Biology:** seeded replication and mutation, heredity, growth, reproduction, colonies, differentiation and morphogenesis.
- **Evidence:** seeded experiments, perturbations/interventions, reaction and biological lineage, descriptive/bootstrap statistics, replicate sweeps and blind coded experiments with preregistered metrics.

The delivered primitives are tested; they are not claims of complete biological fidelity. See FEATURES.md for boundaries and evidence.

## Next work, ordered by contract risk

1. **State encapsulation:** route all legacy public entity payload writes through declared owners and prevent bypasses.
2. **Event dependency indexing:** automatically subscribe rule/module handlers to relevant changes; keep phase ordering deterministic.
3. **Execution scope:** decide whether whole-tick rollback is required beyond the current atomic operation/rule/module boundaries.
4. **Material conservation:** extend typed quantity sources/sinks and audits to mass/charge where scientifically meaningful.
5. **Protocell physiology:** implement selective membrane transport, channels and metabolic flux using the existing FieldGrid/EnergyEngine/RuleEngine owners.
6. **Genotype/phenotype:** replace the sequence-string placeholder with structured loci, expression and regulatory networks.
7. **Development:** add resource-limited growth, true fission/material partitioning, field-driven differentiation and self-organising morphogenesis.
8. **Experimental depth:** add larger parameter sweeps, distributional inference and analysis plans to the blind experiment protocol.
9. **Runtime validation:** browser smoke tests, mobile layout, long-run stability and sustained-load profiling.

## Change discipline

Do not recreate already-delivered primitives under new names. Extend the existing owners and contracts, add tests for rollback/interoperability, update source maps and status, and measure before/after source footprint. PR #5 remains a separate open base branch; do not merge it implicitly.
