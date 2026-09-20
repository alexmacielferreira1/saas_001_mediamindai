import { describe, expect, it } from 'vitest';
import { buildManagementAlerts, buildManagementKpis } from './managementViewModel';

const OVERVIEW = {
  publications: { published: 8, scheduled: 3, pending: 2, approval_rate: 80 },
  assets: { total: 120, indexed: 100, failures: 4, storage_bytes: 2048 },
  processing: { total: 10, active: 2, completed: 7, failed: 1 },
};

describe('managementViewModel', () => {
  it('monta a faixa gerencial apenas com dados da API', () => {
    expect(buildManagementKpis(OVERVIEW).map((item) => item.value)).toEqual([
      8, 3, 2, '80%', 120, 100, 2, 5,
    ]);
  });

  it('gera alertas somente para situações que exigem atenção', () => {
    expect(buildManagementAlerts(OVERVIEW).map((item) => item.kind)).toEqual([
      'publication', 'processing', 'asset',
    ]);
    expect(buildManagementAlerts({
      publications: { pending: 0 }, assets: { failures: 0 }, processing: { active: 0, failed: 0 },
    })).toEqual([]);
  });
});
