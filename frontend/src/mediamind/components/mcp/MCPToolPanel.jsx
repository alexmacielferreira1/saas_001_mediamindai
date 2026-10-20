import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ListPlus, Play, ScanSearch, Search, Star, Undo2, Wrench } from "lucide-react";
import { defaultParams, describeParams } from "../../lib/mcpActions";

// Grade de ferramentas em ícones do MCP (reutilizável por qualquer app que registre um provedor).
// Clique no ícone → o detalhamento abre logo abaixo: explicação, parâmetros, prévia, aplicar ou enfileirar.
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

const formatNumber = (value) => String(value).replace(".", ",");

function ParamField({ param, value, onChange, disabled }) {
  const id = `mcp-param-${param.key}`;
  if (param.type === "info") return <p className="rounded bg-slate-900 p-2 text-[10px] text-slate-400">{param.label}</p>;
  if (param.type === "toggle")
    return (
      <label className="flex items-center gap-2 text-[11px] text-slate-200">
        <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        {param.label}
      </label>
    );
  if (param.type === "select")
    return (
      <label htmlFor={id} className="block text-[11px] text-slate-300">
        {param.label}
        <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1.5 text-[11px]">
          {param.options.map(([option, label]) => (
            <option key={option} value={option}>
              {label}
            </option>
          ))}
        </select>
      </label>
    );
  if (param.type === "multi")
    return (
      <fieldset className="text-[11px] text-slate-300">
        <legend className="mb-1">{param.label}</legend>
        {param.options.length === 0 ? (
          <p className="text-[10px] text-amber-300">{param.empty || "Nenhuma opção disponível."}</p>
        ) : (
          <div className="max-h-28 space-y-1 overflow-y-auto rounded bg-slate-900 p-1.5">
            {param.options.map(([option, label]) => {
              const selected = (value || []).includes(option);
              return (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange(selected ? value.filter((item) => item !== option) : [...(value || []), option])}
                  />
                  <span className="truncate">{label}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
    );
  return (
    <label htmlFor={id} className="block text-[11px] text-slate-300">
      <span className="flex justify-between">
        {param.label}
        <b className="text-sky-300">
          {formatNumber(value)}
          {param.unit ? ` ${param.unit}` : ""}
        </b>
      </span>
      <input
        id={id}
        type="range"
        min={param.min}
        max={param.max}
        step={param.step ?? 1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-sky-400"
      />
      {param.help && <span className="block text-[10px] text-slate-500">{param.help}</span>}
    </label>
  );
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
  const [howOpen, setHowOpen] = useState(false);
  useEffect(() => {
    setFavorites(readFavorites(provider.source));
    setSelectedId("");
    setResult(null);
  }, [provider.source]);

  const tool = catalogue.tools.find((item) => item.id === selectedId) || null;
  const params = tool ? { ...defaultParams(tool), ...(values[tool.id] || {}) } : {};
  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("pt-BR");
    return catalogue.tools.filter(
      (item) =>
        (tab === "all" || (tab === "favorites" ? favorites.includes(item.id) : item.tab === tab)) &&
        (!text || `${item.label} ${item.description}`.toLocaleLowerCase("pt-BR").includes(text)),
    );
  }, [catalogue.tools, favorites, query, tab]);

  function choose(id) {
    setSelectedId(selectedId === id ? "" : id);
    setResult(null);
    setHowOpen(false);
  }
  function toggleFavorite(id) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    writeFavorites(provider.source, next);
  }
  function setParam(key, value) {
    setValues((old) => ({ ...old, [tool.id]: { ...(old[tool.id] || {}), [key]: value } }));
    setResult(null);
  }
  async function run(kind) {
    setBusy(true);
    setResult(null);
    try {
      const outcome = await provider[kind](tool.id, params);
      setResult({ ...outcome, kind });
      if (kind === "apply") onExecuted?.({ tool, params, outcome });
    } catch (error) {
      const outcome = { ok: false, summary: error?.message || "Falha ao executar a ferramenta." };
      setResult({ ...outcome, kind });
      if (kind === "apply") onExecuted?.({ tool, params, outcome });
    } finally {
      setBusy(false);
    }
  }
  function enqueue() {
    onEnqueue?.({ tool, params, description: describeParams(tool, params) });
    setResult({ ok: true, kind: "queue", summary: `“${tool.label}” adicionado à fila com os parâmetros atuais.` });
  }
  function undo() {
    const done = provider.undo();
    setResult({ ok: done, kind: "undo", summary: done ? "Última alteração desfeita." : "Nada para desfazer." });
  }

  const counts = (id) => catalogue.tools.filter((item) => item.tab === id).length;
  const chip = (id, label, count) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className={`rounded-full border px-2 py-0.5 text-[10px] ${tab === id ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}
    >
      {label}
      {count !== undefined && <span className="ml-1 text-slate-500">{count}</span>}
    </button>
  );
  const ToolIcon = tool?.icon || Wrench;

  return (
    <section aria-label={`Ferramentas ${provider.label}`} className="mb-3 space-y-2">
      <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs">
        <Search size={13} className="text-slate-500" />
        <input
          aria-label="Buscar ferramentas"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar ferramentas…"
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <div role="tablist" aria-label="Guias de ferramentas" className="flex flex-wrap gap-1">
        {chip("all", "Todos", catalogue.tools.length)}
        {chip("favorites", "★ Favoritos", favorites.length)}
        {catalogue.tabs.map((item) => chip(item.id, item.label, counts(item.id)))}
      </div>
      {visible.length === 0 ? (
        <p className="text-[11px] text-slate-500">{tab === "favorites" ? "Marque a estrela de uma ferramenta para vê-la aqui." : "Nenhuma ferramenta encontrada."}</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
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
                  className={`flex h-[66px] w-full flex-col items-center justify-center gap-1 rounded-lg border px-1 text-center text-[10px] leading-tight ${active ? "border-amber-400 bg-amber-400/10 text-amber-100" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-600 hover:bg-slate-800"}`}
                >
                  <Icon size={18} className={active ? "text-amber-300" : "text-sky-300"} />
                  <span className="line-clamp-2">{item.label}</span>
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
          {tool.how && (
            <div>
              <button type="button" onClick={() => setHowOpen((open) => !open)} className="flex items-center gap-1 text-[10px] text-sky-300">
                <ChevronDown size={11} className={howOpen ? "" : "-rotate-90"} /> Como funciona
              </button>
              {howOpen && <p className="mt-1 rounded bg-slate-900 p-2 text-[10px] text-slate-400">{tool.how}</p>}
            </div>
          )}
          {(tool.params || []).map((param) => (
            <ParamField key={param.key} param={param} value={params[param.key]} disabled={busy} onChange={(value) => setParam(param.key, value)} />
          ))}
          {result && (
            <div role="status" className={`rounded p-2 text-[11px] ${result.ok ? "bg-emerald-950/60 text-emerald-200" : "bg-amber-950/60 text-amber-200"}`}>
              <p>{result.summary}</p>
              {result.details?.length > 0 && (
                <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-4 text-[10px] text-slate-300">
                  {result.details.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {tool.analyze !== false && (
              <button type="button" disabled={busy} onClick={() => run("analyze")} className="flex items-center justify-center gap-1 rounded border border-slate-600 p-1.5 text-[11px] disabled:opacity-50">
                <ScanSearch size={12} /> {busy ? "Processando…" : "Analisar"}
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => run("apply")} className={`flex items-center justify-center gap-1 rounded bg-amber-500 p-1.5 text-[11px] font-semibold text-slate-950 disabled:opacity-50 ${tool.analyze === false ? "col-span-2" : ""}`}>
              <Play size={12} /> {tool.applyLabel || "Aplicar agora"}
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
        </div>
      )}
    </section>
  );
}
