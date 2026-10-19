import { Clapperboard, Sparkles } from "lucide-react";
import VideoStudio from "../components/ai-tools/VideoStudio";

/**
 * Área dedicada ao pipeline de pré-produção e geração de vídeo.
 * O estúdio também continua acessível em Ferramentas IA para links antigos.
 */
export default function VideoGeneration({
  initialDraft = null,
  onDraftChange = null,
  workspaceKey = null,
  productLabel = "MediaMind · produção audiovisual com IA",
  embedded = false,
} = {}) {
  return (
    <div className={embedded ? "space-y-3" : "space-y-4"} aria-label="Geração de vídeo">
      {!embedded && <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-sky-900/70 bg-slate-950/70 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-slate-950">
            <Clapperboard size={21} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-400">Estúdio de IA</p>
            <h1 className="mt-0.5 text-2xl font-black text-white">Geração de vídeo</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Transforme uma ideia em roteiro, cenas, storyboard e prompts prontos para produção.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
          <Sparkles size={14} aria-hidden="true" />
          Pipeline de 8 etapas
        </span>
      </header>}
      {embedded && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-900/60 bg-slate-950/60 px-4 py-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-400">Pipeline audiovisual</p><p className="mt-1 text-sm text-slate-400">Roteiro, cenas, storyboard, geração e exportação vinculados ao rascunho do canal.</p></div>
        <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200">8 etapas · rascunho protegido</span>
      </div>}
      <VideoStudio initialDraft={initialDraft} onDraftChange={onDraftChange} workspaceKey={workspaceKey} productLabel={productLabel} />
    </div>
  );
}
