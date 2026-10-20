// Ajustes automáticos de som do MMFilm: ducking (abaixa a música quando há voz), normalização e SFX automático.
import { clipEnd, keyValueAt, mergeRanges } from "./mmfilmEdits";

const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Curva de ganho (dB, tempo local) para um clipe de música: abaixa `reduction` dB durante cada trecho de voz,
 * começando `attack` s antes e voltando `release` s depois. Trechos próximos viram um só para não "bombear".
 */
export function duckingKeys(clip, segments, { reduction = -12, attack = 0.1, release = 0.3 } = {}) {
  const start = clip.start;
  const end = clipEnd(clip);
  const spans = mergeRanges(
    segments
      .map(([from, to]) => [from - attack, to + release])
      .filter(([from, to]) => to > start && from < end),
  );
  const keys = [];
  spans.forEach(([from, to]) => {
    const down0 = Math.max(start, from);
    const down1 = Math.max(down0, Math.min(end, from + attack));
    const up0 = Math.max(down1, Math.min(end, to - release));
    const up1 = Math.max(up0, Math.min(end, to));
    const points = [
      [down0, from >= start ? 0 : reduction],
      [down1, reduction],
      [up0, reduction],
      [up1, to <= end ? 0 : reduction],
    ];
    points.forEach(([time, db]) => {
      const local = round(time - start);
      const last = keys[keys.length - 1];
      if (last && Math.abs(last[0] - local) < 1e-3) last[1] = db;
      else keys.push([local, db]);
    });
  });
  return keys;
}

/** Ganho extra (dB) de uma curva no tempo local do clipe (0 sem curva). */
export const gainDbAt = (clip, local) => keyValueAt(clip.gainKeys, local, 0);

/**
 * Ganho de normalização em dB: leva o RMS dos trechos com som até `target` sem o pico passar de `peakMax`.
 * O volume do clipe no MMFilm vai até 200% (+6 dB); o retorno indica se o ganho foi limitado.
 */
export function normalizeGain({ rms, peak }, { target = -18, peakMax = -1, maxGain = 6.02 } = {}) {
  let gain = target - rms;
  let limited = null;
  if (peak + gain > peakMax) {
    gain = peakMax - peak;
    limited = "pico";
  }
  if (gain > maxGain) {
    gain = maxGain;
    limited = "volume máximo";
  }
  return { gain: round(gain, 2), limited };
}

/**
 * Pontos para efeitos sonoros: cortes entre takes (whoosh) e entrada de títulos (pop), respeitando
 * um espaço mínimo entre sons. Devolve [{ time, trigger }].
 */
export function sfxPoints(clips, { cuts = true, titles = true, minGap = 0.8, videoTracks = ["V1"] } = {}) {
  const points = [];
  if (cuts) {
    const takes = clips
      .filter((clip) => videoTracks.includes(clip.track) && clip.type !== "text/title" && !clip.sfx && clip.enabled !== false)
      .sort((a, b) => a.start - b.start);
    takes.forEach((take, index) => {
      if (index === 0 || take.start < 1e-3) return;
      const previous = takes[index - 1];
      if (Math.abs(clipEnd(previous) - take.start) < 0.05) points.push({ time: round(take.start), trigger: "corte" });
    });
  }
  if (titles) {
    clips
      .filter((clip) => clip.type === "text/title" && !clip.caption && clip.enabled !== false)
      .forEach((clip) => points.push({ time: round(clip.start), trigger: "texto" }));
  }
  const ordered = points.sort((a, b) => a.time - b.time);
  const kept = [];
  ordered.forEach((point) => {
    const last = kept[kept.length - 1];
    if (!last || point.time - last.time >= minGap) kept.push(point);
  });
  return kept;
}
