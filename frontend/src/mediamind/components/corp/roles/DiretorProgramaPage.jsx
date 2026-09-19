import React, { useState } from 'react';
import { LayoutDashboard, Tv, CheckCircle2, Flag, Send, BarChart3 } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard, StatusBadge } from './RoleShared';
import { MOCK_CORP_PRODUCAO_PROJETOS, CORP_STATUS_LABELS, MOCK_CORP_APPROVAL_QUEUE, MOCK_CORP_ANALYTICS } from '../../../data';

const TONE = {
  rascunho: 'bg-slate-500/15 text-slate-300',
  gravacao: 'bg-amber-500/15 text-amber-300',
  em_edicao: 'bg-violet-500/15 text-violet-300',
  em_aprovacao: 'bg-sky-500/15 text-sky-300',
  finalizado: 'bg-emerald-500/15 text-emerald-300',
};
const PRIO_TONE = { alta: 'bg-rose-500/15 text-rose-300', media: 'bg-amber-500/15 text-amber-300', baixa: 'bg-slate-500/15 text-slate-300' };

export default function DiretorProgramaPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];

  const programas = [...new Set(MOCK_CORP_PRODUCAO_PROJETOS.map((p) => p.programa))];

  return (
    <RolePageShell roleId="diretor_programa" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Programas ativos" value={programas.length} tone="text-sky-300" />
          <StatCard label="Aprovações pendentes" value={MOCK_CORP_APPROVAL_QUEUE.length} tone="text-amber-300" />
          <StatCard label="Episódios finalizados" value={MOCK_CORP_PRODUCAO_PROJETOS.filter((p) => p.etapa === 'finalizado').length} tone="text-emerald-300" />
          <StatCard label="Visualizações (total)" value={MOCK_CORP_ANALYTICS.visualizacoes} tone="text-violet-300" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Fila de aprovações" className="min-h-0">
            <div className="space-y-2">
              {MOCK_CORP_APPROVAL_QUEUE.slice(0, 6).map((ap) => (
                <div key={ap.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{ap.titulo}</p>
                    <p className="text-[11px] text-slate-500">{ap.segmento} · {ap.solicitante} · {ap.tempo}</p>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${PRIO_TONE[ap.prioridade]}`}>{ap.prioridade}</span>
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Programas & episódios" className="min-h-0">
            <div className="space-y-2">
              {programas.map((nome) => {
                const eps = MOCK_CORP_PRODUCAO_PROJETOS.filter((p) => p.programa === nome);
                const etapa = eps[0]?.etapa;
                return (
                  <div key={nome} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Tv size={14} className="text-sky-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{nome}</p>
                        <p className="text-[11px] text-slate-500">{eps.length} episódio(s)</p>
                      </div>
                    </div>
                    <StatusBadge status={etapa} map={TONE} labels={CORP_STATUS_LABELS} />
                  </div>
                );
              })}
            </div>
          </CorpPanel>
        </div>

        <CorpPanel title="Top programas por visualização" className="min-h-0">
          <div className="space-y-2">
            {MOCK_CORP_ANALYTICS.top_programas.map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm text-slate-200">{m.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-violet-500" style={{ width: `${m.value}%` }} />
                </div>
                <span className="w-12 text-right text-xs font-mono text-slate-400">{m.value}%</span>
              </div>
            ))}
          </div>
        </CorpPanel>
      </div>
    </RolePageShell>
  );
}