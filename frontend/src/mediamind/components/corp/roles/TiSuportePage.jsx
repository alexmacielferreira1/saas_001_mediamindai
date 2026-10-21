import React, { useState } from 'react';
import { LayoutDashboard, ServerCog } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatusBadge } from './RoleShared';
import { MOCK_MONITORING } from '../../../data';

const TONE = { ok: 'bg-emerald-500/15 text-emerald-300', warning: 'bg-amber-500/15 text-amber-300', error: 'bg-rose-500/15 text-rose-300' };
const LABEL = { ok: 'OK', warning: 'Atenção', error: 'Falha' };

// TI / Suporte — monitoramento de serviços, integrações e recursos do sistema.
export default function TiSuportePage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const m = MOCK_MONITORING;

  return (
    <RolePageShell roleId="ti_suporte" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Serviços & integrações" className="min-h-0">
            <div className="space-y-2">
              {m.services.map((s) => (
                <div key={s.key} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <ServerCog size={14} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{s.label}</p>
                      <p className="text-[11px] text-slate-500">{s.detail}</p>
                    </div>
                  </div>
                  <StatusBadge status={s.status} map={TONE} labels={LABEL} />
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Recursos & storage" className="min-h-0">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-slate-500">CPU {m.resources.cpu_percent}% · GPU {m.resources.gpu_percent}%</p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-500" style={{ width: `${m.resources.cpu_percent}%` }} /></div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Storage {Math.round((m.storage.used_bytes / m.storage.total_bytes) * 100)}% usado</p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(m.storage.used_bytes / m.storage.total_bytes) * 100}%` }} /></div>
              </div>
            </div>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}