import { readFeather } from './lib-feather.mjs';
const t = readFeather(process.argv[2]);
const col = (n) => t.getChild(n);
const bodyId = col('bodyId'), soma = col('somaLocation'), type = col('type'),
  cls = col('class'), sup = col('superclass'), side = col('somaSide');

let withSoma = 0;
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
const classes = new Map(), supers = new Map();
const dan = new Map();
for (let i = 0; i < t.numRows; i++) {
  const s = soma.get(i);
  if (s && s.length === 3) {
    withSoma++;
    for (let a = 0; a < 3; a++) {
      const v = Number(s.get(a));
      if (v < mn[a]) mn[a] = v;
      if (v > mx[a]) mx[a] = v;
    }
  }
  const c = cls.get(i); if (c) classes.set(c, (classes.get(c) || 0) + 1);
  const u = sup.get(i); if (u) supers.set(u, (supers.get(u) || 0) + 1);
  const ty = type.get(i);
  if (ty && /^(PAM|PPL|PPM|PAL)/.test(ty)) dan.set(ty, (dan.get(ty) || 0) + 1);
}
console.log('rows', t.numRows, ' with soma coords:', withSoma);
console.log('soma bbox min', mn, 'max', mx);
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
console.log('\nsuperclass:'); for (const [k, v] of top(supers, 14)) console.log('  ', String(k).padEnd(26), v);
console.log('\nclass (top 18):'); for (const [k, v] of top(classes, 18)) console.log('  ', String(k).padEnd(30), v);
console.log('\ndopaminergic-cluster types found:', dan.size);
for (const [k, v] of top(dan, 24)) console.log('  ', String(k).padEnd(14), v);
