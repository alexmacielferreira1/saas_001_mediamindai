import React, { useState, useMemo } from 'react';
import { Calendar, LayoutGrid, List, Search } from 'lucide-react';
import AgendaCalendarView from './agenda/AgendaCalendarView';
import AgendaGalleryView from './agenda/AgendaGalleryView';
import AgendaListView from './agenda/AgendaListView';

const VIEWS = [
  { id: 'calendario', name: 'Calendário', Icon: Calendar },
  { id: 'galeria', name: 'Galeria', Icon: LayoutGrid },
  { id: 'lista', name: 'Lista', Icon: List },
];

// Painel da agenda: seletor de vista + busca (abaixo das opções) + vista ativa.
// O lado direito (fora daqui) fica só pra descrição/ajustes do item selecionado.
export default function CorpAgenda({ events, selectedEventId, onSelectEvent }) {
  const [view, setView] = useState('calendario');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return events;
    return events.filter((e) =>
      [e.titulo, e.programa, e.episodio, e.convidado].some((v) => (v || '').toLowerCase().includes(t))
    );
  }, [events, q]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center gap-1 rounded-md border border-slate-700 p-0.5">
        {VIEWS.map((v) => {
          const Icon = v.Icon;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition ${view === v.id ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Icon size={11} /> {v.name}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2.5">
        <Search size={13} className="shrink-0 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar na agenda (programa, episódio, convidado...)"
          className="w-full bg-transparent py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
        />
      </div>

      <div className="min-h-0 flex-1">
        {view === 'calendario' && <AgendaCalendarView events={filtered} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />}
        {view === 'galeria' && <AgendaGalleryView events={filtered} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />}
        {view === 'lista' && <AgendaListView events={filtered} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />}
      </div>
    </div>
  );
}