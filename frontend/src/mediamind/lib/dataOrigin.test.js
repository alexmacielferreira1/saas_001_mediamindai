import { describe, expect, it } from 'vitest';

import {
  DATA_SOURCE,
  classifyRequestError,
  demoData,
  emptyData,
  realData,
  unavailableData,
} from './dataOrigin';

describe('data origin envelopes', () => {
  it('keeps confirmed real data and its generation time', () => {
    expect(realData([{ id: 'asset-1' }], '2026-10-05T18:00:00Z')).toEqual({
      data: [{ id: 'asset-1' }],
      source: DATA_SOURCE.REAL,
      generated_at: '2026-10-05T18:00:00Z',
      error: null,
      demo_dataset: null,
    });
  });

  it('distinguishes a successful empty response from a failed request', () => {
    expect(emptyData([], '2026-10-05T18:01:00Z')).toMatchObject({
      data: [], source: DATA_SOURCE.EMPTY, generated_at: '2026-10-05T18:01:00Z', error: null,
    });
    expect(unavailableData(new Error('offline'))).toMatchObject({
      data: null, source: DATA_SOURCE.UNAVAILABLE, error: { message: 'offline' },
    });
  });

  it('never treats an authorization failure as an empty collection', () => {
    expect(classifyRequestError({ status: 401, message: 'Sessão expirada' })).toEqual({
      data: null,
      source: DATA_SOURCE.FORBIDDEN,
      generated_at: null,
      error: { message: 'Sessão expirada', status: 401 },
      demo_dataset: null,
    });
    expect(classifyRequestError({ status: 403, message: 'Sem acesso' }).source).toBe(DATA_SOURCE.FORBIDDEN);
    expect(classifyRequestError({ status: 503, message: 'Indisponível' }).source).toBe(DATA_SOURCE.UNAVAILABLE);
  });

  it('marks explicit demonstration data with the only approved dataset', () => {
    expect(demoData([{ id: 'demo-user-1' }])).toMatchObject({
      data: [{ id: 'demo-user-1' }],
      source: DATA_SOURCE.DEMO,
      demo_dataset: 'demo_seed_v1',
      error: null,
    });
  });
});
