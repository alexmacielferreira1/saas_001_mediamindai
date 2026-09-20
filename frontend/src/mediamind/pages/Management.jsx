import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, BarChart3, Users, TrendingUp, Calendar, AlertCircle,
  CheckCircle2, Clock, Activity, ScrollText,
} from 'lucide-react';
import { Panel, Stat, Tabs, Badge, StatusBadge, InfoRow, Loading, EmptyState } from '../ui';
import { getManagementOverview } from '../../api/management';
import { PUBLICATION_PLATFORM_LABELS, formatBytes } from '../data';
import ManagementProcessamentosTab from '../components/management/ManagementProcessamentosTab';
import ManagementAuditoriaTab from '../components/management/ManagementAuditoriaTab';
import IndicadoresPipelinePanel from '../components/management/IndicadoresPipelinePanel';
import { buildManagementAlerts, buildManagementKpis } from '../lib/managementViewModel';

const MGMT_TABS = [
  { key: 'dashboards', label: 'Visão Geral', icon: BarChart3 },
  { key: 'reports', label: 'Relatórios', icon: TrendingUp },
  { key: 'processamentos', label: 'Processamentos', icon: Activity },
  { key: 'auditoria', label: 'Auditoria', icon: ScrollText },
];

export default function Management() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'dashboards');

  function handleTabChange(key) {
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-slate-50">Gestão</h1>
        <p className="text-sm text-slate-400">Visão geral e relatórios</p>
      </div>

      <Tabs tabs={MGMT_TABS} active={activeTab} onChange={handleTabChange} />

      {activeTab === 'dashboards' && <DashboardsTab />}
      {activeTab === 'reports' && <ReportsTab />}
      {activeTab === 'processamentos' && <ManagementProcessamentosTab />}
      {activeTab === 'auditoria' && <ManagementAuditoriaTab />}
    </div>
  );
}

export function DashboardsTab() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getManagementOverview()
      .then((data) => { if (active) setOverview(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  if (error) return <EmptyState icon={AlertCircle} title="Não foi possível carregar a visão gerencial" description="Tente novamente em alguns instantes." />;
  if (!overview) return <Loading label="Carregando visão gerencial..." />;

  const summary = overview.publications;
  const kpis = buildManagementKpis(overview);
  const alerts = buildManagementAlerts(overview);
  const KPI_ICONS = [CheckCircle2, Calendar, AlertCircle, TrendingUp, Building2, CheckCircle2, Activity, AlertCircle];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {kpis.map((item, index) => (
          <Stat key={item.id} title={item.label} value={item.value} icon={KPI_ICONS[index]} tone={item.tone} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <IndicadoresPipelinePanel />
        <Panel title="Alertas e gargalos" right={<AlertCircle size={16} className="text-amber-400" />}>
          <div className="space-y-2">
            {alerts.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum alerta operacional com os dados atuais.</p>}
            {alerts.map((alert) => (
              <div key={alert.kind} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3">
                <AlertCircle size={15} className={alert.tone === 'rose' ? 'text-rose-400' : alert.tone === 'amber' ? 'text-amber-400' : 'text-sky-400'} />
                <span className="text-sm text-slate-300">{alert.label}</span>
              </div>
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
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-800">
                  <span className="text-xs font-bold text-sky-300">{c.date ? c.date.slice(8, 10) || '—' : '—'}</span>
                  <span className="text-[10px] text-slate-500">{c.date ? c.date.slice(5, 7) || '' : ''}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{c.title}</p>
                  <p className="text-xs text-slate-500">{PUBLICATION_PLATFORM_LABELS[c.platform] || c.platform || 'Canal não informado'}</p>
                </div>
                <Badge tone={c.status === 'Agendado' ? 'info' : 'pending'}>{c.status}</Badge>
              </div>
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

export function ReportsTab() {
  const [subTab, setSubTab] = useState('equipe');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    getManagementOverview().then((data) => { if (active) setOverview(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
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
      {error && <EmptyState icon={AlertCircle} title="Não foi possível carregar os relatórios" />}
      {!error && !overview && <Loading label="Carregando relatórios..." />}

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

      {overview && subTab === 'equipe' && <EquipeReport />}
      {overview && subTab === 'setores' && <SetoresReport />}
      {overview && subTab === 'redes' && <RedesReport metrics={overview.social_metrics} />}
      {overview && subTab === 'conteudo' && <ConteudoReport overview={overview} />}
      {overview && subTab === 'acervo' && <AcervoReport assets={overview.assets} />}
      {overview && subTab === 'sugestoes' && <SugestoesReport overview={overview} />}
    </div>
  );
}

function EquipeReport() {
  return (
    <Panel title="Desempenho da equipe">
      <p className="py-8 text-center text-sm text-slate-500">O desempenho será calculado quando tarefas reais forem atribuídas aos membros.</p>
    </Panel>
  );
}

function SetoresReport() {
  return (
    <Panel title="Carga de trabalho por pessoa">
      <p className="py-8 text-center text-sm text-slate-500">Ainda não há carga de trabalho atribuída por setor.</p>
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
