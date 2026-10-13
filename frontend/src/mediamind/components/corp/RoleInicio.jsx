import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlayCircle, CheckCircle2, Search, Activity, ArrowRight, FileText, Check, X,
  CalendarDays,
} from 'lucide-react';
import { Panel, Stat } from '../../ui';
import { StatusBadge, ListSkeleton, EmptyState } from '../shared';
import { useRoleInicioData } from '../../lib/roleInicioData';
import { useProducaoProjetos } from '../../lib/producaoStore';
import { decidirAprovacao } from '../../lib/corpAprovacoes';
import { MOCK_SAVED_SEARCHES, MOCK_RECENT_ACTIVITY } from '../../data';
import CorpAgenda from './CorpAgenda';
import AgendaEventDetail from './AgendaEventDetail';
import { base44 } from '@/api/base44Client';

const APPROVAL_ROLES = ['coordenador_comunicacao', 'qualidade'];
const DECISAO_LABEL = { aprovado: 'Aprovado', reprovado: 'Reprovado', pendente: 'Pendente' };

// Início padrão de uma função — espelha a Home: stats, Continuar de onde parou,
// Minhas tarefas, Pesquisas salvas + Atividade recente e Projetos recentes.
// O conteúdo vem do trabalho específico da função (useRoleInicioData), agora
// carregado das entidades persistentes (Publicacao/AprovacaoItem/Release) +
// producaoStore. Roles de aprovação ganham Aprovar/Reprovar na lista de tarefas.
export default function RoleInicio({ roleId, onNavigate }) {
  const { data: d, loading } = useRoleInicioData(roleId);
  const projetos = useProducaoProjetos();
  const [filter, setFilter] = useState('all');
  const [overrides, setOverrides] = useState({});
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [agendaEvents, setAgendaEvents] = useState([]);

  useEffect(() => {
    setAgendaEvents(d?.agenda || []);
    setSelectedEventId((current) => (d?.agenda.some((event) => event.id === current) ? current : null));
  }, [d]);

  if (loading) {
    return (
      <div className="h-full space-y-4 overflow-y-auto pb-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-slate-800" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-slate-800" />
            </div>
          ))}
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }
  if (!d) return null;

  const isApproval = APPROVAL_ROLES.includes(roleId);
  const selectedEvent = agendaEvents.find((event) => event.id === selectedEventId) || null;

  function updateAgendaEvent(id, patch) {
    setAgendaEvents((events) => events.map((event) => (event.id === id ? { ...event, ...patch } : event)));
    base44.entities.AgendaEvento.update(String(id), patch).catch(() => {});
  }

  // Aplica decisões de aprovação otimistas sobre as tarefas do hook, sem
  // depender de reload da entidade (mutação local + persistência em background).
  const localTasks = d.tasks.map((t) => (overrides[t.id]
    ? { ...t, status: overrides[t.id], statusLabel: DECISAO_LABEL[overrides[t.id]] || t.statusLabel }
    : t));

  function decidir(task, decisao) {
    setOverrides((o) => ({ ...o, [task.id]: decisao }));
    decidirAprovacao(task.id, decisao, { projetos });
  }

  const isDoneLabel = (l) => ['Concluído', 'Aprovado', 'Publicado', 'Gravada', 'OK', 'Ativo'].includes(l);
  const filtered =
    filter === 'pending' ? localTasks.filter((t) => !isDoneLabel(t.statusLabel))
      : filter === 'done' ? localTasks.filter((t) => isDoneLabel(t.statusLabel))
        : localTasks;

  return (
    <div className="h-full space-y-4 overflow-y-auto pb-4" style={{display:'block'}}>
      <div className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900/90 to-sky-950/30 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Visão geral</p>
        <h2 className="text-xl font-bold text-slate-100">{d.roleName}</h2>
        <p className="text-sm text-slate-400">{d.roleDescription}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {d.stats.map((s, i) => (
          <Stat key={i} title={s.title} value={s.value} icon={s.icon} tone={s.tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
        {/* Continuar de onde parou + Resumo */}
        <div className="space-y-4">
          <Panel title="Continuar de onde parou" right={<PlayCircle size={16} className="text-slate-500" />}>
            <div className="space-y-1">
              {d.resumeItems.length === 0 && (
                <p className="px-2 py-3 text-xs text-slate-500">Tudo em dia — nada pendente.</p>
              )}
              {d.resumeItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onNavigate?.(it.workTab)}
                  className="flex items-center gap-2 rounded-md bg-slate-950/50 px-2.5 py-1.5 transition hover:bg-slate-900"
                >
                  <FileText size={13} className="shrink-0 text-slate-500" />
                  <span className="truncate text-xs font-medium text-slate-200">{it.title}</span>
                  <span className="truncate text-[11px] text-slate-500">{it.subtitle}</span>
                  <span className="ml-auto shrink-0"><StatusBadge status={it.status} /></span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Resumo do trabalho" right={<Activity size={16} className="text-slate-500" />}>
            <div className="flex flex-col gap-2">
              {d.stats.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-400"><s.icon size={15} /> {s.title}</span>
                  <span className="font-bold text-slate-200">{s.value}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Minhas tarefas */}
        <Panel title="Minhas tarefas" right={<CheckCircle2 size={16} className="text-slate-500" />}>
          <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-800 pb-3 text-xs">
            <button onClick={() => setFilter('all')} className={`rounded-md px-3 py-1.5 font-semibold ${filter === 'all' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'}`}>Todas {localTasks.length}</button>
            <button onClick={() => setFilter('pending')} className={`rounded-md px-3 py-1.5 font-semibold ${filter === 'pending' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'}`}>Em andamento</button>
            <button onClick={() => setFilter('done')} className={`rounded-md px-3 py-1.5 font-semibold ${filter === 'done' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'}`}>Concluídas</button>
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Sem tarefas" description="Nada nesta visão." />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((t) => {
                const pendente = overrides[t.id] ? overrides[t.id] === 'pendente' : (t.status === 'pendente' || t.statusLabel === 'Pendente');
                return (
                  <div key={t.id} role="button" tabIndex={0} onClick={() => onNavigate?.(t.workTab)} onKeyDown={(event) => { if (event.key === 'Enter') onNavigate?.(t.workTab); }} className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5 transition hover:border-sky-500/50 hover:bg-slate-900/70">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                        <FileText size={13} className="text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">{t.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusBadge status={t.status} />
                          <span className="text-xs text-slate-500">{t.subtitle}</span>
                        </div>
                      </div>
                    </div>
                    {isApproval && pendente && (
                      <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-slate-800 pt-2">
                        <button onClick={(event) => { event.stopPropagation(); decidir(t, 'reprovado'); }} className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800"><X size={11} /> Reprovar</button>
                        <button onClick={(event) => { event.stopPropagation(); decidir(t, 'aprovado'); }} className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"><Check size={11} /> Aprovar</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Pesquisas salvas + Atividade recente */}
        <div className="space-y-4">
          <Panel title="Pesquisas salvas" right={<Search size={16} className="text-slate-500" />}>
            <div className="flex flex-col gap-2">
              {MOCK_SAVED_SEARCHES.map((s) => (
                <Link key={s.id} to={`/search?q=${encodeURIComponent(s.title)}`} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800/60">
                  <Search size={13} className="text-slate-500 group-hover:text-sky-400" />
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="text-xs text-slate-600">{s.date}</span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Atividade recente" right={<Activity size={16} className="text-slate-500" />}>
            <div className="flex flex-col gap-2.5">
              {MOCK_RECENT_ACTIVITY.map((a) => (
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

      <Panel title={`Agenda personalizada · ${d.roleName}`} right={<CalendarDays size={16} className="text-sky-400" />}>
        {agendaEvents.length > 0 ? (
          <div className={`grid gap-3 ${selectedEvent ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
            <div className="min-w-0" style={{display:'flow-root', overflow:'hidden'}}>
              <CorpAgenda
                events={agendaEvents}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
              />
            </div>
            {selectedEvent && (
              <div className="h-[25rem] overflow-y-auto">
                <AgendaEventDetail
                  event={selectedEvent}
                  onClose={() => setSelectedEventId(null)}
                  onNavigate={onNavigate}
                  onUpdate={(patch) => updateAgendaEvent(selectedEvent.id, patch)}
                />
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="Agenda livre" description="Não há compromissos desta função no período." />
        )}
      </Panel>

      {/* Projetos recentes */}
      <Panel title="Projetos recentes" right={<Link to="/corp" className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"><ArrowRight size={13} /> Ver todos</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {d.projects.map((p) => (
            <button key={p.id} type="button" onClick={() => onNavigate?.(p.workTab)} className="mm-panel mm-card-hover group text-left">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-lg">{p.emoji}</div>
                <StatusBadge status={p.status} />
              </div>
              <p className="truncate font-semibold text-slate-100">{p.name}</p>
              <p className="mt-1 text-xs text-slate-500">{p.meta}</p>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
