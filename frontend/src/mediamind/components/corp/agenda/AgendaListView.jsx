import React from 'react';

const TYPE_CHIP = {
  gravacao: 'bg-amber-500/15 text-amber-300 border-amber-600/30',
  aprovacao: 'bg-sky-500/15 text-sky-300 border-sky-600/30',
  publicacao: 'bg-emerald-500/15 text-emerald-300 border-emerald-600/30',
};
const TYPE_LABEL = { gravacao: 'Gravação', aprovacao: 'Aprovação', publicacao: 'Publicação' };

// Vista Lista — linhas rápidas com dia, programa, título, tipo e horário.
export default function AgendaListView({ events, selectedEventId, onSelectEvent }) {
  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="sticky top-0 bg-slate-900/90 text-[9px] uppercase text-slate-500">
          <tr>
            <th className="px-2 py-1.5">Dia</th>
            <th className="px-2 py-1.5">Programa</th>
            <th className="px-2 py-1.5">Título</th>
            <th className="px-2 py-1.5">Tipo</th>
            <th className="px-2 py-1.5">Horário</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const isSel = e.id === selectedEventId;
            return (
              <tr
                key={e.id}
                onMouseDown={(ev) => ev.stopPropagation()}
                onClick={() => onSelectEvent?.(isSel ? null : e.id)}
                className={`cursor-pointer border-b border-slate-800 transition ${isSel ? 'bg-sky-950/40' : 'hover:bg-slate-800/40'}`}
              >
                <td className="px-2 py-2 font-bold text-slate-300">{e.day}</td>
                <td className="px-2 py-2 text-slate-400">{e.programa}<div className="text-[9px] text-slate-600">{e.episodio}</div></td>
                <td className="px-2 py-2 text-slate-200">{e.titulo}</td>
                <td className="px-2 py-2"><span className={`rounded border px-1 py-0.5 text-[8px] font-bold uppercase ${TYPE_CHIP[e.type]}`}>{TYPE_LABEL[e.type]}</span></td>
                <td className="px-2 py-2 text-slate-400">{e.horario}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}