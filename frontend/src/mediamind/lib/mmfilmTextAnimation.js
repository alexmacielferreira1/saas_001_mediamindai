// Animações de texto do MMFilm (títulos e legendas): catálogo próprio de presets e avaliação pura no tempo.
// O texto, a fonte, o tamanho, a cor e a posição continuam os do clipe; a animação só altera visibilidade,
// deslocamento, escala, rotação, inclinação, espaçamento e desfoque. Deslocamentos, espaçamento e desfoque
// estão em pixels da sequência 1920×1080 (o renderizador converte para o tamanho do quadro).
//
// Modos: "in" toca no início do clipe, "out" termina exatamente no fim do clipe (nunca passa dele) e
// "loop" (ênfase) se repete durante todo o clipe. Se o clipe for menor que o preset, a duração encolhe.
import { seeded } from "./mmfilmMotion";

const SEQUENCE_WIDTH = 1920;
const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits + 0; // + 0 evita -0
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOutCubic = (x) => 1 - (1 - x) ** 3;
const easeOutBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const DECODE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+?<>/";

const preset = (id, name, group, duration, mode, style, unit = "texto") => ({ id, name, group, duration, mode, style, unit });

/** Catálogo próprio: { id, name, group, duration (s), mode, style, unit ("texto" | "palavra" | "letra") }. */
export const TEXT_ANIMATIONS = [
  preset("aparecer", "Aparecer", "Entrada", 0.5, "in", "fade"),
  preset("desfoque-in", "Desfoque para nítido", "Entrada", 0.6, "in", "blur"),
  preset("espacamento-in", "Espaçamento fechando", "Entrada", 0.8, "in", "tracking"),
  preset("inclinar-in", "Inclinar e assentar", "Entrada", 0.6, "in", "skew"),
  preset("deslizar-in", "Deslizar da esquerda", "Entrada", 0.5, "in", "slide"),
  preset("aproximar-in", "Aproximar", "Entrada", 0.5, "in", "zoom"),
  preset("subir-palavras", "Subir palavra por palavra", "Entrada", 0.8, "in", "rise", "palavra"),
  preset("pop-palavras", "Pop por palavra", "Entrada", 0.7, "in", "pop", "palavra"),
  preset("girar-letras", "Girar letras", "Entrada", 0.9, "in", "spin", "letra"),
  preset("cair-letras", "Cair letras", "Entrada", 0.8, "in", "drop", "letra"),
  preset("saltar-letras", "Letras gigantes assentando", "Entrada", 0.8, "in", "zoomLetter", "letra"),
  preset("surgir-letras", "Surgir letra a letra", "Entrada", 0.7, "in", "fadeLetter", "letra"),
  preset("nevoa-letras", "Névoa letra a letra", "Entrada", 0.9, "in", "blurLetter", "letra"),
  preset("digitar", "Digitar", "Digitação", 1.2, "in", "type"),
  preset("digitar-palavras", "Digitar palavras", "Digitação", 1, "in", "typeWords"),
  preset("decodificar", "Decodificar", "Digitação", 1.2, "in", "decode", "letra"),
  preset("onda", "Onda", "Ênfase", 0.8, "loop", "wave", "letra"),
  preset("pulsar", "Pulsar", "Ênfase", 0.7, "loop", "pulse"),
  preset("brilho", "Brilho piscante", "Ênfase", 0.5, "loop", "flicker"),
  preset("tremer", "Tremer", "Ênfase", 0.4, "loop", "shake"),
  preset("balancar", "Balançar", "Ênfase", 1.2, "loop", "sway"),
  preset("sumir", "Sumir", "Saída", 0.5, "out", "fade"),
  preset("desfoque-out", "Desfocar e sumir", "Saída", 0.6, "out", "blur"),
  preset("espacamento-out", "Espaçamento abrindo", "Saída", 0.8, "out", "tracking"),
  preset("descer-palavras-out", "Palavras descendo", "Saída", 0.8, "out", "rise", "palavra"),
  preset("apagar", "Apagar digitando", "Saída", 1, "out", "type"),
  preset("decodificar-out", "Embaralhar e sumir", "Saída", 1, "out", "decode", "letra"),
];

export const TEXT_ANIMATION_GROUPS = ["Entrada", "Digitação", "Ênfase", "Saída"];

export function findTextAnimation(value) {
  if (value && typeof value === "object") return value.style ? value : null;
  return TEXT_ANIMATIONS.find((item) => item.id === value) || null;
}

const neutral = (text) => ({
  visibleText: text,
  tracking: 0,
  skew: 0,
  opacity: 1,
  blur: 0,
  dx: 0,
  dy: 0,
  scale: 1,
  rotation: 0,
  phase: "idle",
  progress: 1,
});

const NEUTRAL_LETTER = { opacity: 1, dx: 0, dy: 0, scale: 1, rotation: 0, blur: 0 };

// Estilos do texto inteiro: `a` vai de 0 (escondido) a 1 (assentado).
const TEXT_STYLES = {
  fade: (a) => ({ opacity: a }),
  blur: (a) => ({ opacity: a, blur: (1 - a) * 24 }),
  tracking: (a) => ({ opacity: a, tracking: (1 - a) * 40 }),
  skew: (a) => ({ opacity: a, skew: (1 - a) * -25, dx: (1 - a) * -120 }),
  slide: (a) => ({ opacity: a, dx: (1 - a) * -200 }),
  zoom: (a) => ({ opacity: a, scale: 0.6 + 0.4 * a }),
};

// Estilos por letra/palavra: `a` é o progresso daquela unidade.
const LETTER_STYLES = {
  rise: (a) => ({ opacity: a, dy: (1 - a) * 40 }),
  pop: (a) => ({ opacity: Math.min(1, a * 3), scale: easeOutBack(a) }),
  spin: (a) => ({ opacity: a, rotation: (1 - a) * -90, scale: 0.5 + 0.5 * a }),
  drop: (a) => ({ opacity: a, dy: (1 - a) * -60 }),
  zoomLetter: (a) => ({ opacity: a, scale: 1 + (1 - a) * 2 }),
  fadeLetter: (a) => ({ opacity: a }),
  blurLetter: (a) => ({ opacity: a, blur: (1 - a) * 12 }),
};

// Ênfases contínuas: dependem do tempo local `t`, do índice da letra e da semente.
const LOOP_STYLES = {
  pulse: (t) => ({ scale: 1 + 0.06 * Math.sin(2 * Math.PI * t * 1.5) }),
  flicker: (t, seed) => ({ opacity: seeded(Math.floor(t * 12), seed) < 0.25 ? 0.35 : 1 }),
  shake: (t, seed) => {
    const step = Math.floor(t * 24);
    return { dx: (seeded(step, seed) - 0.5) * 8, dy: (seeded(step, seed + 5) - 0.5) * 6 };
  },
  sway: (t) => ({ rotation: Math.sin(2 * Math.PI * t * 0.8) * 4 }),
};

function roundAll(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, round(value)]));
}

// Índice de escalonamento de cada caractere (por letra ou por palavra; espaços seguem a palavra anterior).
function unitIndexes(chars, unit) {
  let word = -1;
  let previousSpace = true;
  const indexes = chars.map((char, index) => {
    const space = /\s/.test(char);
    if (!space && previousSpace) word += 1;
    previousSpace = space;
    return unit === "palavra" ? Math.max(0, word) : index;
  });
  return { indexes, count: unit === "palavra" ? Math.max(1, word + 1) : chars.length };
}

// Progresso de cada unidade: as unidades começam escalonadas e todas terminam juntas quando a = 1.
function staggered(a, index, count) {
  const spread = count > 1 ? 0.6 : 0;
  const window = 1 - spread;
  const start = count > 1 ? (index / (count - 1)) * spread : 0;
  return clamp01((a - start) / window);
}

/** Progresso (0 = escondido, 1 = assentado) e fase do preset no tempo local do clipe. */
export function textAnimationProgress(animation, localTime, clipDuration) {
  const length = Math.max(0, Math.min(animation.duration, clipDuration));
  if (animation.mode === "loop") return { amount: 1, phase: "loop" };
  if (length <= 0) return { amount: 1, phase: "idle" };
  if (animation.mode === "out") {
    const from = clipDuration - length;
    if (localTime < from) return { amount: 1, phase: "idle" };
    return { amount: clamp01(1 - (localTime - from) / length), phase: "out" };
  }
  if (localTime >= length) return { amount: 1, phase: "idle" };
  return { amount: clamp01(localTime / length), phase: "in" };
}

/**
 * Estado visual do texto no tempo local do clipe (determinístico, puro).
 * Devolve { visibleText, letters?, tracking, skew, opacity, blur, dx, dy, scale, rotation, phase, progress }.
 */
export function textAnimationState(presetOrId, text, localTime, clipDuration, seed = 0) {
  const content = String(text ?? "");
  const animation = findTextAnimation(presetOrId);
  if (!animation) return neutral(content);
  const time = Math.max(0, Number(localTime) || 0);
  const { amount, phase } = textAnimationProgress(animation, time, Math.max(0, Number(clipDuration) || 0));
  const state = { ...neutral(content), phase, progress: round(amount) };
  const eased = easeOutCubic(amount);
  const chars = Array.from(content);
  const { style } = animation;

  if (TEXT_STYLES[style]) return { ...state, ...roundAll(TEXT_STYLES[style](eased)) };
  if (LOOP_STYLES[style]) return { ...state, ...roundAll(LOOP_STYLES[style](time, seed)) };
  if (style === "type") {
    return { ...state, visibleText: chars.slice(0, Math.floor(amount * chars.length + 1e-9)).join("") };
  }
  if (style === "typeWords") {
    const parts = content.split(/(\s+)/);
    const words = parts.filter((part) => part && !/^\s+$/.test(part)).length;
    let shown = Math.floor(amount * words + 1e-9);
    const visible = [];
    for (const part of parts) {
      const isWord = part && !/^\s+$/.test(part);
      if (isWord && shown === 0) break;
      if (isWord) shown -= 1;
      visible.push(part);
    }
    return { ...state, visibleText: visible.join("").trimEnd() };
  }
  if (style === "wave") {
    const letters = chars.map((char, index) => ({
      char,
      ...NEUTRAL_LETTER,
      dy: round(Math.sin(2 * Math.PI * time * 1.2 - index * 0.45) * 10),
    }));
    return { ...state, letters };
  }
  if (style === "decode") {
    const step = Math.floor(time * 24);
    const letters = chars.map((char, index) => {
      const local = staggered(amount, index, chars.length);
      if (/\s/.test(char) || local >= 1) return { char, ...NEUTRAL_LETTER };
      const glyph = DECODE_GLYPHS[Math.floor(seeded(index, step + seed * 31) * DECODE_GLYPHS.length)];
      return { char: glyph, ...NEUTRAL_LETTER, opacity: local > 0 ? 1 : 0 };
    });
    return { ...state, visibleText: letters.map((letter) => letter.char).join(""), letters };
  }
  // Estilos por letra/palavra.
  const { indexes, count } = unitIndexes(chars, animation.unit);
  const letters = chars.map((char, index) => ({
    char,
    ...NEUTRAL_LETTER,
    ...roundAll(LETTER_STYLES[style](easeOutCubic(staggered(amount, indexes[index], count)))),
  }));
  return { ...state, letters };
}

const withBlur = (current, px) => {
  const base = current && current !== "none" ? `${current} ` : "";
  return `${base}blur(${round(px, 2)}px)`;
};

/**
 * Desenha o texto animado no canvas, centralizado como o título padrão do MMFilm (ou em style.x/style.y).
 * style: { fontSize, fontFamily, fontWeight, color, lineHeight, x, y } — tudo opcional.
 */
export function drawAnimatedText(context, text, state, width, height, style = {}) {
  const current = state || neutral(String(text ?? ""));
  const unit = width / SEQUENCE_WIDTH;
  const size = style.fontSize ?? Math.round(Math.min(width, height * (16 / 9)) * 0.035);
  const lineHeight = size * (style.lineHeight ?? 1.25);
  context.save();
  context.globalAlpha = (context.globalAlpha ?? 1) * clamp01(current.opacity);
  if (current.blur > 0) context.filter = withBlur(context.filter, current.blur * unit);
  context.fillStyle = style.color ?? "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${style.fontWeight ?? "bold"} ${size}px ${style.fontFamily ?? "sans-serif"}`;
  context.translate((style.x ?? width / 2) + current.dx * unit, (style.y ?? height / 2) + current.dy * unit);
  if (current.rotation) context.rotate((current.rotation * Math.PI) / 180);
  if (current.scale !== 1) context.scale(current.scale, current.scale);
  if (current.skew) context.transform(1, 0, Math.tan((current.skew * Math.PI) / 180), 1, 0, 0);

  const letters = current.letters || (current.tracking ? Array.from(current.visibleText).map((char) => ({ char, ...NEUTRAL_LETTER })) : null);
  if (!letters) {
    const lines = current.visibleText.split("\n");
    const top = -((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => context.fillText(line, 0, top + index * lineHeight));
    context.restore();
    return;
  }
  const lines = [[]];
  letters.forEach((letter) => (letter.char === "\n" ? lines.push([]) : lines[lines.length - 1].push(letter)));
  const top = -((lines.length - 1) * lineHeight) / 2;
  const tracking = current.tracking * unit;
  lines.forEach((line, row) => {
    const widths = line.map((letter) => context.measureText(letter.char).width);
    const total = widths.reduce((sum, value) => sum + value, 0) + tracking * Math.max(0, line.length - 1);
    let x = -total / 2;
    line.forEach((letter, index) => {
      if (letter.opacity > 0 && !/\s/.test(letter.char)) {
        context.save();
        context.globalAlpha *= clamp01(letter.opacity);
        if (letter.blur > 0) context.filter = withBlur(context.filter, letter.blur * unit);
        context.translate(x + widths[index] / 2 + letter.dx * unit, top + row * lineHeight + letter.dy * unit);
        if (letter.rotation) context.rotate((letter.rotation * Math.PI) / 180);
        if (letter.scale !== 1) context.scale(letter.scale, letter.scale);
        context.fillText(letter.char, 0, 0);
        context.restore();
      }
      x += widths[index] + tracking;
    });
  });
  context.restore();
}

function cssTransform(values, pxScale) {
  const parts = [];
  if (values.dx || values.dy) parts.push(`translate(${round(values.dx * pxScale, 2)}px, ${round(values.dy * pxScale, 2)}px)`);
  if (values.rotation) parts.push(`rotate(${values.rotation}deg)`);
  if (values.scale !== 1) parts.push(`scale(${values.scale})`);
  if (values.skew) parts.push(`skewX(${values.skew}deg)`);
  return parts.length ? parts.join(" ") : undefined;
}

/** Estilo React do bloco de texto na prévia. `pxScale` converte pixels da sequência para pixels da prévia. */
export function animatedTextStyle(state, { pxScale = 1 } = {}) {
  const current = state || neutral("");
  return {
    display: "inline-block",
    whiteSpace: "pre-wrap",
    opacity: clamp01(current.opacity),
    letterSpacing: current.tracking ? `${round(current.tracking * pxScale, 2)}px` : undefined,
    transform: cssTransform(current, pxScale),
    filter: current.blur > 0 ? `blur(${round(current.blur * pxScale, 2)}px)` : undefined,
  };
}

/** Spans da prévia: uma por letra quando o preset anima letras; senão um único span com o texto visível. */
export function letterSpans(state, { pxScale = 1 } = {}) {
  const current = state || neutral("");
  if (!current.letters) return [{ key: "texto", char: current.visibleText, lineBreak: false, style: {} }];
  return current.letters.map((letter, index) => ({
    key: String(index),
    char: letter.char,
    lineBreak: letter.char === "\n",
    style: {
      display: "inline-block",
      whiteSpace: "pre",
      opacity: clamp01(letter.opacity),
      transform: cssTransform(letter, pxScale),
      filter: letter.blur > 0 ? `blur(${round(letter.blur * pxScale, 2)}px)` : undefined,
    },
  }));
}
