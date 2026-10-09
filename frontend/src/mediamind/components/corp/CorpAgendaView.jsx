import React, { useState } from 'react';
import { Search } from 'lucide-react';
import CorpAgenda from './CorpAgenda';
import { AgendaUnificadaPanel } from './OverviewPanels';
import AgendaEventDetail from './AgendaEventDetail';
import { MOCK_CORP_AGENDA_EVENTS } from '../../data';

// Agenda unificada (gravações + publicações) reutilizável — usada no Videomaker
// e na Produção. Clica num item pra editar detalhes no painel ao lado.
export default function CorpAgendaView({ onNavigate }) {
  const [events, setEvents] = useState(MOCK_CORP_AGENDA_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  function updateEvent(id, patch) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  return (
    <div className="grid h-full items-start gap-4 lg:grid-cols-3">
      <AgendaUnificadaPanel />
      <div className="h-[420px]">
        <CorpAgenda events={events} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} />
      </div>
      {selectedEvent ? (
        <div className="max-h-[480px] overflow-y-auto">
          <AgendaEventDetail
            event={selectedEvent}
            onClose={() => setSelectedEventId(null)}
            onNavigate={onNavigate}
            onUpdate={(patch) => updateEvent(selectedEvent.id, patch)}
          />
        </div>
      ) : (
        <div className="flex h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
          <Search size={22} className="mb-2 text-slate-600" />
          <p className="text-sm font-medium text-slate-300">Selecione um item na agenda</p>
          <p className="mt-1 text-xs text-slate-500">Os detalhes e ajustes aparecem aqui.</p>
        </div>
      )}
    </div>
  );
}