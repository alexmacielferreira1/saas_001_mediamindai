// Catálogo de ferramentas de um clique do DesignCraft (MMDesign) para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { doc, selectedId, pageKey, newId } e devolve { ok, summary, doc, selectedId? };
// o app grava `doc` pelo change() (um passo de desfazer). Condições não atendidas viram { ok: false, summary }.
import {
  ALargeSmall,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  BringToFront,
  CaseUpper,
  Columns3,
  Copy,
  Expand,
  FilePlus2,
  Heading1,
  Heading2,
  Pilcrow,
  Quote,
  SendToBack,
  Subscript,
  Type,
} from "lucide-react";
import { PAGE_H, PAGE_W, STYLES } from "./DesignCraftWorkspace";

export const MMDESIGN_TABS = [
  { id: "texto", label: "Texto" },
  { id: "layout", label: "Layout" },
  { id: "paginas", label: "Páginas" },
];

class ToolError extends Error {}

const round = (value) => Math.round(value * 10) / 10;
const mm = (value) => `${String(round(value)).replace(".", ",")} mm`;

function selected(state) {
  for (const [key, list] of Object.entries(state.doc.frames)) {
    const frame = list.find((item) => item.id === state.selectedId);
    if (frame) return { key, frame };
  }
  throw new ToolError("Selecione um quadro na página (ferramenta Seleção).");
}

function selectedText(state) {
  const entry = selected(state);
  if (entry.frame.type !== "text") throw new ToolError("Selecione um quadro de texto primeiro.");
  return entry;
}

function withFrame(state, key, id, patch) {
  return { ...state.doc, frames: { ...state.doc.frames, [key]: state.doc.frames[key].map((frame) => (frame.id === id ? { ...frame, ...patch } : frame)) } };
}

const frameName = (frame) => (frame.type === "text" ? `"${String(frame.text ?? "Texto").split("\n")[0].slice(0, 24)}"` : "o quadro");

// ---------- texto ----------
function paragraphStyle(name) {
  return (state) => {
    const { key, frame } = selectedText(state);
    if (frame.style === name) return { ok: false, summary: `O texto já está no estilo "${name}".` };
    return { ok: true, count: 1, summary: `Estilo "${name}" aplicado em ${frameName(frame)}`, doc: withFrame(state, key, frame.id, { italic: false, upper: false, ...STYLES[name], style: name }) };
  };
}

function textSize(state, params) {
  const { key, frame } = selectedText(state);
  return { ok: true, count: 1, summary: `Tamanho de ${frameName(frame)}: ${frame.size ?? 12} → ${params.size} pt`, doc: withFrame(state, key, frame.id, { size: params.size, style: undefined }) };
}

function uppercase(state, params) {
  const { key, frame } = selectedText(state);
  const upper = params.mode === "on";
  if (Boolean(frame.upper) === upper) return { ok: false, summary: upper ? "O texto já está em caixa-alta." : "O texto já não está em caixa-alta." };
  return { ok: true, count: 1, summary: `${upper ? "Caixa-alta aplicada" : "Caixa-alta removida"} em ${frameName(frame)}`, doc: withFrame(state, key, frame.id, { upper, style: undefined }) };
}

// ---------- layout ----------
function center(axis) {
  return (state) => {
    const { key, frame } = selected(state);
    const patch = axis === "x" ? { x: round((PAGE_W - frame.w) / 2) } : { y: round((PAGE_H - frame.h) / 2) };
    return { ok: true, count: 1, summary: `${frameName(frame)} centralizado ${axis === "x" ? "na horizontal" : "na vertical"} da página`, doc: withFrame(state, key, frame.id, patch) };
  };
}

function fillPage(state, params) {
  const { key, frame } = selected(state);
  const inset = params.bleed === "bleed" ? -3 : params.margin;
  const patch = { x: inset, y: inset, w: round(PAGE_W - inset * 2), h: round(PAGE_H - inset * 2) };
  return {
    ok: true,
    count: 1,
    summary: `${frameName(frame)} ocupa a página ${params.bleed === "bleed" ? "com sangria de 3 mm" : `com margem de ${mm(params.margin)}`}`,
    doc: withFrame(state, key, frame.id, patch),
  };
}

function duplicate(state, params) {
  const { key, frame } = selected(state);
  const copies = Array.from({ length: params.copies }, (_, index) => ({ ...frame, id: state.newId(), x: round(frame.x + params.dx * (index + 1)), y: round(frame.y + params.dy * (index + 1)) }));
  return {
    ok: true,
    count: copies.length,
    summary: `${copies.length} cópia(s) de ${frameName(frame)} a cada ${mm(params.dx)}, ${mm(params.dy)}`,
    doc: { ...state.doc, frames: { ...state.doc.frames, [key]: [...state.doc.frames[key], ...copies] } },
    selectedId: copies.at(-1).id,
  };
}

function arrange(front) {
  return (state) => {
    const { key, frame } = selected(state);
    const rest = state.doc.frames[key].filter((item) => item.id !== frame.id);
    return {
      ok: true,
      count: 1,
      summary: `${frameName(frame)} ${front ? "trazido para a frente" : "enviado para trás"}`,
      doc: { ...state.doc, frames: { ...state.doc.frames, [key]: front ? [...rest, frame] : [frame, ...rest] } },
    };
  };
}

// ---------- páginas ----------
function columns(state, params) {
  if (!state.pageKey) throw new ToolError("Abra uma página para criar as colunas.");
  const width = (PAGE_W - params.margin * 2 - params.gutter * (params.count - 1)) / params.count;
  if (width < 10) throw new ToolError("As colunas ficariam com menos de 10 mm: diminua a quantidade, a margem ou o espaço entre elas.");
  const frames = Array.from({ length: params.count }, (_, index) => ({
    id: state.newId(),
    type: "text",
    x: round(params.margin + index * (width + params.gutter)),
    y: params.margin,
    w: round(width),
    h: round(PAGE_H - params.margin * 2),
    text: `Coluna ${index + 1}`,
    font: "Inter",
    size: 11,
    weight: 400,
    leading: 1.5,
    style: "Corpo",
  }));
  return {
    ok: true,
    count: frames.length,
    summary: `${frames.length} coluna(s) de texto de ${mm(width)} na página ${state.pageKey}`,
    doc: { ...state.doc, frames: { ...state.doc.frames, [state.pageKey]: [...(state.doc.frames[state.pageKey] || []), ...frames] } },
    selectedId: frames[0].id,
  };
}

function addPages(state, params) {
  const pageCount = state.doc.pageCount + params.count;
  if (pageCount > 500) throw new ToolError("A publicação pode ter no máximo 500 páginas.");
  return { ok: true, count: params.count, summary: `${params.count} página(s) adicionada(s): agora são ${pageCount}`, doc: { ...state.doc, pageCount } };
}

// ---------- catálogo ----------
const STYLE_TOOLS = [
  ["text.title", "Título principal", Heading1],
  ["text.subtitle", "Subtítulo", Heading2],
  ["text.body", "Corpo", Pilcrow],
  ["text.caption", "Legenda", Subscript],
  ["text.credit", "Crédito", Type],
  ["text.quote", "Citação", Quote],
];

export function mmdesignCatalogue() {
  const tools = [
    ...STYLE_TOOLS.map(([id, name, icon]) => ({
      id,
      tab: "texto",
      label: name,
      icon,
      description: `Aplica o estilo de parágrafo "${name}" ao quadro de texto selecionado.`,
      how: `${STYLES[name].font} ${STYLES[name].size} pt, entrelinha ${String(STYLES[name].leading).replace(".", ",")}${STYLES[name].italic ? ", itálico" : ""}${STYLES[name].upper ? ", caixa-alta" : ""}.`,
      params: [],
      run: paragraphStyle(name),
    })),
    { id: "text.size", tab: "texto", label: "Tamanho", icon: ALargeSmall, description: "Define o tamanho do texto selecionado.", params: [{ key: "size", label: "Tamanho", type: "range", min: 6, max: 120, step: 1, default: 18, unit: "pt" }], run: textSize },
    {
      id: "text.upper",
      tab: "texto",
      label: "Caixa-alta",
      icon: CaseUpper,
      description: "Liga ou desliga a caixa-alta do texto selecionado.",
      params: [
        {
          key: "mode",
          label: "Caixa-alta",
          type: "select",
          default: "on",
          options: [
            ["on", "Ligar"],
            ["off", "Desligar"],
          ],
        },
      ],
      run: uppercase,
    },
    { id: "layout.centerX", tab: "layout", label: "Centro H", icon: AlignHorizontalJustifyCenter, description: "Centraliza o quadro na largura da página.", params: [], run: center("x") },
    { id: "layout.centerY", tab: "layout", label: "Centro V", icon: AlignVerticalJustifyCenter, description: "Centraliza o quadro na altura da página.", params: [], run: center("y") },
    {
      id: "layout.fill",
      tab: "layout",
      label: "Ocupar página",
      icon: Expand,
      description: "Estica o quadro para ocupar a página (com margem ou sangria).",
      params: [
        {
          key: "bleed",
          label: "Limite",
          type: "select",
          default: "margin",
          options: [
            ["margin", "Margem"],
            ["bleed", "Sangria (3 mm além do corte)"],
          ],
        },
        { key: "margin", label: "Margem", type: "range", min: 0, max: 40, step: 1, default: 15, unit: "mm" },
      ],
      run: fillPage,
    },
    {
      id: "layout.duplicate",
      tab: "layout",
      label: "Duplicar",
      icon: Copy,
      description: "Cria cópias do quadro em sequência com o deslocamento escolhido.",
      params: [
        { key: "copies", label: "Cópias", type: "range", min: 1, max: 12, step: 1, default: 1 },
        { key: "dx", label: "Deslocamento X", type: "range", min: -100, max: 100, step: 1, default: 5, unit: "mm" },
        { key: "dy", label: "Deslocamento Y", type: "range", min: -150, max: 150, step: 1, default: 5, unit: "mm" },
      ],
      run: duplicate,
    },
    { id: "layout.front", tab: "layout", label: "Para frente", icon: BringToFront, description: "Traz o quadro para a frente dos outros da página.", params: [], run: arrange(true) },
    { id: "layout.back", tab: "layout", label: "Para trás", icon: SendToBack, description: "Envia o quadro para trás dos outros da página.", params: [], run: arrange(false) },
    {
      id: "pages.columns",
      tab: "paginas",
      label: "Colunas",
      icon: Columns3,
      description: "Cria quadros de texto em colunas na página aberta (diagramação de revista).",
      params: [
        { key: "count", label: "Colunas", type: "range", min: 1, max: 6, step: 1, default: 3 },
        { key: "margin", label: "Margem", type: "range", min: 5, max: 40, step: 1, default: 15, unit: "mm" },
        { key: "gutter", label: "Espaço entre colunas", type: "range", min: 2, max: 20, step: 1, default: 5, unit: "mm" },
      ],
      run: columns,
    },
    { id: "pages.add", tab: "paginas", label: "Adicionar páginas", icon: FilePlus2, description: "Acrescenta páginas no fim da publicação.", params: [{ key: "count", label: "Páginas", type: "range", min: 1, max: 32, step: 1, default: 2 }], run: addPages },
  ];
  return { tabs: MMDESIGN_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runMMDesignTool(toolId, state, params) {
  const tool = mmdesignCatalogue().tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run({ newId: () => `f-${crypto.randomUUID()}`, ...state }, { ...defaultsOf(tool), ...(params || {}) });
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
