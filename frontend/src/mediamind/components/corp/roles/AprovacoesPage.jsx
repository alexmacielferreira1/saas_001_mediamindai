import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useProducaoProjetos, setEtapa, moverEtapa } from '../../../lib/producaoStore';
import { StageDragArea, DraggableStageCard } from '../StageDragList';
import AprovacaoReviewPanel from './AprovacaoReviewPanel';

// Em aprovação: lista de projetos em "em_aprovacao" + player de conferência ao lado.
// Marcações/ajustes salvos vão pro editor (em_edicao); aprovar avança p/ finalizado.
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
    <div className="grid h-full gap-4 lg:grid-cols-5">
      <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-2">
        <div className="border-b border-slate-800 p-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            <CheckCircle2 size={14} className="text-emerald-400" /> Em aprovação
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{emAprov.length} projeto(s) aguardando conferência</p>
        </div>
        <StageDragArea onMove={moverEtapa} className="flex-1 min-h-0">
          <div className="h-full overflow-y-auto p-2">
            {emAprov.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] text-slate-500">Nenhum projeto em aprovação.</p>
            ) : (
              emAprov.map((p) => (
                <DraggableStageCard key={p.id} id={p.id} etapa={p.etapa} onClick={() => setSelId(p.id)} className={`mb-1.5 w-full rounded-lg border px-3 py-2 text-left transition ${sel?.id === p.id ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 hover:bg-slate-800/30'}`}>
                  <p className="truncate text-xs font-medium text-slate-200">{p.titulo}</p>
                  <p className="truncate text-[10px] text-slate-500">{p.programa} · {p.episodio}</p>
                  <p className="mt-1 text-[10px] text-slate-500">resp. {p.responsavel || '—'}</p>
                </DraggableStageCard>
              ))
            )}
          </div>
        </StageDragArea>
      </div>

      <div className="lg:col-span-3">
        {sel ? (
          <AprovacaoReviewPanel
            key={sel.id}
            project={sel}
            onEnviarEditor={(id) => { setEtapa(id, 'em_edicao'); afterAction(id); }}
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