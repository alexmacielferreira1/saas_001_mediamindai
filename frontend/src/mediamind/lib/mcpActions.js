import { useEffect, useState } from "react";

// Ferramentas de ação local do MCP: a ferramenta aberta (ex.: MMFilm) registra um catálogo em ícones
// e um executor real; o MCP do Copiloto mostra a grade, analisa, aplica e enfileira essas ações.
// Só quem está de fato aberto registra; sem registro não há ferramenta (nada é simulado).
//
// Provedor: {
//   source, label,
//   catalogue() -> { tabs: [{ id, label, icon? }], tools: [{ id, tab, label, icon, description, how?, params: [...] }] },
//   (função: as opções podem depender do estado atual, ex.: sons importados no projeto)
//   analyze(toolId, params) -> Promise<{ ok, summary, details?, count? }>   // prévia, não altera nada
//   apply(toolId, params)   -> Promise<{ ok, summary, details?, count? }>   // altera e entra no desfazer
//   undo() -> boolean, canUndo() -> boolean
// }
const EVENT = "mm:mcp-actions";
let current = null;

export function registerMCPActions(provider) {
  current = provider;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: provider }));
  return () => {
    if (current !== provider) return;
    current = null;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
  };
}

export function currentMCPActions() {
  return current;
}

export function useMCPActions() {
  const [provider, setProvider] = useState(current);
  useEffect(() => {
    const receive = (event) => setProvider(event.detail);
    window.addEventListener(EVENT, receive);
    setProvider(current);
    return () => window.removeEventListener(EVENT, receive);
  }, []);
  return provider;
}

/** Valores iniciais dos parâmetros declarados por uma ferramenta. */
export function defaultParams(tool) {
  return Object.fromEntries((tool?.params || []).map((param) => [param.key, param.default]));
}

/** Texto curto dos parâmetros para filas e histórico (ex.: "Sensibilidade 5 · Silêncio mínimo 0,5 s"). */
export function describeParams(tool, values = {}) {
  return (tool?.params || [])
    .filter((param) => param.type !== "info")
    .map((param) => {
      const value = values[param.key] ?? param.default;
      if (param.type === "toggle") return value ? param.label : null;
      if (param.type === "select") return `${param.label}: ${param.options.find(([option]) => option === value)?.[1] ?? value}`;
      if (param.type === "multi") return `${param.label}: ${(value || []).length}`;
      return `${param.label} ${String(value).replace(".", ",")}${param.unit ? ` ${param.unit}` : ""}`;
    })
    .filter(Boolean)
    .join(" · ");
}
