import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  // Note: for Electron, the packager (electron-builder) expects renderer in dist/renderer.
  // For Vercel / static web deploys we use outDir: 'dist' (see vercel.json + build:vercel script).
  // The two use-cases are separate; Vercel always runs `vite build` directly.
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  },

  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        timeout: 10000,
        ws: false
      }
    }
  }
})
