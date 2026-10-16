import { useSearchParams } from "react-router-dom";
import { Clapperboard, Layers3 } from "lucide-react";
import VideoStudio from "../components/ai-tools/VideoStudio";

// Página contêiner do VIDEO_ESTUDIO.
// As futuras guias serão adicionadas aqui quando seus nomes e funções forem definidos.
// O componente compartilhado VideoStudio permanece na rota original /geracao-de-video.
const TABS = [
  { id: "geracao-de-video", label: "Geração de vídeo", Component: VideoStudio },
];

export default function VideoEstudio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("guia");
  const selectedTab = TABS.find((tab) => tab.id === requestedTab) ?? TABS[0];
  const ActiveTab = selectedTab.Component;

  const selectTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("guia", id);
    setSearchParams(next);
  };

  return (
    <main className="space-y-3" aria-label="VIDEO_ESTUDIO">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-900/70 bg-slate-950/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-slate-950">
            <Clapperboard size={19} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-400">MediaMindAI · Produção audiovisual</p>
            <h1 className="text-xl font-black text-white">VIDEO_ESTUDIO</h1>
          </div>
        </div>
        <span className="flex items-center gap-2 text-xs text-slate-400">
          <Layers3 size={14} aria-hidden="true" /> Área de produção por guias
        </span>
      </header>
      <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1.5" role="tablist" aria-label="Etapas de produção do VIDEO_ESTUDIO">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`video-estudio-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selectedTab.id === tab.id}
            aria-controls="video-estudio-panel"
            onClick={() => selectTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
              selectedTab.id === tab.id
                ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/50"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <section
        id="video-estudio-panel"
        role="tabpanel"
        aria-labelledby={`video-estudio-tab-${selectedTab.id}`}
      >
        <ActiveTab />
      </section>
    </main>
  );
}
