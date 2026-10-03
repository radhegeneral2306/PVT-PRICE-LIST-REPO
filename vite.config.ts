import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// GitHub Pages serves the repo at /<repo-name>/
const base = process.env.VITE_BASE ?? '/PVT-PRICE-LIST-REPO/';

export default defineConfig({
  base,
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Pricelist Vault',
        short_name: 'Pricelists',
        description: 'Factory pricelists for tile and sanitaryware trading',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f6f7f6',
        theme_color: '#0f6b4a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { navigateFallback: 'index.html', globPatterns: ['**/*.{js,css,html,png,woff2}', 'icon.svg'] }
    })
  ],
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.{ts,tsx}'] }
});
