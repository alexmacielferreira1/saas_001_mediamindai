import { request } from './httpClient';
import { sendFormWithProgress } from './uploadProgress';

// Limite do POST /uploads (backend/app/api/v1/uploads.py, MAX_UPLOAD_BYTES).
export const GENERIC_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;

export function uploadFile(file, { onProgress } = {}) {
  const body = new FormData();
  body.append('file', file);
  if (onProgress) return sendFormWithProgress('/uploads', body, { onProgress });
  return request('/uploads', { method: 'POST', body });
}
