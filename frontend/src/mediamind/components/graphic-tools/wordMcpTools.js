// Catálogo de ferramentas de um clique do Word (WordCraft) para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { html }: o HTML é saneado e manipulado num documento inerte (DOMParser, sem scripts
// nem carregamento de mídia) e volta como { ok, summary, html }. Textos vindos de parâmetros entram só
// como nós de texto (nunca como HTML). Condições não atendidas viram { ok: false, summary }.
import {
  AlignCenter,
  BarChart3,
  BookOpenCheck,
  CaseSensitive,
  Eraser,
  Heading,
  List,
  ListOrdered,
  ListTree,
  ListX,
  Pilcrow,
  Repeat2,
  Replace,
  SpellCheck,
  TextQuote,
  Type,
} from "lucide-react";
import { countWords, documentHtmlToText, fontFamilies, sanitizeDocumentHtml } from "../../pages/OfficeCraft";

export const WORD_TABS = [
  { id: "estilos", label: "Estilos" },
  { id: "estrutura", label: "Estrutura" },
  { id: "texto", label: "Texto" },
  { id: "revisao", label: "Revisão" },
];

class ToolError extends Error {}

const ZWSP = /​/g;
const PARAGRAPH_TAGS = new Set(["P", "H1", "H2", "H3", "DIV", "BLOCKQUOTE", "LI"]);
const BLOCK_TAGS = new Set([...PARAGRAPH_TAGS, "UL", "OL", "HR"]);
const HEADING_TAGS = new Set(["H1", "H2", "H3"]);
const STYLE_OPTIONS = [
  ["p", "Normal"],
  ["h1", "Título 1"],
  ["h2", "Título 2"],
  ["h3", "Título 3"],
  ["blockquote", "Citação"],
];
const TAG_LABEL = { H1: "Título 1", H2: "Título 2", H3: "Título 3", BLOCKQUOTE: "Citação" };
const CASE_OPTIONS = [
  ["upper", "MAIÚSCULAS"],
  ["lower", "minúsculas"],
  ["title", "Primeira Letra De Cada Palavra"],
  ["sentence", "Como em uma frase"],
];
const MARKER = /^\s*(?:([-*•–])|(\d+)[.)])\s+/;
const WORD_CHAR = "[\\p{L}\\p{N}_]";

const isBlock = (node) => node.nodeType === 1 && BLOCK_TAGS.has(node.tagName);
const textOf = (element) => element.textContent.replace(ZWSP, "");
const styleLabel = (tag) => STYLE_OPTIONS.find(([key]) => key === tag)[1];

/** Lê o HTML saneado num documento inerte e embrulha textos soltos em parágrafos. */
function parse(html) {
  const body = new DOMParser().parseFromString(`<!doctype html><body>${sanitizeDocumentHtml(html)}`, "text/html").body;
  let loose = [];
  const flush = (before) => {
    if (!loose.length) return;
    const hasContent = loose.some((node) => node.textContent.trim() || (node.nodeType === 1 && node.querySelector?.("br")) || node.nodeName === "BR");
    if (hasContent) {
      const paragraph = body.ownerDocument.createElement("p");
      body.insertBefore(paragraph, before);
      loose.forEach((node) => paragraph.appendChild(node));
    } else loose.forEach((node) => node.remove());
    loose = [];
  };
  [...body.childNodes].forEach((node) => {
    if (isBlock(node)) flush(node);
    else loose.push(node);
  });
  flush(null);
  return body;
}

/** Parágrafos de primeiro nível (listas e linhas ficam com as ferramentas de lista). */
const units = (root) => [...root.children].filter((element) => PARAGRAPH_TAGS.has(element.tagName));

function chosenUnits(root, ids) {
  const wanted = new Set((ids || []).map(String));
  const list = units(root).filter((_, index) => wanted.has(String(index)));
  if (!list.length) throw new ToolError("Escolha um ou mais parágrafos.");
  return list;
}

function retag(element, tag) {
  const next = element.ownerDocument.createElement(tag);
  const style = element.getAttribute("style");
  if (style) next.setAttribute("style", style);
  while (element.firstChild) next.appendChild(element.firstChild);
  element.replaceWith(next);
  return next;
}

function textNodes(root) {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const nodes = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  return nodes;
}

function done(root, summary, count, extra = {}) {
  return { ok: true, summary, count, ...extra, html: root.innerHTML };
}

/** Transforma a caixa do texto letra a letra, mantendo o estado entre nós de texto do mesmo bloco. */
export function createCaseTransformer(mode) {
  let start = true;
  return (text) => {
    if (mode === "upper") return text.toLocaleUpperCase("pt-BR");
    if (mode === "lower") return text.toLocaleLowerCase("pt-BR");
    let out = "";
    for (const char of text) {
      if (/\p{L}/u.test(char)) {
        out += start ? char.toLocaleUpperCase("pt-BR") : char.toLocaleLowerCase("pt-BR");
        start = false;
      } else {
        out += char;
        if (mode === "title") start = !/[\p{N}'’]/u.test(char);
        else if (/[.!?]/.test(char)) start = true;
      }
    }
    return out;
  };
}

// ---------- estilos ----------
function applyStyle(state, params) {
  const root = parse(state.html);
  const list = chosenUnits(root, params.paragraphs);
  const tag = params.style.toUpperCase();
  const changed = list.filter((element) => element.tagName !== tag);
  if (!changed.length) throw new ToolError(`Os parágrafos escolhidos já estão como ${styleLabel(params.style)}.`);
  changed.forEach((element) => retag(element, params.style));
  return done(root, `${styleLabel(params.style)} aplicado em ${changed.length} parágrafo(s)`, changed.length);
}

function autoHeadings(state, params) {
  const root = parse(state.html);
  const all = units(root);
  const hasTitle = Boolean(root.querySelector("h1"));
  const changed = [];
  all.forEach((element, index) => {
    const text = textOf(element).trim();
    const words = countWords(text);
    if (element.tagName !== "P" || !words || words > params.maxWords || /[.!?:;,…]$/.test(text)) return;
    const tag = index === 0 && params.firstAsTitle && !hasTitle ? "h1" : "h2";
    retag(element, tag);
    changed.push(`${styleLabel(tag)}: ${text}`);
  });
  if (!changed.length) throw new ToolError(`Nenhum parágrafo curto (até ${params.maxWords} palavras) sem pontuação final foi encontrado.`);
  return done(root, `${changed.length} parágrafo(s) viraram título`, changed.length, { details: changed });
}

function documentFont(state, params) {
  const root = parse(state.html);
  const blocks = [...root.children].filter((element) => element.tagName !== "HR");
  if (!blocks.length) throw new ToolError("O documento está vazio.");
  const family = fontFamilies[params.font];
  const sized = params.size !== "keep";
  blocks.forEach((block) => {
    block.querySelectorAll("[style]").forEach((inner) => {
      inner.style.removeProperty("font-family");
      if (sized && !HEADING_TAGS.has(block.tagName)) inner.style.removeProperty("font-size");
    });
    block.style.setProperty("font-family", family);
    if (sized && !HEADING_TAGS.has(block.tagName)) block.style.setProperty("font-size", `${params.size}pt`);
  });
  return done(root, `Fonte ${params.font}${sized ? ` ${params.size} pt` : ""} em todo o documento (${blocks.length} bloco(s))`, blocks.length);
}

function alignParagraphs(state, params) {
  const root = parse(state.html);
  const blocks = [...root.children].filter((element) => element.tagName !== "HR" && (params.target === "all" || HEADING_TAGS.has(element.tagName) === (params.target === "headings")));
  if (!blocks.length) throw new ToolError("Nenhum parágrafo do tipo escolhido.");
  const changed = blocks.filter((block) => block.style.textAlign !== params.align);
  if (!changed.length) throw new ToolError("Os parágrafos escolhidos já estão com esse alinhamento.");
  changed.forEach((block) => {
    block.style.textAlign = params.align;
  });
  const label = { left: "à esquerda", center: "centralizado", right: "à direita", justify: "justificado" }[params.align];
  return done(root, `${changed.length} parágrafo(s) ${label}`, changed.length);
}

// ---------- estrutura ----------
function stripPrefix(element, length) {
  let rest = length;
  for (const node of textNodes(element)) {
    if (!rest) break;
    const cut = Math.min(rest, node.data.length);
    node.data = node.data.slice(cut);
    rest -= cut;
  }
}

function groupIntoLists(root, items) {
  // items: [{ element, kind }] em ordem do documento; vizinhos do mesmo tipo formam uma lista só.
  let list = null;
  let previous = null;
  items.forEach(({ element, kind }) => {
    if (!list || previous.nextElementSibling !== element || list.tagName !== kind.toUpperCase()) {
      list = root.ownerDocument.createElement(kind);
      root.insertBefore(list, element);
    }
    const item = root.ownerDocument.createElement("li");
    while (element.firstChild) item.appendChild(element.firstChild);
    element.remove();
    list.appendChild(item);
    previous = list;
  });
}

function autoLists(state) {
  const root = parse(state.html);
  const items = [];
  units(root).forEach((element) => {
    const match = element.tagName === "P" ? MARKER.exec(element.textContent) : null;
    if (!match) return;
    stripPrefix(element, match[0].length);
    items.push({ element, kind: match[1] ? "ul" : "ol" });
  });
  if (!items.length) throw new ToolError("Nenhum parágrafo começa com marcador (-, *, •) ou número (1. ou 1)).");
  groupIntoLists(root, items);
  return done(root, `${items.length} parágrafo(s) viraram itens de lista`, items.length);
}

function toList(state, params) {
  const root = parse(state.html);
  const list = chosenUnits(root, params.paragraphs);
  groupIntoLists(
    root,
    list.map((element) => ({ element, kind: params.kind })),
  );
  return done(root, `${list.length} parágrafo(s) em lista ${params.kind === "ol" ? "numerada" : "com marcadores"}`, list.length);
}

function removeLists(state) {
  const root = parse(state.html);
  const lists = [...root.children].filter((element) => element.tagName === "UL" || element.tagName === "OL");
  if (!lists.length) throw new ToolError("O documento não tem listas.");
  let count = 0;
  lists.forEach((list) => {
    [...list.children].forEach((item) => {
      const paragraph = root.ownerDocument.createElement("p");
      while (item.firstChild) paragraph.appendChild(item.firstChild);
      root.insertBefore(paragraph, list);
      count += 1;
    });
    list.remove();
  });
  return done(root, `${lists.length} lista(s) desfeitas (${count} parágrafo(s))`, count);
}

const TOC_TITLE = "Sumário";

function tableOfContents(state, params) {
  const root = parse(state.html);
  const old = [...root.children].find((element) => element.tagName === "H2" && textOf(element).trim() === TOC_TITLE && element.nextElementSibling?.tagName === "UL");
  if (old) {
    old.nextElementSibling.remove();
    old.remove();
  }
  const headings = [...root.children].filter((element) => HEADING_TAGS.has(element.tagName) && textOf(element).trim());
  if (!headings.length) throw new ToolError("Crie títulos (Título 1, 2 ou 3) antes de gerar o sumário.");
  const doc = root.ownerDocument;
  const title = doc.createElement("h2");
  title.textContent = TOC_TITLE;
  const list = doc.createElement("ul");
  headings.forEach((heading) => {
    const item = doc.createElement("li");
    item.textContent = `${heading.tagName === "H3" ? "— " : ""}${textOf(heading).trim()}`;
    list.appendChild(item);
  });
  const first = root.firstElementChild;
  const anchor = params.position === "afterTitle" && first.tagName === "H1" ? first.nextSibling : first;
  root.insertBefore(title, anchor);
  root.insertBefore(list, anchor);
  return done(root, `Sumário ${old ? "atualizado" : "criado"} com ${headings.length} título(s)`, headings.length, { details: headings.map((heading) => textOf(heading).trim()) });
}

// ---------- texto ----------
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function findReplace(state, params) {
  const find = String(params.find ?? "");
  if (!find) throw new ToolError("Digite o texto a localizar.");
  const replacement = String(params.replace ?? "");
  const source = params.wholeWord ? `(?<!${WORD_CHAR})${escapeRegExp(find)}(?!${WORD_CHAR})` : escapeRegExp(find);
  const pattern = new RegExp(source, `gu${params.caseSensitive ? "" : "i"}`);
  const root = parse(state.html);
  let count = 0;
  textNodes(root).forEach((node) => {
    node.data = node.data.replace(pattern, () => {
      count += 1;
      return replacement;
    });
  });
  if (!count) throw new ToolError(`“${find}” não foi encontrado no documento.`);
  return done(root, replacement ? `${count} ocorrência(s) de “${find}” trocada(s) por “${replacement}”` : `${count} ocorrência(s) de “${find}” removida(s)`, count);
}

function changeCase(state, params) {
  const root = parse(state.html);
  const list = chosenUnits(root, params.paragraphs);
  let changed = 0;
  list.forEach((element) => {
    const before = element.textContent;
    const transform = createCaseTransformer(params.mode);
    textNodes(element).forEach((node) => {
      node.data = transform(node.data);
    });
    if (element.textContent !== before) changed += 1;
  });
  if (!changed) throw new ToolError("O texto escolhido já está assim.");
  const label = CASE_OPTIONS.find(([key]) => key === params.mode)[1];
  return done(root, `${label} em ${changed} parágrafo(s)`, changed);
}

function cleanSpaces(state, params) {
  const root = parse(state.html);
  const before = root.innerHTML;
  textNodes(root).forEach((node) => {
    node.data = node.data.replace(ZWSP, "").replace(/[ \t ]{2,}/g, " ");
  });
  let removed = 0;
  units(root).forEach((element) => {
    const nodes = textNodes(element);
    if (nodes.length) {
      nodes[0].data = nodes[0].data.replace(/^[ \t ]+/, "");
      nodes.at(-1).data = nodes.at(-1).data.replace(/[ \t ]+$/, "");
    }
    if (params.removeEmpty && !element.textContent.trim()) {
      element.remove();
      removed += 1;
    }
  });
  if (!root.firstElementChild) root.innerHTML = "<p><br></p>";
  if (root.innerHTML === before) throw new ToolError("Nada para limpar: sem espaços sobrando nem parágrafos vazios.");
  return done(root, `Espaços limpos${removed ? ` · ${removed} parágrafo(s) vazio(s) removido(s)` : ""}`, removed || 1);
}

function repeatedWords(state) {
  const pattern = /(?<![\p{L}\p{N}])(\p{L}+)(?:\s+\1)+(?![\p{L}\p{N}])/giu;
  const root = parse(state.html);
  const found = [];
  textNodes(root).forEach((node) => {
    node.data = node.data.replace(pattern, (match, word) => {
      found.push(match);
      return word;
    });
  });
  if (!found.length) throw new ToolError("Nenhuma palavra repetida em sequência (ex.: “de de”).");
  return done(root, `${found.length} repetição(ões) corrigida(s)`, found.length, { details: found.map((match) => `“${match}”`) });
}

function insertParagraphs(state, params) {
  const lines = String(params.text ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!lines.length) throw new ToolError("Digite o texto do parágrafo.");
  const root = parse(state.html);
  if (!textOf(root).trim() && !root.querySelector("hr")) root.innerHTML = "";
  const doc = root.ownerDocument;
  const anchor = params.position === "start" ? root.firstChild : null;
  lines.forEach((line) => {
    const element = doc.createElement(params.style);
    element.textContent = line;
    root.insertBefore(element, anchor);
  });
  return done(root, `${lines.length} parágrafo(s) (${styleLabel(params.style)}) inserido(s) no ${params.position === "start" ? "início" : "fim"}`, lines.length);
}

// ---------- revisão ----------
const integer = new Intl.NumberFormat("pt-BR");

function statistics(state) {
  const html = sanitizeDocumentHtml(state.html);
  const text = documentHtmlToText(html);
  const root = parse(html);
  const words = countWords(text);
  const minutes = Math.max(1, Math.ceil(words / 200));
  const noSpaces = text.replace(/\s/g, "").length;
  return {
    ok: true,
    count: 0,
    summary: `${integer.format(words)} palavras · ${integer.format(noSpaces)} caracteres sem espaços`,
    headline: { count: integer.format(words), text: "palavras", aside: `~${minutes} min de leitura` },
    details: [
      `Caracteres com espaços: ${integer.format(text.replace(/\n/g, "").length)}`,
      `Caracteres sem espaços: ${integer.format(noSpaces)}`,
      `Parágrafos: ${units(root).filter((element) => textOf(element).trim()).length}`,
      `Títulos: ${root.querySelectorAll("h1,h2,h3").length}`,
      `Itens de lista: ${root.querySelectorAll("li").length}`,
      `Frases: ${(text.match(/[.!?]+(?=\s|$)/g) || []).length}`,
    ],
  };
}

function soon(_state, _params, tool) {
  throw new ToolError(`Em breve: ${tool.soonReason}`);
}

// ---------- catálogo ----------
export function wordCatalogue(state = { html: "" }) {
  const root = parse(state.html);
  const all = units(root);
  const options = all.map((element, index) => [String(index), `${index + 1} · ${TAG_LABEL[element.tagName] ? `[${TAG_LABEL[element.tagName]}] ` : ""}${textOf(element).trim().slice(0, 48) || "(vazio)"}`]);
  const headings = all.flatMap((element, index) => (HEADING_TAGS.has(element.tagName) ? [String(index)] : []));
  const pick = (defaults) => ({ key: "paragraphs", label: "Parágrafos", type: "multi", default: defaults, options, empty: "O documento está vazio." });
  const tools = [
    { id: "estilos.aplicar", tab: "estilos", label: "Estilo de parágrafo", icon: Pilcrow, description: "Aplica Normal, Título 1, 2, 3 ou Citação aos parágrafos escolhidos.", params: [pick([]), { key: "style", label: "Estilo", type: "select", default: "h2", options: STYLE_OPTIONS }], run: applyStyle },
    {
      id: "estilos.titulos",
      tab: "estilos",
      label: "Detectar títulos",
      icon: Heading,
      description: "Transforma em título os parágrafos curtos sem pontuação final.",
      how: "Cada parágrafo Normal com até o número de palavras escolhido e sem ponto, vírgula ou dois-pontos no fim vira Título 2; o primeiro pode virar Título 1 se o documento ainda não tiver um.",
      params: [
        { key: "maxWords", label: "Máximo de palavras", type: "stepper", min: 1, max: 20, step: 1, default: 8 },
        { key: "firstAsTitle", label: "Primeiro parágrafo vira Título 1", type: "toggle", default: true },
      ],
      run: autoHeadings,
    },
    {
      id: "estilos.fonte",
      tab: "estilos",
      label: "Fonte do documento",
      icon: Type,
      description: "Padroniza a fonte (e o tamanho do corpo) em todo o documento.",
      how: "Remove fontes diferentes aplicadas em trechos e aplica a escolhida em todos os blocos. O tamanho vale para o corpo; títulos mantêm o tamanho do estilo.",
      params: [
        { key: "font", label: "Fonte", type: "select", default: "Aptos", options: Object.keys(fontFamilies).map((name) => [name, name]) },
        { key: "size", label: "Tamanho do corpo", type: "chips", default: "keep", options: [["keep", "Manter"], ["11", "11 pt"], ["12", "12 pt"], ["14", "14 pt"]] },
      ],
      run: documentFont,
    },
    {
      id: "estilos.alinhar",
      tab: "estilos",
      label: "Alinhar parágrafos",
      icon: AlignCenter,
      description: "Alinha de uma vez o corpo, os títulos ou o documento inteiro.",
      params: [
        { key: "align", label: "Alinhamento", type: "chips", default: "justify", options: [["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"], ["justify", "Justificado"]] },
        { key: "target", label: "Aplicar em", type: "chips", default: "body", options: [["body", "Corpo"], ["headings", "Títulos"], ["all", "Tudo"]] },
      ],
      run: alignParagraphs,
    },
    { id: "estrutura.listasAuto", tab: "estrutura", label: "Listas automáticas", icon: ListTree, description: "Parágrafos que começam com -, *, • ou 1. viram listas de verdade.", how: "O marcador digitado é removido e parágrafos vizinhos do mesmo tipo formam uma lista só (com marcadores ou numerada).", params: [], run: autoLists },
    {
      id: "estrutura.lista",
      tab: "estrutura",
      label: "Transformar em lista",
      icon: List,
      description: "Coloca os parágrafos escolhidos numa lista com marcadores ou numerada.",
      params: [pick([]), { key: "kind", label: "Tipo", type: "chips", default: "ul", options: [["ul", "Marcadores"], ["ol", "Numerada"]] }],
      run: toList,
    },
    { id: "estrutura.removerListas", tab: "estrutura", label: "Remover listas", icon: ListX, description: "Desfaz as listas: cada item volta a ser um parágrafo.", params: [], run: removeLists },
    {
      id: "estrutura.sumario",
      tab: "estrutura",
      label: "Sumário",
      icon: ListOrdered,
      description: "Monta (ou atualiza) um sumário com os títulos do documento.",
      how: "Lista os Títulos 1, 2 e 3 na ordem do texto. Se já houver um sumário gerado, ele é substituído.",
      params: [{ key: "position", label: "Posição", type: "chips", default: "afterTitle", options: [["afterTitle", "Depois do Título 1"], ["start", "No início"]] }],
      run: tableOfContents,
    },
    {
      id: "texto.substituir",
      tab: "texto",
      label: "Localizar e substituir",
      icon: Replace,
      description: "Troca um texto por outro em todo o documento.",
      how: "Procura dentro de cada trecho de texto; um termo dividido por formatação diferente (ex.: metade em negrito) não é encontrado. Use Analisar para ver quantas ocorrências serão trocadas.",
      params: [
        { key: "find", label: "Localizar", type: "text", default: "", rows: 1 },
        { key: "replace", label: "Substituir por", type: "text", default: "", rows: 1, help: "Deixe vazio para apagar as ocorrências." },
        { key: "caseSensitive", label: "Diferenciar maiúsculas", type: "toggle", default: false },
        { key: "wholeWord", label: "Só palavra inteira", type: "toggle", default: true },
      ],
      run: findReplace,
    },
    { id: "texto.caixa", tab: "texto", label: "Maiúsculas e minúsculas", icon: CaseSensitive, description: "Muda a caixa do texto dos parágrafos escolhidos.", params: [pick(headings), { key: "mode", label: "Caixa", type: "select", default: "title", options: CASE_OPTIONS }], run: changeCase },
    {
      id: "texto.limpar",
      tab: "texto",
      label: "Limpar espaços",
      icon: Eraser,
      description: "Remove espaços duplos, espaços no começo/fim dos parágrafos e, se quiser, parágrafos vazios.",
      params: [{ key: "removeEmpty", label: "Remover parágrafos vazios", type: "toggle", default: true }],
      run: cleanSpaces,
    },
    { id: "texto.repetidas", tab: "texto", label: "Palavras repetidas", icon: Repeat2, description: "Corrige palavras repetidas em sequência (ex.: “de de”).", how: "Use Analisar para ver a lista antes de aplicar.", params: [], run: repeatedWords },
    {
      id: "texto.inserir",
      tab: "texto",
      label: "Inserir parágrafo",
      icon: TextQuote,
      description: "Escreve um ou mais parágrafos no início ou no fim do documento.",
      how: "Cada linha vira um parágrafo. O texto entra como texto puro (marcações HTML aparecem como digitadas).",
      params: [
        { key: "text", label: "Texto", type: "text", default: "", rows: 3 },
        { key: "style", label: "Estilo", type: "select", default: "p", options: STYLE_OPTIONS },
        { key: "position", label: "Posição", type: "chips", default: "end", options: [["end", "No fim"], ["start", "No início"]] },
      ],
      run: insertParagraphs,
    },
    { id: "revisao.estatisticas", tab: "revisao", label: "Estatísticas", icon: BarChart3, description: "Conta palavras, caracteres, parágrafos, títulos e o tempo de leitura.", analyze: false, applyLabel: "Contar", params: [], run: statistics },
    {
      id: "revisao.ortografia",
      tab: "revisao",
      label: "Ortografia",
      icon: SpellCheck,
      description: "Lista e corrige erros de ortografia e gramática.",
      status: "soon",
      soonReason: "o navegador sublinha os erros no documento (Revisão › Verificação ortográfica), mas não entrega as sugestões ao MCP; precisa de um dicionário pt-BR local.",
      params: [],
      run: soon,
    },
    {
      id: "revisao.notas",
      tab: "revisao",
      label: "Notas de rodapé",
      icon: BookOpenCheck,
      description: "Insere notas de rodapé numeradas e referências.",
      status: "soon",
      soonReason: "o WordCraft ainda não tem notas de rodapé no editor nem na exportação .doc.",
      params: [],
      run: soon,
    },
  ];
  return { tabs: WORD_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runWordTool(toolId, state, params) {
  const tool = wordCatalogue(state).tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run(state, { ...defaultsOf(tool), ...(params || {}) }, tool);
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
