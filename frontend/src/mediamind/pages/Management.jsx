import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, BarChart3, Users, TrendingUp, Calendar, AlertCircle,
  CheckCircle2, Clock, Activity, ScrollText,
} from 'lucide-react';
import { Panel, Stat, Tabs, Badge, StatusBadge, InfoRow, MockBanner, Loading, EmptyState } from '../ui';
import { getManagementOverview } from '../../api/management';
import {
  MOCK_TEAM_PERFORMANCE, MOCK_TEAM_WORKLOAD, MOCK_SOCIAL_METRICS, PUBLICATION_PLATFORM_LABELS,
} from '../data';
import ManagementProcessamentosTab from '../components/management/ManagementProcessamentosTab';
import ManagementAuditoriaTab from '../components/management/ManagementAuditoriaTab';
import IndicadoresPipelinePanel from '../components/management/IndicadoresPipelinePanel';

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
  return (
    <div className="space-y-4">
      <IndicadoresPipelinePanel />

      {/* Resumo de publicações */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Publicados" value={summary.published} icon={CheckCircle2} tone="emerald" />
        <Stat title="Agendados" value={summary.scheduled} icon={Clock} tone="sky" />
        <Stat title="Pendentes" value={summary.pending} icon={AlertCircle} tone="amber" />
        <Stat title="Taxa aprovação" value={`${summary.approval_rate}%`} icon={TrendingUp} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
      </div>
    </div>
  );
}

export function ReportsTab() {
  const [subTab, setSubTab] = useState('equipe');
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
      <MockBanner note="Relatórios agregados — dados de exemplo." />

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

      {subTab === 'equipe' && <EquipeReport />}
      {subTab === 'setores' && <SetoresReport />}
      {subTab === 'redes' && <RedesReport />}
      {subTab === 'conteudo' && <ConteudoReport />}
      {subTab === 'acervo' && <AcervoReport />}
      {subTab === 'sugestoes' && <SugestoesReport />}
    </div>
  );
}

function EquipeReport() {
  return (
    <Panel title="Desempenho da equipe">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
              <th className="px-3 py-2 text-left">Membro</th>
              <th className="px-3 py-2 text-left">Função</th>
              <th className="px-3 py-2 text-left">Concluídas</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Entrega média</th>
              <th className="px-3 py-2 text-left">Aprovação</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TEAM_PERFORMANCE.map((p, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-3 py-3 font-medium text-slate-200">{p.user}</td>
                <td className="px-3 py-3 text-slate-400">{p.role}</td>
                <td className="px-3 py-3 text-emerald-300">{p.tasks_completed}</td>
                <td className="px-3 py-3 text-slate-400">{p.tasks_total}</td>
                <td className="px-3 py-3 text-slate-400">{p.avg_delivery_days} dias</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-sky-400" style={{ width: `${p.approval_rate}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{p.approval_rate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SetoresReport() {
  return (
    <Panel title="Carga de trabalho por pessoa">
      <div className="flex flex-col gap-2">
        {MOCK_TEAM_WORKLOAD.map((w, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
            <div className="flex-1">
              <p className="font-medium text-slate-200">{w.name}</p>
              <p className="text-xs text-slate-500">{w.role} · {w.active_tasks} tarefas ativas</p>
            </div>
            <Badge tone={w.deadline_risk === 'Baixo' ? 'success' : w.deadline_risk === 'Alto' ? 'error' : 'pending'}>
              Risco {w.deadline_risk}
            </Badge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RedesReport() {
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
            {MOCK_SOCIAL_METRICS.map((s, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-3 py-3 font-medium text-slate-200">{s.platform}</td>
                <td className="px-3 py-3 text-slate-400">{s.followers}</td>
                <td className="px-3 py-3 text-sky-300">{s.engagement}</td>
                <td className="px-3 py-3 text-slate-400">{s.published}</td>
                <td className="px-3 py-3 text-violet-300">{s.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ConteudoReport() {
  return (
    <Panel title="Relatório de conteúdo">
      <p className="text-sm text-slate-400">Análise de conteúdo por programa, categoria e período.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <InfoRow label="Programas ativos" value="4" />
        <InfoRow label="Categorias" value="12" />
        <InfoRow label="Conteúdo produzido (mês)" value="87 peças" />
      </div>
    </Panel>
  );
}

function AcervoReport() {
  return (
    <Panel title="Relatório de acervo">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <InfoRow label="Total de arquivos" value="18.542" />
        <InfoRow label="Indexados IA" value="14.908" />
        <InfoRow label="Falhas" value="37" />
        <InfoRow label="Storage usado" value="72%" />
        <InfoRow label="Bibliotecas" value="12" />
        <InfoRow label="Crescimento semanal" value="+8%" />
      </div>
    </Panel>
  );
}

function SugestoesReport() {
  const sugestoes = [
    '24 vídeos similares a "chuva em porto alegre"',
    '5 novos clipes com "apresentador joão"',
    '12 entrevistas sobre "economia" ainda não utilizadas',
    'Seu acervo cresceu 8% esta semana',
    'Editor Carlos Lima está acima da capacidade recomendada',
  ];
  return (
    <Panel title="Sugestões da IA">
      <div className="flex flex-col gap-2">
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
