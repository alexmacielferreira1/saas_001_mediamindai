import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Calendar } from 'lucide-react';
import { PRODUCAO_ETAPAS } from '../../data';
import { useProducaoProjetos, setEtapa } from '../../lib/producaoStore';

// Kanban do fluxo de Produção: um mesmo projeto atravessa as etapas.
// Arrastar o cartão de uma coluna pra outra muda a etapa do projeto (memória
// compartilhada — o mesmo projeto aparece em Rascunhos e Gravações).
// Reordenar dentro da mesma coluna é ignorado: o arrasto só move entre etapas.
const COL_TONE = {
  rascunho: 'border-slate-500/40',
  gravacao: 'border-amber-500/50',
  em_edicao: 'border-sky-500/50',
  em_aprovacao: 'border-violet-500/50',
  finalizado: 'border-emerald-500/50',
};

function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
}

export default function ProducaoKanban() {
  const projetos = useProducaoProjetos();

  function onDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return; // só move entre colunas
    setEtapa(parseInt(draggableId, 10), destination.droppableId);
  }

  return (
    <div className="h-full overflow-x-auto">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full gap-3 px-1 pb-2">
          {PRODUCAO_ETAPAS.map((etapa) => {
            const items = projetos.filter((p) => p.etapa === etapa.id);
            return (
              <div key={etapa.id} className="flex w-72 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-300">{etapa.name}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">{items.length}</span>
                </div>
                <Droppable droppableId={etapa.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-2 rounded-xl border-t-2 ${COL_TONE[etapa.id]} bg-slate-900/30 p-2 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-800/40' : ''}`}
                    >
                      {items.map((p, index) => (
                        <Draggable key={p.id} draggableId={String(p.id)} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={`rounded-lg border border-slate-700 bg-slate-950/70 p-3 transition-shadow ${snap.isDragging ? 'shadow-2xl ring-2 ring-sky-500/60' : ''}`}
                            >
                              <p className="text-xs font-bold text-slate-100">{p.titulo}</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">{p.programa}{p.episodio ? ` · ${p.episodio}` : ''}</p>
                              {p.gravacao?.data && (
                                <p className="mt-1.5 flex items-center gap-1 text-[10px] text-sky-300">
                                  <Calendar size={10} /> {fmtDate(p.gravacao.data)} {p.gravacao.horario}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {p.convidado_nome && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">🎤 {p.convidado_nome}</span>}
                                {(p.apresentadores || []).length > 0 && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">👥 {p.apresentadores.length}</span>}
                                {(p.equipe || []).length > 0 && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-300">🎬 {p.equipe.length}</span>}
                              </div>
                              <p className="mt-1.5 text-[10px] text-slate-500">{p.responsavel || '—'}</p>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {items.length === 0 && !snapshot.isDraggingOver && (
                        <p className="px-2 py-8 text-center text-[10px] text-slate-600">Arraste um cartão pra cá</p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}