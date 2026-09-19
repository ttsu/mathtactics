import { readFileSync } from 'node:fs';

/** PNG IHDR width/height. Works on a file path or an already-loaded buffer. */
export function pngSize(source: string | Uint8Array): { width: number; height: number } {
  const bytes = typeof source === 'string' ? readFileSync(source) : Buffer.from(source);
  if (bytes[0] !== 0x89 || bytes.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('not a PNG');
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
