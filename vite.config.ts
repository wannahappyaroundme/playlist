/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages project path (repo name).
// Change to '/' for a custom domain or root deployment.
export default defineConfig({
  plugins: [react()],
  base: '/yejin-playlist/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
