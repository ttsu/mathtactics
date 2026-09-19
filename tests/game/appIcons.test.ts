import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pngSize } from '../helpers/pngSize';

const ICONS = [
  { file: 'public/icons/apple-touch-icon-180.png', size: 180 },
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
] as const;

describe('Home Screen app icons', () => {
  it('are PNGs at the iOS / PWA sizes (180, 192, 512)', () => {
    for (const { file, size } of ICONS) {
      expect(pngSize(file), file).toEqual({ width: size, height: size });
      // Placeholder icons from task 03 were solid-colour and under 2 KB.
      expect(statSync(file).size, file).toBeGreaterThan(8_000);
    }
  });
});
