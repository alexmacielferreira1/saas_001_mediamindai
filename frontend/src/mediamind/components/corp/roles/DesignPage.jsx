import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { LayoutDashboard, Palette, Layers, FileStack, CheckCircle, BarChart3, Plus, KanbanSquare } from 'lucide-react';
import CorpPanel from '../CorpPanel';
import { SubTabsBar, StatCard, StatusBadge, Panel } from './RoleShared';
import PendenciasHub from '../PendenciasHub';
import RoleInicio from '../RoleInicio';
import { MOCK_CORP_DESIGNS, MOCK_CORP_DESIGN_ASSETS, MOCK_CORP_DESIGN_VERSIONS, MOCK_CORP_EDIT_APPROVALS, MOCK_CORP_PENDENCIES } from '../../../data';

const SUBTABS = [
  { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
  { id: 'solicitacoes', name: 'Solicitações', Icon: Palette },
  { id: 'versoes', name: 'Versões', Icon: Layers },
  { id: 'brandkit', name: 'Brand Kit', Icon: FileStack },
  { id: 'aprovacoes', name: 'Aprovações', Icon: CheckCircle },
  { id: 'analytics', name: 'Analytics', Icon: BarChart3 },
  { id: 'pendencias', name: 'Pendências', Icon: KanbanSquare },
];

const TONE = { em_andamento: 'bg-sky-500/15 text-sky-300', aprovacao: 'bg-amber-500/15 text-amber-300', aprovado: 'bg-emerald-500/15 text-emerald-300', entregue: 'bg-emerald-500/15 text-emerald-300' };
const LABEL = { em_andamento: 'Em andamento', aprovacao: 'Em aprovação', aprovado: 'Aprovado', entregue: 'Entregue' };

export default function DesignPage() {
  const [sub, setSub] = useState('overview');
  const tabs = filterActiveSubtabs('design', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);

  const grouped = MOCK_CORP_DESIGN_VERSIONS.reduce((acc, v) => { (acc[v.titulo] = acc[v.titulo] || []).push(v); return acc; }, {});

  return (
    <div className="space-y-4">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />
      <div className="h-[calc(100vh-16rem)]">
        {sub === 'overview' && (
          <RoleInicio roleId="design" onNavigate={setSub} />
        )}

        {sub === 'solicitacoes' && (
          <Panel title="Solicitações de arte" action={<button className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Nova solicitação</button>}>
            <div className="space-y-2">
              {MOCK_CORP_DESIGNS.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-200">{d.titulo}</p><StatusBadge status={d.status} map={TONE} labels={LABEL} /></div>
                  <p className="mt-1 text-[11px] text-slate-500">{d.tipo} · prazo {d.prazo}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'versoes' && (
          <Panel title="Versionamento de artes">
            <div className="space-y-3">
              {Object.entries(grouped).map(([titulo, versoes]) => (
                <div key={titulo}>
                  <p className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">{titulo}</p>
                  <div className="space-y-1.5">
                    {versoes.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">{v.versao}</span>
                        <div className="min-w-0 flex-1"><p className="truncate text-xs text-slate-200">{v.nota}</p><p className="text-[10px] text-slate-500">{v.autor} · {v.data}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'brandkit' && (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Brand Library</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {MOCK_CORP_DESIGN_ASSETS.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="mb-2 flex h-16 items-center justify-center rounded-md bg-gradient-to-br from-slate-800 to-slate-900 text-2xl">🎨</div>
                  <p className="truncate text-xs font-medium text-slate-200">{a.name}</p>
                  <span className="mt-1 inline-block rounded bg-slate-700/40 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">{a.tipo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sub === 'aprovacoes' && (
          <Panel title="Proofing pendente">
            <div className="space-y-2">
              {MOCK_CORP_EDIT_APPROVALS.map((ap) => (
                <div key={ap.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
                  <div><p className="text-sm font-medium text-slate-200">{ap.titulo}</p><p className="text-[11px] text-slate-500">Solicitado por {ap.solicitante} · {ap.tempo}</p></div>
                  <div className="flex gap-1.5">
                    <button className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800">Recusar</button>
                    <button className="rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400">Aprovar</button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'analytics' && (
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Solicitações no mês" value="9" tone="text-sky-300" />
            <StatCard label="Versões por arte (méd.)" value="3.4" tone="text-violet-300" />
            <StatCard label="Tempo médio de aprovação" value="1.8 d" tone="text-amber-300" />
            <StatCard label="Taxa de aprovação" value="76%" tone="text-emerald-300" />
          </div>
        )}

        {sub === 'pendencias' && (
          <div className="h-full"><PendenciasHub segment="Design" pendencias={MOCK_CORP_PENDENCIES.design} /></div>
        )}
      </div>
    </div>
  );
}
