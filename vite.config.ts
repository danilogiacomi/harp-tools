import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A new version waits for the user's Reload (UpdateBar); it never reloads mid-session.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Harp Tools',
        short_name: 'Harp Tools',
        description: 'Practice tools and ear-training games for diatonic harmonica',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#14161a',
        background_color: '#14161a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // No runtime fetches: precaching the build is the whole offline story.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  // Relative base + hash routing: the build works from any sub-path (GitHub Pages or own server).
  base: './',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    alias: {
      'virtual:pwa-register/react': '/src/test/pwaRegisterStub.ts',
    },
  },
})
