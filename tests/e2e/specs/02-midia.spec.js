import path from 'node:path';
import { test, expect, accounts, login, api, writeState, readState } from '../support/fixtures.js';
import { generateFixtures } from '../support/media.js';

const RUN = process.env.E2E_RUN_ID || 'manual';

test.describe('2. Inserir mídia (Ingest → Acervo → busca)', () => {
  test('envia vídeo e imagem pelo Ingest; aparecem no Acervo com metadados e a busca encontra', async ({ page }) => {
    const files = await generateFixtures(page, RUN);
    const videoName = path.basename(files.video);
    const imageName = path.basename(files.image);
    await login(page, accounts().a.email);

    await page.goto('/ingest');
    await expect(page.getByRole('heading', { name: 'Nova Ingestão' })).toBeVisible();
    await page.getByPlaceholder('Sem nome — você poderá alterar depois').fill(`Pacote E2E ${RUN}`);
    await page.getByRole('button', { name: 'Criar pacote e continuar →' }).click();
    await page.locator('input[type="file"]:not([accept])').setInputFiles([files.video, files.image]);
    await expect(page.getByText(videoName)).toBeVisible();
    await expect(page.getByText(imageName)).toBeVisible();
    await page.getByRole('button', { name: 'Criar pacote e continuar →' }).click();
    const uploads = [];
    // Fluxo corrigido (B3): POST /media/assets (arquivo + Asset do servidor) e PATCH do Asset com os dados do pacote.
    page.on('response', (r) => { if (['POST', 'PATCH'].includes(r.request().method()) && /\/api\/v1\/(uploads|media\/assets|records\/Asset)/.test(r.url())) uploads.push(r.status()); });
    await page.getByRole('button', { name: 'Iniciar envio' }).click();
    await expect.poll(() => uploads.length, { timeout: 30_000 }).toBe(4);
    expect(uploads.every((s) => s === 200 || s === 201)).toBe(true);

    // Persistência: o registro existe no servidor, com tipo, tamanho e pacote.
    const list = await api(page, 'GET', '/records/Asset?limit=200');
    expect(list.status).toBe(200);
    const items = list.json.records;
    const video = items.find((it) => it.filename === videoName);
    const image = items.find((it) => it.filename === imageName);
    expect(video, 'Asset do vídeo gravado no servidor').toBeTruthy();
    expect(image, 'Asset da imagem gravado no servidor').toBeTruthy();
    const vd = video;
    expect(vd.asset_type).toBe('video');
    expect(vd.file_size).toBeGreaterThan(1000);
    expect(vd.package_name).toBe(`Pacote E2E ${RUN}`);
    expect(image.asset_type).toBe('image');
    writeState({ videoAssetId: video.id, imageAssetId: image.id, videoName, imageName });

    // O arquivo enviado pode ser baixado de volta (mesmo tamanho).
    const fileUrl = vd.file_url;
    const download = await page.request.get(fileUrl);
    expect(download.status()).toBe(200);
    expect((await download.body()).length).toBe(vd.file_size);

    // Acervo (após recarregar) lista os dois arquivos com metadados, e a busca encontra.
    await page.goto('/acervo');
    const search = page.getByPlaceholder('Buscar por título, nome, pessoa, assunto...');
    await search.fill(`e2e-video-${RUN}`);
    const row = page.getByRole('row').filter({ hasText: videoName });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/video/i);
    await expect(page.getByRole('row').filter({ hasText: imageName })).toHaveCount(0);
    await search.fill(`e2e-imagem-${RUN}`);
    await expect(page.getByRole('row').filter({ hasText: imageName })).toBeVisible();
    // Contadores do Acervo refletem os arquivos reais da empresa.
    await search.fill('');
    await expect(page.getByText('Total de arquivos', { exact: false }).locator('..')).toContainText('2');
  });

  test('busca global (/search) encontra o vídeo enviado e abre o detalhe dele', async ({ page }) => {
    const { videoName } = readState();
    expect(videoName, 'depende do upload do teste anterior nesta execução').toBeTruthy();
    await login(page, accounts().a.email);
    await page.goto('/search');
    await page.getByRole('textbox', { name: 'Pesquisar no acervo' }).fill(`e2e-video-${RUN}`);
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.getByText('1 resultado(s)')).toBeVisible();
    await page.getByText(videoName).first().click();
    // O painel de detalhe mostra a mídia encontrada (o Ingest usa o nome do arquivo como título).
    await expect(page.getByRole('heading', { name: videoName })).toBeVisible();
  });
});
