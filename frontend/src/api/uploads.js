import { request } from './httpClient';

export function uploadFile(file) {
  const body = new FormData();
  body.append('file', file);
  return request('/uploads', { method: 'POST', body });
}
