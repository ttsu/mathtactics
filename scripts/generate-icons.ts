#!/usr/bin/env -S npx tsx
// Writes the placeholder app icons (task 03): solid-colour PNGs, no image dependencies.
// Outputs are committed under public/icons/; re-run only to change the placeholder.
// Real icons arrive with the art pass (M5).
//
// Usage: npx tsx scripts/generate-icons.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT_DIR = 'public/icons';
const COLOR = { r: 0x2f, g: 0x3e, b: 0x57 };
const ICONS = [
  { file: 'apple-touch-icon-180.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function solidPng(size: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); // width
  header.writeUInt32BE(size, 4); // height
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour RGB
  // compression, filter, interlace: 0

  const row = Buffer.alloc(1 + size * 3); // filter byte 0, then RGB triples
  for (let x = 0; x < size; x += 1) {
    row[1 + x * 3] = COLOR.r;
    row[2 + x * 3] = COLOR.g;
    row[3 + x * 3] = COLOR.b;
  }
  const pixels = Buffer.concat(Array.from({ length: size }, () => row));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size } of ICONS) {
  writeFileSync(join(OUT_DIR, file), solidPng(size));
  console.log(`generate-icons: wrote ${join(OUT_DIR, file)} (${size}×${size})`);
}
