import VideoStudio from "../components/ai-tools/VideoStudio";

// VIDEO_ESTUDIO: somente o gerador independente.
// As 14 guias comerciais e a Central de Missões pertencem à Agência de Vídeo.
export default function VideoEstudio() {
  return (
    <main className="space-y-2" aria-label="VIDEO_ESTUDIO">
      <nav className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1" role="tablist" aria-label="Guias do VIDEO_ESTUDIO">
        <span id="video-estudio-tab-geracao" role="tab" aria-selected="true"
          aria-controls="video-estudio-panel-geracao"
          className="rounded-md bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-200 ring-1 ring-sky-500/40">
          Geração de vídeo
        </span>
      </nav>
      <section id="video-estudio-panel-geracao" role="tabpanel" aria-labelledby="video-estudio-tab-geracao">
        <VideoStudio />
      </section>
    </main>
  );
}
