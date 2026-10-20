import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { LayoutDashboard, Scissors, Film, CheckCircle, Send, BarChart3, KanbanSquare } from 'lucide-react';
import CorpPanel from '../CorpPanel';
import { SubTabsBar, StatCard, StatusBadge, Panel } from './RoleShared';
import PendenciasHub from '../PendenciasHub';
import RoleInicio from '../RoleInicio';
import { MOCK_CORP_EDITS, MOCK_CORP_EDIT_MEDIA, MOCK_CORP_EDIT_APPROVALS, MOCK_CORP_PUBLICATIONS, MOCK_CORP_PENDENCIES } from '../../../data';
import { COMMON_SUBTABS, CommonScreen, COMMON_IDS } from './CommonScreens';

const SUBTABS = [
  { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
  { id: 'edicoes', name: 'Edições', Icon: Scissors },
  { id: 'midias', name: 'Mídias', Icon: Film },
  { id: 'aprovacoes', name: 'Aprovações', Icon: CheckCircle },
  { id: 'publicacoes', name: 'Publicações', Icon: Send },
  { id: 'analytics', name: 'Analytics', Icon: BarChart3 },
  { id: 'pendencias', name: 'Pendências', Icon: KanbanSquare },
  ...COMMON_SUBTABS,
];

const ED_TONE = { 'Em edição': 'bg-amber-500/15 text-amber-300', 'Revisão': 'bg-sky-500/15 text-sky-300', 'Na fila': 'bg-slate-500/15 text-slate-300', 'Aprovado': 'bg-emerald-500/15 text-emerald-300' };
const PUB_TONE = { publicado: 'bg-emerald-500/15 text-emerald-300', programado: 'bg-violet-500/15 text-violet-300', rascunho: 'bg-slate-500/15 text-slate-300' };
const PUB_LABEL = { publicado: 'Publicado', programado: 'Programado', rascunho: 'Rascunho' };

export default function AudiovisualPage() {
  const [sub, setSub] = useState('overview');
  const tabs = filterActiveSubtabs('audiovisual', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);

  return (
    <div className="space-y-4">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />
      <div className="h-[calc(100vh-16rem)]">
        {sub === 'overview' && (
          <RoleInicio roleId="audiovisual" onNavigate={setSub} />
        )}

        {sub === 'edicoes' && (
          <Panel title="Edições / pós-produção">
            <div className="space-y-3">
              {MOCK_CORP_EDITS.map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-200">{e.titulo}</p><StatusBadge status={e.status} map={ED_TONE} /></div>
                  <p className="mt-1 text-[11px] text-slate-500">{e.programa} · prazo {e.prazo} · {e.progresso}%</p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${e.progresso}%` }} /></div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'midias' && (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Mídias (brutos / finalizados)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {MOCK_CORP_EDIT_MEDIA.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="mb-2 flex h-16 items-center justify-center rounded-md bg-gradient-to-br from-slate-800 to-slate-900 text-2xl">🎬</div>
                  <p className="truncate text-xs font-medium text-slate-200">{m.name}</p>
                  <div className="mt-1 flex items-center justify-between"><span className="font-mono text-[10px] text-slate-500">{m.duration}</span><span className="text-[10px] text-slate-500">{m.size}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sub === 'aprovacoes' && (
          <Panel title="Aprovações pendentes">
            <div className="space-y-2">
              {MOCK_CORP_EDIT_APPROVALS.map((ap) => (
                <div key={ap.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
                  <div><p className="text-sm font-medium text-slate-200">{ap.titulo}</p><p className="text-[11px] text-slate-500">Solicitado por {ap.solicitante} · {ap.tempo}</p></div>
                  <div className="flex gap-1.5">
                    <button type="button" disabled title="Ainda não disponível" className="rounded-md border border-slate-700 px-3 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">Recusar</button>
                    <button type="button" disabled title="Ainda não disponível" className="rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">Aprovar</button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'publicacoes' && (
          <Panel title="Publicações">
            <div className="space-y-2">
              {MOCK_CORP_PUBLICATIONS.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
                  <div><p className="text-sm font-medium text-slate-200">{p.titulo}</p><p className="text-[11px] text-slate-500">{p.plataforma} · {p.duracao} · {p.views} views</p></div>
                  <StatusBadge status={p.status} map={PUB_TONE} labels={PUB_LABEL} />
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'analytics' && (
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Edições no mês" value={MOCK_CORP_EDITS.length} tone="text-sky-300" />
            <StatCard label="Tempo médio de edição" value="2.4 d" tone="text-amber-300" />
            <StatCard label="Publicações" value={MOCK_CORP_PUBLICATIONS.length} tone="text-emerald-300" />
            <StatCard label="Aprovação de corte final" value="83%" tone="text-violet-300" />
          </div>
        )}

        {sub === 'pendencias' && (
          <div className="h-full"><PendenciasHub segment="Audiovisual" pendencias={MOCK_CORP_PENDENCIES.audiovisual} /></div>
        )}

        {COMMON_IDS.includes(sub) && <CommonScreen active={sub} />}
      </div>
    </div>
  );
}
