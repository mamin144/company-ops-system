import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Isolated Phase 3 prototype. Own entry/build; never imported by apps/*.
// Run from repo root, e.g.: node node_modules/vite/bin/vite.js --config <this file>
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    // '@' alias (components.json / React Bits convention)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5199 },
  preview: { port: 5199 },
  build: { outDir: 'dist', emptyOutDir: true },
});
