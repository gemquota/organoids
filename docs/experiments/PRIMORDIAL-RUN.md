# Deterministic primordial chemistry run

`scripts/primordial-run.mjs` executes the same primordial particle initialization and emergence modules as the Accretion simulation, but without browser frame timing. It uses a seeded random stream and a fixed one-tick integration step, then emits machine-readable JSON snapshots.

## Run

```sh
npm run experiment:primordial -- --steps=120 --sampleEvery=15 --seed=20261115 --spread=0.02 --populationScale=6 --physicsEvery=4 --smallNucleusFraction=0.3 --fusionRadius=420 --fusionProbability=1 --minFusionAtomicNumber=2 --atomizationDelay=40 --atomizationRadius=420 --output=/tmp/primordial.json
```

Optional initial-condition controls:

- `--spread=1`: distribute primordial particles across the full world, matching the browser's uniform initial field. Smaller values create a denser central primordial cloud without injecting any preassembled nuclei, atoms, molecules or biological products.
- `--fusionProbability=1`: per-eligible-pair fusion probability; lower values make the stochastic pathway sparser.
- `--minFusionAtomicNumber=2`: prevent hydrogen-only fusion; hydrogen can still fuse with a heavier isotope. This keeps hydrogen available for capture reactions that produce odd-Z nuclei.
- `--fusionRadius=80`: base fusion search radius before world scaling.
- `--atomizationDelay=40`: isotope maturation window. Once this age is reached, the isotope is protected from further fusion and can atomise.
- `--atomizationRadius=420`: electron-capture search radius in unscaled simulation units.
- `--populationScale=1`: scales the initial quark, gluon and electron counts together; this changes primordial abundance, not the identity of supplied products. Reaction product ceilings scale with this abundance.
- `--physicsEvery=1`: run full spatial physics each tick. Higher values run spatial movement/force integration less often while still advancing scheduler, chemistry and biological time every tick; use this only for accelerated offline experiments.
- `--smallNucleusFraction=0.2`: fraction of proton seeds left as hydrogen nuclei rather than immediately bound into helium-sized seeds.
- The experiment uses a globally prioritised fusion-channel network (He+He, Be+Be, H+He, He+Be, Li+Be, N+O). Global channel priority prevents early reactants from consuming intermediates needed by later reactions. Per-tick limits and run-wide product ceilings prevent a single reaction from consuming every shared intermediate. The experiment delays atomisation until nuclei have had time to participate in downstream fusion reactions. `physicsEvery=4` accelerates this offline chemistry-focused run without skipping reaction, scheduler or maturation ticks; use `physicsEvery=1` for the fully coupled baseline. Product ceilings reserve beryllium for all three required branches: oxygen (Be+Be), carbon (He+Be), and nitrogen (Li+Be), before nitrogen and oxygen can form phosphorus. These are actual fusion events between existing isotope entities, not injected elements. Channel totals are included in `atomicFusion.channelProducts`. The runner measures its own initial energy baseline after spawning, so scaled populations still receive a valid conservation audit.

The atomic pathway now partitions dense nucleon clouds into proton-bearing seed nuclei of at most four nucleons (normally up to two protons and two neutrons). Subsequent nucleon accretion is capped at Z=2 and mass number 4 in the integrated primordial pass, leaving heavier-element growth to isotope fusion instead of allowing one isotope to vacuum up the entire local nucleon supply. The constrained experiment schedules reaction channels globally rather than iterating through isotopes and greedily consuming the first available partner. Candidate pairs within each channel are chosen by distance, while channel order preserves the intermediates needed by downstream reactions. Unconstrained sandbox fusion retains its lowest-product-Z preference.

The molecular pass prioritises nucleobases, ribose, phosphate and nucleotide condensation before amphiphiles and generic organics. This prevents low-priority molecules such as glycine from consuming the limited feedstock needed to build the RNA backbone.

Mature isotopes now capture available electrons before the next fusion pass. Isotopes remain fusible during their atomization delay, but once mature they are allowed to become atoms instead of being consumed by another fusion attempt on the same tick. The runner preserves the browser's seeded spawn ordering, world dimensions, force/interactions, chemistry pass ordering, membrane assembly, and energy bookkeeping; `populationScale` deliberately changes initial particle abundance. It disables generic GolfCore and declarative-rule scheduler phases because this experiment calls the chemistry pathways directly; scheduler time and ticks still advance, and `biology.tick` still runs. It records all atoms including atoms nested inside compounds, plus free-atom inventory, recipe-level global/local feedstock availability, intermediate/product counts, connected lipid-cluster sizes, stage blockers, lineage metrics and the energy audit.

## Interpretation

The run is a diagnostic experiment, not a guarantee that the current physical model reaches every pathway. A successful end-to-end demonstration requires measured accumulation of C, N, O and P, followed by ribose, phosphoric acid, nucleotide precursors, condensed ribonucleotides, phosphodiester-linked RNA, lipid bilayers and (where a compatible genome is present) protocells. A stage is not considered successful merely because a later entity was manually seeded. Use the `blockers` and `pathwayDiagnostics` sections to identify the earliest failed transition.

The default `spread=1` run is the browser-matching baseline. A smaller spread is an explicit density sensitivity experiment and must be reported separately rather than presented as the default world outcome. The run-wide phosphorus cap deliberately leaves nitrogen and oxygen isotopes available for atomisation instead of consuming every one into phosphorus. The runner also reports `atomization` readiness separately from fusion eligibility, including isotopes waiting for nearby electrons. The browser simulation uses the same reaction network and isotope maturation rules at its normal population; the higher population scale is an explicit offline density experiment, not a claim about the sparse default world.
