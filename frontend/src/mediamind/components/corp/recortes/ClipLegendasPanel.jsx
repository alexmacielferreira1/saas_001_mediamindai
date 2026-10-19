import React from 'react';
import { Play, Trash2, Plus, Scissors, Save, Video } from 'lucide-react';
import { fmt, gerarLegendas } from './clipModel';

const ESTILOS = [
  { id: 'impacto', label: 'Impacto' },
  { id: 'dinamico', label: 'Dinâmico' },
  { id: 'limpo', label: 'Limpo' },
];

const POSICOES = [
  { id: 'top', label: 'Topo' },
  { id: 'center', label: 'Centro' },
  { id: 'bottom', label: 'Base' },
];

// Legendas: gerar, editar texto, dividir, remover. Remover pode cortar o áudio
// (cortar_audio true) ou só o texto. Os cortes de áudio ficam listados embaixo.
export default function ClipLegendasPanel({ clip, onChange, seekTo, onSalvar, onAvancar }) {
  const hasTranscript = (clip.viral || []).some((v) => v.selected && v.texto);
  function gerar() { if (hasTranscript && clip.legendas.length === 0) onChange({ legendas: gerarLegendas(clip) }); }
  function upd(id, patch) { onChange({ legendas: clip.legendas.map((l) => (l.id === id ? { ...l, ...patch } : l)) }); }
  function applyPositionFrom(caption) { onChange({ legendas: clip.legendas.map((l) => l.start_ms >= caption.start_ms ? { ...l, posicao: caption.posicao || 'bottom' } : l) }); }
  function add() {
    const last = clip.legendas[clip.legendas.length - 1];
    const start = last ? last.end_ms : clip.in_ms;
    onChange({ legendas: [...clip.legendas, { id: `l-${Date.now()}`, start_ms: start, end_ms: start + 3000, texto: '', cortar_audio: false }] });
  }
  function remove(id, { removeVideo = false } = {}) {
    const l = clip.legendas.find((x) => x.id === id);
    const videoCuts = removeVideo && l ? [...(clip.cortes_video || []), { start_ms: l.start_ms, end_ms: l.end_ms }] : (clip.cortes_video || []);
    onChange({ legendas: clip.legendas.filter((x) => x.id !== id), cortes_audio: clip.cortes_audio || [], cortes_video: videoCuts });
  }
  function split(id) {
    const l = clip.legendas.find((x) => x.id === id);
    if (!l) return;
    const mid = Math.round((l.start_ms + l.end_ms) / 2);
    const a = { ...l, end_ms: mid };
    const b = { ...l, id: `l-${Date.now()}`, start_ms: mid };
    onChange({ legendas: clip.legendas.map((x) => (x.id === id ? a : x)).concat(b) });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={gerar} disabled={!hasTranscript || clip.legendas.length > 0} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-40">Gerar legendas</button>
          <button onClick={add} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><Plus size={12} /> Legenda</button>
        </div>
        <p className="text-[10px] text-slate-500">Adicione manualmente ou use uma transcrição disponível. Cortes e camadas aparecem na prévia; a exportação ainda não os aplica.</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {clip.legendas.length === 0 && <p className="py-8 text-center text-[11px] text-slate-500">Gere as legendas dos trechos selecionados pra editar.</p>}
        {clip.legendas.map((l) => (
          <div key={l.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <button onClick={() => seekTo(l.start_ms)} className="rounded-md border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800"><Play size={11} /></button>
              <span className="text-[10px] text-slate-500">{fmt(l.start_ms)} – {fmt(l.end_ms)}</span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => split(l.id)} title="Dividir" className="rounded-md border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800"><Scissors size={11} /></button>
                <button type="button" onClick={() => remove(l.id)} className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-rose-950/40 hover:text-rose-300"><Trash2 size={11} className="mr-1 inline" />Remover legenda</button>
                <button type="button" onClick={() => remove(l.id, { removeVideo: true })} className="rounded-md border border-rose-700/70 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-950/40"><Video size={11} className="mr-1 inline" />Remover legenda e vídeo</button>
              </div>
            </div>
            <textarea value={l.texto} onChange={(e) => upd(l.id, { texto: e.target.value })} rows={2} className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
            <div className="mt-1 flex gap-2 text-[10px] text-slate-400">
              <label>Início (ms) <input aria-label="Início da legenda em milissegundos" type="number" min="0" value={l.start_ms} onChange={(e) => upd(l.id, { start_ms: Number(e.target.value) })} className="w-24 rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200" /></label>
              <label>Fim (ms) <input aria-label="Fim da legenda em milissegundos" type="number" min="0" value={l.end_ms} onChange={(e) => upd(l.id, { end_ms: Number(e.target.value) })} className="w-24 rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200" /></label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px]">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Estilo</span>
              {ESTILOS.map((estilo) => <button key={estilo.id} type="button" onClick={() => upd(l.id, { estilo: estilo.id })} className={`rounded border px-1.5 py-1 ${l.estilo === estilo.id || (!l.estilo && estilo.id === 'impacto') ? 'border-sky-500 bg-sky-500/15 text-sky-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>{estilo.label}</button>)}
              <span className="ml-2 font-semibold uppercase tracking-wide text-slate-500">Posição</span>
              {POSICOES.map((posicao) => <button key={posicao.id} type="button" onClick={() => upd(l.id, { posicao: posicao.id })} className={`rounded border px-1.5 py-1 ${l.posicao === posicao.id || (!l.posicao && posicao.id === 'bottom') ? 'border-violet-500 bg-violet-500/15 text-violet-200' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>{posicao.label}</button>)}
              <button type="button" onClick={() => applyPositionFrom(l)} className="rounded border border-violet-700 px-1.5 py-1 text-violet-200">Aplicar posição daqui em diante</button>
            </div>
          </div>
        ))}
      </div>

      {clip.cortes_audio.length > 0 && (
        <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-2.5">
          <p className="mb-1 text-[10px] font-bold uppercase text-rose-300/80">Cortes de áudio</p>
          <div className="flex flex-wrap gap-1.5">
            {clip.cortes_audio.map((c, i) => <span key={i} className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] text-rose-300">{fmt(c.start_ms)}–{fmt(c.end_ms)}</span>)}
          </div>
        </div>
      )}

      {(clip.cortes_video || []).length > 0 && (
        <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-2.5">
          <p className="mb-1 text-[10px] font-bold uppercase text-rose-300/80">Intervalos ignorados na prévia</p>
          <p className="mb-1 text-[10px] text-rose-200">A exportação ainda não aplica esses cortes.</p>
          <div className="flex flex-wrap gap-1.5">{clip.cortes_video.map((c, i) => <span key={i} className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] text-rose-300">{fmt(c.start_ms)}–{fmt(c.end_ms)}</span>)}</div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-800 pt-3">
        <p className="text-[10px] text-slate-500">{clip.legendas.length} legenda(s) · {clip.cortes_audio.length} corte(s) de áudio</p>
        <div className="flex gap-2">
          {onAvancar && <button onClick={onAvancar} className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800">Voltar p/ IA</button>}
          <button onClick={onSalvar} disabled={clip.legendas.length === 0} className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"><Save size={12} /> Salvar trecho</button>
        </div>
      </div>
    </div>
  );
}
