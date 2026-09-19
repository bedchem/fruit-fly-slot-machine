# Fruit Fly Slot Machine

[![Connectome: MaleCNS v1.0](https://img.shields.io/badge/connectome-MaleCNS%20v1.0-de7a22?style=flat-square)](https://male-cns.janelia.org/)
[![Neurons](https://img.shields.io/badge/neurons-60%2C001%20drawn-de7a22?style=flat-square)](#what-is-real-and-what-is-a-model)
[![Synapses](https://img.shields.io/badge/synapses-151.9%20M-de7a22?style=flat-square)](#what-is-real-and-what-is-a-model)
[![Learning: mushroom body](https://img.shields.io/badge/learning-mushroom%20body-6c604f?style=flat-square)](#what-is-real-and-what-is-a-model)
<br />
[![React 18](https://img.shields.io/badge/React-18-2b241c?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![three.js](https://img.shields.io/badge/three.js-r169-2b241c?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org)
[![Vite 5](https://img.shields.io/badge/Vite-5-2b241c?style=flat-square&logo=vite&logoColor=FFC517)](https://vite.dev)
[![Runs in the browser](https://img.shields.io/badge/runs-100%25%20client--side-2b241c?style=flat-square)](#publishing)
[![No tracking](https://img.shields.io/badge/tracking-none-2b241c?style=flat-square)](legal.html)
[![3D models: CC BY 4.0](https://img.shields.io/badge/3D%20models-CC%20BY%204.0-978a75?style=flat-square)](#attribution)
[![Last commit](https://img.shields.io/github/last-commit/bedchem/fruit-fly-slot-machine?style=flat-square&color=978a75)](https://github.com/bedchem/fruit-fly-slot-machine/commits)

A *Drosophila* CT scan sits on a bar stool and plays a one-armed bandit by
itself. Beside it, its own nervous system — 60,000 real neurons at their
measured coordinates — lights up as it plays.

<p align="center">
  <img src="docs/screenshots/fly-playing.png" alt="The fruit fly CT scan on a bar stool, working the lever of the slot machine" width="720" />
</p>

<table align="center">
  <tr>
    <td align="center"><img src="docs/screenshots/connectome.png" alt="The connectome scope: 60,001 real neurons at their measured positions, lit by the simulation" width="320" /></td>
    <td align="center"><img src="docs/screenshots/feelings-and-statistics.png" alt="The fly's vitals, its mushroom-body memory and thoughts, and the ledger of what it has staked and lost" width="320" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Its brain</b>: 60,001 real neurons, lit by a model running on the measured wiring.</sub></td>
    <td align="center"><sub><b>How it feels, what it has learned, and what it has lost.</b></sub></td>
  </tr>
</table>

```
npm install
npm run dev
```

The generated assets are committed, so `npm run dev` works straight away.
`npm run assets` rebuilds them from the source models and the connectome dumps.

### Docker

Build and run the production container with the default port `3006`:

```bash
docker compose up --build
```

Set `PORT` to expose it on another host port, for example `8088`:

```bash
PORT=8088 docker compose up --build
```

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
  CC BY 4.0, with its original textures. The one change is the glass over the
  reels: as shipped it is a grey, mirror-smooth pane that hid them, so it is
  made nearly clear.
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

  Between spins the brain is never idle. The fly's standing state keeps driving
  it: the urge to play and deliberating before a pull go into the central
  complex, arousal into the descending neurons, the defensive state into PPL1,
  credits in hand into PAM. "Neurons firing" in the scope counts neurons whose
  type is above its *own* resting rate in the settled network.

- **The learning.** The mushroom body learns on the measured wiring
  (`src/neural/memory.js`). Dopamine arriving while the Kenyon cells are active
  weakens the KC→MBON synapses in that compartment. PPL1 compartments hold the
  MBONs that say *approach*, so losses teach the fly to avoid the machine. PAM
  compartments hold the ones that say *avoid*, so payouts teach it to approach.
  Which MBON belongs to which cluster is not written down anywhere: it is read
  off the connectome's DAN→MBON synapse counts (MBON01 γ5β′2a gets 290 from PAM
  and 1 from PPL1; MBON11 γ1pedc gets 308 from PPL1). The weakened synapses
  go back into the simulation, and what the memory says sets the fly's stake
  and how long it hesitates. It never makes the fly stop: a learned aversion
  slows the approach, the way flies keep returning to a reward cue even after
  it has been paired with punishment (Kaun et al. 2011).

- **The feelings.** Named after what has actually been measured in this animal:

  | Signal | What it is | Source |
  |---|---|---|
  | Dopamine · PAM | appetitive reinforcement; PPL1 carries the negative side | [Burke et al. 2012](https://www.nature.com/articles/nature11614); Aso et al. 2014 |
  | Octopamine | the insect noradrenaline — arousal, and *upstream* of the reward DANs via OAMB | [Burke et al. 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3528794/) |
  | NPF | neuropeptide F, the fly's NPY: satisfaction. Deprivation halves it and low-NPF flies seek harder | [Shohat-Ophir et al. 2012](http://flybase.org/reports/FBrf0217810.html) |
  | Defensive | *not* called fear: a persistent, scalable defensive state that meets the criteria for an emotion primitive | [Gibson et al. 2015](https://www.cell.com/current-biology/fulltext/S0960-9822(15)00411-X) |
  | Judgement bias | a fly in a poor state reads ambiguous cues pessimistically, so this one hesitates longer and stakes less when it is doing badly | [Deakin et al. 2018](https://pubmed.ncbi.nlm.nih.gov/29491031/) |
  | Heart rate | ~270–290 bpm in a young adult, rising under octopaminergic arousal | Paternostro et al. 2001; Ocorr et al. 2007 |

---

## How the fly plays

**The odds.** One spin in seven pays, three of a kind at 3× the stake and
three sevens at 12×. That returns about half of every credit staked. The house
wins, and the fly goes broke.

**The stake.** The fly puts in 1–5 credits a spin, and nothing hard-codes how
many. The stake comes from its state at the moment it pulls (`decideBet` in
`src/game/machine.js`), through four pulls that the panel top right shows live:

| Pull | Pushes the stake | Why |
|---|---|---|
| chase | up | low NPF: a deprived fly seeks reward harder |
| reward | up | the PAM cluster still firing from a payout |
| memory | either way | what the mushroom body has learned about this machine |
| caution | down | the defensive state; a fly in a poor state reads the odds pessimistically |

While it sits between spins the pips show what it is leaning toward. When it
commits, they lock to what it actually put in. The result slip and the ledger
show what it staked, what came back, and the running net.

**Out of credit.** The fly does not reach for more change. It believes it is
dying. There is a burst of panic through PPL1 and the escape pathways, then
the panic burns out: the heart slows to a near stop, NPF drains, the brain goes
quiet, and it slumps on the stool. After ten seconds someone feeds the machine
and it comes round. The PPL1 burst during that panic is a strong lesson for the
mushroom body, so it plays more warily afterwards.

`node tools/sim-session.mjs [minutes] [seed]` plays a whole session headless,
running the same machine and the same brain, and prints every spin with what
the memory said at the time.

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
  neural/       connectome assets, the rate model, the brain/game coupling,
                mushroom-body learning, the scope
  audio/        synthesised sound
  ui/           vitals, stake, memory and ledger panels, result slips
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

## Publishing

Everything that is about the site rather than the piece lives in `site.config.js`: the domain, the author, and the
operator details the legal page needs. Fill in every value in `[square brackets]` before publishing; the build
warns until you do.

`npm run build` then produces, from that one file:

- per page: title, description, canonical URL, Open Graph and Twitter cards, icons, and JSON-LD structured
  data (WebSite, WebApplication, the MaleCNS dataset it is based on, and an FAQPage on the About page)
- `about.html`, the long-form write-up rendered from `seo/about.md`, and `legal.html`, the legal notice and
  GDPR privacy notice (written for Italy)
- `robots.txt` (search engines and AI crawlers explicitly welcome), `sitemap.xml`
- `llms.txt` and `llms-full.txt`, so AI assistants can read the whole project in one fetch
- `site.webmanifest`, `humans.txt`, and a `404.html`

The index page also carries a short text description inside `#root`, which React replaces on start. AI crawlers
don't run JavaScript, so that text is what they read. Fonts are self-hosted, so the site makes no third-party
requests at all, which is what the privacy notice says.

Point the host's 404 page at `404.html`. After publishing, submit `sitemap.xml` in Google Search Console and Bing
Webmaster Tools.

## Attribution

Fly scan © etainproject, CC BY 4.0. Cabinet © local.yany, CC BY 4.0.
MaleCNS v1.0 © FlyEM/HHMI Janelia, University of Cambridge, MRC LMB and Google
Research, CC BY 4.0.
