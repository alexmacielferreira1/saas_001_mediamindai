import React from 'react';
import { Circle } from 'lucide-react';
import { MOCK_CORP_TIMELINE } from '../../data';

export default function CorpTimeline() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Linha do tempo</p>
      <div className="flex-1 overflow-y-auto">
        <div className="relative ml-1.5 flex flex-col gap-3 border-l border-slate-700 pl-4">
          {MOCK_CORP_TIMELINE.map((event, i) => (
            <div key={i} className="relative">
              <Circle size={8} className="absolute -left-[21px] top-1 fill-sky-500 text-sky-500" />
              <p className="text-[10px] font-mono text-sky-300">{event.time}</p>
              <p className="text-xs text-slate-200">{event.label}</p>
              <p className="text-[10px] text-slate-500">por {event.user}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}