const API_BASE_URL = '/api/v1';

export class ApiError extends Error {
  constructor({ status, code, message, retryable = false, reference = null, correlationId = null }) {
    super(message || 'Não foi possível concluir a solicitação.');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'UNEXPECTED_RESPONSE';
    this.retryable = Boolean(retryable);
    this.reference = reference;
    this.correlationId = correlationId;
  }
}

export async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] ??= 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  const payload = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error_code,
      message: payload?.message,
      retryable: payload?.retryable,
      reference: payload?.public_reference,
      correlationId: payload?.correlation_id,
    });
  }

  return payload;
}
