import React, { createContext, useContext, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STAGE_ORDER } from '../../lib/producaoStore';

const STAGE_LABELS = { rascunho: 'Rascunho', gravacao: 'Gravação', em_edicao: 'Em edição', em_aprovacao: 'Em aprovação', finalizado: 'Finalizado' };

const DragCtx = createContext({ dragId: null, dragEtapa: null, setDrag: () => {} });
export function useStageDrag() { return useContext(DragCtx); }

// Card arrastável do pipeline. Ao arrastar, as zonas de soltar nos cantos acendem
// com o nome do quadro anterior/próximo conforme a etapa do card.
export function DraggableStageCard({ id, etapa, children, className, onClick }) {
  const { setDrag } = useStageDrag();
  return (
    <div
      draggable
      onDragStart={(e) => {
        setDrag(id, etapa);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(id));
      }}
      onDragEnd={() => setDrag(null, null)}
      onClick={onClick}
      className={`cursor-grab active:cursor-grabbing ${className || ''}`}
    >
      {children}
    </div>
  );
}

// Área de lista com zonas nos cantos (estilo kanban). onMove(id, dir).
export function StageDragArea({ onMove, className = '', children, disableBack = false }) {
  const [dragId, setDragId] = useState(null);
  const [dragEtapa, setDragEtapa] = useState(null);
  const [over, setOver] = useState(null);

  function setDrag(id, etapa) { setDragId(id); setDragEtapa(etapa); }
  function drop(dir) {
    if (dir < 0 && disableBack) return;
    if (dragId != null) onMove?.(dragId, dir);
    setDragId(null); setDragEtapa(null); setOver(null);
  }

  const idx = dragEtapa ? STAGE_ORDER.indexOf(dragEtapa) : -1;
  const prevLabel = disableBack ? null : (idx > 0 ? STAGE_LABELS[STAGE_ORDER[idx - 1]] : null);
  const nextLabel = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_LABELS[STAGE_ORDER[idx + 1]] : null;

  return (
    <DragCtx.Provider value={{ dragId, dragEtapa, setDrag }}>
      <div
        className={`relative ${className}`}
        onDragOver={(e) => { if (dragId != null) e.preventDefault(); }}
        onDragEnd={() => { setDragId(null); setDragEtapa(null); setOver(null); }}
      >
        {children}
        {dragId != null && (
          <>
            <div
              onDragOver={(e) => { if (prevLabel) { e.preventDefault(); setOver('left'); } }}
              onDragLeave={() => setOver((o) => (o === 'left' ? null : o))}
              onDrop={(e) => { e.preventDefault(); if (prevLabel) drop(-1); }}
              className={`absolute inset-y-0 left-0 z-20 flex w-28 items-center justify-center border-r-2 transition-colors ${prevLabel ? (over === 'left' ? 'border-sky-400 bg-sky-500/15' : 'border-slate-600/50 bg-slate-950/60') : 'border-slate-800/50 bg-slate-950/40 opacity-40'}`}
            >
              <div className={`flex flex-col items-center gap-0.5 text-center ${over === 'left' ? 'text-sky-300' : 'text-slate-400'}`}>
                <ChevronLeft size={22} />
                <span className="text-[10px] font-bold uppercase leading-tight">{prevLabel || 'Início'}</span>
              </div>
            </div>
            <div
              onDragOver={(e) => { if (nextLabel) { e.preventDefault(); setOver('right'); } }}
              onDragLeave={() => setOver((o) => (o === 'right' ? null : o))}
              onDrop={(e) => { e.preventDefault(); if (nextLabel) drop(1); }}
              className={`absolute inset-y-0 right-0 z-20 flex w-28 items-center justify-center border-l-2 transition-colors ${nextLabel ? (over === 'right' ? 'border-emerald-400 bg-emerald-500/15' : 'border-slate-600/50 bg-slate-950/60') : 'border-slate-800/50 bg-slate-950/40 opacity-40'}`}
            >
              <div className={`flex flex-col items-center gap-0.5 text-center ${over === 'right' ? 'text-emerald-300' : 'text-slate-400'}`}>
                <ChevronRight size={22} />
                <span className="text-[10px] font-bold uppercase leading-tight">{nextLabel || 'Fim'}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </DragCtx.Provider>
  );
}