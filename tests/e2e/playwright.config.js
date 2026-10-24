import { defineConfig } from '@playwright/test';
import path from 'node:path';

const runDir = process.env.E2E_RUN_DIR || path.resolve('../../.runtime/e2e/manual');

export default defineConfig({
  testDir: './specs',
  // Os cenários compartilham o estado criado pela execução (mídia, produção): ordem fixa.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: path.join(runDir, 'artifacts'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(runDir, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(runDir, 'results.json') }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5190',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1600, height: 1000 },
    locale: 'pt-BR',
    screenshot: 'only-on-failure',
    // Sem trace: ele grava o corpo do POST de login (senha da execução). Evidência = captura + contexto.
    trace: 'off',
    video: 'off',
    actionTimeout: 15_000,
    acceptDownloads: true,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
});
