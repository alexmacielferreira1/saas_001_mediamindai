import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_ASSETS,
  DEMO_MANAGEMENT_OVERVIEW,
  DEMO_MEMBERSHIPS,
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

  it('prefere dados reais e recorre ao demo em erro ou lista vazia', async () => {
    await expect(withDemoFallback(() => Promise.resolve(['real']), ['demo'])).resolves.toEqual(['real']);
    await expect(withDemoFallback(() => Promise.resolve([]), ['demo'])).resolves.toEqual(['demo']);
    await expect(withDemoFallback(vi.fn().mockRejectedValue(new Error('offline')), ['demo'])).resolves.toEqual(['demo']);
  });
});
