import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { LayoutDashboard, Megaphone, Mail, FileText, BarChart3, Plus, KanbanSquare } from 'lucide-react';
import { SubTabsBar, StatCard, StatusBadge, Panel } from './RoleShared';
import PendenciasHub from '../PendenciasHub';
import RoleInicio from '../RoleInicio';
import { MOCK_CORP_CAMPAIGNS, MOCK_CORP_NEWSLETTERS, MOCK_CORP_MEMOS, MOCK_CORP_PENDENCIES } from '../../../data';

const SUBTABS = [
  { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
  { id: 'campanhas', name: 'Campanhas', Icon: Megaphone },
  { id: 'newsletters', name: 'Newsletters', Icon: Mail },
  { id: 'comunicados', name: 'Comunicados', Icon: FileText },
  { id: 'analytics', name: 'Analytics', Icon: BarChart3 },
  { id: 'pendencias', name: 'Pendências', Icon: KanbanSquare },
];

const TONE = { ativa: 'bg-emerald-500/15 text-emerald-300', planejada: 'bg-sky-500/15 text-sky-300', publicada: 'bg-emerald-500/15 text-emerald-300', rascunho: 'bg-slate-500/15 text-slate-300', agendado: 'bg-violet-500/15 text-violet-300' };
const LABEL = { ativa: 'Ativa', planejada: 'Planejada', publicada: 'Publicado', rascunho: 'Rascunho', agendado: 'Agendado' };

export default function EndomarketingPage() {
  const [sub, setSub] = useState('overview');
  const tabs = filterActiveSubtabs('endomarketing', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);

  return (
    <div className="space-y-4">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />
      <div className="h-[calc(100vh-16rem)]">
        {sub === 'overview' && (
          <RoleInicio roleId="endomarketing" onNavigate={setSub} />
        )}

        {sub === 'campanhas' && (
          <Panel title="Campanhas internas" action={<button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"><Plus size={11} /> Nova campanha</button>}>
            <div className="space-y-2">
              {MOCK_CORP_CAMPAIGNS.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-200">{c.titulo}</p><StatusBadge status={c.status} map={TONE} labels={LABEL} /></div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-slate-900/60 px-2.5 py-1.5"><p className="text-[9px] uppercase text-slate-500">Alcance</p><p className="text-xs text-slate-200">{c.alcance}</p></div>
                    <div className="rounded-md bg-slate-900/60 px-2.5 py-1.5"><p className="text-[9px] uppercase text-slate-500">Engajamento</p><p className="text-xs text-slate-200">{c.engajamento}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'newsletters' && (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <p className="border-b border-slate-800 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Newsletters internas</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-semibold">Título</th><th className="px-4 py-2 text-left font-semibold">Envio</th><th className="px-4 py-2 text-left font-semibold">Abertura</th><th className="px-4 py-2 text-left font-semibold">Cliques</th>
              </tr></thead>
              <tbody>
                {MOCK_CORP_NEWSLETTERS.map((n) => (
                  <tr key={n.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-200">{n.titulo}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{n.envio}</td>
                    <td className="px-4 py-2.5 text-emerald-300">{n.abertura}</td>
                    <td className="px-4 py-2.5 text-sky-300">{n.cliques}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sub === 'comunicados' && (
          <Panel title="Comunicados">
            <div className="space-y-2">
              {MOCK_CORP_MEMOS.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-200">{m.titulo}</p><StatusBadge status={m.status} map={TONE} labels={LABEL} /></div>
                  <p className="mt-1 text-[11px] text-slate-500">{m.canal} · {m.data} · alcance {m.alcance}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'analytics' && (
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Campanhas no mês" value={MOCK_CORP_CAMPAIGNS.length} tone="text-sky-300" />
            <StatCard label="Alcance médio" value="91%" tone="text-emerald-300" />
            <StatCard label="Abertura de newsletters" value="70%" tone="text-amber-300" />
            <StatCard label="Engajamento médio" value="71%" tone="text-violet-300" />
          </div>
        )}

        {sub === 'pendencias' && (
          <div className="h-full"><PendenciasHub segment="Endomarketing" pendencias={MOCK_CORP_PENDENCIES.endomarketing} /></div>
        )}
      </div>
    </div>
  );
}
