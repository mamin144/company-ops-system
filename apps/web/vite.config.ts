import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'نظام إدارة العمليات',
        short_name: 'إدارة العمليات',
        description: 'نظام متكامل لإدارة العمليات في الشركة',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        dir: 'rtl',
        lang: 'ar',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache application shell and static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Exclude API requests from SW cache aggressively
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: []
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4001'
    }
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:4001'
    }
  }
});
