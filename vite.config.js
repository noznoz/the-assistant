import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // '/' for root-domain hosts (Vercel); '/road-heaven/' for GitHub Pages
  base: process.env.VITE_BASE || '/',
  // Injected at build time so the More screen can show which build is live.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  server: { port: process.env.PORT ? Number(process.env.PORT) : 5173 },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      manifest: {
        name: 'The Assistant',
        short_name: 'The Assistant',
        description: 'Your premium personal operating system.',
        theme_color: '#F4F1EC',
        background_color: '#0E0F12',
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
