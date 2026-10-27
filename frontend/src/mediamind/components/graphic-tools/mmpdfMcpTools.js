// Catálogo de ferramentas de um clique do PDF (MMPDF) para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { docKey, docName, page, annotations, newId } e devolve { ok, summary, annotations } —
// o app grava `annotations` (camada de anotação do MMPDF, a mesma das ferramentas do painel; o arquivo PDF
// não é reescrito). O que exige um mecanismo de edição de PDF fica "em breve", sem botão falso.
import { refuseIfUnchanged } from "./mcpResultGuard";
import { FileOutput, Files, Highlighter, Link, Lock, PanelTop, ScanText, Send, Signature, Stamp, StickyNote, Trash2, Type, Droplets } from "lucide-react";

export const MMPDF_TABS = [
  { id: "editar", label: "Editar" },
  { id: "comentar", label: "Comentar" },
  { id: "assinar", label: "Assinar" },
  { id: "organizar", label: "Organizar" },
  { id: "proteger", label: "Proteger e exportar" },
];

class ToolError extends Error {}

const LAYER = "camada de anotação do MMPDF";
const ENGINE = "requer um mecanismo de edição de PDF (pdf-lib/pdf.js), que ainda não está instalado no MediaMind.";

function docItems(state) {
  if (!state.docKey) throw new ToolError("Abra um PDF primeiro.");
  return state.annotations[state.docKey] || [];
}

function required(value, message) {
  const text = String(value ?? "").trim();
  if (!text) throw new ToolError(message);
  return text;
}

const pageOf = (state, params) => (params.where === "all" ? 0 : state.page);
const whereText = (page) => (page ? `na página ${page}` : "em todas as páginas");

function add(state, item, summary) {
  const items = docItems(state);
  const annotation = { id: state.newId(), page: state.page, ...item };
  return {
    ok: true,
    count: 1,
    summary: `${summary} (${LAYER})`,
    annotations: { ...state.annotations, [state.docKey]: [...items, annotation] },
  };
}

function text(state, params) {
  const value = required(params.text, "Escreva o texto a adicionar.");
  const page = pageOf(state, params);
  return add(state, { type: "text", text: value, x: params.x, y: params.y, page }, `Texto “${value}” adicionado ${whereText(page)}`);
}

function link(state, params) {
  const url = required(params.url, "Informe o endereço do link.");
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new ToolError("Link inválido: use um endereço http:// ou https://.");
  const label = String(params.text ?? "").trim() || url;
  return add(state, { type: "link", url, text: label, x: params.x, y: params.y }, `Link para ${url} adicionado na página ${state.page}`);
}

function wide(type, label, message) {
  return (state, params) => {
    const value = required(params.text, message);
    return add(state, { type, text: value, page: 0 }, `${label} “${value}” em todas as páginas`);
  };
}

function note(state, params) {
  const value = required(params.text, "Escreva o texto da nota.");
  return add(state, { type: "note", text: value, x: params.x, y: params.y }, `Nota adicionada na página ${state.page}`);
}

function stamp(state, params) {
  const page = pageOf(state, params);
  return add(state, { type: "stamp", text: params.stamp, x: params.x, y: params.y, page }, `Carimbo ${params.stamp} ${whereText(page)}`);
}

const MARKS = { Realçar: "Realce", Sublinhar: "Sublinhado", Riscar: "Tachado" };

function markArea(state, params) {
  const w = Math.min(params.w, 100 - params.x);
  if (w <= 0.5) throw new ToolError("A área ficou fora da página: diminua a posição horizontal.");
  return add(state, { type: params.style, x: params.x, y: params.y, w, h: Math.max(params.h, 2) }, `${MARKS[params.style]} adicionado na página ${state.page}`);
}

const initials = (name) =>
  name
    .split(/\s+/)
    .map((word) => word[0].toUpperCase())
    .join("");

function sign(state, params) {
  const name = required(params.name, "Escreva o nome para a assinatura.");
  const value = params.kind === "initials" ? initials(name) : name;
  const page = pageOf(state, params);
  return add(state, { type: "signature", text: value, x: params.x, y: params.y, page }, `${params.kind === "initials" ? "Iniciais" : "Assinatura"} “${value}” ${whereText(page)}`);
}

function clear(state, params) {
  const items = docItems(state);
  const keep = params.scope === "page" ? items.filter((item) => item.page !== state.page) : [];
  const removed = items.length - keep.length;
  if (!removed) throw new ToolError(params.scope === "page" ? `A página ${state.page} não tem anotações próprias.` : "Este documento não tem anotações.");
  return {
    ok: true,
    count: removed,
    summary: `${removed} anotação(ões) removida(s) ${params.scope === "page" ? `da página ${state.page}` : "do documento"}`,
    annotations: { ...state.annotations, [state.docKey]: keep },
  };
}

const pos = (key, label, value) => ({ key, label, type: "range", min: 0, max: 95, step: 1, default: value, unit: "%" });
const where = {
  key: "where",
  label: "Páginas",
  type: "select",
  default: "current",
  options: [
    ["current", "Só a página atual"],
    ["all", "Todas as páginas"],
  ],
};
const LAYER_HOW = "Entra na camada de anotação do MMPDF (duplo clique na anotação a remove). O arquivo PDF original não é reescrito.";
const soon = (id, tab, label, icon, description, soonReason) => ({
  id,
  tab,
  label,
  icon,
  status: "soon",
  soonReason,
  description,
  params: [],
  run: () => ({ ok: false, summary: `“${label}” ainda não está disponível: ${soonReason}` }),
});

export function mmpdfCatalogue() {
  const tools = [
    {
      id: "edit.text",
      tab: "editar",
      label: "Texto",
      icon: Type,
      description: "Escreve um texto sobre o documento na posição escolhida.",
      how: LAYER_HOW,
      params: [{ key: "text", label: "Texto", type: "text", default: "", placeholder: "Texto a adicionar" }, pos("x", "Posição horizontal", 10), pos("y", "Posição vertical", 10), where],
      run: text,
    },
    {
      id: "edit.link",
      tab: "editar",
      label: "Link",
      icon: Link,
      description: "Cria um link clicável (http/https) na página atual.",
      how: LAYER_HOW,
      params: [
        { key: "url", label: "Endereço", type: "text", rows: 1, default: "https://" },
        { key: "text", label: "Texto do link (vazio = endereço)", type: "text", rows: 1, default: "" },
        pos("x", "Posição horizontal", 10),
        pos("y", "Posição vertical", 90),
      ],
      run: link,
    },
    {
      id: "edit.headerfooter",
      tab: "editar",
      label: "Cabeçalho e rodapé",
      icon: PanelTop,
      description: "Repete o texto no topo e no pé de todas as páginas.",
      how: LAYER_HOW,
      params: [{ key: "text", label: "Texto", type: "text", rows: 1, default: "", placeholder: "Ex.: Relatório 2026 · MediaMind" }],
      run: wide("headerfooter", "Cabeçalho e rodapé", "Escreva o texto do cabeçalho e rodapé."),
    },
    {
      id: "edit.watermark",
      tab: "editar",
      label: "Marca d'água",
      icon: Droplets,
      description: "Texto diagonal translúcido em todas as páginas.",
      how: LAYER_HOW,
      params: [{ key: "text", label: "Texto", type: "text", rows: 1, default: "CONFIDENCIAL" }],
      run: wide("watermark", "Marca d'água", "Escreva o texto da marca d'água."),
    },
    soon("edit.ocr", "editar", "OCR", ScanText, "Reconhece o texto de páginas digitalizadas para torná-lo pesquisável.", `o OCR ${ENGINE.replace("requer", "precisa de")}`),
    {
      id: "comment.note",
      tab: "comentar",
      label: "Nota",
      icon: StickyNote,
      description: "Nota adesiva amarela na página atual.",
      how: LAYER_HOW,
      params: [{ key: "text", label: "Texto da nota", type: "text", default: "" }, pos("x", "Posição horizontal", 70), pos("y", "Posição vertical", 10)],
      run: note,
    },
    {
      id: "comment.stamp",
      tab: "comentar",
      label: "Carimbo",
      icon: Stamp,
      description: "Carimbo de revisão (aprovado, revisado…).",
      how: LAYER_HOW,
      params: [
        { key: "stamp", label: "Carimbo", type: "chips", default: "APROVADO", options: ["APROVADO", "REVISADO", "CONFIDENCIAL", "RASCUNHO", "URGENTE"].map((item) => [item, item]) },
        pos("x", "Posição horizontal", 70),
        pos("y", "Posição vertical", 5),
        where,
      ],
      run: stamp,
    },
    {
      id: "comment.mark",
      tab: "comentar",
      label: "Marcar área",
      icon: Highlighter,
      description: "Realça, sublinha ou risca uma faixa da página atual.",
      how: "Posição e tamanho em % da página. Para marcar à mão, use Comentar › Realçar no painel e arraste sobre o documento.",
      params: [
        { key: "style", label: "Estilo", type: "chips", default: "Realçar", options: Object.entries(MARKS).map(([id, label]) => [id, label]) },
        pos("x", "Posição horizontal", 10),
        pos("y", "Posição vertical", 20),
        { key: "w", label: "Largura", type: "range", min: 1, max: 100, step: 1, default: 80, unit: "%" },
        { key: "h", label: "Altura", type: "range", min: 2, max: 30, step: 1, default: 4, unit: "%" },
      ],
      run: markArea,
    },
    {
      id: "sign.signature",
      tab: "assinar",
      label: "Assinatura",
      icon: Signature,
      description: "Assinatura manuscrita ou iniciais (geradas a partir do nome).",
      how: `${LAYER_HOW} Não é uma assinatura digital certificada.`,
      params: [
        { key: "name", label: "Nome", type: "text", rows: 1, default: "" },
        { key: "kind", label: "Tipo", type: "chips", default: "signature", options: [["signature", "Assinatura"], ["initials", "Iniciais"]] },
        pos("x", "Posição horizontal", 60),
        pos("y", "Posição vertical", 85),
        where,
      ],
      run: sign,
    },
    soon("sign.request", "assinar", "Solicitar assinaturas", Send, "Envia o documento para outras pessoas assinarem.", "requer um serviço de assinatura e envio de e-mail, que não está configurado no MediaMind."),
    {
      id: "organize.clear",
      tab: "organizar",
      label: "Limpar anotações",
      icon: Trash2,
      description: "Remove as anotações da página atual ou do documento inteiro.",
      how: "“Página atual” não remove cabeçalho, rodapé, marca d'água e o que foi posto em todas as páginas.",
      confirm: "Remover as anotações escolhidas? O Desfazer do MCP traz de volta.",
      params: [{ key: "scope", label: "Remover", type: "chips", default: "page", options: [["page", "Página atual"], ["all", "Documento todo"]] }],
      run: clear,
    },
    soon("organize.pages", "organizar", "Páginas", Files, "Inserir, extrair, substituir, dividir ou excluir páginas.", ENGINE),
    soon("protect.encrypt", "proteger", "Senha e sanitizar", Lock, "Criptografar com senha, restringir edição e remover informações ocultas.", ENGINE),
    soon("export.convert", "proteger", "Converter", FileOutput, "Exportar para Word, Excel, PowerPoint, imagem, PDF/A ou PDF/X.", `a conversão ${ENGINE.replace("requer", "precisa de")} Use “Salvar cópia” para baixar o PDF.`),
  ];
  return { tabs: MMPDF_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runMMPdfTool(toolId, state, params) {
  const tool = mmpdfCatalogue().tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    const current = { annotations: {}, page: 1, newId: () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...state };
    return refuseIfUnchanged(tool.run(current, { ...defaultsOf(tool), ...(params || {}) }), current, ["annotations"], "Nada a aplicar: as anotações já estão assim.");
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
