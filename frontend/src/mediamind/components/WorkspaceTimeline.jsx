import React from 'react';
import { Trash2, Play } from 'lucide-react';
import { formatDuration, parseTime } from '../data';

export default function WorkspaceTimeline({ items, onRemove }) {
  const totalDuration = items.reduce((s, i) => s + Math.max(0, parseTime(i.out) - parseTime(i.in)), 0);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Timeline ({items.length})</h2>
        <span className="text-xs text-slate-500">Duração total: {formatDuration(totalDuration)}</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">Adicione trechos na prévia para montar a timeline.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between border-b border-slate-800 pb-1 text-[10px] text-slate-600">
              {Array.from({ length: 11 }).map((_, i) => (
                <span key={i}>{formatDuration((totalDuration / 10) * i)}</span>
              ))}
            </div>
            <div className="flex h-20 gap-0.5">
              {items.map((item) => {
                const dur = Math.max(1, parseTime(item.out) - parseTime(item.in));
                const flexBasis = `${(dur / Math.max(1, totalDuration)) * 100}%`;
                return (
                  <div
                    key={item.id}
                    className="group relative flex shrink-0 flex-col justify-between rounded-lg border border-sky-800/40 bg-sky-950/40 p-2"
                    style={{ flexBasis, minWidth: '80px' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Play size={11} className="shrink-0 text-sky-400" />
                      <span className="truncate text-[11px] font-medium text-slate-300">{item.title}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">{formatDuration(dur)}</span>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="text-slate-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}