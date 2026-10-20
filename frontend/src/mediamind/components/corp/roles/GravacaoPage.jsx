import React from 'react';
import { Mic, Plus, Calendar, Clock, MapPin, User } from 'lucide-react';
import { StatCard, StatusBadge, Panel } from './RoleShared';
import { MOCK_CORP_PODCAST_RECORDINGS } from '../../../data';

const STATUS_MAP = {
  confirmada: 'bg-sky-500/15 text-sky-300',
  planejada: 'bg-amber-500/15 text-amber-300',
  gravada: 'bg-emerald-500/15 text-emerald-300',
};
const STATUS_LABELS = { confirmada: 'Confirmada', planejada: 'Planejada', gravada: 'Gravada' };

export default function GravacaoPage() {
  const agendadas = MOCK_CORP_PODCAST_RECORDINGS.filter((r) => r.status !== 'gravada').length;
  const gravadas = MOCK_CORP_PODCAST_RECORDINGS.filter((r) => r.status === 'gravada').length;
  const proxima = [...MOCK_CORP_PODCAST_RECORDINGS]
    .filter((r) => r.status !== 'gravada')
    .sort((a, b) => a.data.localeCompare(b.data))[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-100"><Mic size={18} className="text-sky-400" /> Gravação de Podcast</h2>
          <p className="text-sm text-slate-400">Suas sessões de gravação — função separada por enquanto.</p>
        </div>
        <button type="button" disabled title="Ainda não disponível" className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"><Plus size={13} /> Nova gravação</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Agendadas" value={agendadas} />
        <StatCard label="Gravadas" value={gravadas} tone="text-emerald-300" />
        <StatCard label="Próxima" value={proxima ? proxima.data.split('-').reverse().join('/') : '—'} tone="text-sky-300" />
      </div>

      <Panel title="Sessões de gravação" action={null}>
        <div className="space-y-2">
          {MOCK_CORP_PODCAST_RECORDINGS.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{r.titulo}</p>
                  <p className="text-[11px] text-slate-500">{r.podcast} · {r.episodio}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1"><Calendar size={11} /> {r.data} {r.horario}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={11} /> {r.duracao}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={11} /> {r.estudio}</span>
                    {r.convidado && <span className="inline-flex items-center gap-1"><User size={11} /> {r.convidado}</span>}
                  </div>
                </div>
                <StatusBadge status={r.status} map={STATUS_MAP} labels={STATUS_LABELS} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}