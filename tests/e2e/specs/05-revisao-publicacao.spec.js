import { test, expect, accounts, login, api, readState } from '../support/fixtures.js';
import { findProject, openSub } from '../support/production.js';

test.describe('5. Revisão/aprovação → publicação → relatórios', () => {
  test('envia para revisão, aprova, agenda a publicação e o relatório mostra o item publicado', async ({ page }) => {
    const { projectTitle } = readState();
    expect(projectTitle, 'depende da produção do cenário 3').toBeTruthy();
    await login(page, accounts().a.email);

    // Edição → Em revisão.
    await openSub(page, 'em_edicao');
    await page.getByRole('button', { name: /Em edição/ }).first().click();
    await expect(page.getByLabel('Projeto aberto')).toContainText(projectTitle);
    if (!(await page.getByRole('button', { name: 'Enviar para revisão' }).isVisible())) await page.getByRole('button', { name: 'Mostrar fila e detalhes' }).click();
    await page.getByRole('button', { name: 'Enviar para revisão' }).click();
    await expect.poll(async () => (await findProject(page, projectTitle))?.etapa).toBe('em_aprovacao');

    // Revisão: aprova a versão (o app pede confirmação quando há apontamentos abertos).
    await openSub(page, 'em_aprovacao');
    await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Aprovar versão' }).click();
    await expect.poll(async () => (await findProject(page, projectTitle))?.etapa).toBe('finalizado');

    // Finalizado → Agendar publicação: a mídia chega em "Para publicação".
    await openSub(page, 'finalizado');
    await page.getByRole('button', { name: new RegExp(projectTitle) }).first().click();
    await page.getByRole('button', { name: 'Agendar publicação' }).click();
    await expect(page.getByText(`Mídia “${projectTitle}” recebida de Finalizado`, { exact: false })).toBeVisible();

    // A publicação precisa existir no servidor (sobrevive ao recarregar) para entrar nos relatórios.
    await page.reload();
    await openSub(page, 'para_publicar');
    const pubs = await api(page, 'GET', '/records/Publicacao?limit=200');
    expect(pubs.status).toBe(200);
    expect.soft(pubs.json.records.map((p) => p.titulo), 'publicação gravada no servidor').toContain(projectTitle);
    await expect.soft(page.getByText(projectTitle).first(), 'publicação visível após recarregar').toBeVisible();

    // Relatórios (Gestão → Relatórios → Conteúdo): publicados ≥ 1.
    const overview = await api(page, 'GET', '/management/overview');
    expect(overview.status).toBe(200);
    const counted = overview.json.publications.published + overview.json.publications.scheduled + overview.json.publications.pending;
    expect.soft(counted, 'relatório (API) conta a publicação desta empresa').toBeGreaterThanOrEqual(1);
    await page.goto('/management?tab=reports');
    await page.getByRole('button', { name: 'Conteúdo', exact: true }).click();
    await expect(page.getByText('Relatório de conteúdo')).toBeVisible();
    // A tela mostra os contadores da API (Publicados/Agendados/Pendentes).
    await expect(page.getByText('Publicados', { exact: true })).toBeVisible();
  });
});
