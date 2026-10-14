import { useEffect, useMemo, useState } from "react";
import { Clapperboard, Clock3, Film, Play, Scissors, Sparkles, Upload, WandSparkles } from "lucide-react";
import { uploadMediaAsset } from "../../api/media";
import { startClipAnalysis } from "../../api/clips";
import { getAIConnections } from "../../api/generation";
import { useWorkDraftState } from "../lib/workProtection";
import { useProducaoProjetos } from "../lib/producaoStore";
import ClipWorkspace from "../components/corp/recortes/ClipWorkspace";
import { newClip } from "../components/corp/recortes/clipModel";

const EMPTY_SESSION = {
  sourceName: "",
  sourceUrl: "",
  duration: 0,
  format: "9:16",
  minimum: 20,
  maximum: 60,
  prompt: "Encontre trechos claros, completos e interessantes para vídeo curto.",
  suggestions: [],
  selectedSuggestionId: "",
  sourceProject: null,
  workspaceClip: null,
  sourceAssetId: "",
  analysisStatus: "",
  analysisMessage: "",
  analysisConnectionId: "",
};

function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function mediaUrlFromProject(project) {
  const direct = [project?.final_url, project?.edited_url, project?.source_url, project?.stream_url, project?.url].find(Boolean);
  if (direct) return direct;
  const media = Array.isArray(project?.materiais) ? project.materiais : [];
  return media.map((item) => item?.final_url || item?.edited_url || item?.source_url || item?.stream_url || item?.url).find(Boolean) || "";
}

function projectLabel(project) {
  return [project?.episodio, project?.titulo].filter(Boolean).join(" · ") || project?.programa || "Produção finalizada";
}

export default function ClipsFree() {
  const [savedSession, setSession] = useWorkDraftState("clipsfree-session", EMPTY_SESSION);
  const session = { ...EMPTY_SESSION, ...savedSession };
  const projetos = useProducaoProjetos();
  const [sourceFile, setSourceFile] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [connections, setConnections] = useState([]);
  const finalizados = useMemo(() => projetos.filter((project) => project.etapa === "finalizado"), [projetos]);
  const selected = useMemo(
    () => session.suggestions.find((item) => item.id === session.selectedSuggestionId) || session.suggestions[0],
    [session.selectedSuggestionId, session.suggestions],
  );

  useEffect(() => {
    let active = true;
    getAIConnections()
      .then((result) => {
        if (!active) return;
        const available = (result.connections || []).filter((connection) => connection.enabled && connection.key_configured);
        setConnections(available);
        if (!session.analysisConnectionId && available[0]?.id) update({ analysisConnectionId: available[0].id });
      })
      .catch(() => { if (active) setConnections([]); });
    return () => { active = false; };
  }, []);

  function update(patch) {
    setSession((current) => ({ ...current, ...patch }));
  }

  function chooseSource(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    update({
      sourceName: file.name,
      sourceUrl: URL.createObjectURL(file),
      duration: 0,
      suggestions: [],
      selectedSuggestionId: "",
      workspaceClip: null,
      sourceAssetId: "",
      analysisStatus: "",
      analysisMessage: "",
    });
    setSourceFile(file);
    event.target.value = "";
  }

  async function generateSuggestions() {
    if (!sourceFile || analysing) return;
    setAnalysing(true);
    update({ analysisStatus: "processing", analysisMessage: "Enviando mídia para análise real.", suggestions: [], selectedSuggestionId: "" });
    try {
      const asset = session.sourceAssetId ? { id: session.sourceAssetId } : await uploadMediaAsset(sourceFile, { origin: "clipsfree" });
      const analysis = await startClipAnalysis(asset.id, session.analysisConnectionId || null);
      const suggestions = (analysis.candidates || []).map((candidate) => ({
        id: candidate.id,
        title: candidate.quote || "Trecho analisado",
        start: candidate.start,
        end: candidate.end,
        score: candidate.score,
        notes: candidate.rationale || "Evidência retirada da transcrição.",
      }));
      update({
        sourceAssetId: asset.id,
        analysisStatus: analysis.status,
        analysisMessage: analysis.message || "Análise concluída.",
        suggestions,
        selectedSuggestionId: suggestions[0]?.id || "",
      });
    } catch (error) {
      update({ analysisStatus: "failed", analysisMessage: error?.message || "Não foi possível analisar esta mídia.", suggestions: [] });
    } finally {
      setAnalysing(false);
    }
  }

  function updateSelected(patch) {
    if (!selected) return;
    update({
      suggestions: session.suggestions.map((item) => item.id === selected.id ? { ...item, ...patch } : item),
    });
  }

  function chooseFinishedProject(project) {
    const sourceUrl = mediaUrlFromProject(project);
    update({
      sourceProject: { id: project.id, label: projectLabel(project), hasLinkedMaster: Boolean(sourceUrl) },
      ...(sourceUrl ? { sourceName: projectLabel(project), sourceUrl, duration: 0, suggestions: [], selectedSuggestionId: "", workspaceClip: null } : {}),
    });
  }

  function openEditor(item) {
    const clip = newClip({ titulo: item.title, source_url: session.sourceUrl });
    update({
      selectedSuggestionId: item.id,
      workspaceClip: {
        ...clip,
        id: `clipsfree-${item.id}`,
        in_ms: Math.round(item.start * 1000),
        out_ms: Math.round(item.end * 1000),
        duration_ms: Math.round((session.duration || item.end) * 1000),
        formato: session.format,
        source_project_id: session.sourceProject?.id || null,
      },
    });
  }

  function updateWorkspace(patch) {
    update({ workspaceClip: { ...session.workspaceClip, ...patch } });
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-300"><Scissors size={14} /> Cortes inteligentes</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">CLIPSFREE</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Transforme um vídeo em uma sessão de cortes: assista, defina o formato, selecione trechos e mantenha o rascunho neste navegador.</p>
        </div>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200">Sessão local protegida</span>
      </header>

      <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_360px]">
        <aside className="order-2 rounded-2xl border border-slate-800 bg-slate-950/60 xl:order-none">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100"><Film size={16} className="text-violet-300" /> Mídias finalizadas</h2>
            <p className="mt-1 text-xs text-slate-500">Produções aprovadas disponíveis para novos cortes.</p>
          </div>
          <div className="max-h-[430px] divide-y divide-slate-800 overflow-y-auto">
            {finalizados.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-500">Nenhuma produção finalizada disponível nesta empresa.</p>}
            {finalizados.map((project) => {
              const chosen = session.sourceProject?.id === project.id;
              const linked = Boolean(mediaUrlFromProject(project));
              return <button key={project.id} type="button" onClick={() => chooseFinishedProject(project)} className={`w-full border-l-2 px-4 py-3 text-left transition ${chosen ? "border-violet-400 bg-violet-500/10" : "border-l-transparent hover:bg-slate-900"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-300">{project.episodio || "FINALIZADO"} · {project.programa || "Produção"}</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{project.titulo || "Sem título"}</p>
                <p className={`mt-1 text-[11px] ${linked ? "text-emerald-300" : "text-slate-500"}`}>{linked ? "Master vinculado" : "Master a vincular"}</p>
              </button>;
            })}
          </div>
          {session.sourceProject && !session.sourceProject.hasLinkedMaster && <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-200">O master ainda não foi vinculado a esta produção. Selecione o arquivo abaixo para editar localmente; ele ficará associado a este corte.</div>}
        </aside>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100"><Film size={16} className="text-violet-300" /> Vídeo de origem</h2>
            {session.sourceName && <span className="max-w-[60%] truncate text-xs text-slate-400">{session.sourceName}</span>}
          </div>
          {session.sourceUrl ? (
            <div className="bg-black p-3">
              <video aria-label="Prévia do vídeo de origem" src={session.sourceUrl} controls className="max-h-[480px] min-h-64 w-full rounded-xl bg-black" onLoadedMetadata={(event) => update({ duration: event.currentTarget.duration })} />
            </div>
          ) : (
            <label className="flex min-h-80 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-700 bg-slate-950/40 px-6 text-center transition hover:border-violet-400 hover:bg-violet-500/5">
              <Upload size={34} className="text-violet-300" />
              <span className="font-semibold text-slate-200">Escolha o vídeo que será cortado</span>
              <span className="text-sm text-slate-500">MP4, MOV ou WebM. O arquivo permanece no seu navegador até você decidir enviá-lo ao fluxo de cortes.</span>
              <span className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-bold text-slate-950">Selecionar vídeo</span>
              <input aria-label="Selecionar vídeo" type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={chooseSource} />
            </label>
          )}
          {session.sourceUrl && <label className="flex cursor-pointer items-center gap-2 border-t border-slate-800 px-4 py-3 text-sm font-semibold text-violet-200 hover:bg-slate-900"><Upload size={15} /> Trocar vídeo<input aria-label="Trocar vídeo" type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={chooseSource} /></label>}
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100"><WandSparkles size={16} className="text-violet-300" /> Configurar sessão</h2>
          <div className="mt-4 space-y-4">
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formato de destino</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {["9:16", "1:1", "16:9"].map((format) => <button key={format} type="button" aria-pressed={session.format === format} onClick={() => update({ format })} className={`rounded-lg border px-2 py-2 text-sm font-bold ${session.format === format ? "border-violet-400 bg-violet-500 text-slate-950" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>{format}</button>)}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-400">Mínimo (s)<input aria-label="Duração mínima" type="number" min="5" value={session.minimum} onChange={(event) => update({ minimum: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
              <label className="text-xs font-semibold text-slate-400">Máximo (s)<input aria-label="Duração máxima" type="number" min="5" value={session.maximum} onChange={(event) => update({ maximum: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
            </div>
            <label className="block text-xs font-semibold text-slate-400">Orientação editorial<textarea aria-label="Orientação editorial" value={session.prompt} onChange={(event) => update({ prompt: event.target.value })} rows="4" className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
            <label className="block text-xs font-semibold text-slate-400">IA para analisar e legendar
              <select aria-label="IA para analisar e legendar" value={session.analysisConnectionId} onChange={(event) => update({ analysisConnectionId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white outline-none focus:border-violet-400">
                {connections.length === 0 && <option value="">Nenhuma IA com créditos configurada</option>}
                {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.model}</option>)}
              </select>
            </label>
            <button type="button" disabled={!session.sourceUrl || analysing} onClick={generateSuggestions} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-400 px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={16} /> {analysing ? "Analisando..." : "Gerar sugestões"}</button>
            <p className="text-xs leading-relaxed text-slate-500">As sugestões só aparecem após transcrição e análise reais. O sistema nunca cria notas ou trechos demonstrativos para um envio.</p>
            {session.analysisMessage && <p role="status" className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${session.analysisStatus === "completed" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : session.analysisStatus === "failed" ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>{session.analysisMessage}</p>}
          </div>
        </aside>
      </div>

      {session.suggestions.length > 0 && <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black text-white">Sugestões de cortes</h2><p className="text-sm text-slate-400">Revise o trecho e abra o escolhido no editor local.</p></div>
          <span className="flex items-center gap-1 text-xs text-slate-400"><Clock3 size={14} /> Origem: {session.duration ? formatTime(session.duration) : "duração será lida pelo player"}</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {session.suggestions.map((item) => <article key={item.id} className={`rounded-xl border p-3 ${selected?.id === item.id ? "border-violet-400 bg-violet-500/10" : "border-slate-800 bg-slate-900/50"}`}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-100">{item.title}</p><p className="mt-1 text-xs text-slate-400">{formatTime(item.start)} — {formatTime(item.end)} · {session.format}</p></div><span className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-bold text-emerald-300">{item.score}%</span></div>
            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.notes}</p>
            <button type="button" onClick={() => openEditor(item)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-violet-400 hover:bg-slate-800"><Play size={14} /> Abrir no editor</button>
          </article>)}
        </div>
      </section>}

      {selected && !session.workspaceClip && <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
        <div className="flex items-center gap-2"><Clapperboard size={18} className="text-violet-300" /><h2 className="text-lg font-black text-white">Editor local do corte</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_140px]">
          <label className="text-xs font-semibold text-slate-400">Título do corte<input aria-label="Título do corte" value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
          <label className="text-xs font-semibold text-slate-400">Entrada (s)<input aria-label="Entrada do corte" type="number" min="0" value={selected.start} onChange={(event) => updateSelected({ start: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
          <label className="text-xs font-semibold text-slate-400">Saída (s)<input aria-label="Saída do corte" type="number" min="0" value={selected.end} onChange={(event) => updateSelected({ end: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
        </div>
        <p className="mt-3 text-xs text-slate-400">O recorte está salvo como rascunho local. A integração dele com a fila de cortes será adicionada depois desta validação independente.</p>
      </section>}

      {session.workspaceClip && <section className="rounded-2xl border border-violet-500/30 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300">Corte em edição</p><h2 className="text-lg font-black text-white">{session.workspaceClip.titulo}</h2></div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">Rascunho salvo automaticamente</span>
        </div>
        <ClipWorkspace clip={session.workspaceClip} onChange={updateWorkspace} onProsseguir={() => updateWorkspace({ pronto: true })} />
      </section>}
    </div>
  );
}
