import { request } from './httpClient';
import { sendFormWithProgress } from './uploadProgress';

function mediaPrefix() {
  try {
    return import.meta.env.DEV && localStorage.getItem('mm_demo_session_v1') ? '/media/local' : '/media';
  } catch { return '/media'; }
}

// Transcrição com o Whisper local do servidor: grava os trechos (TranscricaoSegmento) do asset.
// Reaproveita a transcrição existente; `force` refaz.
export function transcribeMediaAsset(assetId, { force = false } = {}) {
  return request(`/media/assets/${encodeURIComponent(assetId)}/transcription`, { method: 'POST', body: { force } });
}

export async function listMediaAssets() {
  return (await request(`${mediaPrefix()}/assets`)).assets;
}

function mediaForm(file, metadata = {}) {
  const body = new FormData();
  body.append('file', file);
  for (const key of ['origin', 'project_id', 'recording_id']) {
    if (metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '') {
      body.append(key, String(metadata[key]));
    }
  }
  return body;
}

export function uploadMediaAsset(file, metadata = {}) {
  return request(`${mediaPrefix()}/assets`, { method: 'POST', body: mediaForm(file, metadata) });
}

// Mesmo endpoint de mídia (grava storage_key, sha256, mime e roda ffprobe),
// com progresso do envio. O servidor cria o registro Asset da empresa.
export function uploadMediaAssetWithProgress(file, metadata = {}, { onProgress } = {}) {
  return sendFormWithProgress(`${mediaPrefix()}/assets`, mediaForm(file, metadata), { onProgress });
}

// Extensões/tipos aceitos por POST /media/assets (backend/app/api/v1/media.py,
// ALLOWED_MEDIA) e limite padrão do servidor (media_max_upload_bytes = 4 GB).
export const MEDIA_UPLOAD_TYPES = {
  '.aac': ['audio/aac', 'audio/x-aac'], '.avi': ['video/x-msvideo'], '.jpeg': ['image/jpeg'], '.jpg': ['image/jpeg'],
  '.m4a': ['audio/mp4', 'audio/x-m4a'], '.mov': ['video/quicktime'], '.mp3': ['audio/mpeg'], '.mp4': ['video/mp4', 'application/mp4'],
  '.ogg': ['audio/ogg', 'video/ogg'], '.png': ['image/png'], '.wav': ['audio/wav', 'audio/x-wav'], '.webm': ['video/webm', 'audio/webm'],
  '.webp': ['image/webp'],
};
export const MEDIA_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024 * 1024;

export function isSupportedMediaFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const suffix = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  return Boolean(MEDIA_UPLOAD_TYPES[suffix]?.includes(file?.type || ''));
}

export function mediaStreamUrl(asset) {
  return resolveMediaUrl(asset?.stream_url || asset?.file_url || '');
}

// Asset lido por /records não traz stream_url. Os arquivos gravados pela rota
// de mídia (POST /media/assets) têm campos que só o servidor grava (sha256,
// mime_type, storage_key): para eles a reprodução é o stream autenticado do
// próprio id. Cadastros antigos apontam para a mídia em media_asset_id ou
// guardam só file_url.
export function assetPlaybackUrl(asset) {
  if (!asset) return '';
  if (asset.stream_url) return resolveMediaUrl(asset.stream_url);
  const stored = Boolean(asset.sha256 || asset.mime_type || asset.storage_key);
  if (stored && asset.id) return resolveMediaUrl(`/api/v1${mediaPrefix()}/assets/${encodeURIComponent(asset.id)}/stream`);
  if (asset.media_asset_id) return resolveMediaUrl(`/api/v1${mediaPrefix()}/assets/${encodeURIComponent(asset.media_asset_id)}/stream`);
  return resolveMediaUrl(asset.file_url || asset.source_url || '');
}

export async function removeThumbnailBackground(file) {
  const body = new FormData();
  body.append('file', file);
  const origin = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${origin}/api/v1${mediaPrefix()}/thumbnails/remove-background`, {
    method: 'POST', credentials: 'include', headers: { Accept: 'image/png' }, body,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Não foi possível recortar a pessoa.');
  }
  return response.blob();
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
  // O servidor guarda a peça no Acervo e copia para a pasta de destino (EXPORT_ROOT).
  const exportPath = response.headers.get('X-MediaMind-Export-Path');
  return {
    blob: await response.blob(),
    filename,
    assetId: response.headers.get('X-MediaMind-Asset-Id') || null,
    exportPath: exportPath ? decodeURIComponent(exportPath) : null,
  };
}

export function exportMediaClip(payload) {
  return requestMediaExport('clip', payload);
}

export function exportTimeline(payload) {
  return requestMediaExport('timeline', payload);
}

export function resolveMediaUrl(url = '') {
  if (!url || /^(blob:|data:|https?:)/i.test(url)) return url;
  return url.startsWith('/api/') ? `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${url}` : url;
}
