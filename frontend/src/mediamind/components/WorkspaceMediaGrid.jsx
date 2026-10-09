import React, { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { LayoutGrid, List, Play, Music, Image as ImageIcon, FileText } from 'lucide-react';
import { StatusBadge, Badge } from '../ui';
import { formatDuration, formatReferenceDate } from '../data';

const TYPE_ICONS = { video: Play, audio: Music, image: ImageIcon, document: FileText };

function MediaCard({ asset, isActive, onSelect, provided }) {
  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      onClick={() => onSelect(asset)}
      className={`flex cursor-grab flex-col rounded-xl border p-3 text-left transition active:cursor-grabbing ${isActive ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-700'}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-lg">{asset.icon}</div>
        <span className="rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{formatDuration(asset.duration)}</span>
      </div>
      <p className="truncate text-sm font-medium text-slate-200">{asset.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-slate-500">ASSET-00-{asset.id} • {formatReferenceDate(asset.reference_date)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <StatusBadge status={asset.status} />
        <Badge tone="violet">IA</Badge>
      </div>
    </div>
  );
}

export default function WorkspaceMediaGrid({ assets, selectedAsset, onSelect }) {
  const [view, setView] = useState('grade');
  const [sort, setSort] = useState('recent');

  const sorted = [...assets].sort((a, b) => {
    if (sort === 'recent') return (b.reference_date || '').localeCompare(a.reference_date || '');
    if (sort === 'duration') return (b.duration || 0) - (a.duration || 0);
    return (a.title || '').localeCompare(b.title || '');
  });

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Mídias encontradas ({sorted.length})</h2>
          <p className="text-[11px] text-slate-500">Arraste para o roteiro → ou clique para pré-visualizar.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setView('grade')}
            className={`rounded-lg p-1.5 ${view === 'grade' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}
            title="Grade"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setView('lista')}
            className={`rounded-lg p-1.5 ${view === 'lista' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}
            title="Lista"
          >
            <List size={14} />
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-400 outline-none"
          >
            <option value="recent">Mais recentes</option>
            <option value="duration">Duração</option>
            <option value="alpha">A-Z</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Nenhuma mídia encontrada com os filtros atuais.</p>
        ) : (
          <Droppable droppableId="medias" isDropDisabled>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {view === 'grade' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {sorted.map((a, i) => (
                      <Draggable key={a.id} draggableId={`media-${a.id}`} index={i}>
                        {(p) => (
                          <MediaCard asset={a} isActive={selectedAsset?.id === a.id} onSelect={onSelect} provided={p} />
                        )}
                      </Draggable>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {sorted.map((a, i) => (
                      <Draggable key={a.id} draggableId={`media-${a.id}`} index={i}>
                        {(p) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            onClick={() => onSelect(a)}
                            className={`flex cursor-grab items-center gap-3 rounded-lg border px-3 py-2 text-left transition active:cursor-grabbing ${selectedAsset?.id === a.id ? 'border-sky-500 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-sky-700'}`}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-base">{a.icon}</div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-200">{a.title}</p>
                              <p className="truncate text-[11px] text-slate-500">ASSET-00-{a.id} • {formatReferenceDate(a.reference_date)} • {formatDuration(a.duration)}</p>
                            </div>
                            <StatusBadge status={a.status} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        )}
      </div>
    </div>
  );
}