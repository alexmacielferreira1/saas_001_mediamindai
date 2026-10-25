import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('../../api/httpClient', () => ({ request: (...args) => request(...args) }));

import { approveCreativeDocument, creativeErrorMessage } from './creativeToolsApi';

describe('aprovação de documento criativo com a revisão vista', () => {
  beforeEach(() => request.mockReset().mockResolvedValue({ id: 'd1', revision: 3, status: 'approved' }));

  it('envia a revisão que o revisor viu', async () => {
    await approveCreativeDocument('d1', 3);
    expect(request).toHaveBeenCalledWith('/creative-documents/d1/approve', { method: 'POST', body: { revision: 3 } });
  });

  it('sem revisão conhecida mantém o pedido antigo (compatível com o backend atual)', async () => {
    await approveCreativeDocument('d1');
    expect(request).toHaveBeenCalledWith('/creative-documents/d1/approve', { method: 'POST' });
  });

  it('explica o conflito de revisão e a falta de permissão', () => {
    expect(creativeErrorMessage({ status: 409, code: 'CREATIVE_REVISION_CONFLICT' }, 'x')).toMatch(/mudou desde que você o abriu/);
    expect(creativeErrorMessage({ status: 403 }, 'x')).toMatch(/permissão de revisão/);
    expect(creativeErrorMessage({ message: 'Outro' }, 'x')).toBe('Outro');
    expect(creativeErrorMessage(null, 'padrão')).toBe('padrão');
  });
});
