import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Film,
  FileText,
  FileSpreadsheet,
  LockKeyhole,
  Network,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Presentation,
  TerminalSquare,
} from "lucide-react";
import { callMCPTool, listMCPTools } from "../../lib/mcpApi";

const MODULE_ICONS = {
  system: Network,
  mmfilm: Film,
  mmeffects: Sparkles,
  vetor: TerminalSquare,
  mmphoto: Bot,
  mmsom: Activity,
  word: FileText,
  excel: FileSpreadsheet,
  powerpoint: Presentation,
  "ai-tools": Sparkles,
};

export default function MCPCenter({ initialModule = "system" }) {
  const [catalog, setCatalog] = useState(null);
  const [selectedModule, setSelectedModule] = useState(initialModule);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState("");
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    listMCPTools()
      .then(setCatalog)
      .catch((reason) => setError(reason?.message || "Não foi possível carregar o Centro MCP."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => setSelectedModule(initialModule), [initialModule]);

  const tools = useMemo(
    () => (catalog?.tools || []).filter((tool) => tool.module === selectedModule),
    [catalog, selectedModule],
  );
  const execute = async (tool) => {
    setRunning(tool.name);
    setError("");
    try {
      const result = await callMCPTool(tool.name, {});
      setHistory((current) => [result, ...current].slice(0, 8));
    } catch (reason) {
      setError(reason?.message || "Não foi possível executar a ferramenta MCP.");
    } finally {
      setRunning("");
    }
  };

  return (
    <section className="space-y-4" aria-label="Centro MCP MediaMind">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-sky-900/80 bg-gradient-to-r from-sky-950/80 via-slate-950 to-violet-950/40 p-5">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-sky-500/40 bg-sky-500/15 text-sky-300"><Network size={24} /></span>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-400">Orquestração transversal</p><h2 className="mt-1 text-2xl font-black text-white">Centro MCP MediaMind</h2><p className="mt-1 max-w-2xl text-sm text-slate-400">Um único contrato para consultar e, futuramente, operar MMFilm, MMEffects, Vetor, MMPhoto, MMSom, Word, Excel, PowerPoint e ferramentas de IA.</p></div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300"><ShieldCheck size={15}/> Somente leitura <LockKeyhole size={13}/></div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>}
      {loading && <div className="grid min-h-64 place-items-center text-sm text-slate-400"><RefreshCw className="animate-spin"/> Carregando catálogo autorizado…</div>}

      {!loading && catalog && <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)_330px]">
        <aside className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="mb-3 flex items-center justify-between px-2"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Adaptadores</h3><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{catalog.modules.length}</span></div>
          <div className="space-y-1.5">{catalog.modules.map((module) => { const Icon = MODULE_ICONS[module.id] || CircleDashed; const connected = module.status === "connected"; return <button key={module.id} type="button" onClick={() => setSelectedModule(module.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedModule === module.id ? "border-sky-500 bg-sky-950/50" : "border-transparent hover:border-slate-700 hover:bg-slate-900"}`}><span className={`grid h-9 w-9 place-items-center rounded-lg ${connected ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-500"}`}><Icon size={17}/></span><span className="min-w-0 flex-1"><strong className="block text-xs text-slate-100">{module.label}</strong><small className={connected ? "text-emerald-400" : "text-slate-500"}>{connected ? "Conectado" : "Planejado"}</small></span><ChevronRight size={14} className="text-slate-600"/></button>; })}</div>
        </aside>

        <main className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3"><div><h3 className="font-bold text-white">Ferramentas disponíveis</h3><p className="text-xs text-slate-500">Cada chamada usa a empresa e as permissões da sessão atual.</p></div><span className="rounded-lg border border-sky-500/30 bg-sky-950 px-2 py-1 text-[10px] font-bold uppercase text-sky-300">{catalog.mode === "read_only" ? "Leitura" : catalog.mode}</span></div>
          <div className="space-y-3">{tools.map((tool) => <article key={tool.name} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="flex items-start gap-3"><span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${tool.available ? "bg-emerald-400" : "bg-slate-600"}`}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-bold text-white">{tool.title}</h4><code className="rounded bg-slate-950 px-2 py-0.5 text-[10px] text-sky-300">{tool.name}</code></div><p className="mt-1 text-xs leading-5 text-slate-400">{tool.description}</p><div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><span className="rounded border border-slate-700 px-2 py-1">efeito: leitura</span><span className="rounded border border-slate-700 px-2 py-1">sem confirmação</span></div></div><button type="button" aria-label={`Executar ${tool.title}`} disabled={!tool.available || running === tool.name} onClick={() => execute(tool)} className="flex shrink-0 items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">{running === tool.name ? <RefreshCw size={14} className="animate-spin"/> : <Play size={14}/>} Executar</button></div></article>)}{tools.length === 0 && <p className="py-16 text-center text-sm text-slate-500">Nenhuma ferramenta registrada neste adaptador.</p>}</div>
        </main>

        <aside className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"><div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3"><h3 className="flex items-center gap-2 text-sm font-bold text-white"><Clock3 size={15} className="text-sky-400"/> Histórico da sessão</h3><span className="text-[10px] text-slate-500">{history.length} chamada(s)</span></div>{history.length === 0 ? <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-800 p-5 text-center"><div><CircleDashed className="mx-auto text-slate-600"/><p className="mt-3 text-xs text-slate-500">Execute uma ferramenta para ver correlação, duração e resultado.</p></div></div> : <div className="space-y-3">{history.map((entry) => <article key={`${entry.correlation_id}-${entry.tool}`} className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3"><p className="flex items-center gap-2 text-xs font-bold text-emerald-300"><CheckCircle2 size={14}/> Chamada concluída</p><code className="mt-2 block truncate text-[10px] text-sky-300">{entry.tool}</code><dl className="mt-3 grid grid-cols-[72px_1fr] gap-y-1 text-[10px]"><dt className="text-slate-500">Correlação</dt><dd className="truncate text-slate-300">{entry.correlation_id}</dd><dt className="text-slate-500">Duração</dt><dd className="text-slate-300">{entry.duration_ms} ms</dd></dl><pre className="mt-3 max-h-36 overflow-auto rounded-lg bg-slate-950 p-2 text-[9px] text-slate-400">{JSON.stringify(entry.result, null, 2)}</pre></article>)}</div>}</aside>
      </div>}
    </section>
  );
}
