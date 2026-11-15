# Organoids

A generative physics and artificial-life simulation exploring organisation from particles through molecular assemblies, protocells, cells and colonies.

- [Live prototype](./accretion.html)
- [Unified runtime architecture](./docs/EMERGENCE.md)
- [Reusable emergence and biology module](./src/emergence.js)
- [Feature catalogue](./docs/organoids/FEATURES.md)
- [Current project status](./docs/organoids/STATUS.md)
- [Source-mapped audit](./docs/organoids/SOURCE_MAPPED_AUDIT.md)
- [Modular architecture and contracts](./docs/organoids/MODULARITY.md)
- [Post-completion review](./docs/organoids/POST_COMPLETION_REVIEW.md)

## Development

Run the automated runtime and progression tests:

    npm test

The inline runtime in accretion.html owns entities, relations, fields, energy, physics, reactions and scheduling. src/emergence.js is the stable compatibility entry for focused modules under src/emergence/. Those modules build reusable aggregation, molecular assembly, membranes, heredity, organismal behaviour, development and seeded experiment policies on the shared runtime authorities.

Browser rendering and sustained-load behaviour must be verified separately from Node tests.
