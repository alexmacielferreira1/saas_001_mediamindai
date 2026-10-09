import React, { useState } from 'react';
import { LayoutDashboard, CheckCheck } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard, StatusBadge } from './RoleShared';
import { MOCK_CORP_APPROVAL_QUEUE, MOCK_CORP_ARTICLES } from '../../../data';

const TONE = { alta: 'bg-rose-500/15 text-rose-300', media: 'bg-amber-500/15 text-amber-300', baixa: 'bg-slate-500/15 text-slate-300' };
const LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const ATONE = { revisao: 'bg-amber-500/15 text-amber-300', rascunho: 'bg-slate-500/15 text-slate-300', publicado: 'bg-emerald-500/15 text-emerald-300' };
const ALABEL = { revisao: 'Em revisão', rascunho: 'Rascunho', publicado: 'Publicado' };

// Revisor / Copydesk — fila central de aprovação focada em texto antes da publicação.
export default function RevisorPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const queue = MOCK_CORP_APPROVAL_QUEUE;
  const articles = MOCK_CORP_ARTICLES.filter((a) => a.status === 'revisao' || a.status === 'rascunho');

  return (
    <RolePageShell roleId="revisor" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Fila central de aprovação" className="min-h-0">
            <div className="space-y-2">
              {queue.map((q) => (
                <div key={q.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{q.titulo}</p>
                    <p className="text-[11px] text-slate-500">{q.segmento} · {q.solicitante} · {q.tempo}</p>
                  </div>
                  <StatusBadge status={q.prioridade} map={TONE} labels={LABEL} />
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Matérias em revisão" className="min-h-0">
            <div className="space-y-2">
              {articles.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CheckCheck size={14} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{a.titulo}</p>
                      <p className="text-[11px] text-slate-500">{a.canal} · prazo {a.prazo}</p>
                    </div>
                  </div>
                  <StatusBadge status={a.status} map={ATONE} labels={ALABEL} />
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}