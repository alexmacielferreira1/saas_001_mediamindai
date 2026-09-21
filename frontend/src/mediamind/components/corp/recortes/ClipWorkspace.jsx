import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { STAGES, fmt } from './clipModel';
import ClipPlayer from './ClipPlayer';
import ClipCandidatesPanel from './ClipCandidatesPanel';
import ClipLegendasPanel from './ClipLegendasPanel';
import ClipCGPanel from './ClipCGPanel';
import ClipReimportPanel from './ClipReimportPanel';

function SelecaoPanel({ clip, onChange, onAvancar }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs text-slate-400">Use o player pra navegar, marque <b>IN</b> e <b>OUT</b> e defina o corte geral que a IA vai processar.</p>
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
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-400">
        Trecho selecionado: <span className="text-emerald-300">{fmt(clip.in_ms)} – {fmt(clip.out_ms)}</span> · {((clip.out_ms - clip.in_ms) / 1000).toFixed(1)}s
      </div>
      <div className="mt-auto flex justify-end">
        <button onClick={onAvancar} disabled={!clip.out_ms} className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">Processar IA →</button>
      </div>
    </div>
  );
}

// Workspace do recorte: stepper (Seleção → IA → Legendas → CGs → Reimportar)
// + player IN/OUT + painel da etapa ativa.
export default function ClipWorkspace({ clip, onChange, onProsseguir, onOpenNewClip }) {
  const [stage, setStage] = useState(clip.stage || 'selecao');
  const seekRef = useRef(null);
  const seekTo = (ms) => seekRef.current?.(ms);

  useEffect(() => { setStage(clip.stage || 'selecao'); }, [clip.id, clip.stage]);

  function patch(p) { onChange(p); }
  function setStageBoth(s) { setStage(s); patch({ stage: s }); }
  function salvar() { patch({ salvo: true }); setStageBoth('cg'); }

  const segments = [
    ...(clip.viral || []).filter((v) => v.selected).map((v) => ({ start_ms: v.start_ms, end_ms: v.end_ms, color: 'bg-violet-500/40', title: v.titulo })),
    ...(clip.cgs || []).map((c) => ({ start_ms: c.start_ms, end_ms: c.end_ms, color: 'bg-sky-500/30', title: c.titulo })),
  ];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/40 p-2">
        {STAGES.map((s, i) => {
          const active = stage === s.id;
          const done = STAGES.findIndex((x) => x.id === stage) > i;
          return (
            <React.Fragment key={s.id}>
              <button onClick={() => setStageBoth(s.id)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${active ? 'bg-sky-500 text-slate-950' : done ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:bg-slate-800'}`}>
                {done ? <Check size={12} /> : <span className="text-[9px]">{i + 1}</span>} {s.name}
              </button>
              {i < STAGES.length - 1 && <span className="px-0.5 text-slate-700">→</span>}
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">{STAGES.find((s) => s.id === stage)?.desc}</p>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <ClipPlayer
            source_url={clip.source_url}
            in_ms={clip.in_ms}
            out_ms={clip.out_ms}
            segments={segments}
            onSetIn={(ms) => patch({ in_ms: ms })}
            onSetOut={(ms) => patch({ out_ms: ms })}
            onReady={(d) => patch({ duration_ms: d })}
            seekRef={seekRef}
          />
        </div>
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          {stage === 'selecao' && <SelecaoPanel clip={clip} onChange={patch} onAvancar={() => setStageBoth('ia')} />}
          {stage === 'ia' && <ClipCandidatesPanel clip={clip} onChange={patch} seekTo={seekTo} onAvancar={() => setStageBoth('legendas')} onOpenNewClip={onOpenNewClip} />}
          {stage === 'legendas' && <ClipLegendasPanel clip={clip} onChange={patch} seekTo={seekTo} onSalvar={salvar} onAvancar={() => setStageBoth('ia')} />}
          {stage === 'cg' && <ClipCGPanel clip={clip} onChange={patch} seekTo={seekTo} onAvancar={() => setStageBoth('reimport')} />}
          {stage === 'reimport' && <ClipReimportPanel clip={clip} onChange={patch} onProsseguir={onProsseguir} />}
        </div>
      </div>
    </div>
  );
}
