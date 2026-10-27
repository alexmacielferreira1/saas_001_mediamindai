import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAdminUsers } from '../../../api/admin';
import { createPageEnv } from './pageMcpEnv';

vi.mock('../../../api/admin', () => ({ listAdminUsers: vi.fn(), listAdminActivity: vi.fn().mockResolvedValue(null) }));
vi.mock('../../../api/media', () => ({ listMediaAssets: vi.fn().mockResolvedValue(null) }));
vi.mock('../../../api/base44Client', () => ({ base44: { entities: { Clip: { list: vi.fn().mockResolvedValue(null) } } } }));

const env = (pathname = '/corp', search = '?tab=produtor&sub=ingest') =>
  createPageEnv({ location: { pathname, search }, navigate: vi.fn(), ask: vi.fn() });

describe('createPageEnv', () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it('keeps the corp role in every page link and opens ingest inside corp', () => {
    const corp = env();
    expect(corp.corpUrl('em_edicao')).toBe('/corp?tab=produtor&sub=em_edicao');
    expect(corp.corpUrl('workspace', 'assetId=1')).toBe('/corp?tab=produtor&sub=workspace&assetId=1');
    expect(corp.ingestUrl('novo=pacote')).toBe('/corp?tab=produtor&sub=ingest&novo=pacote');
    expect(env('/ingest', '').ingestUrl('novo=pacote')).toBe('/ingest?novo=pacote');
    expect(env('/corp', '').corpUrl('overview')).toBe('/corp?sub=overview');
  });

  it('reads every page of users instead of cutting at 100', async () => {
    listAdminUsers
      .mockResolvedValueOnce({ items: Array.from({ length: 100 }, (_, i) => ({ id: i })), total: 150 })
      .mockResolvedValueOnce({ items: Array.from({ length: 50 }, (_, i) => ({ id: 100 + i })), total: 150 });
    expect(await env().adminUsers()).toHaveLength(150);
    expect(listAdminUsers).toHaveBeenLastCalledWith({ page: 2, pageSize: 100 });
  });

  it('returns empty lists when the API answers nothing', async () => {
    const corp = env();
    expect(await corp.assets()).toEqual([]);
    expect(await corp.records('Clip')).toEqual([]);
    expect(await corp.auditLogs(10)).toEqual([]);
  });

  it('downloads the CSV only when the server really answers a CSV', async () => {
    const csv = new Response('a;b', { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(csv));
    expect(await (await env().fetchBlob('/ai/usage/export.csv?days=7')).text()).toBe('a;b');
    expect(fetch).toHaveBeenCalledWith('/api/v1/ai/usage/export.csv?days=7', { credentials: 'include' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    await expect(env().fetchBlob('/x')).rejects.toThrow('não devolveu um arquivo CSV');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    await expect(env().fetchBlob('/x')).rejects.toThrow('Sem permissão');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(env().fetchBlob('/x')).rejects.toThrow('Falha ao baixar (500)');
  });

  it('reads the agency prototype data and survives invalid content', () => {
    localStorage.setItem('mediamind_agencia_video_prototipo_v1', JSON.stringify({ leads: [{ nome: 'A' }] }));
    expect(env().agencyData().leads).toHaveLength(1);
    localStorage.setItem('mediamind_agencia_video_prototipo_v1', '{quebrado');
    expect(env().agencyData()).toEqual({});
    localStorage.setItem('mediamind_agencia_video_prototipo_v1', 'null');
    expect(env().agencyData()).toEqual({});
  });
});
