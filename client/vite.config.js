import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// changeOrigin: false keeps the browser's Host header, so links the API builds (wage slip links)
// point at the address the app was opened on, not at the internal API port
const target = { target: 'http://localhost:5000', changeOrigin: false };
const apiProxy = { '/api': target, '/uploads': target };

export default defineConfig({
  plugins: [
    react(),
    // Installable app + service worker. The app shell is cached so it opens with no internet,
    // and API reads are cached so the attendance sheet still shows offline.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'SiteSync — Attendance & Payroll',
        short_name: 'SiteSync',
        description: 'Daily labour attendance with GPS and photo proof, and weekly payroll.',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        id: '/',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',
        dir: 'auto',
        categories: ['business', 'productivity'],
        prefer_related_applications: false,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the app icon on Android to jump straight to these screens
        shortcuts: [
          { name: 'Mark attendance', short_name: 'Attendance', url: '/attendance', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Give advance', short_name: 'Advances', url: '/advances', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/\.well-known\//, /\.apk$/],
        runtimeCaching: [
          {
            // Photos never change once saved (stored in MongoDB, served at /api/files/:id)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/files/') || url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'photos',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Data the app reads (sites, attendance sheet, workers…): network first, cached copy when offline.
            // Downloads and public slip links are never cached.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/api/public/') &&
              !/\/(pdf|excel|slip)(\/|$)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, host: true, proxy: apiProxy },
  // `npm run preview` serves the production build (with the service worker) using the same proxy
  preview: { port: 4173, host: true, proxy: apiProxy },
});
