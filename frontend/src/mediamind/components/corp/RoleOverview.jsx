import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CorpAgenda from './CorpAgenda';
import AgendaEventDetail from './AgendaEventDetail';
import { ProjetosAtribuidosPanel, AgendaUnificadaPanel } from './OverviewPanels';
import { MOCK_CORP_AGENDA_EVENTS } from '../../data';
import { loadOrSeedAgenda } from '../../lib/corpAgenda';

// Visão Geral padrão do Corp — aplicada a todos os papéis. Traz Projetos
// atribuídos a você, Agenda editorial unificada + Calendário + Detalhe do
// evento. `stats` (cards de indicadores) e `children` (painéis específicos do
// papel) mantêm o conteúdo próprio de cada segmento.
export default function RoleOverview({ stats, children }) {
  const [events, setEvents] = useState(MOCK_CORP_AGENDA_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const detailRef = useRef(null);

  // Entidade AgendaEvento é a fonte de verdade; o mock só preenche o primeiro
  // render (sem flash) e é substituído na carga. Se vazia, semeia a partir dele.
  useEffect(() => {
    let alive = true;
    loadOrSeedAgenda(MOCK_CORP_AGENDA_EVENTS).then((loaded) => {
      if (alive && loaded.length > 0) setEvents(loaded);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    function onDown(e) {
      if (detailRef.current && !detailRef.current.contains(e.target)) setSelectedEventId(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [selectedEventId]);

  function updateEvent(id, patch) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    base44.entities.AgendaEvento.update(String(id), patch).catch(() => {});
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {stats}
      <ProjetosAtribuidosPanel />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <AgendaUnificadaPanel />
        <div className="h-[380px]">
          <CorpAgenda events={events} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} />
        </div>
        {selectedEvent ? (
          <div ref={detailRef} className="max-h-[460px] overflow-y-auto">
            <AgendaEventDetail event={selectedEvent} onClose={() => setSelectedEventId(null)} onNavigate={() => {}} onUpdate={(patch) => updateEvent(selectedEvent.id, patch)} />
          </div>
        ) : (
          <div className="flex h-[380px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
            <Search size={22} className="mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-300">Selecione um item na agenda</p>
            <p className="mt-1 text-xs text-slate-500">Os detalhes e ajustes aparecem aqui.</p>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}