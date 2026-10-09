import React, { useState } from 'react';
import { LayoutDashboard, Languages } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard } from './RoleShared';
import { usePublicacoes } from '../../../lib/corpPublicacoes';
import { PUBLICATION_PLATFORM_LABELS } from '../../../data';
import { ListSkeleton, EmptyState, ErrorState } from '../../shared';

// Tradutor / Localização — legendas e versões multilíngues das publicações.
export default function TradutorPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const { pubs, loading, error, reload } = usePublicacoes();

  return (
    <RolePageShell roleId="tradutor" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <CorpPanel title="Publicações para legendar / traduzir" className="min-h-0">
          {loading ? (
            <ListSkeleton rows={4} />
          ) : error ? (
            <ErrorState onRetry={reload} description="Não foi possível carregar as publicações." />
          ) : pubs.length === 0 ? (
            <EmptyState icon={Languages} title="Sem publicações" description="As publicações a legendar aparecem aqui." />
          ) : (
            <div className="space-y-2">
              {pubs.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Languages size={14} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{p.titulo}</p>
                      <p className="text-[11px] text-slate-500">{PUBLICATION_PLATFORM_LABELS[p.plataforma]} · {p.status}</p>
                    </div>
                  </div>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{p.views} views</span>
                </div>
              ))}
            </div>
          )}
        </CorpPanel>
      </div>
    </RolePageShell>
  );
}