import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import {
  LayoutDashboard, FileText, Calendar, Scissors, CheckCircle2, Flag, Send, BarChart3, Search, Clapperboard, Share2,
  ClipboardList, CalendarClock, Sparkles,
} from 'lucide-react';
import RascunhosPage from '../RascunhosPage';
import ViralClips from '../../../pages/ViralClips';
import GravacoesMateriais from '../GravacoesMateriais';
import AgendamentosView from './AgendamentosView';
import EdicaoPage from './EdicaoPage';
import AprovacoesPage from './AprovacoesPage';
import FinalizadoTimeline from '../FinalizadoTimeline';
import CorpHeader from '../CorpHeader';
import CorpAgenda from '../CorpAgenda';
import CorpFeatureStrip from '../CorpFeatureStrip';
import AgendaEventDetail from '../AgendaEventDetail';
import CorpProductionsList from '../CorpProductionsList';
import { MOCK_CORP_AGENDA_EVENTS } from '../../../data';
import { base44 } from '@/api/base44Client';
import { loadOrSeedAgenda } from '../../../lib/corpAgenda';
import CorpProductionDetail from '../CorpProductionDetail';
import CorpPublications from '../CorpPublications';
import CorpAnalytics from '../CorpAnalytics';
import { ProjetosAtribuidosPanel, AgendaUnificadaPanel } from '../OverviewPanels';
import PanelSplit from '../../ui/PanelSplit';
import RelatoriosEquipePanel from '../RelatoriosEquipePanel';
import { COMMON_SUBTABS, CommonScreen, COMMON_IDS } from './CommonScreens';
import RoleInicio from '../RoleInicio';
import { useAuth } from '../../../auth';

// Pipeline unificado de Produção (podcast): o projeto evolui por estágios.
// Cada guia mostra os projetos do seu contexto — rascunho → gravação → edição →
// aprovação → finalizado → cortes → publicações → analytics. O fluxo que antes
// era espalhado pelo menu do Corp (Gravação, Edição, Aprovações) mora aqui agora.
export const PRODUCTION_SUBTABS = [
  { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
  ...COMMON_SUBTABS,
  { id: 'rascunhos', name: 'Rascunhos', Icon: FileText },
  { id: 'agendamentos', name: 'Agendamentos', Icon: Calendar },
  { id: 'gravacoes', name: 'Gravações', Icon: Clapperboard },
  { id: 'em_edicao', name: 'Edição', Icon: Scissors },
  { id: 'aguardando_aprovacao', name: 'Aguardando aprovação', Icon: CalendarClock },
  { id: 'em_aprovacao', name: 'Em aprovação', Icon: CheckCircle2 },
  { id: 'finalizado', name: 'Finalizado', Icon: Flag },
  { id: 'redes_sociais', name: 'Redes sociais', Icon: Share2 },
  { id: 'para_publicar', name: 'Para publicação', Icon: Send },
  { id: 'publicado', name: 'Publicado', Icon: Send },
  { id: 'analytics', name: 'Analytics', Icon: BarChart3 },
];

const SUBTABS = PRODUCTION_SUBTABS;

export function normalizeProductionSubtab(subtab) {
  if (subtab === 'publicacoes') return 'para_publicar';
  if (subtab === 'para_editar') return 'em_edicao';
  return subtab;
}

export default function ProdutoraPage() {
  const { user } = useAuth();
  const role = user?.role === 'mvp' ? 'mvp' : 'producer';
  const [sub, setSub] = useState(role === 'mvp' ? 'workspace2' : 'overview');
  const [newDraftSignal, setNewDraftSignal] = useState(0);
  const [mediaHandoff, setMediaHandoff] = useState(null);
  const [params, setParams] = useSearchParams();
  const tabs = useMemo(() => filterActiveSubtabs(role, SUBTABS), [role]);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, [sub, tabs]);
  useEffect(() => {
    const requested = normalizeProductionSubtab(params.get('sub'));
    if (requested && tabs.some((tab) => tab.id === requested)) setSub(requested);
  }, [params, tabs]);

  // Gatilho do botão "Novo": /corp?novo=producao → cai na aba Rascunhos e
  // sinaliza a RascunhosPage pra criar um novo rascunho (reusa o addDraft).
  useEffect(() => {
    if (params.get('novo') === 'producao') {
      setSub('rascunhos');
      setNewDraftSignal((n) => n + 1);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  const [selectedProduction, setSelectedProduction] = useState(1);
  const [events, setEvents] = useState(MOCK_CORP_AGENDA_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // Entidade AgendaEvento é a fonte de verdade; o mock só preenche o primeiro
  // render (sem flash) e é substituído na carga. Se vazia, semeia a partir dele.
  useEffect(() => {
    let alive = true;
    loadOrSeedAgenda(MOCK_CORP_AGENDA_EVENTS).then((loaded) => {
      if (alive && loaded.length > 0) setEvents(loaded);
    });
    return () => { alive = false; };
  }, []);
  const detailRef = useRef(null);

  function navigateWithMedia(target, payload) {
    if (payload) setMediaHandoff(payload);
    setSub(normalizeProductionSubtab(target));
  }

  function updateEvent(id, patch) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    base44.entities.AgendaEvento.update(String(id), patch).catch(() => {});
  }

  // Clicar fora do painel de detalhe fecha ele (mantém o X como alternativa).
  useEffect(() => {
    if (!selectedEventId) return;
    function onDown(e) {
      if (detailRef.current && !detailRef.current.contains(e.target)) setSelectedEventId(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [selectedEventId]);

  return (
    <div>
      <div className="h-[calc(100vh-11rem)]">
        {sub === 'overview' && <RoleInicio roleId="producer" onNavigate={setSub} />}
        {false && (
          <div className="flex h-full flex-col gap-3">
            <CorpHeader onNavigate={setSub} />
            <div className="min-h-0 flex-1">
              <PanelSplit
                storageKey="corp_producao_overview"
                direction="vertical"
                panels={[
                  { id: 'projetos', label: 'Projetos', icon: ClipboardList, defaultSize: 18, content: <div className="h-full overflow-y-auto"><ProjetosAtribuidosPanel /></div> },
                  {
                    id: 'agenda',
                    label: 'Agenda & Calendário',
                    icon: Calendar,
                    defaultSize: 34,
                    content: (
                      <PanelSplit
                        storageKey="corp_producao_agenda"
                        direction="horizontal"
                        panels={[
                          { id: 'unificada', label: 'Agenda unificada', icon: CalendarClock, defaultSize: 30, content: <div className="h-full overflow-y-auto"><AgendaUnificadaPanel /></div> },
                          { id: 'calendario', label: 'Calendário', icon: Calendar, defaultSize: 42, content: <div className="h-full overflow-hidden"><CorpAgenda events={events} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} /></div> },
                          {
                            id: 'detalhe',
                            label: 'Detalhe do evento',
                            icon: FileText,
                            defaultSize: 28,
                            content: selectedEvent ? (
                              <div ref={detailRef} className="h-full overflow-y-auto">
                                <AgendaEventDetail event={selectedEvent} onClose={() => setSelectedEventId(null)} onNavigate={setSub} onUpdate={(patch) => updateEvent(selectedEvent.id, patch)} />
                              </div>
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
                                <Search size={22} className="mb-2 text-slate-600" />
                                <p className="text-sm font-medium text-slate-300">Selecione um item na agenda</p>
                                <p className="mt-1 text-xs text-slate-500">Os detalhes e ajustes aparecem aqui.</p>
                              </div>
                            ),
                          },
                        ]}
                      />
                    ),
                  },
                  { id: 'relatorios', label: 'Relatórios por equipe', icon: BarChart3, defaultSize: 16, content: <div className="h-full overflow-y-auto"><RelatoriosEquipePanel /></div> },
                  { id: 'destaques', label: 'Destaques', icon: Sparkles, defaultSize: 10, content: <div className="h-full overflow-y-auto"><CorpFeatureStrip /></div> },
                ]}
              />
            </div>
          </div>
        )}
        {sub === 'rascunhos' && <div className="h-full"><RascunhosPage newDraftSignal={newDraftSignal} /></div>}
        {sub === 'agendamentos' && <div className="h-full"><AgendamentosView /></div>}
        {sub === 'gravacoes' && <div className="h-full"><GravacoesMateriais /></div>}
        {sub === 'em_edicao' && <div className="h-full overflow-y-auto"><EdicaoPage /></div>}
        {sub === 'aguardando_aprovacao' && <div className="h-full overflow-y-auto"><EdicaoPage initialLane="aguardando" /></div>}
        {sub === 'em_aprovacao' && <div className="h-full overflow-y-auto"><AprovacoesPage /></div>}
        {sub === 'finalizado' && <div className="h-full"><FinalizadoTimeline onNavigate={navigateWithMedia} /></div>}
        {sub === 'redes_sociais' && <div className="h-full"><ViralClips incomingMedia={mediaHandoff?.destination === 'redes_sociais' ? mediaHandoff : null} /></div>}
        {sub === 'para_publicar' && <div className="h-full"><CorpPublications mode="queue" incomingMedia={mediaHandoff?.destination === 'publicacoes' ? mediaHandoff : null} /></div>}
        {sub === 'publicado' && <div className="h-full"><CorpPublications mode="published" incomingMedia={mediaHandoff?.destination === 'publicacoes' ? mediaHandoff : null} /></div>}
        {sub === 'analytics' && <div className="h-full"><CorpAnalytics /></div>}
        {COMMON_IDS.includes(sub) && <CommonScreen active={sub} />}
      </div>
    </div>
  );
}
