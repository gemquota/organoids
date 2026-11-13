# Unified emergence substrate

The simulation uses one recursive entity model. A particle, molecule, membrane, protocell or colony is an entity with properties and state; larger structures compose smaller entities and connect them through typed graph relationships.

## Runtime

Import `createRuntime` from `emergence.js`. It composes:

- EntityStore: entity lifecycle, recursive composition, typed links and snapshots.
- SpatialIndex: uniform-grid neighbour queries.
- FieldGrid: named scalar fields and conservative diffusion.
- InteractionEngine: declarative type-pair attraction and repulsion.
- ConstraintEngine: reusable distance constraints.
- EnergyEngine: source, transfer, conversion and dissipation ledger.
- GraphEngine: neighbourhoods, connected components and cycle detection.
- RuleEngine: data-defined reactions with inputs, outputs, catalysts, conditions, rates and energy costs.
- TopologyEngine: structure assembly, division and closure checks.
- Scheduler: ordered update phases.

Example:

```js
const sim=createRuntime({width:800,height:450});
sim.interactions.register({
  id:'cohesion',a:'particle',b:'particle',
  radius:24,strength:.2,mode:'attract'
});
sim.rules.register({
  id:'polymerise',inputs:['monomer','monomer'],
  outputs:[{type:'dimer'}],catalysts:['catalyst'],
  rate:.08,energyCost:.01
});
```

## Emergence ladder

Entities compose into molecules; molecules and polymers form networks and membranes; membranes enclose compartments; compartments plus reaction networks and energy flux form protocell-like systems; division, inheritance, signalling and selection can then operate on the same entity and relationship model.

## Thermodynamic contract

The engine explicitly accounts for energy sources, transfers, conversion losses and dissipation. Sustained organisation requires an external energy flux and an entropy sink; conservative interactions alone cannot sustain it. The current accretion demo supplies a small environmental energy flux and dissipates energy each update.

## Symbol accounting

The previous 710/1,925 estimates were planning estimates, not source-size estimates. In the earlier Boids branch, `emergence.js` contained 12,803 characters (12,350 non-whitespace), roughly 17.4 times the 710-character substrate estimate. That branch's PR was closed unmerged and is not the authoritative Organoids implementation.

For this repository, report actual source size as both UTF-8 bytes and non-whitespace characters, separately from tests and documentation. Do not compare a feature estimate with an entire file unless the measured scope matches.

## Validation

Run `npm test`. The browser prototype is `accretion.html`; it imports the same shared substrate used by tests.
