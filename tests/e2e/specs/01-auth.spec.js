import { test, expect, accounts, login, api } from '../support/fixtures.js';

test.describe('1. Autenticação', () => {
  test('login inválido mostra erro e não cria sessão', async ({ page, monitor }) => {
    monitor.allowHttp(401, '/api/v1/auth/session');
    monitor.allowHttp(401, '/api/v1/auth/login');
    await page.goto('/login');
    await page.getByPlaceholder('seu@email.com').fill(accounts().a.email);
    await page.getByPlaceholder('••••••••').fill('senha-errada-e2e');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect((await api(page, 'GET', '/auth/session')).status).toBe(401);
  });

  test('login válido abre o app, mostra a empresa e o logout encerra a sessão', async ({ page, monitor }) => {
    monitor.allowHttp(401, '/api/v1/auth/session');
    const { a } = accounts();
    await login(page, a.email);
    await expect(page).toHaveURL(/\/corp\?tab=producao/);
    await expect(page.getByRole('heading', { name: 'IAcervo Corp' })).toBeVisible();
    const session = await api(page, 'GET', '/auth/session');
    expect(session.status).toBe(200);
    expect(session.json.user.email).toBe(a.email);
    expect(session.json.selected_tenant_id).toBe(a.tenant_id);
    await expect(page.getByText(a.tenant_name).first()).toBeVisible();

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect.poll(async () => (await api(page, 'GET', '/auth/session')).status).toBe(401);
    // Rota protegida volta para o login depois do logout.
    await page.goto('/acervo');
    await expect(page).toHaveURL(/\/login/);
  });
});
