import React, { useState } from 'react';
import { LayoutDashboard, Volume2 } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { MOCK_CORP_RECORDINGS } from '../../../data';

// Locutor / Voice-over — agenda de locuções, briefing e playback para conferência.
export default function LocutorPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const recs = MOCK_CORP_RECORDINGS;

  return (
    <RolePageShell roleId="locutor" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Locuções" className="min-h-0">
            <div className="space-y-2">
              {recs.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{r.episodio} — {r.titulo}</p>
                    <p className="text-[11px] text-slate-500">{r.data} · {r.horario} · {r.estudio}</p>
                  </div>
                  <Volume2 size={14} className="text-slate-500" />
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Playback para conferência" className="min-h-0">
            <p className="py-6 text-center text-sm text-slate-500">Use o Workspace para conferir o áudio antes do envio à edição.</p>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}