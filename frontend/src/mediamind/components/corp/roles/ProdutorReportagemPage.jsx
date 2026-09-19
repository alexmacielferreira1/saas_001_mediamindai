import React, { useState } from 'react';
import { LayoutDashboard, ClipboardList, Users, Calendar, Clapperboard, Flag } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard, StatusBadge } from './RoleShared';
import { MOCK_CORP_PRODUCAO_PROJETOS, CORP_STATUS_LABELS } from '../../../data';

const TONE = {
  rascunho: 'bg-slate-500/15 text-slate-300',
  gravacao: 'bg-amber-500/15 text-amber-300',
  em_edicao: 'bg-violet-500/15 text-violet-300',
  em_aprovacao: 'bg-sky-500/15 text-sky-300',
  finalizado: 'bg-emerald-500/15 text-emerald-300',
};

const REPORTAGENS = MOCK_CORP_PRODUCAO_PROJETOS.filter((p) => ['gravacao', 'em_edicao', 'em_aprovacao'].includes(p.etapa));

export default function ProdutorReportagemPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];

  return (
    <RolePageShell roleId="produtor_reportagem" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Reportagens ativas" value={REPORTAGENS.length} tone="text-sky-300" />
          <StatCard label="Gravações agendadas" value={MOCK_CORP_PRODUCAO_PROJETOS.filter((p) => p.etapa === 'gravacao').length} tone="text-amber-300" />
          <StatCard label="Em edição" value={MOCK_CORP_PRODUCAO_PROJETOS.filter((p) => p.etapa === 'em_edicao').length} tone="text-violet-300" />
          <StatCard label="Finalizadas" value={MOCK_CORP_PRODUCAO_PROJETOS.filter((p) => p.etapa === 'finalizado').length} tone="text-emerald-300" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Reportagens em produção" className="min-h-0">
            <div className="space-y-2">
              {REPORTAGENS.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">{r.programa} — {r.titulo}</p>
                    <StatusBadge status={r.etapa} map={TONE} labels={CORP_STATUS_LABELS} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    <Users size={11} className="mr-1 inline" />{r.responsavel}
                    {r.gravacao ? ` · ${r.gravacao.data} ${r.gravacao.horario} · ${r.gravacao.estudio}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Equipe & alocação" className="min-h-0">
            <div className="space-y-2">
              {[
                { nome: 'Claudia', funcao: 'Produção', ativa: 3 },
                { nome: 'Ana', funcao: 'Edição', ativa: 2 },
                { nome: 'Rafael', funcao: 'Assessoria', ativa: 2 },
                { nome: 'Larissa', funcao: 'Redação', ativa: 4 },
              ].map((p) => (
                <div key={p.nome} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{p.nome}</p>
                    <p className="text-[11px] text-slate-500">{p.funcao}</p>
                  </div>
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">{p.ativa} ativas</span>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>

        <CorpPanel title="Próximas gravações" className="min-h-0">
          <div className="space-y-2">
            {MOCK_CORP_PRODUCAO_PROJETOS.filter((p) => p.gravacao).slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Clapperboard size={14} className="text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{p.programa} — {p.titulo}</p>
                    <p className="text-[11px] text-slate-500">{p.gravacao.data} · {p.gravacao.horario} · {p.gravacao.estudio}</p>
                  </div>
                </div>
                <StatusBadge status={p.etapa} map={TONE} labels={CORP_STATUS_LABELS} />
              </div>
            ))}
          </div>
        </CorpPanel>
      </div>
    </RolePageShell>
  );
}