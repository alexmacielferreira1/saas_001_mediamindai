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

  it('serializes JSON bodies and preserves caller headers', async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'tenant-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchStub);

    await request('/tenants', {
      method: 'POST',
      headers: { 'X-Correlation-ID': 'corr-client' },
      body: { name: 'Empresa' },
    });

    expect(fetchStub).toHaveBeenCalledWith('/api/v1/tenants', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Correlation-ID': 'corr-client',
      },
      body: JSON.stringify({ name: 'Empresa' }),
    });
  });

  it('passes multipart bodies through without setting a content type', async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchStub);
    const body = new FormData();
    body.append('file', new Blob(['media']), 'media.txt');

    await expect(request('/uploads', { method: 'POST', body })).resolves.toBeNull();
    expect(fetchStub).toHaveBeenCalledWith('/api/v1/uploads', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      body,
    });
  });

  it('returns a safe generic ApiError for a non-JSON failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('proxy internals must not leak', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    await expect(request('/health')).rejects.toEqual(
      expect.objectContaining({
        status: 502,
        code: 'UNEXPECTED_RESPONSE',
        message: 'Não foi possível concluir a solicitação.',
        retryable: false,
        reference: null,
        correlationId: null,
      }),
    );
  });
});
