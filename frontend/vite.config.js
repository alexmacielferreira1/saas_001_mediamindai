import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': process.env.MEDIAMIND_API_PROXY || 'http://127.0.0.1:8000',
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Node 25+ expõe um localStorage nativo que se sobrepõe ao do jsdom e quebra a suíte.
    execArgv: Number(process.versions.node.split('.')[0]) >= 25 ? ['--no-experimental-webstorage'] : [],
    // Test expectations use the same-origin API; local .env files must not alter them.
    env: { VITE_API_URL: '' },
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
        'src/mediamind/lib/theme.jsx',
        'src/mediamind/components/ThemeToggle.jsx',
        'theme/palette.cjs',
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
