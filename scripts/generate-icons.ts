#!/usr/bin/env -S npx tsx
// Writes the Home Screen app icons from scripts/icon-source.jpg.
// iOS Add to Home Screen uses the 180×180 apple-touch-icon; the web manifest uses 192 and 512.
// Requires ffmpeg (Lanczos downscale). Outputs are committed under public/icons/.
//
// Usage: npx tsx scripts/generate-icons.ts

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'scripts/icon-source.jpg';
const OUT_DIR = 'public/icons';
const ICONS = [
  { file: 'apple-touch-icon-180.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
] as const;

function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes[0] !== 0x89 || bytes.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('not a PNG');
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size } of ICONS) {
  const out = join(OUT_DIR, file);
  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      SOURCE,
      '-vf',
      `scale=${size}:${size}:flags=lanczos`,
      '-frames:v',
      '1',
      '-update',
      '1',
      out,
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${file} (is ffmpeg installed?)`);
  }
  const { width, height } = pngSize(readFileSync(out));
  if (width !== size || height !== size) {
    throw new Error(`${file} is ${width}×${height}, expected ${size}×${size}`);
  }
  console.log(`generate-icons: wrote ${out} (${size}×${size})`);
}
