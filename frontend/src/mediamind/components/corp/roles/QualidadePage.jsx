import React, { useState } from 'react';
import { LayoutDashboard, ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard, StatusBadge } from './RoleShared';
import { MOCK_CORP_PRODUCAO_PROJETOS, CORP_STATUS_LABELS } from '../../../data';

const QC_TONE = { aprovado: 'bg-emerald-500/15 text-emerald-300', reprovado: 'bg-rose-500/15 text-rose-300', pendente: 'bg-amber-500/15 text-amber-300' };
const QC_LABEL = { aprovado: 'Aprovado', reprovado: 'Reprovado', pendente: 'Pendente' };

const FILA_QC = [
  { id: 1, titulo: 'EP054 — Sala de Prescrição (final cut)', programa: 'Sala de Prescrição', status: 'pendente', checklists: ['Áudio', 'Legenda', 'Color', 'Padrão'], enviada: 'há 1h' },
  { id: 2, titulo: 'EP053 — Fronteiras da Saúde', programa: 'Fronteiras da Saúde', status: 'pendente', checklists: ['Áudio', 'Legenda'], enviada: 'há 3h' },
  { id: 3, titulo: 'Vinheta abertura v3', programa: 'Institucional', status: 'aprovado', checklists: ['Padrão'], enviada: 'há 5h' },
  { id: 4, titulo: 'EP052 — Opinião Simers', programa: 'Opinião Simers', status: 'reprovado', checklists: ['Áudio', 'Legenda'], enviada: 'há 6h' },
];

const ISSUES = [
  { id: 1, titulo: 'Áudio desync EP052', severidade: 'alta', status: 'aberta' },
  { id: 2, titulo: 'Legenda fora do padrão EP054', severidade: 'media', status: 'aberta' },
  { id: 3, titulo: 'Color bar EF053', severidade: 'baixa', status: 'resolvida' },
];

export default function QualidadePage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];

  return (
    <RolePageShell roleId="qualidade" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="QC pendentes" value={FILA_QC.filter((q) => q.status === 'pendente').length} tone="text-amber-300" />
          <StatCard label="Aprovados" value={FILA_QC.filter((q) => q.status === 'aprovado').length} tone="text-emerald-300" />
          <StatCard label="Reprovados" value={FILA_QC.filter((q) => q.status === 'reprovado').length} tone="text-rose-300" />
          <StatCard label="Issues abertas" value={ISSUES.filter((i) => i.status === 'aberta').length} tone="text-violet-300" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Fila de controle de qualidade" className="min-h-0">
            <div className="space-y-2">
              {FILA_QC.map((q) => (
                <div key={q.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">{q.titulo}</p>
                    <StatusBadge status={q.status} map={QC_TONE} labels={QC_LABEL} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{q.programa} · enviada {q.enviada}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {q.checklists.map((c) => (
                      <span key={c} className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">{c}</span>
                    ))}
                  </div>
                  {q.status === 'pendente' && (
                    <div className="mt-2 flex gap-1.5">
                      <button className="rounded-md bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-emerald-400">Aprovar</button>
                      <button className="rounded-md border border-rose-800 px-2.5 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-950/40">Reprovar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Issues & não-conformidades" className="min-h-0">
            <div className="space-y-2">
              {ISSUES.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={14} className={i.severidade === 'alta' ? 'text-rose-400' : i.severidade === 'media' ? 'text-amber-400' : 'text-slate-500'} />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{i.titulo}</p>
                      <p className="text-[11px] text-slate-500">Severidade {i.severidade}</p>
                    </div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${i.status === 'aberta' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{i.status}</span>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>

        <CorpPanel title="Padrões & conformidade" className="min-h-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {['Áudio -14 LUFS', 'Legenda SRT', 'Color Rec.709', 'Resolução 1080p'].map((p) => (
              <div key={p} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="text-xs text-slate-300">{p}</span>
              </div>
            ))}
          </div>
        </CorpPanel>
      </div>
    </RolePageShell>
  );
}