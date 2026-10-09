import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { LayoutDashboard, Calendar, Clapperboard } from 'lucide-react';
import RoleInicio from '../RoleInicio';
import GravacoesMateriais from '../GravacoesMateriais';
import AgendamentosView from './AgendamentosView';
import { SubTabsBar } from '../../shared';
import { COMMON_SUBTABS, CommonScreen, COMMON_IDS } from './CommonScreens';

const SUBTABS = [
  { id: 'visao_geral', name: 'Visão geral', Icon: LayoutDashboard },
  ...COMMON_SUBTABS,
  { id: 'agendamentos', name: 'Agendamentos', Icon: Calendar },
  { id: 'gravacoes', name: 'Gravações', Icon: Clapperboard },
];

export default function VideomakerPage() {
  const [sub, setSub] = useState('visao_geral');
  const tabs = filterActiveSubtabs('videomaker', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);

  return (
    <div className="flex h-full flex-col gap-3">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />

      <div className="min-h-0 flex-1">
        {sub === 'visao_geral' && <RoleInicio roleId="videomaker" onNavigate={setSub} />}
        {sub === 'agendamentos' && <div className="h-full"><AgendamentosView /></div>}
        {sub === 'gravacoes' && <div className="h-full"><GravacoesMateriais /></div>}
        {COMMON_IDS.includes(sub) && <CommonScreen active={sub} />}
      </div>
    </div>
  );
}
