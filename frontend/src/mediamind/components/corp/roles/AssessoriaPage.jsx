import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { LayoutDashboard, FileText, Users, Newspaper, Radio, BarChart3, Plus, KanbanSquare } from 'lucide-react';
import { SubTabsBar, StatCard, StatusBadge, Panel } from './RoleShared';
import PendenciasHub from '../PendenciasHub';
import RoleInicio from '../RoleInicio';
import { useAssessoria } from '../../../lib/corpAssessoria';
import { MOCK_CORP_PENDENCIES } from '../../../data';
import { ListSkeleton, EmptyState, ErrorState } from '../../shared';

const SUBTABS = [
  { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
  { id: 'releases', name: 'Releases', Icon: FileText },
  { id: 'mailing', name: 'Mailing', Icon: Users },
  { id: 'clipping', name: 'Clipping', Icon: Newspaper },
  { id: 'monitoramento', name: 'Monitoramento', Icon: Radio },
  { id: 'relatorios', name: 'Relatórios', Icon: BarChart3 },
  { id: 'pendencias', name: 'Pendências', Icon: KanbanSquare },
];

const REL_TONE = { publicado: 'bg-emerald-500/15 text-emerald-300', rascunho: 'bg-slate-500/15 text-slate-300', agendado: 'bg-violet-500/15 text-violet-300' };
const REL_LABEL = { publicado: 'Publicado', rascunho: 'Rascunho', agendado: 'Agendado' };
const TOM_TONE = { positivo: 'bg-emerald-500/15 text-emerald-300', neutro: 'bg-slate-500/15 text-slate-300', negativo: 'bg-rose-500/15 text-rose-300' };

export default function AssessoriaPage() {
  const [sub, setSub] = useState('overview');
  const tabs = filterActiveSubtabs('assessoria', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);
  const { releases, clippings, jornalistas, mencoes, loading, error, reload } = useAssessoria();
  const positivo = mencoes.filter((m) => m.tom === 'positivo').length;

  return (
    <div className="space-y-4">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
          <span>Não foi possível sincronizar todos os dados da assessoria.</span>
          <button onClick={reload} className="rounded-md border border-rose-700/50 px-2 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-900/40">Tentar novamente</button>
        </div>
      )}
      <div className="h-[calc(100vh-16rem)]">
        {sub === 'overview' && (
          <RoleInicio roleId="assessoria" onNavigate={setSub} />
        )}

        {sub === 'releases' && (
          <Panel title="Press releases" action={<button className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Novo release</button>}>
            {loading ? <ListSkeleton rows={4} /> : releases.length === 0 ? (
              <EmptyState icon={FileText} title="Sem releases" description="Os press releases aparecem aqui." />
            ) : (
              <div className="space-y-2">
                {releases.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-200">{r.titulo}</p><StatusBadge status={r.status} map={REL_TONE} labels={REL_LABEL} /></div>
                    <p className="mt-1 text-[11px] text-slate-500">{r.veiculos} veículos · {r.data}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {sub === 'mailing' && (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <p className="border-b border-slate-800 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Mailing / CRM de imprensa</p>
            {loading ? <ListSkeleton rows={5} /> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 text-left font-semibold">Jornalista</th><th className="px-4 py-2 text-left font-semibold">Veículo</th><th className="px-4 py-2 text-left font-semibold">Área</th>
                </tr></thead>
                <tbody>
                  {jornalistas.map((j) => (
                    <tr key={j.id} className="border-b border-slate-800/50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-slate-200">{j.nome}</td>
                      <td className="px-4 py-2.5 text-slate-400">{j.veiculo}</td>
                      <td className="px-4 py-2.5 text-slate-400">{j.area}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {sub === 'clipping' && (
          <Panel title="Clipping">
            {loading ? <ListSkeleton rows={5} /> : clippings.length === 0 ? (
              <EmptyState icon={Newspaper} title="Sem clippings" description="As menções coletadas aparecem aqui." />
            ) : (
              <div className="space-y-2">
                {clippings.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
                    <div><p className="text-sm font-medium text-slate-200">{c.titulo}</p><p className="text-[11px] text-slate-500">{c.veiculo} · {c.data}</p></div>
                    <StatusBadge status={c.tom} map={TOM_TONE} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {sub === 'monitoramento' && (
          <Panel title="Monitoramento de menções">
            {loading ? <ListSkeleton rows={5} /> : mencoes.length === 0 ? (
              <EmptyState icon={Radio} title="Sem menções" description="O monitoramento aparece aqui." />
            ) : (
              <div className="space-y-2">
                {mencoes.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
                    <div><p className="text-sm font-medium text-slate-200">{m.titulo}</p><p className="text-[11px] text-slate-500">{m.veiculo} · {m.data} · {m.etapa}</p></div>
                    <StatusBadge status={m.tom} map={TOM_TONE} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {sub === 'relatorios' && (
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Releases no mês" value={releases.length} tone="text-sky-300" />
            <StatCard label="Clippings no mês" value={clippings.length} tone="text-emerald-300" />
            <StatCard label="Tom positivo" value={mencoes.length ? `${Math.round((positivo / mencoes.length) * 100)}%` : '—'} tone="text-emerald-300" />
            <StatCard label="Veículos alcançados" value={new Set(clippings.map((c) => c.veiculo)).size} tone="text-violet-300" />
          </div>
        )}

        {sub === 'pendencias' && (
          <div className="h-full"><PendenciasHub segment="Assessoria de Imprensa" pendencias={MOCK_CORP_PENDENCIES.assessoria} /></div>
        )}
      </div>
    </div>
  );
}
