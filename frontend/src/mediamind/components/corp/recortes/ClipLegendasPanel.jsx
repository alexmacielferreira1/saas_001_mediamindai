import React, { useState } from 'react';
import { Play, Trash2, Plus, Scissors, Save, Video, Merge, Undo2, Redo2 } from 'lucide-react';
import { fmt, gerarLegendas } from './clipModel';
import {
  CAPTION_TEMPLATES, DEFAULT_CAPTION_SETTINGS, applyCaptionText, buildCaptionsFromWords, captionIssues,
  captionsToSrt, captionsToVtt, mergeCaptions, parseSubtitles, sortCaptions, splitCaption, transcriptWordsFromCandidates,
} from '../../../lib/captionTools';
import { baixarTexto } from '../../../lib/premiereXml';
import { snapCaptionsToWords } from '../../../lib/clipEditorTools';

const ESTILOS = CAPTION_TEMPLATES.map(({ id, label }) => ({ id, label }));

function fileBase(clip) {
  return (clip.titulo || clip.title || 'corte').replace(/[^a-z0-9-_]+/gi, '_');
}

const POSICOES = [
  { id: 'top', label: 'Topo' },
  { id: 'center', label: 'Centro' },
  { id: 'bottom', label: 'Base' },
];

// Legendas: gerar, editar texto, dividir, remover. Remover pode cortar o áudio
// (cortar_audio true) ou só o texto. Os cortes de áudio ficam listados embaixo.
export default function ClipLegendasPanel({ clip, onChange, seekTo, onSalvar, onAvancar, onUndo, onRedo, canUndo = false, canRedo = false, getPlayhead }) {
  const [importError, setImportError] = useState('');
  const [snapNotice, setSnapNotice] = useState('');
  const transcriptWords = transcriptWordsFromCandidates(clip.analysis_candidates || [], clip.in_ms || 0, clip.out_ms || Infinity);
  const hasTranscript = transcriptWords.length > 0 || (clip.viral || []).some((v) => v.selected && v.texto);
  const settings = { ...DEFAULT_CAPTION_SETTINGS, ...(clip.legenda_config || {}) };
  const issues = captionIssues(clip.legendas || [], { inMs: clip.in_ms || 0, outMs: clip.out_ms || 0, format: clip.formato, maxChars: settings.maxChars });
  function gerar() {
    if (!hasTranscript || clip.legendas.length > 0) return;
    // Palavras temporizadas reais têm prioridade; o texto do candidato é o recurso anterior.
    onChange({ legendas: transcriptWords.length ? buildCaptionsFromWords(transcriptWords, { maxChars: Math.max(12, Number(settings.maxChars) || 28) }) : gerarLegendas(clip) });
  }
  function upd(id, patch) { onChange({ legendas: clip.legendas.map((l) => (l.id === id ? { ...l, ...patch } : l)) }); }
  function updText(id, texto) { onChange({ legendas: clip.legendas.map((l) => (l.id === id ? applyCaptionText(l, texto) : l)) }); }
  function updConfig(patch) { onChange({ legenda_config: { ...settings, ...patch } }); }
  function applyTemplateToAll(templateId) { onChange({ legenda_estilo: templateId, legendas: clip.legendas.map((l) => ({ ...l, estilo: templateId })) }); }
  function mergeNext(id) {
    const ordered = sortCaptions(clip.legendas);
    const index = ordered.findIndex((l) => l.id === id);
    if (index < 0 || index === ordered.length - 1) return;
    const merged = mergeCaptions(ordered[index], ordered[index + 1]);
    onChange({ legendas: ordered.filter((l) => l.id !== ordered[index + 1].id).map((l) => (l.id === id ? merged : l)) });
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError('');
    try {
      const imported = parseSubtitles(await file.text(), { inMs: clip.in_ms || 0 });
      onChange({ legendas: sortCaptions([...(clip.legendas || []), ...imported]) });
    } catch (error) { setImportError(error.message || 'Não foi possível importar o arquivo.'); }
  }
  function exportSrt() { baixarTexto(`${fileBase(clip)}.srt`, captionsToSrt(clip.legendas, { inMs: clip.in_ms || 0, maxChars: settings.maxChars, settings }), 'text/plain'); }
  function exportVtt() { baixarTexto(`${fileBase(clip)}.vtt`, captionsToVtt(clip.legendas, { inMs: clip.in_ms || 0, maxChars: settings.maxChars, settings }), 'text/vtt'); }
  function applyPositionFrom(caption) { onChange({ legendas: clip.legendas.map((l) => l.start_ms >= caption.start_ms ? { ...l, posicao: caption.posicao || 'bottom' } : l) }); }
  // Encaixe nos limites de palavras e no cursor. Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md
  function snapAllToWords() {
    const { captions, changed } = snapCaptionsToWords(clip.legendas, transcriptWords, 400);
    setSnapNotice(changed ? `${changed} legenda(s) encaixada(s) nos limites das palavras.` : 'Nenhuma legenda estava a até 400 ms de um limite de palavra.');
    if (changed) onChange({ legendas: captions });
  }
  function edgeAtPlayhead(caption, edge) {
    const at = Math.round(Number(getPlayhead?.()) || 0);
    if (edge === 'start' ? at >= caption.end_ms : at <= caption.start_ms) return;
    upd(caption.id, edge === 'start' ? { start_ms: at } : { end_ms: at });
  }
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
    // Divide o texto (e as palavras temporizadas) em vez de duplicá-lo nas duas metades.
    const [a, b] = splitCaption(l);
    onChange({ legendas: clip.legendas.map((x) => (x.id === id ? a : x)).concat(b) });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={gerar} disabled={!hasTranscript || clip.legendas.length > 0} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-40">Gerar legendas</button>
          <button onClick={add} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"><Plus size={12} /> Legenda</button>
          {onUndo && <button type="button" onClick={onUndo} disabled={!canUndo} title="Desfazer edição de legendas (Ctrl+Z)" className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"><Undo2 size={12} /> Desfazer</button>}
          {onRedo && <button type="button" onClick={onRedo} disabled={!canRedo} title="Refazer edição de legendas (Ctrl+Shift+Z)" className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"><Redo2 size={12} /> Refazer</button>}
        </div>
        <p className="text-[10px] text-slate-500">Adicione manualmente ou use uma transcrição disponível. Legendas, textos e cortes internos entram no MP4 quando marcados em Edição externa.</p>
      </div>

      <details className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[10px] text-slate-400">
        <summary className="cursor-pointer font-semibold uppercase tracking-wide text-slate-400">Modelo, aparência e arquivos</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label>Modelo de legenda<select aria-label="Modelo de legenda" value={clip.legenda_estilo || 'impacto'} onChange={(e) => onChange({ legenda_estilo: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200">{CAPTION_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}{t.karaoke ? ' · destaque por palavra' : ''}</option>)}</select></label>
          <div className="flex items-end"><button type="button" onClick={() => applyTemplateToAll(clip.legenda_estilo || 'impacto')} disabled={!clip.legendas.length} className="w-full rounded border border-sky-700 px-1.5 py-1 text-sky-200 disabled:opacity-40">Aplicar modelo a todas</button></div>
          <label>Tamanho da fonte<input aria-label="Tamanho da fonte da legenda" type="number" min="16" max="200" value={settings.fontSize} onChange={(e) => updConfig({ fontSize: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200" /></label>
          <label>Máx. caracteres por linha<input aria-label="Máximo de caracteres por linha" type="number" min="8" max="80" value={settings.maxChars} onChange={(e) => updConfig({ maxChars: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200" /></label>
          <label>Cor do texto<input aria-label="Cor do texto da legenda" type="color" value={settings.color || '#ffffff'} onChange={(e) => updConfig({ color: e.target.value })} className="mt-1 h-6 w-full rounded border border-slate-700 bg-slate-950" /></label>
          <label>Cor de destaque<input aria-label="Cor de destaque da legenda" type="color" value={settings.highlight || '#facc15'} onChange={(e) => updConfig({ highlight: e.target.value })} className="mt-1 h-6 w-full rounded border border-slate-700 bg-slate-950" /></label>
          <label className="col-span-2">Palavras em destaque (separadas por vírgula)<input aria-label="Palavras em destaque" value={settings.keywords} onChange={(e) => updConfig({ keywords: e.target.value })} placeholder="ex.: vacina, proteção" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200" /></label>
          <label className="col-span-2 flex items-center gap-1.5"><input type="checkbox" aria-label="Emojis automáticos" checked={Boolean(settings.emojis)} onChange={(e) => updConfig({ emojis: e.target.checked })} />Emojis automáticos por palavra-chave (prévia, SRT e VTT; o MP4 grava só o texto)</label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <label className="cursor-pointer rounded border border-slate-700 px-1.5 py-1 text-slate-300">Importar SRT/VTT<input aria-label="Importar legendas SRT ou VTT" type="file" accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain" onChange={importFile} className="sr-only" /></label>
          <button type="button" onClick={exportSrt} disabled={!clip.legendas.length} className="rounded border border-slate-700 px-1.5 py-1 text-slate-300 disabled:opacity-40">Exportar SRT</button>
          <button type="button" onClick={exportVtt} disabled={!clip.legendas.length} className="rounded border border-slate-700 px-1.5 py-1 text-slate-300 disabled:opacity-40">Exportar VTT</button>
        </div>
        <p className="mt-1 text-slate-500">Arquivos importados e exportados usam tempos relativos ao IN do corte.</p>
        {importError && <p role="alert" className="mt-1 text-rose-300">{importError}</p>}
      </details>

      <details className="rounded-lg border border-slate-800 bg-slate-950/40 p-2 text-[10px] text-slate-400">
        <summary className="cursor-pointer font-semibold uppercase tracking-wide text-slate-400">Ajustes de tempo</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={snapAllToWords} disabled={!clip.legendas.length || (!transcriptWords.length && !clip.legendas.some((l) => (l.palavras || []).length))} className="rounded border border-slate-700 px-1.5 py-1 text-slate-300 disabled:opacity-40">Encaixar nos limites das palavras</button>
        </div>
        <p className="mt-1 text-slate-500">Usa os tempos por palavra da transcrição; só move início/fim que estejam a até 400 ms de um limite.{getPlayhead ? ' Em cada legenda, "Início no cursor" e "Fim no cursor" usam a posição do player.' : ''}</p>
        {snapNotice && <p role="status" className="mt-1 text-slate-300">{snapNotice}</p>}
      </details>

      {issues.length > 0 && <div aria-label="Verificação das legendas" className="max-h-24 overflow-y-auto rounded-lg border border-amber-800/40 bg-amber-950/20 p-2 text-[10px] text-amber-200">
        <p className="font-bold uppercase text-amber-300/90">Verificação ({issues.length})</p>
        {issues.map((issue, index) => <p key={`${issue.id}-${issue.tipo}-${index}`}>{issue.texto}</p>)}
      </div>}

      <div className="flex-1 space-y-2 overflow-y-auto">
        {clip.legendas.length === 0 && <p className="py-8 text-center text-[11px] text-slate-500">Gere as legendas dos trechos selecionados pra editar.</p>}
        {clip.legendas.map((l) => (
          <div key={l.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <button onClick={() => seekTo(l.start_ms)} className="rounded-md border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800"><Play size={11} /></button>
              <span className="text-[10px] text-slate-500">{fmt(l.start_ms)} – {fmt(l.end_ms)}</span>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => split(l.id)} title="Dividir" className="rounded-md border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800"><Scissors size={11} /></button>
                <button type="button" onClick={() => mergeNext(l.id)} title="Unir com a próxima" aria-label="Unir com a próxima" className="rounded-md border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800"><Merge size={11} /></button>
                <button type="button" onClick={() => remove(l.id)} className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-rose-950/40 hover:text-rose-300"><Trash2 size={11} className="mr-1 inline" />Remover legenda</button>
                <button type="button" onClick={() => remove(l.id, { removeVideo: true })} className="rounded-md border border-rose-700/70 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-950/40"><Video size={11} className="mr-1 inline" />Remover legenda e vídeo</button>
              </div>
            </div>
            <textarea aria-label="Texto da legenda" value={l.texto} onChange={(e) => updText(l.id, e.target.value)} rows={2} className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
            <p className="mt-1 text-[9px] text-slate-500">{(l.palavras || []).length ? `${l.palavras.length} palavra(s) com tempo real · destaque por palavra disponível` : 'Sem tempos por palavra · destaque aplicado à legenda inteira'}</p>
            <div className="mt-1 flex gap-2 text-[10px] text-slate-400">
              <label>Início (ms) <input aria-label="Início da legenda em milissegundos" type="number" min="0" value={l.start_ms} onChange={(e) => upd(l.id, { start_ms: Number(e.target.value) })} className="w-24 rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200" /></label>
              <label>Fim (ms) <input aria-label="Fim da legenda em milissegundos" type="number" min="0" value={l.end_ms} onChange={(e) => upd(l.id, { end_ms: Number(e.target.value) })} className="w-24 rounded border border-slate-700 bg-slate-950 px-1 py-1 text-slate-200" /></label>
              {getPlayhead && <><button type="button" onClick={() => edgeAtPlayhead(l, 'start')} className="rounded border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800">Início no cursor</button><button type="button" onClick={() => edgeAtPlayhead(l, 'end')} className="rounded border border-slate-700 px-1.5 py-1 text-slate-300 hover:bg-slate-800">Fim no cursor</button></>}
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
          <p className="mb-1 text-[10px] text-rose-200">Aplicados no MP4 somente com a opção "Aplicar cortes internos" em Edição externa.</p>
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
