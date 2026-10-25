import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_ASSETS,
  DEMO_MANAGEMENT_OVERVIEW,
  DEMO_MEMBERSHIPS,
  overviewFromAssets,
  withDemoFallback,
} from './managementDemoData';

describe('managementDemoData', () => {
  it('mantém acervo, gestão e superadmin utilizáveis sem backend', () => {
    expect(DEMO_ASSETS.length).toBeGreaterThan(0);
    expect(DEMO_MANAGEMENT_OVERVIEW.publications.calendar.length).toBeGreaterThan(0);
    expect(DEMO_MANAGEMENT_OVERVIEW.social_metrics.length).toBeGreaterThan(0);
    expect(DEMO_MANAGEMENT_OVERVIEW.services.length).toBeGreaterThan(0);
    expect(DEMO_MEMBERSHIPS).toContainEqual(expect.objectContaining({
      email: 'alexmacielferreira@gmail.com',
      role: 'superadmin',
    }));
  });

  it('na sessão demo prefere dados reais e recorre ao demo em erro ou lista vazia', async () => {
    const demo = { demo: true };
    await expect(withDemoFallback(() => Promise.resolve(['real']), ['demo'], demo)).resolves.toEqual(['real']);
    await expect(withDemoFallback(() => Promise.resolve([]), ['demo'], demo)).resolves.toEqual(['demo']);
    await expect(withDemoFallback(vi.fn().mockRejectedValue(new Error('offline')), ['demo'], demo)).resolves.toEqual(['demo']);
  });

  it('fora da sessão demo nunca troca erro ou lista vazia por exemplo', async () => {
    localStorage.removeItem('mm_demo_session_v1');
    await expect(withDemoFallback(() => Promise.resolve([]), ['demo'])).resolves.toEqual([]);
    await expect(withDemoFallback(vi.fn().mockRejectedValue(new Error('401')), ['demo'])).rejects.toThrow('401');
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ id: 'demo' }));
    await expect(withDemoFallback(() => Promise.resolve([]), ['demo'])).resolves.toEqual(['demo']);
    localStorage.removeItem('mm_demo_session_v1');
  });

  it('resume o acervo pela própria lista quando a visão gerencial não vem', () => {
    const summary = overviewFromAssets([{ file_size: 10, status: 'indexed' }, { file_size: '5', status: 'failed' }, {}]);
    expect(summary.assets).toEqual({ total: 3, indexed: 1, failures: 1, storage_bytes: 15 });
    expect(summary.services).toEqual([]);
  });
});
