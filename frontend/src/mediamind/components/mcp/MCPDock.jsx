import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AudioLines, Bot, ChevronDown, ExternalLink, FileSpreadsheet, FileText, History,
  Image, PenTool, Plus, Presentation, Settings, Sparkles, Video, WandSparkles, X,
} from "lucide-react";

import { createMCPQueue, executeMCPQueue, listMCPQueues, listMCPTools } from "../../lib/mcpApi";
import { useProducaoProjetos } from "../../lib/producaoStore";
import MCPCenter from "../ai-tools/MCPCenter";

const APPS = [
  { id: "mmfilm", module: "mmfilm", short: "MF", label: "MMFilm", title: "MMFilm", icon: Video, color: "violet", href: "/ferramentas-graficas?tool=filmcraft" },
  { id: "mmeffects", module: "mmeffects", short: "ME", label: "MMEffects", title: "MMEffects", icon: WandSparkles, color: "indigo", href: "/ferramentas-graficas?tool=effectcraft" },
  { id: "mmphoto", module: "mmphoto", short: "MP", label: "MMPhoto", title: "MMPhoto", icon: Image, color: "sky", href: "/ferramentas-graficas?tool=photocraft" },
  { id: "mmvector", module: "vetor", short: "MV", label: "MMVector", title: "MMVector", icon: PenTool, color: "orange", href: "/ferramentas-graficas?tool=vectorcraft" },
  { id: "mmsom", module: "mmsom", short: "MS", label: "MMSom", title: "MMSom", icon: AudioLines, color: "cyan", href: "/ferramentas-graficas?tool=mmsom" },
  { id: "word", module: "word", short: "W", label: "Word", title: "Word", icon: FileText, color: "blue", href: "/ferramentas-graficas?tool=word" },
  { id: "excel", module: "excel", short: "X", label: "Excel", title: "Excel", icon: FileSpreadsheet, color: "green", href: "/ferramentas-graficas?tool=excel" },
  { id: "powerpoint", module: "powerpoint", short: "P", label: "PowerPoint", title: "PowerPoint", icon: Presentation, color: "orange", href: "/ferramentas-graficas?tool=powerpoint" },
  { id: "ai", module: "ai-tools", short: "AI", label: "IA", title: "Ferramentas IA e Editoração", icon: Sparkles, color: "fuchsia", href: "/ferramentas-ia" },
];

const BASE_COMMANDS = {
  mmfilm: ["Montar sequência", "Cortar trechos (IN / OUT)", "Criar legendas automáticas", "Ajustar áudio e normalização", "Aplicar transições e efeitos", "Preparar exportação"],
  mmeffects: ["Criar composição", "Animar elementos", "Aplicar efeitos", "Preparar renderização"],
  mmsom: ["Limpar voz", "Remover ruído", "Normalizar loudness", "Preparar masterização"],
  mmphoto: ["Tratar imagem", "Remover fundo", "Criar thumbnail", "Gerar variações"],
  mmvector: ["Criar vetor", "Ajustar logotipo", "Preparar SVG", "Gerar elementos gráficos"],
  word: ["Criar documento", "Revisar texto", "Resumir conteúdo", "Exportar DOCX ou PDF"],
  excel: ["Criar planilha", "Organizar dados", "Gerar gráficos", "Exportar XLSX ou CSV"],
  powerpoint: ["Montar apresentação", "Gerar slides", "Aplicar template", "Exportar PPTX ou PDF"],
  ai: ["Planejar fluxo entre aplicativos", "Localizar mídia", "Resumir projeto", "Criar automação"],
};

function contextualCommands(appId, location) {
  const params = new URLSearchParams(location.search);
  const sub = params.get("sub");
  const commands = [...(BASE_COMMANDS[appId] || [])];
  if (appId === "mmfilm" && sub === "pesquisa") commands.unshift("Importar mídias selecionadas");
  if (appId === "mmfilm" && sub === "workspace") commands.unshift("Importar mídias selecionadas");
  if (appId === "mmfilm" && ["em_edicao", "redes_sociais"].includes(sub)) commands.unshift("Inspecionar timeline ativa");
  if (appId === "mmsom" && sub === "workspace") commands.unshift("Analisar áudios selecionados");
  return [...new Set(commands)].slice(0, 8);
}

export default function MCPDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState(null);
  const [width, setWidth] = useState(() => Number(localStorage.getItem("mm_mcp_dock_width_v2")) || 720);
  const [modules, setModules] = useState([]);
  const [tab, setTab] = useState("commands");
  const [expressDraft, setExpressDraft] = useState(null);

  useEffect(() => {
    listMCPTools().then((data) => setModules(data.modules || [])).catch(() => setModules([]));
  }, []);
  useEffect(() => {
    const open = (event) => {
      const target = APPS.find((item) => item.id === event.detail?.appId);
      if (!target) return;
      setExpressDraft(event.detail || null);
      if (`${location.pathname}${location.search}` !== target.href) navigate(target.href);
      setActive(target.id);
      setTab("commands");
    };
    window.addEventListener("mm:mcp-open", open);
    return () => window.removeEventListener("mm:mcp-open", open);
  }, [location.pathname, location.search, navigate]);
  useEffect(() => localStorage.setItem("mm_mcp_dock_width_v2", String(width)), [width]);

  const app = APPS.find((item) => item.id === active);
  const activePageApp = useMemo(() => APPS.find((item) => {
    const destination = new URL(item.href, window.location.origin);
    if (item.id === "ai") return destination.pathname === location.pathname;
    return destination.pathname === location.pathname && destination.search === location.search;
  }), [location.pathname, location.search]);
  const moduleStatus = useMemo(() => Object.fromEntries(modules.map((item) => [item.id, item.status])), [modules]);
  const commands = app ? contextualCommands(app.id, location) : [];

  function toggle(id) {
    const target = APPS.find((item) => item.id === id);
    if (target?.href) {
      navigate(target.href);
      setActive(id);
      return;
    }
    setActive((current) => current === id ? null : id);
    setTab("commands");
  }

  function startResize(event) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (moveEvent) => setWidth(Math.max(560, Math.min(900, startWidth + startX - moveEvent.clientX)));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const connected = app && moduleStatus[app.module] === "connected";

  return <div data-testid="mcp-dock" className="sticky right-0 top-0 z-[55] flex h-screen shrink-0 self-start pointer-events-none">
    {active === "settings" && <aside role="dialog" aria-label="Configuração MCP" style={{ width: Math.max(width, 640) }} className="pointer-events-auto relative flex h-full flex-col border-l border-sky-900/70 bg-[#03101f]/[.98] shadow-2xl shadow-black/60">
      <button aria-label="Redimensionar painel MCP" onMouseDown={startResize} className="absolute inset-y-0 left-0 w-1.5 cursor-col-resize bg-transparent hover:bg-sky-500/70" />
      <header className="flex items-center border-b border-slate-800 p-4"><Settings className="mr-3 text-sky-300" size={20}/><div className="flex-1"><h2 className="text-base font-bold text-white">Configuração MCP</h2><p className="text-xs text-slate-400">{activePageApp ? `${activePageApp.label} selecionado para configuração` : "Configuração geral do MediaMind"}</p></div><button aria-label="Fechar painel MCP" onClick={() => setActive(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18}/></button></header>
      <div className="flex-1 overflow-y-auto p-4">
        <MCPCenter initialModule={activePageApp?.module || "system"} />
        <button onClick={() => { setActive(null); navigate("/configuracoes/ia"); }} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-sky-900/70 bg-sky-950/30 p-4 text-left text-sm text-sky-200 hover:border-sky-500 hover:bg-sky-950/60">
          <Sparkles size={18}/><span><strong className="block text-white">Configuração de IA</strong><small className="text-slate-400">Provedores, modelos e conexões por empresa</small></span><ChevronDown className="ml-auto -rotate-90" size={16}/>
        </button>
      </div>
    </aside>}
    {app && <aside role="dialog" aria-label={`Painel MCP ${app.label}`} style={{ width }} className="pointer-events-auto relative flex h-full flex-col border-l border-sky-900/70 bg-[#03101f]/[.98] shadow-2xl shadow-black/60">
      <button aria-label="Redimensionar painel MCP" onMouseDown={startResize} className="absolute inset-y-0 left-0 w-1.5 cursor-col-resize bg-transparent hover:bg-sky-500/70" />
      <header className="border-b border-slate-800 p-4">
        <div className="flex items-center gap-3"><AppMark app={app} large /><div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold text-white">{app.title}</h2><div className={`mt-1 flex items-center gap-1.5 text-xs ${connected ? "text-emerald-400" : "text-amber-300"}`}><span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />{connected ? "Conectado" : "Planejado"}</div></div><button aria-label="Fechar painel MCP" onClick={() => setActive(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button></div>
        <button disabled={!connected} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-sky-600 px-3 py-2 text-xs font-bold text-sky-300 disabled:border-slate-700 disabled:text-slate-600"><ExternalLink size={14} />{connected ? `Abrir no ${app.label}` : "Ponte local ainda não instalada"}</button>
      </header>
      <div className="flex border-b border-slate-800 px-4"><button onClick={() => setTab("commands")} className={`flex-1 border-b-2 py-3 text-xs font-semibold ${tab === "commands" ? "border-sky-400 text-sky-300" : "border-transparent text-slate-500"}`}>Comandos</button><button onClick={() => setTab("history")} className={`flex-1 border-b-2 py-3 text-xs font-semibold ${tab === "history" ? "border-sky-400 text-sky-300" : "border-transparent text-slate-500"}`}>Histórico</button></div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "history" ? <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-slate-800 p-6 text-center"><div><History className="mx-auto text-slate-600" /><p className="mt-3 text-sm text-slate-400">Nenhuma execução nesta sessão.</p><p className="mt-1 text-xs text-slate-600">Resultados e pedidos de confirmação aparecerão aqui.</p></div></div> : <>
          <MCPActionPlanner module={app.module} appId={app.id} label={app.label} commands={commands} expressDraft={expressDraft} />
          <h3 className="mt-5 text-xs font-bold text-white">Projeto conectado</h3><div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs"><p className="font-semibold text-slate-300">Nenhum projeto MM conectado</p><p className="mt-1 text-slate-600">A ponte local identificará o projeto e a sequência ativos.</p></div>
          <button onClick={() => toggle("settings")} className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-800 p-3 text-xs text-slate-400"><span className="flex items-center gap-2"><Settings size={14}/>Configurações e preferências</span><ChevronDown size={14}/></button>
        </>}
      </div>
    </aside>}
    <nav aria-label="Aplicativos MCP" className="pointer-events-auto flex h-full w-16 flex-col items-center border-l border-slate-800 bg-[#071426]/[.98] py-3 shadow-xl">
      <div className="mb-2 flex w-14 flex-col items-center rounded-lg border border-sky-900/70 bg-sky-950/30 px-1 py-2 text-sky-300"><Bot size={17}/><strong className="mt-1 text-[10px] tracking-[0.16em]">MCP</strong></div>
      {APPS.map((item) => <button key={item.id} aria-label={`${item.label} — ${moduleStatus[item.module] === "connected" ? "conectado" : "planejado"}`} onClick={() => toggle(item.id)} className={`group mb-1 w-14 rounded-lg border py-2 transition ${active === item.id ? "border-sky-500 bg-sky-500/10" : "border-transparent hover:border-slate-700 hover:bg-slate-900"}`}><AppMark app={item}/><span className="mt-1 block truncate text-[9px] text-slate-400">{item.label}</span></button>)}
      <button aria-label="Configuração MCP" onClick={() => toggle("settings")} className={`mb-1 w-14 rounded-lg border py-2 transition ${active === "settings" ? "border-sky-500 bg-sky-500/10 text-sky-300" : "border-transparent text-slate-400 hover:border-slate-700"}`}><span className="mx-auto grid h-8 w-8 place-items-center rounded-lg border border-slate-600 bg-slate-900"><Settings size={17}/></span><span className="mt-1 block text-[9px]">Config.</span></button>
      <button aria-label="Adicionar aplicativos MCP" className="mt-auto w-14 rounded-lg border border-transparent py-2 text-slate-400 hover:border-slate-700"><span className="mx-auto grid h-8 w-8 place-items-center rounded-lg border border-violet-700"><Plus size={16}/></span><span className="mt-1 block text-[9px]">Apps</span></button>
    </nav>
  </div>;
}

function AppMark({ app, large = false }) {
  const Icon = app.icon;
  return <span className={`mx-auto grid ${large ? "h-10 w-10" : "h-8 w-8"} place-items-center rounded-lg border border-slate-600 bg-slate-900 text-sky-300`}><Icon size={large ? 20 : 17}/><span className="sr-only">{app.short}</span></span>;
}

function MCPActionPlanner({ module, appId, label, commands = [], expressDraft }) {
  const availableProjects = useProducaoProjetos();
  const [mode, setMode] = useState("immediate");
  const [instruction, setInstruction] = useState("");
  const [projectId, setProjectId] = useState("");
  const [newProject, setNewProject] = useState("");
  const [targets, setTargets] = useState([]);
  const [output, setOutput] = useState("internal");
  const [exportName, setExportName] = useState("");
  const [exportDestination, setExportDestination] = useState("downloads");
  const [queues, setQueues] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { listMCPQueues().then((data) => setQueues(data.queues || [])).catch(() => setQueues([])); }, []);
  useEffect(() => {
    if (!expressDraft || expressDraft.appId !== appId) return;
    const selected = (expressDraft.operations || []).filter((operation) => operation.enabled).map((operation) => operation.label);
    const next = [expressDraft.prompt?.trim(), ...selected].filter(Boolean).join("\n");
    if (next) setInstruction(next);
  }, [appId, expressDraft]);
  useEffect(() => {
    if (!instruction.trim()) return;
    setTargets((current) => current.map((target) => target.instruction.trim() ? target : { ...target, instruction }));
  }, [instruction]);
  async function submit() {
    if (!targets.length || !targets.every((target) => target.instruction.trim())) return;
    setSaving(true); setMessage("");
    try {
      const created = await createMCPQueue({
        name: mode === "immediate" ? `Ação imediata · ${label}` : `Fila ${label} · ${new Date().toLocaleString("pt-BR")}`,
        module,
        instruction: instruction.trim() || targets.map((target) => target.instruction).join("\n"),
        output_mode: output,
        execution_mode: mode,
        target_projects: targets.filter((target) => target.kind === "existing").map((target) => target.name),
        create_projects: targets.filter((target) => target.kind === "new").map((target) => target.name),
        targets,
        export_name: output === "external" ? exportName.trim() : null,
        export_destination: output === "external" ? exportDestination : null,
      });
      setQueues((current) => [created, ...current]); setInstruction(""); setTargets([]);
      setMessage(mode === "immediate" ? "Pedido registrado para confirmação de execução." : "Fila MCP criada como rascunho.");
    } catch (error) { setMessage(error?.message || "Não foi possível salvar o pedido MCP."); }
    finally { setSaving(false); }
  }
  function addExisting() {
    const project = availableProjects.find((item) => String(item._entityId || item.id) === projectId);
    if (!project || targets.some((target) => target.id === projectId)) return;
    setTargets((current) => [...current, { id: projectId, name: project.titulo || project.title || projectId, kind: "existing", instruction }]);
    setProjectId("");
  }
  function addNew() {
    const name = newProject.trim();
    if (!name) return;
    setTargets((current) => [...current, { id: `new-${Date.now()}`, name, kind: "new", instruction }]);
    setNewProject("");
  }
  function updateTarget(id, patch) {
    setTargets((current) => current.map((target) => target.id === id ? { ...target, ...patch } : target));
  }
  async function execute(queue) {
    setMessage("");
    try {
      await executeMCPQueue(queue.id);
      setMessage("A fila MCP foi enviada para execução.");
    } catch (error) {
      setMessage(error?.message || "A ponte local ainda não está disponível para executar esta fila.");
    }
  }
  const steps = ["Projeto e mídias", "Operações e prompt", "Pacote de tarefas", "Execução e fila"];
  const selectedCommands = commands.filter((command) => instruction.includes(command));
  return <section className="mt-4 rounded-2xl border border-violet-900/70 bg-violet-950/20 p-4" aria-label="Ações e filas MCP">
    <h3 className="text-sm font-bold text-white">Pedir ao MCP · {label}</h3><p className="mt-1 text-xs text-slate-400">Fluxo de quatro etapas. Veja duas por vez e avance quando estiver pronto.</p>
    <div className="mt-3 grid grid-cols-4 gap-1">{steps.map((step, index) => <button key={step} onClick={() => setPage(index < 2 ? 0 : 1)} className={`rounded-lg border p-2 text-left text-[10px] ${((page === 0 && index < 2) || (page === 1 && index > 1)) ? "border-sky-600 bg-sky-950/60 text-sky-100" : "border-slate-800 text-slate-500"}`}><span className="mr-1 inline-grid h-4 w-4 place-items-center rounded-full bg-sky-500 text-[9px] font-bold text-slate-950">{index + 1}</span>{step}</button>)}</div>
    {page === 0 && <div className="mt-3 grid grid-cols-2 gap-3">
      <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-xs font-semibold text-white">1. Projeto e mídias</p><p className="mt-1 text-[11px] text-slate-500">Selecione projetos existentes ou crie um novo para receber a operação.</p><div className="mt-3 flex gap-2"><select aria-label="Selecionar projeto existente" value={projectId} onChange={(event) => setProjectId(event.target.value)} className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white"><option value="">Selecionar projeto existente</option>{availableProjects.map((project) => <option key={project._entityId || project.id} value={String(project._entityId || project.id)}>{project.titulo || project.title}</option>)}</select><button onClick={addExisting} className="rounded border border-sky-700 px-2 text-xs text-sky-200">+ Adicionar</button></div><div className="mt-2 flex gap-2"><input aria-label="Nome do novo projeto" value={newProject} onChange={(event) => setNewProject(event.target.value)} placeholder="Novo projeto" className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white"/><button onClick={addNew} className="rounded border border-violet-700 px-2 text-xs text-violet-200">+ Novo</button></div><p className="mt-3 text-[11px] text-slate-500">{targets.length} projeto(s) selecionado(s)</p></section>
      <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-xs font-semibold text-white">2. Operações e prompt</p><label className="mt-2 block text-xs text-slate-300">Operações e prompt<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={`Descreva o que o ${label} deve fazer.`} className="mt-1 h-24 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white outline-none focus:border-sky-500"/></label><div className="mt-2 flex flex-wrap gap-1">{commands.map((command) => <button key={command} onClick={() => setInstruction((current) => current.includes(command) ? current.replace(command, "").replace(/^\s*\n|\n\s*$/g, "") : [current, command].filter(Boolean).join("\n"))} className={`rounded-full border px-2 py-1 text-[11px] ${instruction.includes(command) ? "border-sky-400 bg-sky-950 text-sky-100" : "border-slate-700 text-slate-400"}`}>{instruction.includes(command) ? "✓ " : "+ "}{command}</button>)}</div></section>
    </div>}
    {page === 1 && <div className="mt-3 grid grid-cols-2 gap-3">
      <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-white">3. Pacote de tarefas</p><span className="text-[11px] text-sky-300">{selectedCommands.length} operação(ões)</span></div><div className="mt-3 space-y-2">{selectedCommands.length ? selectedCommands.map((command, index) => <div key={command} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200"><span className="grid h-5 w-5 place-items-center rounded bg-sky-500 font-bold text-slate-950">{index + 1}</span><span className="flex-1">{command}</span><button aria-label={`Remover tarefa ${command}`} onClick={() => setInstruction((current) => current.replace(command, "").replace(/^\s*\n|\n\s*$/g, ""))} className="text-rose-300">Remover</button></div>) : <p className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">Selecione operações no passo 2.</p>}</div><button onClick={() => setPage(0)} className="mt-3 w-full rounded-lg border border-sky-800 py-2 text-xs text-sky-200">Editar operações</button></section>
      <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-xs font-semibold text-white">4. Execução e fila</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => setMode("immediate")} className={`rounded-lg border p-2 text-xs ${mode === "immediate" ? "border-sky-500 bg-sky-950 text-sky-200" : "border-slate-700 text-slate-400"}`}>Executar agora</button><button onClick={() => setMode("queue")} className={`rounded-lg border p-2 text-xs ${mode === "queue" ? "border-violet-500 bg-violet-950 text-violet-200" : "border-slate-700 text-slate-400"}`}>Adicionar à fila</button></div><div className="mt-2 flex gap-2"><button onClick={() => setOutput("internal")} className={`flex-1 rounded-lg border p-2 text-xs ${output === "internal" ? "border-emerald-500 text-emerald-200" : "border-slate-700 text-slate-400"}`}>Salvar interno</button><button onClick={() => setOutput("external")} className={`flex-1 rounded-lg border p-2 text-xs ${output === "external" ? "border-amber-500 text-amber-200" : "border-slate-700 text-slate-400"}`}>Exportar final</button></div>{output === "external" && <div className="mt-2 grid grid-cols-2 gap-2"><input aria-label="Nome do arquivo final" value={exportName} onChange={(event) => setExportName(event.target.value)} placeholder="Nome do arquivo" className="rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white"/><select aria-label="Destino do arquivo final" value={exportDestination} onChange={(event) => setExportDestination(event.target.value)} className="rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white"><option value="downloads">Downloads</option><option value="acervo">Acervo MediaMind</option><option value="drive">Pasta conectada</option></select></div>}<button disabled={!targets.length || !targets.every((target) => target.instruction.trim()) || saving} onClick={submit} className="mt-3 w-full rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:bg-slate-700 disabled:text-slate-400">{saving ? "Salvando…" : mode === "immediate" ? "Solicitar ação imediata" : "Adicionar à fila MCP"}</button></section>
    </div>}
    {targets.length > 0 && <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3"><p className="text-xs font-semibold text-white">Projetos selecionados</p>{targets.map((target) => <div key={target.id} className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2"><div className="flex items-center justify-between text-xs"><strong className="text-slate-200">{target.name}</strong><button onClick={() => setTargets((current) => current.filter((item) => item.id !== target.id))} className="text-rose-300">Remover</button></div><textarea value={target.instruction} onChange={(event) => updateTarget(target.id, { instruction: event.target.value })} placeholder="O que aplicar neste projeto?" className="mt-2 h-14 w-full resize-none rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white"/></div>)}</div>}
    <div className="mt-3 flex justify-between gap-2"><button disabled={page === 0} onClick={() => setPage(0)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-40">← Etapas 1 e 2</button><button disabled={page === 1} onClick={() => setPage(1)} className="rounded-lg border border-sky-700 px-3 py-2 text-xs text-sky-200 disabled:opacity-40">Etapas 3 e 4 →</button></div>
    {message && <p role="status" className="mt-2 text-xs text-sky-200">{message}</p>}
    {queues.length > 0 && <div className="mt-4 border-t border-violet-900 pt-3"><h4 className="text-xs font-bold text-white">Filas e pedidos MCP</h4>{queues.slice(0, 5).map((queue) => <div key={queue.id} className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-xs"><strong className="text-slate-200">{queue.name}</strong><span className="ml-2 text-sky-300">{queue.status === "draft" ? "Rascunho" : "Aguardando confirmação"}</span><p className="mt-1 text-slate-500">{queue.target_projects.length + queue.create_projects.length} projeto(s) · {queue.output_mode === "internal" ? "interno" : "arquivo final"}</p>{queue.status === "draft" && <button onClick={() => execute(queue)} className="mt-2 rounded border border-sky-700 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-950">Executar fila</button>}</div>)}</div>}
  </section>;
}
