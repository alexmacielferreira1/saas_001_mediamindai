import { useEffect, useMemo, useState } from "react";
import { Play, Plus, Search, Sparkles, ToggleLeft, ToggleRight, X } from "lucide-react";
import { useLocation } from "react-router-dom";

const EXPRESS_APPS = {
  filmcraft: { id: "mmfilm", label: "MMFilm", actions: ["Montar sequência", "Criar legendas", "Cortar trechos", "Exportar versão", "Remover silêncios", "Adicionar transição"] },
  effectcraft: { id: "mmeffects", label: "MMEffects", actions: ["Criar composição", "Animar títulos", "Aplicar transição", "Correção de cor", "Criar lower third", "Preparar renderização"] },
  photocraft: { id: "mmphoto", label: "MMPhoto", actions: ["Recortar", "Ajustar luz e cor", "Aplicar identidade", "Criar thumbnail", "Remover fundo", "Redimensionar imagem"] },
  vectorcraft: { id: "mmvector", label: "MMVector", actions: ["Vetorizar", "Aplicar paleta", "Montar layout", "Exportar PNG", "Criar variações", "Ajustar tipografia"] },
  mmsom: { id: "mmsom", label: "MMSom", actions: ["Limpar ruído", "Remover pausas", "Normalizar", "Equalizar", "Separar voz e música", "Masterizar"] },
  office: { id: "office", label: "Office", actions: ["Resumir conteúdo", "Gerar slides", "Aplicar template", "Exportar arquivo", "Criar planilha", "Revisar e reescrever"] },
  ai: { id: "ai", label: "Ferramentas IA", actions: ["Transcrever", "Resumir", "Gerar cortes", "Classificar mídia", "OCR", "Sugerir roteiro"] },
};

function pageApp(location) {
  if (location.pathname === "/ferramentas-ia") return EXPRESS_APPS.ai;
  return EXPRESS_APPS[new URLSearchParams(location.search).get("tool")] || EXPRESS_APPS.ai;
}

const toOperation = (label) => ({ id: label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"), label, enabled: true });

export default function MCPExpress() {
  const location = useLocation();
  const app = useMemo(() => pageApp(location), [location]);
  const [prompt, setPrompt] = useState("");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [operations, setOperations] = useState(() => app.actions.slice(0, 3).map(toOperation));

  useEffect(() => {
    setOperations(app.actions.slice(0, 3).map(toOperation));
    setQuery("");
    setPickerOpen(false);
  }, [app.id]);

  const choices = app.actions.filter((action) => action.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && !operations.some((operation) => operation.label === action));
  const enabledOperations = operations.filter((operation) => operation.enabled);

  function addOperation(label) {
    setOperations((current) => current.some((operation) => operation.label === label) ? current : [...current, toOperation(label)]);
    setQuery("");
    setPickerOpen(false);
  }
  function toggleOperation(id) {
    setOperations((current) => current.map((operation) => operation.id === id ? { ...operation, enabled: !operation.enabled } : operation));
  }
  function removeOperation(id) {
    setOperations((current) => current.filter((operation) => operation.id !== id));
  }
  function openPanel() {
    window.dispatchEvent(new CustomEvent("mm:mcp-open", { detail: { appId: app.id, prompt, operations, actions: enabledOperations.map((operation) => operation.label) } }));
  }

  return <section aria-label="MCP Express" className="relative mb-4 rounded-xl border-2 border-sky-500/90 bg-gradient-to-r from-[#041a31] via-[#062748] to-[#041a31] p-2 shadow-lg shadow-sky-950/40">
    <div aria-hidden="true" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-cyan-300" />
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={openPanel} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-900"><span className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-sky-400 to-violet-500"><Sparkles size={15}/></span>MCP Express</button>
      <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-sky-800 bg-slate-950 px-2 text-xs text-slate-400 focus-within:border-sky-400"><Search size={15}/><input aria-label="Pesquisar operações MCP" value={query} onFocus={() => setPickerOpen(true)} onChange={(event) => { setQuery(event.target.value); setPickerOpen(true); }} placeholder={`Pesquisar operação para ${app.label}…`} className="w-full bg-transparent py-2 outline-none"/></label>
      <label className="flex min-w-[210px] flex-[1.2] items-center rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-400 focus-within:border-sky-400"><input aria-label="Descreva a ação MCP" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Descreva o que deseja fazer…" className="w-full bg-transparent py-2 outline-none"/></label>
      <div className="flex flex-wrap items-center gap-1">{operations.map((operation) => <div key={operation.id} className={`flex items-center rounded-lg border text-xs ${operation.enabled ? "border-sky-500/80 bg-sky-950/80 text-sky-100" : "border-slate-700 bg-slate-950 text-slate-500"}`}>
        <button aria-label={`${operation.enabled ? "Desligar" : "Ligar"} ${operation.label}`} aria-pressed={operation.enabled} onClick={() => toggleOperation(operation.id)} className="p-2 text-sky-300 hover:text-cyan-200">{operation.enabled ? <ToggleRight size={17}/> : <ToggleLeft size={17}/>}</button>
        <span className="max-w-28 truncate py-2 pr-1" title={operation.label}>{operation.label}</span>
        <button aria-label={`Remover ${operation.label}`} onClick={() => removeOperation(operation.id)} className="p-2 text-slate-400 hover:text-rose-300"><X size={14}/></button>
      </div>)}
      <button aria-label="Adicionar operação MCP" onClick={() => { setPickerOpen((current) => !current); setQuery(""); }} className="rounded-lg border border-sky-500 bg-sky-950/70 p-2 text-sky-200 hover:bg-sky-900"><Plus size={16}/></button></div>
      <span className="ml-auto text-[11px] text-sky-200">{enabledOperations.length} ativa{enabledOperations.length === 1 ? "" : "s"}</span>
      <button onClick={openPanel} className="flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300">Abrir MCP<Play size={13} fill="currentColor"/></button>
    </div>
    {pickerOpen && <div role="listbox" aria-label="Operações disponíveis" className="mt-2 grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-sky-800 bg-[#031426] p-2 sm:grid-cols-2 lg:grid-cols-3">
      {choices.length ? choices.map((action) => <button key={action} role="option" onClick={() => addOperation(action)} className="flex items-center justify-between rounded-md px-2 py-2 text-left text-xs text-slate-200 hover:bg-sky-950 hover:text-sky-100"><span>{action}</span><Plus size={14} className="text-sky-300"/></button>) : <p className="col-span-full px-2 py-2 text-xs text-slate-500">Nenhuma outra operação disponível para esta ferramenta.</p>}
    </div>}
  </section>;
}
