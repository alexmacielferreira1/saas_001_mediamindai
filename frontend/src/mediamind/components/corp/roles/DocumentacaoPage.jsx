import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { LayoutDashboard, FileText, KanbanSquare, NotebookPen } from 'lucide-react';
import { SubTabsBar } from './RoleShared';
import RoleInicio from '../RoleInicio';

const SUBTABS = [
  { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
  { id: 'docs', name: 'Documentação', Icon: FileText },
  { id: 'pendencias', name: 'Pendências', Icon: KanbanSquare },
];

export default function DocumentacaoPage() {
  const [sub, setSub] = useState('overview');
  const tabs = filterActiveSubtabs('documentacao', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);

  return (
    <div className="space-y-4">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />
      <div className="h-[calc(100vh-16rem)]">
        {sub === 'overview' && (
          <RoleInicio roleId="documentacao" onNavigate={setSub} />
        )}
        {sub === 'docs' && (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 px-6 py-20 text-center">
            <NotebookPen size={28} className="mb-3 text-slate-600" />
            <p className="text-sm font-medium text-slate-300">Documentação em construção</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">Aqui ficará a documentação sobre a sua atividade de gravação e edição de podcast. Você vai atualizar em breve.</p>
          </div>
        )}
        {sub === 'pendencias' && (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-center">
            <KanbanSquare size={26} className="mb-2 text-slate-600" />
            <p className="text-sm text-slate-400">Sem pendências registradas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
