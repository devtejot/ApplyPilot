import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Separate from vite.config.ts — no CRXJS plugin during tests (it processes the
// manifest and isn't needed for unit tests of pure parsers/DOM logic).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
