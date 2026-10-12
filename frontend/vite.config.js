import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Canvas/editor DOM suites compete heavily for CPU under V8 instrumentation.
    maxWorkers: 1,
    testTimeout: 20000,
    reporters: ['./scripts/pytest-style-reporter.mjs'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      include: [
        'src/api/httpClient.js',
        'src/api/dashboard.js',
        'src/api/management.js',
        'src/api/uploads.js',
        'src/api/permissions.js',
        'src/mediamind/auth.jsx',
        'src/mediamind/lib/empresaContext.jsx',
        'src/mediamind/lib/gravacoesUpload.js',
        'src/mediamind/lib/productionWorkflow.js',
      ],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
  plugins: [react()]
});
