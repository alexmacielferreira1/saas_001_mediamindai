// Catálogo de ferramentas de um clique do PowerPoint (DeckCraft) para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { slides, index } e devolve { ok, summary, slides, index }; textos são guardados como
// texto puro (o React os mostra escapados). Condições não atendidas viram { ok: false, summary }.
import { AlignHorizontalJustifyCenter, Bold, CaseUpper, CopyPlus, LayoutList, LayoutTemplate, List, ListChecks, MoveVertical, Palette, Presentation, Split, StickyNote, TextSearch, Trash2 } from "lucide-react";
import { isHexColor, moveItem, sameTheme, slideAligns, slideLayouts, slideThemeOf, slideThemes } from "../../pages/OfficeCraft";
import { createCaseTransformer } from "./wordMcpTools";

export const POWERPOINT_TABS = [
  { id: "slides", label: "Slides" },
  { id: "layout", label: "Layout" },
  { id: "texto", label: "Texto" },
  { id: "design", label: "Design" },
];

class ToolError extends Error {}

const CASE_OPTIONS = [
  ["upper", "MAIÚSCULAS"],
  ["title", "Primeira Letra De Cada Palavra"],
  ["sentence", "Como em uma frase"],
  ["lower", "minúsculas"],
];
const BULLET = /^\s*(?:[-*•–]|\d+[.)])\s+/;
const layoutOptions = () => slideLayouts.map((layout) => [layout.id, layout.label]);
const layoutLabel = (id) => slideLayouts.find((layout) => layout.id === id).label;
const blank = (id, data) => ({ id, title: "", body: "", layout: "title", titleStyle: { bold: false, italic: false }, bodyStyle: { bold: false, italic: false }, ...data });
const copyOf = (slide, id) => ({ ...slide, id, titleStyle: { ...slide.titleStyle }, bodyStyle: { ...slide.bodyStyle } });

function slideAt(state, value) {
  const index = Number(value);
  if (!Number.isInteger(index) || !state.slides[index]) throw new ToolError("Escolha um slide.");
  return index;
}

function chosen(state, ids) {
  const wanted = new Set((ids || []).map(String));
  const list = state.slides.flatMap((_, index) => (wanted.has(String(index)) ? [index] : []));
  if (!list.length) throw new ToolError("Escolha um ou mais slides.");
  return list;
}

const insertAt = (slides, at, items) => [...slides.slice(0, at), ...items, ...slides.slice(at)];

// ---------- slides ----------
function newSlide(state, params, env) {
  const at = params.position === "after" ? state.index + 1 : state.slides.length;
  const slide = blank(env.newId(), { layout: params.layout, title: String(params.title ?? ""), body: params.layout === "title-only" ? "" : String(params.body ?? "") });
  return { ok: true, count: 1, summary: `Slide ${at + 1} criado (${layoutLabel(params.layout)})`, slides: insertAt(state.slides, at, [slide]), index: at };
}

function duplicate(state, params, env) {
  const index = slideAt(state, params.slide);
  const copies = Array.from({ length: params.copies }, () => copyOf(state.slides[index], env.newId()));
  return { ok: true, count: copies.length, summary: `Slide ${index + 1} duplicado ${copies.length} vez(es)`, slides: insertAt(state.slides, index + 1, copies), index: index + 1 };
}

function move(state, params) {
  const from = slideAt(state, params.slide);
  const to = slideAt(state, params.to);
  if (from === to) throw new ToolError("O slide já está nessa posição.");
  return { ok: true, count: 1, summary: `Slide ${from + 1} movido para a posição ${to + 1}`, slides: moveItem(state.slides, from, to), index: to };
}

function remove(state, params) {
  const list = chosen(state, params.slides);
  if (list.length === state.slides.length) throw new ToolError("A apresentação precisa de ao menos um slide.");
  const slides = state.slides.filter((_, index) => !list.includes(index));
  return { ok: true, count: list.length, summary: `${list.length} slide(s) excluído(s): ${list.map((index) => index + 1).join(", ")}`, slides, index: Math.min(state.index, slides.length - 1) };
}

function topicsToSlides(state, params, env) {
  const index = slideAt(state, params.slide);
  const topics = state.slides[index].body
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET, "").trim())
    .filter(Boolean);
  if (!topics.length) throw new ToolError("O slide escolhido não tem tópicos no conteúdo (uma linha por tópico).");
  const created = topics.map((title) => blank(env.newId(), { title, layout: "title-only" }));
  return { ok: true, count: created.length, summary: `${created.length} slide(s) criado(s) a partir dos tópicos do slide ${index + 1}`, details: topics, slides: insertAt(state.slides, index + 1, created), index: index + 1 };
}

function agenda(state, params, env) {
  const title = String(params.title ?? "").trim() || "Agenda";
  const existing = state.slides[1]?.title === title && state.slides[1].layout === "title-content";
  const topics = state.slides
    .slice(existing ? 2 : 1)
    .map((slide) => slide.title.trim())
    .filter(Boolean);
  if (!topics.length) throw new ToolError("Crie mais slides com título antes de montar a agenda.");
  const body = topics.map((topic) => `• ${topic}`).join("\n");
  const slides = existing ? state.slides.map((slide, index) => (index === 1 ? { ...slide, body } : slide)) : insertAt(state.slides, 1, [blank(env.newId(), { title, body, layout: "title-content" })]);
  return { ok: true, count: topics.length, summary: `Agenda ${existing ? "atualizada" : "criada"} no slide 2 com ${topics.length} tópico(s)`, details: topics, slides, index: 1 };
}

// ---------- layout ----------
function applyLayout(state, params) {
  const list = chosen(state, params.slides).filter((index) => state.slides[index].layout !== params.layout);
  if (!list.length) throw new ToolError("Os slides escolhidos já usam esse layout.");
  return { ok: true, count: list.length, summary: `${layoutLabel(params.layout)} em ${list.length} slide(s)`, slides: state.slides.map((slide, index) => (list.includes(index) ? { ...slide, layout: params.layout } : slide)), index: state.index };
}

function standardize(state) {
  const target = (slide, index) => (index === 0 ? "title" : slide.body.trim() ? "title-content" : "title-only");
  const changed = state.slides.filter((slide, index) => slide.layout !== target(slide, index)).length;
  if (!changed) throw new ToolError("Os layouts já estão padronizados.");
  return {
    ok: true,
    count: changed,
    summary: `Layouts padronizados em ${changed} slide(s): capa com Slide de título, conteúdo com Título e conteúdo`,
    slides: state.slides.map((slide, index) => ({ ...slide, layout: target(slide, index) })),
    index: state.index,
  };
}

// ---------- texto ----------
function textStyle(state, params) {
  const list = chosen(state, params.slides);
  const keys = params.target === "both" ? ["titleStyle", "bodyStyle"] : [params.target === "title" ? "titleStyle" : "bodyStyle"];
  const look = { bold: Boolean(params.bold), italic: Boolean(params.italic) };
  let changed = 0;
  const slides = state.slides.map((slide, index) => {
    if (!list.includes(index)) return slide;
    const next = { ...slide };
    keys.forEach((key) => {
      if (slide[key].bold !== look.bold || slide[key].italic !== look.italic) changed += 1;
      next[key] = { ...look };
    });
    return next;
  });
  if (!changed) throw new ToolError("Os textos escolhidos já estão com esse estilo.");
  const label = [look.bold && "negrito", look.italic && "itálico"].filter(Boolean).join(" e ") || "texto normal";
  return { ok: true, count: changed, summary: `${label[0].toUpperCase()}${label.slice(1)} em ${changed} texto(s)`, slides, index: state.index };
}

function titleCase(state, params) {
  const list = chosen(state, params.slides);
  let changed = 0;
  const slides = state.slides.map((slide, index) => {
    if (!list.includes(index)) return slide;
    const title = createCaseTransformer(params.mode)(slide.title);
    if (title === slide.title) return slide;
    changed += 1;
    return { ...slide, title };
  });
  if (!changed) throw new ToolError("Os títulos escolhidos já estão assim.");
  return { ok: true, count: changed, summary: `${CASE_OPTIONS.find(([key]) => key === params.mode)[1]} em ${changed} título(s)`, slides, index: state.index };
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function replaceText(state, params) {
  const find = String(params.find ?? "");
  if (!find) throw new ToolError("Digite o texto a localizar.");
  const replacement = String(params.replace ?? "");
  const pattern = new RegExp(escapeRegExp(find), `gu${params.caseSensitive ? "" : "i"}`);
  let count = 0;
  const swap = (text) =>
    text.replace(pattern, () => {
      count += 1;
      return replacement;
    });
  const slides = state.slides.map((slide) => ({ ...slide, title: swap(slide.title), body: swap(slide.body) }));
  if (!count) throw new ToolError(`“${find}” não aparece em nenhum slide.`);
  return { ok: true, count, summary: `${count} ocorrência(s) de “${find}” trocada(s) por “${replacement}”`, slides, index: state.index };
}

function bullets(state, params) {
  const list = chosen(state, params.slides);
  const add = params.mode === "add";
  let changed = 0;
  const slides = state.slides.map((slide, index) => {
    if (!list.includes(index)) return slide;
    const body = slide.body
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        return add ? (BULLET.test(line) ? line : `• ${line.trimStart()}`) : line.replace(BULLET, "");
      })
      .join("\n");
    if (body === slide.body) return slide;
    changed += 1;
    return { ...slide, body };
  });
  if (!changed) throw new ToolError(add ? "Os slides escolhidos já têm marcadores (ou não têm conteúdo)." : "Os slides escolhidos não têm marcadores.");
  return { ok: true, count: changed, summary: `Marcadores ${add ? "adicionados" : "removidos"} em ${changed} slide(s)`, slides, index: state.index };
}

// ---------- design ----------
function applyTheme(state, params) {
  const list = chosen(state, params.slides);
  const preset = slideThemes.find((theme) => theme.id === params.preset);
  const theme = preset ? { background: preset.background, color: preset.color } : { background: isHexColor(params.background) ? params.background : "", color: isHexColor(params.color) ? params.color : "" };
  if (!theme.background || !theme.color) throw new ToolError("Escolha a cor de fundo e a cor do texto.");
  if (theme.background.toLowerCase() === theme.color.toLowerCase()) throw new ToolError("O fundo e o texto têm a mesma cor: o texto ficaria invisível.");
  let changed = 0;
  const slides = state.slides.map((slide, index) => {
    if (!list.includes(index) || sameTheme(slideThemeOf(slide), theme)) return slide;
    changed += 1;
    return { ...slide, theme };
  });
  if (!changed) throw new ToolError("Os slides escolhidos já usam esse tema.");
  return { ok: true, count: changed, summary: `Tema ${preset ? preset.label : "personalizado"} (fundo ${theme.background}, texto ${theme.color}) em ${changed} slide(s)`, slides, index: state.index };
}

function alignText(state, params) {
  const list = chosen(state, params.slides);
  let changed = 0;
  const slides = state.slides.map((slide, index) => {
    if (!list.includes(index) || (slide.align || "auto") === params.align) return slide;
    changed += 1;
    return { ...slide, align: params.align };
  });
  if (!changed) throw new ToolError("Os slides escolhidos já estão com esse alinhamento.");
  const label = slideAligns.find(([key]) => key === params.align)[1].toLowerCase();
  return { ok: true, count: changed, summary: `Alinhamento ${label} no título e no conteúdo de ${changed} slide(s)`, slides, index: state.index };
}

function notes(state, params) {
  const index = slideAt(state, params.slide);
  const old = state.slides[index].notes || "";
  const text = String(params.text ?? "");
  let next = "";
  if (params.action === "clear") {
    if (!old) throw new ToolError(`O slide ${index + 1} não tem anotações.`);
  } else {
    if (!text.trim()) throw new ToolError("Digite o texto das anotações (ou escolha Limpar).");
    next = params.action === "append" && old ? `${old}\n${text}` : text;
    if (next === old) throw new ToolError("As anotações já estão assim.");
  }
  const verb = params.action === "clear" ? "apagadas" : params.action === "append" ? "acrescentadas" : "atualizadas";
  return { ok: true, count: 1, summary: `Anotações do slide ${index + 1} ${verb}`, slides: state.slides.map((slide, position) => (position === index ? { ...slide, notes: next } : slide)), index };
}

// ---------- catálogo ----------
export function powerpointCatalogue(state = { slides: [], index: 0 }) {
  const options = state.slides.map((slide, index) => [String(index), `${index + 1} · ${slide.title.trim().slice(0, 40) || "(sem título)"}`]);
  const current = String(state.index);
  const all = options.map(([id]) => id);
  const empty = "A apresentação não tem slides.";
  const pickOne = (key, label, value = current) => ({ key, label, type: "select", default: value, options });
  const pickMany = (defaults) => ({ key: "slides", label: "Slides", type: "multi", default: defaults, options, empty });
  const tools = [
    {
      id: "slides.novo",
      tab: "slides",
      label: "Novo slide",
      icon: Presentation,
      description: "Cria um slide com o layout, o título e o conteúdo que você escrever.",
      params: [
        { key: "layout", label: "Layout", type: "chips", default: "title-content", options: layoutOptions() },
        { key: "title", label: "Título", type: "text", default: "Novo slide", rows: 1 },
        { key: "body", label: "Conteúdo", type: "text", default: "", rows: 3, when: { key: "layout", notEquals: "title-only" } },
        { key: "position", label: "Posição", type: "chips", default: "after", options: [["after", "Depois do atual"], ["end", "No fim"]] },
      ],
      run: newSlide,
    },
    { id: "slides.duplicar", tab: "slides", label: "Duplicar slide", icon: CopyPlus, description: "Cria cópias de um slide logo depois dele.", params: [pickOne("slide", "Slide"), { key: "copies", label: "Cópias", type: "stepper", min: 1, max: 10, step: 1, default: 1 }], run: duplicate },
    { id: "slides.mover", tab: "slides", label: "Reordenar", icon: MoveVertical, description: "Move um slide para outra posição.", params: [pickOne("slide", "Slide"), { key: "to", label: "Para a posição", type: "select", default: "0", options: options.map(([id]) => [id, String(Number(id) + 1)]) }], run: move },
    { id: "slides.excluir", tab: "slides", label: "Excluir slides", icon: Trash2, description: "Exclui os slides escolhidos.", confirm: "Excluir os slides escolhidos? Dá para desfazer pelo MCP.", params: [pickMany([])], run: remove },
    { id: "slides.topicos", tab: "slides", label: "Tópicos em slides", icon: Split, description: "Cada linha do conteúdo de um slide vira um slide novo com aquele título.", how: "Marcadores digitados (-, •, 1.) são retirados. Os slides novos entram logo depois do escolhido, com o layout Somente título.", params: [pickOne("slide", "Slide com os tópicos")], run: topicsToSlides },
    { id: "slides.agenda", tab: "slides", label: "Slide de agenda", icon: ListChecks, description: "Cria (ou atualiza) o slide 2 com a lista dos títulos da apresentação.", params: [{ key: "title", label: "Título", type: "text", default: "Agenda", rows: 1 }], run: agenda },
    { id: "layout.aplicar", tab: "layout", label: "Aplicar layout", icon: LayoutTemplate, description: "Troca o layout dos slides escolhidos.", params: [pickMany([current]), { key: "layout", label: "Layout", type: "chips", default: "title-content", options: layoutOptions() }], run: applyLayout },
    { id: "layout.padronizar", tab: "layout", label: "Padronizar layouts", icon: LayoutList, description: "Capa com Slide de título; slides com conteúdo em Título e conteúdo; os demais em Somente título.", params: [], run: standardize },
    {
      id: "texto.estilo",
      tab: "texto",
      label: "Negrito e itálico",
      icon: Bold,
      description: "Define negrito/itálico do título, do conteúdo ou dos dois.",
      params: [pickMany(all), { key: "target", label: "Aplicar em", type: "chips", default: "title", options: [["title", "Título"], ["body", "Conteúdo"], ["both", "Os dois"]] }, { key: "bold", label: "Negrito", type: "toggle", default: true }, { key: "italic", label: "Itálico", type: "toggle", default: false }],
      run: textStyle,
    },
    { id: "texto.caixa", tab: "texto", label: "Caixa dos títulos", icon: CaseUpper, description: "Padroniza maiúsculas e minúsculas dos títulos.", params: [pickMany(all), { key: "mode", label: "Caixa", type: "select", default: "title", options: CASE_OPTIONS }], run: titleCase },
    {
      id: "texto.substituir",
      tab: "texto",
      label: "Substituir texto",
      icon: TextSearch,
      description: "Troca um texto por outro nos títulos e conteúdos de todos os slides.",
      params: [
        { key: "find", label: "Localizar", type: "text", default: "", rows: 1 },
        { key: "replace", label: "Substituir por", type: "text", default: "", rows: 1 },
        { key: "caseSensitive", label: "Diferenciar maiúsculas", type: "toggle", default: false },
      ],
      run: replaceText,
    },
    { id: "texto.marcadores", tab: "texto", label: "Marcadores", icon: List, description: "Põe ou tira “• ” no começo de cada linha do conteúdo.", params: [pickMany([current]), { key: "mode", label: "Ação", type: "chips", default: "add", options: [["add", "Adicionar"], ["remove", "Remover"]] }], run: bullets },
    {
      id: "design.tema",
      tab: "design",
      label: "Tema e cores",
      icon: Palette,
      description: "Aplica um tema (fundo e cor do texto) aos slides escolhidos.",
      how: "O tema fica salvo em cada slide (inclusive no .json) e aparece no editor, nas miniaturas e na apresentação.",
      params: [
        pickMany(all),
        { key: "preset", label: "Tema", type: "chips", default: "dark", options: [...slideThemes.map((theme) => [theme.id, theme.label]), ["custom", "Personalizado"]] },
        { key: "background", label: "Cor de fundo", type: "color", default: "#ffffff", when: { key: "preset", equals: "custom" } },
        { key: "color", label: "Cor do texto", type: "color", default: "#252525", when: { key: "preset", equals: "custom" } },
      ],
      run: applyTheme,
    },
    {
      id: "design.alinhar",
      tab: "design",
      label: "Alinhar textos",
      icon: AlignHorizontalJustifyCenter,
      description: "Alinha título e conteúdo à esquerda, ao centro, à direita ou justificado.",
      how: "“Pelo layout” volta ao padrão: Título e conteúdo à esquerda; os outros layouts centralizados.",
      params: [pickMany([current]), { key: "align", label: "Alinhamento", type: "chips", default: "left", options: slideAligns }],
      run: alignText,
    },
    {
      id: "design.notas",
      tab: "design",
      label: "Anotações",
      icon: StickyNote,
      description: "Escreve, acrescenta ou limpa as anotações do apresentador de um slide.",
      how: "As anotações ficam no painel abaixo do slide e aparecem só para quem apresenta (tecla N no modo apresentação).",
      params: [
        pickOne("slide", "Slide"),
        { key: "action", label: "Ação", type: "chips", default: "set", options: [["set", "Escrever"], ["append", "Acrescentar"], ["clear", "Limpar"]] },
        { key: "text", label: "Anotações", type: "text", default: state.slides[state.index]?.notes || "", rows: 4, when: { key: "action", notEquals: "clear" } },
      ],
      run: notes,
    },
  ];
  return { tabs: POWERPOINT_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));
const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runPowerPointTool(toolId, state, params, env = { newId: randomId }) {
  const tool = powerpointCatalogue(state).tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run(state, { ...defaultsOf(tool), ...(params || {}) }, env, tool);
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
