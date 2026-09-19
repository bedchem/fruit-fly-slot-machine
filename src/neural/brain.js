/**
 * The fly's brain, coupled to the game.
 *
 * Plain JavaScript, no React: the app runs it every frame through
 * useConnectome, and tools/sim-session.mjs runs the very same code headless to
 * see how a long session actually plays out.
 *
 * What the game does to it is inject current into real populations:
 *
 *   reels turning        -> visual (optic lobe + visual projection types)
 *   foreleg on the lever -> mechanosensory, and descending premotor types
 *   a payout             -> the PAM cluster, the way an optogenetic reward
 *                           experiment drives it, plus the gustatory channel
 *   a loss               -> the PPL1 cluster, which carries aversive value
 *
 * and, underneath all of that and never switched off, the fly's standing state:
 *
 *   the urge to play, and deliberating before a pull
 *                         -> central complex, and a little mushroom body
 *   arousal              -> descending neurons
 *   the defensive state  -> PPL1
 *   credits in hand      -> PAM
 *   out of credit        -> a burst through PPL1 and the descending pathways,
 *                           then everything winds down as it gives up
 *
 * Everything the panel shows past that — which regions brighten, what the
 * mushroom body learns, what that does to the fly's next pull — is the
 * network's own doing on the measured wiring.
 */
import { ConnectomeSim } from './simulation.js';
import { MushroomBodyMemory } from './memory.js';

export class Brain {
  /**
   * @param graph parsed graph.bin
   * @param meta  cnsGraph.js
   */
  constructor(graph, meta) {
    this.P = meta.populations;
    this.sim = new ConnectomeSim(graph);
    // The network starts every type at the same flat baseline and takes a
    // couple of seconds to find its own resting pattern. Let it settle
    // before anything reads it, or that transient reads as a reward pulse.
    for (let i = 0; i < 12; i++) this.sim.step(0.25);
    this.rest = this.sim.rate.slice();
    this.restReward = this.sim.mean(this.P.reward);
    this.restPunish = this.sim.mean(this.P.punish);
    this.memory = new MushroomBodyMemory(this.sim, graph, this.P, meta.names, this.rest);
  }

  get rate() { return this.sim.rate; }

  /** Hands the machine its calibration. Call once, when the two meet. */
  attach(machine) {
    machine.setNeuralRest(this.restReward, this.restPunish);
  }

  /**
   * One frame: drive the network from the game, step it, let the mushroom
   * body learn, and hand the readouts back to the machine.
   *
   * @param m   the SlotMachine
   * @param dt  seconds
   * @param now wall clock in ms — result timestamps are Date.now()
   */
  step(m, dt, now = Date.now()) {
    const { sim, P } = this;
    const reel = Math.min(1, Math.max(m.reels[0].speed, m.reels[1].speed, m.reels[2].speed) / 19);
    const res = m.lastResult;
    const since = res ? (now - res.at) / 1000 : Infinity;
    // a reinforcement pulse is brief: a few hundred ms of drive, then the
    // network is left to do whatever it does with it
    const pulse = Math.max(0, 1 - since / 0.45);

    sim.clearInput();

    // The standing state. Small amounts on purpose — the Kenyon cells in
    // particular feed straight into both dopamine clusters.
    const a = m.appetite;
    const wealth = Math.max(0, Math.min(1, (m.credits - m.startingCredits) / m.startingCredits));
    const alive = 1 - m.collapse * 0.9;
    // central complex: action selection — the pull towards playing again
    sim.drive(P.centralComplex, (0.04 + a.urge * 0.08 + m.deliberation * 0.08) * alive);
    // mushroom body: the machine in front of it, looked at harder while it
    // weighs up the next pull
    sim.drive(P.mushroomBody, (0.004 + m.deliberation * 0.016) * alive);
    // descending: restlessness, the fidget of an aroused animal
    sim.drive(P.descending, (0.03 + m.arousal * 0.08) * alive);
    // PPL1: the defensive state
    sim.drive(P.punish, m.fear * 0.12 * alive);
    // PAM: credits in hand
    sim.drive(P.reward, wealth * 0.04 * alive);

    // Out of credit: an inescapable threat. A burst through PPL1 and the
    // escape pathways, then everything goes quiet as it gives up.
    if (m.brokeStage) {
      const panic = 1 - m.collapse;
      sim.drive(P.punish, 0.8 * panic);
      sim.drive(P.descending, 0.5 * panic);
    }

    sim.drive(P.visual, reel * 0.5);
    sim.drive(P.mechanosensory, m.grip * 0.45);
    sim.drive(P.descending, m.grip * 0.3);
    if (res && pulse > 0) {
      if (res.win) {
        sim.drive(P.reward, pulse * (res.jackpot ? 0.95 : 0.7));
        sim.drive(P.gustatory, pulse * 0.5);
      } else {
        sim.drive(P.punish, pulse * 0.55);
      }
    }
    sim.step(dt);

    // dopamine meets Kenyon cell activity: the mushroom body learns
    this.memory.update(dt);

    // hand the readouts back, so the fly's state is driven by its simulated
    // brain rather than by a parallel guess
    m.setNeuralReadout(sim.mean(P.reward), sim.mean(P.punish));
    m.setMemory(this.memory.value, this.memory.learned);
  }
}
