import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./httpClient', () => ({ request: vi.fn() }));
import { request } from './httpClient';
import { base44 } from './base44Client';

describe('local entity compatibility client', () => {
  beforeEach(() => request.mockReset());

  it('maps list and filter to tenant record endpoints', async () => {
    request.mockResolvedValueOnce({ records: [{ id: '1' }] }).mockResolvedValueOnce({ records: [{ id: '2' }] });
    await expect(base44.entities.AgendaEvento.list('ordem', 20)).resolves.toEqual([{ id: '1' }]);
    await expect(base44.entities.AgendaEvento.filter({ status: 'open' }, '-ordem', 10)).resolves.toEqual([{ id: '2' }]);
    expect(request).toHaveBeenNthCalledWith(1, '/records/AgendaEvento?sort=ordem&limit=20');
    expect(request).toHaveBeenNthCalledWith(2, '/records/AgendaEvento/query', {
      method: 'POST', body: { filters: { status: 'open' }, sort: '-ordem', limit: 10 },
    });
  });

  it('notifies subscribers after a local mutation', async () => {
    const listener = vi.fn();
    const unsubscribe = base44.entities.AgendaEvento.subscribe(listener);
    request.mockResolvedValue({ id: '1', titulo: 'Pauta' });
    await base44.entities.AgendaEvento.create({ titulo: 'Pauta' });
    expect(listener).toHaveBeenCalledWith({ type: 'create', data: { id: '1', titulo: 'Pauta' } });
    unsubscribe();
  });
});
