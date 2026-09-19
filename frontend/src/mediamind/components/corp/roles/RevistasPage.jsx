import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { LayoutDashboard, BookOpen, FileText, Palette, Globe, BarChart3, Plus, KanbanSquare } from 'lucide-react';
import CorpPanel from '../CorpPanel';
import { SubTabsBar, StatCard, StatusBadge, Panel } from './RoleShared';
import PendenciasHub from '../PendenciasHub';
import RoleInicio from '../RoleInicio';
import { MOCK_CORP_MAGAZINES, MOCK_CORP_MAGAZINE_ARTICLES, MOCK_CORP_DESIGN_ASSETS, MOCK_CORP_PENDENCIES } from '../../../data';

const SUBTABS = [
  { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
  { id: 'edicoes', name: 'Edições', Icon: BookOpen },
  { id: 'materias', name: 'Matérias', Icon: FileText },
  { id: 'artes', name: 'Artes', Icon: Palette },
  { id: 'publicacao', name: 'Publicação', Icon: Globe },
  { id: 'analytics', name: 'Analytics', Icon: BarChart3 },
  { id: 'pendencias', name: 'Pendências', Icon: KanbanSquare },
];

const TONE = { em_producao: 'bg-sky-500/15 text-sky-300', em_revisao: 'bg-amber-500/15 text-amber-300', publicada: 'bg-emerald-500/15 text-emerald-300', rascunho: 'bg-slate-500/15 text-slate-300', revisao: 'bg-amber-500/15 text-amber-300', aprovado: 'bg-emerald-500/15 text-emerald-300' };
const LABEL = { em_producao: 'Em produção', em_revisao: 'Em revisão', publicada: 'Publicada', rascunho: 'Rascunho', revisao: 'Revisão', aprovado: 'Aprovado' };

export default function RevistasPage() {
  const [sub, setSub] = useState('overview');
  const tabs = filterActiveSubtabs('revistas', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);

  return (
    <div className="space-y-4">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />
      <div className="h-[calc(100vh-16rem)]">
        {sub === 'overview' && (
          <RoleInicio roleId="revistas" />
        )}

        {sub === 'edicoes' && (
          <Panel title="Edições" action={<button className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Nova edição</button>}>
            <div className="space-y-2">
              {MOCK_CORP_MAGAZINES.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-200">{m.titulo}</p><StatusBadge status={m.status} map={TONE} labels={LABEL} /></div>
                  <p className="mt-1 text-[11px] text-slate-500">Edição #{m.edicao} · {m.periodicidade} · {m.materias} matérias · {m.artes} artes · prazo {m.prazo}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'materias' && (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <p className="border-b border-slate-800 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Matérias da edição</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-semibold">Matéria</th><th className="px-4 py-2 text-left font-semibold">Autor</th><th className="px-4 py-2 text-left font-semibold">Páginas</th><th className="px-4 py-2 text-left font-semibold">Status</th>
              </tr></thead>
              <tbody>
                {MOCK_CORP_MAGAZINE_ARTICLES.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-200">{a.titulo}</td>
                    <td className="px-4 py-2.5 text-slate-400">{a.autor}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{a.paginas}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={a.status} map={TONE} labels={LABEL} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sub === 'artes' && (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Artes da edição</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {MOCK_CORP_DESIGN_ASSETS.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="mb-2 flex h-16 items-center justify-center rounded-md bg-gradient-to-br from-slate-800 to-slate-900 text-2xl">🖼️</div>
                  <p className="truncate text-xs font-medium text-slate-200">{a.name}</p>
                  <span className="mt-1 inline-block rounded bg-slate-700/40 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">{a.tipo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sub === 'publicacao' && (
          <Panel title="Publicação (PDF / web)">
            <div className="space-y-2">
              {MOCK_CORP_MAGAZINES.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
                  <div><p className="text-sm font-medium text-slate-200">{m.titulo}</p><p className="text-[11px] text-slate-500">Saída: PDF + web · prazo {m.prazo}</p></div>
                  <StatusBadge status={m.status} map={TONE} labels={LABEL} />
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'analytics' && (
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Edições no ano" value="4" tone="text-sky-300" />
            <StatCard label="Matérias publicadas" value="38" tone="text-emerald-300" />
            <StatCard label="Tempo médio por edição" value="21 d" tone="text-amber-300" />
            <StatCard label="Artes reutilizadas" value="62%" tone="text-violet-300" />
          </div>
        )}

        {sub === 'pendencias' && (
          <div className="h-full"><PendenciasHub segment="Revistas" pendencias={MOCK_CORP_PENDENCIES.revistas} /></div>
        )}
      </div>
    </div>
  );
}