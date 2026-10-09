import React, { useMemo } from 'react';
import { Calendar, Mic, Send } from 'lucide-react';
import { StatCard } from './roles/RoleShared';
import {
  MOCK_CORP_PRODUCTIONS, MOCK_CORP_PUBLICATIONS, MOCK_CORP_APPROVAL_QUEUE,
  MOCK_CORP_PENDENCIES, MOCK_CORP_PODCAST_RECORDINGS,
} from '../../data';

const SEGMENT_KEYS = ['producao', 'redacao', 'design', 'assessoria', 'audiovisual', 'revistas', 'endomarketing'];

export default function CorpDashboard() {
  const emAndamento = MOCK_CORP_PRODUCTIONS.filter((p) => ['em_producao', 'em_edicao', 'gravado'].includes(p.status)).length;
  const aguardando = MOCK_CORP_PRODUCTIONS.filter((p) => p.status === 'aguardando_aprovacao').length;
  const publicados = MOCK_CORP_PRODUCTIONS.filter((p) => p.status === 'publicado').length;
  const aprovacoesFila = MOCK_CORP_APPROVAL_QUEUE.length;
  const pendenciasAbertas = SEGMENT_KEYS.reduce(
    (acc, s) => acc + (MOCK_CORP_PENDENCIES[s] || []).filter((p) => p.status !== 'concluido').length,
    0
  );
  const gravacoesAgendadas = MOCK_CORP_PODCAST_RECORDINGS.filter((r) => r.status !== 'gravada').length;

  const agenda = useMemo(() => {
    const recs = MOCK_CORP_PODCAST_RECORDINGS
      .filter((r) => r.status !== 'gravada')
      .map((r) => ({ data: r.data, horario: r.horario, titulo: r.titulo, tipo: 'Gravação', tone: 'bg-amber-500', Icon: Mic }));
    const pubs = MOCK_CORP_PUBLICATIONS
      .filter((p) => p.status === 'publicado' && p.published_at)
      .map((p) => ({ data: p.published_at.slice(0, 10), horario: p.published_at.slice(11, 16), titulo: p.titulo, tipo: 'Publicação', tone: 'bg-emerald-500', Icon: Send }));
    return [...recs, ...pubs].sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario)).slice(0, 6);
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Em andamento" value={emAndamento} tone="text-sky-300" />
        <StatCard label="Aguardando aprovação" value={aguardando} tone="text-amber-300" />
        <StatCard label="Publicados" value={publicados} tone="text-emerald-300" />
        <StatCard label="Aprovações na fila" value={aprovacoesFila} tone="text-rose-300" />
        <StatCard label="Pendências abertas" value={pendenciasAbertas} tone="text-violet-300" />
        <StatCard label="Gravações agendadas" value={gravacoesAgendadas} tone="text-sky-300" />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar size={15} className="text-sky-400" />
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Agenda editorial unificada — próximas</p>
        </div>
        <div className="space-y-1.5">
          {agenda.map((e, i) => {
            const Icon = e.Icon;
            return (
              <div key={i} className="flex items-center gap-3 rounded-md bg-slate-950/50 px-3 py-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${e.tone}`} />
                <Icon size={13} className="shrink-0 text-slate-500" />
                <span className="truncate text-sm text-slate-200">{e.titulo}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-slate-500">{e.data.split('-').reverse().join('/')} {e.horario}</span>
                <span className="shrink-0 rounded bg-slate-700/40 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">{e.tipo}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}