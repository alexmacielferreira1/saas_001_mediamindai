import React, { useState } from 'react';
import { Search } from 'lucide-react';
import EdicaoPage from './EdicaoPage';
import CorpAgenda from '../CorpAgenda';
import { AgendaEdicaoUnificadaPanel } from '../OverviewPanels';
import AgendaEventDetail from '../AgendaEventDetail';
import { MOCK_CORP_AGENDA_EDICAO } from '../../../data';

// Em edição (Editor de vídeo) — funde o Kanban de edição (sem volta pra
// Gravação) com toda a agenda: agenda unificada + calendário + detalhe do evento.
export default function EditorEmEdicaoView({ onNavigate }) {
  const [events, setEvents] = useState(MOCK_CORP_AGENDA_EDICAO);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  function updateEvent(id, patch) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  // Só navega pra subguias que existem no Editor de vídeo (em_aprovacao/publicacoes).
  function handleNavigate(target) {
    if (target === 'em_aprovacao' || target === 'publicacoes') onNavigate?.(target);
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <EdicaoPage disableBack />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <AgendaEdicaoUnificadaPanel />
        <div className="h-[380px]">
          <CorpAgenda
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
        </div>
        {selectedEvent ? (
          <div className="max-h-[460px] overflow-y-auto">
            <AgendaEventDetail
              event={selectedEvent}
              onClose={() => setSelectedEventId(null)}
              onNavigate={handleNavigate}
              onUpdate={(patch) => updateEvent(selectedEvent.id, patch)}
            />
          </div>
        ) : (
          <div className="flex h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
            <Search size={22} className="mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-300">Selecione um item na agenda</p>
            <p className="mt-1 text-xs text-slate-500">Os detalhes e ajustes aparecem aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}