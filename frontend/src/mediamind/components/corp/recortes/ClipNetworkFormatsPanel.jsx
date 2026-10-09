import React, { useState } from 'react';
import { CheckCircle2, Facebook, Image, Instagram, Play, Send } from 'lucide-react';

const NETWORKS = [
  { id: 'youtube', label: 'YouTube', badge: 'YT' },
  { id: 'instagram', label: 'Instagram', Icon: Instagram },
  { id: 'tiktok', label: 'TikTok', badge: 'TK' },
  { id: 'facebook', label: 'Facebook', Icon: Facebook },
  { id: 'x', label: 'X (Twitter)', badge: 'X' },
  { id: 'linkedin', label: 'LinkedIn', badge: 'in' },
];

export default function ClipNetworkFormatsPanel({ clip, onChange, onProsseguir }) {
  const [active, setActive] = useState('youtube');
  const [format, setFormat] = useState('16:9');
  const networks = clip.networks || ['youtube', 'instagram', 'tiktok'];

  function toggle(id) {
    const next = networks.includes(id) ? networks.filter((item) => item !== id) : [...networks, id];
    onChange({ networks: next });
    setActive(id);
  }

  return <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[180px_minmax(0,1fr)_300px]">
    <aside className="rounded-lg border border-slate-800 bg-slate-950/35 p-2"><p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Redes selecionadas</p>{NETWORKS.map(({id,label,Icon,badge})=><button key={id} aria-label={label} onClick={()=>toggle(id)} className={`mb-1 flex w-full items-center gap-2 rounded border px-2 py-2 text-left text-[10px] ${active===id?'border-sky-500 bg-sky-950/35':'border-slate-800'}`}><span className={`grid size-6 place-items-center rounded ${networks.includes(id)?'bg-sky-500 text-slate-950':'bg-slate-800 text-slate-500'}`}>{Icon?<Icon size={13}/>:<b>{badge}</b>}</span><span className="flex-1 text-slate-300">{label}</span>{networks.includes(id)&&<CheckCircle2 size={12} className="text-emerald-400"/>}</button>)}</aside>
    <main className="rounded-lg border border-slate-800 bg-slate-950/35 p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1"><button onClick={()=>setFormat('16:9')} className={`rounded border px-3 py-1.5 text-[10px] ${format==='16:9'?'border-sky-500 bg-sky-950 text-sky-300':'border-slate-700 text-slate-500'}`}>16:9 Canal (Horizontal)</button><button onClick={()=>setFormat('9:16')} className={`rounded border px-3 py-1.5 text-[10px] ${format==='9:16'?'border-sky-500 bg-sky-950 text-sky-300':'border-slate-700 text-slate-500'}`}>9:16 Shorts (Vertical)</button></div><button className="rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-400">Ajustar visual</button></div><div className={`relative mx-auto flex items-center justify-center overflow-hidden rounded border border-slate-700 bg-[radial-gradient(circle_at_50%_35%,#41647c,#0b1727_68%)] ${format==='9:16'?'aspect-[9/16] max-h-[380px]':'aspect-video w-full'}`}><button className="grid size-11 place-items-center rounded-full border border-white/30 bg-black/25 text-white"><Play size={18}/></button><div className="absolute inset-x-5 bottom-5 bg-sky-900/90 px-3 py-2"><b className="text-xs text-white">{clip.titulo}</b><p className="text-[9px] text-sky-100">Conteúdo preparado para {NETWORKS.find((n)=>n.id===active)?.label}</p></div></div><div className="mt-2 flex h-10 gap-0.5">{Array.from({length:14},(_,i)=><span key={i} className="flex-1 border border-slate-700 bg-gradient-to-b from-slate-600 to-slate-900"/>)}</div><div className="mt-2 grid grid-cols-3 gap-2 text-center text-[9px]">{networks.filter((id)=>NETWORKS.some((n)=>n.id===id)).map((id)=><span key={id} className="rounded border border-emerald-800 bg-emerald-950/25 px-2 py-1 text-emerald-300">{NETWORKS.find((n)=>n.id===id)?.label}: pronto</span>)}</div></main>
    <aside className="flex flex-col rounded-lg border border-slate-800 bg-slate-950/35 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">Configurações — {NETWORKS.find((n)=>n.id===active)?.label}</p><label className="mt-3 text-[9px] text-slate-500">Destino<select className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-slate-300"><option>Canal / perfil principal</option></select></label><label className="mt-3 text-[9px] text-slate-500">Título<input value={clip.socialTitle||clip.titulo} onChange={(e)=>onChange({socialTitle:e.target.value})} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-slate-300"/></label><label className="mt-3 text-[9px] text-slate-500">Descrição<textarea value={clip.socialDescription||'Histórias que inspiram. Confira este novo conteúdo e compartilhe.'} onChange={(e)=>onChange({socialDescription:e.target.value})} rows={4} className="mt-1 w-full resize-none rounded border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-slate-300"/></label><div className="mt-3 rounded border border-slate-800 p-2"><p className="flex items-center gap-1 text-[9px] text-slate-400"><Image size={11}/>Thumbnail</p><button className="mt-2 w-full rounded border border-slate-700 py-2 text-[9px] text-slate-400">Usar frame do vídeo</button></div><div className="mt-3 space-y-1 text-[9px] text-slate-400">{['Legendas e idiomas','Tags e categorias','Visibilidade e agendamento'].map((item)=><button key={item} className="w-full rounded border border-slate-800 px-2 py-2 text-left">{item} ›</button>)}</div><button onClick={onProsseguir} className="mt-auto flex items-center justify-center gap-1 rounded bg-sky-500 px-3 py-2 text-[10px] font-bold text-slate-950"><Send size={12}/>Avançar para revisão final</button></aside>
  </div>;
}
