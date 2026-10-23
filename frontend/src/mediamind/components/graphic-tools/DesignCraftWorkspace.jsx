import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useEffect, useRef, useState } from "react";
import { registerMCPActions } from "../../lib/mcpActions";
import { mmdesignCatalogue, runMMDesignTool } from "./mmdesignMcpTools";
import {
  Minus,
  Download,
  Eye,
  FileText,
  Grid3X3,
  Hand,
  Image,
  Link2,
  MousePointer2,
  MousePointerClick,
  PenTool,
  Plus,
  Save,
  Square,
  Type,
  Upload,
  ZoomIn,
} from "lucide-react";

const TOOLS = [
  ["V", "Seleção", MousePointer2],
  ["A", "Seleção direta", MousePointerClick],
  ["T", "Texto", Type],
  ["F", "Quadro", Square],
  ["P", "Caneta", PenTool],
  ["L", "Linha", Minus],
  ["H", "Mão", Hand],
  ["Z", "Zoom", ZoomIn],
];
export const PAGE_W = 210;
export const PAGE_H = 297;
const PT_PX = 0.3528 * (460 / PAGE_W);
const FONT_CSS = {
  Inter: "Inter, ui-sans-serif, system-ui, sans-serif",
  Montserrat: "Montserrat, ui-sans-serif, system-ui, sans-serif",
  "Source Serif": "'Source Serif 4', 'Source Serif Pro', Georgia, serif",
};
const WEIGHT_NAME = { 400: "Regular", 600: "Semibold", 700: "Bold", 900: "Black" };
const TYPE_PRESETS = [
  [400, 12],
  [600, 18],
  [600, 24],
  [600, 32],
  [700, 48],
  [900, 72],
];
const LEADING = [1.2, 1, 1.5, 2];
export const STYLES = {
  "Título principal": { font: "Montserrat", size: 48, weight: 900, leading: 1 },
  Subtítulo: { font: "Montserrat", size: 24, weight: 700, leading: 1.2 },
  Corpo: { font: "Inter", size: 11, weight: 400, leading: 1.5 },
  Legenda: { font: "Inter", size: 9, weight: 400, leading: 1.3, italic: true },
  Crédito: { font: "Inter", size: 8, weight: 600, leading: 1.2, upper: true },
  Citação: { font: "Source Serif", size: 18, weight: 400, leading: 1.4, italic: true },
};
const MENUS = {
  Arquivo: ["Salvar", "Abrir publicação…", "Publicar PDF"],
  Editar: ["Desfazer", "Refazer", "Duplicar", "Excluir"],
  Layout: ["Adicionar página", "Excluir última página", "Página-mestre"],
  Texto: ["Estilos de parágrafo", "Fontes do documento"],
  Objeto: ["Trazer para frente", "Enviar para trás"],
  Tabela: ["Inserir tabela"],
  Exibir: ["Aumentar zoom", "Reduzir zoom", "Tamanho real", "Ajustar à janela"],
  Janela: ["Propriedades", "Estilos", "Recursos"],
  Ajuda: ["Atalhos de teclado"],
};
const SHORTCUTS = Object.fromEntries(TOOLS.map(([key, name]) => [key.toLowerCase(), name]));
const STATIC_BG = { 2: "#f7f2e8", 3: "#ffffff" };
const round = (v) => Math.round(v * 10) / 10;
const clampZoom = (v) => Math.max(25, Math.min(100, v));
const uid = () => `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function spreadLabels(count) {
  const labels = ["1"];
  for (let n = 2; n <= count; n += 2) labels.push(n + 1 <= count ? `${n}–${n + 1}` : `${n}`);
  return labels;
}
export function spreadPages(label) {
  if (label === "A-Mestre") return ["A"];
  return label.split("–");
}
function frameLayer(frame) {
  if (frame.type === "text") return "Textos";
  if (frame.src) return "Imagens";
  return "Elementos gráficos";
}
function textStyle(frame) {
  return {
    fontFamily: FONT_CSS[frame.font] || FONT_CSS.Inter,
    fontSize: `${frame.size * PT_PX}px`,
    fontWeight: frame.weight,
    lineHeight: frame.leading,
    fontStyle: frame.italic ? "italic" : undefined,
    textTransform: frame.upper ? "uppercase" : undefined,
    letterSpacing: frame.upper ? "0.12em" : undefined,
  };
}
async function toDataUrl(src) {
  if (!src || src.startsWith("data:")) return src;
  const blob = await (await fetch(src)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function sanitizeFrames(frames) {
  if (!frames || typeof frames !== "object" || Array.isArray(frames)) throw new Error("inválido");
  return Object.fromEntries(
    Object.entries(frames).map(([key, list]) => {
      if (!/^(A|\d{1,3})$/.test(key) || !Array.isArray(list)) throw new Error("inválido");
      return [
        key,
        list
          .filter((f) => f && typeof f === "object" && ["text", "rect", "ellipse", "line", "path"].includes(f.type))
          .map((f) => ({
            ...f,
            id: String(f.id || uid()),
            x: +f.x || 0,
            y: +f.y || 0,
            w: +f.w || 0,
            h: +f.h || 0,
            text: typeof f.text === "string" ? f.text : undefined,
            src: typeof f.src === "string" && /^data:image\//.test(f.src) ? f.src : undefined,
          })),
      ];
    }),
  );
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function DesignCraftWorkspace({ active = true, assets, onOpenFiles }) {
  const [tool, setTool] = useGraphicDraftState("DesignCraftWorkspace.jsx:tool", "Seleção");
  const [page, setPage] = useGraphicDraftState("DesignCraftWorkspace.jsx:page", "2–3");
  const [panel, setPanel] = useGraphicDraftState("DesignCraftWorkspace.jsx:panel", "Propriedades");
  const [zoom, setZoom] = useGraphicDraftState("DesignCraftWorkspace.jsx:zoom", 58);
  const [layers, setLayers] = useGraphicDraftState("DesignCraftWorkspace.jsx:layers", [
    { name: "Textos", visible: true, color: "bg-blue-500" },
    { name: "Imagens", visible: true, color: "bg-red-500" },
    { name: "Elementos gráficos", visible: true, color: "bg-green-500" },
    { name: "Fundo", visible: true, color: "bg-amber-500" },
  ]);
  const [doc, setDoc] = useGraphicDraftState("DesignCraftWorkspace.jsx:doc", { pageCount: 8, frames: {} });
  const [options, setOptions] = useGraphicDraftState("DesignCraftWorkspace.jsx:export", { pages: "Todas", bleed: 3, marks: "Corte" });
  const [leftTab, setLeftTab] = useState("Páginas");
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [status, setStatus] = useState("");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [creating, setCreating] = useState(null);
  const [pen, setPen] = useState(null);
  const [fieldText, setFieldText] = useState({});
  const [exporting, setExporting] = useState(null);
  const drag = useRef(null);
  const past = useRef([]);
  const future = useRef([]);
  const pendingPlace = useRef(null);
  const exportRef = useRef(null);
  const openInput = useRef(null);

  const spreads = spreadLabels(doc.pageCount);
  const currentSpread = page === "A-Mestre" || spreads.includes(page) ? page : spreads[0];
  const spreadKeys = spreadPages(currentSpread);
  const visibleLayer = (name) => layers.find((layer) => layer.name === name)?.visible !== false;
  const hide = (name) => (visibleLayer(name) ? undefined : { visibility: "hidden" });
  const allFrames = Object.entries(doc.frames).flatMap(([key, list]) => list.map((frame) => ({ ...frame, key })));
  const selectedEntry = allFrames.find((frame) => frame.id === selectedId) || null;
  const selectedText = selectedEntry?.type === "text" ? selectedEntry : null;
  const imageFrames = allFrames.filter((frame) => frame.src);
  const missing = imageFrames.filter((frame) => frame.src.startsWith("blob:") && !assets.some((asset) => asset.url === frame.src));
  const fonts = new Set(["Inter", ...allFrames.filter((f) => f.type === "text").map((f) => f.font)]);

  // Ferramentas de um clique do MCP (grade de ícones no Copiloto): planejam sobre a publicação atual
  // e gravam pelo change() (um passo de desfazer).
  const toolState = useRef(null);
  toolState.current = { doc, selectedId, pageKey: spreadKeys[0] };
  const toolActions = useRef(null);
  toolActions.current = { change, undo, setSelectedId, setStatus, canUndo: past.current.length > 0 };
  useEffect(() => {
    if (!active) return undefined;
    const strip = ({ doc: _doc, selectedId: _selected, ...result }) => result;
    return registerMCPActions({
      source: "mmdesign",
      label: "MMDesign",
      catalogue: mmdesignCatalogue,
      analyze: async (toolId, params) => {
        const result = runMMDesignTool(toolId, toolState.current, params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = runMMDesignTool(toolId, toolState.current, params);
        if (result.ok) {
          const actions = toolActions.current;
          // Guarda o estado lido pelo planejamento (correto também numa fila, antes do React redesenhar).
          past.current.push(toolState.current.doc);
          if (past.current.length > 100) past.current.shift();
          future.current = [];
          actions.change(() => result.doc, false);
          toolState.current = { ...toolState.current, doc: result.doc, ...(result.selectedId ? { selectedId: result.selectedId } : {}) };
          if (result.selectedId) actions.setSelectedId(result.selectedId);
          actions.canUndo = true;
          actions.setStatus(`MCP · ${result.summary}`);
        }
        return strip(result);
      },
      undo: () => {
        if (!toolActions.current.canUndo) return false;
        toolActions.current.undo();
        return true;
      },
      canUndo: () => toolActions.current.canUndo,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function toggleLayer(name) {
    setLayers((old) =>
      old.map((layer) =>
        layer.name === name ? { ...layer, visible: !layer.visible } : layer,
      ),
    );
  }

  function change(fn, record = true) {
    if (record) {
      past.current.push(doc);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
    }
    setDoc(fn(doc));
  }
  function updateFrame(id, patch, record = true) {
    change(
      (old) => ({
        ...old,
        frames: Object.fromEntries(
          Object.entries(old.frames).map(([key, list]) => [
            key,
            list.map((frame) => (frame.id === id ? { ...frame, ...(typeof patch === "function" ? patch(frame) : patch) } : frame)),
          ]),
        ),
      }),
      record,
    );
  }
  function addFrame(key, frame) {
    const created = { id: uid(), ...frame };
    change((old) => ({ ...old, frames: { ...old.frames, [key]: [...(old.frames[key] || []), created] } }));
    setSelectedId(created.id);
    return created;
  }
  function removeSelected() {
    if (!selectedEntry) {
      setStatus("Nenhum quadro selecionado.");
      return;
    }
    change((old) => ({
      ...old,
      frames: { ...old.frames, [selectedEntry.key]: old.frames[selectedEntry.key].filter((f) => f.id !== selectedId) },
    }));
    setSelectedId(null);
    setStatus("Quadro excluído.");
  }
  function undo() {
    if (!past.current.length) return setStatus("Nada para desfazer.");
    future.current.push(doc);
    setDoc(past.current.pop());
    setStatus("Desfeito.");
  }
  function redo() {
    if (!future.current.length) return setStatus("Nada para refazer.");
    past.current.push(doc);
    setDoc(future.current.pop());
    setStatus("Refeito.");
  }
  function reorder(front) {
    if (!selectedEntry) return setStatus("Nenhum quadro selecionado.");
    change((old) => {
      const list = old.frames[selectedEntry.key].filter((f) => f.id !== selectedId);
      const frame = old.frames[selectedEntry.key].find((f) => f.id === selectedId);
      return { ...old, frames: { ...old.frames, [selectedEntry.key]: front ? [...list, frame] : [frame, ...list] } };
    });
  }
  function addPage() {
    const next = doc.pageCount + 1;
    change((old) => ({ ...old, pageCount: old.pageCount + 1 }));
    setPage(spreadLabels(next).find((label) => spreadPages(label).includes(String(next))));
    setStatus(`Página ${next} adicionada.`);
  }
  function removeLastPage() {
    if (doc.pageCount <= 1) return setStatus("A publicação precisa de ao menos uma página.");
    const last = String(doc.pageCount);
    change((old) => {
      const frames = { ...old.frames };
      delete frames[last];
      return { ...old, pageCount: old.pageCount - 1, frames };
    });
    setStatus(`Página ${last} excluída (Desfazer restaura).`);
  }

  useEffect(() => {
    if (!pendingPlace.current) return;
    const { before, target, key } = pendingPlace.current;
    const added = assets.filter((asset) => !before.has(asset.id) && asset.type?.startsWith("image"));
    if (!added.length) return;
    pendingPlace.current = null;
    added.forEach((asset, index) => placeAsset(asset, index === 0 ? target : null, key, index));
  }, [assets]);

  function placeAsset(asset, targetId, key = spreadKeys[0], offset = 0) {
    if (!asset?.type?.startsWith("image")) {
      setStatus(`"${asset?.name}" não é uma imagem e não pode ser colocada num quadro.`);
      return;
    }
    const target = allFrames.find((frame) => frame.id === targetId && frame.type === "rect");
    if (target) {
      updateFrame(target.id, { src: asset.url, name: asset.name });
    } else {
      addFrame(key, { type: "rect", x: 20 + offset * 8, y: 40 + offset * 8, w: 120, h: 80, src: asset.url, name: asset.name });
    }
    setStatus(`Imagem colocada: ${asset.name}`);
  }

  function toMm(event, rect) {
    return [
      ((event.clientX - rect.left) / (rect.width || 460)) * PAGE_W,
      ((event.clientY - rect.top) / (rect.height || 650)) * PAGE_H,
    ];
  }

  function pagePointerDown(event, key) {
    if (event.button && event.button !== 0) return;
    if (event.target.closest?.('[contenteditable="true"]')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const [x, y] = toMm(event, rect);
    const frameEl = event.target.closest?.("[data-frame-id]");
    const frameId = frameEl?.getAttribute("data-frame-id");
    if (editingId && frameId !== editingId) setEditingId(null);
    if (tool === "Seleção" || tool === "Seleção direta") {
      const frame = allFrames.find((f) => f.id === frameId && f.key === key);
      if (!frame) {
        setSelectedId(null);
        return;
      }
      setSelectedId(frame.id);
      past.current.push(doc);
      future.current = [];
      drag.current = { mode: tool === "Seleção" ? "move" : "resize", id: frame.id, start: [x, y], orig: frame, rect };
    } else if (tool === "Texto" || tool === "Quadro" || tool === "Linha") {
      if (tool === "Texto" && frameId && allFrames.find((f) => f.id === frameId)?.type === "text") {
        setSelectedId(frameId);
        setEditingId(frameId);
        return;
      }
      const kind = tool === "Texto" ? "text" : tool === "Linha" ? "line" : event.altKey ? "ellipse" : "rect";
      drag.current = { mode: "create", kind, key, rect, start: [x, y] };
      setCreating({ key, kind, x0: x, y0: y, x1: x, y1: y });
    } else if (tool === "Caneta") {
      setPen((old) => (old && old.key === key ? { ...old, points: [...old.points, [x, y]] } : { key, points: [[x, y]] }));
      setStatus("Caneta: clique para adicionar pontos; duplo clique ou Enter conclui.");
    } else if (tool === "Mão") {
      drag.current = { mode: "pan", client: [event.clientX, event.clientY], orig: pan };
    } else if (tool === "Zoom") {
      setZoom((old) => clampZoom(old + (event.altKey ? -10 : 10)));
    }
  }

  function canvasPointerMove(event) {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pan") {
      setPan({ x: d.orig.x + event.clientX - d.client[0], y: d.orig.y + event.clientY - d.client[1] });
      return;
    }
    const [x, y] = toMm(event, d.rect);
    if (d.mode === "create") {
      setCreating((old) => old && { ...old, x1: x, y1: y });
      return;
    }
    const dx = x - d.start[0];
    const dy = y - d.start[1];
    if (d.mode === "move") updateFrame(d.id, { x: round(d.orig.x + dx), y: round(d.orig.y + dy) }, false);
    else
      updateFrame(
        d.id,
        d.orig.type === "line"
          ? { w: round(d.orig.w + dx), h: round(d.orig.h + dy) }
          : { w: round(Math.max(2, d.orig.w + dx)), h: round(Math.max(2, d.orig.h + dy)) },
        false,
      );
  }

  function canvasPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode !== "create" || !creating) return;
    const { kind, key, x0, y0, x1, y1 } = creating;
    setCreating(null);
    const small = Math.abs(x1 - x0) < 2 && Math.abs(y1 - y0) < 2;
    const defaults = { text: [80, 20], rect: [60, 40], ellipse: [50, 50], line: [60, 0] }[kind];
    const geometry =
      kind === "line"
        ? { x: round(x0), y: round(y0), w: round(small ? defaults[0] : x1 - x0), h: round(small ? 0 : y1 - y0) }
        : {
            x: round(small ? x0 : Math.min(x0, x1)),
            y: round(small ? y0 : Math.min(y0, y1)),
            w: round(small ? defaults[0] : Math.abs(x1 - x0)),
            h: round(small ? defaults[1] : Math.abs(y1 - y0)),
          };
    const frame = addFrame(
      key,
      kind === "text"
        ? { type: "text", ...geometry, text: "Texto", font: "Inter", size: 12, weight: 400, leading: 1.2 }
        : { type: kind, ...geometry },
    );
    if (kind === "text") setEditingId(frame.id);
    setStatus(`${kind === "text" ? "Quadro de texto" : kind === "line" ? "Linha" : kind === "ellipse" ? "Elipse" : "Quadro"} criado.`);
  }

  function finishPen() {
    if (!pen || pen.points.length < 2) {
      setPen(null);
      return;
    }
    const xs = pen.points.map((p) => p[0]);
    const ys = pen.points.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(1, Math.max(...xs) - x);
    const h = Math.max(1, Math.max(...ys) - y);
    addFrame(pen.key, {
      type: "path",
      x: round(x),
      y: round(y),
      w: round(w),
      h: round(h),
      points: pen.points.map(([px, py]) => [(px - x) / w, (py - y) / h]),
    });
    setPen(null);
    setStatus("Traçado criado.");
  }

  function onKeyDown(event) {
    if (event.target.closest?.("input, select, textarea, [contenteditable='true']")) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      save();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if (selectedEntry) {
        event.preventDefault();
        removeSelected();
      }
    } else if (event.key === "Enter" && pen) finishPen();
    else if (event.key === "Escape") {
      setPen(null);
      setSelectedId(null);
      setMenu(null);
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey && SHORTCUTS[key]) setTool(SHORTCUTS[key]);
  }

  function setGeometry(field, text) {
    setFieldText((old) => ({ ...old, [field]: text }));
    const value = parseFloat(String(text).replace(",", "."));
    if (!selectedEntry || !Number.isFinite(value)) return;
    const prop = { X: "x", Y: "y", Largura: "w", Altura: "h" }[field];
    if ((prop === "w" || prop === "h") && selectedEntry.type !== "line" && value <= 0) return;
    updateFrame(selectedEntry.id, { [prop]: value });
  }
  function needText() {
    if (selectedText) return false;
    setStatus("Selecione um quadro de texto primeiro.");
    return true;
  }
  function cycleType() {
    if (needText()) return;
    const index = TYPE_PRESETS.findIndex(([w, s]) => w === selectedText.weight && s === selectedText.size);
    const [weight, size] = TYPE_PRESETS[(index + 1) % TYPE_PRESETS.length];
    updateFrame(selectedText.id, { weight, size, style: undefined });
  }
  function cycleLeading() {
    if (needText()) return;
    const index = LEADING.indexOf(selectedText.leading);
    updateFrame(selectedText.id, { leading: LEADING[(index + 1) % LEADING.length], style: undefined });
  }
  function applyStyle(name) {
    if (needText()) return;
    const style = STYLES[name];
    updateFrame(selectedText.id, { italic: false, upper: false, ...style, style: name });
    setStatus(`Estilo "${name}" aplicado.`);
  }

  async function save() {
    try {
      const frames = {};
      for (const [key, list] of Object.entries(doc.frames)) {
        frames[key] = await Promise.all(list.map(async (frame) => (frame.src ? { ...frame, src: await toDataUrl(frame.src) } : frame)));
      }
      const content = { schema: "mm-design/v1", pageCount: doc.pageCount, frames, options };
      download(new Blob([JSON.stringify(content)], { type: "application/json" }), "publicacao.mmdesign.json");
      setStatus("Publicação salva (rascunho local + arquivo .mmdesign.json).");
    } catch {
      setStatus("Falha ao salvar: uma imagem colocada não está mais disponível.");
    }
  }
  async function openPublication(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.schema !== "mm-design/v1") throw new Error("schema");
      const pageCount = Math.max(1, Math.min(500, Math.floor(+parsed.pageCount) || 1));
      const frames = sanitizeFrames(parsed.frames);
      change(() => ({ pageCount, frames }));
      setPage("1");
      setSelectedId(null);
      setStatus(`Publicação aberta: ${file.name}`);
    } catch {
      setStatus("Arquivo de publicação inválido. Nada foi alterado.");
    }
  }

  function publish() {
    const keys =
      options.pages === "Atual"
        ? spreadKeys
        : Array.from({ length: doc.pageCount }, (_, i) => String(i + 1));
    setSelectedId(null);
    setEditingId(null);
    setStatus("Gerando PDF…");
    setExporting(keys);
  }
  useEffect(() => {
    if (!exporting) return undefined;
    let alive = true;
    (async () => {
      try {
        const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
        const nodes = [...(exportRef.current?.querySelectorAll("[data-export-page]") || [])];
        if (!nodes.length) throw new Error("Sem páginas");
        const bleed = +options.bleed || 0;
        const slug = options.marks === "Corte" ? 6 : 0;
        const off = bleed + slug;
        const size = [PAGE_W + 2 * off, PAGE_H + 2 * off];
        const pdf = new jsPDF({ unit: "mm", format: size, orientation: "portrait" });
        for (const [index, node] of nodes.entries()) {
          if (index) pdf.addPage(size, "portrait");
          const canvas = await html2canvas(node, { backgroundColor: null, scale: 2, useCORS: true });
          if (bleed) {
            pdf.setFillColor(STATIC_BG[node.getAttribute("data-export-page")] || "#ffffff");
            pdf.rect(slug, slug, PAGE_W + 2 * bleed, PAGE_H + 2 * bleed, "F");
          }
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", off, off, PAGE_W, PAGE_H);
          if (slug) {
            pdf.setDrawColor(0);
            pdf.setLineWidth(0.15);
            for (const cx of [off, off + PAGE_W]) {
              for (const cy of [off, off + PAGE_H]) {
                const sx = cx === off ? -1 : 1;
                const sy = cy === off ? -1 : 1;
                pdf.line(cx + sx * (bleed + 1), cy, cx + sx * (bleed + 5), cy);
                pdf.line(cx, cy + sy * (bleed + 1), cx, cy + sy * (bleed + 5));
              }
            }
          }
        }
        pdf.save("publicacao-mediamind.pdf");
        if (alive) setStatus(`PDF publicado: ${nodes.length} página(s), sangria ${bleed} mm.`);
      } catch {
        if (alive) setStatus("Falha ao gerar o PDF. Nenhum arquivo foi criado.");
      } finally {
        if (alive) setExporting(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [exporting]);

  function runMenu(item) {
    setMenu(null);
    const actions = {
      Salvar: save,
      "Abrir publicação…": () => openInput.current?.click(),
      "Publicar PDF": publish,
      Desfazer: undo,
      Refazer: redo,
      Duplicar: () => {
        if (!selectedEntry) return setStatus("Nenhum quadro selecionado.");
        const { id: _id, key, ...frame } = selectedEntry;
        addFrame(key, { ...frame, x: frame.x + 5, y: frame.y + 5 });
      },
      Excluir: removeSelected,
      "Adicionar página": addPage,
      "Excluir última página": removeLastPage,
      "Página-mestre": () => setPage("A-Mestre"),
      "Estilos de parágrafo": () => setPanel("Estilos"),
      "Fontes do documento": () => setStatus(`Fontes: ${[...fonts].join(", ")}`),
      "Trazer para frente": () => reorder(true),
      "Enviar para trás": () => reorder(false),
      "Inserir tabela": () => setStatus("Tabelas ainda não estão disponíveis no MMDesign."),
      "Aumentar zoom": () => setZoom((z) => clampZoom(z + 10)),
      "Reduzir zoom": () => setZoom((z) => clampZoom(z - 10)),
      "Tamanho real": () => setZoom(100),
      "Ajustar à janela": () => {
        setZoom(58);
        setPan({ x: 0, y: 0 });
      },
      Propriedades: () => setPanel("Propriedades"),
      Estilos: () => setPanel("Estilos"),
      Recursos: () => setPanel("Recursos"),
      "Atalhos de teclado": () =>
        setStatus("V Seleção · A Direta · T Texto · F Quadro (Alt: elipse) · P Caneta · L Linha · H Mão · Z Zoom · Del exclui · Ctrl+Z desfaz"),
    };
    actions[item]?.();
  }

  function cycleOption(name) {
    if (name === "Padrão PDF") return setStatus("O MMDesign gera PDF padrão (jsPDF); conformidade PDF/X não é certificada.");
    if (name === "Cor") return setStatus("Conversão para CMYK não está disponível no navegador; a exportação é em RGB.");
    setOptions((old) => {
      if (name === "Páginas") return { ...old, pages: old.pages === "Todas" ? "Atual" : "Todas" };
      if (name === "Sangria") return { ...old, bleed: { 0: 3, 3: 5, 5: 0 }[old.bleed] ?? 3 };
      return { ...old, marks: old.marks === "Corte" ? "Nenhuma" : "Corte" };
    });
  }

  function renderFrame(frame, interactive) {
    if (!visibleLayer(frameLayer(frame))) return null;
    const selectedHere = interactive && frame.id === selectedId;
    const box = {
      position: "absolute",
      left: `${(frame.x / PAGE_W) * 100}%`,
      top: `${(frame.y / PAGE_H) * 100}%`,
      width: `${(frame.w / PAGE_W) * 100}%`,
      height: `${(frame.h / PAGE_H) * 100}%`,
      outline: selectedHere ? "1px solid #e879f9" : undefined,
    };
    if (frame.type === "text") {
      const editing = interactive && editingId === frame.id;
      return (
        <div
          key={frame.id}
          data-frame-id={frame.id}
          data-frame-type="text"
          contentEditable={editing}
          suppressContentEditableWarning
          ref={(el) => editing && el && document.activeElement !== el && el.focus()}
          onDoubleClick={() => {
            if (!interactive) return;
            setSelectedId(frame.id);
            setEditingId(frame.id);
          }}
          onBlur={(e) => {
            if (!editing) return;
            const text = e.currentTarget.innerText ?? e.currentTarget.textContent;
            setEditingId(null);
            if (text !== frame.text) updateFrame(frame.id, { text });
          }}
          className="overflow-hidden whitespace-pre-wrap text-slate-900 outline-none"
          style={{ ...box, ...textStyle(frame), outline: selectedHere || editing ? "1px solid #e879f9" : undefined }}
        >
          {frame.text}
        </div>
      );
    }
    if (frame.type === "line" || frame.type === "path") return null;
    return (
      <div
        key={frame.id}
        data-frame-id={frame.id}
        data-frame-type={frame.type}
        className={`${frame.type === "ellipse" ? "rounded-full" : ""} overflow-hidden ${frame.src ? "" : "border border-slate-500"}`}
        style={box}
      >
        {frame.src ? (
          <img src={frame.src} alt={frame.name || ""} draggable={false} className="h-full w-full object-cover" />
        ) : frame.type === "rect" && interactive ? (
          <svg viewBox="0 0 10 10" preserveAspectRatio="none" className="h-full w-full text-slate-400">
            <path d="M0 0L10 10M10 0L0 10" stroke="currentColor" strokeWidth="0.1" />
          </svg>
        ) : null}
      </div>
    );
  }

  function renderVector(frames, key, interactive) {
    const shown = frames.filter((f) => (f.type === "line" || f.type === "path") && visibleLayer(frameLayer(f)));
    const penHere = interactive && pen?.key === key;
    const creatingLine = interactive && creating?.key === key && creating.kind === "line";
    if (!shown.length && !penHere && !creatingLine) return null;
    return (
      <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {shown.map((f) => {
          const color = interactive && f.id === selectedId ? "#e879f9" : "#0f172a";
          return f.type === "line" ? (
            <line key={f.id} data-frame-id={f.id} x1={f.x} y1={f.y} x2={f.x + f.w} y2={f.y + f.h} stroke={color} strokeWidth="0.6" style={{ pointerEvents: "stroke" }} />
          ) : (
            <polyline
              key={f.id}
              data-frame-id={f.id}
              points={(f.points || []).map(([u, v]) => `${f.x + u * f.w},${f.y + v * f.h}`).join(" ")}
              fill="none"
              stroke={color}
              strokeWidth="0.6"
              style={{ pointerEvents: "stroke" }}
            />
          );
        })}
        {penHere && <polyline points={pen.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#e879f9" strokeWidth="0.5" strokeDasharray="2 1" />}
        {creatingLine && <line x1={creating.x0} y1={creating.y0} x2={creating.x1} y2={creating.y1} stroke="#e879f9" strokeWidth="0.5" />}
      </svg>
    );
  }

  function renderOverlay(key, interactive) {
    const own = doc.frames[key] || [];
    const master = key === "A" ? [] : doc.frames.A || [];
    const preview = interactive && creating?.key === key && creating.kind !== "line" ? creating : null;
    return (
      <>
        {master.map((frame) => renderFrame(frame, false))}
        {own.map((frame) => renderFrame(frame, interactive))}
        {renderVector([...master, ...own], key, interactive)}
        {preview && (
          <div
            className={`pointer-events-none absolute border border-dashed border-fuchsia-500 ${preview.kind === "ellipse" ? "rounded-full" : ""}`}
            style={{
              left: `${(Math.min(preview.x0, preview.x1) / PAGE_W) * 100}%`,
              top: `${(Math.min(preview.y0, preview.y1) / PAGE_H) * 100}%`,
              width: `${(Math.abs(preview.x1 - preview.x0) / PAGE_W) * 100}%`,
              height: `${(Math.abs(preview.y1 - preview.y0) / PAGE_H) * 100}%`,
            }}
          />
        )}
      </>
    );
  }

  function renderPage(key, interactive = true) {
    const handlers = interactive
      ? {
          "data-page": key,
          onPointerDown: (event) => pagePointerDown(event, key),
          onDoubleClick: () => tool === "Caneta" && finishPen(),
        }
      : { "data-export-page": key };
    if (key === "2")
      return (
        <article
          key={key}
          {...handlers}
          className="relative h-[650px] w-[460px] overflow-hidden bg-[#f7f2e8] p-10 text-slate-900"
          style={visibleLayer("Fundo") ? undefined : { background: "transparent" }}
        >
          <div className="absolute left-0 top-0 h-full w-3 bg-fuchsia-600" style={hide("Elementos gráficos")} />
          <p className="text-xs font-bold uppercase tracking-[.3em] text-fuchsia-700" style={hide("Textos")}>
            MediaMind Editorial
          </p>
          <h2 className="mt-10 text-6xl font-black leading-[.9]" style={hide("Textos")}>
            DESIGN
            <br />
            QUE CONECTA
          </h2>
          <p className="mt-8 w-72 text-lg" style={hide("Textos")}>
            Uma publicação criada com controle editorial, identidade e
            precisão tipográfica.
          </p>
          <div className="absolute bottom-10 left-10 right-10 h-52 overflow-hidden bg-gradient-to-br from-fuchsia-500 via-indigo-500 to-cyan-400" style={hide("Imagens")}>
            <Grid3X3
              className="absolute right-8 top-8 text-white/70"
              size={90}
            />
          </div>
          <span className="absolute bottom-4 right-5 text-xs" style={hide("Textos")}>2</span>
          {renderOverlay(key, interactive)}
        </article>
      );
    if (key === "3")
      return (
        <article
          key={key}
          {...handlers}
          className="relative h-[650px] w-[460px] bg-white p-10 text-slate-900"
          style={visibleLayer("Fundo") ? undefined : { background: "transparent" }}
        >
          <h3 className="text-3xl font-black" style={hide("Textos")}>Conteúdo com estrutura</h3>
          <div className="mt-4 h-1 w-20 bg-fuchsia-500" style={hide("Elementos gráficos")} />
          <div className="mt-8 grid grid-cols-2 gap-6 text-sm leading-relaxed" style={hide("Textos")}>
            <p>
              O fluxo editorial combina páginas-mestre, estilos de
              parágrafo, grades, margens e objetos ancorados para manter
              consistência.
            </p>
            <p>
              Textos podem percorrer quadros encadeados enquanto imagens
              respeitam contorno e sangria definidos no documento.
            </p>
          </div>
          <div className="mt-8 grid h-64 place-items-center border-2 border-dashed border-fuchsia-400 bg-slate-100" style={hide("Imagens")}>
            <Image size={60} className="text-fuchsia-400" />
            <span className="absolute mt-24 text-xs text-slate-500">
              Quadro de imagem vinculado
            </span>
          </div>
          <div className="mt-8 columns-2 gap-6 text-xs leading-relaxed" style={hide("Textos")}>
            <p>
              Estilos de objeto, caracteres, parágrafos e tabelas permitem
              produzir documentos extensos com padronização. O pacote
              final inclui vínculos, fontes e relatório de preflight.
            </p>
            <p>
              A exportação oferece PDF/X, marcas de corte, sangria, perfis
              CMYK e recursos interativos quando necessários.
            </p>
          </div>
          <span className="absolute bottom-4 left-5 text-xs" style={hide("Textos")}>3</span>
          {renderOverlay(key, interactive)}
        </article>
      );
    const even = key !== "A" && Number(key) % 2 === 0;
    return (
      <article
        key={key}
        {...handlers}
        className="relative h-[650px] w-[460px] overflow-hidden bg-white text-slate-900"
        style={visibleLayer("Fundo") ? undefined : { background: "transparent" }}
      >
        <span className={`absolute bottom-4 text-xs ${even ? "right-5" : "left-5"}`} style={hide("Textos")}>
          {key}
        </span>
        {renderOverlay(key, interactive)}
      </article>
    );
  }

  const layersList = (
    <div className="border-t border-slate-700 p-2">
      <p className="mb-2 text-[10px] font-bold">Camadas</p>
      {layers.map((layer) => (
        <button
          key={layer.name}
          onClick={() => toggleLayer(layer.name)}
          className="mb-1 flex w-full items-center gap-2 rounded border border-slate-700 p-2 text-[10px]"
        >
          <Eye size={11} className={layer.visible ? "" : "opacity-30"} />
          <span className={`h-3 w-3 ${layer.color}`} />
          {layer.name}
        </button>
      ))}
    </div>
  );
  const spreadFrames = spreadKeys.flatMap((key) => (doc.frames[key] || []).map((frame) => ({ ...frame, key })));
  const geometry = selectedEntry
    ? { X: selectedEntry.x, Y: selectedEntry.y, Largura: selectedEntry.w, Altura: selectedEntry.h }
    : null;
  const typeLabel = selectedText
    ? `${WEIGHT_NAME[selectedText.weight] || selectedText.weight} · ${selectedText.size} pt`
    : "Semibold · 32 pt";
  const leadingLabel = selectedText ? Math.round(selectedText.size * selectedText.leading) : 38;
  const transform = `${pan.x || pan.y ? `translate(${pan.x}px, ${pan.y}px) ` : ""}scale(${zoom / 100})`;

  return (
    <section className="space-y-2 bg-[#171717] text-slate-200" onKeyDown={onKeyDown}>
      <header className="flex items-center border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold text-white">DesignCraft</h1>
          <p className="text-[10px] text-slate-500">
            Publicação sem título · {doc.pageCount} páginas · RGB
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={save} className="rounded border border-slate-700 px-3 py-2 text-xs">
            <Save size={14} className="mr-1 inline" />
            Salvar
          </button>
          <label className="cursor-pointer rounded border border-slate-700 px-3 py-2 text-xs">
            <Upload size={14} className="mr-1 inline" />
            Colocar
            <input
              hidden
              multiple
              type="file"
              accept="image/*,.svg,.pdf,.txt,.md"
              onChange={(e) => {
                pendingPlace.current = {
                  before: new Set(assets.map((asset) => asset.id)),
                  target: selectedEntry?.type === "rect" ? selectedEntry.id : null,
                  key: spreadKeys[0],
                };
                onOpenFiles(e.target.files);
              }}
            />
          </label>
          <input
            ref={openInput}
            hidden
            type="file"
            accept="application/json,.json"
            aria-label="Abrir publicação"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) openPublication(file);
              e.target.value = "";
            }}
          />
          <button onClick={publish} disabled={Boolean(exporting)} className="rounded bg-fuchsia-400 px-3 py-2 text-xs font-bold text-slate-950">
            <Download size={14} className="mr-1 inline" />
            Publicar PDF
          </button>
        </div>
      </header>
      <div className="flex gap-1 border-b border-slate-800 pb-1 text-[11px]">
        {Object.keys(MENUS).map((item) => (
          <span key={item} className="relative">
            <button
              onClick={() => setMenu(menu === item ? null : item)}
              aria-expanded={menu === item}
              className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
            >
              {item}
            </button>
            {menu === item && (
              <div role="menu" className="absolute left-0 top-full z-30 mt-1 min-w-44 rounded border border-slate-700 bg-[#242424] p-1 shadow-xl">
                {MENUS[item].map((entry) => (
                  <button
                    key={entry}
                    role="menuitem"
                    onClick={() => runMenu(entry)}
                    className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-700"
                  >
                    {entry}
                  </button>
                ))}
              </div>
            )}
          </span>
        ))}
        <span className="ml-auto text-slate-500">
          Essenciais · Livro · Tipografia · Interativo
        </span>
      </div>
      <div className="grid min-h-[730px] grid-cols-[54px_235px_minmax(600px,1fr)_300px] gap-2">
        <aside aria-label="Ferramentas do MMDesign" className="flex flex-col items-center gap-1 rounded border border-slate-800 bg-[#242424] p-1">
          {TOOLS.map(([shortcut, name, Icon]) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              aria-pressed={tool === name}
              title={`${name} (${shortcut})${name === "Quadro" ? " · Alt: elipse" : ""}`}
              onClick={() => {
                if (tool === "Caneta" && name !== "Caneta") finishPen();
                setTool(name);
              }}
              className={`grid h-9 w-9 place-items-center rounded ${tool === name ? "bg-fuchsia-500 text-white" : "hover:bg-slate-700"}`}
            >
              <Icon size={17} />
            </button>
          ))}
        </aside>
        <aside className="rounded border border-slate-800 bg-[#242424]">
          <div className="flex border-b border-slate-700">
            {["Páginas", "Camadas", "Links"].map((name) => (
              <button
                key={name}
                onClick={() => setLeftTab(name)}
                className={`flex-1 p-2 text-[10px] ${leftTab === name ? "border-b-2 border-fuchsia-400 text-fuchsia-300" : "text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {leftTab === "Páginas" && (
            <>
              <div className="p-2">
                <p className="mb-2 text-[10px] font-bold">Páginas-mestre</p>
                <button
                  onClick={() => setPage("A-Mestre")}
                  className={`mb-3 flex w-full items-center gap-2 rounded border p-2 text-[10px] ${currentSpread === "A-Mestre" ? "border-fuchsia-400" : "border-slate-700"}`}
                >
                  <span className="grid h-12 w-9 place-items-center bg-white text-slate-900">
                    A
                  </span>
                  A-Mestre
                </button>
                <p className="mb-2 text-[10px] font-bold">Páginas do documento</p>
                <div className="grid grid-cols-2 gap-2">
                  {spreads.map((item) => (
                    <button
                      key={item}
                      onClick={() => setPage(item)}
                      className={`grid h-20 place-items-center rounded border bg-white text-xs font-bold text-slate-900 ${currentSpread === item ? "border-4 border-fuchsia-400" : "border-slate-500"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <button onClick={addPage} className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-slate-700 p-2 text-[10px]">
                  <Plus size={12} />
                  Adicionar página
                </button>
              </div>
              {layersList}
            </>
          )}
          {leftTab === "Camadas" && (
            <>
              {layersList}
              <div className="p-2 text-[10px]">
                <p className="mb-2 font-bold">Objetos em {currentSpread}</p>
                {spreadFrames.map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => setSelectedId(frame.id)}
                    className={`mb-1 block w-full truncate rounded border p-1 text-left ${frame.id === selectedId ? "border-fuchsia-400" : "border-slate-700"}`}
                  >
                    {frameLayer(frame)} · {frame.type === "text" ? frame.text : frame.name || frame.type} · pág. {frame.key}
                  </button>
                ))}
                {!spreadFrames.length && <p className="text-slate-500">Nenhum objeto criado nesta página.</p>}
              </div>
            </>
          )}
          {leftTab === "Links" && (
            <div className="p-2 text-[10px]">
              {imageFrames.map((frame) => (
                <button
                  key={frame.id}
                  onClick={() => {
                    setPage(spreads.find((label) => spreadPages(label).includes(frame.key)) || "A-Mestre");
                    setSelectedId(frame.id);
                  }}
                  className="mb-1 flex w-full items-center gap-2 rounded border border-slate-700 p-2 text-left"
                >
                  <Link2 size={12} />
                  <span className="truncate">{frame.name || "Imagem"}</span>
                  <span className={`ml-auto ${missing.includes(frame) ? "text-amber-400" : "text-emerald-400"}`}>
                    {missing.includes(frame) ? "ausente" : `pág. ${frame.key}`}
                  </span>
                </button>
              ))}
              {!imageFrames.length && <p className="text-slate-500">Nenhuma imagem colocada.</p>}
            </div>
          )}
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-800 bg-[#353535]">
          <div className="flex items-center gap-3 border-b border-slate-700 bg-[#242424] p-2 text-[10px]">
            <b>{tool}</b>
            <span>X: {geometry ? round(geometry.X) : 0} mm</span>
            <span>Y: {geometry ? round(geometry.Y) : 0} mm</span>
            <span>L: {geometry ? round(geometry.Largura) : 210} mm</span>
            <span>A: {geometry ? round(geometry.Altura) : 297} mm</span>
            <span className="ml-auto">Páginas {currentSpread}</span>
          </div>
          <div
            data-testid="design-canvas"
            tabIndex={0}
            onPointerMove={canvasPointerMove}
            onPointerUp={canvasPointerUp}
            onPointerLeave={canvasPointerUp}
            className={`flex flex-1 items-center justify-center overflow-auto p-10 outline-none ${tool === "Mão" ? "cursor-grab" : tool === "Zoom" ? "cursor-zoom-in" : tool === "Seleção" || tool === "Seleção direta" ? "" : "cursor-crosshair"}`}
          >
            <div
              className={`grid ${spreadKeys.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-1 shadow-2xl`}
              style={{ transform }}
            >
              {spreadKeys.map((key) => renderPage(key))}
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-700 bg-[#242424] p-2 text-[10px]">
            <span>
              Preflight:{" "}
              {missing.length ? (
                <b className="text-amber-400">{missing.length} vínculo(s) ausente(s)</b>
              ) : (
                <b className="text-emerald-400">Sem erros</b>
              )}
            </span>
            <span>{imageFrames.length} vínculos</span>
            <span>{fonts.size} fontes</span>
            {status && (
              <span role="status" className="truncate text-fuchsia-300">
                {status}
              </span>
            )}
            <input
              type="range"
              min="25"
              max="100"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
              className="ml-auto accent-fuchsia-400"
            />
            <span>{zoom}%</span>
          </div>
        </main>
        <aside className="overflow-auto rounded border border-slate-800 bg-[#242424]">
          <div className="flex border-b border-slate-700">
            {["Propriedades", "Estilos", "Recursos"].map((name) => (
              <button
                key={name}
                onClick={() => setPanel(name)}
                className={`flex-1 p-2 text-[10px] ${panel === name ? "border-b-2 border-fuchsia-400 text-fuchsia-300" : "text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {panel === "Propriedades" && (
            <div className="space-y-3 p-3">
              <h3 className="text-xs font-bold">{selectedEntry ? "Quadro selecionado" : "Nenhum quadro selecionado"}</h3>
              {["X", "Y", "Largura", "Altura"].map((a) => (
                <label
                  key={a}
                  className="flex justify-between rounded border border-slate-700 p-2 text-[10px]"
                >
                  {a}
                  <input
                    aria-label={a}
                    disabled={!selectedEntry}
                    value={fieldText[a] ?? (geometry ? `${round(geometry[a])} mm` : "—")}
                    onChange={(e) => setGeometry(a, e.target.value)}
                    onBlur={() => setFieldText((old) => ({ ...old, [a]: undefined }))}
                    className="w-20 bg-transparent text-right"
                  />
                </label>
              ))}
              <h3 className="pt-2 text-xs font-bold">Texto</h3>
              <select
                aria-label="Fonte"
                value={selectedText?.font || "Inter"}
                onChange={(e) => {
                  if (needText()) return;
                  updateFrame(selectedText.id, { font: e.target.value, style: undefined });
                }}
                className="w-full rounded border border-slate-700 bg-[#171717] p-2 text-xs"
              >
                <option>Inter</option>
                <option>Montserrat</option>
                <option>Source Serif</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={cycleType} className="rounded border border-slate-700 p-2 text-[10px]">
                  {typeLabel}
                </button>
                <button onClick={cycleLeading} className="rounded border border-slate-700 p-2 text-[10px]">
                  Entrelinha {leadingLabel} pt
                </button>
              </div>
              <button
                onClick={() => setStatus("Contorno de texto requer composição de texto em fluxo, ainda não disponível no MMDesign.")}
                className="w-full rounded border border-slate-700 p-2 text-[10px]"
              >
                Contorno de texto
              </button>
            </div>
          )}
          {panel === "Estilos" && (
            <div className="space-y-2 p-3">
              {Object.keys(STYLES).map((item) => (
                <button
                  key={item}
                  onClick={() => applyStyle(item)}
                  className={`flex w-full items-center justify-between rounded border p-2 text-[10px] ${selectedText?.style === item ? "border-fuchsia-400" : "border-slate-700"}`}
                >
                  <span>{item}</span>
                  <span>¶</span>
                </button>
              ))}
            </div>
          )}
          {panel === "Recursos" && (
            <div className="p-3">
              <h3 className="mb-2 text-xs font-bold">Vínculos</h3>
              {assets.map((asset) => (
                <p
                  key={asset.id}
                  role="button"
                  tabIndex={0}
                  title="Colocar no quadro selecionado ou num novo quadro"
                  onClick={() => placeAsset(asset, selectedEntry?.id)}
                  onKeyDown={(e) => e.key === "Enter" && placeAsset(asset, selectedEntry?.id)}
                  className="mb-1 flex cursor-pointer items-center gap-2 rounded border border-slate-700 p-2 text-[10px]"
                >
                  <Link2 size={12} />
                  {asset.name}
                </p>
              ))}
              {!assets.length && (
                <p className="text-[10px] text-slate-500">
                  Nenhum vínculo colocado.
                </p>
              )}
            </div>
          )}
          <div className="border-t border-slate-700 p-3">
            <h3 className="mb-2 text-xs font-bold">Exportação</h3>
            {[
              ["Padrão PDF", "PDF padrão"],
              ["Páginas", options.pages],
              ["Sangria", `${options.bleed} mm`],
              ["Marcas", options.marks],
              ["Cor", "RGB (sRGB)"],
            ].map(([a, b]) => (
              <button
                key={a}
                onClick={() => cycleOption(a)}
                className="mb-1 flex w-full justify-between rounded border border-slate-700 p-2 text-[10px]"
              >
                <span>{a}</span>
                <span>{b} ▾</span>
              </button>
            ))}
            <button onClick={publish} disabled={Boolean(exporting)} className="mt-2 w-full rounded bg-fuchsia-400 p-2 text-xs font-bold text-slate-950">
              <FileText size={13} className="mr-1 inline" />
              Exportar publicação
            </button>
          </div>
        </aside>
      </div>
      {exporting && (
        <div ref={exportRef} aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0 }}>
          {exporting.map((key) => renderPage(key, false))}
        </div>
      )}
    </section>
  );
}
