import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { KanbanSquare, Sparkles, Inbox } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '../shared';
import { logAudit } from '../../lib/audit';
import { loadOrSeedPendencias } from '../../lib/corpPendencias';
import CorpPromptPanel from './CorpPromptPanel';

const COLUMNS = [
  { id: 'pendente', name: 'A fazer', tone: 'border-slate-700' },
  { id: 'em_andamento', name: 'Em andamento', tone: 'border-sky-700' },
  { id: 'concluido', name: 'Concluído', tone: 'border-emerald-700' },
];

function KanbanBoard({ items, onMove }) {
  function onDragEnd(r) {
    if (!r.destination) return;
    if (r.source.droppableId === r.destination.droppableId) return;
    onMove(r.draggableId, r.destination.droppableId);
  }
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid h-full gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = items.filter((i) => i.status === col.id);
          return (
            <Droppable key={col.id} droppableId={col.id}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className={`flex h-full flex-col rounded-xl border ${col.tone} bg-slate-900/40`}>
                  <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-300">{col.name}</p>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{list.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                    {list.map((it, idx) => (
                      <Draggable key={String(it.id)} draggableId={String(it.id)} index={idx}>
                        {(p) => (
                          <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-slate-600">⠿</span>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-200">{it.titulo}</p>
                                {it.contexto && <p className="mt-0.5 text-[10px] text-slate-500">{it.contexto}</p>}
                                {it.responsavel && <p className="mt-1 text-[9px] uppercase text-slate-600">Resp.: {it.responsavel}</p>}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {list.length === 0 && (
                      <div className="flex flex-col items-center gap-1 py-8 text-center">
                        <Inbox size={18} className="text-slate-600" />
                        <p className="text-[10px] text-slate-600">Nada por aqui</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

export default function PendenciasHub({ segment, pendencias }) {
  const [items, setItems] = useState(pendencias);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('kanban');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadOrSeedPendencias(segment, pendencias).then((loaded) => {
      if (alive) { setItems(loaded); setLoading(false); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  async function move(id, newStatus) {
    setItems((it) => it.map((p) => (String(p.id) === String(id) ? { ...p, status: newStatus } : p)));
    try {
      await base44.entities.PendenciaCorp.update(String(id), { status: newStatus });
      logAudit('Pendência', 'Corp', `Movida para "${newStatus}" em ${segment}`);
    } catch { /* best-effort */ }
  }

  const pendentes = items.filter((i) => i.status !== 'concluido').length;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-800 bg-slate-900/40 p-1">
          <button onClick={() => setMode('kanban')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === 'kanban' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}><KanbanSquare size={13} /> Kanban</button>
          <button onClick={() => setMode('prompt')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === 'prompt' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}><Sparkles size={13} /> Prompt (IA)</button>
        </div>
        <span className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-[11px] text-slate-400">{pendentes} pendências em aberto · {items.length - pendentes} concluídas</span>
      </div>
      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="grid h-full gap-4 lg:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.id} className={`flex h-full flex-col rounded-xl border ${col.tone} bg-slate-900/40`}>
                <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-6 rounded" />
                </div>
                <div className="flex-1 space-y-2 p-2.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : mode === 'kanban' ? (
          <KanbanBoard items={items} onMove={move} />
        ) : (
          <CorpPromptPanel segment={segment} items={items} onApply={move} />
        )}
      </div>
    </div>
  );
}