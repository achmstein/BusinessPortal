import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// In dev, Vite proxies /api to the .NET host. Under Aspire the host URL is
// injected via env; otherwise fall back to the Web project's dev port
// (launchSettings.json binds http://localhost:5257).
const proxyTarget =
  process.env['services__businessportal-server__http__0'] ||
  process.env['services__businessportal-server__https__0'] ||
  'http://localhost:5257'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heaviest, slowest-changing dependencies so a page change
        // doesn't invalidate them in the browser cache.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', '@tanstack/react-table'],
          // Shared by every screen once migration finishes — keeping them out
          // of page chunks means one cached copy rather than one per route.
          forms: ['react-hook-form', 'zod', '@hookform/resolvers/zod'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: proxyTarget, changeOrigin: true, secure: false },
      '/health': { target: proxyTarget, changeOrigin: true, secure: false },
    },
  },
})
