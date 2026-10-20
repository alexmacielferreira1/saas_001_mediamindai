import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, Play, Check, Star, X, AlertTriangle, Loader2, Info,
  Wand2, FileVideo, RefreshCw, CornerUpRight,
} from 'lucide-react';
import { fmt } from './clipModel';
import { useEmpresa } from '../../../lib/empresaContext';
import {
  ensureTranscription, listCandidates, runAnalysis, updateCandidate, promoteCandidate, getAsset,
} from '../../../lib/clipEngineService';

const scoreTone = (s) => (s >= 85 ? 'bg-emerald-500/20 text-emerald-300' : s >= 70 ? 'bg-sky-500/20 text-sky-300' : s >= 50 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300');

const DIMENSIONS = [
  { key: 'hook', label: 'Hook', tip: 'Capacidade do início de prender a atenção nos primeiros segundos.' },
  { key: 'flow', label: 'Fluxo', tip: 'Continuidade e ritmo do trecho — sem cortes abruptos de raciocínio.' },
  { key: 'value', label: 'Valor', tip: 'Densidade informativa/relevância do conteúdo para o espectador.' },
  { key: 'trend', label: 'Trend', tip: 'Potencial de aproveitamento de tendência atual (estimativa editorial, não garantia de views).' },
];

// Converte candidatos reais da análise do CLIPSFREE (/clips/analyses) para o formato do painel.
// As dimensões vêm do servidor (0–25 cada); nada é preenchido quando ausente.
export function fromClipsAnalysis(candidate, index) {
  const dims = candidate.dimensions || {};
  const grade = (value) => (Number.isFinite(Number(value)) ? `${Number(value)}/25` : '');
  return {
    id: candidate.id,
    title: candidate.quote || 'Trecho analisado',
    start_ms: Math.round(Number(candidate.start) * 1000),
    end_ms: Math.round(Number(candidate.end) * 1000),
    overall_score: Number(candidate.score) || 0,
    rank: index + 1,
    selected: false,
    transcript: candidate.quote || '',
    reason: candidate.rationale || '',
    evidence: candidate.evidence || [],
    hook_grade: grade(dims.hook), hook_explanation: 'Gancho: força dos primeiros segundos, avaliada sobre a transcrição.',
    flow_grade: grade(dims.flow), flow_explanation: 'Fluxo: continuidade do raciocínio dentro do trecho.',
    value_grade: grade(dims.value), value_explanation: 'Valor: densidade de informação útil.',
    trend_grade: grade(dims.shareability), trend_explanation: 'Compartilhamento: potencial de o público repassar o trecho (estimativa editorial, não garantia de alcance).',
    source: 'clipsfree',
  };
}

function Grade({ grade, explanation }) {
  const [open, setOpen] = useState(false);
  if (!grade) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-sky-300"
        title={explanation || 'Ver explicação da IA'}
      >
        {grade}
        <Info size={10} className="text-slate-500" />
      </button>
      {open && explanation && (
        <div className="absolute left-0 top-5 z-30 w-56 rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-[10px] leading-relaxed text-slate-300 shadow-xl">
          {explanation}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ c, clip, seekTo, onToggle, onFav, onReject, onApplySuggestion, onPromote, promoting }) {
  const [showWhy, setShowWhy] = useState(false);
  const [showSugg, setShowSugg] = useState(false);
  const hasSuggestion = (c.suggested_in_ms && c.suggested_in_ms !== c.start_ms) || (c.suggested_out_ms && c.suggested_out_ms !== c.end_ms);
  return (
    <div className={`rounded-lg border p-3 transition ${c.rejected ? 'border-slate-800 bg-slate-950/30 opacity-50' : c.selected ? 'border-violet-600 bg-violet-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-slate-600'}`}>
      <div className="flex items-start gap-2.5">
        <button type="button" aria-label={`Detalhes da nota ${Math.round(c.overall_score)} de ${c.title}`} aria-expanded={showWhy} onClick={() => setShowWhy((s) => !s)} title="Ver detalhes da nota" className={`mm-badge ${scoreTone(c.overall_score)}`}>{Math.round(c.overall_score)}</button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-200">{c.title}</p>
          <p className="text-[10px] text-slate-500">{fmt(c.start_ms)} – {fmt(c.end_ms)} · {((c.end_ms - c.start_ms) / 1000).toFixed(1)}s · rank #{c.rank}</p>
        </div>
        <button onClick={() => onFav(c)} title="Favoritar" className={`rounded-md p-1 ${c.favorite ? 'text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}><Star size={13} fill={c.favorite ? 'currentColor' : 'none'} /></button>
        <button onClick={() => onReject(c)} title="Rejeitar" className="rounded-md p-1 text-slate-500 hover:text-rose-300"><X size={13} /></button>
      </div>

      {/* Dimensões com tooltip */}
      {showWhy && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="flex items-center gap-1">
            <span className="text-[9px] uppercase text-slate-500" title={d.tip}>{d.label}</span>
            <Grade grade={c[`${d.key}_grade`]} explanation={c[`${d.key}_explanation`]} />
          </div>
        ))}
      </div>}

      {/* Ações */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button onClick={() => seekTo(c.start_ms)} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"><Play size={11} /> Reproduzir</button>
        <button onClick={() => onToggle(c)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${c.selected ? 'bg-violet-500 text-slate-950' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'}`}><Check size={11} /> {c.selected ? 'Selecionado' : 'Selecionar'}</button>
        <button onClick={() => setShowSugg((s) => !s)} disabled={!hasSuggestion} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-40" title={hasSuggestion ? 'Aplicar IN/OUT sugeridos pela IA' : 'A IA não sugeriu ajuste de IN/OUT para este trecho'}><Wand2 size={11} /> Melhorar</button>
        {c.source === 'clipsfree' && <button type="button" onClick={() => onApplySuggestion({ ...c, suggested_in_ms: c.start_ms, suggested_out_ms: c.end_ms })} className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800" title="Usar este trecho como IN/OUT do corte">Usar como IN/OUT</button>}
        {c.source !== 'clipsfree' && <button onClick={() => onPromote(c)} disabled={promoting} className="flex items-center gap-1 rounded-md border border-sky-700 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-950/40 disabled:opacity-50"><CornerUpRight size={11} /> {promoting ? 'Salvando...' : 'Promover a Clip'}</button>}
      </div>

      {showWhy && (
        <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/60 p-2 text-[10px] leading-relaxed text-slate-400">
          {c.reason || c.summary || 'Nenhuma justificativa disponível.'}
          {c.keywords && <p className="mt-1 text-slate-500">Palavras-chave: {c.keywords}</p>}
        </div>
      )}

      {showSugg && hasSuggestion && (
        <div className="mt-2 rounded-md border border-sky-800/40 bg-sky-950/20 p-2 text-[10px] text-slate-300">
          <p className="mb-1 font-semibold text-sky-300">Sugestão da IA para melhorar o corte:</p>
          <p>Atual: {fmt(c.start_ms)} – {fmt(c.end_ms)}</p>
          {c.suggested_in_ms ? <p>Sugerido: {fmt(c.suggested_in_ms)} – {fmt(c.suggested_out_ms || c.end_ms)}</p> : null}
          <button onClick={() => onApplySuggestion(c)} className="mt-1.5 flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Check size={11} /> Aplicar sugestão</button>
        </div>
      )}
    </div>
  );
}

// Painel de candidatos REAL — substitui a simulação (gerarVirais/Math.random).
// Recebe o recorte (clip) com source_asset_id; se vier de seedClips (mock,
// sem asset real), orienta o usuário a usar o "Novo corte" com asset do Acervo.
export default function ClipCandidatesPanel({ clip, onChange, seekTo, onAvancar, onOpenNewClip }) {
  const { current: empresaId, isGlobal } = useEmpresa();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [promotingId, setPromotingId] = useState(null);
  const assetId = clip.source_asset_id;
  const analysisMode = Array.isArray(clip.analysis_candidates) && clip.analysis_candidates.length > 0;
  const eid = isGlobal ? '' : empresaId;

  async function load() {
    if (analysisMode) {
      const selectedIds = new Set((clip.viral || []).map((item) => item.id));
      setCandidates(clip.analysis_candidates.map(fromClipsAnalysis).map((item) => ({ ...item, selected: selectedIds.has(item.id) })));
      return;
    }
    if (!assetId) return;
    try {
      const list = await listCandidates(assetId);
      setCandidates(list);
    } catch {
      // Sem candidatos persistidos não exibimos exemplos como se fossem análise.
      setCandidates([]);
      setError('Não foi possível carregar os candidatos salvos deste vídeo.');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [assetId, analysisMode]);

  const selectedCount = candidates.filter((c) => c.selected).length;

  async function processar() {
    if (!assetId) { onOpenNewClip?.(); return; }
    setError(''); setLoading(true);
    try {
      const asset = await getAsset(assetId);
      setStep('Transcrevendo...');
      const { segments } = await ensureTranscription(asset, { empresaId: eid, durationSeconds: (clip.duration_ms || 0) / 1000 });
      setStep('Analisando e encontrando momentos...');
      const cs = await runAnalysis({
        asset, segments,
        prompt: clip.prompt || '', purpose: clip.purpose || 'social',
        durationLabel: clip.duration_label || 'auto', aspectRatio: clip.aspect_ratio || '9:16',
        scoreProfile: clip.score_profile || 'social',
        interval: { start_ms: clip.in_ms, end_ms: clip.out_ms },
        empresaId: eid,
      });
      setCandidates(cs);
      setStep('');
    } catch (e) {
      setError(`Serviço de IA indisponível: nenhum candidato foi gerado.${e?.message ? ` (${e.message})` : ''}`);
    } finally {
      setLoading(false);
      setStep('');
    }
  }

  async function patchLocal(id, patch) {
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async function toggle(c) {
    const next = !c.selected;
    const updated = candidates.map((item) => item.id === c.id ? { ...item, selected: next } : item);
    setCandidates(updated);
    syncViral(updated);
    if (c.id && c.source !== 'clipsfree') { try { await updateCandidate(c.id, { selected: next }); } catch {} }
  }
  async function fav(c) {
    const next = !c.favorite;
    patchLocal(c.id, { favorite: next });
    if (c.id && c.source !== 'clipsfree') { try { await updateCandidate(c.id, { favorite: next }); } catch {} }
  }
  async function reject(c) {
    const next = !c.rejected;
    const updated = candidates.map((item) => item.id === c.id ? { ...item, rejected: next, selected: next ? false : item.selected } : item);
    setCandidates(updated);
    syncViral(updated);
    if (c.id && c.source !== 'clipsfree') { try { await updateCandidate(c.id, { rejected: next, selected: next ? false : c.selected }); } catch {} }
  }
  function applySuggestion(c) {
    const start = c.suggested_in_ms || c.start_ms;
    const end = c.suggested_out_ms || c.end_ms;
    onChange({ in_ms: start, out_ms: end, suggested_in_ms: start, suggested_out_ms: end });
    seekTo(start);
  }
  async function promote(c) {
    setPromotingId(c.id || c.start_ms);
    try {
      const asset = await import('../../../lib/clipEngineService').then((m) => m.getAsset(assetId));
      const clipRec = await promoteCandidate(c, asset, { empresaId: eid, aspectRatio: clip.aspect_ratio || '9:16', purpose: clip.purpose || 'social' });
      patchLocal(c.id, { selected: true, promoted_clip_id: clipRec.id });
      onChange({ salvo: true, pronto: true, id: clipRec.id, title: clipRec.title });
    } catch (e) {
      setError('Falha ao promover candidato: ' + (e.message || e));
    } finally {
      setPromotingId(null);
    }
  }

  // Sincroniza selecionados no formato esperado pela etapa de legendas (clip.viral).
  function syncViral(updatedCandidates) {
    const viral = updatedCandidates.filter((c) => c.selected && !c.rejected).map((c) => ({ id: c.id, start_ms: c.start_ms, end_ms: c.end_ms, titulo: c.title, summary: c.summary || c.reason || '', texto: c.transcript || '', evidence: c.evidence || [], selected: true, score: c.overall_score }));
    onChange({ viral });
  }

  const sorted = useMemo(() => [...candidates].sort((a, b) => b.overall_score - a.overall_score), [candidates]);

  if (!assetId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <FileVideo size={28} className="text-slate-600" />
        <p className="text-xs text-slate-400">Este recorte é de demonstração — sem Asset real do Acervo vinculado.</p>
        <button onClick={onOpenNewClip} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400"><Sparkles size={12} /> Novo corte com asset do Acervo</button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Asset #{assetId.slice(-6)} · trecho {fmt(clip.in_ms)}–{fmt(clip.out_ms)}</p>
        {analysisMode ? <span className="text-[10px] text-slate-500">Candidatos da análise desta sessão. Para reanalisar, use "Gerar sugestões".</span> : <button onClick={processar} disabled={loading} className="flex items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-violet-400 disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {loading ? (step || 'Processando...') : (candidates.length ? 'Reprocessar IA' : 'Processar IA')}
        </button>}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-800/40 bg-rose-950/30 p-2 text-[11px] text-rose-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={processar} className="flex items-center gap-1 rounded-md bg-rose-800/40 px-2 py-0.5 text-[10px] hover:bg-rose-800/60"><RefreshCw size={11} /> Tentar novamente</button>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading && candidates.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-[11px] text-slate-500">
            <Loader2 size={20} className="animate-spin text-violet-400" />
            {step || 'Processando...'}
          </div>
        )}
        {!loading && sorted.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-[11px] text-slate-500">
            <Sparkles size={22} className="text-slate-600" />
            Nenhum candidato ainda. Processe o trecho para a IA encontrar os melhores cortes.
          </div>
        )}
        {sorted.map((c) => (
          <CandidateCard
            key={c.id || c.start_ms}
            c={c}
            clip={clip}
            seekTo={seekTo}
            onToggle={toggle}
            onFav={fav}
            onReject={reject}
            onApplySuggestion={applySuggestion}
            onPromote={promote}
            promoting={promotingId === (c.id || c.start_ms)}
          />
        ))}
      </div>

      <div className="flex justify-end border-t border-slate-800 pt-3">
        <button onClick={onAvancar} disabled={selectedCount === 0} className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">Gerar legendas dos {selectedCount} selecionados →</button>
      </div>
    </div>
  );
}
