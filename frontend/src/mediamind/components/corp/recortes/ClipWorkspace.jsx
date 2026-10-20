import React, { useEffect, useRef, useState } from 'react';
import { Captions, Check, Crop, Layers3, Type } from 'lucide-react';
import { STAGES, fmt } from './clipModel';
import { CLIP_DURATION_PRESETS, sortCaptions, splitCaption } from '../../../lib/captionTools';
import { captionAt, emptyHistory, recordHistory, redoHistory, resolveHistoryKey, undoHistory } from '../../../lib/clipEditorTools';

const ASPECTS = ['9:16', '1:1', '16:9'];
import ClipPlayer from './ClipPlayer';
import ClipCandidatesPanel from './ClipCandidatesPanel';
import ClipLegendasPanel from './ClipLegendasPanel';
import ClipNetworkFormatsPanel from './ClipNetworkFormatsPanel';
import { ClipApprovalStage, ClipPublicationStage } from './ClipSocialStages';
import ClipReimportPanel from './ClipReimportPanel';
import ClipStageResources from './ClipStageResources';
import ClipCGPanel from './ClipCGPanel';

function AnalysisAndCaptions({ clip, onChange, seekTo, onFinish, onOpenNewClip, captionTools }) {
  const [tab, setTab] = useState('ia');
  return (
    <div className="flex h-full min-h-[25rem] flex-col">
      <div className="mb-2 flex gap-1 border-b border-slate-800 pb-2">
        <button onClick={() => setTab('ia')} className={`rounded px-2.5 py-1 text-[10px] font-bold ${tab === 'ia' ? 'bg-violet-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>Análise IA</button>
        <button onClick={() => setTab('legendas')} className={`rounded px-2.5 py-1 text-[10px] font-bold ${tab === 'legendas' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>Legendas e áudio</button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'ia' ? <ClipCandidatesPanel clip={clip} onChange={onChange} seekTo={seekTo} onAvancar={() => setTab('legendas')} onOpenNewClip={onOpenNewClip} /> : <ClipLegendasPanel clip={clip} onChange={onChange} seekTo={seekTo} onSalvar={onFinish} onAvancar={() => setTab('ia')} {...captionTools} />}
      </div>
    </div>
  );
}

function SelecaoPanel({ clip, onChange, onAvancar }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-[10px] font-bold uppercase text-sky-300">Informações do original</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-slate-800 bg-slate-950/40 p-3 text-[10px]">{[['Título', clip.titulo || 'Sem título'], ['Duração total', clip.duration_ms ? fmt(clip.duration_ms) : 'Não disponível']].map(([label,value])=><div key={label}><p className="text-slate-500">{label}</p><b className="text-slate-200">{value}</b></div>)}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-0.5 block text-[9px] uppercase text-slate-500">IN (ms)</span>
          <input type="number" value={clip.in_ms} onChange={(e) => onChange({ in_ms: +e.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[9px] uppercase text-slate-500">OUT (ms)</span>
          <input type="number" value={clip.out_ms} onChange={(e) => onChange({ out_ms: +e.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500" />
        </label>
      </div>
      {clip.out_ms > 0 && clip.out_ms <= clip.in_ms && <p role="alert" className="text-[10px] text-rose-300">O OUT precisa ser posterior ao IN.</p>}
      {clip.duration_ms > 0 && clip.out_ms > clip.duration_ms && <p role="alert" className="text-[10px] text-amber-300">O OUT passa da duração do vídeo ({fmt(clip.duration_ms)}).</p>}
      <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500" aria-label="Duração a partir do IN"><span className="uppercase">Duração a partir do IN</span>{CLIP_DURATION_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => onChange({ out_ms: Math.round((clip.in_ms || 0) + preset.seconds * 1000 > (clip.duration_ms || Infinity) ? clip.duration_ms : (clip.in_ms || 0) + preset.seconds * 1000) })} className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:border-sky-500">{preset.label}</button>)}</div>
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-400">
        Trecho selecionado: <span className="text-emerald-300">{fmt(clip.in_ms)} – {fmt(clip.out_ms)}</span> · {((clip.out_ms - clip.in_ms) / 1000).toFixed(1)}s
      </div>
      <div className="space-y-2 border border-slate-800 bg-slate-950/40 p-3 text-[10px]"><p className="font-bold uppercase text-slate-400">Opções do corte</p><label className="block text-slate-500">Título do corte<input value={clip.titulo} onChange={(e)=>onChange({titulo:e.target.value})} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"/></label></div>
      <div className="mt-auto flex justify-end">
        <button onClick={onAvancar} disabled={!clip.out_ms} className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">Processar IA →</button>
      </div>
    </div>
  );
}

// Workspace do recorte: stepper (Seleção → IA → Legendas → CGs → Reimportar)
// + player IN/OUT + painel da etapa ativa.
export default function ClipWorkspace({ clip, onChange, onProsseguir, onOpenNewClip, onEnsureAsset }) {
  const [stage, setStage] = useState(clip.stage || 'selecao');
  const [editPanel, setEditPanel] = useState('corte');
  const seekRef = useRef(null);
  const seekTo = (ms) => seekRef.current?.(ms);

  // Desfazer/refazer de legendas e atalhos S/Delete.
  // Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md
  const playheadRef = useRef(0);
  const [history, setHistory] = useState(emptyHistory);
  const historyRef = useRef(history);
  historyRef.current = history;
  const legendasRef = useRef(clip.legendas || []);
  legendasRef.current = clip.legendas || [];

  useEffect(() => { setStage(clip.stage || 'selecao'); setEditPanel('corte'); }, [clip.id, clip.stage]);
  useEffect(() => { setHistory(emptyHistory()); }, [clip.id]);

  // Mudanças seguidas em menos de 700 ms (digitação) viram um só passo; comandos usam coalesceMs 0.
  function patch(p, options) {
    const coalesceMs = options?.coalesceMs ?? 700;
    if (p && Object.prototype.hasOwnProperty.call(p, 'legendas') && p.legendas !== legendasRef.current) {
      const previous = legendasRef.current;
      setHistory((current) => recordHistory(current, previous, { coalesceMs }));
    }
    onChange(p);
  }
  function undoCaptions() {
    const result = undoHistory(historyRef.current, legendasRef.current);
    if (!result) return false;
    setHistory(result.history);
    onChange({ legendas: result.value });
    return true;
  }
  function redoCaptions() {
    const result = redoHistory(historyRef.current, legendasRef.current);
    if (!result) return false;
    setHistory(result.history);
    onChange({ legendas: result.value });
    return true;
  }
  const historyActions = useRef(null);
  historyActions.current = { undo: undoCaptions, redo: redoCaptions };
  useEffect(() => {
    function onKey(event) {
      const action = resolveHistoryKey(event);
      if (action && historyActions.current?.[action]()) event.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  function splitCaptionAt(ms) {
    const target = captionAt(legendasRef.current, ms);
    if (!target || !(ms > target.start_ms && ms < target.end_ms)) return;
    const [a, b] = splitCaption(target, ms);
    if (!String(a.texto || '').trim() || !String(b.texto || '').trim()) return;
    patch({ legendas: sortCaptions(legendasRef.current.map((l) => (l.id === target.id ? a : l)).concat(b)) }, { coalesceMs: 0 });
  }
  function deleteCaptionAt(ms) {
    const target = captionAt(legendasRef.current, ms);
    if (!target) return;
    patch({ legendas: legendasRef.current.filter((l) => l.id !== target.id) }, { coalesceMs: 0 });
  }
  const captionTools = {
    onUndo: undoCaptions, onRedo: redoCaptions,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0,
    getPlayhead: () => playheadRef.current,
  };
  const playerTools = { playheadRef, onSplitAt: splitCaptionAt, onDeleteAt: deleteCaptionAt };
  function moveLayer(id, start_ms, end_ms) { patch({ cgs: (clip.cgs || []).map((layer) => layer.id === id ? { ...layer, start_ms, end_ms } : layer) }); }
  function setStageBoth(s) { setStage(s); patch({ stage: s }); }
  function salvar() { setStage('legendas'); patch({ salvo: true, stage: 'legendas' }); }
  function addTextLayer() {
    patch({
      cgs: [...(clip.cgs || []), {
        id: `text-${Date.now()}`,
        tipo: 'titulo',
        titulo: 'Novo texto',
        start_ms: clip.in_ms || 0,
        end_ms: Math.max((clip.in_ms || 0) + 3000, clip.out_ms || 0),
      }],
    });
    setEditPanel('camadas');
  }

  const segments = [
    ...(clip.viral || []).filter((v) => v.selected).map((v) => ({ start_ms: v.start_ms, end_ms: v.end_ms, color: 'bg-violet-500/40', title: v.titulo })),
    ...(clip.cgs || []).map((c) => ({ start_ms: c.start_ms, end_ms: c.end_ms, color: 'bg-sky-500/30', title: c.titulo })),
  ];

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-900/40 p-2 md:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((s, i) => {
          const active = stage === s.id;
          const done = STAGES.findIndex((x) => x.id === stage) > i;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStageBoth(s.id)} className={`min-h-12 rounded-lg px-2.5 py-1.5 text-left text-[10px] font-medium transition ${active ? 'bg-sky-500 text-slate-950' : done ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:bg-slate-800'}`}>
                <span className="mr-1 inline-grid size-5 place-items-center rounded-full bg-slate-950/20">{done ? <Check size={11} /> : i + 1}</span><b>{s.name}</b>
              </button>
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">{STAGES.find((s) => s.id === stage)?.desc}</p>
      <p className="text-[10px] text-amber-300/90">Edições de cortes, enquadramento e texto nesta tela são uma prévia; o MP4 de Edição externa aplica formato, reenquadramento, legendas, textos e cortes internos quando marcados. Imagens e GCs animados continuam só na prévia.</p>

      {stage === 'selecao' && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-2" aria-label="Ferramentas do editor">
        <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Editor</span>
        <button type="button" onClick={() => setEditPanel('camadas')} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-sky-500"><Layers3 size={13} /> Camadas</button>
        <button type="button" onClick={addTextLayer} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-sky-500"><Type size={13} /> Adicionar texto</button>
        <button type="button" onClick={() => setStageBoth('ia')} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-sky-500"><Captions size={13} /> Legendas</button>
        <button type="button" onClick={() => patch({ reenquadramento: clip.reenquadramento === 'fill' ? 'fit' : 'fill' })} className="ml-auto flex items-center gap-1 rounded-md border border-violet-700/70 px-2.5 py-1.5 text-[11px] text-violet-200 hover:bg-violet-950/30"><Crop size={13} /> Reenquadrar: {clip.reenquadramento === 'fit' ? 'Ajustar' : 'Preencher'}</button>
        <div className="flex items-center gap-1" role="group" aria-label="Formato do corte">{ASPECTS.map((aspect) => <button key={aspect} type="button" aria-pressed={(clip.formato || '16:9') === aspect} onClick={() => patch({ formato: aspect })} className={`rounded-md border px-2 py-1.5 text-[11px] ${(clip.formato || '16:9') === aspect ? 'border-violet-400 bg-violet-500/20 text-violet-100' : 'border-slate-700 text-slate-300 hover:border-violet-500'}`}>{aspect}</button>)}</div>
        {clip.reenquadramento !== 'fit' && <label className="flex items-center gap-1 text-[10px] text-slate-400">Foco horizontal<input aria-label="Foco horizontal do reenquadramento" type="range" min="0" max="100" value={Math.round((clip.foco_x ?? 0.5) * 100)} onChange={(e) => patch({ foco_x: Number(e.target.value) / 100 })} className="w-20" /></label>}
      </div>}

      {stage === 'formatos' ? <ClipNetworkFormatsPanel clip={clip} onChange={patch} onProsseguir={onProsseguir}/> : <>
      {stage === 'ia' ? <div className="grid min-h-[34rem] gap-3 xl:grid-cols-[1fr_1fr_1.15fr]"><div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/40 p-3"><AnalysisAndCaptions clip={clip} onChange={patch} seekTo={seekTo} onFinish={salvar} onOpenNewClip={onOpenNewClip} captionTools={captionTools}/></div><div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/40 p-3"><ClipPlayer source_url={clip.source_url} captions={clip.legendas} videoCuts={clip.cortes_video} overlays={clip.cgs} onMoveLayer={moveLayer} fit={clip.reenquadramento} format={clip.formato} focusX={clip.foco_x ?? null} captionTemplate={clip.legenda_estilo} captionSettings={clip.legenda_config} in_ms={clip.in_ms} out_ms={clip.out_ms} segments={segments} onSetIn={(ms)=>patch({in_ms:ms})} onSetOut={(ms)=>patch({out_ms:ms})} onReady={(d)=>patch({duration_ms:d})} seekRef={seekRef} {...playerTools}/><div className="mt-3 border border-slate-800 bg-slate-950/40 p-3 text-[10px]"><p className="font-bold text-slate-300">Transcrição / Legenda do trecho selecionado</p><p className="mt-2 text-slate-400">{clip.legendas?.map((caption) => caption.texto).join(' ') || 'Nenhuma transcrição disponível.'}</p></div></div><aside aria-label="Editor de legendas" className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/40 p-3"><h3 className="mb-3 text-sm font-bold text-slate-100">Legendas</h3><ClipLegendasPanel clip={clip} onChange={patch} seekTo={seekTo} onSalvar={salvar} {...captionTools} /></aside></div> : <div className="grid min-h-[31rem] gap-3 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <ClipPlayer
            source_url={clip.source_url}
            captions={clip.legendas}
            videoCuts={clip.cortes_video}
            overlays={clip.cgs}
            onMoveLayer={moveLayer}
            fit={clip.reenquadramento}
            format={clip.formato}
            focusX={clip.foco_x ?? null}
            captionTemplate={clip.legenda_estilo}
            captionSettings={clip.legenda_config}
            in_ms={clip.in_ms}
            out_ms={clip.out_ms}
            segments={segments}
            onSetIn={(ms) => patch({ in_ms: ms })}
            onSetOut={(ms) => patch({ out_ms: ms })}
            onReady={(d) => patch({ duration_ms: d })}
            seekRef={seekRef}
            {...playerTools}
          />
        </div>
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          {stage === 'selecao' && <>
            <div className="mb-3 flex gap-1 border-b border-slate-800 pb-2">
              <button onClick={() => setEditPanel('corte')} className={`rounded px-2.5 py-1 text-[10px] font-bold ${editPanel === 'corte' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>Corte</button>
              <button onClick={() => setEditPanel('camadas')} className={`rounded px-2.5 py-1 text-[10px] font-bold ${editPanel === 'camadas' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>Camadas e arte</button>
            </div>
            {editPanel === 'corte' ? <SelecaoPanel clip={clip} onChange={patch} onAvancar={() => setStageBoth('ia')} /> : <ClipCGPanel clip={clip} onChange={patch} seekTo={seekTo} onAvancar={() => setStageBoth('ia')} />}
          </>}
          {stage === 'legendas' && <ClipReimportPanel clip={clip} onChange={patch} onEnsureAsset={onEnsureAsset} onProsseguir={() => setStageBoth('cg')} />}
          {stage === 'cg' && <ClipApprovalStage clip={clip} onChange={patch} onAdvance={() => setStageBoth('reimport')} />}
          {stage === 'reimport' && <ClipPublicationStage clip={clip} onChange={patch} onAdvance={() => setStageBoth('formatos')} />}
        </div>
      </div>}
      <ClipStageResources stage={stage} clip={clip} onChange={patch} />
      </>}
    </div>
  );
}
