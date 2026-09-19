/**
 * Loads the connectome assets and runs the fly's brain against the game.
 *
 * What drives which population, and how the mushroom body learns from it,
 * lives in brain.js and memory.js — plain modules, so tools/sim-session.mjs can
 * run exactly the same brain headless. This hook only loads the data and
 * steps it once per frame.
 */
import { useEffect, useRef, useState } from 'react';
import { parseGraph, parseNeurons } from './simulation.js';
import { Brain } from './brain.js';
import graphMeta from './cnsGraph.js';

export function useConnectome(machineRef) {
  const [ready, setReady] = useState(false);
  const store = useRef({ sim: null, brain: null, neurons: null, rate: null, rest: null, meta: graphMeta });

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
      const brain = new Brain(graph, graphMeta);
      if (machineRef.current) brain.attach(machineRef.current);
      Object.assign(store.current, {
        brain, sim: brain.sim, rest: brain.rest, rate: brain.rate, neurons,
      });
      if (import.meta.env.DEV) {
        console.info(`[connectome] ${neurons.count.toLocaleString()} neurons, `
          + `${graph.K} cell types, ${graph.nnz.toLocaleString()} signed edges, `
          + `${brain.memory.edges.length} plastic KC→MBON edges in ${brain.memory.mbons.length} compartments`);
      }
      setReady(true);
    })().catch((err) => console.error('[connectome] failed to load', err));
    return () => { alive = false; };
  }, [machineRef]);

  useEffect(() => {
    if (!ready) return undefined;
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { brain } = store.current;
      const m = machineRef.current;
      if (brain && m) brain.step(m, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, machineRef]);

  return { ready, store };
}
