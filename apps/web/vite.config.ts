import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Traccoon Education',
        short_name: 'Traccoon',
        description: 'Local-first PDF study cards that stay on your device.',
        theme_color: '#2f6b3d',
        background_color: '#fcfdf9',
        display: 'standalone',
      },
      workbox: {
        // Default globs skip .mjs, .svg, .woff2 and .webp, which left the PDF.js
        // worker, icons, bundled fonts, Rokki art and treat art out of the offline cache.
        globPatterns: ['**/*.{js,mjs,css,html,svg,woff2,webp}'],
        maximumFileSizeToCacheInBytes: 9 * 1024 * 1024,
      },
    }),
  ],
})
