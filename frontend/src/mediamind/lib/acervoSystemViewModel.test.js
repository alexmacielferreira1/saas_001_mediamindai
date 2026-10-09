import { describe, expect, it } from 'vitest';
import { buildAcervoSystemSummary } from './acervoSystemViewModel';

describe('buildAcervoSystemSummary', () => {
  it('deriva saúde do sistema dos dados reais do acervo', () => {
    const result = buildAcervoSystemSummary({
      processing: { active: 2, completed: 9, failed: 1 },
      assets: { total: 20, indexed: 15, failures: 2, storage_bytes: 1024 },
      services: [{ status: 'active' }, { status: 'warning' }],
    });
    expect(result.map((item) => item.value)).toEqual([2, 9, 3, '75%', 2]);
  });
});
