import { ApiError } from './httpClient';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

// Envio multipart com progresso (XMLHttpRequest: fetch não informa o upload).
// Mesmo contrato de erro do httpClient: ApiError com status/código/mensagem
// públicos do servidor (ex.: 413 FILE_TOO_LARGE, 422 INVALID_MEDIA_TYPE).
export function sendFormWithProgress(path, body, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      };
    }
    xhr.onerror = () => reject(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Falha de rede durante o envio. Verifique a conexão e tente de novo.', retryable: true }));
    xhr.onabort = () => reject(new ApiError({ status: 0, code: 'UPLOAD_ABORTED', message: 'Envio cancelado.', retryable: true }));
    xhr.onload = () => {
      let payload = null;
      try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { payload = null; }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(payload); return; }
      if (xhr.status === 401 && payload?.error_code === 'AUTHENTICATION_REQUIRED') {
        window.dispatchEvent(new Event('mediamind:authentication-required'));
      }
      reject(new ApiError({
        status: xhr.status,
        code: payload?.error_code,
        message: payload?.message || (xhr.status === 413 ? 'Arquivo maior que o limite permitido pelo servidor.' : undefined),
        retryable: payload?.retryable,
        reference: payload?.public_reference,
        correlationId: payload?.correlation_id,
      }));
    };
    xhr.send(body);
  });
}
