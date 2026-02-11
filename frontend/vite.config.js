import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: {
    // Use IIFE format for workers to support importScripts() used by MediaPipe WASM
    format: 'iife',
    // In dev mode, we need to use rollup plugins to bundle the worker
    rollupOptions: {
      output: {
        // Ensure worker is bundled as a single file
        inlineDynamicImports: true,
      }
    }
  },
  // Force optimizeDeps to pre-bundle worker dependencies
  optimizeDeps: {
    include: ['@mediapipe/tasks-vision']
  }
})
