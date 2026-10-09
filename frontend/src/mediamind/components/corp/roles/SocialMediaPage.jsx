import React, { useState } from 'react';
import { LayoutDashboard, Share2 } from 'lucide-react';
import RolePageShell from './RolePageShell';
import CorpPanel from '../CorpPanel';
import { StatCard } from './RoleShared';
import { usePublicacoes } from '../../../lib/corpPublicacoes';
import { MOCK_SOCIAL_METRICS, PUBLICATION_PLATFORM_LABELS } from '../../../data';
import { ListSkeleton, EmptyState, ErrorState } from '../../shared';

// Social Media — gestão dedicada das publicações e métricas por plataforma.
export default function SocialMediaPage() {
  const [sub, setSub] = useState('overview');
  const ownTabs = [{ id: 'overview', name: 'Visão geral', Icon: LayoutDashboard }];
  const { pubs, loading, error, reload } = usePublicacoes();
  const metrics = MOCK_SOCIAL_METRICS;

  return (
    <RolePageShell roleId="social_media" ownSubtabs={ownTabs} active={sub} onChange={setSub}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto">
        <div className="grid gap-4 lg:grid-cols-2">
          <CorpPanel title="Publicações" className="min-h-0">
            {loading ? (
              <ListSkeleton rows={4} />
            ) : error ? (
              <ErrorState onRetry={reload} description="Não foi possível carregar as publicações." />
            ) : pubs.length === 0 ? (
              <EmptyState icon={Share2} title="Sem publicações" description="As publicações aparecem aqui." />
            ) : (
              <div className="space-y-2">
                {pubs.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Share2 size={14} className="text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{p.titulo}</p>
                        <p className="text-[11px] text-slate-500">{PUBLICATION_PLATFORM_LABELS[p.plataforma]} · {p.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CorpPanel>

          <CorpPanel title="Métricas por plataforma" className="min-h-0">
            <div className="space-y-2">
              {metrics.map((m, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{m.platform}</p>
                    <p className="text-[11px] text-slate-500">{m.followers} seguidores · {m.engagement} engaj.</p>
                  </div>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">{m.views} views</span>
                </div>
              ))}
            </div>
          </CorpPanel>
        </div>
      </div>
    </RolePageShell>
  );
}