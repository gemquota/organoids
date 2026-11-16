# Organoids

Organoids is an artificial-life and emergence sandbox. It explores how organisation can build from particles and interactions through molecular assemblies, protocells, cells and colonies. It is an abstract, conceptually educational simulation, not a scientifically validated origin-of-life model.

## Live experiences

The GitHub Pages site is deployed from `main`.

- **[Organoids simulation](https://gemquota.github.io/organoids/)** — the main accretion and emergence sandbox.
- **[Emergent Life Atlas](https://gemquota.github.io/organoids/emergent-life-atlas.html)** — a standalone visual atlas of forms and transitions.
- **[Experiment index](https://gemquota.github.io/organoids/experiments/)** — a directory of the separately hosted interactive experiences and their supporting material.

The current Organoids repository contains two standalone browser experiences: `accretion.html` and `emergent-life-atlas.html`. The reusable experiment harness is a JavaScript module under `src/emergence/experiments.js`, not a third standalone page. The Pages workflow publishes the runtime modules alongside the main simulation so its dynamic import resolves correctly.

### Earlier evolutionary-ecology experiments

These browser experiments remain hosted from the earlier evolutionary-ecology repository. They are linked as research lineage, not copied into this repository:

- [Evolutionary ecology simulation](https://gemquota.github.io/boids/)
- [Emergence lab](https://gemquota.github.io/boids/emergence-lab.html)
- [Plant lab](https://gemquota.github.io/boids/plant-lab.html)
- [Vision lab](https://gemquota.github.io/boids/vision-lab.html)
- [Minimal vision lab](https://gemquota.github.io/boids/vision-minimal.html)

The original repository's GitHub Pages deployment completed successfully on 16 November 2026. These links preserve access to the additional experiments without importing its implementation or dependencies into Organoids.

## Project records

- [Documentation index](docs/README.md)
- [Canonical Organoids feature catalogue](docs/organoids/FEATURES.md)
- [Evolutionary ecology requirements lineage (161-item checklist)](docs/organoids/EVOLUTION_BACKLOG.md)
- [Runtime and emergence architecture](docs/EMERGENCE.md)
- [Architecture decisions](docs/organoids/ARCHITECTURE.md)
- [Execution semantics](docs/organoids/EXECUTION_SEMANTICS.md)
- [Modularity and module contracts](docs/organoids/MODULARITY.md)
- [Project overview](docs/organoids/PROJECT.md)
- [Decision register](docs/organoids/DECISIONS.md)
- [Implementation history](docs/organoids/IMPLEMENTATION_LOG.md)

## Development

Run the automated runtime and progression tests:

```sh
npm test
node scripts/check-inline.mjs
```

The inline runtime in `accretion.html` owns entities, relations, fields, energy, physics, reactions and scheduling. `src/emergence.js` is the stable compatibility entry for focused modules under `src/emergence/`. Those modules provide aggregation, molecular assembly, membrane physiology, heredity, gene regulation, organismal behaviour, development and seeded experiment policies over the shared runtime authorities.

The 161-item evolutionary ecology checklist is preserved as a separate requirements lineage. Its historical 115/161 completion count belongs to the source checklist's earlier workstream; it is not a claim that 115 features are implemented in this repository. Organoids implementation status is maintained separately in the canonical feature catalogue.

Node tests and static module checks do not replace browser smoke tests or sustained-load profiling.
