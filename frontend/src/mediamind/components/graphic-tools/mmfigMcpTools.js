// Catálogo de ferramentas de um clique do MMFig (editor de interface) para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { doc, pageId, selection }: trabalha numa cópia do documento e devolve
// { ok, summary, doc?, selection?, exportJob? } — o app grava `doc` pelo próprio histórico (Ctrl+Z).
// Condições não atendidas viram { ok: false, summary }; nada é simulado.
import {
  AlignHorizontalSpaceAround,
  AlignStartVertical,
  ArrowDownAZ,
  CaseSensitive,
  Component,
  FileDown,
  Grid3x3,
  LayoutGrid,
  Library,
  Replace,
  Rows3,
  Smartphone,
  Squircle,
  TextCursorInput,
  Workflow,
} from "lucide-react";
import {
  FONTS,
  FRAME_PRESETS,
  absBounds,
  baseNode,
  cloneSubtree,
  containerList,
  descendants,
  insertInto,
  moveByWorld,
  nextName,
  normalize,
  pageOfNode,
  resizeNode,
  round2,
  sortFlow,
  topLevel,
  unionBounds,
  wrapSelection,
} from "./FigCraftWorkspace";

export const MMFIG_TABS = [
  { id: "alinhar", label: "Alinhar" },
  { id: "layout", label: "Layout" },
  { id: "estilo", label: "Estilo" },
  { id: "camadas", label: "Camadas" },
  { id: "prototipo", label: "Protótipo e exportar" },
];

class ToolError extends Error {}
const fail = (message) => {
  throw new ToolError(message);
};
const copyDoc = (doc) => JSON.parse(JSON.stringify(doc));
const layers = (count) => `${count} camada(s)`;
const done = (d, result) => ({ ok: true, ...result, doc: normalize(d) });
const byReading = (a, b) => a.b.y - b.b.y || a.b.x - b.b.x;
const withBounds = (d, ids) => ids.map((id) => ({ id, b: absBounds(d, id) }));
const subtree = (d, ids) => ids.flatMap((id) => [id, ...descendants(d, id)]);

/** Camadas selecionadas na página atual, sem repetir filhos de camadas também selecionadas. */
function selectedOnPage(state, d) {
  return topLevel(
    d,
    state.pageId,
    state.selection.filter((id) => d.nodes[id] && pageOfNode(d, id) === state.pageId),
  );
}
const selectedIds = (state, d) => selectedOnPage(state, d).filter((id) => !d.nodes[id].locked);

function picked(state, d, minimum = 1) {
  const ids = selectedIds(state, d);
  if (!ids.length) fail("Selecione camadas desbloqueadas no canvas ou na lista de Camadas.");
  if (ids.length < minimum) fail(`Esta ferramenta precisa de ${minimum} ou mais camadas selecionadas.`);
  return ids;
}
const inFlow = (d, id) => Boolean(d.nodes[d.nodes[id].parentId]?.autoLayout?.on && !d.nodes[id].absolute);
function movable(state, d, minimum = 1) {
  const ids = picked(state, d, minimum).filter((id) => !inFlow(d, id));
  if (ids.length < minimum) {
    fail("As camadas selecionadas são posicionadas pelo auto layout do frame pai. Ajuste espaço e alinhamento no próprio auto layout.");
  }
  return ids;
}
const shift = (d, id, delta, horizontal) => moveByWorld(d, id, horizontal ? delta : 0, horizontal ? 0 : delta);

/* Alinhar */
const EDGE_LABELS = {
  left: "à esquerda",
  hcenter: "ao centro (horizontal)",
  right: "à direita",
  top: "ao topo",
  vcenter: "ao centro (vertical)",
  bottom: "à base",
};
function align(state, params) {
  const d = copyDoc(state.doc);
  const ids = movable(state, d);
  const toParent = params.target === "parent" || ids.length === 1;
  if (toParent && ids.some((id) => !d.nodes[id].parentId)) {
    fail("Para alinhar ao frame, a camada precisa estar dentro de um frame. Com camadas soltas na página, selecione duas ou mais e alinhe à seleção.");
  }
  const group = unionBounds(withBounds(d, ids).map((item) => item.b));
  ids.forEach((id) => {
    const ref = toParent ? absBounds(d, d.nodes[id].parentId) : group;
    const b = absBounds(d, id);
    const dx = { left: ref.x - b.x, hcenter: ref.x + ref.w / 2 - (b.x + b.w / 2), right: ref.x + ref.w - (b.x + b.w) }[params.edge] ?? 0;
    const dy = { top: ref.y - b.y, vcenter: ref.y + ref.h / 2 - (b.y + b.h / 2), bottom: ref.y + ref.h - (b.y + b.h) }[params.edge] ?? 0;
    moveByWorld(d, id, dx, dy);
  });
  return done(d, { count: ids.length, summary: `${layers(ids.length)} alinhada(s) ${EDGE_LABELS[params.edge]} ${toParent ? "do frame" : "da seleção"}` });
}

function distribute(state, params) {
  const d = copyDoc(state.doc);
  const ids = movable(state, d, 3);
  const horizontal = params.axis === "h";
  const start = (b) => (horizontal ? b.x : b.y);
  const size = (b) => (horizontal ? b.w : b.h);
  const center = (b) => start(b) + size(b) / 2;
  const items = withBounds(d, ids).sort((a, b) => center(a.b) - center(b.b));
  const first = items[0].b;
  const last = items.at(-1).b;
  let detail;
  if (params.mode === "gap") {
    const total = items.reduce((sum, item) => sum + size(item.b), 0);
    const gap = (start(last) + size(last) - start(first) - total) / (items.length - 1);
    let cursor = start(first);
    items.forEach((item) => {
      shift(d, item.id, cursor - start(item.b), horizontal);
      cursor += size(item.b) + gap;
    });
    detail = `com ${round2(gap)} px entre elas`;
  } else {
    const step = (center(last) - center(first)) / (items.length - 1);
    items.forEach((item, index) => shift(d, item.id, center(first) + step * index - center(item.b), horizontal));
    detail = "pelos centros";
  }
  return done(d, { count: items.length, summary: `${layers(items.length)} distribuída(s) na ${horizontal ? "horizontal" : "vertical"} ${detail}` });
}

function tidyGrid(state, params) {
  const d = copyDoc(state.doc);
  const items = withBounds(d, movable(state, d, 2)).sort(byReading);
  const columns = Math.min(params.columns, items.length);
  const origin = unionBounds(items.map((item) => item.b));
  const widths = Array(columns).fill(0);
  const heights = [];
  items.forEach((item, index) => {
    const row = Math.floor(index / columns);
    widths[index % columns] = Math.max(widths[index % columns], item.b.w);
    heights[row] = Math.max(heights[row] ?? 0, item.b.h);
  });
  const offset = (sizes, index) => sizes.slice(0, index).reduce((sum, value) => sum + value + params.gap, 0);
  items.forEach((item, index) => {
    const x = origin.x + offset(widths, index % columns);
    const y = origin.y + offset(heights, Math.floor(index / columns));
    moveByWorld(d, item.id, x - item.b.x, y - item.b.y);
  });
  return done(d, {
    count: items.length,
    summary: `${layers(items.length)} organizada(s) em grade ${heights.length}×${columns} com ${params.gap} px de espaço`,
  });
}

/* Layout */
function autoLayout(state, params) {
  const d = copyDoc(state.doc);
  const ids = picked(state, d);
  let frame = ids.length === 1 && d.nodes[ids[0]].type === "frame" ? d.nodes[ids[0]] : null;
  const wrapped = !frame;
  if (wrapped) {
    const res = wrapSelection(d, state.pageId, ids, "frame");
    if (res.error) fail(res.error);
    frame = d.nodes[res.id];
  }
  const kids = frame.children.map((id) => d.nodes[id]);
  const span = (key, size) => (kids.length ? Math.max(...kids.map((k) => k[key] + k[size])) - Math.min(...kids.map((k) => k[key])) : 0);
  const direction = params.direction === "auto" ? (span("y", "h") > span("x", "w") ? "vertical" : "horizontal") : params.direction;
  const p = params.padding;
  Object.assign(frame.autoLayout, {
    on: true,
    direction,
    gap: params.gap,
    padding: { t: p, r: p, b: p, l: p },
    align: params.align,
    justify: "start",
    spaceBetween: false,
    hugW: kids.length > 0,
    hugH: kids.length > 0,
  });
  sortFlow(d, frame);
  return done(d, {
    selection: [frame.id],
    summary: `Auto layout ${direction} ${wrapped ? `criado em ${frame.name}, em volta da seleção` : `aplicado em ${frame.name}`} (espaço ${params.gap} px, margem ${p} px)`,
  });
}

function repeatGrid(state, params) {
  const d = copyDoc(state.doc);
  const ids = picked(state, d);
  if (params.rows * params.columns < 2) fail("Escolha ao menos 2 células (linhas × colunas).");
  const box = unionBounds(withBounds(d, ids).map((item) => item.b));
  const created = [];
  for (let row = 0; row < params.rows; row += 1) {
    for (let column = 0; column < params.columns; column += 1) {
      if (row || column) {
        ids.forEach((id) => {
          const source = d.nodes[id];
          const out = {};
          const copy = cloneSubtree(d, id, out, Boolean(source.isComponent));
          Object.assign(d.nodes, out);
          insertInto(d, state.pageId, source.parentId, copy);
          moveByWorld(d, copy, column * (box.w + params.gap), row * (box.h + params.gap));
          created.push(copy);
        });
      }
    }
  }
  return done(d, {
    count: created.length,
    selection: [...ids, ...created],
    summary: `${created.length} cópia(s) em grade ${params.rows}×${params.columns} (${params.gap} px entre as células)`,
  });
}

function deviceFrame(state, params) {
  const preset = FRAME_PRESETS.find((item) => item.id === params.preset);
  if (!preset) fail(`Dispositivo desconhecido: ${params.preset}`);
  const d = copyDoc(state.doc);
  const size = `${preset.label} (${preset.w}×${preset.h})`;
  if (params.mode === "resize") {
    const frames = picked(state, d).filter((id) => d.nodes[id].type === "frame");
    if (!frames.length) fail("Selecione um ou mais frames para mudar de tamanho.");
    frames.forEach((id) => resizeNode(d, id, preset.w, preset.h));
    return done(d, { count: frames.length, summary: `${frames.length} frame(s) no tamanho ${size}` });
  }
  const roots = d.roots[state.pageId];
  const content = roots.length ? unionBounds(roots.map((id) => absBounds(d, id))) : null;
  const x0 = content ? round2(content.x + content.w + 100) : 0;
  const y0 = content ? round2(content.y) : 0;
  const ids = [];
  for (let index = 0; index < params.count; index += 1) {
    const frame = baseNode("frame", { name: nextName(d, "frame", preset.label), x: x0 + index * (preset.w + 100), y: y0, w: preset.w, h: preset.h });
    d.nodes[frame.id] = frame;
    insertInto(d, state.pageId, null, frame.id);
    ids.push(frame.id);
  }
  return done(d, { count: ids.length, selection: ids, summary: `${ids.length} frame(s) ${size} adicionado(s) na página` });
}

/* Estilo */
const TEXT_STYLES = {
  h1: ["Título 1", 32, 700, 1.2],
  h2: ["Título 2", 24, 600, 1.25],
  h3: ["Título 3", 20, 600, 1.3],
  body: ["Corpo", 16, 400, 1.5],
  caption: ["Legenda", 12, 400, 1.4],
  button: ["Botão", 14, 600, 1.2],
};
function textStyle(state, params) {
  const d = copyDoc(state.doc);
  const ids = picked(state, d);
  const texts = (params.inside ? subtree(d, ids) : ids).filter((id) => d.nodes[id].type === "text" && !d.nodes[id].locked);
  if (!texts.length) fail("Nenhum texto desbloqueado na seleção. Selecione textos, ou um frame com textos e ligue \"Incluir textos dentro\".");
  const [label, fontSize, fontWeight, lineHeight] = TEXT_STYLES[params.style];
  const font = params.font === "keep" ? {} : { fontFamily: params.font };
  texts.forEach((id) => Object.assign(d.nodes[id], { fontSize, fontWeight, lineHeight }, font));
  return done(d, {
    count: texts.length,
    summary: `Estilo ${label} (${fontSize} px${font.fontFamily ? `, ${font.fontFamily}` : ""}) aplicado em ${texts.length} texto(s)`,
  });
}

/** Cores de preenchimento e traço usadas na página, da mais frequente para a menos. */
export function usedColors(doc, pageId) {
  const counts = new Map();
  subtree(doc, doc.roots[pageId]).forEach((id) => {
    const n = doc.nodes[id];
    [n.fill, n.stroke].forEach((paint) => {
      if (!paint.on) return;
      const color = paint.color.toUpperCase();
      counts.set(color, (counts.get(color) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
function swapColor(state, params) {
  if (!params.from) fail("Não há cores de preenchimento ou traço nesta página para trocar.");
  if (!/^#[0-9a-f]{6}$/i.test(params.to)) fail("Escolha a nova cor.");
  const d = copyDoc(state.doc);
  const ids = params.scope === "selection" ? subtree(d, picked(state, d)) : subtree(d, d.roots[state.pageId]);
  const to = params.to.toUpperCase();
  let count = 0;
  ids.forEach((id) => {
    const n = d.nodes[id];
    if (n.locked) return;
    [n.fill, n.stroke].forEach((paint) => {
      if (paint.on && paint.color.toUpperCase() === params.from) {
        paint.color = to;
        count += 1;
      }
    });
  });
  if (!count) fail(`A cor ${params.from} não aparece em camadas desbloqueadas ${params.scope === "selection" ? "da seleção" : "da página"}.`);
  return done(d, { count, summary: `${count} preenchimento(s)/traço(s) trocado(s) de ${params.from} para ${to}` });
}

const SHADOWS = {
  soft: ["suave", { on: true, x: 0, y: 4, blur: 12, color: "#000000", opacity: 0.15 }],
  strong: ["forte", { on: true, x: 0, y: 8, blur: 24, color: "#000000", opacity: 0.3 }],
};
function cornersAndShadow(state, params) {
  const d = copyDoc(state.doc);
  const ids = picked(state, d);
  const rounded = ids.filter((id) => ["rect", "frame"].includes(d.nodes[id].type));
  if (!rounded.length && params.shadow === "keep") fail("Cantos arredondados valem para retângulos e frames. Para as outras camadas, escolha uma sombra.");
  rounded.forEach((id) => {
    d.nodes[id].radius = params.radius;
  });
  const parts = rounded.length ? [`cantos de ${layers(rounded.length)} em ${params.radius} px`] : [];
  if (params.shadow === "none") {
    ids.forEach((id) => {
      d.nodes[id].shadow.on = false;
    });
    parts.push(`sombra removida de ${layers(ids.length)}`);
  } else if (params.shadow !== "keep") {
    const [label, shadow] = SHADOWS[params.shadow];
    ids.forEach((id) => {
      d.nodes[id].shadow = { ...shadow };
    });
    parts.push(`sombra ${label} em ${layers(ids.length)}`);
  }
  const summary = parts.join(" · ");
  return done(d, { count: ids.length, summary: summary[0].toUpperCase() + summary.slice(1) });
}

/* Camadas */
function renameBatch(state, params) {
  const base = String(params.base).trim().slice(0, 180);
  if (!base) fail("Digite o nome base (ex.: Card, Botão, Tela).");
  const d = copyDoc(state.doc);
  const ids = picked(state, d);
  const targets = params.scope === "children" ? ids.flatMap((id) => d.nodes[id].children || []) : ids;
  if (!targets.length) fail("As camadas selecionadas não têm nada dentro. Selecione um frame ou grupo com conteúdo.");
  const ordered = withBounds(d, targets).sort(byReading);
  ordered.forEach(({ id }, index) => {
    const n = d.nodes[id];
    const fromText = params.useText && n.type === "text" ? String(n.text).split("\n")[0].trim().slice(0, 40) : "";
    n.name = fromText || `${base} ${params.start + index}`;
  });
  const names = ordered.map(({ id }) => d.nodes[id].name);
  return done(d, {
    count: names.length,
    summary: `${layers(names.length)} renomeada(s): ${names.length > 2 ? `${names[0]} … ${names.at(-1)}` : names.join(", ")}`,
  });
}

const SORTS = {
  position: ["posição (de cima para baixo)", (d) => (a, b) => byReading({ b: absBounds(d, a) }, { b: absBounds(d, b) })],
  name: ["nome (A–Z)", (d) => (a, b) => d.nodes[a].name.localeCompare(d.nodes[b].name, "pt-BR", { numeric: true })],
};
function sortLayers(state, params) {
  const d = copyDoc(state.doc);
  const ids = selectedOnPage(state, d);
  let parentId = null;
  if (ids.length === 1 && d.nodes[ids[0]].children?.length) parentId = ids[0];
  else if (ids.length) {
    if (new Set(ids.map((id) => d.nodes[id].parentId)).size > 1) fail("Selecione camadas do mesmo nível (mesmo frame ou grupo) para ordenar.");
    parentId = d.nodes[ids[0]].parentId;
  }
  const list = containerList(d, state.pageId, parentId);
  if (list.length < 2) fail("Não há duas ou mais camadas nesse nível para ordenar.");
  const flow = Boolean(parentId && d.nodes[parentId].autoLayout?.on);
  const [label, compare] = SORTS[params.by];
  const sorted = [...list].sort(compare(d));
  // A lista de Camadas mostra do topo (fim da lista) para a base; no auto layout a ordem é a do fluxo.
  list.splice(0, list.length, ...(flow ? sorted : sorted.reverse()));
  return done(d, {
    count: list.length,
    summary: `${layers(list.length)} ordenada(s) por ${label} ${parentId ? `em ${d.nodes[parentId].name}` : "na página"}${flow ? " (a ordem do auto layout mudou)" : ""}`,
  });
}

function makeComponent(state, params) {
  const d = copyDoc(state.doc);
  const ids = picked(state, d);
  const only = ids.length === 1 ? d.nodes[ids[0]] : null;
  if (only?.type === "instance") fail("Desanexe a instância antes de transformá-la em componente.");
  const already = Boolean(only?.isComponent);
  if (already && !params.instances) fail("Esta camada já é um componente principal. Escolha quantas instâncias criar.");
  let main = only;
  if (only?.type === "group") {
    Object.assign(only, { type: "frame", clip: false, autoLayout: baseNode("frame").autoLayout, fill: { ...only.fill, on: false } });
  } else if (only?.type !== "frame") {
    const res = wrapSelection(d, state.pageId, ids, "frame");
    if (res.error) fail(res.error);
    main = d.nodes[res.id];
    main.name = `Componente ${Object.values(d.nodes).filter((n) => n.isComponent).length + 1}`;
  }
  main.isComponent = true;
  const b = absBounds(d, main.id);
  const existing = Object.values(d.nodes).filter((n) => n.type === "instance" && n.mainId === main.id).length;
  for (let index = 0; index < params.instances; index += 1) {
    const instance = baseNode("instance", {
      name: main.name,
      mainId: main.id,
      w: main.w,
      h: main.h,
      overrides: {},
      x: round2(b.x + b.w + 40),
      y: round2(b.y + (existing + index) * (main.h + 20)),
    });
    d.nodes[instance.id] = instance;
    insertInto(d, state.pageId, null, instance.id);
  }
  const instances = params.instances ? ` + ${params.instances} instância(s) ao lado` : "";
  return done(d, {
    selection: [main.id],
    summary: `${already ? `${main.name} já era componente` : `Componente ${main.name} criado`}${instances}`,
  });
}

/* Protótipo e exportação */
const TRANSITIONS = [
  ["instant", "Instantânea"],
  ["dissolve", "Dissolver"],
  ["slide-left", "Deslizar para a esquerda"],
  ["slide-right", "Deslizar para a direita"],
];
function linkScreens(state, params) {
  const d = copyDoc(state.doc);
  const ids = selectedIds(state, d);
  const frames = (ids.length ? ids : d.roots[state.pageId])
    .filter((id) => d.nodes[id].type === "frame" && !d.nodes[id].parentId && d.nodes[id].visible)
    .sort((a, b) => d.nodes[a].x - d.nodes[b].x || d.nodes[a].y - d.nodes[b].y);
  if (frames.length < 2) fail("Selecione duas ou mais telas (frames soltos na página) ou deixe a seleção vazia para ligar todas as telas da página.");
  frames.slice(0, -1).forEach((id, index) => {
    d.nodes[id].proto = { trigger: "click", action: "navigate", targetId: frames[index + 1], transition: params.transition, url: "" };
  });
  if (params.start) d.flowStart[state.pageId] = frames[0];
  const names = frames.map((id) => d.nodes[id].name);
  return done(d, {
    count: frames.length - 1,
    summary: `${frames.length - 1} ligação(ões) de clique: ${names.join(" → ")}${params.start ? ` · início do fluxo em ${names[0]}` : ""}`,
  });
}

function exportPlan(state, params) {
  const d = state.doc;
  const visible = (id) => d.nodes[id].visible;
  const chosen = selectedOnPage(state, d).filter(visible);
  const ids = chosen.length ? chosen : d.roots[state.pageId].filter(visible);
  if (!ids.length) fail("Nada visível para exportar nesta página.");
  const page = d.pages.find((item) => item.id === state.pageId);
  const name = !chosen.length ? page.name : chosen.length === 1 ? d.nodes[chosen[0]].name : `${chosen.length}-camadas`;
  const scale = params.format === "png" ? Number(params.scale) : 1;
  const b = unionBounds(ids.map((id) => absBounds(d, id)));
  return {
    ok: true,
    count: ids.length,
    summary: `Exportar ${layers(ids.length)} (${chosen.length ? "seleção" : `página ${page.name}`}) em ${params.format.toUpperCase()} · ${Math.round(b.w * scale)}×${Math.round(b.h * scale)} px`,
    exportJob: { ids, name, format: params.format, scale },
  };
}

export function mmfigCatalogue(state) {
  const colors = state ? usedColors(state.doc, state.pageId) : [];
  const tools = [
    {
      id: "align.edges",
      tab: "alinhar",
      label: "Alinhar",
      icon: AlignStartVertical,
      description: "Alinha as camadas selecionadas por uma borda ou pelo centro.",
      how: "Com uma camada só, alinha ao frame em que ela está. Camadas posicionadas por auto layout são ignoradas (o auto layout decide a posição).",
      params: [
        {
          key: "edge",
          label: "Alinhar",
          type: "chips",
          default: "left",
          options: [
            ["left", "Esquerda"],
            ["hcenter", "Centro H"],
            ["right", "Direita"],
            ["top", "Topo"],
            ["vcenter", "Centro V"],
            ["bottom", "Base"],
          ],
        },
        {
          key: "target",
          label: "Em relação a",
          type: "select",
          default: "selection",
          options: [
            ["selection", "Seleção (com 1 camada, o frame)"],
            ["parent", "Frame em que cada camada está"],
          ],
        },
      ],
      run: align,
    },
    {
      id: "align.distribute",
      tab: "alinhar",
      label: "Distribuir",
      icon: AlignHorizontalSpaceAround,
      description: "Espaça igualmente 3 ou mais camadas, mantendo a primeira e a última no lugar.",
      params: [
        { key: "axis", label: "Direção", type: "chips", default: "h", options: [["h", "Horizontal"], ["v", "Vertical"]] },
        {
          key: "mode",
          label: "Igualar",
          type: "select",
          default: "gap",
          options: [
            ["gap", "Espaço entre as camadas"],
            ["centers", "Distância entre os centros"],
          ],
        },
      ],
      run: distribute,
    },
    {
      id: "align.grid",
      tab: "alinhar",
      label: "Organizar em grade",
      icon: LayoutGrid,
      description: "Arruma as camadas selecionadas em linhas e colunas alinhadas, a partir do canto da seleção.",
      how: "Usa a ordem de leitura atual (de cima para baixo, da esquerda para a direita). Cada coluna fica com a largura da maior camada dela.",
      params: [
        { key: "columns", label: "Colunas", type: "stepper", min: 1, max: 12, step: 1, default: 3 },
        { key: "gap", label: "Espaço", type: "range", min: 0, max: 200, step: 4, default: 24, unit: "px" },
      ],
      run: tidyGrid,
    },
    {
      id: "layout.auto",
      tab: "layout",
      label: "Auto layout",
      icon: Rows3,
      description: "Liga o auto layout no frame selecionado, ou cria um frame com auto layout em volta das camadas.",
      how: "O frame passa a abraçar o conteúdo (hug) e organiza os filhos com o espaço e a margem escolhidos. Ajustes finos continuam no painel Design.",
      params: [
        {
          key: "direction",
          label: "Direção",
          type: "chips",
          default: "auto",
          options: [
            ["auto", "Automática"],
            ["horizontal", "Horizontal"],
            ["vertical", "Vertical"],
          ],
        },
        { key: "gap", label: "Espaço entre itens", type: "range", min: 0, max: 120, step: 2, default: 12, unit: "px" },
        { key: "padding", label: "Margem interna", type: "range", min: 0, max: 120, step: 2, default: 16, unit: "px" },
        {
          key: "align",
          label: "Alinhar itens",
          type: "select",
          default: "center",
          options: [
            ["start", "Início"],
            ["center", "Centro"],
            ["end", "Fim"],
          ],
        },
      ],
      run: autoLayout,
    },
    {
      id: "layout.repeat",
      tab: "layout",
      label: "Duplicar em grade",
      icon: Grid3x3,
      description: "Repete a seleção em linhas e colunas (cards, listas, galerias).",
      how: "A seleção é a primeira célula. Componentes principais copiados viram instâncias, como no Ctrl+D.",
      params: [
        { key: "rows", label: "Linhas", type: "stepper", min: 1, max: 10, step: 1, default: 1 },
        { key: "columns", label: "Colunas", type: "stepper", min: 1, max: 10, step: 1, default: 3 },
        { key: "gap", label: "Espaço", type: "range", min: 0, max: 200, step: 4, default: 24, unit: "px" },
      ],
      run: repeatGrid,
    },
    {
      id: "layout.device",
      tab: "layout",
      label: "Frame de dispositivo",
      icon: Smartphone,
      description: "Cria telas no tamanho de um dispositivo ou muda o tamanho dos frames selecionados.",
      params: [
        { key: "preset", label: "Dispositivo", type: "select", default: "iphone14", options: FRAME_PRESETS.map((item) => [item.id, `${item.label} · ${item.w}×${item.h}`]) },
        {
          key: "mode",
          label: "Ação",
          type: "chips",
          default: "new",
          options: [
            ["new", "Novas telas"],
            ["resize", "Redimensionar seleção"],
          ],
        },
        { key: "count", label: "Quantidade de telas", type: "stepper", min: 1, max: 8, step: 1, default: 1, when: { key: "mode", equals: "new" } },
      ],
      run: deviceFrame,
    },
    {
      id: "style.text",
      tab: "estilo",
      label: "Estilo de texto",
      icon: CaseSensitive,
      description: "Aplica uma escala tipográfica (tamanho, peso e entrelinha) aos textos selecionados.",
      params: [
        {
          key: "style",
          label: "Estilo",
          type: "select",
          default: "h1",
          options: Object.entries(TEXT_STYLES).map(([id, [label, size, weight]]) => [id, `${label} · ${size} px · peso ${weight}`]),
        },
        { key: "font", label: "Fonte", type: "select", default: "keep", options: [["keep", "Manter a atual"], ...FONTS.map((font) => [font, font])] },
        { key: "inside", label: "Incluir textos dentro de frames e grupos selecionados", type: "toggle", default: true },
      ],
      run: textStyle,
    },
    {
      id: "style.swapColor",
      tab: "estilo",
      label: "Trocar cor",
      icon: Replace,
      description: "Troca uma cor de preenchimento/traço por outra em toda a página ou só na seleção.",
      how: "As opções de cor vêm das camadas da página. Camadas bloqueadas não mudam.",
      params: [
        {
          key: "from",
          label: "Cor atual",
          type: "select",
          default: colors[0]?.[0] ?? "",
          options: colors.length ? colors.map(([color, uses]) => [color, `${color} · ${uses} uso(s)`]) : [["", "Nenhuma cor na página"]],
        },
        { key: "to", label: "Nova cor", type: "color", default: "#0D99FF" },
        {
          key: "scope",
          label: "Onde",
          type: "chips",
          default: "page",
          options: [
            ["page", "Página inteira"],
            ["selection", "Seleção"],
          ],
        },
      ],
      run: swapColor,
    },
    {
      id: "style.corners",
      tab: "estilo",
      label: "Cantos e sombra",
      icon: Squircle,
      description: "Arredonda retângulos e frames e aplica uma sombra padrão às camadas selecionadas.",
      params: [
        { key: "radius", label: "Raio dos cantos", type: "range", min: 0, max: 64, step: 2, default: 12, unit: "px" },
        {
          key: "shadow",
          label: "Sombra",
          type: "select",
          default: "soft",
          options: [
            ["keep", "Manter como está"],
            ["soft", "Suave"],
            ["strong", "Forte"],
            ["none", "Sem sombra"],
          ],
        },
      ],
      run: cornersAndShadow,
    },
    {
      id: "style.shared",
      tab: "estilo",
      label: "Estilos compartilhados",
      icon: Library,
      status: "soon",
      soonReason: "o arquivo do MMFig (mmfig/v1) ainda não guarda uma biblioteca de estilos de cor e texto ligados às camadas. Por enquanto use Estilo de texto e Trocar cor para padronizar em lote.",
      description: "Biblioteca de estilos de cor e texto reutilizáveis que atualizam todas as camadas ligadas.",
      params: [],
      run: () => ({ ok: false, summary: "Estilos compartilhados ainda não estão disponíveis no MMFig." }),
    },
    {
      id: "layers.rename",
      tab: "camadas",
      label: "Renomear em lote",
      icon: TextCursorInput,
      description: "Dá nomes numerados às camadas, na ordem em que aparecem (de cima para baixo, da esquerda para a direita).",
      params: [
        { key: "base", label: "Nome base", type: "text", rows: 1, default: "Item", placeholder: "Ex.: Card" },
        { key: "start", label: "Começar em", type: "stepper", min: 0, max: 999, step: 1, default: 1 },
        {
          key: "scope",
          label: "Renomear",
          type: "chips",
          default: "selection",
          options: [
            ["selection", "Camadas selecionadas"],
            ["children", "O que está dentro delas"],
          ],
        },
        { key: "useText", label: "Textos usam o próprio conteúdo como nome", type: "toggle", default: false },
      ],
      run: renameBatch,
    },
    {
      id: "layers.sort",
      tab: "camadas",
      label: "Ordenar camadas",
      icon: ArrowDownAZ,
      description: "Reordena as camadas de um mesmo nível na lista de Camadas.",
      how: "Sem seleção, ordena a página. Com um frame ou grupo selecionado, ordena o que está dentro dele. Em frames com auto layout, a ordem visual dos itens também muda.",
      params: [
        {
          key: "by",
          label: "Ordenar por",
          type: "chips",
          default: "position",
          options: [
            ["position", "Posição"],
            ["name", "Nome A–Z"],
          ],
        },
      ],
      run: sortLayers,
    },
    {
      id: "layers.component",
      tab: "camadas",
      label: "Componente",
      icon: Component,
      description: "Transforma a seleção em componente principal e cria instâncias ao lado.",
      how: "Um frame vira componente; um grupo vira frame-componente; várias camadas são colocadas num frame novo. Instâncias seguem o principal.",
      params: [{ key: "instances", label: "Instâncias ao lado", type: "stepper", min: 0, max: 8, step: 1, default: 2 }],
      run: makeComponent,
    },
    {
      id: "proto.link",
      tab: "prototipo",
      label: "Ligar telas",
      icon: Workflow,
      description: "Cria o fluxo do protótipo: clicar em cada tela leva à próxima, da esquerda para a direita.",
      how: "Usa os frames selecionados ou, sem seleção, todas as telas da página. Interações já existentes nessas telas são substituídas. Teste em Protótipo › Apresentar.",
      params: [
        { key: "transition", label: "Transição", type: "select", default: "dissolve", options: TRANSITIONS },
        { key: "start", label: "Marcar a primeira tela como início do fluxo", type: "toggle", default: true },
      ],
      run: linkScreens,
    },
    {
      id: "export.file",
      tab: "prototipo",
      label: "Exportar",
      icon: FileDown,
      description: "Baixa a seleção (ou a página inteira, sem seleção) como PNG ou SVG.",
      applyLabel: "Exportar agora",
      params: [
        {
          key: "format",
          label: "Formato",
          type: "chips",
          default: "png",
          options: [
            ["png", "PNG"],
            ["svg", "SVG"],
          ],
        },
        {
          key: "scale",
          label: "Escala",
          type: "chips",
          default: "2",
          options: [
            ["1", "1x"],
            ["2", "2x"],
            ["3", "3x"],
          ],
          when: { key: "format", equals: "png" },
        },
      ],
      run: exportPlan,
    },
  ];
  return { tabs: MMFIG_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta sobre o estado atual. Erros de condição viram `ok: false`; inesperados sobem. */
export function runMMFigTool(toolId, state, params) {
  const catalogue = mmfigCatalogue(state);
  const tool = catalogue.tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run(state, { ...defaultsOf(tool), ...(params || {}) });
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
