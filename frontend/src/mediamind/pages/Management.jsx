import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, BarChart3, TrendingUp, Calendar, AlertCircle,
  CheckCircle2, Activity, ScrollText,
} from 'lucide-react';
import { Panel, Stat, Tabs, Badge, InfoRow, Loading } from '../ui';
import { ErrorState } from '../components/shared';
import { getManagementOverview } from '../../api/management';
import { PUBLICATION_PLATFORM_LABELS, formatBytes } from '../data';
import ManagementProcessamentosTab from '../components/management/ManagementProcessamentosTab';
import ManagementAuditoriaTab from '../components/management/ManagementAuditoriaTab';
import IndicadoresPipelinePanel from '../components/management/IndicadoresPipelinePanel';
import { buildManagementAlerts, buildManagementKpis } from '../lib/managementViewModel';
import { listMemberships } from '../../api/permissions';
import { useProducaoProjetos } from '../lib/producaoStore';
import { CARGO_BY_ID } from '../lib/roleCatalog';
import { buildSectorRows, buildTeamRows } from '../lib/managementReportsViewModel';
import {
  DEMO_MANAGEMENT_OVERVIEW,
  DEMO_MEMBERSHIPS,
  withDemoFallback,
} from '../lib/managementDemoData';

const MGMT_TABS = [
  { key: 'dashboards', label: 'Visão Geral', icon: BarChart3 },
  { key: 'reports', label: 'Relatórios', icon: TrendingUp },
  { key: 'processamentos', label: 'Processamentos', icon: Activity },
  { key: 'auditoria', label: 'Auditoria', icon: ScrollText },
];

export default function Management({ embedded = false, localDemo = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramKey = embedded ? 'managementTab' : 'tab';
  const tabParam = searchParams.get(paramKey);
  const validTab = MGMT_TABS.some((item) => item.key === tabParam) ? tabParam : 'dashboards';
  const [activeTab, setActiveTab] = useState(validTab);

  function handleTabChange(key) {
    setActiveTab(key);
    const next = new URLSearchParams(searchParams);
    next.set(paramKey, key);
    if (embedded) next.set('tab', 'management');
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-50">Gestão</h1>
        <p className="text-sm text-slate-400">Visão geral, relatórios, processamentos e auditoria.</p>
      </div>

      <Tabs tabs={MGMT_TABS} active={activeTab} onChange={handleTabChange} />

      {activeTab === 'dashboards' && <DashboardsTab localDemo={localDemo} />}
      {activeTab === 'reports' && <ReportsTab localDemo={localDemo} />}
      {activeTab === 'processamentos' && <ManagementProcessamentosTab localDemo={localDemo} />}
      {activeTab === 'auditoria' && <ManagementAuditoriaTab localDemo={localDemo} />}
    </div>
  );
}

export function DashboardsTab({ localDemo = false }) {
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailNote, setDetailNote] = useState('');
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError('');
    if (localDemo) {
      setOverview(DEMO_MANAGEMENT_OVERVIEW);
      return () => { active = false; };
    }
    // Exemplo só na sessão demo: erro real aparece com "Tentar de novo".
    withDemoFallback(getManagementOverview, DEMO_MANAGEMENT_OVERVIEW)
      .then((data) => { if (active) setOverview(data); })
      .catch((error) => { if (active) setLoadError(error?.message || 'Não foi possível carregar a visão gerencial.'); });
    return () => { active = false; };
  }, [localDemo, attempt]);

  if (loadError && !overview) return <ErrorState description={loadError} onRetry={() => setAttempt((value) => value + 1)} retryLabel="Tentar de novo" />;
  if (!overview) return <Loading label="Carregando visão gerencial..." />;

  const summary = overview.publications;
  const kpis = buildManagementKpis(overview);
  const alerts = buildManagementAlerts(overview);
  const KPI_ICONS = [CheckCircle2, Calendar, AlertCircle, TrendingUp, Building2, CheckCircle2, Activity, AlertCircle];
  const openDetail = (title, description) => { setDetail({ title, description }); setDetailNote(''); };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {kpis.map((item, index) => (
          <button type="button" key={item.id} onClick={() => openDetail(item.label, `Indicador atual: ${item.value}. Consulte e registre observações sem sair da Gestão 2.`)} className="text-left transition hover:-translate-y-0.5">
            <Stat title={item.label} value={item.value} icon={KPI_ICONS[index]} tone={item.tone} />
          </button>
        ))}
      </div>

      {detail && <div className="animate-in slide-in-from-top-2 duration-200"><Panel title={`Detalhes · ${detail.title}`} right={<button type="button" onClick={() => setDetail(null)} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800">Fechar</button>}><div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]"><div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">{detail.description}</div><label className="text-xs text-slate-400">Observação<textarea value={detailNote} onChange={(event) => setDetailNote(event.target.value)} placeholder="Registre uma observação para este indicador..." className="mt-1 min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200 outline-none focus:border-sky-500" /></label><div className="flex items-end"><button type="button" onClick={() => setDetail((current) => ({...current, description: `${current.description} Observação salva nesta sessão.`}))} className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400">Salvar alteração</button></div></div></Panel></div>}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <IndicadoresPipelinePanel />
        <Panel title="Alertas e gargalos" right={<AlertCircle size={16} className="text-amber-400" />}>
          <div className="space-y-2">
            {alerts.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum alerta operacional com os dados atuais.</p>}
            {alerts.map((alert) => (
              <button type="button" key={alert.kind} onClick={() => openDetail('Alerta operacional', alert.label)} className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 text-left transition hover:border-sky-500/50 hover:bg-slate-900/80">
                <AlertCircle size={15} className={alert.tone === 'rose' ? 'text-rose-400' : alert.tone === 'amber' ? 'text-amber-400' : 'text-sky-400'} />
                <span className="text-sm text-slate-300">{alert.label}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.8fr]">
        {/* Calendário */}
        <Panel title="Calendário de publicações" right={<Calendar size={16} className="text-slate-500" />}>
          <div className="flex flex-col gap-2">
            {summary.calendar.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhuma publicação cadastrada.</p>}
            {summary.calendar.map((c) => (
              <button type="button" key={c.id} onClick={() => openDetail(c.title, `${PUBLICATION_PLATFORM_LABELS[c.platform] || c.platform || 'Canal não informado'} · ${c.status}`)} className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-left transition hover:border-sky-500/50 hover:bg-slate-900/70">
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-800">
                  <span className="text-xs font-bold text-sky-300">{c.date ? c.date.slice(8, 10) || '—' : '—'}</span>
                  <span className="text-[10px] text-slate-500">{c.date ? c.date.slice(5, 7) || '' : ''}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{c.title}</p>
                  <p className="text-xs text-slate-500">{PUBLICATION_PLATFORM_LABELS[c.platform] || c.platform || 'Canal não informado'}</p>
                </div>
                <Badge tone={c.status === 'Agendado' ? 'info' : 'pending'}>{c.status}</Badge>
              </button>
            ))}
          </div>
        </Panel>

        {/* Métricas por rede */}
        <Panel title="Métricas por rede social" right={<BarChart3 size={16} className="text-slate-500" />}>
          <div className="flex flex-col gap-3">
            {overview.social_metrics.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">Métricas aparecerão após a conexão autorizada das redes sociais.</p>
            )}
            {overview.social_metrics.map((s) => (
              <div key={s.platform} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{s.platform}</span>
                  <span className="text-sm text-slate-400">{s.followers} seguidores</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="block text-slate-500">Publicados</span><span className="font-bold text-slate-200">{s.published}</span></div>
                  <div><span className="block text-slate-500">Engajamento</span><span className="font-bold text-sky-300">{s.engagement}</span></div>
                  <div><span className="block text-slate-500">Visualizações</span><span className="font-bold text-violet-300">{s.views}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Resumo operacional" right={<Activity size={16} className="text-slate-500" />}>
          <div className="space-y-3">
            <InfoRow label="Processamentos concluídos" value={overview.processing.completed} />
            <InfoRow label="Itens no acervo" value={overview.assets.total.toLocaleString('pt-BR')} />
            <InfoRow label="Indexados pela IA" value={overview.assets.indexed.toLocaleString('pt-BR')} />
            <InfoRow label="Armazenamento" value={formatBytes(overview.assets.storage_bytes)} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function ReportsTab({ localDemo = false }) {
  const [subTab, setSubTab] = useState('equipe');
  const [overview, setOverview] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const projects = useProducaoProjetos();
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoadError('');
    if (localDemo) {
      setOverview(DEMO_MANAGEMENT_OVERVIEW);
      setMemberships(DEMO_MEMBERSHIPS);
      return () => { active = false; };
    }
    Promise.all([
      withDemoFallback(getManagementOverview, DEMO_MANAGEMENT_OVERVIEW),
      // Lista de usuários pode não estar liberada para o perfil: fica vazia.
      withDemoFallback(listMemberships, DEMO_MEMBERSHIPS).catch(() => []),
    ])
      .then(([data, users]) => { if (active) { setOverview(data); setMemberships(users); } })
      .catch((error) => { if (active) setLoadError(error?.message || 'Não foi possível carregar os relatórios.'); });
    return () => { active = false; };
  }, [localDemo, attempt]);
  const subTabs = [
    { key: 'equipe', label: 'Equipe' },
    { key: 'setores', label: 'Setor(es)' },
    { key: 'redes', label: 'Redes Sociais' },
    { key: 'conteudo', label: 'Conteúdo' },
    { key: 'acervo', label: 'Acervo' },
    { key: 'sugestoes', label: 'Sugestões' },
  ];

  return (
    <div className="space-y-4">
      {loadError && !overview && <ErrorState description={loadError} onRetry={() => setAttempt((value) => value + 1)} retryLabel="Tentar de novo" />}
      {!overview && !loadError && <Loading label="Carregando relatórios..." />}

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {subTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              subTab === t.key ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {overview && subTab === 'equipe' && <EquipeReport rows={buildTeamRows(memberships, projects)} />}
      {overview && subTab === 'setores' && <SetoresReport rows={buildSectorRows(memberships, projects)} />}
      {overview && subTab === 'redes' && <RedesReport metrics={overview.social_metrics} />}
      {overview && subTab === 'conteudo' && <ConteudoReport overview={overview} />}
      {overview && subTab === 'acervo' && <AcervoReport assets={overview.assets} />}
      {overview && subTab === 'sugestoes' && <SugestoesReport overview={overview} />}
    </div>
  );
}

function EquipeReport({ rows }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = rows.find((row) => row.id === selectedId) || null;
  return (
    <div className="space-y-4">
      <Panel title="Desempenho da equipe">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="px-3 py-2 text-left">Membro</th><th className="px-3 py-2 text-left">Função</th><th className="px-3 py-2 text-right">Atribuídos</th><th className="px-3 py-2 text-right">Em andamento</th><th className="px-3 py-2 text-right">Concluídos</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} onClick={() => setSelectedId(row.id)} className={`cursor-pointer border-b border-slate-800/50 transition hover:bg-slate-800/40 ${selectedId === row.id ? 'bg-sky-500/5' : ''}`}>
                  <td className="px-3 py-3"><p className="font-medium text-slate-200">{row.name}</p><p className="text-xs text-slate-500">{row.email}</p></td>
                  <td className="px-3 py-3 text-slate-400">{CARGO_BY_ID[row.role]?.name || row.role}</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-200">{row.assigned}</td>
                  <td className="px-3 py-3 text-right text-amber-300">{row.active}</td>
                  <td className="px-3 py-3 text-right text-emerald-300">{row.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {selected && (
        <Panel title={`Carga atual · ${selected.name}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><InfoRow label="Função" value={CARGO_BY_ID[selected.role]?.name || selected.role} /><InfoRow label="Trabalhos atribuídos" value={selected.assigned} /><InfoRow label="Em andamento" value={selected.active} /><InfoRow label="Concluídos" value={selected.completed} /></div>
        </Panel>
      )}
    </div>
  );
}

function SetoresReport({ rows }) {
  return (
    <Panel title="Carga de trabalho por pessoa">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.role} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <p className="font-semibold text-slate-200">{CARGO_BY_ID[row.role]?.name || row.role}</p>
            <p className="mt-1 text-xs text-slate-500">{row.people} pessoa(s)</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center"><InfoRow label="Atribuídos" value={row.assigned} /><InfoRow label="Ativos" value={row.active} /><InfoRow label="Concluídos" value={row.completed} /></div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RedesReport({ metrics }) {
  return (
    <Panel title="Métricas de redes sociais">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
              <th className="px-3 py-2 text-left">Plataforma</th>
              <th className="px-3 py-2 text-left">Seguidores</th>
              <th className="px-3 py-2 text-left">Engajamento</th>
              <th className="px-3 py-2 text-left">Publicados</th>
              <th className="px-3 py-2 text-left">Views</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((s) => (
              <tr key={s.platform} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-3 py-3 font-medium text-slate-200">{s.platform}</td>
                <td className="px-3 py-3 text-slate-400">{s.followers}</td>
                <td className="px-3 py-3 text-sky-300">{s.engagement}</td>
                <td className="px-3 py-3 text-slate-400">{s.published}</td>
                <td className="px-3 py-3 text-violet-300">{s.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {metrics.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Conecte uma rede social autorizada para obter métricas reais.</p>}
      </div>
    </Panel>
  );
}

function ConteudoReport({ overview }) {
  return (
    <Panel title="Relatório de conteúdo">
      <p className="text-sm text-slate-400">Análise de conteúdo por programa, categoria e período.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <InfoRow label="Publicados" value={overview.publications.published} />
        <InfoRow label="Agendados" value={overview.publications.scheduled} />
        <InfoRow label="Pendentes" value={overview.publications.pending} />
      </div>
    </Panel>
  );
}

function AcervoReport({ assets }) {
  return (
    <Panel title="Relatório de acervo">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <InfoRow label="Total de arquivos" value={assets.total.toLocaleString('pt-BR')} />
        <InfoRow label="Indexados IA" value={assets.indexed.toLocaleString('pt-BR')} />
        <InfoRow label="Falhas" value={assets.failures} />
        <InfoRow label="Storage utilizado" value={formatBytes(assets.storage_bytes)} />
      </div>
    </Panel>
  );
}

function SugestoesReport({ overview }) {
  const sugestoes = [];
  if (overview.assets.failures) sugestoes.push(`Revisar ${overview.assets.failures} arquivo(s) com falha de processamento.`);
  if (overview.publications.pending) sugestoes.push(`Há ${overview.publications.pending} publicação(ões) aguardando decisão.`);
  if (overview.processing.active) sugestoes.push(`${overview.processing.active} processamento(s) ainda em andamento.`);
  return (
    <Panel title="Sugestões da IA">
      <div className="flex flex-col gap-2">
        {sugestoes.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhuma recomendação pendente com os dados atuais.</p>}
        {sugestoes.map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-sm text-slate-300">
            <Activity size={15} className="shrink-0 text-sky-400" />
            {s}
          </div>
        ))}
      </div>
    </Panel>
  );
}
