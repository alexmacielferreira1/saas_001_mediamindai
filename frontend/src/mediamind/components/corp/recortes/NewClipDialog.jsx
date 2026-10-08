import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Film, Sparkles, FileVideo, AlertTriangle } from 'lucide-react';
import { useEmpresa } from '../../../lib/empresaContext';
import { listAssets, getAsset } from '../../../lib/clipEngineService';
import { Loading, EmptyState } from '../../shared';
import { fmt } from './clipModel';

const PURPOSES = [
  { id: 'social', label: 'Redes sociais' },
  { id: 'jornalismo', label: 'Jornalismo' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'entrevista', label: 'Entrevista' },
  { id: 'institucional', label: 'Institucional' },
  { id: 'esporte', label: 'Esporte' },
  { id: 'documental', label: 'Documental' },
];
const DURATIONS = [
  { id: 'auto', label: 'Automático' },
  { id: '<30s', label: '< 30s' },
  { id: '30-60s', label: '30–60s' },
  { id: '60-90s', label: '60–90s' },
  { id: '90s-3min', label: '90s–3min' },
];
const RATIOS = ['9:16', '16:9', '1:1', '4:5'];
const PROFILES = [
  { id: 'social', label: 'Social' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'documental', label: 'Documental' },
];

// Dialog "Novo corte" — seleção de Asset real do Acervo + configurações de
// análise. Não usa vídeo demo: a origem é sempre um Asset do MediaMind.
export default function NewClipDialog({ open, onClose, onCreated, preselectedAssetId }) {
  const { current: empresaId, isGlobal } = useEmpresa();
  const eid = isGlobal ? '' : empresaId;
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [assetId, setAssetId] = useState('');
  const [mode, setMode] = useState('ia');
  const [purpose, setPurpose] = useState('social');
  const [duration, setDuration] = useState('auto');
  const [ratio, setRatio] = useState('9:16');
  const [profile, setProfile] = useState('social');
  const [prompt, setPrompt] = useState('');
  const [inMs, setInMs] = useState(0);
  const [outMs, setOutMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true); setErr('');
    listAssets(eid ? { empresa_id: eid } : {})
      .then((list) => setAssets(list.filter((a) => a.asset_type === 'video' || a.asset_type === 'audio')))
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [open, eid]);

  // Pré-seleção via ?asset=<id> (vinda do Acervo/Workspace).
  useEffect(() => {
    if (open && preselectedAssetId) {
      setAssetId(preselectedAssetId);
      getAsset(preselectedAssetId).then((a) => setDurationMs(a?.duration || 0)).catch(() => {});
    }
  }, [open, preselectedAssetId]);

  if (!open) return null;

  const filtered = assets.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (a.title || a.filename || '').toLowerCase().includes(q) || (a.program_name || '').toLowerCase().includes(q);
  });

  function choose(a) {
    setAssetId(String(a.id));
    setDurationMs(a.duration || 0);
    setOutMs(a.duration || 0);
  }

  function processar() {
    const asset = assets.find((a) => String(a.id) === assetId) || null;
    if (!asset) return;
    const recorte = {
      id: `clip-${Date.now()}`,
      titulo: prompt ? `Corte — ${prompt.slice(0, 40)}` : `Corte — ${asset.title || asset.filename || 'asset'}`,
      source_asset_id: String(asset.id),
      source_url: asset.stream_url || asset.source_url || asset.path || '',
      duration_ms: durationMs || asset.duration || 0,
      stage: mode === 'ia' ? 'ia' : 'selecao',
      in_ms: inMs || 0,
      out_ms: outMs || durationMs || 0,
      prompt, purpose, duration_label: duration, aspect_ratio: ratio, score_profile: profile,
      viral: [], legendas: [], cortes_audio: [], cgs: [], salvo: false, edited_url: '', pronto: false,
      empresa_id: eid,
    };
    onCreated(recorte);
    onClose();
  }

  const sel = assets.find((a) => String(a.id) === assetId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-400" />
            <h2 className="text-sm font-bold text-slate-100">Novo corte — MediaMind AI Clip Engine</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"><X size={18} /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[1.1fr_1fr]">
          {/* Coluna esquerda: seleção de asset */}
          <div className="flex min-h-0 flex-col border-r border-slate-800">
            <div className="border-b border-slate-800 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Origem — Asset do Acervo</p>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no acervo..." className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-sky-500" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              {loading && <Loading label="Carregando acervo..." />}
              {err && <EmptyState icon={AlertTriangle} title="Erro ao carregar acervo" description={err} />}
              {!loading && !err && filtered.length === 0 && <EmptyState icon={FileVideo} title="Nenhum asset de vídeo/áudio" description="Ingeste mídia no Acervo para criar cortes." />}
              {filtered.map((a) => (
                <button key={a.id} onClick={() => choose(a)} className={`mb-1.5 flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${assetId === String(a.id) ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 hover:bg-slate-800/40'}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400"><Film size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">{a.title || a.filename}</p>
                    <p className="text-[10px] text-slate-500">{a.program_name || '—'} · {fmt(a.duration || 0)} · {a.asset_type}</p>
                  </div>
                  {assetId === String(a.id) && <Sparkles size={13} className="shrink-0 text-sky-300" />}
                </button>
              ))}
            </div>
          </div>

          {/* Coluna direita: configurações */}
          <div className="min-h-0 overflow-y-auto p-4">
            {!sel ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-slate-500">
                <div><FileVideo size={26} className="mx-auto mb-2 text-slate-600" />Selecione um asset do acervo para configurar o corte.</div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                  <p className="truncate text-xs font-semibold text-slate-200">{sel.title || sel.filename}</p>
                  <p className="text-[10px] text-slate-500">{fmt(sel.duration || 0)} · {sel.asset_type}</p>
                </div>

                {/* Modo */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase text-slate-400">Modo</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setMode('ia')} className={`rounded-lg border px-3 py-2 text-left text-xs ${mode === 'ia' ? 'border-violet-600 bg-violet-950/30 text-slate-100' : 'border-slate-800 text-slate-400 hover:bg-slate-800/40'}`}>
                      <p className="font-semibold">Recorte por IA</p>
                      <p className="text-[10px] text-slate-500">Transcrição + análise + candidatos</p>
                    </button>
                    <button onClick={() => setMode('manual')} className={`rounded-lg border px-3 py-2 text-left text-xs ${mode === 'manual' ? 'border-sky-600 bg-sky-950/30 text-slate-100' : 'border-slate-800 text-slate-400 hover:bg-slate-800/40'}`}>
                      <p className="font-semibold">Abrir editor</p>
                      <p className="text-[10px] text-slate-500">Marcar IN/OUT manualmente</p>
                    </button>
                  </div>
                </div>

                {/* Finalidade + duração */}
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Finalidade</span>
                    <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500">
                      {PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Duração desejada</span>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500">
                      {DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </label>
                </div>

                {/* Formato + perfil */}
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Formato</span>
                    <div className="flex gap-1.5">
                      {RATIOS.map((r) => (
                        <button key={r} onClick={() => setRatio(r)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${ratio === r ? 'border-sky-600 bg-sky-950/30 text-sky-300' : 'border-slate-800 text-slate-400 hover:bg-slate-800/40'}`}>{r}</button>
                      ))}
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Perfil de score</span>
                    <select value={profile} onChange={(e) => setProfile(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500">
                      {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                </div>

                {/* Intervalo */}
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase text-slate-400">Intervalo a processar</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-0.5 block text-[9px] text-slate-500">IN (ms)</span>
                      <input type="number" value={inMs} onChange={(e) => setInMs(+e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
                    </label>
                    <label className="block">
                      <span className="mb-0.5 block text-[9px] text-slate-500">OUT (ms) — 0 = até o fim</span>
                      <input type="number" value={outMs} onChange={(e) => setOutMs(+e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
                    </label>
                  </div>
                </div>

                {/* Prompt */}
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Prompt — incluir momentos específicos</span>
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} placeholder="Ex.: encontre momentos em que o entrevistado explica o afeto no desenvolvimento infantil" className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <p className="text-[10px] text-slate-500">{mode === 'ia' ? 'Transcrição → análise IA → candidatos com score' : 'Editor manual com IN/OUT'}</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">Cancelar</button>
            <button onClick={processar} disabled={!sel} className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">
              {mode === 'ia' ? <Sparkles size={13} /> : <Film size={13} />} {mode === 'ia' ? 'Processar' : 'Abrir editor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
