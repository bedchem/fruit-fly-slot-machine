<div align="center">
  <img src="docs/screenshots/fly-playing.png" alt="An amber Drosophila CT scan on a stool pulling the lever of a purple slot machine" width="820" />

  # Fruit Fly Slot Machine

  **A real fruit-fly connectome, a stubborn little gambler, and a slot machine that never pays.**

  [![Connectome: MaleCNS v1.0](https://img.shields.io/badge/connectome-MaleCNS%20v1.0-DE7A22?style=flat-square)](https://male-cns.janelia.org/)
  [![60,001 neurons](https://img.shields.io/badge/neurons-60%2C001%20drawn-DE7A22?style=flat-square)](#whats-real)
  [![151.9M synapses](https://img.shields.io/badge/synapses-151.9M%20measured-2B241C?style=flat-square)](#whats-real)
  [![Runs client-side](https://img.shields.io/badge/runtime-browser--only-2B241C?style=flat-square)](#run-it-locally)
  [![CC BY 4.0 sources](https://img.shields.io/badge/data%20and%203D%20assets-CC%20BY%204.0-978A75?style=flat-square)](#credits--licenses)

  [The piece](#the-piece) · [Run locally](#run-it-locally) · [How it works](#how-it-works) · [Credits](#credits--licenses)
</div>

---

## The piece

An adult *Drosophila melanogaster* micro-CT scan sits at a one-armed bandit and plays by itself. Its brain glows beside it: **60,001 neurons at their measured positions**, driven by a compact model over the **MaleCNS v1.0** connectome.

The fly is not controlled by the visitor. It sets its own stake, remembers how little comes back, chases losses when its satisfaction signal is low, becomes defensive as credit runs out, and eventually goes broke. There is no real currency, no purchasing, and no tracking—only a browser-side neuroscience artwork.

| Watch the fly | Inspect the brain | Read its state |
| :---: | :---: | :---: |
| <img src="docs/screenshots/fly-playing.png" alt="Fruit fly operating the slot-machine lever" width="300" /> | <img src="docs/screenshots/connectome.png" alt="Neural scope showing the fruit fly connectome" width="300" /> | <img src="docs/screenshots/feelings-and-statistics.png" alt="Live signals, memory, stress proxy, and session ledger" width="300" /> |
| **A real CT scan works the lever.** | **Measured anatomy lights up.** | **State, memory, and return history alter its choices.** |

## What’s real

| Real, measured material | The model built on top |
| --- | --- |
| **Fly anatomy** — an adult *Drosophila* micro-CT scan. | **Neural activity** — no one has recorded a fly at a slot machine; activity is a rate model. |
| **MaleCNS v1.0** — curated cells, soma positions, cell types, transmitter predictions, and 151.9M synapses. | **The game** — reels, odds, credits, and the translated inner monologue are authored. |
| **Mushroom-body circuit identity** — PAM, PPL1, Kenyon-cell, and MBON relationships come from the connectome. | **Behavioural interpretation** — signals are a legible interpretation of the model, not a clinical measurement. |
| **3D cabinet and fly assets** — credited CC BY 4.0 source models. | **Cortisol meter** — a clearly labelled stress proxy; flies do not produce cortisol. |

The distinction is deliberate: the wiring is evidence; the performance is an interpretation of what that wiring might do in this impossible situation.

## How it works

### A compact live brain model

The original graph is too large to run raw in a browser tab, so measured synapses are collapsed into a **1,600-type signed weight matrix** while the scene still draws 60,001 individual neurons at their measured locations. The model continuously integrates type activity and projects the result back to the visible neurons.

```text
driveᵢ = gain × Σⱼ Wᵢⱼrⱼ + inputᵢ
rateᵢ  ← rateᵢ + (activation(driveᵢ) − rateᵢ) × dt / τ
```

Reel motion, reaching for the lever, reward, loss, arousal, and defensive state inject current into relevant real populations. The visible response is driven by the connectome rather than a scripted light show.

### Learning changes the next stake

The fly’s mushroom body updates its KC→MBON synapses during play:

- **PAM** reward activity weakens avoidance-driving MBON pathways.
- **PPL1** punishment activity weakens approach-driving MBON pathways.
- A separate return-memory signal records whether credits are actually coming back.

The next bet combines pursuit, recent reward, learned value, defensive caution, and return history. After sustained bad returns, the fly protects credit by capping its stake—even though it may still pull the lever.

### A readable live state

The right rail exposes the state instead of hiding it: heart rate, dopamine, octopamine, defensive state, NPF, an expandable colour-coded **stress proxy**, mushroom-body learning, the fly’s thoughts, and a complete credit ledger. The experience is responsive: on a phone, the scene remains touch-safe and the information rail follows beneath it without clipped text or overlapping controls.

## Run it locally

### Requirements

- Node.js 18 or newer
- npm
- A browser with WebGL enabled

### Development

```bash
npm install
npm run dev
```

Vite prints the local URL (normally `http://localhost:5173`). The committed browser assets mean the application runs immediately after dependencies are installed.

### Production build

```bash
npm run build
npm run preview
```

### Docker

```bash
docker compose up --build
```

The default host port is `3006`. Choose another with `PORT=8088 docker compose up --build`.

## Verify it

```bash
# Build the static site, metadata, sitemap, and AI-readable summaries
npm run build

# Exercise timing, reel alignment, win distribution, RTP, and return memory
node tools/test-machine.mjs

# Play a deterministic headless session
node tools/sim-session.mjs 3 20260919
```

The game model is deterministic under a seed, which makes behavioural changes reviewable rather than anecdotal.

## Project map

```text
src/
  scene/       Three.js scene, fly rig, cabinet, camera, reels, and lever
  game/        deterministic slot-machine state machine and decision policy
  neural/      connectome loading, rate model, learning, and visual scope
  audio/       synthesized Web Audio feedback; no sampled soundtrack
  ui/          live readouts, stress meter, thoughts, memory, ledger, slips
seo/           titles, canonical URLs, structured data, sitemap, llms files
tools/         asset processing, measurement, rendering, and simulations
public/
  data/        compact browser-ready neuron and graph data
  models/      processed fly and slot-machine models
docs/screenshots/  README visuals
```

## Publishing and discoverability

`site.config.js` is the single source for the public URL, credited authors, repository, operator, and host details. The build generates page titles, descriptions, canonical URLs, Open Graph/Twitter cards, JSON-LD, `sitemap.xml`, `robots.txt`, `site.webmanifest`, `humans.txt`, `llms.txt`, and `llms-full.txt`.

Before deploying, replace the remaining host and privacy-policy placeholders in `site.config.js`. Then submit the generated sitemap to the relevant webmaster tools.

## Credits & licenses

- **Connectome:** [MaleCNS v1.0](https://male-cns.janelia.org/) by FlyEM/HHMI Janelia, University of Cambridge, MRC LMB, and Google Research — CC BY 4.0.
- **Fruit fly model:** [Drosophila adult fruit fly CT scan](https://sketchfab.com/3d-models/drosophila-adult-fruit-fly-ct-scan-ad29b897bd2b4e27bb04ab9d31baa117) by etainproject — CC BY 4.0.
- **Slot-machine model:** [Pillar Slots](https://sketchfab.com/3d-models/pillar-slots-91e255e5a95745f4857607b388421ee1) by local.yany — CC BY 4.0.
- **Project authors:** [ryhox](https://github.com/ryhox) and [Nexor](https://github.com/plattnericus).

The project code is released under the [MIT License](LICENSE). Asset and dataset licenses remain those of their respective creators.
