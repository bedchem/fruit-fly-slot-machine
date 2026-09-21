/**
 * The two drugs, acting on the measured wiring.
 *
 * Neither drug is given a behaviour. Each is given a receptor, and the
 * connectome already says which cell types release the transmitter that
 * receptor answers to: every one of the 1,600 simulated types carries its
 * predicted transmitter from MaleCNS. So a drug here is a per-transmitter
 * multiplier on how strongly synapses land, and what that does to the brain
 * is the wiring's business.
 *
 * ETHANOL
 *   GABA synapses stronger. Ethanol potentiates GABA-A receptors, and in the
 *   fly the GABA-A subunit Rdl is where ethanol sedation runs through.
 *   Acetylcholine and glutamate synapses weaker: ethanol inhibits nicotinic
 *   and NMDA-type excitation. The net is a brain that quiets as the level
 *   rises — the part that speeds a fly up at low doses comes from the dopamine
 *   and octopamine drive in brain.js, not from here.
 *
 * NICOTINE
 *   Acetylcholine synapses stronger. In an insect, nicotinic acetylcholine
 *   receptors carry most fast excitation in the entire CNS — 911 of the 1,600
 *   simulated types are cholinergic — which is why nicotine is an insecticide.
 *   Past the jitter threshold the gain keeps climbing until the network
 *   saturates; that is the seizure.
 *
 * HANGOVER
 *   The rebound. After ethanol has held GABA-A potentiated for hours, the
 *   system has turned it down to compensate; once the ethanol is gone that
 *   compensation is left uncovered, and inhibition is weaker than normal.
 *
 * The factors are chosen for a visible effect, not fitted: the mechanisms
 * are the literature's, the magnitudes are the model's.
 */

export function transmitterGroups(meta) {
  const groups = { acetylcholine: [], gaba: [], glutamate: [], other: [] };
  meta.transmitters.forEach((t, i) => (groups[t] ?? groups.other).push(i));
  return groups;
}

/**
 * Writes the multipliers for this moment into sim.preScale.
 *
 * @param sim     ConnectomeSim
 * @param groups  from transmitterGroups()
 * @param bar     the Bar: intox, nicotine, hangover
 */
export function applyDrugs(sim, groups, bar) {
  const I = bar.intox;                        // 0..1 of the way to sedation
  const N = Math.min(1.4, bar.nicotine / 40); // past 1 is poisoning
  const H = bar.hangover;
  const ach = Math.max(0.2, 1 - 0.38 * I + 0.55 * N);
  const gaba = Math.max(0.3, 1 + 1.25 * I - 0.35 * H);
  const glu = Math.max(0.3, 1 - 0.22 * I + 0.1 * H);
  const s = sim.preScale;
  for (const i of groups.acetylcholine) s[i] = ach;
  for (const i of groups.gaba) s[i] = gaba;
  for (const i of groups.glutamate) s[i] = glu;
  return { ach, gaba, glu };
}
