import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_URL ?? '/',
  server: {
    proxy: {
      // 127.0.0.1, not localhost: the proxy binds IPv4 loopback and Node may
      // resolve localhost to ::1.
      '/api': 'http://127.0.0.1:3001',
    },
  },
})
