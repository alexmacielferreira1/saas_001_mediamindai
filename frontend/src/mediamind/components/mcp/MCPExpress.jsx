import { useMemo, useState } from "react";
import { ChevronRight, Play, Plus, Search, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";

const EXPRESS_APPS = {
  filmcraft: { id: "mmfilm", label: "MMFilm", actions: ["Montar sequência", "Criar legendas", "Cortar trechos", "Exportar versão"] },
  effectcraft: { id: "mmeffects", label: "MMEffects", actions: ["Criar composição", "Animar títulos", "Aplicar transição", "Correção de cor"] },
  photocraft: { id: "mmphoto", label: "MMPhoto", actions: ["Recortar", "Ajustar luz e cor", "Aplicar identidade", "Criar thumbnail"] },
  vectorcraft: { id: "mmvector", label: "MMVector", actions: ["Vetorizar", "Aplicar paleta", "Montar layout", "Exportar PNG"] },
  mmsom: { id: "mmsom", label: "MMSom", actions: ["Limpar ruído", "Remover pausas", "Normalizar", "Equalizar"] },
  office: { id: "office", label: "Office", actions: ["Resumir conteúdo", "Gerar slides", "Aplicar template", "Exportar arquivo"] },
  ai: { id: "ai", label: "Ferramentas IA", actions: ["Transcrever", "Resumir", "Gerar cortes", "Classificar mídia"] },
};

function pageApp(location) {
  if (location.pathname === "/ferramentas-ia") return EXPRESS_APPS.ai;
  const tool = new URLSearchParams(location.search).get("tool");
  return EXPRESS_APPS[tool] || EXPRESS_APPS.ai;
}

export default function MCPExpress() {
  const location = useLocation();
  const app = useMemo(() => pageApp(location), [location]);
  const [prompt, setPrompt] = useState("");
  const [actions, setActions] = useState(app.actions.slice(0, 3));

  function openPanel() {
    window.dispatchEvent(new CustomEvent("mm:mcp-open", { detail: { appId: app.id, prompt, actions } }));
  }
  function addAction(action) {
    setActions((current) => current.includes(action) ? current : [...current, action].slice(0, 5));
    setPrompt((current) => current ? `${current}; ${action}` : action);
  }

  return <section aria-label="MCP Express" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-sky-800/80 bg-[#06182b] p-2 shadow-lg shadow-sky-950/20">
    <button onClick={openPanel} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white"><span className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-sky-400 to-violet-500"><Sparkles size={15}/></span>MCP Express</button>
    <label className="flex min-w-[190px] flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-400"><Search size={15}/><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={`Descreva a ação para ${app.label}…`} className="w-full bg-transparent py-2 outline-none"/></label>
    <div className="flex flex-wrap items-center gap-1">{actions.map((action) => <button key={action} onClick={() => addAction(action)} className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200 hover:border-sky-500"><span className="h-1.5 w-1.5 rounded-full bg-sky-400"/>{action}<Play size={12}/></button>)}<ChevronRight size={14} className="text-slate-600"/><button onClick={() => setActions((current) => [...current, ...app.actions.filter((action) => !current.includes(action)).slice(0, 1)])} className="rounded-lg border border-sky-700 p-2 text-sky-200"><Plus size={16}/></button></div>
    <button onClick={openPanel} className="ml-auto flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950">Executar<Play size={13} fill="currentColor"/></button>
  </section>;
}
