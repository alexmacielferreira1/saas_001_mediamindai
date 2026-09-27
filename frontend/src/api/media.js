import { request } from './httpClient';

export async function listMediaAssets() {
  return (await request('/media/assets')).assets;
}

export function uploadMediaAsset(file) {
  const body = new FormData();
  body.append('file', file);
  return request('/media/assets', { method: 'POST', body });
}

export function mediaStreamUrl(asset) {
  return asset?.stream_url || '';
}

export async function exportMediaClip(payload) {
  const origin = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${origin}/api/v1/media/exports/clip`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'video/mp4', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Não foi possível exportar o clipe.');
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'mediamind-editado.mp4';
  return { blob: await response.blob(), filename };
}
