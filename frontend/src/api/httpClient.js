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

export async function request(path, /** @type {Omit<RequestInit, 'body'> & {body?: any}} */ options = {}) {
  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  const isMultipart = options.body instanceof FormData;
  if (options.body !== undefined && !isMultipart) {
    headers['Content-Type'] ??= 'application/json';
  }

  const body = options.body === undefined || isMultipart ? options.body : JSON.stringify(options.body);

  /** @type {RequestInit} */
  const requestOptions = {
    ...options,
    credentials: /** @type {RequestCredentials} */ ('include'),
    headers,
  };
  if (body !== undefined) requestOptions.body = body;

  const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
  const contentType = response.headers.get('Content-Type') || '';
  const payload = response.status === 204 || !contentType.includes('application/json')
    ? null
    : await response.json();

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
