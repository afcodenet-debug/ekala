import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import baseConfig from './vite.config'

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
})
