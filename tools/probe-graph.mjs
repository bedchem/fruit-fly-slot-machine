import fs from 'fs';
import { parseGraph } from '../src/neural/simulation.js';
import meta from '../src/neural/cnsGraph.js';
const buf = fs.readFileSync(new URL('../public/data/graph.bin', import.meta.url));
const g = parseGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const P = meta.populations;

// forward adjacency: who does type j send to?
const out = Array.from({ length: g.K }, () => []);
for (let post = 0; post < g.K; post++) {
  for (let p = g.offsets[post]; p < g.offsets[post + 1]; p++) out[g.indices[p]].push(post);
}
const deg = out.map((o) => o.length);
console.log('out-degree: mean', (deg.reduce((a, b) => a + b, 0) / g.K).toFixed(1),
  'max', Math.max(...deg), 'zero-out types', deg.filter((d) => d === 0).length);

function bfs(from, to) {
  const target = new Set(to);
  const dist = new Int32Array(g.K).fill(-1);
  let frontier = [...from];
  frontier.forEach((i) => { dist[i] = 0; });
  for (let d = 1; d <= 8 && frontier.length; d++) {
    const next = [];
    for (const i of frontier) for (const j of out[i]) if (dist[j] < 0) { dist[j] = d; next.push(j); }
    const hit = [...target].filter((t) => dist[t] >= 0);
    if (hit.length) return { hops: d, reached: hit.length, of: target.size };
    frontier = next;
  }
  const hit = [...target].filter((t) => dist[t] >= 0);
  return { hops: Infinity, reached: hit.length, of: target.size };
}
const pairs = [
  ['gustatory', 'reward'], ['gustatory', 'mushroomBody'], ['gustatory', 'mushroomOut'],
  ['visual', 'reward'], ['visual', 'centralComplex'], ['mechanosensory', 'descending'],
  ['reward', 'mushroomOut'], ['visual', 'descending'],
];
console.log('\nshortest path through the reduced graph:');
for (const [a, b] of pairs) {
  const r = bfs(P[a], P[b]);
  console.log(`  ${a.padEnd(15)} -> ${b.padEnd(15)} ${r.hops === Infinity ? 'UNREACHABLE' : r.hops + ' hops'}  (${r.reached}/${r.of} targets)`);
}
// how strongly is each population wired inward?
console.log('\ninbound weight per population (sum |w| / types):');
for (const [name, list] of Object.entries(P)) {
  let s = 0, n = 0;
  for (const i of list) { for (let p = g.offsets[i]; p < g.offsets[i + 1]; p++) s += Math.abs(g.weights[p]); n++; }
  console.log(`  ${name.padEnd(16)} ${(s / Math.max(1, n)).toFixed(1)}`);
}
