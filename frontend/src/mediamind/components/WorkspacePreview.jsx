import React, { useState, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { X, Play, Pause, SkipBack, SkipForward, Plus, GripVertical } from 'lucide-react';
import { formatDuration } from '../data';
import WorkspaceRevisaoPanel from './WorkspaceRevisaoPanel';
import WorkspaceTranscricaoPanel from './WorkspaceTranscricaoPanel';
import WorkspaceDireitosPanel from './WorkspaceDireitosPanel';

export default function WorkspacePreview({ asset, onClose, onAddRoteiro, initialInPoint }) {
  const [inPoint, setInPoint] = useState('00:00:00');
  const [outPoint, setOutPoint] = useState('00:00:00');
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (initialInPoint) setInPoint(initialInPoint);
  }, [initialInPoint, asset]);

  if (!asset) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        <Play size={32} className="mb-2 text-slate-600" />
        <p className="text-sm text-slate-500">Selecione uma mídia para pré-visualizar.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Preview da mídia</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300" title="Fechar"><X size={15} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Droppable droppableId="preview" isDropDisabled>
          {(dropProvided) => (
            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
              <Draggable draggableId={`preview-${asset.id}`} index={0}>
                {(p) => (
                  <div
                    ref={p.innerRef}
                    {...p.draggableProps}
                    {...p.dragHandleProps}
                    className="mb-3 flex aspect-video cursor-grab items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 transition hover:border-sky-600 active:cursor-grabbing"
                    title="Arraste para o roteiro"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-2xl">{asset.icon}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <GripVertical size={12} /> Arraste para o roteiro
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>

        <p className="mb-2 truncate text-sm font-medium text-slate-200">{asset.title}</p>

        <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs">
          <span className="text-slate-400">00:00:00</span>
          <span className="text-slate-500">DUR: {formatDuration(asset.duration)}</span>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <button className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700" title="Voltar"><SkipBack size={14} /></button>
          <button
            onClick={() => setPlaying(!playing)}
            className="rounded-lg bg-sky-500 p-2 text-slate-950 hover:bg-sky-400"
            title={playing ? 'Pausar' : 'Reproduzir'}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700" title="Avançar"><SkipForward size={14} /></button>
          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-sky-500" style={{ width: '35%' }} />
            </div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-400">IN</span>
            <input
              value={inPoint}
              onChange={(e) => setInPoint(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs outline-none focus:border-sky-500"
              placeholder="00:00:00"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-400">OUT</span>
            <input
              value={outPoint}
              onChange={(e) => setOutPoint(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs outline-none focus:border-sky-500"
              placeholder="00:00:00"
            />
          </label>
        </div>

        <button
          onClick={() => onAddRoteiro(asset, inPoint, outPoint)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400"
        >
          <Plus size={14} /> Adicionar trecho ao final do roteiro
        </button>

        <WorkspaceRevisaoPanel asset={asset} />
        <WorkspaceTranscricaoPanel asset={asset} onSeek={(tc) => setInPoint(tc)} />
        <WorkspaceDireitosPanel asset={asset} />
      </div>
    </div>
  );
}