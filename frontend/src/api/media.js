import { request } from './httpClient';

function mediaPrefix() {
  try {
    return import.meta.env.DEV && localStorage.getItem('mm_demo_session_v1') ? '/media/local' : '/media';
  } catch { return '/media'; }
}

export async function listMediaAssets() {
  return (await request(`${mediaPrefix()}/assets`)).assets;
}

export function uploadMediaAsset(file) {
  const body = new FormData();
  body.append('file', file);
  return request(`${mediaPrefix()}/assets`, { method: 'POST', body });
}

export function mediaStreamUrl(asset) {
  return asset?.stream_url || '';
}

async function requestMediaExport(path, payload) {
  const origin = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${origin}/api/v1${mediaPrefix()}/exports/${path}`, {
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

export function exportMediaClip(payload) {
  return requestMediaExport('clip', payload);
}

export function exportTimeline(payload) {
  return requestMediaExport('timeline', payload);
}
