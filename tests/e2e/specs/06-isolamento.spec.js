import { test, expect, accounts, login, api, readState } from '../support/fixtures.js';
import { openSub } from '../support/production.js';

test.describe('6. Isolamento entre empresas', () => {
  test('a empresa B não vê nem altera mídia, roteiro e produção da empresa A (API e UI)', async ({ page }) => {
    const state = readState();
    const { a, b } = accounts();
    expect(state.videoAssetId && state.projectId, 'depende dos cenários 2 e 3').toBeTruthy();

    // Mesmo navegador: A entra e sai; depois B entra (nada da sessão de A pode vazar).
    await login(page, a.email);
    expect((await api(page, 'GET', `/records/ProducaoProjeto/${state.projectId}`)).status).toBe(200);
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);
    await login(page, b.email);
    const session = await api(page, 'GET', '/auth/session');
    expect(session.json.selected_tenant_id).toBe(b.tenant_id);

    // API: listas da empresa B não contêm nada de A; leitura/alteração direta por ID dá 404.
    const assets = await api(page, 'GET', '/records/Asset?limit=500');
    expect(assets.json.records.map((r) => r.id)).not.toContain(state.videoAssetId);
    const media = await api(page, 'GET', '/media/assets');
    expect(media.json.assets.map((r) => r.id)).not.toContain(state.workspaceAssetId);
    const projects = await api(page, 'GET', '/records/ProducaoProjeto?limit=500');
    expect(projects.json.records.map((r) => r.titulo)).not.toContain(state.projectTitle);
    for (const path of [
      `/records/Asset/${state.videoAssetId}`,
      `/records/ProducaoProjeto/${state.projectId}`,
      ...(state.scriptId ? [`/records/Script/${state.scriptId}`] : []),
      ...(state.workspaceAssetId ? [`/media/assets/${state.workspaceAssetId}/stream`] : []),
    ]) {
      expect((await api(page, 'GET', path)).status, `GET ${path} como empresa B`).toBe(404);
    }
    const patch = await api(page, 'PATCH', `/records/ProducaoProjeto/${state.projectId}`, { data: { titulo: 'invadido' } });
    expect(patch.status, 'PATCH na produção de A como B').toBe(404);
    const del = await api(page, 'DELETE', `/records/Asset/${state.videoAssetId}`);
    expect(del.status, 'DELETE no asset de A como B').toBe(404);

    // UI: Acervo, produção, roteiros e Timeline da empresa B não mostram os itens de A.
    await page.goto('/acervo');
    await page.getByPlaceholder('Buscar por título, nome, pessoa, assunto...').fill(state.videoName);
    await expect(page.getByRole('row').filter({ hasText: state.videoName })).toHaveCount(0);
    await openSub(page, 'rascunhos');
    await expect(page.getByText(state.projectTitle)).toHaveCount(0);
    await openSub(page, 'em_edicao');
    await expect(page.getByText(state.projectTitle)).toHaveCount(0);
    await page.goto('/roteiro2');
    await expect(page.getByRole('heading', { name: 'Roteiro 2' })).toBeVisible();
    await expect(page.getByText(`Roteiro E2E ${process.env.E2E_RUN_ID}`)).toHaveCount(0);
    await expect(page.getByText(state.videoName)).toHaveCount(0);
    await page.goto('/timeline2');
    await page.getByRole('button', { name: 'Acervo', exact: true }).click();
    await expect(page.getByText(/e2e-video-/)).toHaveCount(0);

    // A produção de A continua intacta.
    await page.getByRole('button', { name: 'Sair' }).click();
    await login(page, a.email);
    const original = await api(page, 'GET', `/records/ProducaoProjeto/${state.projectId}`);
    expect(original.status).toBe(200);
    expect(original.json.titulo).toBe(state.projectTitle);
  });
});
