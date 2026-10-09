import React from 'react';
import { ClipboardList, Calendar, BarChart3, Sparkles } from 'lucide-react';
import PanelSplit from '../../ui/PanelSplit';
import { ProjetosAtribuidosPanel, AgendaUnificadaPanel } from '../OverviewPanels';
import RelatoriosEquipePanel from '../RelatoriosEquipePanel';
import CorpFeatureStrip from '../CorpFeatureStrip';

// Visão geral do Editor de vídeo — espelha o padrão de painéis redimensionáveis
// da Produção (barra de controle de layout no topo), com indicadores, agenda e
// relatórios da pós-produção.
export default function EditorOverview() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-50">Editor de vídeo</h2>
        <p className="text-sm text-slate-400">Visão geral da pós-produção — indicadores, agenda e relatórios.</p>
      </div>

      <div className="min-h-0 flex-1">
        <PanelSplit
          storageKey="corp_editor_overview"
          direction="vertical"
          panels={[
            { id: 'projetos', label: 'Projetos', icon: ClipboardList, defaultSize: 18, content: <div className="h-full overflow-y-auto"><ProjetosAtribuidosPanel /></div> },
            { id: 'agenda', label: 'Agenda unificada', icon: Calendar, defaultSize: 38, content: <div className="h-full overflow-y-auto"><AgendaUnificadaPanel /></div> },
            { id: 'relatorios', label: 'Relatórios por equipe', icon: BarChart3, defaultSize: 18, content: <div className="h-full overflow-y-auto"><RelatoriosEquipePanel /></div> },
            { id: 'destaques', label: 'Destaques', icon: Sparkles, defaultSize: 10, content: <div className="h-full overflow-y-auto"><CorpFeatureStrip /></div> },
          ]}
        />
      </div>
    </div>
  );
}