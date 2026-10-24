import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const RUN_DIR = process.env.E2E_RUN_DIR || path.resolve('../../.runtime/e2e/manual');
export const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8020';

/** Contas criadas pelo seed desta execução (só e-mails/IDs; a senha vem de E2E_PASSWORD). */
export function accounts() {
  const file = process.env.E2E_ACCOUNTS_FILE;
  if (!file) throw new Error('E2E_ACCOUNTS_FILE ausente: rode via scripts/e2e.ps1.');
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')).accounts;
}

export function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD ausente: rode via scripts/e2e.ps1.');
  return value;
}

/** Estado compartilhado entre cenários da mesma execução (IDs criados pelo teste). */
const STATE_FILE = path.join(RUN_DIR, 'state.json');
export function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
export function writeState(patch) {
  const next = { ...readState(), ...patch };
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
}

/**
 * Página monitorada: falha o teste em console.error, pageerror e respostas 4xx/5xx da API
 * que não tenham sido declaradas como esperadas com `allowHttp(status, urlPart)`.
 */
export const test = base.extend({
  monitor: [async ({ page }, use, testInfo) => {
    const problems = [];
    // A tela de login consulta a sessão antes de autenticar: 401 ali é o contrato esperado.
    const allowed = [{ status: 401, urlPart: '/api/v1/auth/session' }];
    const ignoredConsole = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // O Chrome registra no console cada resposta HTTP de erro; essas são avaliadas
      // pela regra de rede abaixo (que considera as respostas declaradas esperadas).
      if (/Failed to load resource: the server responded with a status of \d+/.test(text)) return;
      if (ignoredConsole.some((re) => re.test(text))) return;
      problems.push(`console.error em ${page.url()}: ${text}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror em ${page.url()}: ${err.message}`));
    page.on('response', (response) => {
      const url = response.url();
      if (!url.includes('/api/')) return;
      const status = response.status();
      if (status < 400) return;
      if (allowed.some((rule) => rule.status === status && url.includes(rule.urlPart))) return;
      problems.push(`HTTP ${status} ${response.request().method()} ${url}`);
    });
    const monitor = {
      allowHttp(status, urlPart) { allowed.push({ status, urlPart }); },
      ignoreConsole(re) { ignoredConsole.push(re); },
      problems,
    };
    await use(monitor);
    if (problems.length) {
      await testInfo.attach('problemas-console-rede.txt', { body: problems.join('\n'), contentType: 'text/plain' });
    }
    expect(problems, 'Sem console.error, erros de página ou HTTP 4xx/5xx inesperados').toEqual([]);
  }, { auto: true }],
});

export { expect };

export async function login(page, email, pass = password()) {
  await page.goto('/login');
  await page.getByPlaceholder('seu@email.com').fill(email);
  // A senha é aplicada via evaluate: passos "fill" aparecem com o valor no relatório do
  // Playwright, e a senha gerada para a execução não pode ser gravada em arquivo.
  await page.getByPlaceholder('••••••••').evaluate((input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, pass);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** Chamada à API reaproveitando a sessão (cookie) do contexto do navegador. */
export async function api(page, method, apiPath, body) {
  const response = await page.request.fetch(`${process.env.E2E_BASE_URL || 'http://127.0.0.1:5190'}/api/v1${apiPath}`, {
    method,
    headers: { Origin: process.env.E2E_BASE_URL || 'http://127.0.0.1:5190', Accept: 'application/json' },
    data: body,
  });
  let json = null;
  try { json = await response.json(); } catch { /* sem corpo JSON */ }
  return { status: response.status(), json };
}
