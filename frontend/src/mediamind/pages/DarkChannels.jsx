import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, FolderOpen, Network, Plus, Save, Settings2, Sparkles } from "lucide-react";
import {
  createDarkChannelScript,
  getDarkStructure,
  listDarkChannels,
  listDarkChannelScripts,
  updateDarkChannel,
  updateDarkChannelScript,
} from "../../api/darkChannels";
import VideoGeneration from "./VideoGeneration";
import ClipsFree from "./ClipsFree";
import ThumbnailStudio from "./ThumbnailStudio";
import { useEmpresa } from "../lib/empresaContext";
import DarkStructureDialog from "../components/darkChannels/DarkStructureDialog";
import DarkDecisions from "../components/darkChannels/DarkDecisions";
import DarkStructureEditor from "../components/darkChannels/DarkStructureEditor";
import DarkChannelsPlanning, { DarkNetworkSummary, emptyFilters, networkView } from "../components/darkChannels/DarkChannelsPlanning";

const input = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500";
const panel = "rounded-xl border border-slate-800 bg-slate-950/60 p-4";
const planningTabs = ["channels", "decisions", "structure"];
/** Ordem das abas: planejamento da rede primeiro, depois as etapas do pipeline de produção. */
export const workflowTabs = [
  ["channels", "Canais"], ["decisions", "Decisões"], ["structure", "Nichos e idiomas"], ["scripts", "Pastas e roteiros"], ["materials", "Materiais"],
  ["video", "Gerar vídeos"], ["thumbs", "Thumbs"], ["cuts", "Cortes"],
  ["review", "Revisão final"], ["published", "Agendados e publicados"], ["analytics", "Analytics"],
];
const stageWorkflowFields = {
  scripts: ["folder_name"], materials: ["materials"], thumbs: ["thumbnail_title", "thumbnail_reference"],
  cuts: ["cuts"], review: ["final_title", "description", "tags", "thumbnail_title", "thumbnail_reference", "video_format", "target_channels", "scheduled_at"],
  published: ["publication_url", "published_at"],
};
const publishingChannelLabels = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };
const emptyWorkflow = () => ({
  folder_name: "", final_title: "", materials: [], thumbnail_title: "", thumbnail_reference: "", video_format: "16:9", target_channels: [], description: "",
  tags: [], cuts: [], scheduled_at: "", publication_url: "", published_at: "",
  metrics: { views: 0, likes: 0, comments: 0 },
});
const scriptMaterialsForVideo = (script) => (script?.workflow?.materials || [])
  .map((material) => `${material.title} (${material.kind}): ${material.reference}`)
  .join("\n");

export default function DarkChannels() {
  const { currentEmpresa } = useEmpresa();
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [scripts, setScripts] = useState([]);
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [structure, setStructure] = useState(null);
  const [structureError, setStructureError] = useState("");
  const [showStructure, setShowStructure] = useState(false);
  const [structureDirty, setStructureDirty] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [showQuickScriptForm, setShowQuickScriptForm] = useState(false);
  const [topic, setTopic] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [pipelineScriptId, setPipelineScriptId] = useState("");
  const [activeStage, setActiveStage] = useState("channels");
  const [folderDraft, setFolderDraft] = useState("");
  const [materialDraft, setMaterialDraft] = useState({ title: "", reference: "", kind: "link" });
  const [workflowDraft, setWorkflowDraft] = useState(emptyWorkflow);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saveTimer = useRef(null);
  const pendingScriptSave = useRef(null);
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) || null;
  const selectedScript = scripts.find((script) => script.id === selectedScriptId) || null;
  const pipelineScript = scripts.find((script) => script.id === pipelineScriptId) || null;
  const publicationItems = scripts
    .filter((script) => script.workflow?.scheduled_at || script.workflow?.published_at || script.workflow?.publication_url)
    .sort((left, right) => (left.workflow?.scheduled_at || left.workflow?.published_at || "").localeCompare(right.workflow?.scheduled_at || right.workflow?.published_at || ""));

  const network = networkView(channels, structure);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listDarkChannels();
      const available = result.channels || [];
      setChannels(available);
      setSelectedChannelId((current) => available.some((channel) => channel.id === current) ? current : available.find((channel) => !channel.archived)?.id || "");
    } catch (loadError) {
      setError(loadError.message || "Não foi possível carregar os canais.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStructure = useCallback(async () => {
    try {
      setStructure(await getDarkStructure());
      setStructureError("");
    } catch (loadError) {
      setStructure(null);
      setStructureError(loadError.message || "Não foi possível carregar a estrutura de nichos e idiomas.");
    }
  }, []);

  useEffect(() => { void loadChannels(); void loadStructure(); }, [loadChannels, loadStructure, currentEmpresa?.id]);

  useEffect(() => {
    let active = true;
    setScripts([]);
    setSelectedScriptId("");
    if (!selectedChannelId) return () => { active = false; };
    listDarkChannelScripts(selectedChannelId)
      .then((result) => {
        if (!active) return;
        const items = result.scripts || [];
        setScripts(items);
        setSelectedScriptId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || "");
      })
      .catch((loadError) => { if (active) setError(loadError.message || "Não foi possível carregar os roteiros."); });
    return () => { active = false; };
  }, [selectedChannelId]);

  useEffect(() => {
    setScriptText(selectedScript?.script || "");
    setWorkflowDraft({ ...emptyWorkflow(), final_title: selectedScript?.workflow?.final_title || selectedScript?.title || selectedScript?.topic || "", ...(selectedScript?.workflow || {}), metrics: { ...emptyWorkflow().metrics, ...(selectedScript?.workflow?.metrics || {}) } });
  }, [selectedScriptId, selectedScript?.script]);

  useEffect(() => () => {
    window.clearTimeout(saveTimer.current);
    const pending = pendingScriptSave.current;
    if (pending) void updateDarkChannelScript(pending.channelId, pending.scriptId, { script: pending.value });
  }, []);

  function selectChannel(channelId) {
    void flushScriptSave().catch(() => {});
    setSelectedChannelId(channelId);
    setPipelineScriptId("");
  }

  function channelCreated(created) {
    setChannels((items) => [created, ...items]);
    selectChannel(created.id);
    setShowChannelForm(false);
  }

  function channelUpdated(updated) {
    setChannels((items) => items.map((item) => item.id === updated.id ? updated : item));
  }

  async function submitScript(event) {
    event.preventDefault();
    if (!selectedChannel || !topic.trim() || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const created = await createDarkChannelScript(selectedChannel.id, { topic: topic.trim(), title: topic.trim() });
      setScripts((items) => [created, ...items]);
      setSelectedScriptId(created.id);
      setTopic("");
      setShowQuickScriptForm(false);
      setNotice("Roteiro criado como rascunho e salvo no canal.");
    } catch (saveError) { setError(saveError.message || "Não foi possível criar o roteiro."); }
    finally { setSaving(false); }
  }

  async function flushScriptSave() {
    window.clearTimeout(saveTimer.current);
    const pending = pendingScriptSave.current;
    if (!pending) return;
    pendingScriptSave.current = null;
    try {
      const updated = await updateDarkChannelScript(pending.channelId, pending.scriptId, { script: pending.value });
      setScripts((items) => items.map((item) => item.id === pending.scriptId ? updated : item));
      setNotice("Roteiro salvo automaticamente.");
      setError("");
    } catch (saveError) {
      pendingScriptSave.current = pending;
      setError(saveError.message || "Não foi possível salvar o roteiro.");
      throw saveError;
    }
  }

  function scheduleScriptSave(scriptId, value) {
    setScriptText(value);
    pendingScriptSave.current = { channelId: selectedChannelId, scriptId, value };
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void flushScriptSave().catch(() => {}); }, 600);
  }

  async function updateScript(patch) {
    if (!selectedChannel || !selectedScript) return;
    setSaving(true); setError("");
    try {
      await flushScriptSave();
      const updated = await updateDarkChannelScript(selectedChannel.id, selectedScript.id, patch);
      setScripts((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice("Etapa do roteiro atualizada.");
    } catch (saveError) { setError(saveError.message || "Não foi possível atualizar o roteiro."); }
    finally { setSaving(false); }
  }

  async function saveWorkflow(next = workflowDraft) {
    if (!selectedChannel || !selectedScript || saving) return;
    setSaving(true); setError("");
    try {
      const fields = stageWorkflowFields[activeStage] || Object.keys(next);
      const workflow = Object.fromEntries(fields.map((field) => [field, next[field]]));
      if (activeStage === "review") {
        for (const field of ["scheduled_at", "target_channels"]) {
          if (!next[field]?.length && !selectedScript.workflow?.[field]?.length && !selectedScript.workflow?.[field]) delete workflow[field];
        }
      }
      const changes = { workflow };
      if (activeStage === "review" && next.final_title && next.final_title !== selectedScript.title) changes.title = next.final_title;
      const updated = await updateDarkChannelScript(selectedChannel.id, selectedScript.id, changes);
      setScripts((items) => items.map((item) => item.id === updated.id ? updated : item));
      setWorkflowDraft({ ...emptyWorkflow(), ...(updated.workflow || next), metrics: { ...emptyWorkflow().metrics, ...(updated.workflow?.metrics || next.metrics) } });
      setNotice("Etapa salva no registro próprio do Canais Dark.");
    } catch (saveError) { setError(saveError.message || "Não foi possível salvar esta etapa."); }
    finally { setSaving(false); }
  }

  async function addFolder(event) {
    event.preventDefault();
    const name = folderDraft.trim();
    if (!selectedChannel || !name || saving) return;
    const folders = [...new Set([...(selectedChannel.topic_folders || []), name])];
    setSaving(true); setError("");
    try {
      const updated = await updateDarkChannel(selectedChannel.id, { topic_folders: folders });
      setChannels((items) => items.map((item) => item.id === updated.id ? updated : item));
      setFolderDraft("");
      setNotice("Pasta de assunto criada neste canal.");
    } catch (saveError) { setError(saveError.message || "Não foi possível criar a pasta."); }
    finally { setSaving(false); }
  }

  async function assignFolder(folderName) {
    const next = { ...workflowDraft, folder_name: folderName };
    setWorkflowDraft(next);
    await saveWorkflow(next);
  }

  async function addMaterial(event) {
    event.preventDefault();
    if (!selectedChannel || !materialDraft.title.trim() || !materialDraft.reference.trim() || saving) return;
    const item = { ...materialDraft, title: materialDraft.title.trim(), reference: materialDraft.reference.trim() };
    if ((selectedChannel.materials || []).some((material) => material.reference === item.reference)) {
      setNotice("Este material já está cadastrado neste canal.");
      return;
    }
    setSaving(true); setError("");
    try {
      const updated = await updateDarkChannel(selectedChannel.id, { materials: [...(selectedChannel.materials || []), item] });
      setChannels((items) => items.map((channel) => channel.id === updated.id ? updated : channel));
      setMaterialDraft({ title: "", reference: "", kind: "link" });
      setNotice("Material salvo no acervo próprio deste canal.");
    } catch (saveError) { setError(saveError.message || "Não foi possível salvar o material no canal."); }
    finally { setSaving(false); }
  }

  async function attachChannelMaterial(item) {
    if (!selectedChannel || !selectedScript || saving || workflowDraft.materials.some((material) => material.reference === item.reference)) return;
    const next = { ...workflowDraft, materials: [...workflowDraft.materials, item] };
    setSaving(true); setError("");
    try {
      const updated = await updateDarkChannelScript(selectedChannel.id, selectedScript.id, { workflow: { materials: next.materials } });
      setScripts((items) => items.map((script) => script.id === updated.id ? updated : script));
      setWorkflowDraft({ ...next, ...(updated.workflow || {}) });
      setNotice("Material do canal vinculado ao roteiro selecionado.");
    } catch (saveError) { setError(saveError.message || "Não foi possível vincular o material ao roteiro."); }
    finally { setSaving(false); }
  }

  async function updatePublishingMode(mode) {
    if (!selectedChannel) return;
    setSaving(true); setError("");
    try {
      const updated = await updateDarkChannel(selectedChannel.id, { publishing_mode: mode });
      setChannels((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice(mode === "automatic" ? "Publicação automática selecionada; ela só ocorrerá após validação e configuração da conta." : "Publicação manual selecionada.");
    } catch (saveError) { setError(saveError.message || "Não foi possível salvar a opção de publicação."); }
    finally { setSaving(false); }
  }

  function patchWorkflow(patch) {
    setWorkflowDraft((current) => ({ ...current, ...patch }));
  }

  function saveAndSetStage(stage) {
    if (stage === activeStage) return;
    if (activeStage === "structure" && structureDirty && !window.confirm("Há alterações não salvas em Nichos e idiomas. Descartar e sair?")) return;
    if (activeStage === "structure") setStructureDirty(false);
    setActiveStage(stage);
    if (selectedScript && pendingScriptSave.current) void flushScriptSave().catch(() => {});
  }

  const activePipelineDraft = useMemo(() => pipelineScript ? {
    id: pipelineScript.id,
    title: pipelineScript.title || pipelineScript.topic,
    topic: pipelineScript.topic,
    script: pipelineScript.script || "",
    channelName: selectedChannel?.name || "",
    channelAudience: selectedChannel?.audience || "",
    language: selectedChannel?.language || "pt-BR",
    availableAssets: scriptMaterialsForVideo(pipelineScript),
    niche: selectedChannel?.niche || "",
    format: selectedChannel?.format || "long",
  } : null, [pipelineScript, selectedChannel]);

  const isPlanningStage = planningTabs.includes(activeStage);
  const publishingSelect = selectedChannel && <label className="text-xs text-slate-300">Modo de publicação<select aria-label="Publicação do canal" className="ml-2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs" disabled={saving} value={selectedChannel.publishing_mode || "manual"} onChange={(event) => void updatePublishingMode(event.target.value)}><option value="manual">Manual</option><option value="automatic">Automática (requer integração)</option></select></label>;

  return (
    <main className="space-y-4" aria-label="Canais Dark">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-cyan-900/60 bg-slate-950/70 px-5 py-4">
        <div className="flex items-start gap-3"><span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-slate-950"><Clapperboard size={21}/></span><div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-400">Estúdio de canais</p><h1 className="mt-0.5 text-2xl font-black text-white">Canais Dark</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">Organize a rede de canais por nicho, idioma e fase de lançamento; guarde ideias e roteiros, desenvolva cada roteiro no pipeline de vídeo e valide antes de publicar.</p>
        </div></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowStructure(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500"><Network size={16}/>Estrutura</button>
          <button type="button" onClick={() => { saveAndSetStage("channels"); setShowChannelForm((shown) => !shown); }} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950"><Plus size={16}/>{showChannelForm ? "Fechar cadastro" : "Novo canal"}</button>
          <a className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500" href="/configuracoes/ia"><Settings2 size={16}/> Configurar provedores de IA</a>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</p>}

      <DarkNetworkSummary network={network} onOpenDecisions={() => saveAndSetStage("decisions")} onFilter={(next) => { saveAndSetStage("channels"); setFilters(next); }}/>

      <div className="space-y-4">
        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-1" role="tablist" aria-label="Seções do Canais Dark">
          {workflowTabs.map(([id, label]) => {
            const needsFirstScript = id === "materials" && scripts.length === 0;
            return <button key={id} type="button" role="tab" disabled={needsFirstScript} aria-selected={activeStage === id} aria-controls={`dark-panel-${id}`} onClick={() => saveAndSetStage(id)} title={needsFirstScript ? "Crie o primeiro roteiro antes de seguir para as etapas de produção." : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${activeStage === id ? "bg-cyan-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"} disabled:cursor-not-allowed disabled:opacity-35`}>{label}{id === "decisions" && network.pendingDecisions > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-slate-950">{network.pendingDecisions}</span>}{id === "structure" && structureDirty && <span className="text-[10px] text-amber-300">(não salvo)</span>}</button>;
          })}
        </nav>

        {activeStage === "channels" && <div id="dark-panel-channels" role="tabpanel" aria-label="Canais" className="space-y-4">
          <DarkChannelsPlanning network={network} loading={loading} filters={filters} onFiltersChange={setFilters} selectedId={selectedChannelId} onSelect={selectChannel}
            showForm={showChannelForm} onCloseForm={() => setShowChannelForm(false)} saving={saving} onSavingChange={setSaving} onError={setError} onNotice={setNotice}
            onChannelCreated={channelCreated} onChannelUpdated={channelUpdated}
            detailActions={<button type="button" onClick={() => saveAndSetStage("scripts")} className="inline-flex items-center gap-2 rounded-lg border border-cyan-800 px-3 py-2 text-sm text-cyan-200 hover:border-cyan-500"><FolderOpen size={15}/>Ir para Pastas e roteiros</button>}
            detailOverview={selectedChannel && <div aria-label="Visão do canal" role="group" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3"><p className="text-sm text-slate-400">{(selectedChannel.topic_folders || []).length} pastas · {scripts.length} roteiros · {(selectedChannel.materials || []).length} materiais organizados</p>{publishingSelect}<nav aria-label="Etapas do canal" className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-4">{workflowTabs.filter(([id]) => !planningTabs.includes(id)).map(([id, label]) => { const needsFirstScript = id === "materials" && scripts.length === 0; return <button key={id} type="button" disabled={needsFirstScript} title={needsFirstScript ? "Crie o primeiro roteiro antes de cadastrar materiais." : undefined} onClick={() => saveAndSetStage(id)} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:border-cyan-700 hover:bg-cyan-950/20 disabled:cursor-not-allowed disabled:opacity-35"><span>{label}</span><span aria-hidden="true" className="text-cyan-400">→</span></button>; })}</nav></div>}/>
        </div>}
        {activeStage === "decisions" && <div id="dark-panel-decisions" role="tabpanel" aria-label="Decisões" className={panel}><DarkDecisions structure={structure} onStructureChange={setStructure}/></div>}
        {activeStage === "structure" && <div id="dark-panel-structure" role="tabpanel" aria-label="Nichos e idiomas" className={panel}><DarkStructureEditor structure={structure} onStructureChange={setStructure} onDirtyChange={setStructureDirty}/></div>}

        {!isPlanningStage && <section className="min-w-0 space-y-4">
          {selectedChannel && <section className={`${panel} flex flex-wrap items-center justify-between gap-3`}><div><h2 className="text-lg font-bold text-white">{selectedChannel.name}</h2><p className="text-xs text-slate-400">Espaço independente do Canais Dark · dados organizados por canal e roteiro.</p></div>{publishingSelect}</section>}
          {selectedChannel && <section aria-label="Roteiros deste canal" className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
            <span className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Roteiros</span>
            <div role="tablist" aria-label="Roteiros do canal" className="flex min-w-0 flex-wrap gap-2">
              <button type="button" role="tab" aria-selected={!selectedScriptId} onClick={() => { void flushScriptSave().catch(() => {}); setSelectedScriptId(""); setPipelineScriptId(""); }} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${!selectedScriptId ? "border-cyan-500 bg-cyan-950/40 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>Todo o canal</button>
              {scripts.filter((script) => script.status !== "archived").map((script) => <button key={script.id} type="button" role="tab" aria-selected={script.id === selectedScriptId} onClick={() => { void flushScriptSave().catch(() => {}); setSelectedScriptId(script.id); setPipelineScriptId(""); }} className={`max-w-56 truncate rounded-lg border px-3 py-2 text-xs font-semibold ${script.id === selectedScriptId ? "border-cyan-500 bg-cyan-950/40 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>{script.title || script.topic}</button>)}
            </div>
            <button type="button" onClick={() => setShowQuickScriptForm((value) => !value)} className="rounded-lg border border-dashed border-cyan-800 px-3 py-2 text-xs font-semibold text-cyan-200"><Plus size={13} className="mr-1 inline"/>Novo roteiro</button>
            {showQuickScriptForm && <form onSubmit={submitScript} className="flex min-w-64 flex-1 gap-2">
              <input aria-label="Tema do novo roteiro" className={input} required maxLength={240} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Tema do próximo vídeo"/>
              <button type="submit" disabled={saving || !topic.trim()} className="shrink-0 rounded-lg bg-cyan-500 px-3 text-xs font-bold text-slate-950">Criar</button>
            </form>}
          </section>}
          <section id={`dark-panel-${activeStage}`} role="tabpanel" aria-label={workflowTabs.find(([id]) => id === activeStage)?.[1]} className={`${panel} min-h-[360px] space-y-4`}>
            {!selectedChannel ? activeStage === "video" ? <div className="space-y-3"><p className="rounded-lg border border-cyan-900/50 bg-cyan-950/10 px-3 py-2 text-sm text-slate-300">O estúdio de geração já pode ser usado. Ao selecionar um canal e roteiro, o contexto deles será enviado ao pipeline automaticamente.</p><VideoGeneration embedded workspaceKey="canais-dark:rascunho-avulso" productLabel="Canais Dark · geração audiovisual" /></div> : <div className="space-y-4"><p className="text-sm text-slate-300">Esta etapa salva dados no canal. Crie ou selecione um canal para organizar materiais, roteiros e entregas sem misturar com o MediaMind.</p><button type="button" onClick={() => { saveAndSetStage("channels"); setShowChannelForm(true); }} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950"><Plus size={15} className="mr-1 inline"/>Criar canal</button></div> : <>
              {activeStage === "scripts" && <div className="grid gap-4 lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)]"><div className="space-y-3"><h3 className="font-bold text-white">Pastas de assuntos</h3><form onSubmit={addFolder} className="flex gap-2"><input aria-label="Nome da pasta de assuntos" className={input} maxLength={120} value={folderDraft} onChange={(event) => setFolderDraft(event.target.value)} placeholder="Nova pasta"/><button type="submit" aria-label="Adicionar pasta" disabled={saving || !folderDraft.trim()} className="rounded-lg bg-cyan-500 px-3 text-slate-950"><Plus size={16}/></button></form><div className="space-y-1"><button type="button" aria-pressed={!workflowDraft.folder_name} onClick={() => void assignFolder("")} className="w-full rounded border border-slate-800 p-2 text-left text-sm text-slate-200">Sem pasta</button>{(selectedChannel.topic_folders || []).map((folder) => <button key={folder} type="button" aria-pressed={workflowDraft.folder_name === folder} onClick={() => void assignFolder(folder)} className="w-full rounded border border-slate-800 p-2 text-left text-sm text-slate-200">{folder}</button>)}</div><form onSubmit={submitScript} className="space-y-2 border-t border-slate-800 pt-3"><label className="block text-xs text-slate-300">Tema do roteiro<input aria-label="Tema do roteiro" className={`${input} mt-1`} required maxLength={240} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Tema do próximo vídeo"/></label><button type="submit" disabled={saving} className="rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-200"><Plus size={15} className="mr-1 inline"/>Criar roteiro</button></form></div><div className="space-y-3"><h3 className="font-bold text-white">Roteiros do canal</h3><div className="grid gap-2 sm:grid-cols-2">{scripts.map((script) => <button key={script.id} type="button" aria-pressed={script.id === selectedScriptId} onClick={() => { void flushScriptSave().catch(() => {}); setSelectedScriptId(script.id); setPipelineScriptId(""); }} className={`rounded-lg border p-3 text-left ${script.id === selectedScriptId ? "border-cyan-600 bg-cyan-950/20" : "border-slate-800"}`}><span className="block font-semibold text-white">{script.title || script.topic}</span><span className="mt-1 block text-xs text-slate-400">{script.workflow?.folder_name || "Sem pasta"} · {script.status}</span></button>)}</div>{selectedScript && <div className="space-y-2 border-t border-slate-800 pt-3"><h4 className="font-semibold text-white">{selectedScript.title || selectedScript.topic}</h4><textarea aria-label="Texto do roteiro" className={`${input} min-h-44 resize-y`} maxLength={200000} value={scriptText} onChange={(event) => scheduleScriptSave(selectedScript.id, event.target.value)} onBlur={() => { void flushScriptSave().catch(() => {}); }} placeholder="Escreva ou cole seu roteiro"/><div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void flushScriptSave().then(() => setNotice("Roteiro salvo.")).catch(() => {})} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs"><Save size={13}/>Salvar roteiro</button><button type="button" disabled={saving || !scriptText.trim()} onClick={() => void updateScript({ status: "in_review" })} className="rounded-lg border border-amber-700 px-3 py-2 text-xs text-amber-200">Enviar para validação</button><button type="button" disabled={saving || selectedScript.status !== "in_review"} onClick={() => void updateScript({ status: "approved" })} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-200">Aprovar roteiro</button><button type="button" disabled={saving} onClick={() => { setPipelineScriptId(selectedScript.id); saveAndSetStage("video"); }} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950"><Sparkles size={14} className="mr-1 inline"/>Abrir no pipeline</button></div></div>}</div></div>}
              {activeStage === "materials" && <div className="space-y-4"><div><h3 className="font-bold text-white">Materiais próprios do canal</h3><p className="text-xs text-slate-400">Este acervo é exclusivo do Canais Dark. Cadastre referências criadas ou escolhidas para publicar na internet; nada é importado da Produção MediaMind.</p><p className="mt-1 text-xs text-cyan-200">Canal: {selectedChannel.name} · roteiro ativo: {selectedScript?.title || selectedScript?.topic}</p></div><form onSubmit={addMaterial} className="grid gap-2 md:grid-cols-[1fr_2fr_140px_auto]"><input aria-label="Nome do material" className={input} required maxLength={160} value={materialDraft.title} onChange={(event) => setMaterialDraft({ ...materialDraft, title: event.target.value })} placeholder="Nome do material"/><input aria-label="Link do material" className={input} required type="url" value={materialDraft.reference} onChange={(event) => setMaterialDraft({ ...materialDraft, reference: event.target.value })} placeholder="https://…"/><select aria-label="Tipo do material" className={input} value={materialDraft.kind} onChange={(event) => setMaterialDraft({ ...materialDraft, kind: event.target.value })}><option value="link">Link</option><option value="video">Vídeo</option><option value="audio">Áudio</option><option value="image">Imagem</option><option value="document">Documento</option></select><button type="submit" disabled={saving} className="rounded-lg bg-cyan-500 px-3 font-bold text-slate-950">Adicionar material</button></form><div className="grid gap-2 sm:grid-cols-2">{(selectedChannel.materials || []).map((item, index) => { const linked = workflowDraft.materials.some((material) => material.reference === item.reference); return <article key={`${item.reference}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="min-w-0"><strong className="block truncate text-sm text-white">{item.title}</strong><span className="text-xs text-slate-400">{item.kind}</span> <a className="ml-2 text-xs text-cyan-300" href={item.reference} target="_blank" rel="noreferrer">Prévia ↗</a></div>{selectedScript && <button type="button" disabled={saving || linked} onClick={() => void attachChannelMaterial(item)} className="shrink-0 rounded border border-cyan-800 px-2 py-1 text-xs text-cyan-200 disabled:opacity-50">{linked ? "No roteiro" : "Vincular ao roteiro"}</button>}</article>; })}</div>{!(selectedChannel.materials || []).length && <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">Nenhum material próprio cadastrado neste canal ainda.</p>}{selectedScript && !!workflowDraft.materials.length && <p className="text-xs text-slate-500">{workflowDraft.materials.length} materiais vinculados ao roteiro “{selectedScript.title || selectedScript.topic}”.</p>}</div>}
              {activeStage === "video" && <div className="space-y-3"><div className="rounded-lg border border-cyan-900/50 bg-cyan-950/10 px-3 py-2"><h3 className="font-bold text-white">Geração de vídeo para {selectedChannel.name}</h3><p className="mt-1 text-xs text-slate-400">Este é o pipeline original de 8 etapas. Com um roteiro ativo, tema, texto, nicho, público, idioma, formato e materiais vinculados entram como contexto; sem roteiro ativo, você pode criar um projeto livre neste canal. Cada roteiro e projeto fica separado; apenas a conexão de IA cadastrada é compartilhada.</p></div>{pipelineScript ? <VideoGeneration key={pipelineScript.id} embedded workspaceKey={`canais-dark:${selectedChannel.id}:${pipelineScript.id}`} productLabel="Canais Dark · geração audiovisual" initialDraft={activePipelineDraft} onDraftChange={(value) => scheduleScriptSave(pipelineScript.id, value)} /> : selectedScript ? <VideoGeneration key={selectedScript.id} embedded workspaceKey={`canais-dark:${selectedChannel.id}:${selectedScript.id}`} productLabel="Canais Dark · geração audiovisual" initialDraft={{ id: selectedScript.id, title: selectedScript.title || selectedScript.topic, topic: selectedScript.topic, script: selectedScript.script || "", channelName: selectedChannel.name, channelAudience: selectedChannel.audience || "", language: selectedChannel.language || "pt-BR", availableAssets: scriptMaterialsForVideo(selectedScript), niche: selectedChannel.niche, format: selectedChannel.format || "long" }} onDraftChange={(value) => scheduleScriptSave(selectedScript.id, value)} /> : <VideoGeneration embedded workspaceKey={`canais-dark:${selectedChannel.id}:projeto-livre`} productLabel="Canais Dark · geração audiovisual" initialDraft={{ channelName: selectedChannel.name, channelAudience: selectedChannel.audience || "", language: selectedChannel.language || "pt-BR", niche: selectedChannel.niche, format: selectedChannel.format || "long" }} />}</div>}
              {activeStage === "thumbs" && <ThumbnailStudio key={`${selectedChannel.id}:${selectedScript?.id || "canal"}`} darkChannelId={selectedChannel.id} darkScriptId={selectedScript?.id} workspaceKey={`canais-dark:${selectedChannel.id}:${selectedScript?.id || "canal"}:thumbs`} initialTitle={workflowDraft.thumbnail_title || selectedScript?.title || selectedScript?.topic || selectedChannel.name} initialChannelName={selectedChannel.name} thumbnailContext={{ channel: { name: selectedChannel.name, niche: selectedChannel.niche, audience: selectedChannel.audience, language: selectedChannel.language, format: selectedChannel.format }, folders: selectedChannel.topic_folders || [], scripts: scripts.map((item) => ({ title: item.title, topic: item.topic, script: item.id === selectedScript?.id ? scriptText || item.script : item.script })), selectedScript: selectedScript ? { title: selectedScript.title, topic: selectedScript.topic, script: scriptText || selectedScript.script, materials: workflowDraft.materials || selectedScript.workflow?.materials || [] } : null, materials: selectedChannel.materials || [] }} />}
              {activeStage === "cuts" && <ClipsFree key={`${selectedChannel.id}:${selectedScript?.id || "canal"}`} darkChannelId={selectedChannel.id} darkScriptId={selectedScript?.id} workspaceKey={`canais-dark:${selectedChannel.id}:${selectedScript?.id || "canal"}:cuts`} initialTitle={selectedScript?.title || selectedScript?.topic || selectedChannel.name} onDraftChange={(session) => {
                const cuts = (session.suggestions || []).map((cut, index) => ({ label: cut.title || `Corte ${index + 1}`, start_seconds: Number(cut.start) || 0, end_seconds: Number(cut.end) || 0 })).filter((cut) => cut.end_seconds > cut.start_seconds);
                if (selectedScript) patchWorkflow({ cuts });
              }} />}
              {activeStage === "review" && <div className="space-y-4"><div><h3 className="font-bold text-white">Revisão final e publicação</h3><p className="text-xs text-slate-400">Título, descrição, thumb, formato, redes e data ficam juntos aqui para revisar tudo antes de enviar.</p></div>{selectedScript ? <>
                <label className="block text-xs text-slate-300">Título de publicação<input aria-label="Título de publicação" className={`${input} mt-1`} maxLength={200} value={workflowDraft.final_title} onChange={(event) => patchWorkflow({ final_title: event.target.value })}/></label>
                <label className="block text-xs text-slate-300">Descrição<textarea aria-label="Descrição do vídeo" className={`${input} mt-1 min-h-28`} maxLength={5000} value={workflowDraft.description} onChange={(event) => patchWorkflow({ description: event.target.value })}/></label>
                <label className="block text-xs text-slate-300">Tags, separadas por vírgulas<input aria-label="Tags do vídeo" className={`${input} mt-1`} value={workflowDraft.tags.join(", ")} onChange={(event) => patchWorkflow({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30) })}/></label>
                <label className="block text-xs text-slate-300">Título da thumbnail<input aria-label="Título da thumbnail" className={`${input} mt-1`} maxLength={160} value={workflowDraft.thumbnail_title} onChange={(event) => patchWorkflow({ thumbnail_title: event.target.value })}/></label>
                <label className="block text-xs text-slate-300">Imagem final da thumbnail (URL)<input aria-label="Imagem da thumbnail" className={`${input} mt-1`} type="url" value={workflowDraft.thumbnail_reference} onChange={(event) => patchWorkflow({ thumbnail_reference: event.target.value })} placeholder="https://…"/></label>
                {workflowDraft.thumbnail_reference && <img src={workflowDraft.thumbnail_reference} alt="Prévia da thumbnail" className="max-h-56 max-w-full rounded-lg border border-slate-700 object-contain"/>}
                <button type="button" onClick={() => saveAndSetStage("thumbs")} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-cyan-200">Abrir e conferir no Estúdio de Arte</button>
                <div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-300">Formato do vídeo<select aria-label="Formato do vídeo" className={`${input} mt-1`} value={workflowDraft.video_format} onChange={(event) => patchWorkflow({ video_format: event.target.value })}><option value="16:9">Horizontal · 16:9</option><option value="9:16">Vertical · 9:16 (Shorts/Reels/TikTok)</option><option value="1:1">Quadrado · 1:1</option></select></label>
                  <fieldset className="space-y-2"><legend className="text-xs text-slate-300">Canais de publicação</legend><div className="flex flex-wrap gap-3">{[["youtube", "YouTube"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["facebook", "Facebook"]].map(([value, label]) => <label key={value} className="inline-flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={(workflowDraft.target_channels || []).includes(value)} onChange={(event) => patchWorkflow({ target_channels: event.target.checked ? [...new Set([...(workflowDraft.target_channels || []), value])] : (workflowDraft.target_channels || []).filter((item) => item !== value) })}/>{label}</label>)}</div></fieldset>
                </div>
                <label className="block max-w-md text-xs text-slate-300">Data e hora para publicar<input aria-label="Data e hora de publicação" className={`${input} mt-1`} type="datetime-local" value={workflowDraft.scheduled_at?.slice(0, 16) || ""} onChange={(event) => patchWorkflow({ scheduled_at: event.target.value ? new Date(event.target.value).toISOString() : "" })}/></label>
                <p className="text-xs text-amber-300">Salvar a data organiza a fila; a publicação automática só será ativada depois de conectar e autorizar cada rede.</p>
                <div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void saveWorkflow()} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950">Salvar revisão e programação</button><button type="button" disabled={saving || !scriptText.trim()} onClick={() => void updateScript({ status: "in_review" })} className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-200">Enviar para validação</button><button type="button" disabled={saving || selectedScript.status !== "in_review"} onClick={() => void updateScript({ status: "approved" })} className="rounded-lg border border-emerald-700 px-3 py-2 text-sm text-emerald-200">Aprovar</button></div>
                <p className="text-xs text-slate-500">Status atual: {selectedScript.status} · validação: {selectedScript.validation_status}</p>
              </> : <p className="text-sm text-slate-400">Escolha uma aba de roteiro acima ou crie um roteiro pelo botão “Novo roteiro”.</p>}</div>}
              {activeStage === "published" && <div className="space-y-4"><div><h3 className="font-bold text-white">Agendados e publicados</h3><p className="text-xs text-slate-400">Fila montada com os dados reais salvos em cada roteiro deste canal.</p></div>
                {publicationItems.length ? <div className="grid gap-2 lg:grid-cols-2">{publicationItems.map((script) => { const workflow = script.workflow || {}; const isPublished = Boolean(workflow.published_at || workflow.publication_url); return <button key={script.id} type="button" onClick={() => setSelectedScriptId(script.id)} className={`rounded-lg border p-3 text-left ${selectedScriptId === script.id ? "border-cyan-600 bg-cyan-950/20" : "border-slate-800 bg-slate-950/50"}`}><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-white">{workflow.final_title || script.title || script.topic}</strong><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${isPublished ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-300"}`}>{isPublished ? "Publicado" : "Agendado"}</span></span><span className="mt-1 block text-xs text-slate-400">{(workflow.target_channels || []).map((channel) => publishingChannelLabels[channel] || channel).join(", ") || "Rede não definida"} · {isPublished ? workflow.published_at || "URL registrada" : workflow.scheduled_at}</span>{workflow.publication_url && <span className="mt-1 block truncate text-xs text-cyan-300">{workflow.publication_url}</span>}</button>; })}</div> : <p className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">Ainda não há vídeos agendados nem publicados neste canal. Selecione um roteiro e preencha a data na Revisão final.</p>}
                {selectedScript && <div className="space-y-2 border-t border-slate-800 pt-3"><h4 className="font-semibold text-white">Registrar publicação externa</h4><label className="block max-w-2xl text-xs text-slate-300">URL pública<input aria-label="URL publicada" className={`${input} mt-1`} type="url" value={workflowDraft.publication_url} onChange={(event) => patchWorkflow({ publication_url: event.target.value })} placeholder="https://youtube.com/watch?v=…"/></label><label className="block max-w-md text-xs text-slate-300">Data da publicação<input aria-label="Data publicada" className={`${input} mt-1`} type="datetime-local" value={workflowDraft.published_at?.slice(0, 16) || ""} onChange={(event) => patchWorkflow({ published_at: event.target.value ? new Date(event.target.value).toISOString() : "" })}/></label><button type="button" disabled={saving || !workflowDraft.publication_url} onClick={() => void saveWorkflow()} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950">Registrar publicação</button></div>}
              </div>}
              {activeStage === "analytics" && <div className="space-y-4"><div><h3 className="font-bold text-white">Analytics das redes</h3><p className="text-xs text-slate-400">Este painel só exibirá dados retornados pelas APIs oficiais das contas conectadas.</p></div><div className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4"><strong className="text-sm text-amber-200">Nenhuma rede social conectada</strong><p className="mt-2 text-sm text-slate-300">Não há integração de publicação/analytics configurada neste produto ainda. Por isso, não mostramos números de demonstração nem métricas digitadas manualmente como se fossem dados reais.</p><p className="mt-2 text-xs text-slate-400">Para ativar, é necessário configurar as credenciais OAuth/API de cada rede e autorizar as contas do canal. A configuração de IA não substitui essas credenciais.</p></div>{selectedScript && <p className="text-xs text-slate-500">Roteiro em contexto: {workflowDraft.final_title || selectedScript.title || selectedScript.topic} · redes desejadas: {(workflowDraft.target_channels || []).join(", ") || "não definidas na Revisão final"}</p>}</div>}
            </>}
          </section>
        </section>}
      </div>

      <DarkStructureDialog open={showStructure} onOpenChange={setShowStructure} structure={structure} structureError={structureError} channelsCount={network.visible.length} onImported={async () => { await Promise.all([loadChannels(), loadStructure()]); }}/>
    </main>
  );
}
