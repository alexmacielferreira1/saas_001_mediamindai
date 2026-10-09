import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Trash2, GripVertical, Plus } from 'lucide-react';

export default function WorkspaceRoteiro({ items, onRemove, onReorder }) {
  function onDragEnd(result) {
    if (!result.destination || result.destination.index === result.source.index) return;
    onReorder(result.source.index, result.destination.index);
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Modo Roteiro ({items.length})</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Plus size={36} className="text-slate-600" />
            <div>
              <p className="font-medium text-slate-400">Roteiro vazio</p>
              <p className="mt-1 text-xs text-slate-500">Selecione uma mídia na prévia e clique em "Adicionar trecho ao final do roteiro".</p>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="roteiro">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2">
                  {items.map((item, index) => (
                    <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                      {(p) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          className="group flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3"
                        >
                          <span {...p.dragHandleProps} className="cursor-grab text-slate-600 hover:text-slate-400">
                            <GripVertical size={16} />
                          </span>
                          <span className="text-xs font-bold text-slate-600">{String(index + 1).padStart(2, '0')}</span>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-base">{item.icon}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-200">{item.title}</p>
                            <p className="text-[11px] text-slate-500">IN {item.in} → OUT {item.out}</p>
                          </div>
                          <button
                            onClick={() => onRemove(item.id)}
                            className="text-slate-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}