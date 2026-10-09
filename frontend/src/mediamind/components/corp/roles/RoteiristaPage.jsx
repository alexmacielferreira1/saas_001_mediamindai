import React, { useState } from 'react';
import { LayoutDashboard, ScrollText } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard } from './RoleShared';
import { MOCK_CORP_DRAFTS, MOCK_CORP_PAUTAS } from '../../../data';

// Roteirista — rascunhos e versionamento de roteiro (extensão de texto puro).
export default function RoteiristaPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const drafts = MOCK_CORP_DRAFTS;
  const pautas = MOCK_CORP_PAUTAS;

  return (
    <RolePageShell roleId="roteirista" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Rascunhos de roteiro" className="min-h-0">
            <div className="space-y-2">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <ScrollText size={14} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{d.titulo}</p>
                      <p className="text-[11px] text-slate-500">{d.programa} · {d.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Pautas" className="min-h-0">
            <div className="space-y-2">
              {pautas.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{p.titulo}</p>
                    <p className="text-[11px] text-slate-500">{p.canal}</p>
                  </div>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{p.status}</span>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}