/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages project path (repo name).
// Override with VITE_BASE (e.g. a different repo name, or '/' for a custom
// domain / root deployment) without editing this file. Default unchanged.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/playlist/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
