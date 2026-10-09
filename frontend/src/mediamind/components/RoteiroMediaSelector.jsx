import React, { useState } from 'react';
import { Check, Copy, Info, Play, X } from 'lucide-react';

import { formatDuration } from '../data';

export default function RoteiroMediaSelector({ asset, onCancel, onConfirm }) {
  const [clipIn, setClipIn] = useState('00:01:14');
  const [clipOut, setClipOut] = useState('00:01:42');
  const [tab, setTab] = useState('transcricao');
  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#061426] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-800 px-4 py-3">
          <div><h2 className="text-lg font-bold text-slate-100">Selecionar trecho da mídia</h2><p className="text-xs text-slate-400">Escolha o trecho exato, ajuste as deixas e confira a transcrição.</p></div>
          <button onClick={onCancel} aria-label="Fechar seleção" className="rounded p-1 text-slate-400 hover:bg-slate-800"><X size={18}/></button>
        </header>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1.15fr_.75fr]">
          <section>
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded border border-slate-700 bg-[radial-gradient(circle_at_55%_35%,#41647c,#0b1727_68%)]">
              <button className="grid size-12 place-items-center rounded-full border border-white/40 bg-black/30 text-white"><Play size={21}/></button>
              <div className="absolute inset-x-4 bottom-4 h-1 rounded bg-slate-700"><span className="block h-full w-[34%] rounded bg-sky-400"/></div>
            </div>
            <div className="mt-3 flex h-16 gap-0.5 overflow-hidden rounded border border-slate-700 bg-slate-950 p-1">{Array.from({length:16},(_,index)=><span key={index} className="min-w-9 flex-1 border border-slate-700 bg-gradient-to-b from-slate-600 to-slate-900"/>)}</div>
            <div className="relative h-8 border-t border-slate-700"><span className="absolute left-[22%] h-7 w-px bg-emerald-400"/><span className="absolute left-[42%] h-7 w-px bg-rose-400"/></div>
            <div className="grid gap-2 sm:grid-cols-3"><TimeField label="Deixa inicial" value={clipIn} onChange={setClipIn}/><TimeField label="Deixa final" value={clipOut} onChange={setClipOut}/><div className="rounded border border-slate-700 bg-slate-950 px-3 py-2"><span className="block text-[9px] uppercase text-slate-500">Duração do trecho</span><strong className="font-mono text-xs text-slate-200">00:00:28</strong></div></div>
            <div className="mt-3 rounded border border-slate-700 bg-slate-950/60">
              <nav className="flex border-b border-slate-800"><button onClick={()=>setTab('transcricao')} className={`px-3 py-2 text-[10px] ${tab==='transcricao'?'border-b-2 border-sky-500 text-sky-300':'text-slate-500'}`}>Transcrição do trecho</button><button onClick={()=>setTab('info')} className={`px-3 py-2 text-[10px] ${tab==='info'?'border-b-2 border-sky-500 text-sky-300':'text-slate-500'}`}><Info size={11} className="mr-1 inline"/>Informações da mídia</button></nav>
              <div className="space-y-1.5 p-3 text-[10px] text-slate-400">{tab==='transcricao'?<><p><b className="mr-3 font-mono text-sky-400">00:01:14</b>A região central recebeu novas obras de mobilidade.</p><p><b className="mr-3 font-mono text-sky-400">00:01:25</b>O projeto amplia o acesso e reduz o tempo de deslocamento.</p><p><b className="mr-3 font-mono text-sky-400">00:01:38</b>A entrega está prevista para o próximo semestre.</p></>:<p>{asset.title} · {formatDuration(asset.duration)} · {asset.category || 'Conteúdo audiovisual'}</p>}</div>
            </div>
          </section>
          <aside className="space-y-3"><div><span className="rounded bg-emerald-500/20 px-2 py-1 text-[9px] font-bold text-emerald-300">VÍDEO</span><h3 className="mt-2 text-base font-bold text-slate-100">{asset.title}</h3><p className="text-[10px] text-slate-500">ID da mídia: AST-{String(asset.id).padStart(6,'0')}</p></div><dl className="grid grid-cols-[90px_1fr] gap-y-2 border-t border-slate-800 pt-3 text-[10px]"><dt className="text-slate-500">Programa</dt><dd>{asset.program_name||'Jornal da Cidade'}</dd><dt className="text-slate-500">Data</dt><dd>{asset.reference_date||'12/09/2026'}</dd><dt className="text-slate-500">Duração total</dt><dd>{formatDuration(asset.duration)}</dd><dt className="text-slate-500">Formato</dt><dd>MP4 (H.264)</dd><dt className="text-slate-500">Resolução</dt><dd>1920 × 1080 (Full HD)</dd><dt className="text-slate-500">Categoria</dt><dd>{asset.category||'Mobilidade urbana'}</dd></dl><div className="rounded border border-dashed border-sky-800 bg-sky-950/20 p-4 text-center text-[10px] text-slate-400">Arraste o trecho para um bloco do roteiro<br/><span className="text-slate-600">ou confirme pelo botão abaixo.</span></div></aside>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3"><div className="flex gap-2"><button onClick={onCancel} className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-300">Cancelar</button><button className="flex items-center gap-1 rounded border border-slate-700 px-4 py-2 text-xs text-slate-300"><Copy size={13}/>Copiar texto</button></div><button onClick={()=>onConfirm({...asset,clipIn,clipOut})} className="flex items-center gap-2 rounded bg-sky-500 px-5 py-2 text-xs font-bold text-slate-950"><Check size={15}/>Adicionar ao roteiro</button></footer>
      </div>
    </div>
  );
}

function TimeField({ label, value, onChange }) {
  return <label className="rounded border border-slate-700 bg-slate-950 px-3 py-2"><span className="block text-[9px] uppercase text-slate-500">{label}</span><input aria-label={label} value={value} onChange={(event)=>onChange(event.target.value)} className="w-full bg-transparent font-mono text-xs text-slate-200 outline-none"/></label>;
}
