import { useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, Plus, Sparkles, SlidersHorizontal } from "lucide-react";
import {
  generateVideoStudioStage,
  getAICompanies,
  getAIConnections,
} from "../../../api/generation";
import { useEmpresa } from "../../lib/empresaContext";
import { useWorkDraftState } from "../../lib/workProtection";
import VideoWorkspace, { makeScenes } from "./VideoWorkspace";
import {
  VIDEO_STUDIO_STAGES,
  buildVideoStudioPrompt,
  exportVideoStudioProject,
  markAllStagesStale,
  markDownstreamStale,
} from "./videoStudioPipeline";

const field =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";
const engines = ["Kling 3.0", "Seedance 2.0", "Minimax H3", "Outro motor"];

function newProject() {
  return {
    id: crypto.randomUUID(),
    title: "Novo projeto de vídeo",
    idea: "",
    engine: engines[0],
    connectionId: "",
    preferences: { format: "16:9", duration: "", language: "Português (Brasil)", audience: "", niche: "", tone: "", mediaStrategy: "", voice: "", visualReferences: "", availableAssets: "" },
    outputs: {},
    adjustments: {},
    updatedAt: new Date().toISOString(),
  };
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function VideoStudio() {
  const { currentEmpresa } = useEmpresa();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(currentEmpresa?.id || "");
  const [connections, setConnections] = useState([]);
  const [assignedConnectionId, setAssignedConnectionId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("loading");
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [projects, setProjects] = useWorkDraftState(
    `components/ai-tools/VideoStudio.jsx:projects:${companyId || "select"}`,
    [],
  );
  const [activeProjectId, setActiveProjectId] = useWorkDraftState(
    `components/ai-tools/VideoStudio.jsx:active:${companyId || "select"}`,
    "",
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stageId, setStageId] = useState("roteiro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let active = true;
    getAICompanies()
      .then((value) => {
        if (!active) return;
        const items = value.companies || [];
        setCompanies(items);
        const currentId = currentEmpresa?.id;
        setCompanyId(
          currentId && items.some((item) => item.id === currentId)
            ? currentId
            : items.length === 1
              ? items[0].id
              : "",
        );
      })
      .catch(() => {
        if (active) {
          setCompanyId(currentEmpresa?.id || "");
          setConnectionStatus("error");
          setError("Não foi possível carregar as empresas com acesso à IA.");
        }
      });
    return () => {
      active = false;
    };
  }, [currentEmpresa?.id]);

  useEffect(() => {
    if (!companyId) {
      setConnections([]);
      setAssignedConnectionId("");
      setSelectedConnectionId("");
      setConnectionStatus("missing-company");
      return undefined;
    }
    let active = true;
    setConnectionStatus("loading");
    getAIConnections(companyId)
      .then((value) => {
        if (!active) return;
        const available = (value.connections || []).filter(
          (item) => item.enabled && item.key_configured,
        );
        const assigned =
          value.tool_connections?.["video-studio"] || value.default_connection_id || "";
        setConnections(available);
        setAssignedConnectionId(assigned);
        setSelectedConnectionId((current) => {
          if (available.some((item) => item.id === current)) return current;
          return available.some((item) => item.id === assigned)
            ? assigned
            : available[0]?.id || "";
        });
        setConnectionStatus(available.length ? "ready" : "empty");
        setError("");
      })
      .catch((loadError) => {
        if (active) {
          setConnections([]);
          setAssignedConnectionId("");
          setSelectedConnectionId("");
          setConnectionStatus("error");
          setError(loadError.message || "Não foi possível carregar as conexões de IA.");
        }
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!projects.length) {
      const initial = newProject();
      setProjects([initial]);
      setActiveProjectId(initial.id);
    } else if (!projects.some((item) => item.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId, setProjects, setActiveProjectId]);

  const project = projects.find((item) => item.id === activeProjectId) || null;
  const stageIndex = VIDEO_STUDIO_STAGES.findIndex((item) => item.id === stageId);
  const stage = VIDEO_STUDIO_STAGES[stageIndex] || VIDEO_STUDIO_STAGES[0];
  const connection = connections.find((item) => item.id === selectedConnectionId);
  const completeCount = useMemo(
    () => VIDEO_STUDIO_STAGES.filter((item) => project?.outputs?.[item.id]?.text?.trim()).length,
    [project],
  );
  const stageReady =
    !!project &&
    (stage.id === "roteiro"
      ? !!project.idea?.trim()
      : stage.dependsOn.every(
          (dependency) =>
            !!project.outputs?.[dependency]?.text?.trim() &&
            !project.outputs?.[dependency]?.stale,
        ));
  const stageNeedsRefresh =
    !!project?.outputs?.[stage.id]?.stale ||
    stage.dependsOn.some((dependency) => project?.outputs?.[dependency]?.stale);

  useEffect(() => {
    if (!connections.length) return;
    const preferred = project?.connectionId || assignedConnectionId;
    if (connections.some((item) => item.id === preferred)) {
      setSelectedConnectionId(preferred);
    }
  }, [project?.id, project?.connectionId, assignedConnectionId, connections]);

  function updateProject(nextProject) {
    setProjects((items) => {
      const exists = items.some((item) => item.id === nextProject.id);
      return exists
        ? items.map((item) => (item.id === nextProject.id ? nextProject : item))
        : [nextProject, ...items];
    });
  }

  function patchProject(values) {
    if (!project) return;
    updateProject({ ...project, ...values, updatedAt: new Date().toISOString() });
  }

  function createProject() {
    const created = newProject();
    updateProject(created);
    setActiveProjectId(created.id);
    setStageId("roteiro");
    setError("");
    setStatus("Novo projeto criado e salvo como rascunho.");
  }

  function openProject(id) {
    setActiveProjectId(id);
    setError("");
  }

  function updatePreference(key, value) {
    if (!project) return;
    patchProject({
      preferences: { ...(project.preferences || {}), [key]: value },
      outputs: markAllStagesStale(project.outputs || {}),
    });
  }

  function updateStageText(id, text) {
    if (!project) return;
    const outputs = markDownstreamStale(project.outputs, id);
    outputs[id] = { ...outputs[id], text, stale: false, editedAt: new Date().toISOString() };
    patchProject({ outputs });
  }

  function updateProjectIdea(idea) {
    if (!project) return;
    patchProject({ idea, outputs: markAllStagesStale(project.outputs) });
  }

  function updateProjectEngine(engine) {
    if (!project) return;
    patchProject({ engine, outputs: markAllStagesStale(project.outputs) });
  }

  function createEditableScenes() {
    const shotList = project?.outputs?.shot_list?.text;
    if (!shotList?.trim()) return;
    const generated = makeScenes(shotList).slice(0, 100);
    const scenes = generated.map((scene, index) => ({
      ...scene,
      ...(project.scenes?.[index] || {}),
      id: project.scenes?.[index]?.id || scene.id,
      text: scene.text,
    }));
    patchProject({ scenes });
    setStatus(`${scenes.length} cenas editáveis criadas a partir da decupagem.`);
  }

  function updateScenes(change) {
    if (!project) return;
    const scenes = typeof change === "function" ? change(project.scenes || []) : change;
    const outputs = markDownstreamStale(project.outputs, "shot_list");
    patchProject({ scenes, outputs });
  }

  async function generateStage(targetStage, sourceProject) {
    if (!connection) throw new Error("Selecione uma conexão de IA ativa.");
    const prompt = buildVideoStudioPrompt(targetStage.id, {
      idea: sourceProject.idea,
      outputs: sourceProject.outputs,
      engine: sourceProject.engine,
      adjustment: sourceProject.adjustments?.[targetStage.id] || "",
      preferences: sourceProject.preferences || {},
    });
    const result = await generateVideoStudioStage({
      stage: targetStage.id,
      prompt,
      connection_id: selectedConnectionId,
      max_tokens: 6000,
    });
    const outputs = markDownstreamStale(sourceProject.outputs, targetStage.id);
    outputs[targetStage.id] = {
      text: result.text,
      stale: false,
      generatedAt: new Date().toISOString(),
      model: result.model,
      provider: result.provider,
    };
    const updated = {
      ...sourceProject,
      connectionId: selectedConnectionId,
      outputs,
      updatedAt: new Date().toISOString(),
    };
    updateProject(updated);
    return updated;
  }

  async function generateCurrentStage() {
    if (!project || busy || !stageReady || !connection) return;
    setBusy(true);
    setError("");
    setStatus(`Gerando ${stage.label} com ${connection.name}…`);
    try {
      await generateStage(stage, project);
      setStatus(`${stage.label} gerado e salvo no rascunho.`);
    } catch (generationError) {
      setError(generationError.message || "Não foi possível gerar esta etapa.");
      setStatus("O rascunho anterior foi preservado; você pode tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function runPendingStages() {
    if (!project || busy || !connection || !project.idea.trim()) return;
    setBusy(true);
    setError("");
    let workingProject = project;
    try {
      for (const item of VIDEO_STUDIO_STAGES) {
        const existing = workingProject.outputs[item.id];
        if (existing?.text?.trim() && !existing.stale) continue;
        setStageId(item.id);
        setStatus(`Etapa ${VIDEO_STUDIO_STAGES.indexOf(item) + 1} de ${VIDEO_STUDIO_STAGES.length}: ${item.label}…`);
        workingProject = await generateStage(item, workingProject);
      }
      setStatus("Pipeline concluído. Revise o pacote antes de exportar.");
    } catch (generationError) {
      setError(generationError.message || "A geração foi interrompida.");
      setStatus("As etapas concluídas foram salvas; retome pela etapa pendente.");
    } finally {
      setBusy(false);
    }
  }

  function exportText() {
    if (!project) return;
    const base = exportVideoStudioProject(project);
    downloadFile(`${project.title || "projeto-video"}.md`.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120), base, "text/markdown;charset=utf-8");
  }

  function exportJson() {
    if (!project) return;
    const portable = { schema: "mediamind-video-studio/v1", ...project };
    downloadFile(`${project.title || "projeto-video"}.json`.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120), JSON.stringify(portable, null, 2), "application/json");
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-800 bg-[#0b1220] p-4 text-slate-200 md:p-6" aria-label="Video Studio">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-400">MediaMind · produção audiovisual com IA</p>
          <h2 className="mt-1 text-2xl font-black text-white">Video Studio</h2>
          <p className="mt-1 text-sm text-slate-400">Da ideia à bíblia visual, decupagem, storyboard e prompts prontos para o motor de vídeo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={createProject} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-500 disabled:opacity-50">
            <Plus size={16} /> Novo projeto
          </button>
          <button type="button" onClick={exportText} disabled={!project || !completeCount || busy} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">
            <Download size={16} /> Exportar pacote
          </button>
          <button type="button" onClick={exportJson} disabled={!project || !completeCount || busy} aria-label="Exportar projeto JSON" className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-40">JSON</button>
        </div>
      </header>

      <nav aria-label="Guias dos projetos de vídeo" className="flex items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/55 px-2 py-1.5">
        {projects.map((item) => {
          const selected = item.id === activeProjectId;
          const completed = VIDEO_STUDIO_STAGES.filter((entry) => item.outputs?.[entry.id]?.text?.trim()).length;
          return <button key={item.id} type="button" role="tab" aria-selected={selected} title={`${item.title || "Projeto sem título"} · ${completed}/8 etapas`} onClick={() => openProject(item.id)} disabled={busy} className={`max-w-52 shrink-0 truncate rounded-md border px-3 py-1.5 text-xs font-semibold transition ${selected ? "border-cyan-500 bg-cyan-950/60 text-cyan-100" : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-white"}`}>
            {item.title || "Projeto sem título"}
          </button>;
        })}
        <button type="button" onClick={createProject} disabled={busy} aria-label="Adicionar guia de projeto" title="Novo projeto" className="shrink-0 rounded-md border border-dashed border-slate-700 p-1.5 text-cyan-300 hover:border-cyan-400 disabled:opacity-40"><Plus size={15}/></button>
        <span className="ml-auto shrink-0 text-[10px] text-slate-500">{projects.length} projeto(s)</span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">
        <label className="text-xs font-semibold text-slate-300">
          Ideia do vídeo
          <textarea aria-label="Ideia do vídeo" className={`${field} mt-2 min-h-28 resize-y`} maxLength={200000} disabled={!project || busy} value={project?.idea || ""} onChange={(event) => updateProjectIdea(event.target.value)} placeholder="Conte a ideia, o tema, a história ou cole seu roteiro. Quanto mais contexto, melhor o resultado." />
          <span className="mt-1 block font-normal text-slate-500">Até 200 mil caracteres. O progresso fica salvo como rascunho neste navegador e nesta empresa.</span>
        </label>
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          {companies.length > 1 && <label className="block text-xs font-semibold">Empresa da conexão
            <select aria-label="Empresa da conexão" className={`${field} mt-2`} value={companyId} disabled={busy} onChange={(event) => setCompanyId(event.target.value)}>
              {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>}
          <label className="block text-xs font-semibold">Conexão de IA
            <select aria-label="Conexão de IA" className={`${field} mt-2`} value={selectedConnectionId} disabled={busy || connectionStatus !== "ready"} onChange={(event) => { setSelectedConnectionId(event.target.value); patchProject({ connectionId: event.target.value }); }}>
              {!connections.length && <option value="">Nenhuma conexão ativa</option>}
              {connections.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.provider === "anthropic" ? "Claude" : item.provider} · {item.model}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold">Motor para os prompts de vídeo
            <select aria-label="Motor de vídeo" className={`${field} mt-2`} disabled={!project || busy} value={project?.engine || engines[0]} onChange={(event) => updateProjectEngine(event.target.value)}>
              {engines.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <p className="text-xs leading-relaxed text-slate-500">Claude escreve e revisa o pacote. O motor selecionado recebe prompts prontos; a geração/renderização de vídeo depende de uma integração de vídeo conectada.</p>
          {connectionStatus === "empty" && <p className="text-xs text-amber-300">Nenhuma IA ativa cadastrada para esta empresa. <a className="underline" href="/configuracoes/ia">Configurar IA</a></p>}
          {connectionStatus === "missing-company" && <p className="text-xs text-amber-300">Selecione uma empresa com acesso a conexões de IA.</p>}
          {connectionStatus === "error" && <p role="alert" className="text-xs text-rose-300">{error || "Falha ao consultar as conexões da empresa."}</p>}
          {!!assignedConnectionId && assignedConnectionId !== selectedConnectionId && <p className="text-xs text-slate-500">Escolha local deste projeto; padrão da ferramenta mantido nas configurações da empresa.</p>}
        </div>
      </div>

      {project && <label className="block max-w-xl text-xs font-semibold">Nome do projeto
        <input aria-label="Nome do projeto" className={`${field} mt-2`} disabled={busy} value={project.title} onChange={(event) => patchProject({ title: event.target.value })} />
      </label>}

      {project && <section className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
        <button type="button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced((value) => !value)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-cyan-200"><span className="inline-flex items-center gap-2"><SlidersHorizontal size={16}/> Direcionamento opcional · formato, público, referências e materiais</span><span>{showAdvanced ? "Recolher −" : "Expandir +"}</span></button>
        <p className="mt-1 text-xs text-slate-500">Basta escrever a ideia ou colar o roteiro. Os campos abaixo são opcionais e ajudam a direcionar a IA quando houver uma conexão ativa.</p>
        {showAdvanced && <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["format", "Formato", "select", ["16:9", "9:16", "1:1", "4:5", "Outro / livre"]],
            ["duration", "Duração planejada", "select", ["", "15 segundos", "30 segundos", "60 segundos", "2 minutos", "5 minutos", "10 minutos", "Livre"]],
            ["language", "Idioma", "select", ["Português (Brasil)", "Inglês", "Espanhol", "Outro / conforme a ideia"]],
            ["niche", "Nicho / tema", "text"],
            ["audience", "Público-alvo / canal", "text"],
            ["tone", "Estilo e tom da narração", "text"],
            ["mediaStrategy", "Estratégia de mídia (própria, IA, mista)", "text"],
            ["voice", "Narração / áudio / música", "text"],
            ["visualReferences", "Referências visuais e links", "textarea"],
            ["availableAssets", "Mídias e elementos disponíveis (descrição)", "textarea"],
          ].map(([key, label, type, options]) => <label key={key} className={`text-xs font-semibold text-slate-300 ${type === "textarea" ? "sm:col-span-2 xl:col-span-3" : ""}`}>
            {label}
            {type === "select" ? <select className={`${field} mt-1`} value={project.preferences?.[key] ?? (key === "format" ? "16:9" : key === "language" ? "Português (Brasil)" : "")} onChange={(event) => updatePreference(key, event.target.value)} disabled={busy}>{options.map((option) => <option key={option} value={option}>{option || "Não definido"}</option>)}</select> : type === "textarea" ? <textarea className={`${field} mt-1 min-h-16`} value={project.preferences?.[key] || ""} onChange={(event) => updatePreference(key, event.target.value)} disabled={busy} placeholder="Opcional; não é necessário preencher para começar"/> : <input className={`${field} mt-1`} value={project.preferences?.[key] || ""} onChange={(event) => updatePreference(key, event.target.value)} disabled={busy} placeholder="Opcional"/>}
          </label>)}
          <p className="text-xs text-slate-500 sm:col-span-2 xl:col-span-3">Referências textuais e links são incluídos no prompt, mas ainda não são enviados como arquivos multimodais. A importação real de mídias requer integração específica, que não está simulada nesta etapa.</p>
        </div>}
      </section>}

      <nav aria-label="Etapas do Video Studio" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {VIDEO_STUDIO_STAGES.map((item, index) => {
          const result = project?.outputs[item.id];
          const label = `${index + 1}. ${item.label}`;
          return <button key={item.id} type="button" aria-label={item.label} aria-pressed={stage.id === item.id} disabled={busy} onClick={() => { setStageId(item.id); setError(""); }} className={`flex min-h-14 items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${stage.id === item.id ? "border-cyan-500 bg-cyan-950/50 text-cyan-100" : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-600"}`}>
            <span>{label}</span><span className={`text-[10px] ${result?.stale ? "text-amber-300" : result?.text ? "text-emerald-300" : "text-slate-500"}`}>{result?.stale ? "Revisar" : result?.text ? "Pronto" : "Pendente"}</span>
          </button>;
        })}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-4" aria-label={`Etapa atual: ${stage.label}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-xs text-slate-500">ETAPA {stageIndex + 1} DE {VIDEO_STUDIO_STAGES.length}</p><h3 className="text-lg font-bold text-white">{stage.label}</h3></div>
            <span className="text-xs text-slate-400">{completeCount}/{VIDEO_STUDIO_STAGES.length} etapas com conteúdo</span>
          </div>
          {stageNeedsRefresh && <p className="mb-3 rounded-lg border border-amber-700/60 bg-amber-950/30 p-2 text-xs text-amber-200">Uma etapa anterior foi alterada. Este resultado foi preservado, mas precisa ser revisto ou gerado novamente.</p>}
          <textarea aria-label={`Resultado do ${stage.label.toLowerCase()}`} className={`${field} min-h-72 resize-y leading-relaxed`} disabled={!project || busy} value={project?.outputs?.[stage.id]?.text || ""} onChange={(event) => updateStageText(stage.id, event.target.value)} placeholder="O resultado da etapa aparecerá aqui e poderá ser editado." />
          {stage.id === "shot_list" && <button type="button" onClick={createEditableScenes} disabled={!project?.outputs?.shot_list?.text?.trim() || busy} className="mt-3 rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-40">{project?.scenes?.length ? "Atualizar cenas editáveis" : "Criar cenas editáveis"}</button>}
          <label className="mt-3 block text-xs font-semibold text-slate-400">Orientação adicional para esta etapa
            <textarea aria-label="Orientação adicional" className={`${field} mt-2 min-h-20 resize-y`} disabled={!project || busy} value={project?.adjustments?.[stage.id] || ""} onChange={(event) => patchProject({ adjustments: { ...project.adjustments, [stage.id]: event.target.value } })} placeholder="Peça uma mudança específica sem perder o restante do trabalho." />
          </label>
        </section>

        <aside className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h3 className="font-bold text-white">Execução</h3>
          <button type="button" onClick={generateCurrentStage} disabled={busy || !stageReady || !connection} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-3 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? "Gerando…" : "Gerar etapa atual"}
          </button>
          <button type="button" onClick={runPendingStages} disabled={busy || !project?.idea.trim() || !connection} className="w-full rounded-lg border border-cyan-800 px-3 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Pipeline em execução…" : "Executar etapas pendentes"}</button>
          <p role="status" aria-live="polite" className="min-h-10 text-xs text-slate-400">{status || "A ideia e cada etapa concluída são salvas como rascunho."}</p>
          {error && <p role="alert" className="rounded-lg border border-rose-800/70 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</p>}
          <div className="border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-500">
            <p>O pipeline não apaga etapas ao falhar: continue da etapa pendente e exporte o pacote quando revisar.</p>
            <p className="mt-2">Personagens e storyboard recebem prompts descritivos. A geração de imagens e de vídeo final só aparece quando esses motores estiverem integrados.</p>
          </div>
        </aside>
      </div>

      {project?.scenes?.length > 0 && ["shot_list", "storyboard", "prompts", "multiplanos"].includes(stage.id) && <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4" aria-label="Montagem e prévia da produção"><div><h3 className="font-semibold text-white">Timeline de produção</h3><p className="mt-1 text-xs text-slate-400">As cenas da decupagem, mídias, narração e prévia ficam dentro do mesmo fluxo e são salvas no rascunho.</p></div><VideoWorkspace scenes={project.scenes} setScenes={updateScenes} format={project.preferences?.format || "16:9"} label="PRÉVIA DA PRODUÇÃO" /></section>}
    </section>
  );
}
