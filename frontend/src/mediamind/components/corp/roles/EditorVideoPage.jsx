import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import {
  LayoutDashboard, Scissors as EditIcon, CheckCircle2, Flag, Send, BarChart3, Calendar, Clapperboard, Share2,
} from 'lucide-react';
import EditorOverview from './EditorOverview';
import ViralClips from '../../../pages/ViralClips';
import EditorEmEdicaoView from './EditorEmEdicaoView';
import AgendamentosView from './AgendamentosView';
import GravacoesMateriais from '../GravacoesMateriais';
import AprovacoesPage from './AprovacoesPage';
import FinalizadoTimeline from '../FinalizadoTimeline';
import CorpPublications from '../CorpPublications';
import CorpAnalytics from '../CorpAnalytics';
import { SubTabsBar } from '../../shared';
import { COMMON_SUBTABS, CommonScreen, COMMON_IDS } from './CommonScreens';

const SUBTABS = [
  { id: 'visao_geral', name: 'Visão geral', Icon: LayoutDashboard },
  ...COMMON_SUBTABS,
  { id: 'agendamentos', name: 'Agendamentos', Icon: Calendar },
  { id: 'gravacoes', name: 'Gravações', Icon: Clapperboard },
  { id: 'em_edicao', name: 'Em edição', Icon: EditIcon },
  { id: 'em_aprovacao', name: 'Em aprovação', Icon: CheckCircle2 },
  { id: 'finalizado', name: 'Finalizado', Icon: Flag },
  { id: 'redes_sociais', name: 'Redes sociais', Icon: Share2 },
  { id: 'publicacoes', name: 'Publicações', Icon: Send },
  { id: 'analytics', name: 'Analytics', Icon: BarChart3 },
];

export default function EditorVideoPage() {
  const [sub, setSub] = useState('visao_geral');
  const tabs = filterActiveSubtabs('editor', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);

  return (
    <div className="flex h-full flex-col gap-3">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />

      <div className="min-h-0 flex-1">
        {sub === 'visao_geral' && <div className="h-[calc(100vh-16rem)]"><EditorOverview /></div>}
        {sub === 'agendamentos' && <div className="h-full"><AgendamentosView /></div>}
        {sub === 'gravacoes' && <div className="h-full"><GravacoesMateriais /></div>}
        {sub === 'em_edicao' && <div className="h-full"><EditorEmEdicaoView onNavigate={setSub} /></div>}
        {sub === 'em_aprovacao' && <div className="h-full overflow-y-auto"><AprovacoesPage /></div>}
        {sub === 'finalizado' && <div className="h-full"><FinalizadoTimeline onNavigate={setSub} /></div>}
        {sub === 'redes_sociais' && <div className="h-full"><ViralClips /></div>}
        {sub === 'publicacoes' && <div className="h-full"><CorpPublications /></div>}
        {sub === 'analytics' && <div className="h-full"><CorpAnalytics /></div>}
        {COMMON_IDS.includes(sub) && <CommonScreen active={sub} />}
      </div>
    </div>
  );
}