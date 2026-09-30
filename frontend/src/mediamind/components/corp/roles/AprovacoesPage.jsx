import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useProducaoProjetos, setEtapa, moverEtapa, transicionar } from '../../../lib/producaoStore';
import { StageDragArea, DraggableStageCard } from '../StageDragList';
import AprovacaoReviewPanel from './AprovacaoReviewPanel';

// Em revisão: lista de projetos em "em_aprovacao" + player de conferência ao lado.
// Marcações/ajustes salvos vão para Alteração; aprovar avança para Finalizado.
export default function AprovacoesPage() {
  const projetos = useProducaoProjetos();
  const emAprov = projetos.filter((p) => p.etapa === 'em_aprovacao');
  const [selId, setSelId] = useState(emAprov[0]?.id ?? null);
  const sel = emAprov.find((p) => p.id === selId) || emAprov[0] || null;

  function afterAction(id) {
    const next = emAprov.find((p) => p.id !== id);
    setSelId(next?.id ?? null);
  }

  return (
    <div className="grid h-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/35 lg:grid-cols-[minmax(290px,30%)_1fr]">
      <div className="flex h-full min-h-0 flex-col border-b border-slate-800 bg-slate-950/20 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-800 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">Revisão da produção</p>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            <CheckCircle2 size={14} className="text-emerald-400" /> Em revisão
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{emAprov.length} projeto(s) aguardando conferência</p>
        </div>
        <StageDragArea onMove={moverEtapa} className="flex-1 min-h-0">
          <div className="h-full divide-y divide-slate-800 overflow-y-auto">
            {emAprov.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] text-slate-500">Nenhum projeto em revisão.</p>
            ) : (
              emAprov.map((p) => (
                <DraggableStageCard key={p.id} id={p.id} etapa={p.etapa} onClick={() => setSelId(p.id)} className={`w-full border-l-2 px-4 py-3 text-left transition-colors ${sel?.id === p.id ? 'border-l-sky-400 bg-sky-950/35' : 'border-l-transparent hover:bg-slate-900/60'}`}>
                  <p className="truncate text-xs font-medium text-slate-200">{p.titulo}</p>
                  <p className="truncate text-[10px] text-slate-500">{p.programa} · {p.episodio}</p>
                  <p className="mt-1 text-[10px] text-slate-500">resp. {p.responsavel || '—'}</p>
                </DraggableStageCard>
              ))
            )}
          </div>
        </StageDragArea>
      </div>

      <div className="min-h-0">
        {sel ? (
          <AprovacaoReviewPanel
            key={sel.id}
            project={sel}
            onEnviarEditor={(id) => { transicionar(id, 'aguardando_aprovacao', { obs: 'Revisão devolvida com alterações solicitadas' }); afterAction(id); }}
            onAprovar={(id) => { setEtapa(id, 'finalizado'); afterAction(id); }}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-center text-sm text-slate-500">
            Selecione um projeto na lista para conferir o vídeo/arte, marcar ajustes ou aprovar.
          </div>
        )}
      </div>
    </div>
  );
}
