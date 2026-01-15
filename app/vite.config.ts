import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import manifest from './public/manifest.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Glide Reader',
        short_name: 'Glide',
        description: 'Speed reading with RSVP - one word at a time',
        theme_color: '#242424',
        background_color: '#242424',
        display: 'standalone',
      }
    })
  ],
})
