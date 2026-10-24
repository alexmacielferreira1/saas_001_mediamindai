import { expect } from '@playwright/test';
import { api } from './fixtures.js';

export async function findProject(page, title) {
  const { status, json } = await api(page, 'GET', '/records/ProducaoProjeto?limit=500');
  expect(status).toBe(200);
  return json.records.find((r) => r.titulo === title) || null;
}

export async function openSub(page, sub) {
  await page.goto(`/corp?tab=producao&sub=${sub}`);
  await page.waitForLoadState('networkidle');
}

/** Card do pipeline (DraggableStageCard) que contém o título da produção. */
export function stageCard(page, title) {
  return page.locator('div[draggable="true"]').filter({ hasText: title }).first();
}

/** Avança a produção uma etapa pelo botão "Enviar para <próxima etapa>" do card e confere no servidor. */
export async function advanceViaCard(page, title, sub, expectedStage) {
  await openSub(page, sub);
  const card = stageCard(page, title);
  await expect(card, `card “${title}” visível na fila ${sub}`).toBeVisible();
  const saved = page.waitForResponse((r) => /\/records\/ProducaoProjeto\//.test(r.url()) && r.request().method() === 'PATCH');
  await card.getByRole('button', { name: /^Enviar para / }).click();
  const response = await saved;
  expect(response.status(), `PATCH etapa → ${expectedStage}`).toBe(200);
  await expect.poll(async () => (await findProject(page, title))?.etapa).toBe(expectedStage);
}
