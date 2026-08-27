import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ingest': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
});
