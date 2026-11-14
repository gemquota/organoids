# Organoids runtime

Organoids builds emergence from generic entities, relations and operations. A particle, molecule, membrane, protocell or colony uses the same substrate; higher biology is expressed as data and composable rules.

## Kernel and runtime

- **GolfCore:** named predicates/effects, ordered phase/priority rules, staged property patches and atomic commits. Exposed as `runtime.core`.
- **EntityStore:** entity lifecycle, typed links, recursive containment, atomic materialized graph indexes, snapshots and journalled transactions.
- **SpatialIndex:** uniform-grid neighbour queries.
- **InteractionEngine and ConstraintEngine:** attraction/repulsion plus positional constraints; `InteractionEngine` and `ConstraintEngine` are aliases.
- **FieldGrid:** typed scalar fields, conservative diffusion, decay, gradients, advection and cell-level rollback.
- **EnergyEngine:** entity-owned energy and typed material quantities, flux-mediated transfer, conversion and dissipation, spatial reservoirs, and a conservation audit.
- **GraphEngine and TopologyEngine:** components, cycles, assembly and division; `TopologyEngine` is an alias.
- **RuleEngine:** data-defined reactions, catalysts, conditions, rates, products and energy costs.
- **Scheduler:** core rules, reactions and field transport execute in ordered phases.

```js
const sim=createRuntime({width:800,height:450});
sim.core.when('particle',e=>e.type==='particle')
  .then('drift',e=>({e,patch:{x:e.properties.x+1}}))
  .rule(0,'particle','drift');
sim.interactions.register({
  id:'cohesion',a:'particle',b:'particle',
  radius:24,strength:.2,mode:'attract'
});
```

## Emergence path

Aggregation → bonding → molecular formation → reactions → polymerisation → autocatalytic networks → lipid assembly → protocells → replication → cellular reproduction → colonies → differentiation → morphogenesis.

The substrate provides reusable primitives; this list is not a claim that every stage is already implemented.

## Boundaries

The current demo shows particle motion, pair forces, energy flux and aggregation. The later biological stages remain future work. Interpolation-based advection is not strictly conservative. Energy audits only cover flows routed through EnergyEngine and require a baseline. Arbitrary external side effects are outside transaction rollback.

`accretion.html` is the single authoritative runtime and browser prototype. The test suite extracts its engine module directly, so there is no duplicated runtime source. Run `npm test` for the automated checks.
