import React, { useState } from 'react';
import { Sparkles, Wand2, Loader2, ChevronDown, ChevronUp, Plus, Scissors } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AudioPromptInput from './corp/roles/AudioPromptInput';

// Painel de IA do Modo Roteiro: gera blocos de roteiro e ajustes de edição por
// prompt de texto ou áudio (transcrito no backend). O usuário revisa e aplica
// ao roteiro ativo (onApply acrescenta blocos de texto).
export default function RoteiroIAPanel({ onApply, context }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function gerar() {
    setError('');
    setResult(null);
    if (!prompt && !audioUrl) { setError('Escreva um prompt ou grave/envie um áudio.'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('gerar_roteiro_ia', { prompt, audioUrl, ...(context || {}) });
      const data = res?.data || res;
      if (data?.error) { setError(data.error); return; }
      setResult(data);
    } catch (e) {
      setError('Falha na IA: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function addBlocos() {
    const blocos = (result?.blocos || []).map((b, i) => ({ id: Date.now() + i, type: 'text', track: b.track || 't1', content: b.content }));
    if (blocos.length && onApply) onApply(blocos);
  }

  function addAjustes() {
    const blocos = (result?.ajustes || []).map((a, i) => ({
      id: Date.now() + i + 1000,
      type: 'text',
      track: 't1',
      content: `[EDIÇÃO${a.tipo ? ' ' + a.tipo : ''}${a.timecode ? ' @' + a.timecode : ''}] ${a.descricao}`,
    }));
    if (blocos.length && onApply) onApply(blocos);
  }

  return (
    <div className="shrink-0 rounded-xl border border-violet-800/40 bg-violet-950/10">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-300">
          <Sparkles size={14} /> IA — gerar roteiro e ajustes de edição
        </span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-violet-800/40 p-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="Ex.: Abertura de 30s para o Jornal da Noite sobre as enchentes no RS, tom sério, com chamada e fala do apresentador."
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-500"
          />
          <AudioPromptInput onAudioUrl={setAudioUrl} />
          {error && <p className="text-[11px] text-rose-400">{error}</p>}
          <button
            onClick={gerar}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-violet-400 disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Gerar
          </button>

          {result && (
            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/50 p-3">
              {result.transcription && <p className="text-[11px] text-slate-500">Áudio transcrito: “{result.transcription}”</p>}

              {result.blocos?.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Roteiro gerado ({result.blocos.length})</p>
                  <div className="space-y-1.5">
                    {result.blocos.map((b, i) => (
                      <div key={i} className="rounded bg-violet-500/10 px-2 py-1.5 text-[11px] text-slate-200">{b.content}</div>
                    ))}
                  </div>
                  <button onClick={addBlocos} className="mt-2 flex items-center gap-1.5 rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-sky-400">
                    <Plus size={12} /> Adicionar blocos ao roteiro
                  </button>
                </div>
              )}

              {result.ajustes?.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Ajustes de edição ({result.ajustes.length})</p>
                  <div className="space-y-1.5">
                    {result.ajustes.map((a, i) => (
                      <div key={i} className="rounded bg-slate-800/60 px-2 py-1.5 text-[11px] text-slate-200">
                        <span className="font-bold text-amber-300">{a.tipo || 'ajuste'}{a.timecode ? ` @${a.timecode}` : ''}</span> — {a.descricao}
                      </div>
                    ))}
                  </div>
                  <button onClick={addAjustes} className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-600/50 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/10">
                    <Scissors size={12} /> Adicionar ajustes ao roteiro
                  </button>
                </div>
              )}

              {!result.blocos?.length && !result.ajustes?.length && <p className="text-[11px] text-slate-500">A IA não retornou conteúdo. Tente reformular o pedido.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}