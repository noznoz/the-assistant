import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: { port: process.env.PORT ? Number(process.env.PORT) : 5173 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Road Heaven',
        short_name: 'Road Heaven',
        description: 'Plan. Ride. Connect. Remember.',
        theme_color: '#FF6B00',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
