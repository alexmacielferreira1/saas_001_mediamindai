import React from 'react';
import { Plus, Youtube, Instagram, Linkedin } from 'lucide-react';
import { usePublicacoes } from '../../lib/corpPublicacoes';
import { StatusBadge, ListSkeleton, ErrorState } from '../shared';

const PLATFORM_ICON = { youtube: Youtube, tiktok: Instagram, instagram: Instagram, linkedin: Linkedin };

export default function CorpPublications() {
  const { pubs, loading, error, reload } = usePublicacoes();

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Publicações</p>
        <button className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400">
          <Plus size={11} /> Nova publicação
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <ErrorState onRetry={reload} description="Não foi possível carregar as publicações." />
        ) : pubs.length === 0 ? (
          <p className="px-3 py-8 text-center text-[11px] text-slate-500">Nenhuma publicação ainda.</p>
        ) : (
          pubs.map((p) => {
            const Icon = PLATFORM_ICON[p.plataforma] || Youtube;
            return (
              <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                <div className="flex items-start gap-2">
                  <Icon size={13} className="mt-0.5 shrink-0 text-sky-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">{p.titulo}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{p.descricao}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-500">{p.duracao} · {p.views} views</span>
                  <StatusBadge status={p.status} labels={{ publicado: 'Publicado', programado: 'Programado', rascunho: 'Rascunho', pending_review: 'Em revisão', aguardando_aprovacao: 'Aguardando aprovação' }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}