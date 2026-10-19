import { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Clock3, Download, Film, Link2, Play, Plus, Scissors, Sparkles, Upload, WandSparkles, X } from "lucide-react";
import { uploadMediaAsset } from "../../api/media";
import { startClipAnalysis } from "../../api/clips";
import { downloadClipFcpxml } from "../lib/clipsfreeExport";
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

function makeExamples(sourceDuration) {
  const duration = Math.max(1, Number(sourceDuration) || 60);
  return [88, 79, 71].map((score, index) => {
    const start = Math.min(duration * index / 3, Math.max(0, duration - 1));
    return { id: `exemplo-${index}`, title: `Corte de exemplo ${index + 1}`, start, end: Math.min(duration, start + Math.max(1, duration / 3)), score, notes: "Nota ilustrativa, sem análise de IA.", captions: [], example: true };
  });
}

export default function ClipsFree({ darkChannelId = "", darkScriptId = "", workspaceKey = "", initialTitle = "", onDraftChange = null } = {}) {
  const darkChannelMode = Boolean(darkChannelId);
  const draftKey = workspaceKey ? `${workspaceKey}:session` : "clipsfree-session";
  const [savedSession, setSession] = useWorkDraftState(draftKey, EMPTY_SESSION);
  const draftChangeHandler = useRef(onDraftChange);
  const firstDraftRender = useRef(true);
  draftChangeHandler.current = onDraftChange;
  // Drafts written by older ClipsFree versions may not include caption arrays.
  // Normalize persisted data before rendering so a legacy draft cannot crash React.
  const mergedSession = { ...EMPTY_SESSION, ...(savedSession || {}) };
  const session = {
    ...mergedSession,
    suggestions: Array.isArray(mergedSession.suggestions)
      ? mergedSession.suggestions.filter(Boolean).map((item) => ({
          ...item,
          captions: Array.isArray(item.captions) ? item.captions : [],
        }))
      : [],
  };
  const projetos = useProducaoProjetos();
  const [sourceFile, setSourceFile] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [connections, setConnections] = useState([]);
  const [canManageAi, setCanManageAi] = useState(false);
  const [newCutOpen, setNewCutOpen] = useState(false);
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [expandedScore, setExpandedScore] = useState(null);
  const sourcePreviewRef = useRef(null);
  const clipPreviewRefs = useRef({});
  const finalizados = useMemo(() => projetos.filter((project) => project.etapa === "finalizado"), [projetos]);
  const selected = useMemo(
    () => session.suggestions.find((item) => item.id === session.selectedSuggestionId) || session.suggestions[0],
    [session.selectedSuggestionId, session.suggestions],
  );
  // Examples are a visual fallback, not persisted analysis results.
  const visibleSuggestions = session.suggestions.length ? session.suggestions : makeExamples(session.duration);
  const selectedVisibleId = session.selectedSuggestionId || visibleSuggestions[0]?.id;
  const showingExamples = visibleSuggestions.every((item) => item.example);

  useEffect(() => {
    if (firstDraftRender.current) {
      firstDraftRender.current = false;
      return;
    }
    if (savedSession && draftChangeHandler.current) draftChangeHandler.current(session);
    // The restored draft is the source of this snapshot; the callback is kept in a ref to avoid a render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSession]);

  useEffect(() => {
    let active = true;
    getAIConnections()
      .then((result) => {
        if (!active) return;
        const available = (result.connections || []).filter((connection) => connection.enabled && connection.key_configured);
        setConnections(available);
        setCanManageAi(Boolean(result.can_manage));
        const assigned = result.tool_connections?.["auto-clips"] || result.default_connection_id || available[0]?.id || "";
        if (assigned) update({ analysisConnectionId: assigned });
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
      sourceProject: null,
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
      const analysis = await startClipAnalysis(asset.id, session.analysisConnectionId || null, {
        minimum: session.minimum,
        maximum: session.maximum,
        editorial_prompt: session.prompt,
      });
      const suggestions = (analysis.candidates || []).map((candidate) => ({
        id: candidate.id,
        title: candidate.quote || "Trecho analisado",
        start: candidate.start,
        end: candidate.end,
        score: candidate.score,
        notes: candidate.rationale || "Evidência retirada da transcrição.",
        captions: candidate.captions || [],
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

  function showExamples() {
    const examples = makeExamples(session.duration);
    update({ suggestions: examples, selectedSuggestionId: examples[0].id, analysisStatus: 'example', analysisMessage: 'Exemplos ilustrativos: os trechos e as notas não foram analisados por IA.' });
  }

  function playSuggestedClip(item) {
    const video = clipPreviewRefs.current[item.id];
    if (!video) return;
    video.currentTime = Math.max(0, Number(item.start) || 0);
    video.play().catch(() => {});
  }

  function stopAtSuggestedOut(item, event) {
    const video = event.currentTarget;
    if (video.currentTime >= Number(item.end)) {
      video.pause();
      video.currentTime = Math.max(0, Number(item.start) || 0);
    }
  }

  function exportSelectedXml() {
    if (!session.workspaceClip) return;
    downloadClipFcpxml({
      title: session.workspaceClip.titulo,
      filename: session.sourceName,
      start: Number(session.workspaceClip.in_ms || 0) / 1000,
      end: Number(session.workspaceClip.out_ms || 0) / 1000,
    });
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
        source_asset_id: session.sourceAssetId || null,
        analysis_candidates: item.example ? [] : session.suggestions,
        analysis_status: item.example ? "example" : session.analysisStatus,
        source_project_id: session.sourceProject?.id || null,
        legendas: (Array.isArray(item.captions) ? item.captions : []).map((caption, index) => ({
          id: `caption-${item.id}-${index}`,
          start_ms: Math.round(caption.start * 1000),
          end_ms: Math.round(caption.end * 1000),
          texto: caption.text,
          cortar_audio: false,
        })),
      },
    });
  }

  function openManualEditor() {
    openEditor({
      id: "manual",
      title: "Corte manual",
      start: 0,
      end: Math.max(5, Math.min(session.duration || session.maximum, session.maximum)),
      score: null,
      notes: "Defina os pontos de entrada e saída diretamente no editor.",
      captions: [],
    });
  }

  function reviewSuggestion(item) {
    update({ selectedSuggestionId: item.id });
    if (sourcePreviewRef.current) {
      sourcePreviewRef.current.currentTime = item.start;
      sourcePreviewRef.current.play().catch(() => {});
    }
  }

  function updateWorkspace(patch) {
    setSession((current) => ({ ...current, workspaceClip: { ...current.workspaceClip, ...patch } }));
  }

  async function ensureSourceAsset() {
    if (session.sourceAssetId) return session.sourceAssetId;
    if (!sourceFile) throw new Error('Selecione novamente o vídeo de origem.');
    const clipId = session.workspaceClip?.id;
    const asset = await uploadMediaAsset(sourceFile, { origin: 'clipsfree' });
    setSession((current) => current.workspaceClip?.id === clipId ? { ...current, sourceAssetId: asset.id, workspaceClip: { ...current.workspaceClip, source_asset_id: asset.id } } : current);
    return asset.id;
  }

  function requestUrlImport() {
    update({ analysisStatus: "unavailable", analysisMessage: "A importação por URL depende de um conector autorizado. Envie o arquivo ou selecione um projeto até ele ser configurado." });
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-300"><Scissors size={14} /> Cortes inteligentes</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">{darkChannelMode ? "Cortes do Canais Dark" : "CLIPSFREE"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{darkChannelMode ? `Roteiro: ${initialTitle || "sem título"} · este projeto é separado das produções MediaMind.` : "Transforme um vídeo em uma sessão de cortes: assista, defina o formato, selecione trechos e mantenha o rascunho neste navegador."}</p>
        </div>
        <div className="flex items-center gap-2"><span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200">Sessão local protegida</span><button type="button" onClick={() => setNewCutOpen(true)} className="flex items-center gap-1 rounded-lg bg-violet-400 px-3 py-2 text-sm font-black text-slate-950"><Plus size={15} /> Novo corte</button></div>
      </header>

      {newCutOpen && <section role="dialog" aria-modal="true" aria-labelledby="new-cut-title" className="rounded-2xl border border-violet-400/40 bg-slate-950 p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 id="new-cut-title" className="text-xl font-black text-white">Novo corte</h2><p className="mt-1 text-sm text-slate-400">Escolha a origem; a mesma sessão seguirá para sugestões, revisão, editor e publicação.</p></div><button type="button" aria-label="Fechar novo corte" onClick={() => setNewCutOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300"><X size={16} /></button></div><div className="mt-4 grid gap-3 md:grid-cols-3"><button type="button" onClick={() => { setNewCutOpen(false); }} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-left hover:border-violet-400"><Film size={20} className="text-violet-300" /><b className="mt-3 block">Usar projeto finalizado</b><span className="mt-1 block text-xs text-slate-500">Escolha um master na coluna de produções.</span></button><label role="button" className="cursor-pointer rounded-xl border border-slate-700 bg-slate-900/60 p-4 hover:border-violet-400"><Upload size={20} className="text-violet-300" /><b className="mt-3 block">Enviar arquivo</b><span className="mt-1 block text-xs text-slate-500">MP4, MOV ou WebM do seu computador.</span><input aria-label="Arquivo do novo corte" type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(event) => { chooseSource(event); setNewCutOpen(false); }} /></label><div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"><Link2 size={20} className="text-violet-300" /><b className="mt-3 block">Importar por URL</b><input aria-label="URL do vídeo" value={sourceUrlInput} onChange={(event) => setSourceUrlInput(event.target.value)} placeholder="https://…" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" /><button type="button" onClick={requestUrlImport} className="mt-2 rounded-lg border border-violet-400/50 px-3 py-2 text-xs font-bold text-violet-200">Validar URL autorizada</button></div></div></section>}

    <div className={`grid gap-4 ${darkChannelMode ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-[250px_minmax(0,1fr)_360px]"}`} data-dark-script-id={darkChannelMode ? darkScriptId : undefined}>
        {!darkChannelMode && <aside className="order-2 rounded-2xl border border-slate-800 bg-slate-950/60 xl:order-none">
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
        </aside>}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100"><Film size={16} className="text-violet-300" /> Vídeo de origem</h2>
            {session.sourceName && <span className="max-w-[60%] truncate text-xs text-slate-400">{session.sourceName}</span>}
          </div>
          {session.sourceUrl ? (
            <div className="bg-black p-3">
              <video ref={sourcePreviewRef} aria-label="Prévia do vídeo de origem" src={session.sourceUrl} controls className="max-h-[480px] min-h-64 w-full rounded-xl bg-black" onLoadedMetadata={(event) => update({ duration: event.currentTarget.duration })} />
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
              <label className="text-xs font-semibold text-slate-400">Mínimo (s)<input aria-label="Duração mínima" type="number" min="15" max="60" value={session.minimum} onChange={(event) => update({ minimum: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
              <label className="text-xs font-semibold text-slate-400">Máximo (s)<input aria-label="Duração máxima" type="number" min="15" max="60" value={session.maximum} onChange={(event) => update({ maximum: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
            </div>
            <label className="block text-xs font-semibold text-slate-400">Orientação editorial<textarea aria-label="Orientação editorial" value={session.prompt} onChange={(event) => update({ prompt: event.target.value })} rows="4" className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white outline-none focus:border-violet-400" /></label>
            <div className="block text-xs font-semibold text-slate-400">IA para analisar e legendar
              {canManageAi ? <select aria-label="IA para analisar e legendar" value={session.analysisConnectionId} onChange={(event) => update({ analysisConnectionId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white outline-none focus:border-violet-400">
                {connections.length === 0 && <option value="">Nenhuma IA com créditos configurada</option>}
                {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.model}</option>)}
              </select> : <p className="mt-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm font-medium text-slate-200">{connections.find((connection) => connection.id === session.analysisConnectionId)?.name || "Nenhuma IA configurada"}</p>}
              <p className="mt-1 text-[11px] font-normal leading-relaxed text-slate-500">{canManageAi ? "A administração define qual conexão atende os cortes automáticos." : "A IA desta ferramenta é definida pela administração da empresa."}</p>
            </div>
            <button type="button" disabled={!session.sourceUrl || !session.analysisConnectionId || analysing || !sourceFile || (session.minimum < 15 || session.maximum > 60 || session.minimum > session.maximum)} onClick={generateSuggestions} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-400 px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={16} /> {analysing ? "Analisando..." : "Gerar sugestões"}</button>
            <button type="button" disabled={!session.sourceUrl || analysing || (session.suggestions.length > 0 && session.analysisStatus !== 'example')} onClick={showExamples} className="w-full rounded-lg border border-violet-400/50 px-3 py-2 text-sm font-bold text-violet-200 disabled:opacity-40">Ver cortes de exemplo</button>
            <p className="text-xs leading-relaxed text-slate-500">A IA analisa uma vez; as prévias abaixo usam o vídeo original e não consomem tokens. Somente arquivos locais enviados são analisados nesta versão.</p>
            {session.analysisMessage && <p role="status" className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${session.analysisStatus === "completed" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : session.analysisStatus === "failed" ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>{session.analysisMessage}</p>}
          </div>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black text-white">{showingExamples ? "Cortes de exemplo" : "Sugestões de cortes"}</h2><p className="text-sm text-slate-400">{showingExamples ? "Demonstração visual: trechos e notas são ilustrativos, não resultados de IA." : "Revise o trecho e abra o escolhido no editor local."}</p></div>
          <span className="flex items-center gap-1 text-xs text-slate-400"><Clock3 size={14} /> Origem: {session.duration ? formatTime(session.duration) : "duração será lida pelo player"}</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {visibleSuggestions.map((item) => <article key={item.id} className={`rounded-xl border p-3 ${selectedVisibleId === item.id ? "border-violet-400 bg-violet-500/10" : "border-slate-800 bg-slate-900/50"}`}>
            <div className="mb-3 overflow-hidden rounded-lg border border-slate-700/70 bg-black">
              {session.sourceUrl ? <video ref={(node) => { if (node) clipPreviewRefs.current[item.id] = node; }} src={session.sourceUrl} preload="metadata" controls playsInline onTimeUpdate={(event) => stopAtSuggestedOut(item, event)} onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.max(0, item.start); }} aria-label={`Prévia do corte ${item.title}`} className="aspect-video w-full object-contain" /> : <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-950 via-slate-900 to-indigo-950 text-center text-xs text-slate-300"><Film size={30} className="text-violet-300" /><span>Selecione um vídeo para visualizar</span></div>}
              <button type="button" disabled={!session.sourceUrl} onClick={() => playSuggestedClip(item)} className="flex w-full items-center justify-center gap-2 border-t border-slate-800 py-2 text-xs font-semibold text-violet-200 disabled:opacity-40"><Play size={12} /> Reproduzir do IN ao OUT</button>
            </div>
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-100">{item.title}</p><p className="mt-1 text-xs text-slate-400">{formatTime(item.start)} — {formatTime(item.end)} · {session.format}</p></div><button type="button" aria-label={`Detalhes da nota ${item.score} de ${item.title}`} aria-expanded={expandedScore === item.id} onClick={() => setExpandedScore(expandedScore === item.id ? null : item.id)} className="rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-bold text-emerald-300" title="Clique para ver a justificativa">{item.example ? 'Exemplo · ' : ''}{item.score}/100</button></div>
            {expandedScore === item.id && <p className="mt-3 text-xs leading-relaxed text-slate-300">{item.notes || 'Nenhuma justificativa disponível.'}</p>}
            <p className="mt-3 text-xs text-slate-400">{item.captions?.length ?? 0} legenda{(item.captions?.length ?? 0) === 1 ? " temporizada" : "s temporizadas"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!session.sourceUrl} aria-label={`Revisar trecho ${formatTime(item.start)} a ${formatTime(item.end)}`} onClick={() => reviewSuggestion(item)} className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-violet-400 hover:bg-slate-800 disabled:opacity-40"><Play size={14} /> Revisar</button><button type="button" disabled={!session.sourceUrl} onClick={() => openEditor(item)} className="flex items-center justify-center gap-2 rounded-lg bg-violet-400 px-3 py-2 text-sm font-black text-slate-950 hover:bg-violet-300 disabled:opacity-40"><Clapperboard size={14} /> Editor</button></div>
          </article>)}
        </div>
      </section>

      {session.sourceUrl && session.suggestions.length === 0 && ["unavailable", "failed"].includes(session.analysisStatus) && <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div><h2 className="text-lg font-black text-white">Corte manual disponível</h2><p className="mt-1 text-sm text-slate-400">A análise automática não está disponível, mas você pode marcar IN/OUT, adicionar camadas e seguir o mesmo fluxo de edição.</p></div>
        <button type="button" onClick={openManualEditor} className="flex items-center gap-2 rounded-lg bg-violet-400 px-3 py-2 text-sm font-black text-slate-950 hover:bg-violet-300"><Scissors size={15} /> Abrir editor manual</button>
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
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={exportSelectedXml} className="flex items-center gap-1 rounded-lg border border-violet-400/50 px-3 py-2 text-xs font-bold text-violet-200"><Download size={14} /> Exportar XML (FCPXML)</button><span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">Rascunho salvo automaticamente</span></div>
        </div>
        <p className="mb-3 text-xs text-slate-400">O XML leva o intervalo IN/OUT e o nome do vídeo; no editor externo será necessário religar a mídia original. Não exporta efeitos nem legendas animadas.</p>
        <ClipWorkspace clip={session.workspaceClip} onChange={updateWorkspace} onEnsureAsset={sourceFile ? ensureSourceAsset : undefined} onProsseguir={() => updateWorkspace({ pronto: true })} />
      </section>}
    </div>
  );
}
