import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, Play, Plus, Search, Sparkles, ToggleLeft, ToggleRight, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { createMCPQueue, listMCPTools } from "../../lib/mcpApi";

const EXPRESS_APPS = {
  filmcraft: { id: "mmfilm", module: "mmfilm", label: "MMFilm", actions: ["Ler timeline", "Inspecionar projeto", "Montar sequência", "Cortar trechos (IN / OUT)", "Remover silêncios", "Selecionar melhores cenas", "Criar legendas automáticas", "Adicionar imagens de apoio", "Inserir GC e artes", "Aplicar transições", "Ajustar áudio e normalização", "Ajustar cor e exposição", "Estabilizar imagem", "Preparar exportação"] },
  effectcraft: { id: "mmeffects", module: "mmeffects", label: "MMEffects", actions: ["Criar composição", "Animar títulos", "Criar lower third", "Aplicar transição", "Tracking e estabilização", "Chroma key", "Máscara e rotoscopia", "Aplicar efeitos", "Correção de cor", "Aplicar template", "Preparar renderização"] },
  photocraft: { id: "mmphoto", module: "mmphoto", label: "MMPhoto", actions: ["Recortar", "Remover fundo", "Ajustar luz e cor", "Retoque automático", "Corrigir pele", "Redimensionar imagem", "Criar thumbnail", "Aplicar identidade", "Inserir textos", "Gerar variações", "Exportar e salvar"] },
  vectorcraft: { id: "mmvector", module: "vetor", label: "MMVector", actions: ["Vetorizar", "Aplicar paleta", "Montar layout", "Criar variações", "Ajustar tipografia", "Gerar lower third", "Criar ícones", "Organizar pranchetas", "Preparar SVG", "Exportar PNG"] },
  mmsom: { id: "mmsom", module: "mmsom", label: "MMSom", actions: ["Limpar ruído", "Remover pausas", "Normalizar loudness", "Equalizar", "Comprimir", "De-esser", "Separar voz e música", "Misturar faixas", "Trilha e SFX", "Masterizar", "Exportar áudio"] },
  word: { id: "word", module: "word", label: "Word", actions: ["Criar documento", "Gerar roteiro", "Resumir conteúdo", "Revisar e reescrever", "Organizar seções", "Aplicar estilo", "Inserir referências", "Exportar DOCX ou PDF"] },
  excel: { id: "excel", module: "excel", label: "Excel", actions: ["Criar planilha", "Organizar dados", "Classificar dados", "Criar fórmula", "Gerar gráficos", "Validar dados", "Criar painel", "Exportar XLSX ou CSV"] },
  powerpoint: { id: "powerpoint", module: "powerpoint", label: "PowerPoint", actions: ["Montar apresentação", "Gerar slides", "Criar resumo visual", "Aplicar template", "Organizar slides", "Criar gráfico", "Revisar narrativa", "Exportar PPTX ou PDF"] },
  ai: { id: "ai", module: "ai-tools", label: "Ferramentas IA", actions: ["Executar prompt com IA cadastrada", "Transcrever", "Resumir", "Gerar cortes", "Classificar mídia", "Sugerir roteiro", "Gerar imagem", "Gerar vídeo", "Automatizar fluxo", "Exportar resultados"] },
};
function pageApp(location) { return location.pathname === "/ferramentas-ia" ? EXPRESS_APPS.ai : EXPRESS_APPS[new URLSearchParams(location.search).get("tool")] || EXPRESS_APPS.ai; }
const toOperation = (label) => ({ id: label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"), label, enabled: true });
const TARGETS = { timeline: { name: "Timeline aberta · Corte principal", kind: "timeline" }, project: { name: "Projeto aberto", kind: "project" }, assets: { name: "Mídias selecionadas", kind: "assets" } };

export default function MCPExpress() {
  const location = useLocation();
  const app = useMemo(() => pageApp(location), [location]);
  const [prompt, setPrompt] = useState(""); const [target, setTarget] = useState("timeline"); const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false); const [operations, setOperations] = useState(() => app.actions.slice(0, 4).map(toOperation));
  const [tools, setTools] = useState([]); const [running, setRunning] = useState([]); const [status, setStatus] = useState("");
  useEffect(() => { setOperations(app.actions.slice(0, 4).map(toOperation)); setQuery(""); setPickerOpen(false); setRunning([]); setStatus(""); }, [app.id]);
  useEffect(() => { listMCPTools().then((data) => setTools(data.tools || [])).catch(() => setTools([])); }, []);
  const choices = app.actions.filter((action) => action.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && !operations.some((operation) => operation.label === action));
  const enabledOperations = operations.filter((operation) => operation.enabled); const activeTarget = TARGETS[target];
  const addOperation = (label) => { setOperations((current) => current.some((operation) => operation.label === label) ? current : [...current, toOperation(label)]); setQuery(""); setPickerOpen(false); };
  const toggleOperation = (id) => setOperations((current) => current.map((operation) => operation.id === id ? { ...operation, enabled: !operation.enabled } : operation));
  const removeOperation = (id) => setOperations((current) => current.filter((operation) => operation.id !== id));
  const openPanel = () => window.dispatchEvent(new CustomEvent("mm:mcp-open", { detail: { appId: app.id } }));
  function matchingTool(label) {
    const normalized = label.toLocaleLowerCase("pt-BR");
    return tools.find((tool) => tool.module === app.module && tool.available && tool.title.toLocaleLowerCase("pt-BR") === normalized)
      || (app.id === "mmfilm" && normalized.includes("timeline") ? tools.find((tool) => tool.name === "mmfilm.timeline" && tool.available) : null)
      || (app.id === "mmfilm" && normalized.includes("inspecionar") ? tools.find((tool) => tool.name === "mmfilm.inspect" && tool.available) : null)
      || (app.id === "ai" && normalized === "executar prompt com ia cadastrada" ? tools.find((tool) => tool.name === "ai-tools.prompt" && tool.available) : null);
  }
  async function executeOperation(operation) {
    const tool = matchingTool(operation.label);
    if (!tool) { setStatus(`“${operation.label}” está no pacote, mas ainda precisa da ponte MCP de ${app.label} para executar.`); return false; }
    setRunning((current) => [...current, operation.id]);
    try {
      const instruction = [prompt.trim(), operation.label].filter(Boolean).join("\n");
      const result = await createMCPQueue({ name: `Express · ${app.label} · ${operation.label}`, module: app.module, tool_name: tool.name, instruction, output_mode: "internal", execution_mode: "immediate", target_projects: target === "project" ? [activeTarget.name] : [], create_projects: [], targets: [{ id: `express-${target}`, name: activeTarget.name, kind: activeTarget.kind, instruction }], export_name: null, export_destination: null });
      setStatus(result.status === "completed" ? `“${operation.label}” concluída.` : `“${operation.label}” foi enviada para execução.`); return true;
    } catch (error) { setStatus(error?.message || `Não foi possível executar “${operation.label}”.`); return false; }
    finally { setRunning((current) => current.filter((id) => id !== operation.id)); }
  }
  async function executeAll() {
    if (!enabledOperations.length) { setStatus("Ligue ao menos uma ação para executar."); return; }
    let executed = 0;
    for (const operation of enabledOperations) if (await executeOperation(operation)) executed += 1;
    const notExecuted = enabledOperations.length - executed;
    const missingNotice = notExecuted ? ` ${notExecuted} não executadas; verifique a conexão e a disponibilidade das ferramentas.` : "";
    setStatus(executed
      ? `${executed} ação(ões) enviada(s) sequencialmente pelo MCP Express.${missingNotice}`
      : "Nenhuma ação foi enviada. Verifique a conexão e a disponibilidade das ferramentas MCP.");
  }
  if (!["/ferramentas-graficas", "/ferramentas-ia"].includes(location.pathname)) return null;
  return <section aria-label="MCP Express" className="relative mb-4 rounded-xl border-2 border-sky-500/90 bg-gradient-to-r from-[#041a31] via-[#062748] to-[#041a31] p-2 shadow-lg shadow-sky-950/40">
    <div aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-cyan-300" />
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={openPanel} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-900"><span className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-sky-400 to-violet-500"><Sparkles size={15}/></span>MCP Express</button>
      <select aria-label="Alvo de execução MCP Express" value={target} onChange={(event) => setTarget(event.target.value)} className="rounded-lg border border-sky-800 bg-slate-950 px-2 py-2 text-xs text-slate-200"><option value="timeline">Timeline aberta · Corte principal</option><option value="project">Projeto aberto</option><option value="assets">Mídias selecionadas</option></select>
      <span className="rounded-lg border border-cyan-800/70 bg-cyan-950/30 px-2 py-2 text-[11px] text-cyan-200">{activeTarget.name}</span>
      <label className="flex min-w-[190px] flex-1 items-center gap-2 rounded-lg border border-sky-800 bg-slate-950 px-2 text-xs text-slate-400 focus-within:border-sky-400"><Search size={15}/><input aria-label="Pesquisar operações MCP" value={query} onFocus={() => setPickerOpen(true)} onChange={(event) => { setQuery(event.target.value); setPickerOpen(true); }} placeholder={`Mais ações para ${app.label}…`} className="w-full bg-transparent py-2 outline-none"/></label>
      <label className="flex min-w-[190px] flex-[1.1] items-center rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-400 focus-within:border-sky-400"><input aria-label="Descreva a ação MCP" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Instrução opcional para as ações…" className="w-full bg-transparent py-2 outline-none"/></label>
      <div className="flex flex-wrap items-center gap-1">{operations.map((operation) => <div key={operation.id} className={`flex items-center rounded-lg border text-xs ${operation.enabled ? "border-sky-500/80 bg-sky-950/80 text-sky-100" : "border-slate-700 bg-slate-950 text-slate-500"}`}><button aria-label={`${operation.enabled ? "Desligar" : "Ligar"} ${operation.label}`} aria-pressed={operation.enabled} onClick={() => toggleOperation(operation.id)} className="p-2 text-sky-300 hover:text-cyan-200">{operation.enabled ? <ToggleRight size={17}/> : <ToggleLeft size={17}/>}</button><span className="max-w-32 truncate py-2 pr-1" title={operation.label}>{operation.label}</span><button aria-label={`Executar ${operation.label}`} onClick={() => executeOperation(operation)} disabled={!operation.enabled || running.includes(operation.id)} className="border-l border-sky-700/60 p-2 text-sky-200 hover:text-cyan-100 disabled:text-slate-600">{running.includes(operation.id) ? <LoaderCircle size={13} className="animate-spin"/> : <Play size={13} fill="currentColor"/>}</button><button aria-label={`Remover ${operation.label}`} onClick={() => removeOperation(operation.id)} className="p-2 text-slate-400 hover:text-rose-300"><X size={14}/></button></div>)}<button aria-label="Adicionar operação MCP" onClick={() => { setPickerOpen((current) => !current); setQuery(""); }} className="rounded-lg border border-sky-500 bg-sky-950/70 p-2 text-sky-200 hover:bg-sky-900"><Plus size={16}/></button></div>
      <span className="ml-auto text-[11px] text-sky-200">{enabledOperations.length} ativa{enabledOperations.length === 1 ? "" : "s"}</span><button onClick={executeAll} disabled={!enabledOperations.length || running.length > 0} className="flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:bg-slate-700 disabled:text-slate-400"><Play size={13} fill="currentColor"/>Executar {enabledOperations.length} ações ativas</button><button onClick={openPanel} className="rounded-lg border border-violet-500 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-950">Abrir painel completo</button>
    </div>
    {pickerOpen && <div role="listbox" aria-label="Operações disponíveis" className="mt-2 grid max-h-52 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-sky-800 bg-[#031426] p-2 sm:grid-cols-2 lg:grid-cols-3">{choices.length ? choices.map((action) => <button key={action} role="option" onClick={() => addOperation(action)} className="flex items-center justify-between rounded-md px-2 py-2 text-left text-xs text-slate-200 hover:bg-sky-950 hover:text-sky-100"><span>{action}</span><Plus size={14} className="text-sky-300"/></button>) : <p className="col-span-full px-2 py-2 text-xs text-slate-500">Nenhuma outra operação disponível para esta ferramenta.</p>}</div>}
    {status && <p role="status" className="mt-2 flex items-center gap-1 text-xs text-cyan-200"><CheckCircle2 size={13}/>{status}</p>}
  </section>;
}
