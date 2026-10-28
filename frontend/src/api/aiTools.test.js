import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./httpClient', () => ({ request: (...args) => request(...args) }));

import { askAssistant, generateScript, resolveTasks, suggestAccess } from './aiTools';

describe('API das ferramentas de IA', () => {
  beforeEach(() => { request.mockReset(); request.mockResolvedValue({}); });

  it('envia cada pedido para a rota real com os nomes do servidor', async () => {
    await generateScript({ prompt: 'Abertura', audioUrl: '/api/v1/uploads/a.webm', context: { titulo: 'X' } });
    await generateScript({});
    await askAssistant({ message: 'oi', history: [{ role: 'user', content: 'a' }], roleLabel: 'Editor', userName: 'Ana', destinations: [{ path: '/ingest' }] });
    await askAssistant({});
    await resolveTasks({ segment: 'edicao', prompt: 'finalize', pendencias: [{ id: 1 }] });
    await resolveTasks({});
    await suggestAccess({ userName: 'Marina', prompt: 'videomaker', audioUrl: '/a', screens: [{ id: 's' }], cargos: [{ id: 'c' }] });
    await suggestAccess({});

    expect(request.mock.calls).toEqual([
      ['/ai/tools/script', { method: 'POST', body: { prompt: 'Abertura', audio_url: '/api/v1/uploads/a.webm', context: { titulo: 'X' } } }],
      ['/ai/tools/script', { method: 'POST', body: { prompt: '', audio_url: null, context: {} } }],
      ['/ai/tools/assistant', { method: 'POST', body: { message: 'oi', audio_url: null, history: [{ role: 'user', content: 'a' }], role_label: 'Editor', user_name: 'Ana', destinations: [{ path: '/ingest' }] } }],
      ['/ai/tools/assistant', { method: 'POST', body: { message: '', audio_url: null, history: [], role_label: '', user_name: '', destinations: [] } }],
      ['/ai/tools/tasks', { method: 'POST', body: { segment: 'edicao', prompt: 'finalize', audio_url: null, pendencias: [{ id: 1 }] } }],
      ['/ai/tools/tasks', { method: 'POST', body: { segment: '', prompt: '', audio_url: null, pendencias: [] } }],
      ['/ai/tools/access', { method: 'POST', body: { user_name: 'Marina', prompt: 'videomaker', audio_url: '/a', screens: [{ id: 's' }], cargos: [{ id: 'c' }] } }],
      ['/ai/tools/access', { method: 'POST', body: { user_name: '', prompt: '', audio_url: null, screens: [], cargos: [] } }],
    ]);
  });
});
