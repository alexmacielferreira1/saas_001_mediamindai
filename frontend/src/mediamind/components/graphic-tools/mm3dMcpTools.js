// Catálogo de ferramentas de um clique do MM3D para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { objects, selectedId, keyframes, world, time, newId } e devolve
// { ok, summary, count?, objects?, selectedId?, keyframes?, world? } — o app grava só os campos devolvidos.
// Condições não atendidas viram { ok: false, summary }. O que o editor ainda não faz fica "em breve".
import {
  Clapperboard,
  Crosshair,
  Eraser,
  FileBox,
  Focus,
  LayoutGrid,
  Paintbrush,
  Palette,
  PlusSquare,
  RefreshCcw,
  RotateCw,
  Sparkles,
  SunMedium,
  Copy,
  LogIn,
} from "lucide-react";

export const MM3D_TABS = [
  { id: "objetos", label: "Objetos" },
  { id: "transformar", label: "Transformar" },
  { id: "material", label: "Material" },
  { id: "mundo", label: "Mundo" },
  { id: "animacao", label: "Animação" },
];

/** Valor de uma propriedade numérica no instante `time`, interpolando os quadros-chave (linear). */
export function interpolate(frames, time, fallback) {
  if (!frames?.length) return fallback;
  const ordered = [...frames].sort((a, b) => a.time - b.time);
  if (time <= ordered[0].time) return ordered[0].value;
  if (time >= ordered.at(-1).time) return ordered.at(-1).value;
  const rightIndex = ordered.findIndex((frame) => frame.time >= time);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  return left.value + ((right.value - left.value) * (time - left.time)) / (right.time - left.time);
}

class ToolError extends Error {}

const MESHES = ["cube", "sphere", "plane"];
const LABELS = { cube: "Cubo", sphere: "Esfera", plane: "Plano", camera: "Câmera", light: "Luz" };
const TIMELINE_END = 10;
const round2 = (value) => Math.round(value * 100) / 100;

function selectedObject(state) {
  const object = state.objects.find((item) => item.id === state.selectedId);
  if (!object) throw new ToolError("Selecione um objeto na cena (Outliner) primeiro.");
  return object;
}

function selectedMesh(state, action) {
  const object = selectedObject(state);
  if (!MESHES.includes(object.type)) throw new ToolError(`${action} funciona com cubo, esfera ou plano (câmeras e luzes não aparecem no viewport).`);
  return object;
}

const valueAt = (state, object, key) => interpolate(state.keyframes[object.id]?.[key], state.time, object[key]);

// Mesmo caminho do campo de Propriedades: muda o valor base e, se a propriedade estiver animada,
// grava o quadro-chave no instante atual da timeline.
function editor(state) {
  let { objects, keyframes } = state;
  return {
    set(id, key, value) {
      objects = objects.map((item) => (item.id === id ? { ...item, [key]: value } : item));
      const frames = keyframes[id]?.[key];
      if (frames?.length) {
        const next = frames.some((frame) => frame.time === state.time)
          ? frames.map((frame) => (frame.time === state.time ? { ...frame, value } : frame))
          : [...frames, { time: state.time, value }];
        keyframes = { ...keyframes, [id]: { ...keyframes[id], [key]: next } };
      }
    },
    patch(id, values) {
      objects = objects.map((item) => (item.id === id ? { ...item, ...values } : item));
    },
    result: () => ({ objects, keyframes }),
  };
}

function addPrimitives(state, params) {
  const existing = state.objects.filter((item) => item.type === params.type).length;
  const created = Array.from({ length: params.count }, (_, index) => ({
    id: `${params.type}-${state.newId()}`,
    name: `${LABELS[params.type]} ${existing + index + 1}`,
    type: params.type,
    x: round2(50 + (index - (params.count - 1) / 2) * 12),
    y: 50,
    z: 0,
    rotate: 0,
    scale: 100,
    color: params.type === "cube" ? "#34d399" : "#38bdf8",
    visible: true,
  }));
  return {
    ok: true,
    count: created.length,
    summary: `${created.length} ${LABELS[params.type].toLowerCase()}(s) adicionado(s) à cena`,
    objects: [...state.objects, ...created],
    selectedId: created.at(-1).id,
  };
}

function arrayCopies(state, params) {
  const source = selectedObject(state);
  const x = valueAt(state, source, "x");
  const y = valueAt(state, source, "y");
  const copies = Array.from({ length: params.copies }, (_, index) => ({
    ...source,
    id: state.newId(),
    name: `${source.name} cópia ${index + 1}`,
    x: round2(x + params.dx * (index + 1)),
    y: round2(y + params.dy * (index + 1)),
  }));
  return {
    ok: true,
    count: copies.length,
    summary: `${copies.length} cópia(s) de ${source.name} em série (${params.dx}, ${params.dy} %)`,
    objects: [...state.objects, ...copies],
    selectedId: copies.at(-1).id,
  };
}

function visibility(state, params) {
  if (params.mode === "show") {
    const hidden = state.objects.filter((item) => !item.visible);
    if (!hidden.length) throw new ToolError("Todos os objetos já estão visíveis.");
    return {
      ok: true,
      count: hidden.length,
      summary: `${hidden.length} objeto(s) voltaram a aparecer`,
      objects: state.objects.map((item) => (item.visible ? item : { ...item, visible: true })),
    };
  }
  const keep = selectedMesh(state, "Isolar");
  const others = state.objects.filter((item) => item.id !== keep.id && MESHES.includes(item.type) && item.visible);
  if (!others.length && keep.visible) throw new ToolError(`Nada a ocultar: ${keep.name} já está isolado.`);
  const ids = new Set(others.map((item) => item.id));
  return {
    ok: true,
    count: others.length,
    summary: `${keep.name} isolado (${others.length} objeto(s) ocultado(s))`,
    objects: state.objects.map((item) => (ids.has(item.id) ? { ...item, visible: false } : item.id === keep.id ? { ...item, visible: true } : item)),
  };
}

function center(state) {
  const object = selectedObject(state);
  const edit = editor(state);
  edit.set(object.id, "x", 50);
  edit.set(object.id, "y", 50);
  return { ok: true, count: 1, summary: `${object.name} centralizado no viewport`, ...edit.result() };
}

function rotate(state, params) {
  const object = selectedObject(state);
  const edit = editor(state);
  const value = round2(valueAt(state, object, "rotate") + params.angle);
  edit.set(object.id, "rotate", value);
  return { ok: true, count: 1, summary: `${object.name} girado ${params.angle}° (rotação ${value}°)`, ...edit.result() };
}

function resetTransform(state, params) {
  const object = selectedObject(state);
  const edit = editor(state);
  const values = { rotate: 0, scale: 100, z: 0, ...(params.position ? { x: 50, y: 50 } : {}) };
  for (const [key, value] of Object.entries(values)) edit.set(object.id, key, value);
  return { ok: true, count: 1, summary: `Transformações de ${object.name} redefinidas${params.position ? " (com posição)" : ""}`, ...edit.result() };
}

function arrange(state, params) {
  const targets = state.objects.filter((item) => item.visible && MESHES.includes(item.type));
  if (targets.length < 2) throw new ToolError("Organizar precisa de 2 ou mais objetos visíveis (cubo, esfera ou plano).");
  const edit = editor(state);
  targets.forEach((object, index) => {
    if (params.mode === "circle") {
      const angle = (2 * Math.PI * index) / targets.length - Math.PI / 2;
      edit.set(object.id, "x", round2(50 + params.spacing * Math.cos(angle)));
      edit.set(object.id, "y", round2(50 + params.spacing * Math.sin(angle)));
    } else {
      edit.set(object.id, "x", round2(50 + (index - (targets.length - 1) / 2) * params.spacing));
      edit.set(object.id, "y", 50);
    }
  });
  return { ok: true, count: targets.length, summary: `${targets.length} objeto(s) organizados em ${params.mode === "circle" ? "círculo" : "linha"}`, ...edit.result() };
}

function paint(state, params) {
  if (!/^#[0-9a-f]{6}$/i.test(params.color || "")) throw new ToolError("Escolha uma cor para aplicar.");
  const targets = params.scope === "all" ? state.objects.filter((item) => MESHES.includes(item.type)) : [selectedObject(state)];
  if (!targets.length) throw new ToolError("Não há cubos, esferas ou planos na cena.");
  const edit = editor(state);
  for (const object of targets) edit.patch(object.id, { color: params.color });
  return { ok: true, count: targets.length, summary: `Cor ${params.color} aplicada a ${targets.length} objeto(s)`, objects: edit.result().objects };
}

const PALETTES = {
  neon: ["#7c5cff", "#22d3ee", "#f472b6", "#a3e635"],
  pastel: ["#a5b4fc", "#fbcfe8", "#bbf7d0", "#fde68a"],
  terra: ["#b45309", "#a16207", "#65a30d", "#78716c"],
  mono: ["#f8fafc", "#cbd5e1", "#64748b", "#334155"],
};

function palette(state, params) {
  const targets = state.objects.filter((item) => MESHES.includes(item.type));
  if (!targets.length) throw new ToolError("Não há cubos, esferas ou planos na cena.");
  const colors = PALETTES[params.palette];
  const edit = editor(state);
  targets.forEach((object, index) => edit.patch(object.id, { color: colors[index % colors.length] }));
  return { ok: true, count: targets.length, summary: `Paleta aplicada a ${targets.length} objeto(s)`, objects: edit.result().objects };
}

const LIGHTING = {
  studio: { exposure: 1, background: "#111526", label: "Estúdio" },
  night: { exposure: 0.6, background: "#0b1030", label: "Noite" },
  sunset: { exposure: 1.2, background: "#7a3b2e", label: "Pôr do sol" },
  day: { exposure: 1.5, background: "#5d8fd6", label: "Dia claro" },
};

function lighting(state, params) {
  const { label, ...preset } = LIGHTING[params.preset];
  const world = { ...state.world, ...preset, grid: params.grid };
  return { ok: true, count: 1, summary: `Mundo ajustado: ${label} (exposição ${preset.exposure.toFixed(1)}, grade ${params.grid ? "ligada" : "desligada"})`, world };
}

function setFrames(state, object, entries) {
  return { ...state.keyframes, [object.id]: { ...state.keyframes[object.id], ...entries } };
}

function turntable(state, params) {
  const object = selectedObject(state);
  const start = valueAt(state, object, "rotate");
  const frames = [
    { time: 0, value: start },
    { time: params.duration, value: start + 360 * params.turns },
  ];
  return {
    ok: true,
    count: 2,
    summary: `Giro 360° em ${object.name}: ${params.turns} volta(s) em ${params.duration} s`,
    keyframes: setFrames(state, object, { rotate: frames }),
  };
}

const ENTRANCES = { left: ["x", -40], right: ["x", 40], top: ["y", -40], bottom: ["y", 40] };

function entrance(state, params) {
  const object = selectedObject(state);
  const [key, offset] = ENTRANCES[params.direction];
  const target = valueAt(state, object, key);
  const end = Math.min(TIMELINE_END, round2(params.start + params.duration));
  return {
    ok: true,
    count: 2,
    summary: `Entrada de ${object.name} de ${params.start} s a ${end} s`,
    keyframes: setFrames(state, object, { [key]: [{ time: params.start, value: round2(target + offset) }, { time: end, value: target }] }),
  };
}

function clearAnimation(state) {
  const object = selectedObject(state);
  const frames = state.keyframes[object.id];
  const total = Object.values(frames || {}).reduce((sum, list) => sum + list.length, 0);
  if (!total) throw new ToolError(`${object.name} não tem quadros-chave.`);
  const { [object.id]: _removed, ...keyframes } = state.keyframes;
  return { ok: true, count: total, summary: `${total} quadro(s)-chave removido(s) de ${object.name}`, keyframes };
}

function soon(reason) {
  return () => {
    throw new ToolError(`Em breve: ${reason}`);
  };
}

const IMPORT_REASON = "o MM3D ainda trabalha só com primitivas (cubo, esfera, plano, câmera e luz); falta o leitor de modelos GLB/OBJ.";
const RENDER_REASON = "o viewport atual é uma prévia em CSS; renderizar imagem ou gravar vídeo depende do motor 3D real, ainda não ligado (os botões Construir e Gravar também estão desativados).";

export function mm3dCatalogue() {
  const tools = [
    {
      id: "objects.add",
      tab: "objetos",
      label: "Adicionar",
      icon: PlusSquare,
      description: "Adiciona primitivas à cena, lado a lado no centro do viewport.",
      params: [
        { key: "type", label: "Tipo", type: "chips", default: "cube", options: Object.entries(LABELS) },
        { key: "count", label: "Quantidade", type: "stepper", min: 1, max: 8, step: 1, default: 1 },
      ],
      run: addPrimitives,
    },
    {
      id: "objects.array",
      tab: "objetos",
      label: "Série",
      icon: Copy,
      description: "Duplica o objeto selecionado várias vezes com deslocamento constante.",
      params: [
        { key: "copies", label: "Cópias", type: "range", min: 1, max: 12, step: 1, default: 3 },
        { key: "dx", label: "Deslocamento X", type: "range", min: -20, max: 20, step: 1, default: 8, unit: "%" },
        { key: "dy", label: "Deslocamento Y", type: "range", min: -20, max: 20, step: 1, default: 0, unit: "%" },
      ],
      run: arrayCopies,
    },
    {
      id: "objects.isolate",
      tab: "objetos",
      label: "Isolar",
      icon: Focus,
      description: "Oculta os outros objetos para trabalhar só no selecionado, ou mostra todos de novo.",
      how: "Só muda a visibilidade (o olho do Outliner); nada é excluído.",
      params: [
        {
          key: "mode",
          label: "Modo",
          type: "select",
          default: "isolate",
          options: [
            ["isolate", "Isolar o selecionado"],
            ["show", "Mostrar todos"],
          ],
        },
      ],
      run: visibility,
    },
    {
      id: "objects.import",
      tab: "objetos",
      label: "Importar modelo",
      icon: FileBox,
      description: "Trazer modelos 3D prontos (GLB/OBJ) para a cena.",
      status: "soon",
      soonReason: IMPORT_REASON,
      params: [],
      run: soon(IMPORT_REASON),
    },
    { id: "transform.center", tab: "transformar", label: "Centralizar", icon: Crosshair, description: "Leva o objeto selecionado ao centro do viewport.", params: [], run: center },
    {
      id: "transform.rotate",
      tab: "transformar",
      label: "Girar",
      icon: RotateCw,
      description: "Soma um ângulo à rotação do objeto selecionado.",
      how: "Se a rotação estiver animada, grava o quadro-chave no instante atual da timeline.",
      params: [{ key: "angle", label: "Ângulo", type: "range", min: -180, max: 180, step: 15, default: 45, unit: "°" }],
      run: rotate,
    },
    {
      id: "transform.reset",
      tab: "transformar",
      label: "Redefinir",
      icon: RefreshCcw,
      description: "Volta rotação, escala e profundidade aos valores iniciais.",
      params: [{ key: "position", label: "Também centralizar a posição", type: "toggle", default: false }],
      run: resetTransform,
    },
    {
      id: "transform.arrange",
      tab: "transformar",
      label: "Organizar",
      icon: LayoutGrid,
      description: "Distribui todos os objetos visíveis em linha ou em círculo.",
      params: [
        {
          key: "mode",
          label: "Disposição",
          type: "select",
          default: "row",
          options: [
            ["row", "Linha"],
            ["circle", "Círculo"],
          ],
        },
        { key: "spacing", label: "Espaçamento / raio", type: "range", min: 5, max: 40, step: 1, default: 15, unit: "%" },
      ],
      run: arrange,
    },
    {
      id: "material.color",
      tab: "material",
      label: "Cor base",
      icon: Paintbrush,
      description: "Pinta a cor base do objeto selecionado ou de todos os objetos.",
      params: [
        { key: "color", label: "Cor", type: "color", default: "#38bdf8" },
        {
          key: "scope",
          label: "Aplicar em",
          type: "select",
          default: "selected",
          options: [
            ["selected", "Objeto selecionado"],
            ["all", "Todos os cubos, esferas e planos"],
          ],
        },
      ],
      run: paint,
    },
    {
      id: "material.palette",
      tab: "material",
      label: "Paleta",
      icon: Palette,
      description: "Aplica uma paleta harmônica, alternando as cores entre os objetos da cena.",
      params: [
        {
          key: "palette",
          label: "Paleta",
          type: "select",
          default: "neon",
          options: [
            ["neon", "Neon"],
            ["pastel", "Pastel"],
            ["terra", "Terra"],
            ["mono", "Monocromática"],
          ],
        },
      ],
      run: palette,
    },
    {
      id: "world.lighting",
      tab: "mundo",
      label: "Iluminação",
      icon: SunMedium,
      description: "Predefinições de exposição e cor de fundo do mundo.",
      params: [
        { key: "preset", label: "Ambiente", type: "chips", default: "studio", options: Object.entries(LIGHTING).map(([id, preset]) => [id, preset.label]) },
        { key: "grid", label: "Mostrar grade", type: "toggle", default: true },
      ],
      run: lighting,
    },
    {
      id: "world.render",
      tab: "mundo",
      label: "Renderizar",
      icon: Clapperboard,
      description: "Gerar imagem ou vídeo final da cena.",
      status: "soon",
      soonReason: RENDER_REASON,
      params: [],
      run: soon(RENDER_REASON),
    },
    {
      id: "anim.turntable",
      tab: "animacao",
      label: "Giro 360°",
      icon: Sparkles,
      description: "Cria quadros-chave de rotação para o objeto girar em volta de si (vitrine).",
      how: "Substitui a animação de rotação existente do objeto.",
      params: [
        { key: "turns", label: "Voltas", type: "stepper", min: 1, max: 3, step: 1, default: 1 },
        { key: "duration", label: "Duração", type: "range", min: 2, max: 10, step: 0.5, default: 10, unit: "s" },
      ],
      run: turntable,
    },
    {
      id: "anim.entrance",
      tab: "animacao",
      label: "Entrada",
      icon: LogIn,
      description: "O objeto entra deslizando até a posição atual.",
      how: "Cria dois quadros-chave na posição (X ou Y) e substitui a animação existente nesse eixo.",
      params: [
        {
          key: "direction",
          label: "Vindo de",
          type: "select",
          default: "left",
          options: [
            ["left", "Esquerda"],
            ["right", "Direita"],
            ["top", "Cima"],
            ["bottom", "Baixo"],
          ],
        },
        { key: "start", label: "Início", type: "range", min: 0, max: 9.5, step: 0.5, default: 0, unit: "s" },
        { key: "duration", label: "Duração", type: "range", min: 0.5, max: 5, step: 0.5, default: 1.5, unit: "s" },
      ],
      run: entrance,
    },
    { id: "anim.clear", tab: "animacao", label: "Limpar animação", icon: Eraser, description: "Remove todos os quadros-chave do objeto selecionado.", params: [], run: clearAnimation },
  ];
  return { tabs: MM3D_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runMM3DTool(toolId, state, params) {
  const tool = mm3dCatalogue().tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run({ newId: () => crypto.randomUUID(), keyframes: {}, time: 0, ...state }, { ...defaultsOf(tool), ...(params || {}) });
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
