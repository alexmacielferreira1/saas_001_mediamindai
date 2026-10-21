import React, { useState } from 'react';
import { LayoutDashboard, Tv, AlertTriangle, CheckCircle2 } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard, StatusBadge } from './RoleShared';
import { MOCK_CORP_PRODUCTIONS, CORP_STATUS_LABELS } from '../../../data';

const TONE = {
  em_producao: 'bg-amber-500/15 text-amber-300',
  gravado: 'bg-sky-500/15 text-sky-300',
  em_edicao: 'bg-violet-500/15 text-violet-300',
  aguardando_aprovacao: 'bg-amber-500/15 text-amber-300',
  aprovado: 'bg-emerald-500/15 text-emerald-300',
  publicado: 'bg-emerald-500/15 text-emerald-300',
};

const GRADE = [
  { horario: '06:00', programa: 'Minuto Simers', status: 'publicado', conflito: false },
  { horario: '09:00', programa: 'Fronteiras da Saúde', status: 'aprovado', conflito: false },
  { horario: '12:00', programa: 'Jornal do Meio Dia', status: 'em_edicao', conflito: false },
  { horario: '14:00', programa: 'Sala de Prescrição', status: 'em_edicao', conflito: true },
  { horario: '16:00', programa: 'Opinião Simers', status: 'aguardando_aprovacao', conflito: false },
  { horario: '18:00', programa: 'No Front', status: 'em_producao', conflito: false },
  { horario: '20:00', programa: 'Corações e Mentes', status: 'gravado', conflito: true },
];

export default function ProgramacaoPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];

  const conflitos = GRADE.filter((g) => g.conflito);

  return (
    <RolePageShell roleId="programacao" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Slots na grade" value={GRADE.length} tone="text-sky-300" />
          <StatCard label="Concluídos" value={GRADE.filter((g) => g.status === 'publicado').length} tone="text-emerald-300" />
          <StatCard label="Em produção" value={GRADE.filter((g) => ['em_edicao', 'em_producao'].includes(g.status)).length} tone="text-violet-300" />
          <StatCard label="Conflitos" value={conflitos.length} tone="text-rose-300" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Grade de programação (hoje)" className="min-h-0">
            <div className="space-y-2">
              {GRADE.map((g, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-12 font-mono text-xs text-slate-400">{g.horario}</span>
                    <div className="flex items-center gap-2">
                      {g.conflito && <AlertTriangle size={13} className="text-rose-400" />}
                      <p className="text-sm font-medium text-slate-200">{g.programa}</p>
                    </div>
                  </div>
                  <StatusBadge status={g.status} map={TONE} labels={CORP_STATUS_LABELS} />
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Conflitos & alertas" className="min-h-0">
            <div className="space-y-2">
              {conflitos.length === 0 && (
                <div className="flex items-center gap-2 py-6 text-center text-sm text-emerald-300">
                  <CheckCircle2 size={16} /> Nenhum conflito na grade.
                </div>
              )}
              {conflitos.map((c, i) => (
                <div key={i} className="rounded-lg border border-rose-800/50 bg-rose-950/20 px-3 py-2.5">
                  <p className="text-sm font-medium text-slate-200">{c.horario} — {c.programa}</p>
                  <p className="mt-0.5 text-[11px] text-rose-300/80">Sobreposição de horário / material indisponível.</p>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>

        <CorpPanel title="Episódios disponíveis para veiculação" className="min-h-0">
          <div className="space-y-2">
            {MOCK_CORP_PRODUCTIONS.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Tv size={14} className="text-sky-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{p.programa} — {p.episodio}</p>
                    <p className="text-[11px] text-slate-500">{p.titulo} · publica {p.data_publicacao}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} map={TONE} labels={CORP_STATUS_LABELS} />
              </div>
            ))}
          </div>
        </CorpPanel>
      </div>
    </RolePageShell>
  );
}