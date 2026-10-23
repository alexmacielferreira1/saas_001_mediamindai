import React from "react";
import { CircleHelp, Minus, Play, Plus, RotateCcw } from "lucide-react";

// Peças compartilhadas da grade de ferramentas do MCP: campos de parâmetro, seção, forma de onda,
// lista de resultados com checkbox, barra de última ação, progresso e rodapé.

const formatNumber = (value) => String(value).replace(".", ",");

export function Help({ text }) {
  if (!text) return null;
  return (
    <span title={text} aria-label={`Ajuda: ${text}`} className="ml-1 inline-flex cursor-help align-middle text-slate-500">
      <CircleHelp size={11} />
    </span>
  );
}

/** Seção em cartão com título destacado (agrupa parâmetros com `section`). */
export function Section({ title, icon: Icon, children }) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-amber-500/30 bg-slate-950/60 p-2">
      {title && (
        <legend className="flex items-center gap-1 px-1 text-[11px] font-semibold text-amber-300">
          {Icon && <Icon size={12} />}
          {title}
        </legend>
      )}
      {children}
    </fieldset>
  );
}

function clamp(value, param) {
  const step = param.step ?? 1;
  const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  const rounded = Number(Number(value).toFixed(decimals));
  return Math.max(param.min ?? -Infinity, Math.min(param.max ?? Infinity, rounded));
}

export function ParamField({ param, value, onChange, disabled }) {
  const id = `mcp-param-${param.key}`;
  if (param.type === "info") return <p className="rounded bg-slate-900 p-2 text-[10px] text-slate-400">{param.label}</p>;
  if (param.type === "toggle")
    return (
      <label className="flex items-start gap-2 text-[11px] text-slate-200">
        <input type="checkbox" className="mt-0.5" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span>
          {param.label}
          <Help text={param.help} />
          {param.description && <span className="block text-[10px] text-slate-500">{param.description}</span>}
        </span>
      </label>
    );
  if (param.type === "select")
    return (
      <label htmlFor={id} className="block text-[11px] text-slate-300">
        {param.label}
        <Help text={param.help} />
        <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1.5 text-[11px]">
          {param.options.map(([option, label]) => (
            <option key={option} value={option}>
              {label}
            </option>
          ))}
        </select>
        {param.description && <span className="block text-[10px] text-slate-500">{param.description}</span>}
      </label>
    );
  if (param.type === "text")
    return (
      <label htmlFor={id} className="block text-[11px] text-slate-300">
        {param.label}
        <Help text={param.help} />
        <textarea
          id={id}
          rows={param.rows ?? 2}
          value={value ?? ""}
          disabled={disabled}
          placeholder={param.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-900 p-1.5 text-[11px]"
        />
      </label>
    );
  if (param.type === "color")
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
        <span>
          {param.label}
          <Help text={param.help} />
        </span>
        <span className="flex items-center gap-1">
          <input id={id} type="color" value={value || "#ffffff"} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-6 w-10 rounded border border-slate-700 bg-slate-900" />
          {value && (
            <button type="button" onClick={() => onChange("")} disabled={disabled} className="text-[10px] text-slate-400">
              usar a do template
            </button>
          )}
        </span>
      </label>
    );
  if (param.type === "chips")
    return (
      <div className="text-[11px] text-slate-300">
        <span>
          {param.label}
          <Help text={param.help} />
        </span>
        <div role="radiogroup" aria-label={param.label} className="mt-1 flex flex-wrap gap-1">
          {param.options.map(([option, label]) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${value === option ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-slate-700 text-slate-400"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  if (param.type === "stepper")
    return (
      <div className="text-[11px] text-slate-300">
        <span>
          {param.label}
          <Help text={param.help} />
        </span>
        <div className="mt-1 flex w-fit items-center gap-1 rounded border border-slate-700 bg-slate-900 px-1">
          <button type="button" aria-label={`Diminuir ${param.label}`} disabled={disabled} onClick={() => onChange(clamp(value - (param.step ?? 1), param))} className="p-1 text-slate-400">
            <Minus size={10} />
          </button>
          <input
            id={id}
            aria-label={param.label}
            type="number"
            value={value}
            min={param.min}
            max={param.max}
            step={param.step ?? 1}
            disabled={disabled}
            onChange={(event) => {
              // Campo apagado (no meio da digitação) não vira 0: espera um número.
              const next = Number(event.target.value);
              if (event.target.value !== "" && Number.isFinite(next)) onChange(clamp(next, param));
            }}
            className="w-14 bg-transparent text-center text-[11px] font-semibold text-slate-100 outline-none"
          />
          <button type="button" aria-label={`Aumentar ${param.label}`} disabled={disabled} onClick={() => onChange(clamp(value + (param.step ?? 1), param))} className="p-1 text-slate-400">
            <Plus size={10} />
          </button>
          {param.unit && <span className="pr-1 text-[10px] text-slate-500">{param.unit}</span>}
        </div>
        {param.description && <span className="block text-[10px] text-slate-500">{param.description}</span>}
      </div>
    );
  if (param.type === "multi")
    return (
      <fieldset className="text-[11px] text-slate-300">
        <legend className="mb-1">
          {param.label}
          <Help text={param.help} />
        </legend>
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
        <span>
          {param.label}
          <Help text={param.help} />
        </span>
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
        className="w-full accent-amber-400"
      />
      {param.description && <span className="block text-[10px] text-slate-500">{param.description}</span>}
    </label>
  );
}

/** Parâmetro visível conforme `when: { key, equals | notEquals }`. */
export function paramVisible(param, values) {
  if (!param.when) return true;
  const current = values[param.when.key];
  if ("equals" in param.when) return current === param.when.equals;
  return current !== param.when.notEquals;
}

/** Forma de onda (picos 0–1) com regiões coloridas (ex.: silêncios em vermelho) e linha do limite. */
export function Waveform({ data }) {
  const { peaks = [], duration = 0, regions = [], threshold } = data;
  const width = 300;
  const height = 48;
  const bar = peaks.length ? width / peaks.length : width;
  return (
    <svg role="img" aria-label={`Forma de onda com ${regions.length} região(ões) marcada(s)`} viewBox={`0 0 ${width} ${height}`} className="h-12 w-full rounded bg-slate-900">
      {regions.map((region, index) => (
        <rect
          key={`r${index}`}
          data-region={region.kind || "regiao"}
          x={duration ? (region.start / duration) * width : 0}
          y={0}
          width={duration ? Math.max(1, ((region.end - region.start) / duration) * width) : 0}
          height={height}
          className={region.kind === "manter" ? "fill-emerald-500/25" : "fill-red-500/35"}
        />
      ))}
      {peaks.map((peak, index) => {
        const size = Math.max(1, peak * (height - 4));
        return <rect key={index} x={index * bar} y={(height - size) / 2} width={Math.max(0.6, bar * 0.8)} height={size} className="fill-amber-400" />;
      })}
      {threshold !== undefined && (
        <line data-threshold x1={0} x2={width} y1={height / 2 - threshold * (height / 2 - 2)} y2={height / 2 - threshold * (height / 2 - 2)} className="stroke-sky-300" strokeDasharray="3 3" strokeWidth={0.6} />
      )}
    </svg>
  );
}

/** Lista de resultados com checkbox (aplicar só o que estiver marcado). */
export function ResultList({ items, selected, onToggle, onToggleAll, onSeek, onPreview }) {
  const all = items.every((item) => selected.includes(item.id));
  return (
    <div className="rounded border border-slate-700">
      <label className="flex items-center gap-2 border-b border-slate-800 px-2 py-1 text-[10px] text-slate-400">
        <input type="checkbox" checked={all} onChange={() => onToggleAll(!all)} aria-label="Marcar todos os itens" />
        {selected.length} de {items.length} marcado(s)
      </label>
      <ul className="max-h-40 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 border-b border-slate-900 px-2 py-1 text-[10px]">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} aria-label={`Incluir ${item.label}`} />
            <button type="button" disabled={!onSeek || item.time === undefined} onClick={() => onSeek?.(item.time)} className="font-mono text-amber-300 disabled:cursor-default">
              {item.timecode}
            </button>
            <span className="min-w-0 flex-1 truncate text-slate-200" title={item.label}>
              {item.label}
            </span>
            {item.badge && <span className="rounded bg-slate-800 px-1 text-[9px] text-slate-400">{item.badge}</span>}
            {onPreview && item.preview && (
              <button type="button" aria-label={`Ouvir ${item.label}`} title="Ouvir" onClick={() => onPreview(item)} className="text-amber-300">
                <Play size={10} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LastActionBar({ action, onUndo, disabled }) {
  if (!action) return null;
  return (
    <div role="status" aria-label="Última ação" className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100">
      <RotateCcw size={11} className="text-amber-300" />
      <span className="min-w-0 flex-1 truncate">
        Última ação: {action.label} ({action.time})
      </span>
      <button type="button" disabled={disabled} onClick={onUndo} className="font-semibold text-amber-300 disabled:opacity-40">
        Desfazer
      </button>
    </div>
  );
}

export function ProgressBar({ progress }) {
  if (!progress) return null;
  const percent = Math.round(Math.max(0, Math.min(1, progress.value)) * 100);
  return (
    <div className="space-y-1 text-[10px] text-slate-400">
      <div className="flex justify-between">
        <span>{progress.stage}</span>
        <span>{percent}%</span>
      </div>
      <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={progress.stage} className="h-1 overflow-hidden rounded bg-slate-800">
        <div className="h-full bg-amber-400" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Rodapé: botões fixos do app, informação da sequência e trilhas alvo clicáveis. */
export function PanelFooter({ footer }) {
  if (!footer) return null;
  const { buttons = [], info, chips = [] } = footer;
  return (
    <div className="space-y-1.5 border-t border-slate-800 pt-2">
      <div className="flex flex-wrap gap-1">
        {buttons.map(({ id, label, icon: Icon, onClick, disabled, hint }) => (
          <button
            key={id}
            type="button"
            title={hint || label}
            disabled={disabled}
            onClick={onClick}
            className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          >
            {Icon && <Icon size={11} />}
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-slate-500">
        <span className="min-w-0 flex-1 truncate">{info}</span>
        {chips.map(({ id, label, active, onClick, hint }) => (
          <button
            key={id}
            type="button"
            title={hint}
            aria-pressed={Boolean(active)}
            onClick={onClick}
            className={`rounded border px-1.5 py-0.5 font-semibold ${active ? "border-amber-400 text-amber-200" : "border-slate-700 text-slate-300"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
