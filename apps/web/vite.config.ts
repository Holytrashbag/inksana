import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from a subpath on GitHub Pages (https://<user>.github.io/inksana/).
  // The Pages workflow sets BASE_PATH=/inksana/; dev and other builds stay at '/'.
  // vue-router reads this via import.meta.env.BASE_URL, so routing follows suit.
  base: process.env.BASE_PATH || '/',
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
