import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlayCircle, Package, FolderKanban, FileText, CheckCircle2,
  Search, Sparkles, Activity, Archive, Clock, ArrowRight,
  CalendarClock, AlertTriangle, Send, Film,
  CalendarDays,
  Users,
} from 'lucide-react';
import { getMyDashboard } from '../../api/dashboard';
import { Panel, Stat, Badge, StatusBadge, Button } from '../ui';
import { formatDuration } from '../data';
import { useMamData } from '../lib/mamData';
import { useAuth } from '../auth';
import { readLocalDemoSession } from '../lib/demoAccess';
import { DATA_SOURCE } from '../lib/dataOrigin';

export function canViewProfiles(user) {
  return user?.role === 'superadmin';
}

export function resolveDashboardState(dashboard, error, localDemo, demoKpis = []) {
  if (localDemo) return { source: DATA_SOURCE.DEMO, kpis: demoKpis };
  if (error) return { source: DATA_SOURCE.UNAVAILABLE, kpis: [] };
  if (!dashboard) return { source: null, kpis: [] };
  const kpis = Array.isArray(dashboard.kpis) ? dashboard.kpis : [];
  return { source: kpis.length ? DATA_SOURCE.REAL : DATA_SOURCE.EMPTY, kpis };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Home() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [localDemo] = useState(() => Boolean(readLocalDemoSession()));
  const { projects, assets, tasks, scripts, savedSearches, recentActivity, loading } = useMamData();
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date());

  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const activeProjects = projects.filter((p) => p.status === 'active');
  const reviewingScripts = scripts.filter((s) => s.status !== 'approved');
  const completedAssets = assets.filter((a) => a.ai_status === 'complete').length;
  useEffect(() => {
    let active = true;
    if (localDemo) return () => { active = false; };
    getMyDashboard()
      .then((data) => { if (active) { setDashboard(data); setDashboardError(null); } })
      .catch((reason) => { if (active) { setDashboard(null); setDashboardError(reason); } });
    return () => { active = false; };
  }, [localDemo]);

  const fallbackKpis = [
    { id: 'projects', label: 'Projetos ativos', value: activeProjects.length },
    { id: 'assets', label: 'Acervo', value: assets.length },
    { id: 'processing', label: 'Processados IA', value: completedAssets },
    { id: 'tasks', label: 'Tarefas hoje', value: tasks.length },
    { id: 'editing', label: 'Em edição', value: inProgressTasks.length },
    { id: 'approvals', label: 'Aprovações', value: reviewingScripts.length },
    { id: 'publications', label: 'Publicações', value: 0 },
    { id: 'pending', label: 'Pendências', value: tasks.filter((t) => t.status !== 'approved').length },
  ];
  const dashboardState = resolveDashboardState(dashboard, dashboardError, localDemo, fallbackKpis);
  const kpis = dashboardState.kpis;
  const kpiIcons = [FolderKanban, Archive, Sparkles, CheckCircle2, Film, CalendarClock, Send, AlertTriangle];
  const kpiTones = ['sky', 'violet', 'emerald', 'amber', 'sky', 'violet', 'emerald', 'amber'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 lg:text-3xl">
            {getGreeting()} 👋
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm capitalize text-slate-400">
            <Clock size={14} /> {today}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canViewProfiles(user) && (
            <Link to="/corp" className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/20">
              <Users size={16} /> Perfis
            </Link>
          )}
          <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">
            {dashboardState.source === DATA_SOURCE.DEMO ? 'Demonstração explícita' : dashboardState.source === DATA_SOURCE.REAL ? 'Dados reais' : dashboardState.source === DATA_SOURCE.EMPTY ? 'Sem indicadores registrados' : dashboardState.source === DATA_SOURCE.UNAVAILABLE ? 'Indicadores indisponíveis' : 'Carregando indicadores'}
          </span>
        </div>
      </header>

      {/* Top stats */}
      {dashboardState.source === DATA_SOURCE.UNAVAILABLE && <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">Não foi possível carregar os indicadores reais. Nenhum valor demonstrativo foi usado.</div>}
      {dashboardState.source === DATA_SOURCE.EMPTY && <div role="status" className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-400">Ainda não há indicadores registrados para esta empresa.</div>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {kpis.map((item, index) => (
          <Stat key={item.id} title={item.label} value={item.value} icon={kpiIcons[index]} tone={kpiTones[index]} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
        {/* Continuar de onde parou */}
        <div className="space-y-4">
          <Panel title="Continuar de onde parou" right={<PlayCircle size={16} className="text-slate-500" />}>
            <div className="space-y-1">
              {tasks.filter((t) => t.status !== 'approved').map((t) => (
                <Link
                  key={t.id}
                  to="/workspace"
                  className="flex items-center gap-2 rounded-md bg-slate-950/50 px-2.5 py-1.5 transition hover:bg-slate-900"
                >
                  <FileText size={13} className="shrink-0 text-slate-500" />
                  <span className="truncate text-xs font-medium text-slate-200">{t.title}</span>
                  <span className="truncate text-[11px] text-slate-500">{t.project_name}</span>
                  <span className="ml-auto shrink-0"><StatusBadge status={t.status} /></span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Pacotes em andamento" right={<Package size={16} className="text-slate-500" />}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-400"><Package size={15} /> Tarefas</span>
                <span className="text-sm font-bold text-violet-300">{inProgressTasks.length} <span className="font-normal text-slate-500">em edição</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-400"><FolderKanban size={15} /> Projetos</span>
                <span className="text-sm font-bold text-amber-300">{activeProjects.length} <span className="font-normal text-slate-500">ativos</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-400"><FileText size={15} /> Roteiros</span>
                <span className="text-sm font-bold text-emerald-300">{reviewingScripts.length} <span className="font-normal text-slate-500">em revisão</span></span>
              </div>
            </div>
          </Panel>
        </div>

        {/* Minhas tarefas */}
        <Panel title="Minhas tarefas" right={<CheckCircle2 size={16} className="text-slate-500" />}>
          <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-800 pb-3 text-xs">
            <span className="rounded-md bg-sky-500/20 px-3 py-1.5 font-semibold text-sky-300">Todas {tasks.length}</span>
            <span className="rounded-md bg-slate-800 px-3 py-1.5 text-slate-400">Em andamento {inProgressTasks.length}</span>
            <span className="rounded-md bg-slate-800 px-3 py-1.5 text-slate-400">Aprovação {tasks.filter((t) => t.status === 'delivered').length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                  <FileText size={13} className="text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{t.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    <span className="text-xs text-slate-500">{t.project_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Pesquisas salvas + atividade */}
        <div className="space-y-4">
          <Panel title="Pesquisas salvas" right={<Search size={16} className="text-slate-500" />}>
            <div className="flex flex-col gap-2">
              {savedSearches.map((s) => (
                <Link
                  key={s.id}
                  to={`/search?q=${encodeURIComponent(s.title)}`}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800/60"
                >
                  <Search size={13} className="text-slate-500 group-hover:text-sky-400" />
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="text-xs text-slate-600">{s.date}</span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Atividade recente" right={<Activity size={16} className="text-slate-500" />}>
            <div className="flex flex-col gap-2.5">
              {recentActivity.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  <div className="min-w-0">
                    <p className="truncate text-slate-200">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.detail} — {a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Agenda & Calendário" right={<Link to="/corp" className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"><CalendarDays size={13} /> Ver agenda</Link>}>
        {dashboard?.upcoming_events?.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.upcoming_events.map((event, index) => (
              <div key={`${event.title}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-slate-200">{event.title}</p>
                  <span className="shrink-0 text-xs font-semibold text-sky-300">{event.time || 'A definir'}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="truncate">{event.project || 'Agenda da empresa'}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 uppercase">{event.status || 'planejado'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-3 text-sm text-slate-500">Nenhum compromisso registrado para esta empresa.</p>
        )}
      </Panel>

      {/* Projetos recentes */}
      <Panel title="Projetos recentes" right={<Link to="/workspace" className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"><ArrowRight size={13} /> Ver todos</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/workspace"
              className="mm-panel mm-card-hover group"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-lg">
                  📁
                </div>
                <StatusBadge status={p.status} />
              </div>
              <p className="truncate font-semibold text-slate-100">{p.name}</p>
              <p className="mt-1 text-xs text-slate-500">{p.asset_count} arquivos</p>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
