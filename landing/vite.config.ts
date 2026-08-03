import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    // Dev-only: forward the waitlist form (and any other /api call) to the
    // local FastAPI server. In production the landing bundle is served by the
    // backend itself, so /api is same-origin and needs no proxy.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
})
