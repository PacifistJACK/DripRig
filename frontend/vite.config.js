import { defineConfig } from 'vite';

export default defineConfig({
  // Dev server config
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api and /uploads and /results to FastAPI backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/results': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // Preview server
  preview: {
    port: 4173,
  },
  // Build output
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
});
