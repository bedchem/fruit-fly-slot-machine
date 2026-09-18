import fs from 'fs';
import lz4 from 'lz4js';
import { RecordBatchReader, compressionRegistry } from 'apache-arrow';
compressionRegistry.set(0, { decode: (d) => lz4.decompress(d) });
const reader = await RecordBatchReader.from(fs.createReadStream(process.argv[2]));
await reader.open();
console.log('schema:');
for (const f of reader.schema.fields) console.log('  ', f.name.padEnd(24), String(f.type));
let n = 0;
for await (const batch of reader) {
  console.log('batch rows', batch.numRows);
  for (let i = 0; i < 3; i++) {
    const r = batch.get(i);
    const o = {};
    for (const f of reader.schema.fields) { const v = r[f.name]; o[f.name] = typeof v === 'bigint' ? String(v) : v; }
    console.log('  ', JSON.stringify(o));
  }
  if (++n >= 1) break;
}
