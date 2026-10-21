import React, { useState } from 'react';
import { LayoutDashboard, Users, FileText } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard, StatusBadge } from './RoleShared';
import { MOCK_CORP_SOURCES, MOCK_CORP_ARTICLES } from '../../../data';

const TONE = {
  em_campo: 'bg-amber-500/15 text-amber-300',
  agendada: 'bg-sky-500/15 text-sky-300',
  rascunho: 'bg-slate-500/15 text-slate-300',
  aprovada: 'bg-emerald-500/15 text-emerald-300',
  em_pauta: 'bg-violet-500/15 text-violet-300',
  revisao: 'bg-amber-500/15 text-amber-300',
  publicado: 'bg-emerald-500/15 text-emerald-300',
};
const LABEL = {
  em_campo: 'Em campo', agendada: 'Agendada', rascunho: 'Rascunho', aprovada: 'Aprovada',
  em_pauta: 'Em pauta', revisao: 'Em revisão', publicado: 'Publicado',
};

const PAUTAS = [
  { id: 1, titulo: 'Cobertura enchentes RS', status: 'em_campo', prazo: '13/09', fonte: 'Defesa Civil' },
  { id: 2, titulo: 'Entrevista Sec. Saúde', status: 'agendada', prazo: '14/09', fonte: 'Sec. Saúde' },
  { id: 3, titulo: 'Mobilização urbana', status: 'rascunho', prazo: '16/09', fonte: 'EPTC' },
  { id: 4, titulo: 'Bastidores EP054', status: 'em_pauta', prazo: '18/09', fonte: 'Produção' },
];

export default function ReporterPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];

  return (
    <RolePageShell roleId="reporter" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Pautas atribuídas" value={PAUTAS.length} tone="text-sky-300" />
          <StatCard label="Em campo hoje" value={PAUTAS.filter((p) => p.status === 'em_campo').length} tone="text-amber-300" />
          <StatCard label="Fontes ativas" value={MOCK_CORP_SOURCES.length} tone="text-violet-300" />
          <StatCard label="Matérias em revisão" value={MOCK_CORP_ARTICLES.filter((a) => a.status === 'revisao').length} tone="text-emerald-300" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Pautas do dia" className="min-h-0">
            <div className="space-y-2">
              {PAUTAS.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{p.titulo}</p>
                    <p className="text-[11px] text-slate-500"><Users size={11} className="mr-1 inline" />{p.fonte} · prazo {p.prazo}</p>
                  </div>
                  <StatusBadge status={p.status} map={TONE} labels={LABEL} />
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Fontes / contatos" className="min-h-0">
            <div className="space-y-2">
              {MOCK_CORP_SOURCES.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{s.nome}</p>
                    <p className="text-[11px] text-slate-500">{s.cargo} · {s.contato}</p>
                  </div>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">{s.area}</span>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>

        <CorpPanel title="Matérias em andamento" className="min-h-0">
          <div className="space-y-2">
            {MOCK_CORP_ARTICLES.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <FileText size={14} className="text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{a.titulo}</p>
                    <p className="text-[11px] text-slate-500">{a.canal} · prazo {a.prazo}</p>
                  </div>
                </div>
                <StatusBadge status={a.status} map={TONE} labels={LABEL} />
              </div>
            ))}
          </div>
        </CorpPanel>
      </div>
    </RolePageShell>
  );
}