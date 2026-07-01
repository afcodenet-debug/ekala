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
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Code splitting strategy for optimal loading
        manualChunks: (id) => {
          // Vendor chunk for React and core libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          // Vendor chunk for state management
          if (id.includes('node_modules/zustand') || id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-state';
          }
          // Vendor chunk for UI libraries
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/qrcode.react')) {
            return 'vendor-ui';
          }
          // Vendor chunk for forms
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform/resolvers') || id.includes('node_modules/zod')) {
            return 'vendor-forms';
          }
          // i18n in separate chunk
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          return undefined;
        },
        // Optimize chunk naming for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '') : 'chunk';
          return `assets/js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.');
          const ext = info?.[info.length - 1];
          if (ext === 'css') return 'assets/css/[name]-[hash].[ext]';
          if (['woff', 'woff2', 'ttf', 'eot'].includes(ext || '')) return 'assets/fonts/[name]-[hash].[ext]';
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
    // Increase chunk size warning limit (we have a large app)
    chunkSizeWarningLimit: 1000,
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
