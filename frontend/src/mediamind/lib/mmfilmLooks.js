// Looks de cor e transições próprias do MMFilm (dados puros + matemática de quadro, sem assets de terceiros).
//
// Looks: deslocamentos sobre os campos de cor do clipe (exposure, contrast, saturation, temperature, tint,
// highlights, shadows, whites, blacks) + filtros extras (sepia, grayscale, hueRotate) + sobreposição de cor
// opcional { color, alpha, blend }. `applyLook` guarda em `clip.look` o que aplicou para poder trocar ou
// remover o look sem perder os ajustes manuais; intensidade 0 devolve a imagem original.
//
// Transições: `clip.transition = { id, duration }` no clipe que ENTRA (o nome legado em texto também é
// aceito). `transitionState` devolve o estado de cada camada; deslocamentos e recortes em px de 1920×1080.
import { seeded } from "./mmfilmMotion";

const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits + 0; // + 0 evita -0
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const SEQUENCE_WIDTH = 1920;
const SEQUENCE_HEIGHT = 1080;
const EPSILON = 1e-6;

// Valor neutro e faixa de cada campo de cor (as mesmas do painel de Controles de efeitos).
export const COLOR_FIELDS = {
  exposure: { neutral: 0, min: -80, max: 80 },
  contrast: { neutral: 100, min: 0, max: 200 },
  saturation: { neutral: 100, min: 0, max: 200 },
  temperature: { neutral: 0, min: -100, max: 100 },
  tint: { neutral: 0, min: -100, max: 100 },
  highlights: { neutral: 0, min: -100, max: 100 },
  shadows: { neutral: 0, min: -100, max: 100 },
  whites: { neutral: 0, min: -100, max: 100 },
  blacks: { neutral: 0, min: -100, max: 100 },
};

const look = (id, name, category, params, extra = {}) => ({ id, name, category, params, filters: extra.filters || {}, tint: extra.tint || null });

/** Catálogo próprio de looks: { id, name, category, params (deltas), filters, tint }. */
export const LOOKS = [
  look("cinema-quente", "Cinema quente", "Cinema", { contrast: 10, saturation: 5, temperature: 25, highlights: -5, shadows: -8 }, {
    filters: { sepia: 8 },
    tint: { color: "#ff9a3c", alpha: 0.08, blend: "soft-light" },
  }),
  look("ciano-laranja", "Ciano e laranja", "Cinema", { contrast: 15, saturation: 18, temperature: 8, tint: -6, shadows: -10 }, {
    tint: { color: "#0e7c86", alpha: 0.12, blend: "soft-light" },
  }),
  look("pb-contraste", "P&B contraste", "Preto e branco", { contrast: 35, saturation: -100, blacks: -15, whites: 10 }, {
    filters: { grayscale: 100 },
  }),
  look("pb-suave", "P&B suave", "Preto e branco", { contrast: -10, saturation: -100, shadows: 15 }, { filters: { grayscale: 100 } }),
  look("vintage", "Vintage", "Retrô", { contrast: -12, saturation: -25, temperature: 18, blacks: 20 }, {
    filters: { sepia: 30 },
    tint: { color: "#c8a165", alpha: 0.12, blend: "multiply" },
  }),
  look("sepia-antigo", "Sépia antigo", "Retrô", { contrast: -5, saturation: -60 }, { filters: { sepia: 80 } }),
  look("desbotado", "Desbotado", "Retrô", { contrast: -25, saturation: -40, blacks: 30 }),
  look("frio-noturno", "Frio noturno", "Clima", { exposure: -8, contrast: 8, saturation: -10, temperature: -35 }, {
    tint: { color: "#2f5fa8", alpha: 0.14, blend: "soft-light" },
  }),
  look("dourado", "Hora dourada", "Clima", { temperature: 40, saturation: 10, highlights: 10 }, {
    filters: { sepia: 15 },
    tint: { color: "#f5b041", alpha: 0.1, blend: "soft-light" },
  }),
  look("por-do-sol", "Pôr do sol", "Clima", { temperature: 30, tint: 12, saturation: 15 }, {
    tint: { color: "#ff5e62", alpha: 0.1, blend: "soft-light" },
  }),
  look("verde-floresta", "Verde floresta", "Clima", { saturation: 10, tint: -25, temperature: -5 }, {
    filters: { hueRotate: -6 },
    tint: { color: "#2e7d32", alpha: 0.08, blend: "soft-light" },
  }),
  look("sombrio", "Sombrio", "Drama", { exposure: -15, contrast: 18, saturation: -20, shadows: -20 }, {
    tint: { color: "#0b1d2a", alpha: 0.15, blend: "multiply" },
  }),
  look("alto-contraste", "Alto contraste", "Drama", { contrast: 40, whites: 10, blacks: -20 }),
  look("cinza-azulado", "Cinza azulado", "Drama", { contrast: 22, saturation: -45 }, {
    tint: { color: "#9fb4c7", alpha: 0.08, blend: "soft-light" },
  }),
  look("pastel", "Pastel", "Suave", { exposure: 8, contrast: -20, saturation: -30, blacks: 25 }, {
    tint: { color: "#ffd6e8", alpha: 0.1, blend: "screen" },
  }),
  look("vivo", "Vivo", "Suave", { contrast: 12, saturation: 35 }),
  look("neon", "Neon", "Estilizado", { contrast: 20, saturation: 45, tint: 15 }, {
    filters: { hueRotate: 10 },
    tint: { color: "#c026d3", alpha: 0.1, blend: "overlay" },
  }),
];

export function findLook(value) {
  if (value && typeof value === "object") return value.params ? value : null;
  return LOOKS.find((item) => item.id === value) || null;
}

/** Remove o look aplicado (desfaz exatamente os deslocamentos gravados), mantendo ajustes manuais. */
export function removeLook(clip) {
  if (!clip?.look) return clip;
  const next = { ...clip };
  Object.entries(clip.look.applied || {}).forEach(([field, delta]) => {
    next[field] = round((next[field] ?? COLOR_FIELDS[field].neutral) - delta);
  });
  delete next.look;
  return next;
}

/** Aplica um look (objeto ou id) com intensidade 0–100; `look` nulo apenas remove o atual. */
export function applyLook(clip, lookOrId, intensity = 100) {
  const base = removeLook(clip);
  const chosen = findLook(lookOrId);
  if (!chosen) return base;
  const k = clamp(Number(intensity) || 0, 0, 100) / 100;
  const next = { ...base };
  const applied = {};
  Object.entries(chosen.params).forEach(([field, delta]) => {
    const range = COLOR_FIELDS[field];
    if (!range) return;
    const before = next[field] ?? range.neutral;
    const after = round(clamp(before + delta * k, range.min, range.max));
    next[field] = after;
    applied[field] = round(after - before);
  });
  const filters = Object.fromEntries(Object.entries(chosen.filters).map(([name, value]) => [name, round(value * k)]));
  next.look = {
    id: chosen.id,
    intensity: round(k * 100),
    applied,
    filters,
    tint: chosen.tint ? { ...chosen.tint, alpha: round(chosen.tint.alpha * k) } : null,
  };
  return next;
}

/**
 * Filtro CSS/canvas do clipe. Começa exatamente como o layerFilter atual
 * (brightness(100+exposure)% contrast saturate) e só acrescenta termos quando os campos extras não são neutros.
 */
// Interruptores do painel Cor Lumetri: `colorBypass.basic` desliga a Correção básica (exposição, contraste,
// saturação, realces, sombras, brancos, pretos, temperatura e matiz) e `colorBypass.creative` desliga o look
// (filtros e cor do look). Os valores continuam gravados no clipe; só deixam de ser aplicados.
const basicOff = (clip) => Boolean(clip?.colorBypass?.basic);
const creativeOff = (clip) => Boolean(clip?.colorBypass?.creative);
/** Valor efetivo de um campo de cor (neutro quando a Correção básica está desligada). */
export function colorValue(clip, field) {
  return basicOff(clip) ? COLOR_FIELDS[field].neutral : (clip?.[field] ?? COLOR_FIELDS[field].neutral);
}

export function lookFilter(clip) {
  const value = (field) => colorValue(clip, field);
  const parts = [
    `brightness(${100 + value("exposure")}%) contrast(${value("contrast")}%) saturate(${value("saturation")}%)`,
  ];
  const lift = value("highlights") * 0.15 + value("whites") * 0.1;
  if (lift) parts.push(`brightness(${round(100 + lift, 2)}%)`);
  const flatten = value("shadows") * 0.15 + value("blacks") * 0.1;
  if (flatten) parts.push(`contrast(${round(100 - flatten, 2)}%)`);
  const filters = (!creativeOff(clip) && clip?.look?.filters) || {};
  if (filters.grayscale) parts.push(`grayscale(${filters.grayscale}%)`);
  if (filters.sepia) parts.push(`sepia(${filters.sepia}%)`);
  if (filters.hueRotate) parts.push(`hue-rotate(${filters.hueRotate}deg)`);
  return parts.join(" ");
}

/**
 * Sobreposições de cor do clipe, na ordem de desenho: temperatura (laranja/azul), matiz (magenta/verde) e
 * a cor do look. Cada uma { color, alpha, blend } com blend válido para globalCompositeOperation e mix-blend-mode.
 */
export function lookOverlays(clip) {
  const overlays = [];
  const temperature = colorValue(clip, "temperature");
  if (temperature) {
    overlays.push({ color: temperature > 0 ? "#ff8a00" : "#0066ff", alpha: round((Math.abs(temperature) / 100) * 0.15), blend: "soft-light" });
  }
  const tint = colorValue(clip, "tint");
  if (tint) overlays.push({ color: tint > 0 ? "#ff00ff" : "#00ff66", alpha: round((Math.abs(tint) / 100) * 0.12), blend: "soft-light" });
  const overlay = creativeOff(clip) ? null : clip?.look?.tint;
  if (overlay && overlay.alpha > 0) overlays.push({ ...overlay });
  return overlays;
}

/** Desenha as sobreposições de cor sobre a área atual (chamar depois de desenhar a camada, ainda no clip). */
export function drawLookOverlays(context, clip, width, height) {
  lookOverlays(clip).forEach((overlay) => {
    context.save();
    context.globalCompositeOperation = overlay.blend;
    context.globalAlpha = (context.globalAlpha ?? 1) * overlay.alpha;
    context.filter = "none";
    context.fillStyle = overlay.color;
    context.fillRect(0, 0, width, height);
    context.restore();
  });
}

/** Estilos React das sobreposições para a prévia (divs absolutas sobre o vídeo). */
export function overlayStyles(clip) {
  return lookOverlays(clip).map((overlay) => ({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundColor: overlay.color,
    opacity: overlay.alpha,
    mixBlendMode: overlay.blend,
  }));
}

// ---------------------------------------------------------------- Transições

const transition = (id, name, category, duration = 0.5) => ({ id, name, category, duration });

/** Catálogo próprio de transições: { id, name, category, duration (s, padrão) }. */
export const TRANSITIONS = [
  transition("dissolver", "Dissolver", "Dissolver"),
  transition("dissolver-filme", "Dissolver suave", "Dissolver", 0.8),
  transition("mergulho-preto", "Mergulho no preto", "Mergulho", 0.8),
  transition("mergulho-branco", "Mergulho no branco", "Mergulho", 0.8),
  transition("deslizar-esquerda", "Deslizar para a esquerda", "Deslizar"),
  transition("deslizar-direita", "Deslizar para a direita", "Deslizar"),
  transition("deslizar-cima", "Deslizar para cima", "Deslizar"),
  transition("deslizar-baixo", "Deslizar para baixo", "Deslizar"),
  transition("empurrar-esquerda", "Empurrar para a esquerda", "Empurrar"),
  transition("empurrar-direita", "Empurrar para a direita", "Empurrar"),
  transition("zoom-entrar", "Zoom entrando", "Zoom"),
  transition("zoom-sair", "Zoom saindo", "Zoom"),
  transition("desfoque", "Desfoque cruzado", "Desfoque", 0.6),
  transition("wipe-linear", "Cortina linear", "Cortina"),
  transition("circulo", "Círculo abrindo", "Cortina", 0.6),
  transition("glitch", "Glitch", "Glitch", 0.4),
];

// Nomes antigos gravados como texto em clip.transition pelo editor.
const LEGACY_TRANSITIONS = {
  Dissolver: "dissolver",
  "Film Dissolve": "dissolver-filme",
  "Dip to Black": "mergulho-preto",
  "Dip to White": "mergulho-branco",
};

/** Resolve id, nome legado ou { id, duration } para { ...transição do catálogo, duration }. */
export function resolveTransition(value) {
  if (!value) return null;
  const id = typeof value === "string" ? LEGACY_TRANSITIONS[value] || value : value.id;
  const found = TRANSITIONS.find((item) => item.id === id);
  if (!found) return null;
  const duration = typeof value === "object" && Number(value.duration) > 0 ? Number(value.duration) : found.duration;
  return { ...found, duration };
}

const layer = (values = {}) => ({ opacity: 1, dx: 0, dy: 0, scale: 1, blur: 0, glitch: 0, clip: null, ...values });

const SLIDES = {
  "deslizar-esquerda": [SEQUENCE_WIDTH, 0],
  "deslizar-direita": [-SEQUENCE_WIDTH, 0],
  "deslizar-cima": [0, SEQUENCE_HEIGHT],
  "deslizar-baixo": [0, -SEQUENCE_HEIGHT],
};

/**
 * Estado das duas camadas num ponto `progress` (0–1) da transição:
 * { outgoing: camada, incoming: camada, overlay?: { color, alpha } }, camada = { opacity, dx, dy, scale, blur, glitch, clip }.
 * `clip` recorta a camada: { shape: "rect", x, y, width, height } ou { shape: "circle", cx, cy, r }.
 * A camada que sai é desenhada primeiro (embaixo).
 */
export function transitionState(value, progress, { seed = 0 } = {}) {
  const p = clamp(Number(progress) || 0, 0, 1);
  const e = easeInOut(p);
  const found = resolveTransition(value);
  const id = found?.id;
  if (SLIDES[id]) {
    const [x, y] = SLIDES[id];
    return { outgoing: layer(), incoming: layer({ dx: round(x * (1 - e), 2), dy: round(y * (1 - e), 2) }) };
  }
  switch (id) {
    case "dissolver":
      return { outgoing: layer(), incoming: layer({ opacity: round(p) }) };
    case "dissolver-filme":
      return { outgoing: layer(), incoming: layer({ opacity: round(e) }) };
    case "mergulho-preto":
    case "mergulho-branco": {
      const color = id === "mergulho-preto" ? "#000" : "#fff";
      const first = p < 0.5;
      return {
        outgoing: layer({ opacity: first ? 1 : 0 }),
        incoming: layer({ opacity: first ? 0 : 1 }),
        overlay: { color, alpha: round(first ? p * 2 : (1 - p) * 2) },
      };
    }
    case "empurrar-esquerda":
    case "empurrar-direita": {
      const sign = id === "empurrar-esquerda" ? -1 : 1;
      return {
        outgoing: layer({ dx: round(sign * SEQUENCE_WIDTH * e, 2) }),
        incoming: layer({ dx: round(-sign * SEQUENCE_WIDTH * (1 - e), 2) }),
      };
    }
    case "zoom-entrar":
      return {
        outgoing: layer({ scale: round(1 + 0.5 * e), opacity: round(1 - e) }),
        incoming: layer({ scale: round(0.8 + 0.2 * e), opacity: round(e) }),
      };
    case "zoom-sair":
      return {
        outgoing: layer({ scale: round(1 - 0.3 * e), opacity: round(1 - e) }),
        incoming: layer({ scale: round(1.3 - 0.3 * e), opacity: round(e) }),
      };
    case "desfoque":
      return {
        outgoing: layer({ blur: round(30 * e, 2) }),
        incoming: layer({ blur: round(30 * (1 - e), 2), opacity: round(e) }),
      };
    case "wipe-linear":
      return {
        outgoing: layer(),
        incoming: layer({ clip: { shape: "rect", x: 0, y: 0, width: round(SEQUENCE_WIDTH * p, 2), height: SEQUENCE_HEIGHT } }),
      };
    case "circulo":
      return {
        outgoing: layer(),
        incoming: layer({
          clip: { shape: "circle", cx: SEQUENCE_WIDTH / 2, cy: SEQUENCE_HEIGHT / 2, r: round(Math.hypot(960, 540) * e, 2) },
        }),
      };
    case "glitch": {
      const step = Math.floor(p * 12);
      const amount = round(Math.sin(Math.PI * p));
      const shift = round((seeded(step, seed) - 0.5) * 80 * amount, 2);
      const showIncoming = p >= 1 || (p > 0 && seeded(step, seed + 1) < p);
      return {
        outgoing: layer({ dx: shift, glitch: amount }),
        incoming: layer({ dx: 0 - shift, glitch: amount, opacity: showIncoming ? 1 : 0 }),
      };
    }
    default:
      // Sem transição conhecida: corte seco no meio.
      return { outgoing: layer({ opacity: p < 0.5 ? 1 : 0 }), incoming: layer({ opacity: p < 0.5 ? 0 : 1 }) };
  }
}

/**
 * Janelas de transição entre clipes encostados na mesma faixa. A transição fica no clipe que entra; a duração
 * é limitada pelos dois clipes. align: "center" (padrão, metade antes e metade depois do corte), "start"
 * (começa no corte) ou "end" (termina no corte). Devolve [{ from, to, cut, track, outgoingId, incomingId, transition }].
 */
export function transitionWindows(clips = [], { track, align = "center" } = {}) {
  const byTrack = new Map();
  clips
    .filter((clip) => clip && (track === undefined || clip.track === track) && clip.enabled !== false)
    .forEach((clip) => byTrack.set(clip.track, [...(byTrack.get(clip.track) || []), clip]));
  const windows = [];
  byTrack.forEach((list, trackId) => {
    const ordered = [...list].sort((a, b) => a.start - b.start);
    ordered.slice(1).forEach((incoming, index) => {
      const outgoing = ordered[index];
      const resolved = resolveTransition(incoming.transition);
      const cut = incoming.start;
      if (!resolved || Math.abs(outgoing.start + outgoing.duration - cut) > EPSILON) return;
      const duration = round(Math.min(resolved.duration, outgoing.duration, incoming.duration));
      const from = align === "start" ? cut : align === "end" ? cut - duration : cut - duration / 2;
      windows.push({
        from: round(from),
        to: round(from + duration),
        cut,
        track: trackId,
        outgoingId: outgoing.id,
        incomingId: incoming.id,
        transition: { ...resolved, duration },
      });
    });
  });
  return windows.sort((a, b) => a.from - b.from);
}

/** Progresso (0–1) de uma janela no tempo da timeline. */
export const transitionProgress = (window, time) =>
  clamp((time - window.from) / Math.max(EPSILON, window.to - window.from), 0, 1);

/**
 * Desenha um quadro de transição: aplica o estado de cada camada (opacidade, desfoque, deslocamento, escala
 * em torno do centro e recorte) e chama `draw(layer, layerState)` — que deve multiplicar seu próprio alpha por
 * context.globalAlpha em vez de sobrescrevê-lo. Depois desenha a sobreposição (mergulho no preto/branco).
 */
export function drawTransitionFrame(context, { outgoing, incoming, state, draw, width = SEQUENCE_WIDTH, height = SEQUENCE_HEIGHT }) {
  const sx = width / SEQUENCE_WIDTH;
  const sy = height / SEQUENCE_HEIGHT;
  [
    [outgoing, state.outgoing],
    [incoming, state.incoming],
  ].forEach(([item, values]) => {
    if (!item || !values || values.opacity <= 0) return;
    context.save();
    context.globalAlpha = (context.globalAlpha ?? 1) * values.opacity;
    if (values.blur > 0) context.filter = `blur(${round(values.blur * sx, 2)}px)`;
    context.translate(width / 2 + values.dx * sx, height / 2 + values.dy * sy);
    if (values.scale !== 1) context.scale(values.scale, values.scale);
    context.translate(-width / 2, -height / 2);
    if (values.clip) {
      context.beginPath();
      if (values.clip.shape === "circle") context.arc(values.clip.cx * sx, values.clip.cy * sy, values.clip.r * sx, 0, Math.PI * 2);
      else context.rect(values.clip.x * sx, values.clip.y * sy, values.clip.width * sx, values.clip.height * sy);
      context.clip();
    }
    draw(item, values);
    context.restore();
  });
  if (state.overlay && state.overlay.alpha > 0) {
    context.save();
    context.globalAlpha = state.overlay.alpha;
    context.filter = "none";
    context.fillStyle = state.overlay.color;
    context.fillRect(0, 0, width, height);
    context.restore();
  }
}
