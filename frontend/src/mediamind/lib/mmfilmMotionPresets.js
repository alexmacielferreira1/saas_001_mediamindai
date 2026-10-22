// Motion presets de entrada/saída do MMFilm, movimentos rápidos extras e "clonar estilo".
//
// As curvas seguem o formato de `clip.motion` (ver mmfilmMotion.js): chaves [[t, valor, suavização?]] no tempo
// local do clipe. Canais compatíveis com `animatedClip`: scale (fator), x/y (px da sequência 1920×1080),
// rotation (graus). Canais extras, lidos por `effectiveVisual` e aplicados pelo renderizador:
//   opacity — fator 0–1 multiplicado pela opacidade do clipe (neutro 1);
//   blur    — desfoque gaussiano em px da sequência (neutro 0);
//   scaleX  — fator horizontal extra, simula rotação 3D (achatamento; negativo espelha) (neutro 1);
//   glitch  — intensidade 0–1 de deslocamento RGB/fatias (neutro 0).
// Todos os presets terminam no valor neutro: a entrada assenta no clipe e a saída parte dele.
import { keyValueAt } from "./mmfilmEdits";
import { seeded } from "./mmfilmMotion";

const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits + 0; // + 0 evita -0
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const NEUTRAL = { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1, blur: 0, scaleX: 1, glitch: 0 };
const MULTIPLY = new Set(["scale", "opacity", "scaleX"]);
const ADD = new Set(["x", "y", "rotation", "blur"]);

// Curvas com tremor determinístico que decai até zero (u = tempo normalizado 0–1).
function jitter(steps, amplitude, salt, ease) {
  const keys = [];
  for (let step = 0; step <= steps; step += 1) {
    const decay = 1 - step / steps;
    const value = step === steps ? 0 : round((seeded(step, salt) - 0.5) * 2 * amplitude * decay, 2);
    keys.push(ease && step < steps ? [round(step / steps), value, ease] : [round(step / steps), value]);
  }
  return keys;
}

const FADE_IN = (until) => [[0, 0], [until, 1]];
const p = (id, name, category, curves) => ({ id, name, category, kinds: ["in", "out"], curves });

/**
 * Catálogo próprio. `curves` descreve a ENTRADA em tempo normalizado (0 = início, 1 = assentado);
 * a saída é o espelho no tempo.
 */
export const MOTION_PRESETS = [
  p("deslizar-esquerda", "Deslizar da esquerda", "Deslizar", { x: [[0, -1920, "ease"], [1, 0]] }),
  p("deslizar-direita", "Deslizar da direita", "Deslizar", { x: [[0, 1920, "ease"], [1, 0]] }),
  p("deslizar-cima", "Subir de baixo", "Deslizar", { y: [[0, 1080, "ease"], [1, 0]] }),
  p("deslizar-baixo", "Descer de cima", "Deslizar", { y: [[0, -1080, "ease"], [1, 0]] }),
  p("deslizar-suave", "Deslizar suave", "Deslizar", { x: [[0, -160, "ease"], [1, 0]], opacity: FADE_IN(0.6) }),
  p("zoom-entrar", "Zoom chegando", "Zoom", { scale: [[0, 0.2, "ease"], [1, 1]], opacity: FADE_IN(0.4) }),
  p("zoom-afastar", "Zoom recuando", "Zoom", { scale: [[0, 1.8, "ease"], [1, 1]], opacity: FADE_IN(0.4) }),
  p("zoom-rapido", "Zoom relâmpago", "Zoom", { scale: [[0, 3, "ease"], [0.6, 1]], blur: [[0, 16, "ease"], [0.6, 0]] }),
  p("girar", "Girar e crescer", "Rotação 2D", {
    rotation: [[0, -180, "ease"], [1, 0]],
    scale: [[0, 0.3, "ease"], [1, 1]],
    opacity: FADE_IN(0.3),
  }),
  p("girar-leve", "Giro leve", "Rotação 2D", { rotation: [[0, -15, "ease"], [1, 0]], opacity: FADE_IN(0.5) }),
  p("rodopio", "Rodopio", "Rotação 2D", { rotation: [[0, 360, "ease"], [1, 0]], scale: [[0, 0, "ease"], [1, 1]] }),
  p("virar-horizontal", "Virar no eixo", "Rotação 3D", { scaleX: [[0, 0, "ease"], [1, 1]] }),
  p("virar-cartao", "Virar cartão", "Rotação 3D", { scaleX: [[0, -1, "ease"], [1, 1]], scale: [[0, 0.85, "ease"], [1, 1]] }),
  p("porta", "Porta abrindo", "Rotação 3D", { scaleX: [[0, 0, "ease"], [1, 1]], x: [[0, -960, "ease"], [1, 0]] }),
  p("desfoque", "Desfoque para nítido", "Desfoque", { blur: [[0, 30, "ease"], [1, 0]], opacity: FADE_IN(0.5) }),
  p("desfoque-zoom", "Desfoque com zoom", "Desfoque", {
    blur: [[0, 20, "ease"], [1, 0]],
    scale: [[0, 1.3, "ease"], [1, 1]],
    opacity: FADE_IN(0.3),
  }),
  p("glitch", "Glitch digital", "Glitch", {
    glitch: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((u, index) => [
      u,
      [1, 0.2, 0.9, 0.4, 0.8, 0.1, 0.5, 0.15, 0][index],
      ...(u < 1 ? ["hold"] : []),
    ]),
    x: jitter(8, 80, 21, "hold"),
    opacity: [[0, 0, "hold"], [0.1, 1]],
  }),
  p("glitch-rgb", "Glitch RGB piscando", "Glitch", {
    glitch: [[0, 1, "hold"], [0.25, 0.3, "hold"], [0.5, 0.8, "hold"], [0.75, 0.2, "hold"], [1, 0]],
    opacity: [[0, 0, "hold"], [0.15, 1, "hold"], [0.3, 0.3, "hold"], [0.45, 1]],
  }),
  p("tremor", "Tremor", "Tremor", { x: jitter(12, 40, 3), y: jitter(12, 28, 9), opacity: FADE_IN(0.2) }),
  p("impacto", "Impacto", "Tremor", { scale: [[0, 1.25, "ease"], [0.4, 1]], y: jitter(10, 30, 15) }),
  p("crescer", "Crescer", "Escala", { scale: [[0, 0, "ease"], [1, 1]] }),
  p("encolher", "Encolher até o lugar", "Escala", { scale: [[0, 2.2, "ease"], [1, 1]], opacity: FADE_IN(0.5) }),
  p("esticar", "Esticar", "Escala", { scaleX: [[0, 1.8, "ease"], [1, 1]], opacity: FADE_IN(0.4) }),
  p("elastico", "Elástico", "Elástico", { scale: [[0, 0], [0.45, 1.15, "ease"], [0.65, 0.94, "ease"], [0.82, 1.03, "ease"], [1, 1]] }),
  p("quicar", "Quicar", "Elástico", {
    y: [[0, -700], [0.4, 0, "ease"], [0.6, -140], [0.78, 0, "ease"], [0.9, -35], [1, 0]],
  }),
  p("mola-lateral", "Mola lateral", "Elástico", {
    x: [[0, -480, "ease"], [0.5, 48, "ease"], [0.75, -14, "ease"], [1, 0]],
  }),
  p("aparecer", "Aparecer", "Opacidade", { opacity: [[0, 0], [1, 1]] }),
  p("piscar", "Piscar", "Opacidade", {
    opacity: [[0, 0, "hold"], [0.15, 1, "hold"], [0.3, 0, "hold"], [0.45, 1, "hold"], [0.6, 0.2, "hold"], [0.75, 1]],
  }),
];

export const MOTION_CATEGORIES = [...new Set(MOTION_PRESETS.map((item) => item.category))];

export function findMotionPreset(value) {
  if (value && typeof value === "object") return value.curves ? value : null;
  return MOTION_PRESETS.find((item) => item.id === value) || null;
}

// Converte uma curva normalizada para segundos. A saída espelha o tempo; a suavização de cada trecho é
// mantida (em "hold" o valor mantido passa a ser o da outra ponta — aproximação aceitável para glitch/piscar).
function placeKeys(keys, kind, from, length) {
  if (kind === "in") {
    return keys.map(([u, value, ease]) => (ease ? [round(from + u * length), value, ease] : [round(from + u * length), value]));
  }
  const last = keys.length - 1;
  return keys
    .map((_, index) => {
      const [u, value] = keys[last - index];
      const ease = index < last ? keys[last - index - 1][2] : undefined;
      const time = round(from + (1 - u) * length);
      return ease ? [time, value, ease] : [time, value];
    });
}

/**
 * Curvas de um preset para um clipe: kind "in" | "out" | "both", duração de cada animação `length` (s).
 * Nunca passa do fim do clipe; em "both", se o clipe for menor que entrada + saída, ambas encolhem igualmente.
 */
export function motionPresetCurves(presetOrId, kind, clipDuration, { length = 0.5 } = {}) {
  const preset = findMotionPreset(presetOrId);
  const duration = Number(clipDuration);
  if (!preset || !(duration > 0)) return null;
  const sides = kind === "both" ? ["in", "out"] : [kind];
  if (!sides.every((side) => preset.kinds.includes(side))) return null;
  const size = round(Math.min(Math.max(0, Number(length) || 0), kind === "both" ? duration / 2 : duration));
  if (!(size > 0)) return null;
  const curves = {};
  sides.forEach((side) => {
    const from = side === "in" ? 0 : round(duration - size);
    Object.entries(preset.curves).forEach(([channel, keys]) => {
      curves[channel] = [...(curves[channel] || []), ...placeKeys(keys, side, from, size)];
    });
  });
  return curves;
}

// Suavização do trecho que começa no tempo `time` (null fora da curva).
function segmentEase(keys, time) {
  if (!Array.isArray(keys) || keys.length < 2 || time < keys[0][0] || time >= keys[keys.length - 1][0]) return null;
  let index = 0;
  while (keys[index + 1][0] <= time) index += 1;
  return keys[index][2] || "linear";
}

function combine(channel, a, b) {
  if (MULTIPLY.has(channel)) return a * b;
  if (ADD.has(channel)) return a + b;
  return clamp(Math.max(a, b), 0, 1);
}

const SAMPLE = 1 / 30;

// Compõe duas curvas do mesmo canal amostrando trechos suavizados a 30 por segundo (resultado linear).
function composeKeys(channel, first, second) {
  const fallback = NEUTRAL[channel];
  const times = [...new Set([...first, ...second].map((key) => key[0]))].sort((x, y) => x - y);
  const samples = [];
  times.forEach((time, index) => {
    samples.push(time);
    const next = times[index + 1];
    if (next === undefined) return;
    const eases = [segmentEase(first, time), segmentEase(second, time)];
    if (eases.includes("ease")) {
      for (let t = time + SAMPLE; t < next - 1e-6; t += SAMPLE) samples.push(round(t));
    }
    if (eases.includes("hold")) samples.push(round(next - 0.001));
  });
  return [...new Set(samples)]
    .sort((x, y) => x - y)
    .map((time) => [time, round(combine(channel, keyValueAt(first, time, fallback), keyValueAt(second, time, fallback)))]);
}

/**
 * Junta movimentos: canais só de um lado são mantidos; canais nos dois são compostos
 * (scale/opacity/scaleX multiplicam, x/y/rotation/blur somam, glitch usa o maior).
 * Canais desconhecidos presentes nos dois lados são substituídos pelo novo.
 */
export function mergeMotion(existing, added) {
  if (!added) return existing || null;
  if (!existing) return { ...added };
  const merged = { ...existing };
  Object.entries(added).forEach(([channel, keys]) => {
    const current = existing[channel];
    if (!Array.isArray(current) || !current.length || !(channel in NEUTRAL)) merged[channel] = keys;
    else if (Array.isArray(keys) && keys.length) merged[channel] = composeKeys(channel, current, keys);
  });
  return merged;
}

/** Canais extras do clipe no tempo da timeline: { opacityFactor, blur, scaleX, glitch }. */
export function effectiveVisual(clip, time) {
  const motion = clip?.motion;
  if (!motion) return { opacityFactor: 1, blur: 0, scaleX: 1, glitch: 0 };
  const local = Math.max(0, Math.min(clip.duration, time - clip.start));
  return {
    opacityFactor: clamp(keyValueAt(motion.opacity, local, 1), 0, 1),
    blur: Math.max(0, keyValueAt(motion.blur, local, 0)),
    scaleX: keyValueAt(motion.scaleX, local, 1),
    glitch: clamp(keyValueAt(motion.glitch, local, 0), 0, 1),
  };
}

const level = (intensity) => clamp(Number(intensity) || 5, 1, 10) / 5;

function motionBlurFrom(motion, duration, f) {
  const end = round(duration);
  const keys = [];
  for (let t = 0; t <= end + 1e-9; t += SAMPLE) {
    const a = Math.min(t, end);
    const b = Math.min(t + SAMPLE, end);
    const span = b - a || SAMPLE;
    const dx = keyValueAt(motion.x, b, 0) - keyValueAt(motion.x, a, 0);
    const dy = keyValueAt(motion.y, b, 0) - keyValueAt(motion.y, a, 0);
    const ds = keyValueAt(motion.scale, b, 1) - keyValueAt(motion.scale, a, 1);
    const dr = keyValueAt(motion.rotation, b, 0) - keyValueAt(motion.rotation, a, 0);
    const speed = (Math.hypot(dx, dy) + Math.abs(ds) * 960 + Math.abs(dr) * 10) / span;
    keys.push([round(a), round(Math.min(30, speed * 0.004 * f), 2)]);
  }
  // Remove chaves internas redundantes (trechos parados ou constantes).
  return keys.filter(
    (key, index) => index === 0 || index === keys.length - 1 || key[1] !== keys[index - 1][1] || key[1] !== keys[index + 1][1],
  );
}

/**
 * Movimentos rápidos extras (complementam `motionPreset` de mmfilmMotion.js):
 * - "motionblur": com `motion` do clipe, desfoque proporcional à velocidade; sem ele, um pico no meio.
 * - "escala": pulso de escala que volta ao normal no fim do clipe.
 * - "centralizar": leva `target` {x, y} (px da sequência, ex.: rosto) ou o centro do clipe (clip.x/y) ao centro.
 * - "speedramp": devolve null — rampa de velocidade altera o tempo da mídia (clip.speed é constante no
 *   modelo atual, ver clipMediaTime) e não cabe em curvas de transformação; precisa de suporte no player.
 */
export function quickMove(kind, duration, { intensity = 5, motion, target, clip } = {}) {
  const f = level(intensity);
  const end = round(duration);
  if (!(end > 0)) return null;
  switch (kind) {
    case "motionblur":
      if (motion) return { blur: motionBlurFrom(motion, end, f) };
      return { blur: [[0, 0, "ease"], [round(end / 2), round(8 * f, 2), "ease"], [end, 0]] };
    case "escala": {
      const amount = round(1 + 0.06 * f);
      return { scale: [[0, 1, "ease"], [round(end / 2), amount, "ease"], [end, 1]] };
    }
    case "centralizar": {
      if (!target && !clip) return null;
      const ramp = round(Math.min(end, 0.6));
      const offsetX = target ? 960 - target.x : 0 - (clip.x ?? 0);
      const offsetY = target ? 540 - target.y : 0 - (clip.y ?? 0);
      const keys = (value) => {
        const list = [[0, 0, "ease"], [ramp, round(value, 2)]];
        return ramp < end ? [...list, [end, round(value, 2)]] : list;
      };
      return { x: keys(offsetX), y: keys(offsetY) };
    }
    default:
      return null;
  }
}

const COLOR_FIELDS = ["exposure", "contrast", "saturation", "temperature", "tint", "highlights", "shadows", "whites", "blacks"];
export const STYLE_PARTS = {
  transform: ["scale", "x", "y", "rotation", "anchorX", "anchorY"],
  opacity: ["opacity"],
  color: COLOR_FIELDS,
  motion: ["motion"],
  effects: ["effects"],
  look: ["look"],
};

const copy = (value) => JSON.parse(JSON.stringify(value));

function retimeMotion(motion, factor) {
  return Object.fromEntries(
    Object.entries(motion).map(([channel, keys]) => [
      channel,
      Array.isArray(keys) ? keys.map(([time, ...rest]) => [round(time * factor), ...rest]) : keys,
    ]),
  );
}

/**
 * Clonar estilo: copia transformação, opacidade, cor (incluindo look), movimento e efeitos do clipe de origem
 * para cada destino. Campos ausentes na origem são removidos do destino (o destino fica igual à origem).
 * timing "relative" (padrão) escala os tempos das curvas pela duração do destino; "absolute" mantém os segundos.
 * Devolve novos objetos (não altera os recebidos); id, tempo, mídia e texto dos destinos são preservados.
 */
export function cloneStyle(source, targets, { parts = Object.keys(STYLE_PARTS), timing = "relative" } = {}) {
  if (!source || !Array.isArray(targets)) return targets || [];
  const fields = parts.flatMap((part) => STYLE_PARTS[part] || []);
  return targets.map((target) => {
    const next = { ...target };
    fields.forEach((field) => {
      if (source[field] === undefined) {
        delete next[field];
        return;
      }
      next[field] = copy(source[field]);
    });
    if (next.motion && fields.includes("motion") && timing === "relative" && source.duration > 0 && target.duration > 0) {
      next.motion = retimeMotion(next.motion, target.duration / source.duration);
    }
    return next;
  });
}
