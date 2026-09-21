import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Info, Sparkles, Tag } from 'lucide-react';
import { STAGES, fmt } from './clipModel';
import ClipPlayer from './ClipPlayer';
import ClipCandidatesPanel from './ClipCandidatesPanel';
import ClipLegendasPanel from './ClipLegendasPanel';
import ClipNetworkFormatsPanel from './ClipNetworkFormatsPanel';
import { ClipApprovalStage, ClipPublicationStage } from './ClipSocialStages';
import ClipReimportPanel from './ClipReimportPanel';
import ClipStageResources from './ClipStageResources';

function AnalysisAndCaptions({ clip, onChange, seekTo, onFinish, onOpenNewClip }) {
  const [tab, setTab] = useState('ia');
  return (
    <div className="flex h-full min-h-[25rem] flex-col">
      <div className="mb-2 flex gap-1 border-b border-slate-800 pb-2">
        <button onClick={() => setTab('ia')} className={`rounded px-2.5 py-1 text-[10px] font-bold ${tab === 'ia' ? 'bg-violet-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>Análise IA</button>
        <button onClick={() => setTab('legendas')} className={`rounded px-2.5 py-1 text-[10px] font-bold ${tab === 'legendas' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>Legendas e áudio</button>
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'ia' ? <ClipCandidatesPanel clip={clip} onChange={onChange} seekTo={seekTo} onAvancar={() => setTab('legendas')} onOpenNewClip={onOpenNewClip} /> : <ClipLegendasPanel clip={clip} onChange={onChange} seekTo={seekTo} onSalvar={onFinish} onAvancar={() => setTab('ia')} />}
      </div>
    </div>
  );
}

function SelecaoPanel({ clip, onChange, onAvancar }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-[10px] font-bold uppercase text-sky-300">Informações do original</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-slate-800 bg-slate-950/40 p-3 text-[10px]">{[['Produção','Jornal da Cidade'],['Duração total','00:01:24'],['Formato','MP4 (H.264)'],['Resolução','1920 × 1080'],['Taxa de quadros','30 fps'],['Tamanho','158 MB']].map(([label,value])=><div key={label}><p className="text-slate-500">{label}</p><b className="text-slate-200">{value}</b></div>)}</div>
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
      <div className="space-y-2 border border-slate-800 bg-slate-950/40 p-3 text-[10px]"><p className="font-bold uppercase text-slate-400">Opções do corte</p><label className="flex items-center gap-2 text-slate-300"><input type="checkbox" defaultChecked/> Cortar áudio junto com o vídeo</label><label className="flex items-center gap-2 text-slate-300"><input type="checkbox"/> Silenciar, mantendo apenas a legenda</label><label className="block text-slate-500">Título do corte<input value={clip.titulo} onChange={(e)=>onChange({titulo:e.target.value})} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"/></label><div className="flex flex-wrap gap-1">{['obras','prefeito','cidade'].map((tag)=><span key={tag} className="rounded bg-slate-800 px-2 py-1 text-sky-300">#{tag}</span>)}</div></div>
      <div className="mt-auto flex justify-end">
        <button onClick={onAvancar} disabled={!clip.out_ms} className="rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-50">Processar IA →</button>
      </div>
    </div>
  );
}

function AnalysisSummary() {
  return <aside className="space-y-3 border border-slate-800 bg-slate-950/45 p-3"><div className="flex items-center gap-3"><div className="grid size-16 place-items-center rounded-full border-4 border-emerald-400 text-xl font-black text-slate-100">85</div><div><p className="text-[10px] font-bold text-amber-300">Alto potencial</p><p className="text-[9px] text-slate-500">Boa retenção e tema relevante.</p></div></div>{[['Relevância do tema',92],['Engajamento estimado',88],['Clareza da mensagem',85],['Potencial de viralização',78]].map(([label,value])=><div key={label}><div className="flex justify-between text-[9px] text-slate-400"><span>{label}</span><b>{value}</b></div><div className="mt-1 h-1 bg-slate-800"><div className="h-full bg-emerald-400" style={{width:`${value}%`}}/></div></div>)}<div><p className="mb-1 flex items-center gap-1 text-[9px] font-bold text-slate-300"><Tag size={10}/>Tópicos identificados</p><div className="flex flex-wrap gap-1">{['obras','mobilidade','cidade','prefeito','investimento'].map((tag)=><span key={tag} className="rounded bg-slate-800 px-1.5 py-1 text-[8px] text-slate-300">{tag}</span>)}</div></div><div className="border border-sky-900/60 bg-sky-950/20 p-2 text-[9px] text-slate-400"><p className="mb-1 flex items-center gap-1 font-bold text-sky-300"><Sparkles size={10}/>Resumo da IA</p>Trecho com alto potencial para engajamento. Abertura clara, objetiva e adequada para redes sociais.</div></aside>;
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
  function salvar() { patch({ salvo: true }); setStageBoth('legendas'); }

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

      {stage === 'formatos' ? <ClipNetworkFormatsPanel clip={clip} onChange={patch} onProsseguir={onProsseguir}/> : <>
      {stage === 'ia' ? <div className="grid min-h-[34rem] gap-3 xl:grid-cols-[1.05fr_1.05fr_.55fr]"><div className="min-h-0 rounded-xl border border-slate-800 bg-slate-900/40 p-3"><AnalysisAndCaptions clip={clip} onChange={patch} seekTo={seekTo} onFinish={salvar} onOpenNewClip={onOpenNewClip}/></div><div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"><ClipPlayer source_url={clip.source_url} in_ms={clip.in_ms} out_ms={clip.out_ms} segments={segments} onSetIn={(ms)=>patch({in_ms:ms})} onSetOut={(ms)=>patch({out_ms:ms})} onReady={(d)=>patch({duration_ms:d})} seekRef={seekRef}/><div className="mt-3 border border-slate-800 bg-slate-950/40 p-3 text-[10px]"><p className="font-bold text-slate-300">Transcrição / Legenda do trecho selecionado</p><p className="mt-2 text-slate-400">Isso vai melhorar a mobilidade e a qualidade de vida da população.</p></div></div><AnalysisSummary/></div> : <div className="grid min-h-[31rem] gap-3 xl:grid-cols-[1.3fr_1fr]">
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
          {stage === 'legendas' && <ClipReimportPanel clip={clip} onChange={patch} onProsseguir={() => setStageBoth('cg')} />}
          {stage === 'cg' && <ClipApprovalStage clip={clip} onChange={patch} onAdvance={() => setStageBoth('reimport')} />}
          {stage === 'reimport' && <ClipPublicationStage clip={clip} onChange={patch} onAdvance={() => setStageBoth('formatos')} />}
        </div>
      </div>}
      <ClipStageResources stage={stage} />
      </>}
    </div>
  );
}
