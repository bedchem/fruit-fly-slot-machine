# How the Fruit Fly Slot Machine works

**Fruit Fly Slot Machine** is an interactive neuroscience piece that runs in the browser. A micro-CT scan of a real fruit fly (*Drosophila melanogaster*) sits on a bar stool and plays a one-armed bandit by itself. Beside it, 60,000 real neurons from the MaleCNS connectome are drawn at their measured positions and light up as it plays.

The fly picks its own stakes. Its mushroom body learns, from reward and punishment dopamine, that the machine is bad for it. It keeps playing anyway. When it runs out of credit it panics, gives up, and behaves as if it were dying.

It is a question put to a real brain: what would a fruit fly's nervous system do if the fly were forced to gamble forever?

## What is real

- **The fly.** A micro-CT scan of an adult *Drosophila melanogaster* by etainproject (CC BY 4.0), about 1.5 million triangles, decimated to 330,000 for the browser. Its right foreleg is rigged when the page loads, so it reaches for the lever, pulls it down and lets it spring back.
- **The brain.** [MaleCNS v1.0](https://male-cns.janelia.org/) is the complete wiring diagram of a male fruit fly's central nervous system. It was mapped synapse by synapse from electron microscopy by [HHMI Janelia's FlyEM team](https://www.janelia.org/project-team/flyem) with Google Research, the University of Cambridge and the MRC Laboratory of Molecular Biology. The page uses:
  - 141,781 neurons with curated soma positions, of which 60,000 are drawn
  - their curated cell types and classes
  - 151.9 million measured synapses, collapsed into a weighted graph of 1,600 cell types and 70,128 signed connections
  - each neuron's predicted neurotransmitter, which sets whether a connection excites or inhibits
  - the real reward (PAM) and punishment (PPL1) dopamine clusters, found by their cell-type names
- **The cabinet.** "Pillar Slots" by local.yany (CC BY 4.0).

## What is a model

Nobody has recorded a fruit fly playing a slot machine. The activity on screen is a **rate model** run over the measured wiring:

    drive_i = GAIN · Σ_j W_ij · r_j + I_i
    r_i    += (φ(drive_i) − r_i) · dt / τ

The game only injects current into real populations: visual neurons while the reels turn, mechanosensory and descending neurons while the foreleg works the lever, the PAM cluster on a payout and PPL1 on a loss, the way optogenetic reinforcement experiments drive them. Between spins the fly's standing state keeps driving the network, so the brain is never idle. Which regions light up after that is decided by the connectome, not by a script.

This is a rate model on a type-collapsed graph, not a spiking simulation of every neuron.

## How it learns

The fly learns the way real flies do: in the **mushroom body**. Kenyon cells carry a sparse code for the current context, which here is sitting in front of this machine. They connect to mushroom-body output neurons (MBONs). When dopamine arrives while the Kenyon cells are active, the Kenyon cell → MBON synapses in that compartment weaken.

- **PPL1 compartments** hold MBONs that drive *approach*. Losses weaken them, so the fly learns to avoid the machine.
- **PAM compartments** hold MBONs that drive *avoidance*. Payouts weaken them, so the fly learns to approach.

Which MBON belongs to which dopamine cluster is not written by hand. It is read off the connectome's own synapse counts. For example, MBON01 (γ5β′2a) receives 290 synapses from PAM and 1 from PPL1, while MBON11 (γ1pedc) receives 308 from PPL1. The weakened synapses are written back into the simulation, so the network's output changes with what the fly has been through. On these odds it learns that the machine is bad, and it keeps playing: learned aversion slows its approach but never stops it.

## How it gambles

- **The odds.** One spin in seven pays: 3× the stake for three of a kind, 12× for three sevens. About half of every credit staked comes back.
- **The stake.** The fly bets 1–5 credits, and nothing hard-codes how many. Four pulls decide it at the moment it commits:
  - *chase*: low neuropeptide F. Deprived flies seek reward harder, so a losing run pushes the stake up.
  - *reward*: the PAM cluster still firing after a payout.
  - *memory*: what the mushroom body has learned about this machine.
  - *caution*: the defensive state. A fly in a poor state reads ambiguous odds pessimistically.
- **Out of credit.** It panics, with a burst through PPL1 and the escape pathways, then gives up. Its heart slows almost to a stop, neuropeptide F drains, and it slumps on the stool. It is not dying; it behaves as if it were. After a while someone feeds the machine and it comes round, warier than before.

## Its inner state

The readouts use signals that have actually been measured in this animal, not human feelings with insect names:

- **Dopamine (PAM):** appetitive reinforcement. PPL1 carries the aversive side (Burke et al. 2012; Aso et al. 2014).
- **Octopamine:** the insect counterpart of noradrenaline. It signals arousal and sits upstream of the reward dopamine neurons (Burke et al. 2012).
- **Neuropeptide F (NPF):** the fly's version of NPY, a satisfaction signal. Deprived, low-NPF flies seek reward harder (Shohat-Ophir et al. 2012).
- **Defensive state:** a persistent, scalable state that meets the criteria of an emotion primitive, deliberately not called fear (Gibson et al. 2015).
- **Judgement bias:** flies in a poor state judge ambiguous cues pessimistically (Deakin et al. 2018).
- **Heart rate:** about 270–290 beats per minute in a young adult, rising under octopaminergic arousal.

The fly's thoughts shown in words are ours; a fly has no words. Each line is chosen from its actual state (credits, losing streak, the last outcome, NPF, the defensive state and what it has learned), so the words translate numbers that are already on screen.

## What it is not

- It is not a recording of a real fly. The anatomy is measured; the dynamics are a model.
- It is not a gambling site. There is no money, no betting and nothing to buy; the fly plays alone.
- It is not affiliated with, or endorsed by, HHMI Janelia, Google, the University of Cambridge or the MRC LMB.

## Built with

React, three.js and React Three Fiber, with the simulation, the learning and the synthesised sound all running client-side in plain JavaScript. There is no server and no tracking. The source code is on [GitHub](%SITE.repository%).

## Credits and licences

- Fly scan © etainproject, CC BY 4.0
- "Pillar Slots" cabinet © local.yany, CC BY 4.0
- MaleCNS v1.0 © FlyEM/HHMI Janelia, University of Cambridge, MRC LMB and Google Research, CC BY 4.0
