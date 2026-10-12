import { useSearchParams } from "react-router-dom";
import {
  BadgeDollarSign,
  Clapperboard,
  Frame,
  Images,
  Languages,
  Link2,
  MessageSquareText,
  Mic2,
  PanelsTopLeft,
  Radar,
  Scissors,
  Tv,
  Video,
  Box,
  Globe2,
  ImagePlus,
  WandSparkles,
} from "lucide-react";
import AIThumbnailStudio from "../components/ai-tools/AIThumbnailStudio";
import AnimatedStudio from "../components/ai-tools/AnimatedStudio";
import VoiceStudio from "../components/ai-tools/VoiceStudio";
import ChannelStudio from "../components/ai-tools/ChannelStudio";
import CarouselStudio from "../components/carousel/CarouselStudio";
import ExistingWorkflowTool from "../components/ai-tools/ExistingWorkflowTool";
import PromoVideoStudio from "../components/ai-tools/PromoVideoStudio";
import FramesStudio from "../components/ai-tools/FramesStudio";
import TrendStudio from "../components/ai-tools/TrendStudio";
import DubbingStudio from "../components/ai-tools/DubbingStudio";
import { AI_TOOLS, getAITool } from "../lib/aiToolsRegistry";
import GenerativeStudio from "../components/ai-tools/GenerativeStudio";

const TOOL_PRESENTATION = {
  "image-generator": { icon: ImagePlus, label: "Imagem IA" },
  "video-generator": { icon: WandSparkles, label: "Vídeo IA" },
  "object-generator": { icon: Box, label: "Objeto 3D" },
  "world-generator": { icon: Globe2, label: "Mundo 3D" },
  thumbnails: { icon: Images, label: "Thumbs IA" },
  carousel: { icon: PanelsTopLeft, label: "Carrossel" },
  "video-studio": { icon: Video, label: "Vídeo" },
  "voice-studio": { icon: Mic2, label: "Voz" },
  frames: { icon: Frame, label: "Molduras" },
  "ai-dubbing": { icon: Languages, label: "Dublagem" },
  "trend-radar": { icon: Radar, label: "Radar" },
  "auto-clips": { icon: Scissors, label: "Cortes" },
  "speech-montage": { icon: MessageSquareText, label: "Falas" },
  "sales-videos": { icon: BadgeDollarSign, label: "Vendas" },
  "affiliate-videos": { icon: Link2, label: "Afiliados" },
  "animated-videos": { icon: Clapperboard, label: "Animados" },
  "channel-studio": { icon: Tv, label: "Canais" },
};

export default function AITools() {
  const [params, setParams] = useSearchParams();
  const selected = getAITool(params.get("tool") || "thumbnails");
  const projectId = params.get("project_id");
  const changeTool = (toolId) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tool", toolId);
      return next;
    });
  return (
    <div className="space-y-3">
      <header className="border-b border-slate-800 px-1 pb-3">
        <h1 className="text-2xl font-black text-white">Ferramentas IA e Editoração</h1>
        <p className="mt-1 text-sm text-slate-400">
          Visão geral das principais ferramentas, fluxos e integração com projetos do sistema.
        </p>
      </header>
      <div
        role="tablist"
        aria-label="Ferramentas IA"
        className="flex overflow-x-auto rounded-xl border border-sky-900/80 bg-slate-950"
      >
        {AI_TOOLS.map((tool) => {
          const presentation = TOOL_PRESENTATION[tool.id] || {
            icon: Images,
            label: tool.label,
          };
          const ToolIcon = presentation.icon;
          return (
            <button
              role="tab"
              aria-label={tool.label}
              aria-selected={selected.id === tool.id}
              key={tool.id}
              onClick={() => changeTool(tool.id)}
              className={`flex min-w-20 shrink-0 flex-1 flex-col items-center gap-1 border-r border-sky-900/70 px-3 py-2 text-[11px] font-semibold transition last:border-r-0 ${selected.id === tool.id ? "bg-sky-500 text-slate-950" : "bg-slate-950 text-slate-300 hover:bg-sky-950/50 hover:text-white"}`}
            >
              <ToolIcon aria-hidden="true" size={17} strokeWidth={1.8} />
              <span>{presentation.label}</span>
            </button>
          );
        })}
      </div>
      <main className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        {["image-generator", "video-generator", "object-generator", "world-generator"].includes(selected.id) && <GenerativeStudio type={selected.id} />}
        {selected.id === "thumbnails" && <AIThumbnailStudio />}
        {selected.id === "carousel" && <CarouselStudio key={projectId || "local"} projectId={projectId} />}
        {selected.id === "animated-videos" && <AnimatedStudio />}
        {selected.id === "voice-studio" && <VoiceStudio />}
        {selected.id === "channel-studio" && <ChannelStudio />}
        {selected.id === "frames" && <FramesStudio />}
        {selected.id === "trend-radar" && <TrendStudio />}
        {selected.id === "ai-dubbing" && <DubbingStudio />}
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
