// Catálogo de ferramentas de um clique do MMVector para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { objects, selectedIds, newId } e devolve { ok, summary, objects } — o app grava
// `objects` pelo setObjects (um passo no histórico). Condições não atendidas viram { ok: false, summary }.
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  BringToFront,
  Copy,
  Droplet,
  FlipHorizontal2,
  FlipVertical2,
  Focus,
  Palette,
  RotateCw,
  SendToBack,
} from "lucide-react";
import { ARTBOARD_H, ARTBOARD_W, rotateHue } from "./VectorCraftWorkspace";

export const MMVECTOR_TABS = [
  { id: "alinhar", label: "Alinhar" },
  { id: "transformar", label: "Transformar" },
  { id: "organizar", label: "Organizar" },
  { id: "cor", label: "Cor" },
];

class ToolError extends Error {}

const round2 = (value) => Math.round(value * 100) / 100;
const plural = (list) => `${list.length} objeto(s)`;

function editable(state, minimum = 1) {
  const targets = state.selectedIds.map((id) => state.objects.find((object) => object.id === id)).filter((object) => object && !object.locked);
  if (!targets.length) throw new ToolError("Selecione objetos desbloqueados na prancheta (Shift+clique para vários).");
  if (targets.length < minimum) throw new ToolError(`Esta ferramenta precisa de ${minimum} ou mais objetos selecionados.`);
  return targets;
}

const patched = (state, patches) => state.objects.map((object) => (patches.has(object.id) ? { ...object, ...patches.get(object.id) } : object));

const EDGES = {
  left: (o) => o.x,
  hcenter: (o) => o.x + o.w / 2,
  right: (o) => o.x + o.w,
  top: (o) => o.y,
  vcenter: (o) => o.y + o.h / 2,
  bottom: (o) => o.y + o.h,
};
const HORIZONTAL = ["left", "hcenter", "right"];
const ALIGN_LABELS = { left: "à esquerda", hcenter: "ao centro (horizontal)", right: "à direita", top: "ao topo", vcenter: "ao centro (vertical)", bottom: "à base" };

function moveTo(object, key, goal) {
  const delta = goal - EDGES[key](object);
  return HORIZONTAL.includes(key) ? { x: round2(object.x + delta) } : { y: round2(object.y + delta) };
}

function align(key) {
  return (state, params) => {
    const targets = editable(state);
    const artboard = params.target === "artboard" || targets.length === 1;
    const box = artboard
      ? { left: 0, top: 0, right: ARTBOARD_W, bottom: ARTBOARD_H }
      : {
          left: Math.min(...targets.map((o) => o.x)),
          top: Math.min(...targets.map((o) => o.y)),
          right: Math.max(...targets.map((o) => o.x + o.w)),
          bottom: Math.max(...targets.map((o) => o.y + o.h)),
        };
    const goal = { left: box.left, hcenter: (box.left + box.right) / 2, right: box.right, top: box.top, vcenter: (box.top + box.bottom) / 2, bottom: box.bottom }[key];
    return {
      ok: true,
      count: targets.length,
      summary: `${plural(targets)} alinhado(s) ${ALIGN_LABELS[key]} ${artboard ? "da prancheta" : "da seleção"}`,
      objects: patched(state, new Map(targets.map((object) => [object.id, moveTo(object, key, goal)]))),
    };
  };
}

function distribute(key) {
  return (state) => {
    const targets = editable(state, 3);
    const sorted = [...targets].sort((a, b) => EDGES[key](a) - EDGES[key](b));
    const first = EDGES[key](sorted[0]);
    const gap = (EDGES[key](sorted.at(-1)) - first) / (sorted.length - 1);
    return {
      ok: true,
      count: sorted.length,
      summary: `${plural(sorted)} distribuído(s) ${HORIZONTAL.includes(key) ? "na horizontal" : "na vertical"}`,
      objects: patched(state, new Map(sorted.map((object, index) => [object.id, moveTo(object, key, first + gap * index)]))),
    };
  };
}

function centerOnArtboard(state) {
  const targets = editable(state);
  const left = Math.min(...targets.map((o) => o.x));
  const top = Math.min(...targets.map((o) => o.y));
  const dx = (ARTBOARD_W - (Math.max(...targets.map((o) => o.x + o.w)) - left)) / 2 - left;
  const dy = (ARTBOARD_H - (Math.max(...targets.map((o) => o.y + o.h)) - top)) / 2 - top;
  return {
    ok: true,
    count: targets.length,
    summary: `${plural(targets)} centralizado(s) na prancheta (mantendo a disposição entre eles)`,
    objects: patched(state, new Map(targets.map((object) => [object.id, { x: round2(object.x + dx), y: round2(object.y + dy) }]))),
  };
}

function flip(axis) {
  const key = axis === "x" ? "flipX" : "flipY";
  return (state) => {
    const targets = editable(state);
    return {
      ok: true,
      count: targets.length,
      summary: `${plural(targets)} espelhado(s) ${axis === "x" ? "na horizontal" : "na vertical"}`,
      objects: patched(state, new Map(targets.map((object) => [object.id, { [key]: !object[key] }]))),
    };
  };
}

function rotate(state, params) {
  const targets = editable(state);
  return {
    ok: true,
    count: targets.length,
    summary: `${plural(targets)} girado(s) ${params.angle}°`,
    objects: patched(state, new Map(targets.map((object) => [object.id, { rotation: ((object.rotation ?? 0) + params.angle) % 360 }]))),
  };
}

function repeat(state, params) {
  const targets = editable(state);
  const copies = [];
  for (let step = 1; step <= params.copies; step += 1) {
    for (const object of targets) {
      copies.push({ ...object, id: state.newId(), name: `${object.name} ${step + 1}`, x: round2(object.x + params.dx * step), y: round2(object.y + params.dy * step) });
    }
  }
  return {
    ok: true,
    count: copies.length,
    summary: `${copies.length} cópia(s) criada(s) a cada ${params.dx}, ${params.dy} px`,
    objects: [...copies.reverse(), ...state.objects],
  };
}

function arrange(mode) {
  return (state) => {
    const targets = editable(state);
    const ids = new Set(targets.map((object) => object.id));
    const picked = state.objects.filter((object) => ids.has(object.id));
    const rest = state.objects.filter((object) => !ids.has(object.id));
    let objects = [...picked, ...rest];
    if (mode === "back") {
      const backgroundIndex = rest.findIndex((object) => object.id === "background");
      objects = backgroundIndex < 0 ? [...rest, ...picked] : [...rest.slice(0, backgroundIndex), ...picked, ...rest.slice(backgroundIndex)];
    }
    return { ok: true, count: targets.length, summary: `${plural(targets)} ${mode === "front" ? "trazido(s) para a frente" : "enviado(s) para trás (acima do fundo)"}`, objects };
  };
}

function recolor(state, params) {
  const targets = editable(state);
  const turn = (color) => rotateHue(color, params.degrees);
  return {
    ok: true,
    count: targets.length,
    summary: `Cores de ${plural(targets)} giradas ${params.degrees}° no círculo cromático`,
    objects: patched(
      state,
      new Map(
        targets.map((object) => [
          object.id,
          {
            color: turn(object.color),
            ...(object.stroke ? { stroke: turn(object.stroke) } : {}),
            ...(object.gradient ? { gradient: { ...object.gradient, from: turn(object.gradient.from), to: turn(object.gradient.to) } } : {}),
            ...(object.parts ? { parts: object.parts.map((part) => ({ ...part, color: turn(part.color) })) } : {}),
          },
        ]),
      ),
    ),
  };
}

function opacity(state, params) {
  const targets = editable(state);
  return {
    ok: true,
    count: targets.length,
    summary: `Opacidade de ${plural(targets)}: ${params.opacity}%`,
    objects: patched(state, new Map(targets.map((object) => [object.id, { opacity: params.opacity }]))),
  };
}

const target = {
  key: "target",
  label: "Alinhar a",
  type: "select",
  default: "selection",
  options: [
    ["selection", "Seleção (com 1 objeto, a prancheta)"],
    ["artboard", "Prancheta"],
  ],
};
const ALIGN_HOW = "Move só os objetos selecionados e desbloqueados. Com um objeto, alinha à prancheta.";

export function mmvectorCatalogue() {
  const tools = [
    { id: "align.left", tab: "alinhar", label: "Esquerda", icon: AlignStartVertical, description: "Alinha as bordas esquerdas.", how: ALIGN_HOW, params: [target], run: align("left") },
    { id: "align.hcenter", tab: "alinhar", label: "Centro H", icon: AlignCenterVertical, description: "Alinha os centros na horizontal.", how: ALIGN_HOW, params: [target], run: align("hcenter") },
    { id: "align.right", tab: "alinhar", label: "Direita", icon: AlignEndVertical, description: "Alinha as bordas direitas.", how: ALIGN_HOW, params: [target], run: align("right") },
    { id: "align.top", tab: "alinhar", label: "Topo", icon: AlignStartHorizontal, description: "Alinha as bordas de cima.", how: ALIGN_HOW, params: [target], run: align("top") },
    { id: "align.vcenter", tab: "alinhar", label: "Centro V", icon: AlignCenterHorizontal, description: "Alinha os centros na vertical.", how: ALIGN_HOW, params: [target], run: align("vcenter") },
    { id: "align.bottom", tab: "alinhar", label: "Base", icon: AlignEndHorizontal, description: "Alinha as bordas de baixo.", how: ALIGN_HOW, params: [target], run: align("bottom") },
    { id: "align.distH", tab: "alinhar", label: "Distribuir H", icon: AlignHorizontalDistributeCenter, description: "Espaça igualmente os centros na horizontal (3 ou mais objetos).", params: [], run: distribute("hcenter") },
    { id: "align.distV", tab: "alinhar", label: "Distribuir V", icon: AlignVerticalDistributeCenter, description: "Espaça igualmente os centros na vertical (3 ou mais objetos).", params: [], run: distribute("vcenter") },
    { id: "align.center", tab: "alinhar", label: "Centralizar", icon: Focus, description: "Centraliza a seleção na prancheta, mantendo a disposição entre os objetos.", params: [], run: centerOnArtboard },
    { id: "transform.flipX", tab: "transformar", label: "Espelhar H", icon: FlipHorizontal2, description: "Espelha os objetos na horizontal.", params: [], run: flip("x") },
    { id: "transform.flipY", tab: "transformar", label: "Espelhar V", icon: FlipVertical2, description: "Espelha os objetos na vertical.", params: [], run: flip("y") },
    {
      id: "transform.rotate",
      tab: "transformar",
      label: "Girar",
      icon: RotateCw,
      description: "Gira cada objeto em torno do próprio centro.",
      params: [{ key: "angle", label: "Ângulo", type: "range", min: -180, max: 180, step: 15, default: 45, unit: "°" }],
      run: rotate,
    },
    {
      id: "transform.repeat",
      tab: "transformar",
      label: "Repetir",
      icon: Copy,
      description: "Cria cópias em sequência com o deslocamento escolhido (grade, padrões, ritmos).",
      params: [
        { key: "copies", label: "Cópias", type: "range", min: 1, max: 20, step: 1, default: 3 },
        { key: "dx", label: "Deslocamento X", type: "range", min: -400, max: 400, step: 5, default: 60, unit: "px" },
        { key: "dy", label: "Deslocamento Y", type: "range", min: -400, max: 400, step: 5, default: 0, unit: "px" },
      ],
      run: repeat,
    },
    { id: "arrange.front", tab: "organizar", label: "Para frente", icon: BringToFront, description: "Traz a seleção para a frente de tudo.", params: [], run: arrange("front") },
    { id: "arrange.back", tab: "organizar", label: "Para trás", icon: SendToBack, description: "Envia a seleção para trás (fica acima do fundo).", params: [], run: arrange("back") },
    {
      id: "color.recolor",
      tab: "cor",
      label: "Recolorir",
      icon: Palette,
      description: "Gira as cores (preenchimento, traço, gradiente e partes) no círculo cromático.",
      params: [{ key: "degrees", label: "Giro de matiz", type: "range", min: 15, max: 345, step: 15, default: 60, unit: "°" }],
      run: recolor,
    },
    {
      id: "color.opacity",
      tab: "cor",
      label: "Opacidade",
      icon: Droplet,
      description: "Define a opacidade dos objetos selecionados.",
      params: [{ key: "opacity", label: "Opacidade", type: "range", min: 0, max: 100, step: 5, default: 60, unit: "%" }],
      run: opacity,
    },
  ];
  return { tabs: MMVECTOR_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runMMVectorTool(toolId, state, params) {
  const tool = mmvectorCatalogue().tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run({ newId: () => crypto.randomUUID(), ...state }, { ...defaultsOf(tool), ...(params || {}) });
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
