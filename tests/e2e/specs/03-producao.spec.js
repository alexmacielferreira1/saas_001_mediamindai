import { test, expect, accounts, login, api, writeState, readState } from '../support/fixtures.js';
import { advanceViaCard, findProject, openSub, stageCard } from '../support/production.js';
import { generateFixtures } from '../support/media.js';

const RUN = process.env.E2E_RUN_ID || 'manual';
const TITLE = `Produção E2E ${RUN}`;
const SCRIPT_TITLE = `Roteiro E2E ${RUN}`;

test.describe('3. Fluxo de produção (produção → pesquisa/roteiro → edição)', () => {
  test('cria a produção em Rascunhos e ela persiste no servidor após recarregar', async ({ page }) => {
    await login(page, accounts().a.email);
    await openSub(page, 'rascunhos');
    const created = page.waitForResponse((r) => r.url().endsWith('/records/ProducaoProjeto') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Novo rascunho' }).click();
    expect((await created).status()).toBe(201);
    const titleInput = page.getByLabel('Título de trabalho');
    await expect(titleInput).toHaveValue('Nova produção');
    await titleInput.fill(TITLE);
    await page.getByLabel('Convidado — nome').fill('Convidada E2E');
    await expect.poll(async () => (await findProject(page, TITLE))?.convidado_nome, { timeout: 15_000 }).toBe('Convidada E2E');

    await page.reload();
    await openSub(page, 'rascunhos');
    await expect(stageCard(page, TITLE)).toBeVisible();
    const project = await findProject(page, TITLE);
    writeState({ projectId: project.id, projectTitle: TITLE });
    expect(project.etapa).toBe('rascunho');
    // O registro deve carregar a empresa ativa (a busca global ⌘K filtra por empresa_id).
    expect(project.empresa_id, 'empresa_id gravado na produção').toBe(accounts().a.tenant_id);
  });

  test('pesquisa no acervo e cria/salva um roteiro vinculado à mídia (Roteiro 2)', async ({ page }) => {
    const { videoName, videoAssetId } = readState();
    expect(videoAssetId, 'depende do upload do cenário 2').toBeTruthy();
    await login(page, accounts().a.email);
    await page.goto('/roteiro2');
    await expect(page.getByRole('heading', { name: 'Roteiro 2' })).toBeVisible();
    // Pesquisa: a biblioteca filtra pelas mídias do acervo da empresa.
    await page.getByPlaceholder(/Buscar|Pesquisar/).first().fill(`e2e-video-${RUN}`);
    await expect(page.getByText(videoName).first()).toBeVisible();

    await page.getByRole('button', { name: 'Novo roteiro 2' }).click();
    const dialog = page.getByRole('dialog', { name: 'Editor de Roteiro 2' });
    await dialog.getByLabel('Título *').fill(SCRIPT_TITLE);
    await dialog.getByLabel('Programa').fill('Programa E2E');
    await dialog.getByLabel('Descrição').fill('Roteiro criado pelo teste E2E.');
    await dialog.getByLabel(videoName).check();
    const saved = page.waitForResponse((r) => r.url().endsWith('/records/Script') && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Salvar rascunho' }).click();
    expect((await saved).status()).toBe(201);
    await expect(page.getByText('Roteiro 2 salvo como rascunho.')).toBeVisible();

    await page.reload();
    await expect(page.getByText(SCRIPT_TITLE)).toBeVisible();
    const { json } = await api(page, 'GET', '/records/Script?limit=200');
    const script = json.records.find((s) => s.title === SCRIPT_TITLE);
    expect(script).toBeTruthy();
    expect(script.asset_ids).toContain(videoAssetId);
    writeState({ scriptId: script.id });
  });

  test('a produção passa por agendamento, gravação (com material) e chega à Edição', async ({ page }) => {
    const { projectTitle } = readState();
    expect(projectTitle, 'depende da produção criada neste cenário').toBeTruthy();
    const files = await generateFixtures(page, RUN);
    await login(page, accounts().a.email);
    // Rascunho → Agendamentos (botão do card).
    await advanceViaCard(page, projectTitle, 'rascunhos', 'agendamentos');

    // Agendamentos: preenche data/horário e confirma → Gravações.
    await openSub(page, 'agendamentos');
    await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
    await page.getByLabel('Data', { exact: true }).fill('2026-11-05');
    await page.getByLabel('Horário', { exact: true }).fill('10:30');
    await expect.poll(async () => (await findProject(page, projectTitle))?.gravacao_horario).toBe('10:30');
    await page.getByRole('button', { name: 'Confirmar e enviar para Gravações' }).click();
    await expect.poll(async () => (await findProject(page, projectTitle))?.etapa).toBe('gravacoes');

    // Gravações: registra a gravação, recebe o material (upload real) e o editor puxa para editar.
    await openSub(page, 'gravacoes');
    await page.getByRole('button', { name: new RegExp(projectTitle) }).first().click();
    await page.getByRole('button', { name: 'Registrar gravação concluída' }).click();
    await expect.poll(async () => (await findProject(page, projectTitle))?.grav_status).toBe('gravada');
    const upload = page.waitForResponse((r) => /\/media\/assets$/.test(r.url()) && r.request().method() === 'POST');
    await page.locator('label', { hasText: 'Ingest de arquivos' }).locator('input[type="file"]').setInputFiles(files.video);
    expect((await upload).status()).toBe(201);
    await expect.poll(async () => (await findProject(page, projectTitle))?.materiais?.length || 0).toBe(1);
    await page.getByRole('button', { name: 'Puxar pra editar (atribui a você)' }).click();
    await expect.poll(async () => (await findProject(page, projectTitle))?.etapa).toBe('para_editar');

    // Edição: inicia a edição (fila Em edição).
    await openSub(page, 'em_edicao');
    await page.getByRole('button', { name: /Para editar/ }).first().click();
    await expect(page.getByLabel('Projeto aberto')).toContainText(projectTitle);
    if (!(await page.getByRole('button', { name: 'Iniciar edição' }).isVisible())) await page.getByRole('button', { name: 'Mostrar fila e detalhes' }).click();
    await page.getByRole('button', { name: 'Iniciar edição' }).click();
    await expect.poll(async () => (await findProject(page, projectTitle))?.etapa).toBe('em_edicao');
    await page.reload();
    await openSub(page, 'em_edicao');
    await expect(page.getByLabel('Projeto aberto')).toContainText(projectTitle);
    const project = await findProject(page, projectTitle);
    expect(project.historico.map((h) => h.etapa)).toEqual(expect.arrayContaining(['gravacoes', 'para_editar']));
  });
});
