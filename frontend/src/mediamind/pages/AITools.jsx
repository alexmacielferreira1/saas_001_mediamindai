import { useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import AIThumbnailStudio from "../components/ai-tools/AIThumbnailStudio";
import AnimatedStudio from "../components/ai-tools/AnimatedStudio";
import VoiceStudio from "../components/ai-tools/VoiceStudio";
import ChannelStudio from "../components/ai-tools/ChannelStudio";
import CarouselStudio from "../components/carousel/CarouselStudio";
import ExistingWorkflowTool from "../components/ai-tools/ExistingWorkflowTool";
import PromoVideoStudio from "../components/ai-tools/PromoVideoStudio";
import { AI_TOOLS, getAITool } from "../lib/aiToolsRegistry";

export default function AITools() {
  const [params, setParams] = useSearchParams();
  const selected = getAITool(params.get("tool") || "carousel");
  const projectId = params.get("project_id");
  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/60 p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-sky-500/15 p-3 text-sky-300">
            <Sparkles />
          </span>
          <div>
            <h1 className="text-3xl font-black text-white">Ferramentas IA</h1>
            <p className="text-sm text-slate-400">
              Criação assistida conectada aos projetos, acervo e fluxo
              editorial.
            </p>
          </div>
        </div>
      </header>
      <div
        role="tablist"
        aria-label="Ferramentas IA"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {AI_TOOLS.map((tool) => (
          <button
            role="tab"
            aria-selected={selected.id === tool.id}
            key={tool.id}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set("tool", tool.id);
                return next;
              })
            }
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold ${selected.id === tool.id ? "border-sky-400 bg-sky-500 text-slate-950" : "border-slate-800 bg-slate-900 text-slate-300"}`}
          >
            {tool.label}
            {tool.status === "planned" ? " · em breve" : ""}
          </button>
        ))}
      </div>
      <main className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        {selected.id === "carousel" && (
          <CarouselStudio key={projectId || "local"} projectId={projectId} />
        )}
        {selected.id === "thumbnails" && <AIThumbnailStudio />}
        {selected.id === "animated-videos" && <AnimatedStudio />}
        {selected.id === "voice-studio" && <VoiceStudio />}
        {selected.id === "channel-studio" && <ChannelStudio />}
        {selected.status === "integrated" && (
          <ExistingWorkflowTool key={selected.id} toolId={selected.id} />
        )}
        {selected.id === "sales-videos" && <PromoVideoStudio key="sales" />}
        {selected.id === "affiliate-videos" && (
          <PromoVideoStudio key="affiliate" affiliate />
        )}
        {selected.status === "planned" && (
          <div className="py-16 text-center">
            <h2 className="text-2xl font-bold text-white">{selected.label}</h2>
            <p className="mx-auto mt-2 max-w-xl text-slate-400">
              {selected.description}
            </p>
            <span className="mt-6 inline-flex rounded-full border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
              Implementação programada
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
