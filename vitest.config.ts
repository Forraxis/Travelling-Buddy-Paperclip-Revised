import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Unit tests live under src/. The e2e/ Playwright specs run separately via
    // `npm run test:e2e` and must not be picked up by Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
