import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { BarChart3, TrendingUp, Activity, ScrollText } from 'lucide-react';
import { ReportsTab } from '../../../pages/Management';
import ManagementProcessamentosTab from '../../management/ManagementProcessamentosTab';
import ManagementAuditoriaTab from '../../management/ManagementAuditoriaTab';
import { COMMON_SUBTABS, CommonScreen, COMMON_IDS } from './CommonScreens';
import RoleInicio from '../RoleInicio';

// Gestão — função de back-office do Corp: visão geral, relatórios, processamentos
// e auditoria. Antes era uma coluna separada (/management); agora mora como um
// perfil do IAcervo Corp, seguindo o mesmo padrão de guias das demais funções.
const SUBTABS = [
  { id: 'visao_geral', name: 'Visão geral', Icon: BarChart3 },
  ...COMMON_SUBTABS,
  { id: 'relatorios', name: 'Relatórios', Icon: TrendingUp },
  { id: 'processamentos', name: 'Processamentos', Icon: Activity },
  { id: 'auditoria', name: 'Auditoria', Icon: ScrollText },
];

export default function GestaoPage() {
  const [sub, setSub] = useState('visao_geral');
  const tabs = filterActiveSubtabs('gestao', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2">
        {tabs.map((t) => {
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                sub === t.id ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Icon size={14} /> {t.name}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sub === 'visao_geral' && <RoleInicio roleId="gestao" onNavigate={setSub} />}
        {sub === 'relatorios' && <ReportsTab />}
        {sub === 'processamentos' && <ManagementProcessamentosTab />}
        {sub === 'auditoria' && <ManagementAuditoriaTab />}
        {COMMON_IDS.includes(sub) && <CommonScreen active={sub} />}
      </div>
    </div>
  );
}
