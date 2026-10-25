import { base44 } from '@/api/base44Client';
import { readLocalDemoSession } from './demoAccess';

// Duração real da mídia quando o servidor não mediu (sem ffprobe): o navegador
// lê o cabeçalho do arquivo (loadedmetadata) e a duração é gravada no Asset,
// para Workspace e Timeline não usarem um valor padrão (5 s / 30 s).
const PROBE_TIMEOUT_MS = 15000;

export function hasKnownDuration(asset) {
  return Number(asset?.duration) > 0;
}

export function probeMediaDuration(src, kind = 'video', { timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  if (!src || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const element = document.createElement(kind === 'audio' ? 'audio' : 'video');
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      element.removeAttribute('src');
      try { element.load(); } catch { /* jsdom/navegadores sem load() */ }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    element.preload = 'metadata';
    element.muted = true;
    const accept = () => {
      const value = Number(element.duration);
      if (Number.isFinite(value) && value > 0) { finish(Math.round(value * 1000) / 1000); return true; }
      return false;
    };
    element.addEventListener('loadedmetadata', () => {
      if (accept()) return;
      // WebM gravado pelo navegador (MediaRecorder) não traz a duração no cabeçalho
      // (duration = Infinity). Pular para o fim força o navegador a calcular.
      if (element.duration === Infinity) {
        element.addEventListener('durationchange', accept);
        element.addEventListener('timeupdate', accept);
        try { element.currentTime = 1e101; } catch { finish(null); }
        return;
      }
      finish(null);
    });
    element.addEventListener('error', () => finish(null));
    element.src = src;
  });
}

// Mede no navegador as mídias de vídeo/áudio sem duração e grava o valor no
// Asset (best effort: se a gravação falhar, a duração medida vale para a tela).
export async function ensureAssetDurations(assets, { probe = probeMediaDuration, persist = persistAssetDuration } = {}) {
  return Promise.all((assets || []).map(async (asset) => {
    if (!['video', 'audio'].includes(asset?.asset_type) || hasKnownDuration(asset) || !asset.stream_url) return asset;
    const duration = await probe(asset.stream_url, asset.asset_type);
    if (!duration) return asset;
    await persist(asset, duration);
    return { ...asset, duration, duration_source: 'browser' };
  }));
}

export async function persistAssetDuration(asset, duration) {
  if (!asset?.id || readLocalDemoSession()) return false;
  try {
    await base44.entities.Asset.update(String(asset.id), { duration, duration_source: 'browser' });
    return true;
  } catch {
    return false;
  }
}

// Mede o arquivo local antes/enquanto ele sobe (sem rede): URL temporária do File.
export async function measureFileDuration(file, { probe = probeMediaDuration } = {}) {
  const kind = String(file?.type || '').startsWith('audio/') ? 'audio' : String(file?.type || '').startsWith('video/') ? 'video' : null;
  if (!kind || typeof URL === 'undefined' || !URL.createObjectURL || typeof document === 'undefined') return null;
  // Navegador que não decodifica o formato não dispara loadedmetadata: não espera à toa.
  const tester = document.createElement(kind);
  if (!tester.canPlayType || !tester.canPlayType(file.type)) return null;
  const url = URL.createObjectURL(file);
  try { return await probe(url, kind); } finally { URL.revokeObjectURL(url); }
}

// Completa a duração do Asset recém-enviado quando o servidor não mediu (sem ffprobe).
export async function withMeasuredDuration(asset, duration, { persist = persistAssetDuration } = {}) {
  if (!asset || hasKnownDuration(asset) || !duration) return asset;
  await persist(asset, duration);
  return { ...asset, duration, duration_source: 'browser' };
}

// Envia e mede ao mesmo tempo; devolve o Asset com a duração real.
export async function uploadWithDuration(file, upload) {
  const [asset, duration] = await Promise.all([upload(file), measureFileDuration(file).catch(() => null)]);
  return withMeasuredDuration(asset, duration);
}
