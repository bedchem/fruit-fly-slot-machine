# Fruit Fly Slot Machine

A *Drosophila* CT scan sits on a bar stool and plays a one-armed bandit by
itself. Beside it, its own nervous system — 60,000 real neurons at their
measured coordinates — lights up as it plays.

```
npm install
npm run dev
```

The generated assets are committed, so `npm run dev` works straight away.
`npm run assets` rebuilds them from the source models and the connectome dumps.

---

## What is real, and what is a model

This distinction matters, so it is stated plainly here and in the app.

**Real, measured data**

- **The fly.** A micro-CT scan of an adult *Drosophila melanogaster*
  ([etainproject](https://sketchfab.com/3d-models/drosophila-adult-fruit-fly-ct-scan-ad29b897bd2b4e27bb04ab9d31baa117),
  CC BY 4.0). 1.5 M triangles, decimated to 330 k for the browser; its own
  translucent amber material is kept exactly as downloaded.
- **The cabinet.** "Pillar Slots" by
  [local.yany](https://sketchfab.com/3d-models/pillar-slots-91e255e5a95745f4857607b388421ee1),
  CC BY 4.0, with its original textures.
- **The brain.** [MaleCNS v1.0](https://male-cns.janelia.org/download/) —
  FlyEM/HHMI Janelia, University of Cambridge, MRC LMB and Google Research,
  CC BY 4.0. Specifically:
  - 141,781 neurons with curated soma coordinates, of which 60,000 are drawn
  - the curated cell types, classes and left/right identities
  - 151.9 M measured synapses, collapsed to a 1,600-type weight matrix
  - the per-neuron transmitter predictions, which set each edge's sign
  - the real PAM (reward) and PPL1 (punishment) dopaminergic clusters, found
    by their actual type names, not by position

**A model, not a measurement**

- **The activity.** Nobody has recorded a fly playing a slot machine. What runs
  is a rate model over the measured wiring (`src/neural/simulation.js`):

  ```
  drive_i = GAIN · Σ_j W_ij · r_j  +  I_i
  r_i    += (φ(drive_i) − r_i) · dt / τ
  ```

  The game injects current into real populations only — visual types while the
  reels turn, mechanosensory and descending types while the foreleg works the
  handle, the PAM cluster on a payout and PPL1 on a loss, the way an
  optogenetic reinforcement experiment drives them. Where that current spreads,
  and which regions therefore light up, is whatever the connectome does with
  it. None of it is scripted.

  It is a *rate* model on a *type-collapsed* graph, not a spiking simulation of
  individual neurons.

- **The feelings.** Named after what has actually been measured in this animal:

  | Signal | What it is | Source |
  |---|---|---|
  | Dopamine · PAM | appetitive reinforcement; PPL1 carries the negative side | [Burke et al. 2012](https://www.nature.com/articles/nature11614); Aso et al. 2014 |
  | Octopamine | the insect noradrenaline — arousal, and *upstream* of the reward DANs via OAMB | [Burke et al. 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3528794/) |
  | NPF | neuropeptide F, the fly's NPY: satisfaction. Deprivation halves it and low-NPF flies seek harder | [Shohat-Ophir et al. 2012](http://flybase.org/reports/FBrf0217810.html) |
  | Defensive | *not* called fear: a persistent, scalable defensive state that meets the criteria for an emotion primitive | [Gibson et al. 2015](https://www.cell.com/current-biology/fulltext/S0960-9822(15)00411-X) |
  | Judgement bias | a fly in a poor state reads ambiguous cues pessimistically, so this one hesitates longer before spending a credit | [Deakin et al. 2018](https://pubmed.ncbi.nlm.nih.gov/29491031/) |
  | Heart rate | ~270–290 bpm in a young adult, rising under octopaminergic arousal | Paternostro et al. 2001; Ocorr et al. 2007 |

---

## How the fly works the handle

The CT scan has no skeleton, so the foreleg is rigged at load time rather than
animated:

1. `tools/measure-fly.mjs` traces the right foreleg off the mesh and finds the
   coxa, the femur/tibia joint and the tarsus tip. `tools/measure-head.mjs`
   finds the waist between thorax and head.
2. `src/scene/flyRig.js` weights every vertex by a capsule around that
   centreline, and solves a two-bone IK so the tarsus lands *exactly* on the
   lever knob — which is why the grip holds through the whole swing rather than
   floating near it.
3. The deformation runs in the vertex shader, so it costs nothing per frame:
   each frame only solves the IK and writes four quaternions.

The handle itself is a real part of the cabinet. `tools/build-slot.mjs` finds it
by connected component, re-origins it on its measured pivot and emits it as its
own node; the three printed reel strips are deleted and replaced with live
drums at the exact radius, width and centres the build script measured.

A spin is a three-beat action, because that is what the fly has to do: reach for
the knob, haul it **down**, let it spring back **up** — and the reels only break
loose partway through the return.

---

## Sound

Everything is synthesised in the Web Audio graph (`src/audio/audio.js`); there
are no sample files. The reel whir tracks each drum's real angular velocity and
the detents slow down with it, which a looped sample cannot do.

---

## Layout

```
src/
  scene/        the 3D half — fly rig, cabinet, reels, camera
  game/         the spin as one deterministic state machine
  neural/       connectome assets, the rate model, the scope
  audio/        synthesised sound
  ui/           vitals panel
tools/          asset pipeline + the offline renderer used to compose the shot
public/
  models/       fly.glb, slot-machine.glb
  data/         neurons.bin (0.66 MB), graph.bin (0.43 MB)
```

`tools/preview.mjs` renders the scene with a dependency-free software
rasteriser. The fly's pose, the stool placement and the camera were all settled
from those renders before any of it reached a browser —
`tools/fit-seated.mjs` solves the seating against the stool, and
`tools/tune-sim.mjs` shows the network going critical at gain 1.0, which is why
it runs at 0.8.

---

## Not built

The spec's Python backend. There is no `neuprint-python` service and no
WebSocket: the simulation runs client-side on the shipped 0.43 MB graph
instead. Swapping in a server-side model over the full 141 k-neuron graph would
mean replacing `src/neural/useConnectome.js` and nothing else.

## Attribution

Fly scan © etainproject, CC BY 4.0. Cabinet © local.yany, CC BY 4.0.
MaleCNS v1.0 © FlyEM/HHMI Janelia, University of Cambridge, MRC LMB and Google
Research, CC BY 4.0.
