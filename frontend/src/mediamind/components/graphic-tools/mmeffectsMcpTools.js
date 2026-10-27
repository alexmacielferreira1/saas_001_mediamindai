// Catálogo de ferramentas de um clique do MMEffects para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre o documento (camadas, transformação, quadros-chave, efeitos, marcadores) e devolve
// { ok, summary, patch } — o app grava o `patch` de uma vez, e o histórico por instantâneos vira um passo de desfazer.
// Condições não atendidas viram { ok: false, summary } com a explicação; nada é simulado.
import {
  ArrowDownToLine,
  Keyboard,
  TextCursorInput,
  ArrowRightFromLine,
  ListOrdered,
  Minimize2,
  Spline,
  Ban,
  Box,
  Eraser,
  Flag,
  FlagOff,
  Maximize,
  MoveRight,
  Orbit,
  Palette,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Sun,
  SunDim,
  SunMedium,
  Vibrate,
  Wind,
  Waves,
  ZoomIn,
} from "lucide-react";

export const MMEFFECTS_TABS = [
  { id: "animacao", label: "Animação" },
  { id: "texto", label: "Texto" },
  { id: "efeitos", label: "Efeitos" },
  { id: "camada", label: "Camada" },
  { id: "marcadores", label: "Marcadores" },
];

const COMP_DURATION = 10;
const TRANSFORM_PROPERTIES = ["x", "y", "scale", "rotation", "opacity"];

class ToolError extends Error {}

const round = (value) => Math.round(value * 100) / 100;
const secondsText = (value) => `${String(round(value)).replace(".", ",")} s`;
const duration = (fallback) => ({ key: "duration", label: "Duração", type: "range", min: 0.1, max: 3, step: 0.1, default: fallback, unit: "s" });

// ---------- auxiliares ----------
function selectedOf(state) {
  const layer = state.layers.find((item) => item.id === state.selectedLayer);
  if (!layer) throw new ToolError("Selecione uma camada na timeline do MMEffects.");
  return layer;
}

function editableOf(state) {
  const layer = selectedOf(state);
  if (layer.locked) throw new ToolError(`A camada "${layer.name}" está bloqueada: desbloqueie para animar.`);
  return layer;
}

const layerSpan = (layer) => [layer.start ?? 0, Math.min(COMP_DURATION, (layer.start ?? 0) + (layer.duration ?? COMP_DURATION))];

/** Troca os quadros-chave de cada propriedade dentro do intervalo pelos novos (os de fora ficam). */
function withFrames(state, layerId, frames) {
  const layerFrames = { ...(state.propertyKeyframes[layerId] || {}) };
  for (const [property, next] of Object.entries(frames)) {
    const from = next[0].time;
    const to = next.at(-1).time;
    const kept = (layerFrames[property] || []).filter((frame) => frame.time < from || frame.time > to);
    layerFrames[property] = [...kept, ...next].sort((a, b) => a.time - b.time);
  }
  return { ...state.propertyKeyframes, [layerId]: layerFrames };
}

const frame = (time, value, interpolation = "easy-ease") => ({ time: round(time), value: round(value), interpolation });

function animation(label, build) {
  return (state, params) => {
    const layer = editableOf(state);
    const [start, end] = layerSpan(layer);
    if (end - start < 0.1) throw new ToolError(`A camada "${layer.name}" é curta demais para animar.`);
    const { frames, when } = build({ base: state.transform, start, end, params, layer });
    const count = Object.values(frames).reduce((sum, list) => sum + list.length, 0);
    return {
      ok: true,
      count,
      summary: `${label} em "${layer.name}" (${when}) · ${count} quadro(s)-chave`,
      patch: { propertyKeyframes: withFrames(state, layer.id, frames) },
    };
  };
}

const span = (from, to) => `${secondsText(from)} → ${secondsText(to)}`;

// ---------- animações (quadros-chave reais na camada selecionada) ----------
const fadeIn = animation("Fade in", ({ base, start, end, params }) => {
  const to = Math.min(end, start + params.duration);
  return { when: span(start, to), frames: { opacity: [frame(start, 0), frame(to, base.opacity)] } };
});

const fadeOut = animation("Fade out", ({ base, start, end, params }) => {
  const from = Math.max(start, end - params.duration);
  return { when: span(from, end), frames: { opacity: [frame(from, base.opacity), frame(end, 0)] } };
});

const popIn = animation("Pop in", ({ base, start, end, params }) => {
  const to = Math.min(end, start + params.duration);
  const peak = start + (to - start) * 0.7;
  return { when: span(start, to), frames: { scale: [frame(start, 0), frame(peak, base.scale * (1 + params.overshoot / 100)), frame(to, base.scale)] } };
});

const SLIDE = { left: ["x", -1920], right: ["x", 1920], top: ["y", -1080], bottom: ["y", 1080] };
const slideIn = animation("Deslizar para dentro", ({ base, start, end, params }) => {
  const to = Math.min(end, start + params.duration);
  const [property, offset] = SLIDE[params.from];
  return { when: span(start, to), frames: { [property]: [frame(start, base[property] + offset), frame(to, base[property])] } };
});

const spin = animation("Girar", ({ base, start, end, params }) => {
  const sign = params.direction === "ccw" ? -1 : 1;
  return { when: span(start, end), frames: { rotation: [frame(start, base.rotation, "linear"), frame(end, base.rotation + sign * 360 * params.turns, "linear")] } };
});

const bounce = animation("Quicar", ({ base, start, end, params }) => {
  const to = Math.min(end, start + params.duration);
  const step = (to - start) / 5;
  const height = params.height;
  const heights = [height, 0, height * 0.35, 0, height * 0.1, 0];
  return { when: span(start, to), frames: { y: heights.map((lift, index) => frame(start + step * index, base.y - lift)) } };
});

const shake = animation("Tremor", ({ base, start, end, params }) => {
  const from = Math.max(start, Math.min(end, params.at));
  const to = Math.min(end, from + params.duration);
  if (to - from < 0.1) throw new ToolError("O tremor precisa de ao menos 0,1 s dentro da camada: mude o início.");
  const steps = Math.max(2, Math.round((to - from) * params.frequency));
  // Sequência determinística (mesmo resultado a cada aplicação), decaindo até zero no fim.
  const offsets = Array.from({ length: steps + 1 }, (_, index) => (index === 0 || index === steps ? 0 : Math.sin(index * 2.4) * params.amplitude * (1 - index / steps)));
  const at = (index) => from + ((to - from) * index) / steps;
  return {
    when: span(from, to),
    frames: {
      x: offsets.map((offset, index) => frame(at(index), base.x + offset, "linear")),
      y: offsets.map((offset, index) => frame(at(index), base.y + offset * 0.6 * (index % 2 ? -1 : 1), "linear")),
    },
  };
});

const slideOut = animation("Sair deslizando", ({ base, start, end, params }) => {
  const from = Math.max(start, end - params.duration);
  const [property, offset] = SLIDE[params.to];
  return { when: span(from, end), frames: { [property]: [frame(from, base[property]), frame(end, base[property] + offset)] } };
});

const shrinkOut = animation("Encolher e sumir", ({ base, start, end, params }) => {
  const from = Math.max(start, end - params.duration);
  return { when: span(from, end), frames: { scale: [frame(from, base.scale), frame(end, 0)], opacity: [frame(from, base.opacity), frame(end, 0)] } };
});

const EASING_LABELS = { linear: "Linear", "easy-ease": "Suave (easy ease)", hold: "Congelar (hold)" };
function easing(state, params) {
  const layer = editableOf(state);
  const layerFrames = state.propertyKeyframes[layer.id] || {};
  let count = 0;
  const next = { ...layerFrames };
  let total = 0;
  for (const property of TRANSFORM_PROPERTIES) {
    if (!layerFrames[property]?.length) continue;
    next[property] = layerFrames[property].map((item) => ({ ...item, interpolation: params.mode }));
    total += layerFrames[property].length;
    count += layerFrames[property].filter((item) => item.interpolation !== params.mode).length;
  }
  if (!total) return { ok: false, summary: `"${layer.name}" não tem quadros-chave: crie uma animação primeiro.` };
  if (!count) return { ok: false, summary: `Os ${total} quadro(s)-chave de "${layer.name}" já estão com a interpolação ${EASING_LABELS[params.mode]}.` };
  return {
    ok: true,
    count,
    summary: `Interpolação ${EASING_LABELS[params.mode]} em ${count} quadro(s)-chave de "${layer.name}"`,
    patch: { propertyKeyframes: { ...state.propertyKeyframes, [layer.id]: next } },
  };
}

function clearAnimation(state) {
  const layer = editableOf(state);
  const layerFrames = state.propertyKeyframes[layer.id] || {};
  const count = TRANSFORM_PROPERTIES.reduce((sum, property) => sum + (layerFrames[property]?.length || 0), 0);
  if (!count) return { ok: false, summary: `"${layer.name}" não tem quadros-chave de transformação.` };
  const next = { ...layerFrames };
  TRANSFORM_PROPERTIES.forEach((property) => delete next[property]);
  return { ok: true, count, summary: `${count} quadro(s)-chave removido(s) de "${layer.name}"`, patch: { propertyKeyframes: { ...state.propertyKeyframes, [layer.id]: next } } };
}

// ---------- texto (animação por letra/palavra, lida por textAt no visualizador e na exportação) ----------
function typewriter(mode) {
  return (state, params) => {
    const layer = editableOf(state);
    const [start, end] = layerSpan(layer);
    const text = layer.text ?? "MMEffect";
    const units = mode === "words" ? (text.match(/\S+\s*/g) || []).length : [...text].length;
    if (!units) throw new ToolError(`A camada "${layer.name}" não tem texto para animar.`);
    const duration = round(Math.min(end - start, params.speed === "fixed" ? params.duration : units / params.rate));
    return {
      ok: true,
      count: units,
      summary: `${mode === "words" ? "Palavra por palavra" : "Máquina de escrever"} em "${layer.name}": ${units} ${mode === "words" ? "palavra(s)" : "letra(s)"} em ${secondsText(duration)} (a partir de ${secondsText(start)})`,
      patch: {
        layers: state.layers.map((item) => (item.id === layer.id ? { ...item, textAnimation: { mode, start, duration, cursor: Boolean(params.cursor) } } : item)),
      },
    };
  };
}

function clearText(state) {
  const layer = editableOf(state);
  if (!layer.textAnimation) return { ok: false, summary: `"${layer.name}" não tem animação de texto.` };
  return {
    ok: true,
    count: 1,
    summary: `Animação de texto removida de "${layer.name}" (o texto aparece inteiro)`,
    patch: { layers: state.layers.map((item) => (item.id === layer.id ? { ...item, textAnimation: null } : item)) },
  };
}

// ---------- efeitos (filtros reais no visualizador e na exportação) ----------
function effect(name, values) {
  return (state, params) => {
    const settings = values(params);
    const already = state.appliedEffects.includes(name);
    const text = Object.entries(settings)
      .map(([label, value]) => `${label} ${String(value).replace(".", ",")}`)
      .join(" · ");
    const current = state.effectParams[name] || {};
    if (already && Object.entries(settings).every(([label, value]) => String(current[label]) === String(value)))
      return { ok: false, summary: `${name} já está com esses valores (${text}).` };
    return {
      ok: true,
      count: 1,
      summary: `${name} ${already ? "ajustado" : "aplicado"}: ${text}`,
      patch: {
        appliedEffects: already ? state.appliedEffects : [...state.appliedEffects, name],
        effectParams: { ...state.effectParams, [name]: { ...(state.effectParams[name] || {}), ...settings } },
      },
    };
  };
}

function removeEffects(state) {
  if (!state.appliedEffects.length) return { ok: false, summary: "A composição não tem efeitos aplicados." };
  return { ok: true, count: state.appliedEffects.length, summary: `${state.appliedEffects.length} efeito(s) removido(s)`, details: state.appliedEffects, patch: { appliedEffects: [] } };
}

// ---------- camada ----------
function toggleLayer(key, on, off) {
  return (state, params) => {
    const layer = editableOf(state);
    const enabled = params.mode === "on";
    if (Boolean(layer[key]) === enabled) return { ok: false, summary: `"${layer.name}" já está com ${enabled ? on : off}.` };
    return {
      ok: true,
      count: 1,
      summary: `${enabled ? on : off} em "${layer.name}"`,
      patch: { layers: state.layers.map((item) => (item.id === layer.id ? { ...item, [key]: enabled } : item)) },
    };
  };
}

function fitLayer(state) {
  const layer = editableOf(state);
  if ((layer.start ?? 0) === 0 && (layer.duration ?? COMP_DURATION) === COMP_DURATION) return { ok: false, summary: `"${layer.name}" já ocupa a composição inteira.` };
  return {
    ok: true,
    count: 1,
    summary: `"${layer.name}" agora vai de 0 s a ${COMP_DURATION} s`,
    patch: { layers: state.layers.map((item) => (item.id === layer.id ? { ...item, start: 0, duration: COMP_DURATION } : item)) },
  };
}

function sequence(state, params) {
  const movable = state.layers.filter((layer) => !layer.locked && layer.visible !== false && !(params.skipBackground && /background|fundo/i.test(`${layer.id} ${layer.name}`)));
  if (movable.length < 2) throw new ToolError("Precisa de duas ou mais camadas visíveis e desbloqueadas para sequenciar.");
  // Ordem da timeline: de baixo (fundo) para cima, como uma entrada em cascata.
  const ordered = params.order === "top" ? movable : [...movable].reverse();
  const starts = new Map(ordered.map((layer, index) => [layer.id, round(Math.min(COMP_DURATION - 0.1, params.offset + params.interval * index))]));
  return {
    ok: true,
    count: ordered.length,
    summary: `${ordered.length} camadas em cascata a cada ${secondsText(params.interval)} (${ordered[0].name} primeiro)`,
    details: ordered.map((layer) => `${layer.name}: entra em ${secondsText(starts.get(layer.id))}`),
    patch: {
      layers: state.layers.map((layer) => {
        if (!starts.has(layer.id)) return layer;
        const start = starts.get(layer.id);
        const end = params.keepEnd ? Math.min(COMP_DURATION, (layer.start ?? 0) + (layer.duration ?? COMP_DURATION)) : COMP_DURATION;
        return { ...layer, start, duration: round(Math.max(0.1, end - start)) };
      }),
    },
  };
}

function resetTransform(state) {
  const layer = editableOf(state);
  const layerFrames = { ...(state.propertyKeyframes[layer.id] || {}) };
  TRANSFORM_PROPERTIES.forEach((property) => delete layerFrames[property]);
  return {
    ok: true,
    count: 1,
    summary: `Transformação de "${layer.name}" redefinida (posição central, 100%, sem rotação e sem quadros-chave)`,
    patch: {
      transform: { x: 960, y: 540, scale: 100, rotation: 0, opacity: 100 },
      propertyKeyframes: { ...state.propertyKeyframes, [layer.id]: layerFrames },
      layers: state.layers.map((item) => (item.id === layer.id && item.anchor ? { ...item, anchor: null } : item)),
    },
  };
}

// ---------- marcadores ----------
function rhythmMarkers(state, params) {
  const times = [];
  for (let time = params.offset; time <= COMP_DURATION + 1e-6; time += params.interval) times.push(round(time));
  const fresh = times.filter((time) => !state.markers.some((marker) => Math.abs(marker - time) < 0.01));
  if (!fresh.length) return { ok: false, summary: "Esses marcadores já existem na composição." };
  return {
    ok: true,
    count: fresh.length,
    summary: `${fresh.length} marcador(es) a cada ${secondsText(params.interval)} (as camadas encaixam neles ao arrastar)`,
    patch: { markers: [...state.markers, ...fresh].sort((a, b) => a - b) },
  };
}

function clearMarkers(state) {
  if (!state.markers.length) return { ok: false, summary: "A composição não tem marcadores." };
  return { ok: true, count: state.markers.length, summary: `${state.markers.length} marcador(es) removido(s)`, patch: { markers: [] } };
}

// ---------- catálogo ----------
const toggleParam = (label) => ({
  key: "mode",
  label,
  type: "select",
  default: "on",
  options: [
    ["on", "Ligar"],
    ["off", "Desligar"],
  ],
});
const ANIMATION_HOW = "Cria quadros-chave reais na camada selecionada, a partir dos valores atuais de Transformar. Quadros-chave da mesma propriedade dentro do trecho são substituídos; os de fora ficam. Aparece na reprodução e na exportação.";

export function mmeffectsCatalogue() {
  const tools = [
    { id: "anim.fadein", tab: "animacao", label: "Fade in", icon: SunMedium, description: "A camada surge do transparente no início dela.", how: ANIMATION_HOW, params: [duration(0.6)], run: fadeIn },
    { id: "anim.fadeout", tab: "animacao", label: "Fade out", icon: SunDim, description: "A camada some até ficar transparente no fim dela.", how: ANIMATION_HOW, params: [duration(0.6)], run: fadeOut },
    {
      id: "anim.pop",
      tab: "animacao",
      label: "Pop in",
      icon: ZoomIn,
      description: "A camada cresce do zero, passa um pouco do tamanho e assenta.",
      how: ANIMATION_HOW,
      params: [duration(0.5), { key: "overshoot", label: "Passar do tamanho", type: "range", min: 0, max: 40, step: 5, default: 10, unit: "%" }],
      run: popIn,
    },
    {
      id: "anim.slide",
      tab: "animacao",
      label: "Deslizar",
      icon: MoveRight,
      description: "A camada entra deslizando de fora do quadro.",
      how: ANIMATION_HOW,
      params: [
        duration(0.8),
        {
          key: "from",
          label: "Entrar pela",
          type: "select",
          default: "left",
          options: [
            ["left", "Esquerda"],
            ["right", "Direita"],
            ["top", "Cima"],
            ["bottom", "Baixo"],
          ],
        },
      ],
      run: slideIn,
    },
    {
      id: "anim.spin",
      tab: "animacao",
      label: "Girar",
      icon: RotateCw,
      description: "Gira a camada continuamente durante toda a duração dela.",
      how: ANIMATION_HOW,
      params: [
        { key: "turns", label: "Voltas", type: "range", min: 0.25, max: 10, step: 0.25, default: 1 },
        {
          key: "direction",
          label: "Sentido",
          type: "select",
          default: "cw",
          options: [
            ["cw", "Horário"],
            ["ccw", "Anti-horário"],
          ],
        },
      ],
      run: spin,
    },
    {
      id: "anim.bounce",
      tab: "animacao",
      label: "Quicar",
      icon: ArrowDownToLine,
      description: "A camada cai e quica até parar (como a predefinição Formas · Bounce).",
      how: ANIMATION_HOW,
      params: [duration(1.2), { key: "height", label: "Altura", type: "range", min: 50, max: 800, step: 10, default: 300, unit: "px" }],
      run: bounce,
    },
    {
      id: "anim.shake",
      tab: "animacao",
      label: "Tremor",
      icon: Vibrate,
      description: "Tremida de câmera na camada, diminuindo até parar (wiggle).",
      how: ANIMATION_HOW,
      params: [
        { key: "at", label: "Começa em", type: "range", min: 0, max: 9.9, step: 0.1, default: 0, unit: "s" },
        duration(0.6),
        { key: "amplitude", label: "Amplitude", type: "range", min: 5, max: 200, step: 5, default: 40, unit: "px" },
        { key: "frequency", label: "Frequência", type: "range", min: 4, max: 30, step: 1, default: 12, unit: "Hz" },
      ],
      run: shake,
    },
    {
      id: "anim.slideout",
      tab: "animacao",
      label: "Sair deslizando",
      icon: ArrowRightFromLine,
      description: "A camada sai do quadro deslizando no fim dela.",
      how: ANIMATION_HOW,
      params: [
        duration(0.8),
        {
          key: "to",
          label: "Sair pela",
          type: "select",
          default: "right",
          options: [
            ["left", "Esquerda"],
            ["right", "Direita"],
            ["top", "Cima"],
            ["bottom", "Baixo"],
          ],
        },
      ],
      run: slideOut,
    },
    { id: "anim.shrinkout", tab: "animacao", label: "Encolher e sumir", icon: Minimize2, description: "No fim da camada, ela encolhe até zero enquanto some.", how: ANIMATION_HOW, params: [duration(0.5)], run: shrinkOut },
    {
      id: "anim.easing",
      tab: "animacao",
      label: "Suavização",
      icon: Spline,
      description: "Muda a interpolação de todos os quadros-chave da camada (linear, suave ou congelado).",
      params: [{ key: "mode", label: "Interpolação", type: "select", default: "easy-ease", options: Object.entries(EASING_LABELS) }],
      run: easing,
    },
    { id: "anim.clear", tab: "animacao", label: "Limpar animação", icon: Eraser, description: "Remove os quadros-chave de transformação da camada selecionada.", params: [], run: clearAnimation },
    ...[
      ["text.typewriter", "letters", "Máquina de escrever", Keyboard, "O texto da camada aparece letra por letra, como digitado.", 20, "letras/s"],
      ["text.words", "words", "Palavra por palavra", TextCursorInput, "O texto aparece uma palavra de cada vez (bom para legendas e frases de impacto).", 3, "palavras/s"],
    ].map(([id, mode, label, icon, description, rate, unit]) => ({
      id,
      tab: "texto",
      label,
      icon,
      description,
      how: "Grava a animação na camada selecionada (início = começo da camada). O visualizador e a exportação mostram só o trecho já digitado em cada instante.",
      params: [
        {
          key: "speed",
          label: "Tempo",
          type: "select",
          default: "rate",
          options: [
            ["rate", "Pela velocidade"],
            ["fixed", "Duração fixa"],
          ],
        },
        { key: "rate", label: "Velocidade", type: "range", min: 1, max: mode === "words" ? 10 : 60, step: 1, default: rate, unit },
        duration(2),
        { key: "cursor", label: "Cursor piscando", type: "toggle", default: mode === "letters" },
      ],
      run: typewriter(mode),
    })),
    { id: "text.clear", tab: "texto", label: "Texto inteiro", icon: Eraser, description: "Remove a animação de texto: a camada volta a mostrar o texto inteiro.", params: [], run: clearText },
    {
      id: "fx.blur",
      tab: "efeitos",
      label: "Desfoque",
      icon: Waves,
      description: "Desfoque gaussiano na camada em destaque.",
      params: [{ key: "amount", label: "Desfoque", type: "range", min: 1, max: 50, step: 1, default: 8, unit: "px" }],
      run: effect("Desfoque gaussiano", (p) => ({ Desfoque: p.amount })),
    },
    {
      id: "fx.color",
      tab: "efeitos",
      label: "Brilho/contraste",
      icon: Sun,
      description: "Ajusta brilho e contraste da camada em destaque.",
      params: [
        { key: "brightness", label: "Brilho", type: "range", min: -100, max: 100, step: 5, default: 15 },
        { key: "contrast", label: "Contraste", type: "range", min: -100, max: 100, step: 5, default: 20 },
      ],
      run: effect("Brilho e contraste", (p) => ({ Brilho: p.brightness, Contraste: p.contrast })),
    },
    {
      id: "fx.hue",
      tab: "efeitos",
      label: "Matiz",
      icon: Palette,
      description: "Gira as cores e muda a saturação da camada em destaque.",
      params: [
        { key: "hue", label: "Matiz", type: "range", min: -180, max: 180, step: 5, default: 30, unit: "°" },
        { key: "saturation", label: "Saturação", type: "range", min: -100, max: 100, step: 5, default: 20 },
      ],
      run: effect("Tonalidade/Saturação", (p) => ({ Matiz: p.hue, Saturação: p.saturation })),
    },
    {
      id: "fx.glow",
      tab: "efeitos",
      label: "Glow",
      icon: Sparkles,
      description: "Brilho luminoso em volta da camada em destaque.",
      params: [
        { key: "radius", label: "Raio do brilho", type: "range", min: 1, max: 60, step: 1, default: 12, unit: "px" },
        { key: "intensity", label: "Intensidade", type: "range", min: 0.1, max: 4, step: 0.1, default: 1 },
      ],
      run: effect("Glow", (p) => ({ "Raio do brilho": p.radius, "Intensidade do brilho": p.intensity })),
    },
    {
      id: "fx.shadow",
      tab: "efeitos",
      label: "Sombra",
      icon: Square,
      description: "Sombra projetada (Drop Shadow) na camada em destaque.",
      params: [
        { key: "opacity", label: "Opacidade da sombra", type: "range", min: 5, max: 100, step: 5, default: 50, unit: "%" },
        { key: "distance", label: "Distância", type: "range", min: 0, max: 100, step: 1, default: 6, unit: "px" },
        { key: "softness", label: "Suavidade", type: "range", min: 0, max: 50, step: 1, default: 4, unit: "px" },
      ],
      run: effect("Drop Shadow", (p) => ({ "Opacidade da sombra": p.opacity, Distância: p.distance, Suavidade: p.softness })),
    },
    {
      id: "fx.particles",
      tab: "efeitos",
      label: "Partículas",
      icon: Orbit,
      description: "Explosão de partículas (CC Particle World) no visualizador e na exportação.",
      params: [
        { key: "birth", label: "Quantidade", type: "range", min: 0.1, max: 3, step: 0.1, default: 0.5 },
        { key: "velocity", label: "Velocidade", type: "range", min: 0.1, max: 3, step: 0.1, default: 1 },
        { key: "gravity", label: "Gravidade", type: "range", min: -1, max: 2, step: 0.1, default: 0.5 },
      ],
      run: effect("CC Particle World", (p) => ({ "Birth Rate": p.birth, Velocity: p.velocity, Gravity: p.gravity })),
    },
    { id: "fx.clear", tab: "efeitos", label: "Remover efeitos", icon: Ban, description: "Tira todos os efeitos aplicados da composição.", params: [], run: removeEffects },
    {
      id: "layer.motionblur",
      tab: "camada",
      label: "Motion blur",
      icon: Wind,
      description: "Desfoque de movimento proporcional à velocidade da animação da camada.",
      params: [toggleParam("Motion blur")],
      run: toggleLayer("motionBlur", "Motion blur ligado", "Motion blur desligado"),
    },
    { id: "layer.3d", tab: "camada", label: "Camada 3D", icon: Box, description: "Liga ou desliga o modo 3D da camada selecionada.", params: [toggleParam("3D")], run: toggleLayer("threeD", "Modo 3D ligado", "Modo 3D desligado") },
    { id: "layer.fit", tab: "camada", label: "Ocupar tudo", icon: Maximize, description: "Estica a camada para durar a composição inteira (0 a 10 s).", params: [], run: fitLayer },
    {
      id: "layer.sequence",
      tab: "camada",
      label: "Sequenciar",
      icon: ListOrdered,
      description: "Faz as camadas entrarem uma depois da outra (cascata), mudando o início de cada uma na timeline.",
      params: [
        { key: "interval", label: "Intervalo", type: "range", min: 0.1, max: 3, step: 0.1, default: 0.4, unit: "s" },
        { key: "offset", label: "Primeira entra em", type: "range", min: 0, max: 5, step: 0.1, default: 0, unit: "s" },
        {
          key: "order",
          label: "Ordem",
          type: "select",
          default: "bottom",
          options: [
            ["bottom", "De baixo para cima"],
            ["top", "De cima para baixo"],
          ],
        },
        { key: "skipBackground", label: "Manter o fundo parado", type: "toggle", default: true },
        { key: "keepEnd", label: "Manter o fim de cada camada", type: "toggle", default: false },
      ],
      run: sequence,
    },
    { id: "layer.reset", tab: "camada", label: "Redefinir", icon: RotateCcw, description: "Volta posição, escala, rotação e opacidade ao padrão e apaga os quadros-chave de transformação.", params: [], run: resetTransform },
    {
      id: "markers.rhythm",
      tab: "marcadores",
      label: "Marcadores ritmados",
      icon: Flag,
      description: "Cria marcadores em intervalos fixos (ex.: no compasso da música) para encaixar as camadas.",
      params: [
        { key: "interval", label: "Intervalo", type: "range", min: 0.25, max: 5, step: 0.25, default: 1, unit: "s" },
        { key: "offset", label: "Primeiro marcador", type: "range", min: 0, max: 5, step: 0.05, default: 0, unit: "s" },
      ],
      run: rhythmMarkers,
    },
    { id: "markers.clear", tab: "marcadores", label: "Limpar marcadores", icon: FlagOff, description: "Remove todos os marcadores da composição.", params: [], run: clearMarkers },
  ];
  return { tabs: MMEFFECTS_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runMMEffectsTool(toolId, state, params) {
  const tool = mmeffectsCatalogue().tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run(state, { ...defaultsOf(tool), ...(params || {}) });
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
