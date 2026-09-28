import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();
const readDemoMock = vi.fn();

vi.mock('./httpClient', () => ({ request: (...args) => requestMock(...args) }));
vi.mock('../mediamind/lib/demoAccess', () => ({
  readLocalDemoSession: (...args) => readDemoMock(...args),
}));

describe('compatibility entity client', () => {
  beforeEach(() => {
    vi.resetModules();
    requestMock.mockReset();
    readDemoMock.mockReset();
    localStorage.clear();
  });

  it('keeps local demo entity operations in memory without protected HTTP calls', async () => {
    readDemoMock.mockReturnValue({ id: 'demo-editor' });
    const { base44 } = await import('./base44Client');

    await expect(base44.entities.AgendaEvento.list('ordem', 20)).resolves.toEqual([]);
    const created = await base44.entities.AgendaEvento.create({ titulo: 'Pauta demo' });
    await expect(base44.entities.AgendaEvento.list('ordem', 20)).resolves.toEqual([created]);
    await expect(base44.entities.AgendaEvento.update(created.id, { titulo: 'Pauta revisada' }))
      .resolves.toEqual(expect.objectContaining({ titulo: 'Pauta revisada' }));
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('restores local demo entities after the application reloads', async () => {
    readDemoMock.mockReturnValue({ id: 'demo-editor' });
    const firstClient = (await import('./base44Client')).base44;
    const created = await firstClient.entities.ProducaoProjeto.create({ titulo: 'Produção persistida', etapa: 'rascunho' });

    vi.resetModules();
    const reloadedClient = (await import('./base44Client')).base44;

    await expect(reloadedClient.entities.ProducaoProjeto.list('ordem', 20)).resolves.toEqual([created]);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('uses the backend when there is no local demo session', async () => {
    readDemoMock.mockReturnValue(null);
    requestMock.mockResolvedValue({ records: [{ id: 'record-1' }] });
    const { base44 } = await import('./base44Client');

    await expect(base44.entities.Asset.list('ordem', 20)).resolves.toEqual([{ id: 'record-1' }]);
    expect(requestMock).toHaveBeenCalledWith('/records/Asset?sort=ordem&limit=20');
  });

  it('routes legacy AI functions through the local backend adapter', async () => {
    readDemoMock.mockReturnValue(null);
    requestMock.mockResolvedValue({ data: { reply: 'ok' } });
    const { base44 } = await import('./base44Client');

    await expect(base44.functions.invoke('assistente_ia', { message: 'Olá' }))
      .resolves.toEqual({ data: { reply: 'ok' } });
    expect(requestMock).toHaveBeenCalledWith('/ai/functions/assistente_ia', {
      method: 'POST',
      body: { message: 'Olá' },
    });
  });

  it('reports AI as unavailable in local demo mode without calling the backend', async () => {
    readDemoMock.mockReturnValue({ id: 'demo-editor' });
    const { base44 } = await import('./base44Client');

    await expect(base44.functions.invoke('assistente_ia', { message: 'Olá' }))
      .rejects.toThrow('IA ainda não configurada no modo demo.');
    expect(requestMock).not.toHaveBeenCalled();
  });
});
