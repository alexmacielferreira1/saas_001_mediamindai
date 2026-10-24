import fs from 'node:fs';
import path from 'node:path';
import { test, expect, accounts, login, api, writeState, readState, RUN_DIR } from '../support/fixtures.js';
import { generateFixtures } from '../support/media.js';

const RUN = process.env.E2E_RUN_ID || 'manual';

/** Documento salvo da Timeline 2 (o editor grava a cada alteração no localStorage da empresa/usuário). */
async function timelineDoc(page) {
  return page.evaluate(() => {
    const docs = Object.keys(localStorage)
      .filter((key) => key.includes('mm_timeline2_project:'))
      .map((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } })
      .filter((doc) => doc?.tracks);
    docs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return docs[0] || null;
  });
}
const clipButtons = (page, trackId) => page.getByTestId(`timeline2-track-${trackId}`).locator('button[title^="Arraste para mover"]');
const clipsOf = (doc, trackId) => doc.tracks.find((t) => t.id === trackId)?.clips || [];

test.describe('4a. Workspace → Timeline (edição não destrutiva)', () => {
  test('importa a mídia, vincula áudio, move, corta, apara, desfaz/refaz, título, salva, recarrega e exporta', async ({ page, monitor }) => {
    const files = await generateFixtures(page, RUN);
    const videoName = path.basename(files.video);
    await login(page, accounts().a.email);
    await page.goto('/workspace');
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

    // 1. Importar mídia: envia ao Acervo (rota de mídia) e seleciona para o projeto.
    const upload = page.waitForResponse((r) => /\/api\/v1\/media\/assets$/.test(r.url()) && r.request().method() === 'POST');
    await page.getByLabel('Importar mídias').setInputFiles(files.video);
    const uploaded = await upload;
    expect(uploaded.status()).toBe(201);
    const asset = await uploaded.json();
    writeState({ workspaceAssetId: asset.id });
    await expect(page.getByText('1 arquivo(s) enviados ao Acervo e selecionados para o projeto.')).toBeVisible();
    // A mídia enviada é reproduzível (stream do servidor com o mesmo tamanho).
    const stream = await page.request.get(asset.stream_url);
    expect(stream.status()).toBe(200);
    expect((await stream.body()).length).toBe(fs.statSync(files.video).size);

    // 2. Etapa Timeline: a mídia selecionada vira clipe em V1 com duração real (≈3 s).
    await page.getByRole('button', { name: /Timeline/ }).first().click();
    const videoClip = clipButtons(page, 'v1').filter({ hasText: videoName.replace(/\.webm$/, '') }).first();
    await expect(videoClip).toBeVisible();
    let doc = await timelineDoc(page);
    expect(clipsOf(doc, 'v1')).toHaveLength(1);
    const [v] = clipsOf(doc, 'v1');
    expect(v.assetId).toBe(asset.id);
    expect.soft(v.duration, 'duração do clipe = duração real do vídeo (~3 s)').toBeLessThan(4.5);

    // 3. Vídeo + áudio vinculados: o Workspace já separa o áudio original em A1, vinculado ao vídeo.
    const audio = clipsOf(doc, 'a1')[0];
    expect(audio, 'clipe de áudio em A1').toBeTruthy();
    expect(audio.linkedTo).toBe(v.id);
    expect(audio.start).toBe(v.start);
    expect(audio.duration).toBe(v.duration);
    expect(v.properties.audioDisabled, 'vídeo com o áudio separado (não toca em dobro)').toBe(true);
    await expect(clipButtons(page, 'a1')).toHaveCount(1);

    // 4. Mover: arrasta o vídeo para a direita; o áudio vinculado acompanha.
    await videoClip.scrollIntoViewIfNeeded();
    const box = await videoClip.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    doc = await timelineDoc(page);
    const moved = clipsOf(doc, 'v1')[0];
    expect(moved.start).toBeGreaterThan(0);
    expect.soft(clipsOf(doc, 'a1')[0].start, 'áudio vinculado acompanha o vídeo ao arrastar').toBeCloseTo(moved.start, 3);

    // 5. Cortar: posiciona a agulha no meio do clipe e divide.
    const playheadTarget = moved.start + moved.duration / 2;
    const ruler = page.getByRole('slider', { name: 'Régua e agulha da timeline' });
    await ruler.scrollIntoViewIfNeeded();
    const rulerBox = await ruler.boundingBox();
    const pps = rulerBox.width / Number(await ruler.getAttribute('aria-valuemax'));
    await page.mouse.click(rulerBox.x + playheadTarget * pps, rulerBox.y + rulerBox.height / 2);
    await clipButtons(page, 'v1').first().click({ position: { x: 4, y: 6 } });
    await page.getByRole('button', { name: 'Dividir clipe' }).click();
    doc = await timelineDoc(page);
    expect(clipsOf(doc, 'v1'), 'vídeo dividido em 2 clipes').toHaveLength(2);
    const afterSplit = clipsOf(doc, 'v1').map((c) => c.duration);

    // 6. Aparar: com o primeiro pedaço selecionado, apara o fim um pouco antes da agulha.
    await page.mouse.click(rulerBox.x + (moved.start + 0.3) * pps, rulerBox.y + rulerBox.height / 2);
    await clipButtons(page, 'v1').first().click({ position: { x: 4, y: 6 } });
    await page.getByRole('button', { name: 'Aparar fim no playhead' }).click();
    doc = await timelineDoc(page);
    const trimmed = clipsOf(doc, 'v1')[0].duration;
    expect(trimmed).toBeLessThan(afterSplit[0]);

    // 7. Desfazer / refazer.
    await page.getByRole('button', { name: 'Desfazer' }).click();
    doc = await timelineDoc(page);
    expect(clipsOf(doc, 'v1')[0].duration).toBeCloseTo(afterSplit[0], 3);
    await page.getByRole('button', { name: 'Refazer' }).click();
    doc = await timelineDoc(page);
    expect(clipsOf(doc, 'v1')[0].duration).toBeCloseTo(trimmed, 3);

    // 8. Título: adiciona um texto no playhead (trilha de texto).
    await page.getByRole('navigation', { name: 'Módulos do editor' }).getByRole('button', { name: 'Texto' }).click();
    await page.getByLabel('Texto do elemento').fill(`Título E2E ${RUN}`);
    await page.getByRole('button', { name: 'Adicionar no playhead' }).click();
    doc = await timelineDoc(page);
    const texts = doc.tracks.filter((t) => t.kind === 'text').flatMap((t) => t.clips);
    expect(texts.map((c) => c.properties?.text)).toContain(`Título E2E ${RUN}`);
    const snapshot = JSON.stringify(doc.tracks);

    // 9. Salvar, recarregar e conferir que a edição persistiu.
    await page.getByRole('button', { name: 'Salvar projeto' }).first().click();
    await page.reload();
    await expect(page.getByTestId('timeline2-track-v1')).toBeVisible();
    doc = await timelineDoc(page);
    expect(JSON.stringify(doc.tracks)).toBe(snapshot);
    await expect(clipButtons(page, 'v1')).toHaveCount(2);

    // 10. Exportar sequência: gera MP4 pelo servidor (FFmpeg) ou informa honestamente a falta dele.
    monitor.allowHttp(503, '/api/v1/media/exports/timeline');
    const exportResponse = page.waitForResponse((r) => r.url().includes('/media/exports/timeline'));
    const download = page.waitForEvent('download', { timeout: 60_000 }).catch(() => null);
    await page.getByRole('button', { name: 'Exportar sequência' }).click();
    const response = await exportResponse;
    if (response.status() === 503) {
      await expect(page.getByRole('status').filter({ hasText: 'O motor local de exportação não está disponível.' })).toBeVisible();
      writeState({ timelineExport: 'ffmpeg-ausente' });
    } else {
      expect(response.status()).toBe(200);
      const file = await download;
      expect(file).toBeTruthy();
      const target = path.join(RUN_DIR, 'exports', file.suggestedFilename());
      await file.saveAs(target);
      expect(fs.statSync(target).size).toBeGreaterThan(1000);
      writeState({ timelineExport: target });
    }
  });
});

test.describe('4b. MMFilm (Ferramentas Gráficas)', () => {
  const lane = (page, id) => page.locator(`[data-track-id="${id}"]`);
  const clips = (page, id) => page.locator(`[data-track-id="${id}"] > button`);
  const lefts = (page, id) => clips(page, id).evaluateAll((nodes) => nodes.map((n) => Number.parseFloat(n.style.left)));
  async function answer(page, label, value) {
    const dialog = page.getByRole('dialog', { name: label });
    await dialog.getByRole('textbox').fill(value);
    await dialog.getByRole('textbox').press('Enter');
    await expect(dialog).toBeHidden();
  }

  test('importa, monta vídeo+áudio vinculados, move, corta, desfaz/refaz, título, salva, recarrega e exporta WebM', async ({ page }) => {
    test.setTimeout(240_000);
    const files = await generateFixtures(page, RUN);
    const videoName = path.basename(files.video);
    await login(page, accounts().a.email);
    await page.goto('/ferramentas-graficas');
    await page.getByRole('button', { name: 'MMFilm' }).first().click();
    const mediaInput = page.locator('input[type="file"][accept="video/*,audio/*,image/*"]').first();
    await mediaInput.setInputFiles(files.video);
    await expect(page.getByText('1 mídia(s) importada(s) ou religada(s)')).toBeVisible();

    // Importar para a timeline: arrasta da pasta do projeto para V1 → par vídeo (V1) + áudio vinculado (A1).
    await page.getByText(videoName).first().dragTo(lane(page, 'V1'), { targetPosition: { x: 24, y: 10 } });
    await expect(clips(page, 'V1')).toHaveCount(1);
    await expect(clips(page, 'A1'), 'áudio vinculado criado em A1').toHaveCount(1);
    const [v0] = await lefts(page, 'V1');
    expect(await lefts(page, 'A1')).toEqual([v0]);

    // Mover: arrasta o clipe de vídeo; o áudio vinculado acompanha.
    await clips(page, 'V1').first().dragTo(lane(page, 'V1'), { sourcePosition: { x: 4, y: 8 }, targetPosition: { x: v0 + 124, y: 10 } });
    const [v1] = await lefts(page, 'V1');
    expect(v1).toBeGreaterThan(v0 + 60);
    expect(await lefts(page, 'A1'), 'áudio vinculado acompanha o vídeo').toEqual([v1]);

    // Cortar (Razor) no meio: divide vídeo e áudio.
    await page.getByRole('button', { name: 'Razor (C)' }).click();
    const box = await clips(page, 'V1').first().boundingBox();
    await clips(page, 'V1').first().click({ position: { x: Math.round(box.width / 2), y: 8 } });
    await expect(clips(page, 'V1')).toHaveCount(2);
    await expect(clips(page, 'A1')).toHaveCount(2);

    // Desfazer / refazer.
    await page.getByRole('button', { name: 'Desfazer', exact: true }).first().click();
    await expect(clips(page, 'V1')).toHaveCount(1);
    await expect(clips(page, 'A1')).toHaveCount(1);
    await page.getByRole('button', { name: 'Refazer', exact: true }).first().click();
    await expect(clips(page, 'V1')).toHaveCount(2);

    // Título: ferramenta Texto em V2.
    await page.getByRole('button', { name: 'Texto (T)' }).click();
    await lane(page, 'V2').click({ position: { x: Math.round(v1) + 10, y: 10 } });
    await answer(page, 'Texto do título', `Título MMFilm ${RUN}`);
    await expect(clips(page, 'V2')).toHaveCount(1);
    await expect(clips(page, 'V2').first()).toContainText(`Título MMFilm ${RUN}`);
    await page.getByRole('button', { name: 'Seleção (V)' }).click();

    // Salvar, recarregar a página e reabrir o projeto salvo.
    await page.getByRole('button', { name: 'Salvar como' }).click();
    await answer(page, 'Nome do projeto', `MMFilm E2E ${RUN}`);
    await expect(page.getByText(/salvo no navegador/)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'MMFilm' }).first().click();
    await page.getByRole('button', { name: 'Recarregar', exact: true }).click();
    await expect(page.getByText(/Projeto recarregado · 5 clipes/)).toBeVisible();
    await expect(clips(page, 'V1')).toHaveCount(2);
    await expect(clips(page, 'A1')).toHaveCount(2);
    await expect(clips(page, 'V2').first()).toContainText(`Título MMFilm ${RUN}`);

    // A mídia do computador precisa ser religada após recarregar; depois exporta WebM real.
    await mediaInput.setInputFiles(files.video);
    await page.getByRole('button', { name: 'Exportar', exact: true }).first().click();
    const download = page.waitForEvent('download', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Exportar', exact: true }).and(page.locator('[title]')).click();
    const file = await download;
    const target = path.join(RUN_DIR, 'exports', file.suggestedFilename());
    await file.saveAs(target);
    expect(file.suggestedFilename()).toMatch(/\.webm$/);
    expect(fs.statSync(target).size).toBeGreaterThan(5_000);
    await expect(page.getByText('Concluído')).toBeVisible();
    writeState({ mmfilmExport: target });
  });
});
