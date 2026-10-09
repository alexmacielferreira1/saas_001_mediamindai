import React, { useState, useRef } from 'react';
import { Mic, Square, Send, Check, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Modo Prompt do Corp: grava áudio (transcrito via Whisper) ou lê um comando
// digitado, chama a backend function resolve_pendencias e apresenta as
// sugestões da IA para aprovação. Reutilizado pelo PendenciasHub e pelo
// launcher flutuante (visível em toda tela do Corp).
export default function CorpPromptPanel({ segment, items, onApply }) {
  const [prompt, setPrompt] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [edits, setEdits] = useState({});
  const [error, setError] = useState('');
  const mrRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => { setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' })); stream.getTracks().forEach((t) => t.stop()); };
      mr.start();
      mrRef.current = mr;
      setRecording(true);
    } catch {
      setError('Não foi possível acessar o microfone.');
    }
  }
  function stopRec() { mrRef.current?.stop(); setRecording(false); }

  async function resolver() {
    setError(''); setLoading(true); setSugestoes([]); setEdits({});
    try {
      let audio_url = null;
      if (audioBlob) {
        const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
        const up = await base44.integrations.Core.UploadPublicFile({ file });
        audio_url = up.file_url;
      }
      if (!prompt && !audio_url) { setError('Digite um prompt ou grave um áudio.'); setLoading(false); return; }
      const res = await base44.functions.invoke('resolve_pendencias', { segment, prompt, audio_url, pendencias: items });
      const data = res.data || {};
      if (data.error) { setError(data.error); }
      else { setSugestoes(data.sugestoes || []); if (data.sugestoes?.length === 0) setError('A IA não sugeriu ações para o pedido.'); }
    } catch (e) {
      setError(e.message || 'Falha ao chamar a IA.');
    }
    setLoading(false);
  }

  function aceitar(s, idx) {
    const ed = edits[idx] || {};
    onApply(String(s.pendencia_id), ed.novo_status || s.novo_status, ed.acao || s.acao);
    setSugestoes((ss) => ss.filter((_, i) => i !== idx));
  }
  function recusar(idx) { setSugestoes((ss) => ss.filter((_, i) => i !== idx)); }
  function setEdit(idx, field, value) { setEdits((e) => ({ ...e, [idx]: { ...(e[idx] || {}), [field]: value } })); }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Prompt para a IA</p>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Ex.: avance tudo que está parado, finalize as revisões da semana, agende os envios pendentes..." className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {!recording ? (
            <button onClick={startRec} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"><Mic size={13} /> Gravar áudio</button>
          ) : (
            <button onClick={stopRec} className="flex items-center gap-1.5 rounded-md bg-rose-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-rose-400"><Square size={12} /> Parar gravação</button>
          )}
          {audioBlob && <span className="text-[11px] text-emerald-300">Áudio pronto ({Math.round(audioBlob.size / 1024)} KB)</span>}
          <button onClick={resolver} disabled={loading} className="ml-auto flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">
            {loading ? <><Loader2 size={13} className="animate-spin" /> Resolvendo...</> : <><Send size={13} /> Resolver com IA</>}
          </button>
        </div>
        {error && <p className="mt-2 text-[11px] text-rose-300">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sugestoes.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
            As sugestões da IA aparecem aqui — você aceita, altera o status ou a ação, e aplica com um clique.
          </div>
        )}
        <div className="space-y-2">
          {sugestoes.map((s, idx) => {
            const target = items.find((i) => String(i.id) === String(s.pendencia_id));
            return (
              <div key={idx} className="rounded-xl border border-sky-800/60 bg-sky-950/20 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-100">{target ? target.titulo : `Pendência ${s.pendencia_id}`}</p>
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">IA sugere</span>
                </div>
                <textarea defaultValue={s.acao} onChange={(e) => setEdit(idx, 'acao', e.target.value)} rows={2} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
                {s.justificativa && <p className="mt-1 text-[10px] text-slate-500">Justificativa: {s.justificativa}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase text-slate-500">Mover para</span>
                  <select defaultValue={s.novo_status} onChange={(e) => setEdit(idx, 'novo_status', e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200">
                    <option value="pendente">A fazer</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                  <div className="ml-auto flex gap-1.5">
                    <button onClick={() => recusar(idx)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800"><X size={11} /> Recusar</button>
                    <button onClick={() => aceitar(s, idx)} className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"><Check size={11} /> Aceitar</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}