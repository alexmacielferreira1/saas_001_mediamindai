import React, { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatusBadge } from './RoleShared';
import { MOCK_CORP_RELEASES } from '../../../data';

const TONE = { publicado: 'bg-emerald-500/15 text-emerald-300', rascunho: 'bg-slate-500/15 text-slate-300', agendado: 'bg-amber-500/15 text-amber-300' };
const LABEL = { publicado: 'Publicado', rascunho: 'Rascunho', agendado: 'Agendado' };

// Jurídico / Compliance — liberação de releases, direitos (DireitoAsset) e embargos.
export default function JuridicoPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const releases = MOCK_CORP_RELEASES;

  return (
    <RolePageShell roleId="juridico" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Releases em liberação" className="min-h-0">
            <div className="space-y-2">
              {releases.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{r.titulo}</p>
                    <p className="text-[11px] text-slate-500">{r.veiculos} veículos · {r.data}</p>
                  </div>
                  <StatusBadge status={r.status} map={TONE} labels={LABEL} />
                </div>
              ))}
            </div>
          </CorpPanel>

          <CorpPanel title="Direitos & embargos (DireitoAsset)" className="min-h-0">
            <p className="py-6 text-center text-sm text-slate-500">Gestão de vigências, restrições e embargos é feita pela entidade DireitoAsset no acervo.</p>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}