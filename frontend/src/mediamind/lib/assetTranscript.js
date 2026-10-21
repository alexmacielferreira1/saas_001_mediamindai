import { useEffect, useState } from 'react';

import { base44 } from '@/api/base44Client';

// Transcrição real: segmentos que já vêm no asset ou os TranscricaoSegmento
// salvos pelo servidor. Sem segmentos, a tela diz isso (nada de texto inventado).
export function useAssetTranscript(asset) {
  const inline = asset?.transcript_segments || asset?.segments || null;
  const [state, setState] = useState({ status: 'idle', segments: [], error: '' });
  useEffect(() => {
    if (!asset) return undefined;
    if (Array.isArray(inline)) { setState({ status: 'ready', segments: inline, error: '' }); return undefined; }
    let active = true;
    setState({ status: 'loading', segments: [], error: '' });
    Promise.resolve(base44.entities.TranscricaoSegmento.filter({ asset_id: String(asset.id) }, 'start_ms', 500))
      .then((segments) => { if (active) setState({ status: 'ready', segments: Array.isArray(segments) ? segments : [], error: '' }); })
      .catch((error) => { if (active) setState({ status: 'error', segments: [], error: error?.message || 'falha de conexão' }); });
    return () => { active = false; };
  }, [asset, inline]);
  return state;
}

// Segundos → "HH:MM:SS".
export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}
