// Varredura de rotas com navegador real (Playwright): faz login pela API, abre
// cada rota e lista erros de JavaScript, erros de console e respostas 4xx/5xx
// da API. Não altera dados por conta própria, mas as telas podem gravar o que
// o próprio app gravar ao abrir — usar só em banco local/de teste.
//
// Requisitos: API e Vite locais em execução, contas demo semeadas
// (scripts/seed_demo.py) e o pacote `playwright` resolvível a partir deste
// arquivo (o projeto não o instala; ex.: `npm i --no-save playwright` na raiz
// do produto e `npx playwright install chromium`). NODE_PATH não vale para ESM.
//
// Uso:
//   MM_PASSWORD=<DEMO_PASSWORD do .env> node scripts/qa/route_crawl.mjs [email] [rota ...]
//   MM_BASE_URL=http://127.0.0.1:5173 (padrão) — MM_SHOTS=pasta salva capturas por rota
//
// Histórico: usado na revisão de 23/10/2026 (docs/RELATORIO_2026-10-23_DADOS_DEMO.md).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.MM_BASE_URL || 'http://127.0.0.1:5173';
const PASSWORD = process.env.MM_PASSWORD;
const SHOTS = process.env.MM_SHOTS || '';
const DEFAULT_ROUTES = [
  '/', '/search', '/ingest', '/workspace', '/workspace/timeline', '/timeline', '/timeline2',
  '/social', '/clipsfree', '/clipsfree2', '/acervo', '/management', '/administration2',
  '/roteiro2', '/corp', '/assistente', '/estudio-de-arte', '/ferramentas-ia',
  '/geracao-de-video', '/canais-dark', '/agencia-video', '/ferramentas-graficas',
  '/soundcraft', '/ferramentas-office', '/dash-ias', '/telas2', '/telas2/gestao',
  '/telas2/apis-ia', '/configuracoes/ia',
];

if (!PASSWORD) {
  console.error('Defina MM_PASSWORD com a senha das contas demo locais.');
  process.exit(2);
}
const [email = 'admin@mediamind.ai', ...custom] = process.argv.slice(2);
const routes = custom.length ? custom : DEFAULT_ROUTES;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let current = 'login';
const issues = [];
page.on('pageerror', (error) => issues.push([current, 'PAGEERROR', error.message.slice(0, 300)]));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
    issues.push([current, 'CONSOLE', message.text().slice(0, 300)]);
  }
});
page.on('response', (response) => {
  if (response.url().includes('/api/') && response.status() >= 400) {
    issues.push([current, `HTTP ${response.status()}`, `${response.request().method()} ${response.url().replace(BASE, '')}`]);
  }
});

const login = await context.request.post(`${BASE}/api/v1/auth/login`, { data: { email, password: PASSWORD } });
console.log(`login ${email}: ${login.status()}`);
if (!login.ok()) process.exit(1);

for (const route of routes) {
  current = route;
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (error) {
    issues.push([route, 'NAV', error.message.split('\n')[0]]);
  }
  await page.waitForTimeout(1500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${route.replace(/\//g, '_') || '_'}.png` });
  console.log(`VISIT ${route} -> ${new URL(page.url()).pathname}`);
}
await browser.close();

for (const issue of issues) console.log(issue.join(' | '));
console.log(`${issues.length} ocorrência(s) em ${routes.length} rota(s).`);
