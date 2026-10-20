import React, { useState } from 'react';
import { ChevronDown, Circle, Check, Clock, Scissors, Youtube, Instagram, Linkedin, TrendingUp } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import {
  MOCK_CORP_PRODUCTIONS, CORP_STATUS_LABELS,
  MOCK_CORP_TIMELINE, MOCK_CORP_MEDIA, MOCK_CORP_PUBLICATIONS,
  MOCK_CORP_RECORTES, MOCK_CORP_EDIT_APPROVALS, MOCK_CORP_ANALYTICS,
} from '../../data';
import ProjectThumbnails from '../thumbnails/ProjectThumbnails';
import { useProducaoProjetos } from '../../lib/producaoStore';
import { StatusBadge } from '../../ui';

const TABS = ['Geral', 'Timeline', 'Tarefas', 'Mídias', 'Publicações', 'Recortes', 'Aprovações', 'Analytics'];
const STEPS = ['Planejamento', 'Gravação', 'Edição', 'Revisão', 'Aprovação', 'Publicação'];
const PLATFORM_ICON = { youtube: Youtube, tiktok: Instagram, instagram: Instagram, linkedin: Linkedin };
const MEDIA_TONE = { bruto: 'bg-amber-500/15 text-amber-300', finalizado: 'bg-emerald-500/15 text-emerald-300' };
const TASK_TONE = { done: 'text-emerald-400', progress: 'text-sky-400', pending: 'text-slate-500' };

const TAREFAS = [
  { id: 1, titulo: 'Confirmar convidado (Dr. Paulo)', status: 'done', resp: 'Claudia', prazo: '14/09' },
  { id: 2, titulo: 'Reservar estúdio e equipamentos', status: 'done', resp: 'Rafael', prazo: '14/09' },
  { id: 3, titulo: 'Roteiro EP054 — Sala de Prescrição', status: 'progress', resp: 'Larissa', prazo: '15/09' },
  { id: 4, titulo: 'Arte da capa do episódio', status: 'pending', resp: 'Bianca', prazo: '16/09' },
  { id: 5, titulo: 'Publicar no YouTube e Spotify', status: 'pending', resp: 'Ana', prazo: '17/09' },
];

export default function CorpProductionDetail({ productionId }) {
  const [tab, setTab] = useState('Geral');
  const projects = useProducaoProjetos();
  const actualProject = projects.find((p) => String(p.id) === String(productionId) || String(p._entityId) === String(productionId));
  const production = actualProject || MOCK_CORP_PRODUCTIONS.find((p) => p.id === productionId) || MOCK_CORP_PRODUCTIONS[0];
  const currentStepIndex = 2;
  const a = MOCK_CORP_ANALYTICS;
  const chartData = a.serie_visualizacoes.map((v, i) => ({ x: i, v }));

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40">
      {/* Cabeçalho + abas */}
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">{production.episodio} — {production.programa}</p>
            <h2 className="text-sm font-semibold text-slate-100">{production.titulo}</h2>
          </div>
          <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            Editar <ChevronDown size={11} />
          </button>
        </div>

        <div className="mt-2.5 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition ${
                tab === t ? 'bg-sky-500/20 text-sky-300' : 'text-slate-500 hover:bg-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo por aba */}
      <div className="flex-1 overflow-y-auto p-4">
        <ProjectThumbnails projectId={String(production._entityId || production.id)} />
        {tab === 'Geral' && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Informações Gerais</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <p className="text-[9px] uppercase text-slate-500">Programa</p>
                  <p className="text-slate-200">{production.programa}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <p className="text-[9px] uppercase text-slate-500">Status</p>
                  <StatusBadge status={production.status} labels={CORP_STATUS_LABELS} />
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <p className="text-[9px] uppercase text-slate-500">Data de gravação</p>
                  <p className="font-mono text-slate-200">{production.data_gravacao}</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <p className="text-[9px] uppercase text-slate-500">Data de publicação</p>
                  <p className="font-mono text-slate-200">{production.data_publicacao}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Status da Produção</p>
              <div className="flex items-center">
                {STEPS.map((step, i) => (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center gap-1">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        i < currentStepIndex ? 'bg-sky-500 text-slate-950' : i === currentStepIndex ? 'bg-sky-500/20 text-sky-300 ring-2 ring-sky-500' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {i + 1}
                      </div>
                      <span className="w-16 text-center text-[9px] text-slate-500">{step}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`h-px flex-1 ${i < currentStepIndex ? 'bg-sky-500' : 'bg-slate-700'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">Responsáveis</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { role: 'Produtora', name: 'Claudia' },
                  { role: 'Editora', name: 'Ana' },
                  { role: 'Assistente', name: 'Rafael' },
                ].map((r) => (
                  <div key={r.role} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-xs">
                    <span className="text-slate-500">{r.role}</span>
                    <span className="font-medium text-slate-200">{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Timeline' && (
          <div className="relative ml-1.5 flex flex-col gap-3 border-l border-slate-700 pl-4">
            {MOCK_CORP_TIMELINE.map((event, i) => (
              <div key={i} className="relative">
                <Circle size={8} className="absolute -left-[21px] top-1 fill-sky-500 text-sky-500" />
                <p className="text-[10px] font-mono text-sky-300">{event.time}</p>
                <p className="text-xs text-slate-200">{event.label}</p>
                <p className="text-[10px] text-slate-500">por {event.user}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'Tarefas' && (
          <div className="space-y-2">
            {TAREFAS.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                {t.status === 'done' ? (
                  <Check size={15} className={TASK_TONE[t.status]} />
                ) : (
                  <Clock size={15} className={TASK_TONE[t.status]} />
                )}
                <span className={`flex-1 text-xs ${t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{t.titulo}</span>
                <span className="text-[10px] text-slate-500">{t.resp}</span>
                <span className="font-mono text-[10px] text-slate-600">{t.prazo}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'Mídias' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MOCK_CORP_MEDIA.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                <div className="mb-1.5 flex h-16 items-center justify-center rounded-md bg-gradient-to-br from-slate-800 to-slate-900 text-2xl">{m.icon}</div>
                <p className="truncate text-[10px] font-medium text-slate-200">{m.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-[9px] text-slate-500">{m.duration}</span>
                  <span className="text-[9px] text-slate-500">{m.size}</span>
                </div>
                <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${MEDIA_TONE[m.status]}`}>{m.status}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'Publicações' && (
          <div className="space-y-2">
            {MOCK_CORP_PUBLICATIONS.map((p) => {
              const Icon = PLATFORM_ICON[p.plataforma] || Youtube;
              return (
                <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                  <div className="flex items-start gap-2">
                    <Icon size={13} className="mt-0.5 shrink-0 text-sky-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">{p.titulo}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{p.descricao}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-500">{p.duracao} · {p.views} views</span>
                    <StatusBadge status={p.status} labels={{ publicado: 'Publicado', programado: 'Programado', rascunho: 'Rascunho' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'Recortes' && (
          <div className="space-y-2">
            {MOCK_CORP_RECORTES.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-500/15">
                  <Scissors size={14} className="text-violet-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{r.titulo}</p>
                  <p className="text-[10px] text-slate-500">{r.tipo}</p>
                </div>
              </div>
            ))}
            {MOCK_CORP_RECORTES.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Nenhum recorte ainda.</p>}
          </div>
        )}

        {tab === 'Aprovações' && (
          <div className="space-y-2">
            {MOCK_CORP_EDIT_APPROVALS.map((ap) => (
              <div key={ap.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium text-slate-200">{ap.titulo}</p>
                  <p className="text-[10px] text-slate-500">Solicitado por {ap.solicitante} · {ap.tempo}</p>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" disabled title="Ainda não disponível" className="rounded-md border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">Recusar</button>
                  <button type="button" disabled title="Ainda não disponível" className="rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">Aprovar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Visualizações', value: a.visualizacoes, delta: '+18.7%' },
                { label: 'Watch Time', value: a.watch_time, delta: '+22.4%' },
                { label: 'Inscritos', value: a.inscritos, delta: '+15.2%' },
                { label: 'Comentários', value: a.comentarios.toLocaleString('pt-BR'), delta: '+12.1%' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-2">
                  <p className="text-[9px] uppercase text-slate-500">{s.label}</p>
                  <p className="text-sm font-bold text-slate-100">{s.value}</p>
                  <p className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-400"><TrendingUp size={9} /> {s.delta}</p>
                </div>
              ))}
            </div>

            <div className="h-24 w-full rounded-lg border border-slate-800 bg-slate-950/40 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line type="monotone" dataKey="v" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase text-slate-500">Top Programas</p>
              <div className="space-y-1.5">
                {a.top_programas.map((p) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-[10px] text-slate-400">{p.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${p.value}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[10px] font-mono text-slate-500">{p.value}K</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}