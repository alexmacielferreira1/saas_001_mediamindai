import React, { useState, useEffect } from 'react';
import { filterActiveSubtabs } from '../../../lib/roleSubtabs';
import { LayoutDashboard, PenLine, FileText, Users, Globe, BarChart3, Plus, KanbanSquare } from 'lucide-react';
import CorpPanel from '../CorpPanel';
import { SubTabsBar, StatCard, StatusBadge, Panel } from './RoleShared';
import PendenciasHub from '../PendenciasHub';
import RoleInicio from '../RoleInicio';
import { MOCK_CORP_ARTICLES, MOCK_CORP_PAUTAS, MOCK_CORP_SOURCES, MOCK_CORP_WEB_PUBS, MOCK_CORP_PENDENCIES } from '../../../data';

const SUBTABS = [
  { id: 'overview', name: 'Visão geral', Icon: LayoutDashboard },
  { id: 'pautas', name: 'Pautas', Icon: PenLine },
  { id: 'materias', name: 'Matérias', Icon: FileText },
  { id: 'fontes', name: 'Fontes', Icon: Users },
  { id: 'publicacoes', name: 'Publicação web', Icon: Globe },
  { id: 'analytics', name: 'Analytics', Icon: BarChart3 },
  { id: 'pendencias', name: 'Pendências', Icon: KanbanSquare },
];

const TONE = { rascunho: 'bg-slate-500/15 text-slate-300', revisao: 'bg-amber-500/15 text-amber-300', publicado: 'bg-emerald-500/15 text-emerald-300', aprovada: 'bg-emerald-500/15 text-emerald-300', em_pauta: 'bg-sky-500/15 text-sky-300', rejeitada: 'bg-rose-500/15 text-rose-300', agendado: 'bg-violet-500/15 text-violet-300' };
const LABEL = { rascunho: 'Rascunho', revisao: 'Revisão', publicado: 'Publicado', aprovada: 'Aprovada', em_pauta: 'Em pauta', rejeitada: 'Rejeitada', agendado: 'Agendado' };

export default function RedacaoPage() {
  const [sub, setSub] = useState('overview');
  const tabs = filterActiveSubtabs('journalist', SUBTABS);
  useEffect(() => { if (!tabs.some((t) => t.id === sub)) setSub(tabs[0]?.id ?? sub); }, []);
  const [sel, setSel] = useState(1);
  const art = MOCK_CORP_ARTICLES.find((a) => a.id === sel);

  return (
    <div className="space-y-4">
      <SubTabsBar tabs={tabs} active={sub} onChange={setSub} />
      <div className="h-[calc(100vh-16rem)]">
        {sub === 'overview' && (
          <RoleInicio roleId="redacao" onNavigate={setSub} />
        )}

        {sub === 'pautas' && (
          <Panel title="Pautas" action={<button className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Plus size={11} /> Nova pauta</button>}>
            <div className="space-y-2">
              {MOCK_CORP_PAUTAS.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
                  <div><p className="text-sm font-medium text-slate-200">{p.titulo}</p><p className="text-[11px] text-slate-500">Canal: {p.canal}</p></div>
                  <StatusBadge status={p.status} map={TONE} labels={LABEL} />
                </div>
              ))}
            </div>
          </Panel>
        )}

        {sub === 'materias' && (
          <div className="grid h-full gap-4 lg:grid-cols-5">
            <div className="overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-2">
              <p className="border-b border-slate-800 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Matérias</p>
              <div className="space-y-1.5 p-3">
                {MOCK_CORP_ARTICLES.map((a) => (
                  <button key={a.id} onClick={() => setSel(a.id)} className={`w-full rounded-lg border p-3 text-left transition ${sel === a.id ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'}`}>
                    <p className="text-sm font-medium text-slate-200">{a.titulo}</p>
                    <div className="mt-1 flex items-center justify-between"><span className="text-[10px] text-slate-500">{a.canal}</span><StatusBadge status={a.status} map={TONE} labels={LABEL} /></div>
                  </button>
                ))}
              </div>
            </div>
            <CorpPanel title="Detalhe da matéria" className="lg:col-span-3">
              {art && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-100">{art.titulo}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Canal</p><p className="text-xs text-slate-200">{art.canal}</p></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Prazo</p><p className="text-xs text-slate-200">{art.prazo}</p></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Status</p><div className="mt-0.5"><StatusBadge status={art.status} map={TONE} labels={LABEL} /></div></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"><p className="text-[9px] uppercase text-slate-500">Versão atual</p><p className="text-xs text-slate-200">v3</p></div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"><p className="mb-1 text-[9px] uppercase text-slate-500">Fluxo editorial</p><p className="text-xs leading-relaxed text-slate-300">Pauta → pesquisa de fontes → redação → revisão editorial → SEO → imagem destacada → publicação web. Texto passa por versões; nada é digitado duas vezes.</p></div>
                </div>
              )}
            </CorpPanel>
          </div>
        )}

        {sub === 'fontes' && (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <p className="border-b border-slate-800 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Fontes de pauta</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-semibold">Nome</th><th className="px-4 py-2 text-left font-semibold">Cargo</th><th className="px-4 py-2 text-left font-semibold">Área</th><th className="px-4 py-2 text-left font-semibold">Contato</th><th className="px-4 py-2 text-left font-semibold">Última pauta</th>
              </tr></thead>
              <tbody>
                {MOCK_CORP_SOURCES.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-200">{s.nome}</td>
                    <td className="px-4 py-2.5 text-slate-400">{s.cargo}</td>
                    <td className="px-4 py-2.5 text-slate-400">{s.area}</td>
                    <td className="px-4 py-2.5 text-slate-400">{s.contato}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{s.ultima_pauta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sub === 'publicacoes' && (
          <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <p className="border-b border-slate-800 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Publicação web / CMS</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 text-left font-semibold">Título</th><th className="px-4 py-2 text-left font-semibold">Slug</th><th className="px-4 py-2 text-left font-semibold">Categoria</th><th className="px-4 py-2 text-left font-semibold">Canal</th><th className="px-4 py-2 text-left font-semibold">Status</th><th className="px-4 py-2 text-left font-semibold">Data</th>
              </tr></thead>
              <tbody>
                {MOCK_CORP_WEB_PUBS.map((w) => (
                  <tr key={w.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-200">{w.titulo}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-sky-300">{w.slug}</td>
                    <td className="px-4 py-2.5 text-slate-400">{w.categoria}</td>
                    <td className="px-4 py-2.5 text-slate-400">{w.canal}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={w.status} map={TONE} labels={LABEL} /></td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{w.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sub === 'analytics' && (
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Matérias no mês" value="14" tone="text-sky-300" />
            <StatCard label="Publicadas" value={MOCK_CORP_WEB_PUBS.filter((w) => w.status === 'publicado').length} tone="text-emerald-300" />
            <StatCard label="Pauta→publicação (méd.)" value="3.2 d" tone="text-amber-300" />
            <StatCard label="Aprovação editorial" value="81%" tone="text-violet-300" />
          </div>
        )}

        {sub === 'pendencias' && (
          <div className="h-full"><PendenciasHub segment="Redação" pendencias={MOCK_CORP_PENDENCIES.redacao} /></div>
        )}
      </div>
    </div>
  );
}
