// Varredura completa das ferramentas de um clique do MCP de MMPhoto, MMLight, MMVector, DesignCraft (MMDesign)
// e MMFig: TODAS as ferramentas de cada catálogo rodam em estados vazio/mínimo e realista, com os parâmetros
// padrão e com cada opção barata (select/chips, toggles, extremos dos ranges). Regras verificadas:
//   - não lança exceção e devolve { ok: boolean, summary: texto não vazio };
//   - o estado de entrada nunca é modificado (o planejamento é puro);
//   - ok:true em ferramenta que altera precisa de fato alterar (sem sucesso falso), inclusive ao repetir a mesma ação;
//   - operações de pixels do MMPhoto rodam sobre pixels reais e precisam mudar algo visível ou explicar o porquê;
//   - ferramentas "em breve" (status: "soon") não executam.
// As falhas são acumuladas e listadas juntas (ferramenta · estado · parâmetros · problema).
import { describe, expect, it } from "vitest";
import { defaultParams } from "../../lib/mcpActions";
import { DOC_DEFAULT } from "./PhotoCraftWorkspace";
import { baseNode, createDocument } from "./FigCraftWorkspace";
import { DEFAULT_ADJUST } from "./lightcraftPipeline";
import { mmdesignCatalogue, runMMDesignTool } from "./mmdesignMcpTools";
import { mmfigCatalogue, runMMFigTool } from "./mmfigMcpTools";
import { mmlightCatalogue, runMMLightTool } from "./mmlightMcpTools";
import { mmphotoCatalogue, runMMPhotoTool } from "./mmphotoMcpTools";
import { mmvectorCatalogue, runMMVectorTool } from "./mmvectorMcpTools";

// ---------------------------------------------------------------- utilidades

/** Cópia profunda que preserva funções e arrays tipados (para conferir que a entrada não muda). */
function deepCopy(value) {
  if (Array.isArray(value)) return value.map(deepCopy);
  if (ArrayBuffer.isView(value)) return value.slice();
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepCopy(item)]));
  }
  return value;
}

/** Igualdade de dados independente da ordem das chaves (valores undefined contam como ausentes). */
function sameData(a, b) {
  if (a === b) return true;
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) return a.length === b.length && a.every((value, index) => value === b[index]);
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameData(item, b[index]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((key) => a[key] !== undefined || b[key] !== undefined));
    return [...keys].every((key) => sameData(a[key], b[key]));
  }
  return false;
}

/** Parâmetros padrão + uma variação por opção de select/chips, toggle invertido e extremos dos ranges. */
function paramVariants(tool) {
  const base = defaultParams(tool);
  const list = [{ label: "padrão", params: base }];
  for (const param of tool.params) {
    const add = (value) => list.push({ label: `${param.key}=${JSON.stringify(value)}`, params: { ...base, [param.key]: value } });
    if (param.type === "select" || param.type === "chips") param.options.filter(([value]) => value !== param.default).forEach(([value]) => add(value));
    else if (param.type === "toggle") add(!param.default);
    else if (param.type === "range" || param.type === "stepper") [param.min, param.max].filter((value) => value !== param.default).forEach(add);
    else if (param.type === "multi") {
      add([]);
      param.options.forEach(([value]) => add([value]));
    }
  }
  return list;
}

/** Visível = algum pixel com alfa > 0 antes ou depois mudou em algum canal. */
function visiblyChanged(before, after) {
  for (let i = 0; i < before.length; i += 4) {
    if (before[i + 3] === 0 && after[i + 3] === 0) continue;
    if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2] || before[i + 3] !== after[i + 3]) return true;
  }
  return false;
}

/**
 * Executa todas as ferramentas do catálogo em todos os cenários e devolve { failures, exercised, runs }.
 * `spec`: { name, catalogue(state), run(id, state, params), scenarios: [{ name, state, pixels? }],
 *          inspect(scenario, result) → { changed?: boolean | null, problem?: string, next?: scenario | null } }
 */
function sweep(spec) {
  const failures = [];
  const exercised = new Set();
  let runs = 0;
  const report = (tool, scenario, variant, problem) => failures.push(`${spec.name} · ${tool} · ${scenario} · ${variant} → ${problem}`);

  const runOnce = (tool, scenario, variant, depth) => {
    const before = deepCopy(scenario.state);
    let result;
    runs += 1;
    try {
      result = spec.run(tool.id, scenario.state, variant.params);
    } catch (error) {
      report(tool.id, scenario.name, variant.label, `lançou exceção: ${error?.stack?.split("\n").slice(0, 3).join(" | ") || error}`);
      return;
    }
    if (!result || typeof result !== "object") return report(tool.id, scenario.name, variant.label, `resultado não é objeto: ${String(result)}`);
    if (typeof result.ok !== "boolean") report(tool.id, scenario.name, variant.label, `ok não é booleano: ${String(result.ok)}`);
    if (typeof result.summary !== "string" || !result.summary.trim()) report(tool.id, scenario.name, variant.label, "summary vazio");
    if (!sameData(before, scenario.state)) report(tool.id, scenario.name, variant.label, "o estado de entrada foi modificado pelo planejamento");
    if (tool.status === "soon") {
      if (result.ok) report(tool.id, scenario.name, variant.label, "ferramenta 'em breve' executou com ok:true");
      return;
    }
    if (!result.ok) return;
    const verdict = spec.inspect(scenario, result, tool);
    if (verdict.problem) report(tool.id, scenario.name, variant.label, verdict.problem);
    if (verdict.changed === false) report(tool.id, scenario.name, variant.label, `ok:true sem alterar nada (sucesso falso): "${result.summary}"`);
    // Repetir a mesma ação no estado resultante: precisa mudar de novo ou recusar com ok:false.
    if (depth === 0 && verdict.next) runOnce(tool, { ...verdict.next, name: `${scenario.name} (repetido)` }, variant, 1);
  };

  for (const scenario of spec.scenarios) {
    const { tools } = spec.catalogue(scenario.state);
    for (const tool of tools) {
      exercised.add(tool.id);
      for (const variant of paramVariants(tool)) runOnce(tool, scenario, variant, 0);
    }
  }
  return { failures, exercised, runs };
}

// ---------------------------------------------------------------- MMPhoto

const photoLayer = (id, extra = {}) => ({ id, name: id, kind: "▧", visible: true, locked: false, opacity: 100, blendMode: "normal", mask: false, transform: { x: 0, y: 0, scale: 100, rotation: 0 }, ...extra });
const PHOTO_COLORS = { fg: "#112233", bg: "#f0e0d0" };

/** Foto pequena realista: gradiente lavado (sem pretos nem brancos) com dominante quente e fundo liso nas bordas. */
function photoPixels(width = 24, height = 16) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const inside = x > 5 && x < width - 6 && y > 3 && y < height - 4;
      const tone = inside ? 90 + ((x * 7 + y * 5) % 60) : 200;
      data.set([Math.min(255, tone + 25), tone, Math.max(0, tone - 30), 255], i);
    }
  }
  return { data, width, height };
}
const transparentPixels = (width = 24, height = 16) => ({ data: new Uint8ClampedArray(width * height * 4), width, height });

const photoScenarios = () => [
  {
    name: "documento sem camadas",
    state: { layers: [], activeLayer: "", docSize: { ...DOC_DEFAULT }, selection: null, stageScale: 1, colors: { fg: "#000000", bg: "#ffffff" } },
    pixels: transparentPixels(),
  },
  {
    name: "documento inicial (camadas sem pixels)",
    state: {
      layers: [
        photoLayer("adjust", { name: "Curvas 1", kind: "◐" }),
        photoLayer("subject", { name: "Pessoa recortada" }),
        photoLayer("photo", { name: "Foto original", kind: "▦" }),
        photoLayer("background", { name: "Plano de fundo", kind: "■", locked: true }),
      ],
      activeLayer: "subject",
      docSize: { ...DOC_DEFAULT },
      selection: null,
      stageScale: 1,
      colors: { fg: "#000000", bg: "#ffffff" },
    },
    pixels: transparentPixels(),
  },
  {
    name: "foto realista com seleção",
    state: {
      layers: [
        photoLayer("txt", { name: "Título", kind: "T", type: "text", text: "Olá" }),
        photoLayer("adj", { name: "P&B 1", kind: "◐", type: "adjustment", opacity: 60, adjustment: { name: "P&B", ops: [["grayscale", 1]] } }),
        photoLayer("foto", { name: "Retrato", type: "raster", bitmap: "data:image/png;base64,AAAA", opacity: 80, blendMode: "screen", transform: { x: 30, y: -12, scale: 90, rotation: 5 }, fx: { shadow: false } }),
        photoLayer("oculta", { name: "Rascunho", visible: false, type: "raster", bitmap: "data:image/png;base64,BBBB" }),
        photoLayer("background", { name: "Plano de fundo", kind: "■", locked: true, bitmap: "data:image/jpeg;base64,CCCC" }),
      ],
      activeLayer: "foto",
      docSize: { w: 1600, h: 900 },
      selection: { type: "rect", tool: "Letreiro", rect: { x: 100, y: 80, w: 640, h: 360 } },
      stageScale: 1,
      colors: { ...PHOTO_COLORS },
    },
    pixels: photoPixels(),
  },
  {
    name: "texto ativo, seleção poligonal",
    state: {
      layers: [photoLayer("txt", { name: "Título", kind: "T", type: "text", text: "Olá", fx: { shadow: true } }), photoLayer("background", { name: "Plano de fundo", kind: "■", locked: true })],
      activeLayer: "txt",
      docSize: { w: 1080, h: 1080 },
      selection: { type: "polygon", points: [{ x: 10, y: 10 }, { x: 500, y: 40 }, { x: 300, y: 700 }] },
      stageScale: 1,
      colors: { ...PHOTO_COLORS },
    },
    pixels: photoPixels(),
  },
];

function photoNext(scenario, result) {
  const { state } = scenario;
  if (result.layers) return { ...scenario, state: { ...state, layers: result.layers, activeLayer: result.activeLayer ?? state.activeLayer } };
  if (result.document?.kind === "rotate") {
    const angle = Number(result.document.angle);
    return { ...scenario, state: { ...state, docSize: angle === 180 ? state.docSize : { w: state.docSize.h, h: state.docSize.w }, selection: null } };
  }
  if (result.document?.kind === "resize") {
    const { w, h } = state.docSize;
    return { ...scenario, state: { ...state, docSize: { w: result.document.width, h: Math.max(1, Math.round(h * (result.document.width / w))) }, selection: null } };
  }
  if (result.document?.kind === "crop") return { ...scenario, state: { ...state, docSize: { w: result.document.rect.w, h: result.document.rect.h }, selection: null } };
  return null;
}

function photoInspect(scenario, result) {
  const { state } = scenario;
  if (result.layers) {
    if (!Array.isArray(result.layers)) return { problem: "layers não é lista" };
    const changed = !sameData(result.layers, state.layers) || (result.activeLayer !== undefined && result.activeLayer !== state.activeLayer);
    return { changed, next: photoNext(scenario, result) };
  }
  if (result.pixels) {
    if (typeof result.pixels !== "function") return { problem: "pixels não é função" };
    const { data, width, height } = scenario.pixels;
    const work = data.slice();
    try {
      result.pixels(work, width, height);
    } catch (error) {
      // O app transforma esse erro em ok:false com a mensagem (applyPixelOperation). Precisa explicar o motivo.
      return error instanceof Error && error.message.trim() ? {} : { problem: "operação de pixels falhou sem mensagem" };
    }
    if (!visiblyChanged(data, work)) return { changed: false };
    return { next: { ...scenario, pixels: { data: work, width, height } } };
  }
  if (result.document) {
    const { kind } = result.document;
    if (kind === "rotate") return { changed: [90, -90, 180].includes(Number(result.document.angle)), next: photoNext(scenario, result) };
    if (kind === "resize") return { changed: result.document.width !== state.docSize.w, next: photoNext(scenario, result) };
    if (kind === "crop") {
      const { rect } = result.document;
      const full = rect.x === 0 && rect.y === 0 && rect.w === state.docSize.w && rect.h === state.docSize.h;
      const inside = rect.x >= 0 && rect.y >= 0 && rect.w >= 1 && rect.h >= 1 && rect.x + rect.w <= state.docSize.w && rect.y + rect.h <= state.docSize.h;
      return inside ? { changed: !full, next: photoNext(scenario, result) } : { problem: `recorte fora do documento: ${JSON.stringify(rect)}` };
    }
    return { problem: `tipo de documento desconhecido: ${kind}` };
  }
  if (result.exportZip) {
    const { files } = result.exportZip;
    const bad = files.find((file) => !(file.width >= 1 && file.height >= 1 && file.rect.w >= 1 && file.rect.h >= 1 && /\.(jpg|png)$/.test(file.name)));
    return files.length ? (bad ? { problem: `arquivo do zip inválido: ${JSON.stringify(bad)}` } : {}) : { problem: "zip sem arquivos" };
  }
  if (result.duplicateBackground) return {};
  if (result.segmentPerson) return {};
  if (result.segmentObject) {
    const { x, y } = result.segmentObject;
    return x >= 0 && x < 1 && y >= 0 && y < 1 ? {} : { problem: `ponto do objeto fora da imagem: ${x}, ${y}` };
  }
  return { problem: `ok:true sem nenhum plano (layers/pixels/document/exportZip/segment): ${Object.keys(result).join(",")}` };
}

// ---------------------------------------------------------------- MMLight

const lightImage = (width = 8, height = 6) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set([40 + (i % 30), 35 + (i % 25), 30 + (i % 20), 255], i * 4);
  return { width, height, data };
};

const lightScenarios = () => [
  { name: "sem foto aberta", state: { sourceId: "", sourceName: "", photos: {}, albums: {}, baseAdjust: DEFAULT_ADJUST, image: null, pickedIds: [] } },
  { name: "foto recém-importada (ainda carregando)", state: { sourceId: "a", sourceName: "Praia.jpg", photos: {}, albums: {}, baseAdjust: DEFAULT_ADJUST, image: null, pickedIds: [] } },
  {
    name: "catálogo realista com seleção na tira",
    state: {
      sourceId: "a",
      sourceName: "Praia.jpg",
      photos: {
        a: { rating: 2, flag: false, color: "Azul", adjust: { ...DEFAULT_ADJUST, exposição: -12, sombras: 30 }, profile: "Camera Standard", masks: [{ id: "m1", type: "radial", cx: 0.4, cy: 0.5, rx: 0.3, ry: 0.36, adjust: { ...DEFAULT_ADJUST, exposição: 10 } }] },
        b: { rating: 5 },
        c: { flag: true, color: "Verde" },
      },
      albums: { Selecionadas: ["b"], "2026": ["a"] },
      baseAdjust: { ...DEFAULT_ADJUST, realces: -18, sombras: 24 },
      image: lightImage(),
      pickedIds: ["a", "b", "c"],
      newId: (type) => `${type}-fixo`,
    },
  },
];

function lightInspect(scenario, result) {
  const { state } = scenario;
  if (!result.photos || !result.albums) return { problem: "ok:true sem photos/albums" };
  const changed = !sameData(result.photos, state.photos) || !sameData(result.albums, state.albums);
  return { changed, next: { ...scenario, state: { ...state, photos: result.photos, albums: result.albums } } };
}

// ---------------------------------------------------------------- MMVector

const vec = (id, x, y, w, h, extra = {}) => ({ id, name: id, kind: "Retângulo", color: "#22d3ee", visible: true, locked: false, x, y, w, h, ...extra });
const vectorScenarios = () => [
  { name: "prancheta vazia", state: { objects: [], selectedIds: [] } },
  { name: "só o fundo bloqueado selecionado", state: { objects: [vec("background", 0, 0, 820, 620, { locked: true, color: "#ffffff" })], selectedIds: ["background"] } },
  { name: "um objeto selecionado", state: { objects: [vec("circle", 530, 170, 185, 185, { kind: "Elipse" }), vec("background", 0, 0, 820, 620, { locked: true })], selectedIds: ["circle"] } },
  {
    name: "composição realista com 4 selecionados",
    state: {
      objects: [
        vec("title", 112, 150, 390, 120, { kind: "Texto", text: "DESIGN", color: "#082f49", stroke: "#ffffff" }),
        vec("circle", 530, 170, 185, 185, { kind: "Elipse", gradient: { from: "#22d3ee", to: "#6366f1", angle: 90 } }),
        vec("wave", 60, 400, 600, 90, { kind: "Traçado", color: "#6366f1", rotation: 30, opacity: 80 }),
        vec("icon", 700, 40, 60, 60, { kind: "Grupo", parts: [{ color: "#ff0000" }, { color: "#00ff00" }] }),
        vec("lock", 10, 10, 50, 50, { locked: true }),
        vec("background", 0, 0, 820, 620, { locked: true, color: "#f8fafc" }),
      ],
      selectedIds: ["title", "circle", "wave", "icon", "lock"],
    },
  },
];

function vectorInspect(scenario, result) {
  const { state } = scenario;
  if (!Array.isArray(result.objects)) return { problem: "ok:true sem objects" };
  const ids = new Set(result.objects.map((object) => object.id));
  if (ids.size !== result.objects.length) return { problem: "ids de objetos repetidos" };
  return { changed: !sameData(result.objects, state.objects), next: { ...scenario, state: { ...state, objects: result.objects } } };
}

// ---------------------------------------------------------------- MMDesign

const designScenarios = () => [
  { name: "publicação nova sem quadros", state: { doc: { pageCount: 8, frames: {} }, selectedId: null, pageKey: "1" } },
  { name: "sem página aberta", state: { doc: { pageCount: 1, frames: {} }, selectedId: null, pageKey: undefined } },
  {
    name: "texto selecionado",
    state: {
      doc: {
        pageCount: 8,
        frames: {
          2: [
            { id: "t", type: "text", x: 10, y: 20, w: 80, h: 20, text: "Manchete do dia\nlinha 2", font: "Inter", size: 12, weight: 400, leading: 1.2 },
            { id: "img", type: "image", x: 0, y: 60, w: 210, h: 120, src: "x.jpg" },
          ],
          3: [{ id: "r", type: "rect", x: 5, y: 5, w: 50, h: 40, fill: "#ff0000" }],
        },
      },
      selectedId: "t",
      pageKey: "2",
    },
  },
  {
    name: "imagem selecionada",
    state: {
      doc: { pageCount: 4, frames: { 2: [{ id: "t", type: "text", x: 10, y: 20, w: 80, h: 20, text: "A" }, { id: "img", type: "image", x: 0, y: 60, w: 210, h: 120 }] } },
      selectedId: "img",
      pageKey: "2",
    },
  },
];

function designInspect(scenario, result) {
  const { state } = scenario;
  if (!result.doc) return { problem: "ok:true sem doc" };
  const changed = !sameData(result.doc, state.doc);
  return { changed, next: { ...scenario, state: { ...state, doc: result.doc, selectedId: result.selectedId ?? state.selectedId } } };
}

// ---------------------------------------------------------------- MMFig

function figSetup() {
  const doc = createDocument();
  const pageId = doc.pages[0].id;
  const add = (type, props = {}, parentId = null, page = pageId) => {
    const node = baseNode(type, props);
    doc.nodes[node.id] = node;
    node.parentId = parentId;
    if (parentId) doc.nodes[parentId].children.push(node.id);
    else doc.roots[page].push(node.id);
    return node.id;
  };
  return { doc, pageId, add };
}

const figScenarios = () => {
  const empty = figSetup();
  const loose = figSetup();
  const looseIds = [
    loose.add("rect", { x: 10, y: 10, w: 80, h: 40, fill: { on: true, color: "#FF0000" } }),
    loose.add("ellipse", { x: 150, y: 70, w: 60, h: 60 }),
    loose.add("text", { x: 300, y: 20, w: 120, h: 24, text: "Título" }),
    loose.add("rect", { x: 40, y: 200, w: 100, h: 30, locked: true }),
  ];

  const real = figSetup();
  const { add } = real;
  const screen1 = add("frame", { name: "Login", x: 0, y: 0, w: 390, h: 844 });
  const card = add("frame", { name: "Card", x: 20, y: 100, w: 300, h: 160, fill: { on: true, color: "#0D99FF" } }, screen1);
  const cardTitle = add("text", { name: "Título", x: 16, y: 16, w: 200, h: 24, text: "Entrar" }, card);
  add("text", { name: "Sub", x: 16, y: 50, w: 200, h: 20, text: "Bem-vindo" }, card);
  const button = add("rect", { name: "Botão", x: 16, y: 100, w: 120, h: 40, fill: { on: true, color: "#0D99FF" } }, card);
  const list = add("frame", { name: "Lista", x: 20, y: 300, w: 300, h: 200 }, screen1);
  real.doc.nodes[list].autoLayout = { ...real.doc.nodes[list].autoLayout, on: true, direction: "vertical" };
  add("rect", { name: "Item B", x: 0, y: 0, w: 280, h: 40 }, list);
  add("rect", { name: "Item A", x: 0, y: 50, w: 280, h: 40 }, list);
  const group = add("group", { name: "Ícones", x: 20, y: 600, w: 100, h: 40 }, screen1);
  add("ellipse", { x: 0, y: 0, w: 40, h: 40 }, group);
  add("ellipse", { x: 60, y: 0, w: 40, h: 40 }, group);
  const screen2 = add("frame", { name: "Home", x: 500, y: 0, w: 390, h: 844 });
  const screen3 = add("frame", { name: "Perfil", x: 1000, y: 0, w: 390, h: 844, visible: true });
  add("rect", { name: "Bloqueado", x: 1500, y: 0, w: 50, h: 50, locked: true });
  const page2 = "p-segunda";
  real.doc.pages.push({ id: page2, name: "Página 2", background: "#1E1E1E" });
  real.doc.roots[page2] = [];
  const elsewhere = add("rect", { name: "Outra página" }, null, page2);

  return [
    { name: "página vazia sem seleção", state: { doc: empty.doc, pageId: empty.pageId, selection: [] } },
    { name: "camadas soltas sem seleção", state: { doc: loose.doc, pageId: loose.pageId, selection: [] } },
    { name: "camadas soltas selecionadas (com bloqueada)", state: { doc: loose.doc, pageId: loose.pageId, selection: looseIds } },
    { name: "telas sem seleção", state: { doc: real.doc, pageId: real.pageId, selection: [] } },
    { name: "três telas selecionadas", state: { doc: real.doc, pageId: real.pageId, selection: [screen1, screen2, screen3] } },
    { name: "card (frame dentro de tela) selecionado", state: { doc: real.doc, pageId: real.pageId, selection: [card] } },
    { name: "texto e botão dentro do card", state: { doc: real.doc, pageId: real.pageId, selection: [cardTitle, button] } },
    { name: "grupo selecionado", state: { doc: real.doc, pageId: real.pageId, selection: [group] } },
    { name: "frame com auto layout selecionado", state: { doc: real.doc, pageId: real.pageId, selection: [list] } },
    { name: "seleção só em outra página", state: { doc: real.doc, pageId: real.pageId, selection: [elsewhere] } },
  ];
};

function figInspect(scenario, result) {
  const { state } = scenario;
  if (result.exportJob) {
    const { ids, format, scale } = result.exportJob;
    if (!ids.length || !["png", "svg"].includes(format) || !(scale >= 1)) return { problem: `exportação inválida: ${JSON.stringify(result.exportJob)}` };
    return {};
  }
  if (!result.doc) return { problem: "ok:true sem doc nem exportJob" };
  const missing = (result.selection || []).filter((id) => !result.doc.nodes[id]);
  if (missing.length) return { problem: `seleção aponta para camadas inexistentes: ${missing.join(",")}` };
  return { changed: !sameData(result.doc, state.doc), next: { ...scenario, state: { ...state, doc: result.doc, selection: result.selection ?? state.selection } } };
}

// ---------------------------------------------------------------- execução

const SPECS = [
  { name: "MMPhoto", catalogue: () => mmphotoCatalogue(), run: (id, state, params) => runMMPhotoTool(id, state, params, { newId: (() => { let n = 0; return () => `novo-${n++}`; })() }), scenarios: photoScenarios(), inspect: photoInspect },
  { name: "MMLight", catalogue: () => mmlightCatalogue(), run: runMMLightTool, scenarios: lightScenarios(), inspect: lightInspect },
  { name: "MMVector", catalogue: () => mmvectorCatalogue(), run: runMMVectorTool, scenarios: vectorScenarios(), inspect: vectorInspect },
  { name: "MMDesign", catalogue: () => mmdesignCatalogue(), run: runMMDesignTool, scenarios: designScenarios(), inspect: designInspect },
  { name: "MMFig", catalogue: (state) => mmfigCatalogue(state), run: runMMFigTool, scenarios: figScenarios(), inspect: figInspect },
];

describe("varredura das ferramentas MCP (MMPhoto, MMLight, MMVector, MMDesign, MMFig)", () => {
  for (const spec of SPECS) {
    it(`${spec.name}: todas as ferramentas, todos os estados, sem exceção nem sucesso falso`, () => {
      const { failures, exercised, runs } = sweep(spec);
      const all = spec.catalogue(spec.scenarios.at(-1).state).tools.map((tool) => tool.id);
      expect([...exercised].sort()).toEqual([...all].sort());
      expect(runs).toBeGreaterThan(all.length * spec.scenarios.length);
      expect(failures).toEqual([]);
    });
  }

  it("as ferramentas 'em breve' não executam em nenhum estado", () => {
    const soon = SPECS.flatMap((spec) => spec.catalogue(spec.scenarios.at(-1).state).tools.filter((tool) => tool.status === "soon").map((tool) => [spec, tool]));
    expect(soon.map(([spec, tool]) => `${spec.name}:${tool.id}`)).toEqual(["MMLight:mask.ai", "MMFig:style.shared"]);
    for (const [spec, tool] of soon) {
      for (const scenario of spec.scenarios) {
        const result = spec.run(tool.id, scenario.state, defaultParams(tool));
        expect(result.ok).toBe(false);
        expect(result.summary).toBeTruthy();
      }
    }
  });
});
