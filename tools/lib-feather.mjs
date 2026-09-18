/**
 * Reads the MaleCNS connectome dumps.
 *
 * Janelia ships them as Feather (Arrow IPC) with LZ4-frame-compressed record
 * batches, which Arrow JS can parse but will not decompress until a codec is
 * registered. This registers one, so the rest of the build tools can just read
 * the real files.
 *
 * Source: https://male-cns.janelia.org/download/ — CC BY 4.0,
 * FlyEM / HHMI Janelia, University of Cambridge, MRC LMB and Google Research.
 */
import fs from 'fs';
import lz4 from 'lz4js';
import { tableFromIPC, compressionRegistry } from 'apache-arrow';

// CompressionType.LZ4_FRAME === 0; the enum is not reachable through the
// package exports map, so the value is used directly.
const LZ4_FRAME = 0;

compressionRegistry.set(LZ4_FRAME, {
  decode: (data) => lz4.decompress(data),
});

export function readFeather(path) {
  return tableFromIPC(fs.readFileSync(path));
}

/** Prints the schema and a couple of rows — used to learn each dump's shape. */
export function describe(table, sample = 2) {
  console.log('rows', table.numRows, 'cols', table.numCols);
  for (const f of table.schema.fields) console.log('  ', f.name.padEnd(30), String(f.type));
  for (let i = 0; i < sample && i < table.numRows; i++) {
    const row = table.get(i);
    const o = {};
    for (const f of table.schema.fields) {
      const v = row[f.name];
      o[f.name] = typeof v === 'bigint' ? String(v) : v;
    }
    console.log(JSON.stringify(o, (k, v) => (typeof v === 'bigint' ? String(v) : v)).slice(0, 500));
  }
}
