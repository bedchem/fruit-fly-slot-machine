/**
 * Loads the connectome assets and runs the simulation against the game.
 *
 * The only thing the game does is inject current into real populations:
 *
 *   reels turning      -> visual (optic lobe + visual projection types)
 *   foreleg on the lever -> mechanosensory, and descending premotor types
 *   a payout            -> the PAM cluster, the way an optogenetic reward
 *                          experiment drives it, plus the gustatory channel
 *   a loss              -> the PPL1 cluster, which carries aversive value
 *
 * Everything else the panel shows — which regions brighten, how long they stay
 * up, what the mushroom body output does — is the network's own doing on the
 * measured wiring. Nothing downstream is scripted.
 */
import { useEffect, useRef, useState } from 'react';
import { ConnectomeSim, parseGraph, parseNeurons } from './simulation.js';
import graphMeta from './cnsGraph.js';

const P = graphMeta.populations;

export function useConnectome(machineRef) {
  const [ready, setReady] = useState(false);
  const store = useRef({ sim: null, neurons: null, rate: null, meta: graphMeta });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [gBuf, nBuf] = await Promise.all([
        fetch('data/graph.bin').then((r) => r.arrayBuffer()),
        fetch('data/neurons.bin').then((r) => r.arrayBuffer()),
      ]);
      if (!alive) return;
      const graph = parseGraph(gBuf);
      const neurons = parseNeurons(nBuf);
      store.current.sim = new ConnectomeSim(graph);
      store.current.neurons = neurons;
      store.current.rate = store.current.sim.rate;
      if (import.meta.env.DEV) {
        console.info(`[connectome] ${neurons.count.toLocaleString()} neurons, `
          + `${graph.K} cell types, ${graph.nnz.toLocaleString()} signed edges`);
      }
      setReady(true);
    })().catch((err) => console.error('[connectome] failed to load', err));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sim = store.current.sim;
      const m = machineRef.current;
      if (!sim || !m) return;

      const reel = Math.min(1, Math.max(m.reels[0].speed, m.reels[1].speed, m.reels[2].speed) / 19);
      const res = m.lastResult;
      const since = res ? (Date.now() - res.at) / 1000 : Infinity;
      // a reinforcement pulse is brief: a few hundred ms of drive, then the
      // network is left to do whatever it does with it
      const pulse = Math.max(0, 1 - since / 0.45);

      sim.clearInput();
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

      // hand the readouts back to the machine, so the fly's own state is
      // driven by its simulated brain rather than by a parallel guess
      m.setNeuralReadout(sim.mean(P.reward), sim.mean(P.punish));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, machineRef]);

  return { ready, store };
}
