import React, { useState, useRef } from 'react';
import { Mic, Square, Upload, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Captura áudio por microfone (MediaRecorder) ou upload de arquivo, envia para
// o storage público e devolve a URL para o painel de IA transcrever/interpretar.
export default function AudioPromptInput({ onAudioUrl }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  async function uploadFile(file) {
    setUploading(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setAudioUrl(file_url);
      onAudioUrl?.(file_url);
    } catch (e) {
      setError('Falha no upload do áudio: ' + (e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  async function startRec() {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        uploadFile(new File([blob], 'audio.webm', { type: blob.type }));
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) {
      setError('Não foi possível acessar o microfone: ' + (e?.message || e));
    }
  }

  function stopRec() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function onPick(e) {
    const f = e.target.files?.[0];
    if (f) await uploadFile(f);
    e.target.value = '';
  }

  function clear() {
    setAudioUrl('');
    onAudioUrl?.('');
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!recording ? (
        <button type="button" onClick={startRec} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
          <Mic size={12} /> Gravar áudio
        </button>
      ) : (
        <button type="button" onClick={stopRec} className="flex items-center gap-1.5 rounded-md bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-slate-950">
          <Square size={12} /> Parar
        </button>
      )}
      <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
        <Upload size={12} /> Enviar arquivo
        <input type="file" accept="audio/*" className="hidden" onChange={onPick} />
      </label>
      {uploading && <span className="flex items-center gap-1 text-[11px] text-slate-400"><Loader2 size={12} className="animate-spin" /> Enviando…</span>}
      {audioUrl && !uploading && (
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-300">
          Áudio pronto
          <button type="button" onClick={clear} className="text-slate-500 hover:text-rose-400">remover</button>
        </span>
      )}
      {error && <span className="text-[11px] text-rose-400">{error}</span>}
    </div>
  );
}