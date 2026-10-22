import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ListPlus, Maximize2, Minimize2, Play, ScanSearch, Search, Star, Undo2, Wrench } from "lucide-react";
import { clearLastAction, defaultParams, describeParams, recordLastAction, useLastAction } from "../../lib/mcpActions";
import { LastActionBar, PanelFooter, ParamField, ProgressBar, ResultList, Section, Waveform, paramVisible } from "./MCPToolFields";

// Grade de ferramentas em ícones do MCP (reutilizável por qualquer app que registre um provedor).
// Clique no ícone → o detalhamento abre logo abaixo: explicação, parâmetros em seções, prévia (forma de onda,
// lista com checkbox), aplicar com confirmação, enfileirar e desfazer. Ferramentas "em breve" não têm botão falso.
const FAVORITES_KEY = "mm_mcp_tool_favorites_v1";

function readFavorites(source) {
  try {
    const all = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "{}");
    return Array.isArray(all?.[source]) ? all[source] : [];
  } catch {
    return [];
  }
}
function writeFavorites(source, ids) {
  try {
    const all = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "{}");
    localStorage.setItem(FAVORITES_KEY, JSON.stringify({ ...all, [source]: ids }));
  } catch {
    // preferência opcional: sem armazenamento, os favoritos valem só nesta sessão
  }
}

// Agrupa parâmetros visíveis por seção, preservando a ordem de declaração.
function groupParams(params, values) {
  const groups = [];
  params.filter((param) => paramVisible(param, values)).forEach((param) => {
    const name = param.section || "";
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.params.push(param);
    else groups.push({ name, params: [param] });
  });
  return groups;
}

export default function MCPToolPanel({ provider, onEnqueue, onExecuted }) {
  const catalogue = provider.catalogue();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState({});
  const [favorites, setFavorites] = useState(() => readFavorites(provider.source));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [selection, setSelection] = useState([]);
  const [howOpen, setHowOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState(null);
  const [wide, setWide] = useState(false);
  const lastAction = useLastAction(provider.source);
  const liveTimer = useRef(null);
  useEffect(() => {
    setFavorites(readFavorites(provider.source));
    setSelectedId("");
    setResult(null);
  }, [provider.source]);
  useEffect(() => () => window.clearTimeout(liveTimer.current), []);

  const tool = catalogue.tools.find((item) => item.id === selectedId) || null;
  const params = tool ? { ...defaultParams(tool), ...(values[tool.id] || {}) } : {};
  const soon = tool?.status === "soon";
  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("pt-BR");
    return catalogue.tools.filter(
      (item) =>
        (tab === "all" || (tab === "favorites" ? favorites.includes(item.id) : item.tab === tab)) &&
        (!text || `${item.label} ${item.description}`.toLocaleLowerCase("pt-BR").includes(text)),
    );
  }, [catalogue.tools, favorites, query, tab]);
  const activeTab = catalogue.tabs.find((item) => item.id === tab);

  function choose(id) {
    setSelectedId(selectedId === id ? "" : id);
    setResult(null);
    setHowOpen(false);
    setConfirming(false);
  }
  function toggleFavorite(id) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    writeFavorites(provider.source, next);
  }
  function setParam(key, value) {
    const nextValues = { ...(values[tool.id] || {}), [key]: value };
    setValues((old) => ({ ...old, [tool.id]: nextValues }));
    setConfirming(false);
    // Ferramentas "live": com uma prévia na tela, cada ajuste recalcula na hora (a análise usa o áudio já lido).
    if (tool.live && result?.kind === "analyze" && result.ok) {
      window.clearTimeout(liveTimer.current);
      const nextParams = { ...defaultParams(tool), ...nextValues };
      liveTimer.current = window.setTimeout(() => run("analyze", nextParams), 250);
      return;
    }
    setResult(null);
  }
  async function run(kind, runParams = params) {
    setBusy(true);
    setConfirming(false);
    setProgress(null);
    const finalParams = kind === "apply" && result?.kind === "analyze" && result.items ? { ...runParams, selectedItems: selection } : runParams;
    try {
      const outcome = await provider[kind](tool.id, finalParams, { onProgress: (value, stage) => setProgress({ value, stage }) });
      setResult({ ...outcome, kind });
      if (kind === "analyze" && outcome.items) setSelection(outcome.items.filter((item) => item.selected !== false).map((item) => item.id));
      if (kind === "apply") {
        if (outcome.ok && outcome.count !== 0) recordLastAction(provider.source, tool.label);
        onExecuted?.({ tool, params: finalParams, outcome });
      }
    } catch (error) {
      const outcome = { ok: false, summary: error?.message || "Falha ao executar a ferramenta." };
      setResult({ ...outcome, kind });
      if (kind === "apply") onExecuted?.({ tool, params: finalParams, outcome });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  function requestApply() {
    if (tool.confirm && !confirming) {
      setConfirming(true);
      return;
    }
    run("apply");
  }
  function enqueue() {
    onEnqueue?.({ tool, params, description: describeParams(tool, params) });
    setResult({ ok: true, kind: "queue", summary: `“${tool.label}” adicionado à fila com os parâmetros atuais.` });
  }
  function undo() {
    const done = provider.undo();
    if (done) clearLastAction(provider.source);
    setResult({ ok: done, kind: "undo", summary: done ? "Última alteração desfeita." : "Nada para desfazer." });
  }
  function undoFromBar() {
    if (provider.undo()) clearLastAction(provider.source);
  }

  const footer = provider.footer?.();
  const footerWithTabs = footer && {
    ...footer,
    buttons: (footer.buttons || []).map((button) => (button.tab ? { ...button, onClick: () => setTab(button.tab) } : button)),
  };
  const counts = (id) => catalogue.tools.filter((item) => item.tab === id).length;
  const chip = (id, label, count, Icon) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${tab === id ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}
    >
      {Icon && <Icon size={10} />}
      {label}
      {count !== undefined && <span className="ml-1 text-slate-500">{count}</span>}
    </button>
  );
  const ToolIcon = tool?.icon || Wrench;
  const groups = tool ? groupParams(tool.params || [], params) : [];

  const panel = (
    <section
      aria-label={`Ferramentas ${provider.label}`}
      className={wide ? "fixed inset-3 z-[1001] flex flex-col gap-2 overflow-y-auto rounded-xl border border-amber-500/40 bg-slate-950 p-3 text-slate-100 shadow-2xl" : "mb-3 space-y-2"}
    >
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs">
          <Search size={13} className="text-slate-500" />
          <input
            aria-label="Buscar ferramentas"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar ferramentas…"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <button
          type="button"
          aria-label={wide ? "Recolher painel" : "Expandir painel"}
          title={wide ? "Recolher painel" : "Expandir painel (modo largo)"}
          onClick={() => setWide((value) => !value)}
          className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
        >
          {wide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
      <div role="tablist" aria-label="Guias de ferramentas" className="flex flex-wrap gap-1">
        {chip("all", "Todos", catalogue.tools.length)}
        {chip("favorites", "★ Favoritos", favorites.length)}
        {catalogue.tabs.map((item) => chip(item.id, item.label, counts(item.id), item.icon))}
      </div>
      <LastActionBar action={lastAction} onUndo={undoFromBar} disabled={busy || !provider.canUndo()} />
      {activeTab?.description && <p className="text-[11px] text-slate-400">{activeTab.description}</p>}
      {visible.length === 0 ? (
        <p className="text-[11px] text-slate-500">{tab === "favorites" ? "Marque a estrela de uma ferramenta para vê-la aqui." : "Nenhuma ferramenta encontrada."}</p>
      ) : (
        <div className={`grid gap-1.5 ${wide ? "grid-cols-6 md:grid-cols-8" : "grid-cols-4"}`}>
          {visible.map((item) => {
            const Icon = item.icon || Wrench;
            const active = item.id === selectedId;
            return (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  title={item.description}
                  aria-expanded={active}
                  onClick={() => choose(item.id)}
                  className={`flex h-[66px] w-full flex-col items-center justify-center gap-1 rounded-lg border px-1 text-center text-[10px] leading-tight ${active ? "border-amber-400 bg-amber-400/10 text-amber-100" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-600 hover:bg-slate-800"} ${item.status === "soon" ? "opacity-60" : ""}`}
                >
                  <Icon size={18} className={active ? "text-amber-300" : "text-sky-300"} />
                  <span className="line-clamp-2">{item.label}</span>
                  {item.status === "soon" && <span className="absolute bottom-0.5 left-0.5 rounded bg-slate-800 px-1 text-[8px] text-slate-400">em breve</span>}
                </button>
                <button
                  type="button"
                  aria-label={`${favorites.includes(item.id) ? "Remover dos" : "Adicionar aos"} favoritos: ${item.label}`}
                  onClick={() => toggleFavorite(item.id)}
                  className="absolute right-0.5 top-0.5 p-0.5"
                >
                  <Star size={10} className={favorites.includes(item.id) ? "fill-amber-300 text-amber-300" : "text-slate-600"} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {tool && (
        <div aria-label={`Detalhes: ${tool.label}`} className="space-y-2 rounded-lg border border-amber-500/40 bg-slate-950 p-2">
          <div className="flex items-start gap-2">
            <ToolIcon size={18} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-100">{tool.label}</h4>
              <p className="text-[11px] text-slate-400">{tool.description}</p>
            </div>
          </div>
          {soon && (
            <p role="note" className="rounded border border-slate-700 bg-slate-900 p-2 text-[11px] text-slate-300">
              Em breve: {tool.soonReason || "esta ferramenta ainda está sendo preparada."}
            </p>
          )}
          {tool.how && (
            <div>
              <button type="button" onClick={() => setHowOpen((open) => !open)} className="flex items-center gap-1 text-[10px] text-sky-300">
                <ChevronDown size={11} className={howOpen ? "" : "-rotate-90"} /> Como funciona
              </button>
              {howOpen && <p className="mt-1 rounded bg-slate-900 p-2 text-[10px] text-slate-400">{tool.how}</p>}
            </div>
          )}
          {!soon && (
            <div className={wide ? "grid gap-2 md:grid-cols-2" : "space-y-2"}>
              {groups.map((group, index) => {
                const fields = group.params.map((param) => (
                  <ParamField key={param.key} param={param} value={params[param.key]} disabled={busy} onChange={(value) => setParam(param.key, value)} />
                ));
                return group.name ? (
                  <Section key={`${group.name}-${index}`} title={group.name}>
                    {fields}
                  </Section>
                ) : (
                  <div key={`campos-${index}`} className="space-y-2">
                    {fields}
                  </div>
                );
              })}
            </div>
          )}
          <ProgressBar progress={progress} />
          {result && (
            <div role="status" className={`space-y-2 rounded p-2 text-[11px] ${result.ok ? "bg-emerald-950/60 text-emerald-200" : "bg-amber-950/60 text-amber-200"}`}>
              {result.headline ? (
                <p className="flex items-baseline gap-1.5">
                  <b className="text-xl text-amber-300">{result.headline.count}</b>
                  <span>{result.headline.text}</span>
                  {result.headline.aside && <span className="ml-auto text-[10px] text-slate-400">{result.headline.aside}</span>}
                </p>
              ) : null}
              <p>{result.summary}</p>
              {result.waveform && <Waveform data={result.waveform} />}
              {result.items?.length > 0 && (
                <ResultList
                  items={result.items}
                  selected={selection}
                  onToggle={(id) => setSelection((old) => (old.includes(id) ? old.filter((item) => item !== id) : [...old, id]))}
                  onToggleAll={(all) => setSelection(all ? result.items.map((item) => item.id) : [])}
                  onSeek={provider.seek}
                />
              )}
              {result.details?.length > 0 && (
                <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-4 text-[10px] text-slate-300">
                  {result.details.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {confirming && (
            <div role="alertdialog" aria-label={`Confirmar ${tool.label}`} className="space-y-2 rounded border border-amber-500/50 bg-amber-950/40 p-2 text-[11px] text-amber-100">
              <p>{tool.confirm}</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => run("apply")} className="flex-1 rounded bg-amber-500 p-1.5 font-semibold text-slate-950">
                  Confirmar
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded border border-slate-600 p-1.5">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {!soon && (
            <div className="grid grid-cols-2 gap-1.5">
              {tool.analyze !== false && (
                <button type="button" disabled={busy} onClick={() => run("analyze")} className="flex items-center justify-center gap-1 rounded border border-slate-600 p-1.5 text-[11px] disabled:opacity-50">
                  <ScanSearch size={12} /> {busy ? "Processando…" : "Analisar"}
                </button>
              )}
              <button type="button" disabled={busy} onClick={requestApply} className={`flex items-center justify-center gap-1 rounded bg-amber-500 p-1.5 text-[11px] font-semibold text-slate-950 disabled:opacity-50 ${tool.analyze === false ? "col-span-2" : ""}`}>
                <Play size={12} /> {result?.kind === "analyze" && result.items ? `${tool.applyLabel || "Aplicar"} (${selection.length})` : tool.applyLabel || "Aplicar agora"}
              </button>
              {onEnqueue && (
                <button type="button" disabled={busy} onClick={enqueue} className="flex items-center justify-center gap-1 rounded border border-slate-600 p-1.5 text-[11px] disabled:opacity-50">
                  <ListPlus size={12} /> Adicionar à fila
                </button>
              )}
              <button type="button" disabled={busy || !provider.canUndo()} onClick={undo} className="flex items-center justify-center gap-1 rounded border border-slate-600 p-1.5 text-[11px] disabled:opacity-40">
                <Undo2 size={12} /> Desfazer
              </button>
            </div>
          )}
        </div>
      )}
      <PanelFooter footer={footerWithTabs} />
    </section>
  );
  // Modo largo: o painel sai da coluna do Copiloto e ocupa a tela (a coluna limita elementos fixos).
  if (wide && typeof document !== "undefined")
    return (
      <>
        <p className="mb-3 rounded border border-amber-500/30 p-2 text-[11px] text-amber-200">Painel aberto em modo largo.</p>
        {createPortal(<div className="fixed inset-0 z-[1000] bg-black/70">{panel}</div>, document.body)}
      </>
    );
  return panel;
}
