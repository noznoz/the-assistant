import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // '/' for root-domain hosts (Vercel); '/road-heaven/' for GitHub Pages
  base: process.env.VITE_BASE || '/',
  server: { port: process.env.PORT ? Number(process.env.PORT) : 5173 },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Road Heaven',
        short_name: 'Road Heaven',
        description: 'Plan. Ride. Connect. Remember.',
        theme_color: '#FF6B00',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          // Relative so they resolve correctly under any base path
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
