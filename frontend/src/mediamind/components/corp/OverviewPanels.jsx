import React from 'react';
import { Calendar, Mic, Send, Scissors } from 'lucide-react';
import { MOCK_CORP_PROJECTS } from '../../data';
import { useProducaoProjetos } from '../../lib/producaoStore';
import { usePublicacoes } from '../../lib/corpPublicacoes';
import { StatusBadge } from '../shared';

// Painéis trazidos do antigo "Início" pra morar na Visão Geral da Produção.
export function ProjetosAtribuidosPanel() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Projetos atribuídos a você</p>
      <div className="space-y-1">
        {MOCK_CORP_PROJECTS.map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md bg-slate-950/50 px-2.5 py-1.5">
            <span className="truncate text-xs font-medium text-slate-200">{p.titulo}</span>
            <span className="ml-auto shrink-0"><StatusBadge status={p.status} /></span>
            <span className="shrink-0 font-mono text-[10px] text-slate-500">{p.prazo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgendaUnificadaPanel() {
  const projetos = useProducaoProjetos();
  const { pubs } = usePublicacoes();
  const recs = projetos
    .filter((p) => p.etapa === 'gravacao' && p.gravacao && !p.gravada)
    .map((p) => ({ data: p.gravacao.data, horario: p.gravacao.horario, titulo: p.titulo, tipo: 'Gravação', tone: 'bg-amber-500', Icon: Mic }));
  const pubEvents = pubs
    .filter((p) => (p.status === 'publicado' || p.status === 'programado') && p.published_at)
    .map((p) => ({ data: p.published_at.slice(0, 10), horario: p.published_at.slice(11, 16), titulo: p.titulo, tipo: 'Publicação', tone: 'bg-emerald-500', Icon: Send }));
  const agenda = [...recs, ...pubEvents].sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario)).slice(0, 6);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Calendar size={14} className="text-sky-400" />
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Agenda editorial unificada — próximas</p>
      </div>
      <div className="space-y-1.5">
        {agenda.map((e, i) => {
          const Icon = e.Icon;
          return (
            <div key={i} className="flex items-center gap-3 rounded-md bg-slate-950/50 px-3 py-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${e.tone}`} />
              <Icon size={13} className="shrink-0 text-slate-500" />
              <span className="truncate text-xs text-slate-200">{e.titulo}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">{e.data.split('-').reverse().join('/')} {e.horario}</span>
              <span className="shrink-0 rounded bg-slate-700/40 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">{e.tipo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Agenda de edição (Editor de vídeo) — prazos de edição das produções em corte.
// Deriva do producaoStore: projetos em "em_edicao" com prazo de edição definido.
const EDICAO_STATUS_CANON = {
  rascunho_corte: 'em_andamento',
  corte_fino: 'em_andamento',
  revisao_interna: 'em_andamento',
  pronto_para_aprovacao: 'ready',
};
export function AgendaEdicaoUnificadaPanel() {
  const projetos = useProducaoProjetos();
  const edits = projetos
    .filter((p) => p.etapa === 'em_edicao' && p.edicao_prazo)
    .map((p) => ({
      id: p.id,
      episodio: p.episodio,
      titulo: p.titulo,
      prazo: p.edicao_prazo,
      prazoLabel: p.edicao_prazo.split('-').reverse().join('/'),
      status: EDICAO_STATUS_CANON[p.edicao_status] || 'em_andamento',
    }))
    .sort((a, b) => (a.prazo || '').localeCompare(b.prazo || ''));
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Scissors size={14} className="text-violet-400" />
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Agenda de edição — prazos</p>
      </div>
      <div className="space-y-1.5">
        {edits.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] text-slate-500">Sem prazos de edição definidos. Defina o prazo no detalhamento da edição.</p>
        ) : (
          edits.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-md bg-slate-950/50 px-3 py-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />
              <span className="truncate text-xs text-slate-200">{e.episodio} — {e.titulo}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">{e.prazoLabel}</span>
              <span className="shrink-0"><StatusBadge status={e.status} /></span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}