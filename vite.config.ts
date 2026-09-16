import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { buildVersionPlugin } from './scripts/buildVersionPlugin';

export default defineConfig({
  base: './',
  plugins: [react(), buildVersionPlugin()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
