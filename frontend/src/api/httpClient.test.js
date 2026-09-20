import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, request } from './httpClient';

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends cookies and returns a JSON response', async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'user-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchStub);

    await expect(request('/auth/session')).resolves.toEqual({ user: { id: 'user-1' } });
    expect(fetchStub).toHaveBeenCalledWith('/api/v1/auth/session', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('converts the structured backend envelope into an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error_code: 'INVALID_CREDENTIALS',
            message: 'E-mail ou senha inválidos.',
            retryable: false,
            public_reference: 'ref-123',
            correlation_id: 'corr-123',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const result = request('/auth/login');
    await expect(result).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha inválidos.',
        retryable: false,
        reference: 'ref-123',
        correlationId: 'corr-123',
      }),
    );
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
});
