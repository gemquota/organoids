# Organoids

A generative physics and artificial-life simulation exploring organisation from particles through molecular assemblies, protocells, cells and colonies.

- [Live prototype](./accretion.html)
- [Unified runtime architecture](./docs/EMERGENCE.md)
- [Reusable emergence and biology module](./src/emergence.js)
- [Canonical feature catalogue, verification and roadmap](./docs/organoids/FEATURES.md)
- [Modular architecture and contracts](./docs/organoids/MODULARITY.md)
- [Post-completion review](./docs/organoids/POST_COMPLETION_REVIEW.md)

## Development

Run the automated runtime and progression tests:

    npm test

The inline runtime in accretion.html owns entities, relations, fields, energy, physics, reactions and scheduling. src/emergence.js is the stable compatibility entry for focused modules under src/emergence/. Those modules build reusable aggregation, molecular assembly, membrane physiology, heredity, gene regulation, organismal behaviour, development and seeded experiment policies on the shared runtime authorities. The feature catalogue is the single source of truth for status, source mapping, test evidence and the proposed backlog.

Browser rendering and sustained-load behaviour must be verified separately from Node tests.
