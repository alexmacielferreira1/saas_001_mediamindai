import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('./httpClient', () => ({ request: (...args) => request(...args) }));

import {
  createIngestPackage, getIngestSource, importNextIngestFile, listIngestPackages, retryIngestPackage, runIngestPackage,
} from './ingest';

const pkg = (statuses, status = 'processing') => ({ id: 'p 1', status, items: statuses.map((item) => ({ status: item })) });

describe('API do Ingest pela pasta de referência', () => {
  beforeEach(() => request.mockReset());

  it('chama as rotas do servidor', async () => {
    request.mockResolvedValue({ packages: [{ id: 'a' }] });
    await getIngestSource();
    expect(await listIngestPackages()).toEqual([{ id: 'a' }]);
    await createIngestPackage({ name: 'Lote', files: ['a.mp4'] });
    await importNextIngestFile('p 1');
    await retryIngestPackage('p 1');
    expect(request.mock.calls).toEqual([
      ['/ingest/source'],
      ['/ingest/packages'],
      ['/ingest/packages', { method: 'POST', body: { name: 'Lote', files: ['a.mp4'] } }],
      ['/ingest/packages/p%201/import-next', { method: 'POST' }],
      ['/ingest/packages/p%201/retry', { method: 'POST' }],
    ]);
  });

  it('importa um arquivo por vez até acabar os pendentes', async () => {
    request
      .mockResolvedValueOnce(pkg(['imported', 'pending']))
      .mockResolvedValueOnce(pkg(['imported', 'imported'], 'completed'));
    const updates = [];
    const done = await runIngestPackage(pkg(['pending', 'pending']), { onUpdate: (value) => updates.push(value.status) });
    expect(done.status).toBe('completed');
    expect(updates).toEqual(['processing', 'completed']);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('não fica preso quando o que resta está sendo copiado por outra aba', async () => {
    const done = await runIngestPackage(pkg(['imported', 'importing']));
    expect(done.status).toBe('processing');
    expect(request).not.toHaveBeenCalled();
  });
});
