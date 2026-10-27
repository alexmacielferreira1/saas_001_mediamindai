// Regra comum dos catálogos MCP de um clique: um resultado `ok: true` que devolve campos de estado precisa
// mudar de fato algum deles. Se tudo já estava assim, o MCP não pode anunciar sucesso (nem empilhar um
// Desfazer vazio): o resultado vira `ok: false` com o motivo.

/** Texto canônico para comparar dados: ignora a ordem das chaves e campos `undefined`. */
export function canonicalData(value) {
  return JSON.stringify(value ?? null, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item,
  );
}

/**
 * Devolve `result` se ele não é sucesso, não traz campos de `keys` ou muda algum deles; senão,
 * `{ ok: false, summary: message }`. `normalize(key, value)` coloca entrada e saída na mesma forma.
 */
export function refuseIfUnchanged(result, state, keys, message, normalize = (_key, value) => value) {
  if (!result?.ok) return result;
  const returned = keys.filter((key) => key in result);
  if (!returned.length) return result;
  const changed = returned.some((key) => canonicalData(normalize(key, result[key])) !== canonicalData(normalize(key, state?.[key])));
  return changed ? result : { ok: false, summary: message };
}
