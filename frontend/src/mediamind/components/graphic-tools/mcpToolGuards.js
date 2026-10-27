// Proteções comuns das ferramentas de um clique do MCP (MMPhoto, MMLight, MMVector, MMDesign, MMFig):
// uma ação que termina igual ao estado atual não pode ser anunciada como sucesso nem gravar passo de desfazer.

/** Igualdade de dados (objetos simples, listas e arrays tipados), sem depender da ordem das chaves; `undefined` conta como ausente. */
export function sameData(a, b) {
  if (a === b) return true;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    return ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && a.length === b.length && a.every((value, index) => value === b[index]);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameData(item, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (a[key] === undefined && b[key] === undefined) continue;
      if (!sameData(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/** Resposta padrão para uma ação sem efeito (o app mostra o motivo e não grava nada). */
export function nothingChanged(label) {
  return { ok: false, summary: `${label}: nada a alterar, o resultado seria igual ao estado atual.` };
}

/**
 * Pixels: verdadeiro se algum pixel visível (alfa > 0 antes ou depois) mudou em algum canal.
 * Pixels totalmente transparentes antes e depois não contam (mudar a cor de algo invisível não altera a imagem).
 */
export function pixelsVisiblyChanged(before, after) {
  for (let i = 0; i < before.length; i += 4) {
    if (before[i + 3] === 0 && after[i + 3] === 0) continue;
    if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2] || before[i + 3] !== after[i + 3]) return true;
  }
  return false;
}
