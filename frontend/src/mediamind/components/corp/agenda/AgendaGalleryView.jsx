import React from 'react';
import { Image } from '@/components/ui/image';

const TYPE_CHIP = {
  gravacao: 'bg-amber-500/15 text-amber-300 border-amber-600/30',
  aprovacao: 'bg-sky-500/15 text-sky-300 border-sky-600/30',
  publicacao: 'bg-emerald-500/15 text-emerald-300 border-emerald-600/30',
};
const TYPE_LABEL = { gravacao: 'Gravação', aprovacao: 'Aprovação', publicacao: 'Publicação' };

function initials(name) {
  return (name || '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '·';
}

// Vista Galeria — cartões com logo/thumb do programa (ou placeholder com iniciais).
export default function AgendaGalleryView({ events, selectedEventId, onSelectEvent }) {
  return (
    <div className="grid h-full auto-rows-fr grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
      {events.map((e) => {
        const isSel = e.id === selectedEventId;
        return (
          <button
            key={e.id}
            onMouseDown={(ev) => ev.stopPropagation()}
            onClick={() => onSelectEvent?.(isSel ? null : e.id)}
            className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${isSel ? 'border-sky-500 ring-1 ring-sky-400' : 'border-slate-800 hover:border-slate-600'}`}
          >
            <div className="relative aspect-video w-full bg-gradient-to-br from-slate-700 to-slate-900">
              {e.thumb ? (
                <Image src={e.thumb} fittingType="fill" className="h-full w-full" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-300/60">{initials(e.programa)}</div>
              )}
              <span className={`absolute left-1.5 top-1.5 rounded border px-1 py-0.5 text-[8px] font-bold uppercase ${TYPE_CHIP[e.type]}`}>{TYPE_LABEL[e.type]}</span>
            </div>
            <div className="flex-1 space-y-0.5 p-2">
              <p className="truncate text-[11px] font-semibold text-slate-200">{e.titulo}</p>
              <p className="truncate text-[10px] text-slate-500">{e.programa} · {e.episodio}</p>
              <p className="text-[10px] text-slate-400">Dia {e.day} · {e.horario}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}