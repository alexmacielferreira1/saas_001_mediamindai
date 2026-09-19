import React, { useState } from 'react';
import { LayoutDashboard, Frame } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard } from './RoleShared';
import { MOCK_CORP_RECORDINGS } from '../../../data';

// Cenógrafo / Set Designer — planejamento de cenário e equipamentos por gravação.
export default function CenografoPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const recs = MOCK_CORP_RECORDINGS;
  const estudios = [...new Set(recs.map((r) => r.estudio))];

  return (
    <RolePageShell roleId="cenografo" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Sets por gravação" className="min-h-0">
            <div className="space-y-2">
              {recs.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">{r.episodio} — {r.estudio}</p>
                    <Frame size={14} className="text-slate-500" />
                  </div>
                  <p className="text-[11px] text-slate-500">{r.data} · {r.horario} · {r.equipamentos}</p>
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Equipamentos" className="min-h-0">
            <div className="space-y-2">
              {estudios.map((est) => (
                <div key={est} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <p className="text-sm font-medium text-slate-200">{est}</p>
                  <p className="text-[11px] text-slate-500">{recs.find((r) => r.estudio === est)?.equipamentos || '—'}</p>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}