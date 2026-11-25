import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Phase 13 app. Own entry/build; never imported by apps/*.
// Run from repo root, e.g.: node node_modules/vite/bin/vite.js --config <this file>
//
// /api proxy (http mode): callers already pass full paths starting /api/… (the
// legacy convention), so the dev/preview server forwards them to the real
// backend. Target is env-overridable — never hardcoded per environment.
// In fixture mode (VITE_PROTOTYPE=1) no backend is contacted at all.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4001';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    // '@' alias (components.json / React Bits convention)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    // Same env plumbing the app reads via configuration.ts.
    'import.meta.env.VITE_PROTOTYPE': JSON.stringify(process.env.VITE_PROTOTYPE),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL ?? ''),
  },
  server: {
    port: 5199,
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  preview: {
    port: 5199,
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
