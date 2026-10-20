// Movimentos de câmera do MMFilm (zoom, punch in, shake, pan, rotação) como curvas no tempo do clipe.
// `clip.motion` guarda deslocamentos relativos aos valores do clipe: scale é um fator (1 = sem mudança),
// x/y em pixels da sequência 1920×1080 e rotation em graus. Preview e exportação usam `animatedClip`.
import { keyValueAt } from "./mmfilmEdits";

const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Clipe com os valores do movimento aplicados no tempo da timeline `time`. */
export function animatedClip(clip, time) {
  const motion = clip?.motion;
  if (!motion) return clip;
  const local = Math.max(0, Math.min(clip.duration, time - clip.start));
  return {
    ...clip,
    scale: (clip.scale ?? 100) * keyValueAt(motion.scale, local, 1),
    x: (clip.x ?? 0) + keyValueAt(motion.x, local, 0),
    y: (clip.y ?? 0) + keyValueAt(motion.y, local, 0),
    rotation: (clip.rotation ?? 0) + keyValueAt(motion.rotation, local, 0),
  };
}

// Variação determinística (mesma entrada, mesmo resultado) para não repetir sempre o mesmo valor.
export function seeded(index, salt = 0) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const level = (intensity) => Math.max(1, Math.min(10, Number(intensity) || 5)) / 5;

/** Curvas de um movimento rápido para um clipe de duração `duration`. */
export function motionPreset(kind, duration, { intensity = 5, direction = "in", seed = 0 } = {}) {
  const f = level(intensity);
  const end = round(duration);
  switch (kind) {
    case "punch": {
      const amount = round(1 + 0.15 * f);
      // "in": o take inteiro aproximado; "out": aproximado na primeira metade e volta ao normal no meio.
      return {
        scale:
          direction === "out"
            ? [[0, amount, "hold"], [round(end / 2), 1, "hold"], [end, 1]]
            : [[0, amount, "hold"], [end, amount]],
      };
    }
    case "zoom": {
      const amount = round(1 + 0.1 * f);
      return direction === "out"
        ? { scale: [[0, amount, "ease"], [end, 1]] }
        : { scale: [[0, 1, "ease"], [end, amount]] };
    }
    case "shake": {
      const length = Math.min(duration, 0.5);
      const steps = Math.max(2, Math.round(length * 30));
      const x = [];
      const y = [];
      const rotation = [];
      for (let step = 0; step <= steps; step += 1) {
        const time = round((step / steps) * length);
        const decay = 1 - step / steps;
        x.push([time, round((seeded(step, seed) - 0.5) * 36 * f * decay, 2)]);
        y.push([time, round((seeded(step, seed + 7) - 0.5) * 24 * f * decay, 2)]);
        rotation.push([time, round((seeded(step, seed + 13) - 0.5) * 2 * f * decay, 3)]);
      }
      return { x, y, rotation, scale: [[0, round(1 + 0.04 * f)], [end, round(1 + 0.04 * f)]] };
    }
    case "pan": {
      const travel = round(60 * f, 2);
      const sign = direction === "left" ? -1 : 1;
      return {
        x: [[0, -sign * travel, "ease"], [end, sign * travel]],
        scale: [[0, round(1 + 0.08 * f)], [end, round(1 + 0.08 * f)]],
      };
    }
    case "rotate": {
      const angle = round(3 * f, 3);
      return {
        rotation: [[0, -angle, "ease"], [end, angle]],
        scale: [[0, round(1 + 0.08 * f)], [end, round(1 + 0.08 * f)]],
      };
    }
    default:
      return null;
  }
}

const ZOOM_EVERY = { poucos: 4, medio: 3, muitos: 2 };
const ZOOM_STYLE = {
  rapido: { min: 0.12, max: 0.18, ramp: 0.25 },
  medio: { min: 0.08, max: 0.13, ramp: 0.7 },
  suave: { min: 0.05, max: 0.09, ramp: null },
};

/**
 * Zoom automático: escolhe takes espaçados (nunca dois seguidos), alterna cerca de 1/3 como "afastar"
 * e aplica rampas conforme o estilo. Devolve [{ id, motion, kind }] para os clipes escolhidos.
 */
export function autoZoomPlan(takes, { amount = "medio", style = "medio", zoomOut = true } = {}) {
  const every = ZOOM_EVERY[amount] || 3;
  const shape = ZOOM_STYLE[style] || ZOOM_STYLE.medio;
  const plan = [];
  let lastIndex = -Infinity;
  takes.forEach((take, index) => {
    if (take.duration < 1 || index - lastIndex < 2 || (index + 1) % every !== 0) return;
    lastIndex = index;
    const amountFactor = round(1 + shape.min + seeded(index, 3) * (shape.max - shape.min));
    const out = zoomOut && plan.length % 3 === 2;
    const end = round(take.duration);
    const ramp = shape.ramp ? round(Math.min(shape.ramp, take.duration / 2)) : end;
    const scale = out
      ? [[0, amountFactor, "ease"], [ramp, 1]]
      : [[0, 1, "ease"], [ramp, amountFactor]];
    if (ramp < end) scale.push([end, scale[1][1]]);
    plan.push({ id: take.id, kind: out ? "afastar" : "aproximar", motion: { scale } });
  });
  return plan;
}
