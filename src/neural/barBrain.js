/**
 * The fly's brain, coupled to the bar.
 *
 * Plain JavaScript, no React: the app runs it every frame through
 * useConnectome, and tools/sim-session.mjs runs the very same code headless to
 * see how a long night actually plays out.
 *
 * What the bar does to it comes in two kinds.
 *
 * Current into real populations:
 *
 *   beer on the proboscis   -> gustatory (pharyngeal and labellar taste types)
 *   foreleg to the tin      -> mechanosensory, and descending premotor types
 *   ethanol rising          -> PAM, the reward cluster: ethanol is rewarding to
 *                              a fly and the memory of it needs mushroom-body
 *                              dopamine (Kaun et al. 2011)
 *   the first sips          -> PPL1: a naive fly finds ethanol aversive at
 *                              first, and learns to want it anyway
 *   nicotine rising         -> PAM; dopamine carries the acute nicotine
 *                              response in flies (Bainton et al. 2000)
 *   nicotine poisoning      -> PPL1 and the descending escape pathways
 *   hangover                -> PPL1, while the Kenyon cells still code the bar,
 *                              so the morning after is learned too
 *
 * and, while a drug is in the body, a change in how strongly synapses of each
 * transmitter land (pharmacology.js).
 *
 * Which regions brighten, what the mushroom body learns from it, and what
 * that does to the next decision is the network's own doing.
 */
import { ConnectomeSim } from './simulation.js';
import { MushroomBodyMemory } from './memory.js';
import { applyDrugs, transmitterGroups } from './pharmacology.js';
import { PHASES } from '../game/bar.js';

export class BarBrain {
  constructor(graph, meta) {
    this.P = meta.populations;
    this.groups = transmitterGroups(meta);
    this.sim = new ConnectomeSim(graph);
    // settle before anything reads it, or the transient reads as a reward pulse
    for (let i = 0; i < 12; i++) this.sim.step(0.25);
    this.rest = this.sim.rate.slice();
    this.restReward = this.sim.mean(this.P.reward);
    this.restPunish = this.sim.mean(this.P.punish);
    this.memory = new MushroomBodyMemory(this.sim, graph, this.P, meta.names, this.rest);
    this.drugs = { ach: 1, gaba: 1, glu: 1 };
    /** How used to the taste it is: the first-sip aversion fades with it. */
    this.familiar = 0;
    this.sipsSeen = 0;
  }

  get rate() { return this.sim.rate; }

  attach(bar) { bar.setNeuralRest(this.restReward, this.restPunish); }

  step(b, dt) {
    const { sim, P } = this;
    sim.clearInput();
    this.drugs = applyDrugs(sim, this.groups, b);

    const awake = 1 - b.collapse * 0.85;
    const seizing = b.phase === PHASES.SEIZURE ? b.seizureFit : 0;

    // --- the standing state ------------------------------------------------
    // central complex: action selection — weighing the next drink
    sim.drive(P.centralComplex, (0.04 + b.deliberation * 0.08 + b.stim * 0.05) * awake);
    // mushroom body: the bar in front of it, looked at harder while it decides
    sim.drive(P.mushroomBody, (0.004 + b.deliberation * 0.016 + (b.hangover > 0.1 ? 0.008 : 0)) * awake);
    // descending: restlessness — ethanol's early hyperactivity, nicotine's jitter
    sim.drive(P.descending, (0.03 + b.arousal * 0.08 + b.stim * 0.06 + b.jitter * 0.2) * awake);
    // the dim bar, always in view
    sim.drive(P.visual, 0.05 * awake);

    // --- the drink ---------------------------------------------------------
    // taste: the proboscis on the straw, a pulse with every sip
    sim.drive(P.gustatory, b.extend * 0.22 + (b.sipPulse ?? 0) * 0.35);
    // naive: the burn of ethanol, aversive. It fades with every sip it takes.
    sim.drive(P.punish, (b.sipPulse ?? 0) * 0.5 * (1 - this.familiar));
    if (b.sips !== this.sipsSeen) {
      this.sipsSeen = b.sips;
      this.familiar = Math.min(1, this.familiar + 0.05);
    }
    // ethanol arriving in the body: reward, blunted by tolerance
    const ethanolReward = Math.min(1, b.ethanolRise * 1.1) * (1 - b.tolerance * 0.5);
    sim.drive(P.reward, ethanolReward * 0.42 * awake);
    // nicotine arriving: reward, and a dopamine lift while it is in
    sim.drive(P.reward, (Math.min(1, b.nicotineRise * 0.5) * 0.35 + b.nicStim * 0.04) * awake);

    // --- the pouch -----------------------------------------------------------
    sim.drive(P.mechanosensory, b.grip * 0.4);
    sim.drive(P.descending, b.grip * 0.25);

    // --- the costs ---------------------------------------------------------
    sim.drive(P.punish, b.hangover * 0.28 * awake);
    sim.drive(P.punish, b.jitter * 0.3);
    if (seizing > 0) {
      sim.drive(P.punish, 0.8 * seizing);
      sim.drive(P.descending, 0.9 * seizing);
    }

    sim.step(dt);
    this.memory.update(dt);
    b.setNeuralReadout(sim.mean(P.reward), sim.mean(P.punish));
    b.setMemory(this.memory.value, this.memory.learned);
  }
}
