import React, { useEffect, useMemo, useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import {
  GripVertical, Trash2, Play, Pause, FileText, ChevronDown, Save, Download,
  Send, Type, Plus,
} from 'lucide-react';

const TRACK_LABELS = { v1: 'V1', v2: 'V2', a1: 'A1', t1: 'T1' };
const TRACK_BADGE = {
  v1: 'bg-sky-500/20 text-sky-300',
  v2: 'bg-sky-400/20 text-sky-200',
  a1: 'bg-emerald-500/20 text-emerald-300',
  t1: 'bg-violet-500/20 text-violet-300',
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'reviewing', label: 'Em revisão' },
  { value: 'approved', label: 'Aprovado' },
];

export default function RoteiroEditor({
  script, items, status, setStatus,
  onRemove, onUpdateItem, onReorder, onAddText, totalDuration,
}) {
  const [showTextOnly, setShowTextOnly] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const previewItem = useMemo(() => items.find((item) => item.type === 'media'), [items]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => setPosition((current) => current >= 100 ? 0 : current + 1), 500);
    return () => clearInterval(timer);
  }, [playing]);

  const visibleItems = showTextOnly ? items.filter((i) => i.type === 'text') : items;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-50">{script?.title || 'Novo roteiro'}</h1>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {script?.project_name} · {items.length} blocos · {totalDuration}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Status dropdown */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="appearance-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 pr-7 text-xs font-medium text-slate-300 outline-none focus:border-sky-500"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              <Save size={12} /> Salvar
            </button>
            <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              <Download size={12} /> Exportar
            </button>
            <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60">
              <Send size={12} /> Enviar para edição
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 border-b border-slate-800 bg-slate-950/35 p-3 lg:grid-cols-[180px_1fr]">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded border border-slate-700 bg-[radial-gradient(circle_at_50%_35%,#315070,#0f172a_70%)]">
          <button aria-label={playing?'Pausar preview':'Reproduzir preview'} onClick={()=>setPlaying((value)=>!value)} className="grid size-9 place-items-center rounded-full border border-white/35 bg-black/30 text-white">{playing?<Pause size={15}/>:<Play size={15}/>}</button>
          <span className="absolute bottom-1 right-2 font-mono text-[8px] text-white">00:{String(Math.round(position*.81)).padStart(2,'0')} / 01:21</span>
        </div>
        <div className="flex min-w-0 flex-col justify-center"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-[9px] font-bold uppercase text-sky-400">Preview do roteiro</p><p className="truncate text-xs font-semibold text-slate-200">{previewItem?.label||'Selecione ou adicione uma mídia'}</p></div><span className="rounded bg-slate-800 px-2 py-1 text-[8px] text-slate-400">{items.filter((item)=>item.type==='media').length} mídias</span></div><input aria-label="Posição do preview" type="range" min="0" max="100" value={position} onChange={(event)=>setPosition(Number(event.target.value))} className="mt-3 w-full accent-sky-500"/><div className="mt-1 flex justify-between font-mono text-[8px] text-slate-600"><span>00:00:00</span><span>{totalDuration}</span></div></div>
      </div>

      {/* Blocks header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Bloco do roteiro</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowTextOnly(!showTextOnly)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              showTextOnly ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Type size={12} /> Texto
          </button>
          <button
            onClick={onAddText}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-sky-400 hover:bg-slate-800"
          >
            <Plus size={12} /> Bloco
          </button>
        </div>
      </div>

      {/* Blocks list */}
      <div className="flex-1 overflow-y-auto p-3">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Plus size={28} className="text-slate-600" />
            <p className="text-sm text-slate-500">Arraste mídias do painel direito ou adicione um bloco.</p>
          </div>
        ) : (
          <Droppable droppableId="roteiro-editor">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col gap-2 rounded-xl transition ${snapshot.isDraggingOver ? 'bg-sky-950/20' : ''}`}
              >
                {visibleItems.map((item, index) => (
                  <Draggable key={String(item.id)} draggableId={String(item.id)} index={index}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className={`group rounded-xl border p-3 transition ${
                          item.type === 'text'
                            ? 'border-violet-800/40 bg-violet-950/20 hover:border-violet-700/60'
                            : 'border-sky-800/40 bg-sky-950/20 hover:border-sky-700/60'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span {...p.dragHandleProps} className="mt-0.5 cursor-grab text-slate-600 hover:text-slate-400">
                            <GripVertical size={14} />
                          </span>
                          <div className="flex w-6 shrink-0 items-center justify-center rounded bg-slate-950/60 py-0.5">
                            <span className="text-[10px] font-bold text-slate-500">
                              {String(item._order ?? index + 1).padStart(2, '0')}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex items-center gap-2">
                              {item.type === 'text'
                                ? <FileText size={13} className="text-violet-400" />
                                : <Play size={13} className="text-sky-400" />
                              }
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${TRACK_BADGE[item.track] || 'bg-slate-700 text-slate-300'}`}>
                                {TRACK_LABELS[item.track] || item.track}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                {item.type === 'text' ? 'Texto' : 'Mídia'}
                              </span>
                            </div>
                            <p className="truncate text-sm font-medium text-slate-200">
                              {item.type === 'text' ? 'Bloco de texto' : item.label}
                            </p>
                            {item.type === 'text' ? (
                              <textarea
                                value={item.content || ''}
                                onChange={(e) => onUpdateItem(item.id, 'content', e.target.value)}
                                rows={2}
                                placeholder="Digite o texto do bloco..."
                                className="mt-2 w-full resize-none rounded-md border border-violet-700/40 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500"
                              />
                            ) : (
                              <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-sky-300">
                                <span>{item.in}</span>
                                <span className="text-slate-600">→</span>
                                <span>{item.out}</span>
                                <span className="ml-1 text-slate-500">{item.duration}</span>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            aria-label="Remover bloco"
                            onClick={() => onRemove(item.id)}
                            className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-1 text-rose-300 opacity-0 transition hover:bg-rose-500/25 group-hover:opacity-100"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        )}
      </div>
    </div>
  );
}
