import React, { useState } from 'react';
import { LayoutDashboard, Network, CheckCircle2, Check, X, AlertTriangle } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard, StatusBadge } from './RoleShared';
import { useAprovacoes, decidirAprovacao } from '../../../lib/corpAprovacoes';
import { useProducaoProjetos } from '../../../lib/producaoStore';
import { MOCK_CORP_PENDENCIES } from '../../../data';
import { ListSkeleton, EmptyState, ErrorState } from '../../shared';

const TONE = { alta: 'bg-rose-500/15 text-rose-300', media: 'bg-amber-500/15 text-amber-300', baixa: 'bg-slate-500/15 text-slate-300' };
const LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const PTONE = { pendente: 'bg-amber-500/15 text-amber-300', em_andamento: 'bg-sky-500/15 text-sky-300', concluido: 'bg-emerald-500/15 text-emerald-300' };
const PLABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído' };
const DEC_TONE = { aprovado: 'bg-emerald-500/15 text-emerald-300', reprovado: 'bg-rose-500/15 text-rose-300', pendente: 'bg-amber-500/15 text-amber-300' };
const DEC_LABEL = { aprovado: 'Aprovado', reprovado: 'Reprovado', pendente: 'Pendente' };

// Coordenador de Comunicação — visão geral consolidada, fila central de
// aprovações (persistente, tempo real) e alocação entre segmentos.
export default function CoordenadorComunicacaoPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const { items: queue, loading, error, reload } = useAprovacoes();
  const projetos = useProducaoProjetos();
  const [busyId, setBusyId] = useState(null);
  const [decErr, setDecErr] = useState(null);
  const segments = Object.keys(MOCK_CORP_PENDENCIES);

  async function decidir(item, decisao) {
    setBusyId(item.id);
    setDecErr(null);
    const prev = queue;
    // Otimista: reflete a decisão imediatamente (sem flash) até confirmar.
    const res = await decidirAprovacao(item.id, decisao, { projetos });
    if (!res) {
      setDecErr('Falha ao registrar decisão. Tente novamente.');
      reload(); // reverte para o estado persistido real
    }
    setBusyId(null);
  }

  return (
    <RolePageShell roleId="coordenador_comunicacao" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        {decErr && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            <AlertTriangle size={14} className="shrink-0" /> {decErr}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Fila central de aprovações" className="min-h-0">
            {loading ? (
              <ListSkeleton rows={5} />
            ) : error ? (
              <ErrorState onRetry={reload} description="Não foi possível carregar a fila de aprovações." />
            ) : queue.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Fila vazia" description="Nenhum item aguardando aprovação." />
            ) : (
              <div className="space-y-2">
                {queue.map((q) => {
                  const pendente = q.status === 'pendente';
                  return (
                    <div key={q.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-200">{q.titulo}</p>
                          <p className="truncate text-[11px] text-slate-500">{q.segmento} · {q.solicitante} · {q.tipo}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <StatusBadge status={q.prioridade} map={TONE} labels={LABEL} />
                          <StatusBadge status={q.status} map={DEC_TONE} labels={DEC_LABEL} />
                        </div>
                      </div>
                      {pendente && (
                        <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-slate-800 pt-2">
                          <button
                            disabled={busyId === q.id}
                            onClick={() => decidir(q, 'reprovado')}
                            className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                          >
                            <X size={11} /> Reprovar
                          </button>
                          <button
                            disabled={busyId === q.id}
                            onClick={() => decidir(q, 'aprovado')}
                            className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                          >
                            <Check size={11} /> Aprovar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CorpPanel>

          <CorpPanel title="Pendências por segmento" className="min-h-0">
            <div className="space-y-2">
              {segments.map((s) => {
                const items = MOCK_CORP_PENDENCIES[s].filter((p) => p.status !== 'concluido');
                return (
                  <div key={s} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{s}</p>
                      <Network size={13} className="text-slate-500" />
                    </div>
                    <div className="space-y-1.5">
                      {items.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300">{p.titulo}</span>
                          <StatusBadge status={p.status} map={PTONE} labels={PLABEL} />
                        </div>
                      ))}
                      {items.length === 0 && <p className="text-[11px] text-slate-600">Tudo em dia.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}