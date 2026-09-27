import { useState } from 'react';
import {
  ArrowRight, Camera, ChevronDown, Crop, Film, Flag, Lock, Pause, Play, Redo2, Scissors,
  Settings, Split, Trash2, Undo2, Volume2, ZoomIn,
} from 'lucide-react';
import { formatDuration } from '../../data';

const TRACKS = [
  { id: 'V3', color: 'bg-violet-700', label: 'GC – Cidade que avança' },
  { id: 'V2', color: 'bg-sky-700', label: 'B-roll e imagens de apoio' },
  { id: 'V1', color: 'bg-blue-700', label: 'Entrevistas e matéria principal' },
  { id: 'A3', color: 'bg-emerald-700', label: 'Trilha institucional' },
  { id: 'A2', color: 'bg-indigo-700', label: 'Áudio da entrevista' },
  { id: 'A1', color: 'bg-cyan-700', label: 'Som ambiente e efeitos' },
];

export default function Workspace2Timeline({
  selectedAssets = [], previewAsset, blocks = [], onPreview = () => {}, onNotice = () => {}, onAddAsset = () => {}, onOpenTimeline = () => {}, compact = false,
}) {
  const active = previewAsset || selectedAssets[0];
  const [adjustments, setAdjustments] = useState({ Opacidade: 100, Volume: 60, Velocidade: 100, Escala: 100, Rotação: 0 });
  const [operation, setOperation] = useState('Timeline pronta para edição');
  const applyOperation = (message) => { setOperation(message); onNotice(message); };
  const suffix = (name, value) => name === 'Volume' ? `${Math.round((value - 60) / 6)} dB` : name === 'Velocidade' ? `${(value / 100).toFixed(1)}x` : name === 'Rotação' ? `${value}°` : `${value}%`;
  return (
    <section data-testid={compact ? 'workspace2-preview' : 'workspace2-timeline'} className={`grid grid-cols-[470px_minmax(520px,1fr)_360px] gap-2 ${compact ? 'min-h-[500px]' : 'min-h-[800px] grid-rows-[500px_1fr]'}`}>
      <aside className="w2-panel overflow-hidden">
        <div className="grid grid-cols-2 border-b border-slate-800 p-2 text-xs font-semibold"><button className="rounded-lg bg-sky-900 px-3 py-2 text-sky-200">Mídias do projeto ({selectedAssets.length})</button><button className="text-slate-400">Biblioteca IA</button></div>
        <div className="grid grid-cols-[1fr_150px] gap-2 p-3"><input aria-label="Pesquisar mídias do projeto" placeholder="Pesquisar mídias..." className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" /><select aria-label="Tipo de mídia" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"><option>Todas</option></select></div>
        <div className="grid grid-cols-3 gap-2 px-3 pb-3">{selectedAssets.map((asset) => <button type="button" draggable onDragStart={(event) => event.dataTransfer.setData('application/x-workspace2-asset', String(asset.id))} aria-label={`Selecionar ${asset.title}`} key={asset.id} onClick={() => onPreview(asset)} className={`cursor-grab overflow-hidden rounded-xl border text-left ${active?.id === asset.id ? 'border-sky-400 ring-1 ring-sky-400' : 'border-slate-700'}`}><div className="grid h-28 place-items-center bg-gradient-to-br from-blue-950 via-sky-800 to-amber-300 text-4xl">{asset.icon || '🎬'}</div><div className="p-2"><p className="line-clamp-2 text-xs font-bold">{asset.title}</p><p className="mt-1 text-[10px] text-slate-400">ASSET-00{asset.id}</p></div></button>)}</div>
      </aside>

      <main className="w2-panel p-3">
        <header className="mb-2 flex items-center justify-between"><h2 className="font-bold">Preview – {active?.title || 'Nenhuma mídia'}</h2><Settings size={16} /></header>
        {active?.stream_url && active.asset_type === 'video' ? <video key={active.id} src={active.stream_url} controls preload="metadata" className="h-72 w-full rounded-lg bg-black object-contain" /> : active?.stream_url && active.asset_type === 'audio' ? <div className="grid h-72 place-items-center rounded-lg bg-slate-950"><audio key={active.id} src={active.stream_url} controls preload="metadata" className="w-4/5" /></div> : <div className="grid h-72 place-items-center rounded-lg bg-gradient-to-br from-indigo-950 via-sky-800 to-orange-300 text-7xl">{active?.icon || '🎬'}</div>}
        <div className="mt-3 flex items-center gap-3"><button className="grid h-9 w-9 place-items-center rounded-full bg-slate-800"><Pause size={16} /></button><button className="grid h-11 w-11 place-items-center rounded-full bg-sky-500 text-slate-950"><Play fill="currentColor" size={18} /></button><button className="grid h-9 w-9 place-items-center rounded-full bg-slate-800"><Volume2 size={16} /></button><div className="h-1.5 flex-1 rounded bg-slate-800"><div className="h-full w-1/3 rounded bg-sky-500" /></div><span className="text-xs">00:00:00 / {formatDuration(active?.duration || 0)}</span></div>
        <div className="mt-3 grid grid-cols-3 gap-2">{['IN  00:00:00', `OUT  ${formatDuration(active?.duration || 0)}`, `Duração  ${formatDuration(active?.duration || 0)}`].map((value) => <div key={value} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs">{value}</div>)}</div>
        <div className="mt-3 grid grid-cols-4 gap-2"><button className="w2-button justify-center"><Flag size={14} /> Marcar IN</button><button className="w2-button justify-center"><Flag size={14} /> Marcar OUT</button><button className="w2-button justify-center"><Flag size={14} /> Adicionar marcador</button><button className="w2-button justify-center"><Camera size={14} /> Capturar frame</button></div>
      </main>

      <aside className="w2-panel overflow-hidden p-3">
        <div className="mb-3 flex gap-5 border-b border-slate-800 text-xs"><button className="border-b-2 border-sky-400 pb-2 font-bold text-sky-300">Propriedades</button><button className="pb-2 text-slate-400">Efeitos</button><button className="pb-2 text-slate-400">Cor</button><button className="pb-2 text-slate-400">Áudio</button></div>
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3"><div className="grid h-16 w-24 place-items-center rounded bg-gradient-to-br from-blue-950 to-orange-300 text-3xl">{active?.icon}</div><div><p className="text-sm font-bold">{active?.title}</p><p className="text-[10px] text-slate-400">ASSET-00{active?.id}</p></div></div>
        <dl className="grid grid-cols-2 gap-y-2 py-3 text-xs text-slate-300"><dt>Duração</dt><dd>{formatDuration(active?.duration || 0)}</dd><dt>Resolução</dt><dd>3840 × 2160 (4K)</dd><dt>FPS</dt><dd>29.97</dd><dt>Formato</dt><dd>MP4 (H.264)</dd><dt>Áudio</dt><dd>AAC, 48 kHz</dd></dl>
        <div className="border-t border-slate-800 pt-3"><h3 className="mb-3 text-sm font-bold">Ajustes de clipe</h3>{Object.keys(adjustments).map((name) => <label key={name} className="mb-3 grid grid-cols-[80px_1fr_45px] items-center gap-2 text-xs"><span>{name}</span><input aria-label={name} type="range" min="0" max={name === 'Rotação' ? 360 : 200} value={adjustments[name]} onChange={(event) => setAdjustments((current) => ({ ...current, [name]: Number(event.target.value) }))} /><span className="rounded border border-slate-700 p-1 text-center">{suffix(name, adjustments[name])}</span></label>)}</div>
        {compact && <div className="mt-4 rounded-xl border border-violet-500/40 bg-violet-950/30 p-3"><div className="flex items-center gap-2 text-sm font-bold text-violet-200"><Film size={16} /> Pronto para a Timeline</div><p className="mt-2 text-[11px] leading-5 text-slate-300">{selectedAssets.length} mídias · {blocks.length} blocos · 5 trilhas. O Passo 4 abre o editor completo já montado.</p><button type="button" onClick={onOpenTimeline} aria-label="Abrir Timeline" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold text-slate-950"><Film size={14} /> Abrir Timeline <ArrowRight size={14} /></button></div>}
      </aside>

      {!compact && <div className="w2-panel col-span-3 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-800 p-2"><button type="button" onClick={() => applyOperation('Corte marcado no cursor')} className="w2-button"><Scissors size={14} /> Cortar</button><button type="button" onClick={() => applyOperation('Clipe dividido no cursor')} className="w2-button"><Split size={14} /> Dividir</button><button type="button" onClick={() => applyOperation('Seleção removida da timeline')} className="w2-button"><Trash2 size={14} /> Excluir</button><button type="button" onClick={() => applyOperation('Modo Ripple ativado')} className="w2-button border-sky-600"><Crop size={14} /> Ripple</button><button type="button" onClick={() => applyOperation('Frame capturado')} className="w2-button"><Camera size={14} /> Snapshot</button><button type="button" onClick={() => applyOperation('Marcador adicionado')} className="w2-button"><Flag size={14} /> Marcador <ChevronDown size={12} /></button><span className="mx-2 h-6 w-px bg-slate-700" /><button type="button" onClick={() => applyOperation('Última ação desfeita')} className="w2-button"><Undo2 size={14} /> Desfazer</button><button type="button" onClick={() => applyOperation('Última ação refeita')} className="w2-button"><Redo2 size={14} /> Refazer</button><div className="ml-auto flex items-center gap-2"><ZoomIn size={15} /><input aria-label="Zoom da timeline" type="range" defaultValue="40" /></div></div>
        <div role="status" className="border-b border-slate-800 px-3 py-1 text-[10px] text-sky-300">{operation}</div>
        <div className="relative overflow-x-auto bg-[#031022] py-3">
          <div className="ml-28 flex h-7 min-w-[1100px] items-center justify-between border-b border-slate-700 px-3 font-mono text-[10px] text-sky-300">{['00:00:00','00:00:10','00:00:20','00:00:30','00:00:40','00:00:50','00:01:00','00:01:10','00:01:20'].map((time) => <span key={time}>{time}</span>)}</div>
          <div className="absolute bottom-0 left-36 top-3 z-10 w-px bg-rose-500"><span className="absolute -left-1.5 top-3 h-3 w-3 rounded-full bg-rose-500" /></div>
          {TRACKS.map((track, index) => <div key={track.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('application/x-workspace2-asset'); const asset = selectedAssets.find((item) => String(item.id) === id); if (asset) { onAddAsset(asset); applyOperation(`${asset.title} adicionado à trilha ${track.id}`); } }} className="flex h-11 min-w-[1220px] border-b border-slate-800"><div className="flex w-28 shrink-0 items-center justify-between border-r border-slate-700 px-3 text-xs font-bold"><span>{track.id}</span><Lock size={12} className="text-slate-500" /></div><div className="flex flex-1 items-center px-4"><div className={`${track.color} flex h-8 items-center rounded border border-white/10 px-3 text-[10px] shadow-lg`} style={{ width: `${55 + ((index * 9) % 35)}%`, marginLeft: `${(index % 3) * 4}%` }}>{index < blocks.length ? blocks[index].title : `${track.label} · solte uma mídia aqui`}</div></div></div>)}
        </div>
      </div>}
    </section>
  );
}
