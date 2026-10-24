import { test, expect, accounts, login } from '../support/fixtures.js';

// Rotas do app (frontend/src/App.jsx). Cada uma é aberta logada e precisa renderizar sem
// console.error, erro de página, tela 404 ou requisição 4xx/5xx inesperada.
const ROUTES = [
  '/', '/corp', '/search', '/ingest', '/acervo', '/workspace', '/timeline', '/timeline2',
  '/roteiro2', '/social', '/clipsfree', '/clipsfree2', '/management', '/management?tab=reports',
  '/administration2', '/assistente', '/estudio-de-arte', '/ferramentas-ia', '/geracao-de-video',
  '/canais-dark', '/agencia-video', '/ferramentas-graficas', '/soundcraft', '/ferramentas-office',
  '/dash-ias', '/telas2', '/telas2/gestao', '/telas2/apis-ia', '/configuracoes/ia',
];

test.describe('7. Varredura: sem erros de console nem 4xx/5xx inesperados', () => {
  for (const route of ROUTES) {
    test(`rota ${route}`, async ({ page }) => {
      await login(page, accounts().a.email);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
      // Sem tela branca: o app renderizou conteúdo dentro de #root.
      expect((await page.locator('#root').innerText()).trim().length).toBeGreaterThan(20);
    });
  }
});
