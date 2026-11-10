import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['payday-icon.svg'],
      manifest: {
        name: 'Payday — Staff & Payroll',
        short_name: 'Payday',
        description: 'A calmer way to manage your team and payroll.',
        theme_color: '#242238',
        background_color: '#f8f8fb',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/payday-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{css,html,ico,js,svg,webmanifest}'],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'firebase',
              test: /node_modules[\\/](?:firebase|@firebase)[\\/]/,
              priority: 10,
              maxSize: 400000,
            },
          ],
        },
      },
    },
  },
})
