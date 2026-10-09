import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileAudio, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatTime } from '../data';

// Painel de transcrição ligado ao player.
// - Lista segmentos reais (TranscricaoSegmento) do asset ativo.
// - Clique no trecho posiciona o preview (onSeek) no timecode exato.
// - "Transcrever" envia um áudio real (UploadPublicFile) e dispara a backend
//   function transcrever_asset, que chama Whisper e grava os segmentos.
export default function WorkspaceTranscricaoPanel({ asset, onSeek }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!asset) return;
    setLoading(true);
    try {
      const segs = await base44.entities.TranscricaoSegmento.filter({ asset_id: asset.id }, 'start_ms', 200);
      setSegments(segs);
    } catch {
      setSegments([]);
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => { load(); }, [load]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file || !asset) return;
    setBusy(true);
    setStatus('Enviando áudio...');
    try {
      const up = await base44.integrations.Core.UploadPublicFile({ file });
      const audioUrl = up.file_url;
      setStatus('Transcrevendo com Whisper...');
      const res = await base44.functions.invoke('transcrever_asset', {
        asset_id: asset.id,
        asset_title: asset.title,
        audio_url: audioUrl,
        duration_seconds: asset.duration || 0,
      });
      setStatus(res.data?.segments != null ? `${res.data.segments} trechos transcritos` : 'Concluído');
      await load();
    } catch (err) {
      setStatus('Falha: ' + (err?.message || 'erro na transcrição'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!asset) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <FileAudio size={13} className="text-violet-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Transcrição</span>
          {segments.length > 0 && (
            <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
              {segments.length} trechos
            </span>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1 rounded-md bg-violet-500/20 px-2 py-1 text-[10px] font-bold text-violet-300 hover:bg-violet-500/30 disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <FileAudio size={12} />}
          {busy ? 'Processando' : 'Transcrever'}
        </button>
        <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleFile} />
      </div>

      {status && <div className="px-3 py-1.5 text-[11px] text-slate-400">{status}</div>}

      <div className="max-h-44 space-y-1 overflow-y-auto px-3 py-2">
        {loading && <p className="text-[11px] text-slate-500">Carregando…</p>}
        {!loading && segments.length === 0 && (
          <p className="text-[11px] text-slate-600">Nenhuma transcrição. Envie um áudio para transcrever.</p>
        )}
        {segments.map((s) => (
          <button
            key={s.id}
            onClick={() => onSeek?.(formatTime((s.start_ms || 0) / 1000))}
            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-800/60"
            title="Posicionar preview neste trecho"
          >
            <span className="mt-0.5 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
              {formatTime((s.start_ms || 0) / 1000)}
            </span>
            <span className="text-xs text-slate-300">{s.texto}</span>
          </button>
        ))}
      </div>
    </div>
  );
}