# Organoids

Organoids is an artificial-life and emergence sandbox exploring how organisation can build from physical interactions through molecular assemblies, protocells, cells, organisms and larger collective systems. It is an abstract simulation, not a scientifically validated origin-of-life model.

## The two experiences

- **[Organoids simulation](https://gemquota.github.io/organoids/)** — the live accretion and emergence world. Its entity catalogue is shared with the guide; select an entity, build its precursor pathway, or seed all 49 catalogue entities into the world.
- **[The Hitchhiker's Guide to Emergence](https://gemquota.github.io/organoids/hitchhikers-guide.html)** — the 49-entity reference, with category artwork, evidence labels, mechanisms and relationship maps.

The guide and simulation use the same source data in `src/emergence/catalogue.js`. The deployment publishes only these two browser experiences and their required runtime and artwork. Historical experiments and archived atlas files remain in the repository but are not published as live destinations.

## Development

```sh
npm test
node scripts/check-inline.mjs
```

The simulation runtime is implemented in `accretion.html` and focused modules under `src/emergence/`. Catalogue entities are first-class runtime entities with category colour, scale, tags, artwork identity and explicit `emerges-from` relationships to their precursors.
