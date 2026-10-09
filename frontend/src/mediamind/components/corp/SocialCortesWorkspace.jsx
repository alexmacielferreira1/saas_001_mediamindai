import React, { useState, useEffect } from 'react';
import { Film, Sparkles } from 'lucide-react';
import { newClip, seedClips, STAGE_LABEL } from './recortes/clipModel';
import ClipWorkspace from './recortes/ClipWorkspace';
import NewClipDialog from './recortes/NewClipDialog';
import { timecodeToMs } from '../../lib/mediaHandoff';

const STAGE_BADGE = {
  selecao: 'bg-slate-500/15 text-slate-300',
  ia: 'bg-violet-500/15 text-violet-300',
  legendas: 'bg-sky-500/15 text-sky-300',
  cg: 'bg-amber-500/15 text-amber-300',
  reimport: 'bg-emerald-500/15 text-emerald-300',
  formatos: 'bg-cyan-500/15 text-cyan-300',
};

// Blend perfeito: o workspace de cortes no estilo Opus Clip (recortes + player
// IN/OUT + IA + legendas + CG + reimportação) convive com o painel de versões
// publicadas em redes sociais. Cada recorte vira uma versão candidata; o que
// já existia de "Cortes e versões" na central social mora agora à direita,
// conectado ao recorte em edição.
export default function SocialCortesWorkspace({ onProsseguir, newClipSignal = 0, preselectedAssetId = '', incomingMedia = null }) {
  const [clips, setClips] = useState(() => seedClips());
  const [selId, setSelId] = useState(clips[0]?.id);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const sel = clips.find((c) => c.id === selId) || clips[0];

  function novo() { setNewDialogOpen(true); }
  function patchClip(p) { setClips((cs) => cs.map((c) => (c.id === sel.id ? { ...c, ...p } : c))); }

  // Sinal do botão "Novo" (/social?novo=publicacao): abre o dialog de novo corte.
  useEffect(() => {
    if (newClipSignal > 0) setNewDialogOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newClipSignal]);

  // Pré-seleção de asset (vinda do Acervo/Workspace via /social?asset=<id>).
  useEffect(() => {
    if (preselectedAssetId) setNewDialogOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedAssetId]);

  useEffect(() => {
    if (!incomingMedia) return;
    const transferred = {
      ...newClip({ titulo: incomingMedia.titulo }),
      id: incomingMedia.id,
      source_id: incomingMedia.sourceId,
      in_label: incomingMedia.inPoint,
      out_label: incomingMedia.outPoint,
      in_ms: timecodeToMs(incomingMedia.inPoint),
      out_ms: timecodeToMs(incomingMedia.outPoint),
      programa: incomingMedia.programa,
      episodio: incomingMedia.episodio,
    };
    setClips((current) => current.some((clip) => clip.id === transferred.id) ? current : [transferred, ...current]);
    setSelId(transferred.id);
  }, [incomingMedia]);

  function onCreated(recorte) {
    setClips((p) => [recorte, ...p]);
    setSelId(recorte.id);
  }

  return (
    <div className="grid h-full gap-3 lg:grid-cols-6">
      {/* Lista de recortes (Opus Clip) */}
      <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 lg:col-span-1">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Recortes</p>
          <button onClick={novo} className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"><Sparkles size={11} /> Novo corte</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {clips.length === 0 && <p className="py-8 text-center text-[11px] text-slate-500">Nenhum recorte.</p>}
          {clips.map((c) => (
            <button key={c.id} onClick={() => setSelId(c.id)} className={`mb-1.5 w-full rounded-lg border px-3 py-2 text-left transition ${selId === c.id ? 'border-sky-600 bg-sky-950/30' : 'border-slate-800 hover:bg-slate-800/30'}`}>
              <p className="truncate text-xs font-medium text-slate-200">{c.titulo}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${STAGE_BADGE[c.stage]}`}>{STAGE_LABEL[c.stage]}</span>
                {c.salvo && <span className="text-[9px] text-emerald-300">salvo</span>}
                {c.pronto && <span className="text-[9px] text-emerald-300">pronto</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Workspace Opus Clip (player IN/OUT, IA, legendas, CG, reimport) */}
      <div className="min-h-0 lg:col-span-5">
        {sel ? (
          <ClipWorkspace clip={sel} onChange={patchClip} onProsseguir={onProsseguir} onOpenNewClip={() => setNewDialogOpen(true)} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-sm text-slate-500">
            <div className="text-center"><Film size={22} className="mx-auto mb-2 text-slate-600" />Crie um recorte pra começar o corte no estilo Opus Clip.</div>
          </div>
        )}
      </div>

      <NewClipDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onCreated={onCreated}
        preselectedAssetId={preselectedAssetId}
      />
    </div>
  );
}
