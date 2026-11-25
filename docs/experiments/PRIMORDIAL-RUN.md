# Deterministic primordial chemistry run

`scripts/primordial-run.mjs` executes the same primordial particle initialization and emergence modules as the Accretion simulation, but without browser frame timing. It uses a seeded random stream and a fixed one-tick integration step, then emits machine-readable JSON snapshots.

## Run

```sh
npm run experiment:primordial -- --steps=12000 --sampleEvery=300 --seed=20261115 --output=/tmp/primordial.json
```

Optional initial-condition controls:

- `--spread=1`: distribute primordial particles across the full world, matching the browser's uniform initial field. Smaller values create a denser central primordial cloud without injecting any preassembled nuclei, atoms, molecules or biological products.
- `--fusionProbability=0.01`: per-eligible-pair fusion probability.
- `--fusionRadius=80`: base fusion search radius before world scaling.
- `--atomizationDelay=180`: minimum simulated time before an isotope can capture electrons and become an atom.
- `--populationScale=1`: scales the initial quark, gluon and electron counts together; this changes primordial abundance, not the identity of supplied products. The runner measures its own initial energy baseline after spawning, so scaled populations still receive a valid conservation audit.

The atomic pathway now partitions dense nucleon clouds into proton-bearing seed nuclei of at most four nucleons (normally up to two protons and two neutrons). Subsequent nucleon accretion is capped at Z=2 and mass number 4 in the integrated primordial pass, leaving heavier-element growth to isotope fusion instead of allowing one isotope to vacuum up the entire local nucleon supply. Fusion candidate selection excludes pairs whose combined atomic number exceeds the supported element ceiling, then favours the lowest combined atomic number before using distance as a tie-breaker. This allows lower-Z intermediates to accumulate before the system consumes its remaining fusion partners into heavier nuclei.

Mature isotopes now capture available electrons before the next fusion pass. Isotopes remain fusible during their atomization delay, but once mature they are allowed to become atoms instead of being consumed by another fusion attempt on the same tick. The runner preserves the browser's initial particle counts, seeded spawn ordering, world dimensions, force/interactions, chemistry pass ordering, membrane assembly, and energy bookkeeping. It records all atoms including atoms nested inside compounds, plus free-atom inventory, recipe-level global/local feedstock availability, intermediate/product counts, connected lipid-cluster sizes, stage blockers, lineage metrics and the energy audit.

## Interpretation

The run is a diagnostic experiment, not a guarantee that the current physical model reaches every pathway. A successful end-to-end demonstration requires measured accumulation of C, N, O and P, followed by ribose, phosphoric acid, nucleotide precursors, condensed ribonucleotides, phosphodiester-linked RNA, lipid bilayers and (where a compatible genome is present) protocells. A stage is not considered successful merely because a later entity was manually seeded. Use the `blockers` and `pathwayDiagnostics` sections to identify the earliest failed transition.

The default `spread=1` run is the browser-matching baseline. A smaller spread is an explicit density sensitivity experiment and must be reported separately rather than presented as the default world outcome. Example density sensitivity run: `npm run experiment:primordial -- --steps=12000 --sampleEvery=300 --spread=0.2 --fusionRadius=420 --fusionProbability=0.01 --atomizationDelay=180 --output=/tmp/primordial-dense.json`.
