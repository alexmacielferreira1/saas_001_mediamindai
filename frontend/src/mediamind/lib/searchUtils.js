// Busca por tokens — utilitários de normalização e scoring.
// normalize é length-preserving (índices no normalizado mapeiam 1:1 para o
// original, desde que o original venha em forma pré-composta — o caso normal
// em strings do JS). Isso permite highlight exato preservando acentos/casing.

// toLowerCase + NFD + strip de acentos combinantes.
// Para texto pré-composto (ex.: "café"), cada char acentuado (1 code unit) vira
// base+mark (2) e o mark é removido → base (1). Logo o comprimento é preservado.
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Tokeniza a query: normaliza + split em espaços + descarta vazios.
export function tokenize(q) {
  return normalize(q).split(/\s+/).filter(Boolean);
}

// scoreItem(fields, tokens): fields = [{ text, weight }].
// Para cada token, procura indexOf em cada campo normalizado; bônus 3× quando
// casa no início de palavra (idx===0 ou char anterior não-alfanumérico).
// Semântica OR: basta UM token casar para o item aparecer (vários termos do
// contexto funcionam mesmo se nem todos forem sinônimos cadastrados). Itens em
// que TODOS os tokens casam recebem bônus 1.5× e sobem no ranking.
// Pesos típicos: 3 (nome/label), 2 (id/sinônimos), 1 (secundário).
export function scoreItem(fields, tokens) {
  if (!tokens || !tokens.length) return 0;
  let total = 0;
  let matched = 0;
  for (const tok of tokens) {
    let best = 0;
    for (const f of fields) {
      if (!f || f.text == null) continue;
      const n = normalize(f.text);
      const idx = n.indexOf(tok);
      if (idx === -1) continue;
      const atStart = idx === 0 || !/[a-z0-9]/.test(n[idx - 1]);
      const sc = (f.weight || 1) * (atStart ? 3 : 1);
      if (sc > best) best = sc;
    }
    if (best > 0) { total += best; matched++; }
  }
  if (matched === 0) return null; // nenhum token casou → fora
  if (matched === tokens.length) total *= 1.5; // casou tudo → mais relevante
  return total;
}