// Análise de áudio da timeline do MMFilm (sem IA): envelope RMS em dBFS por janela de 10 ms,
// limiar automático entre o ruído de fundo e a fala, silêncios, pausas e trechos de voz.
import { clipEnd, speedFactor } from "./mmfilmEdits";

export const WINDOW_SECONDS = 0.01;
export const FLOOR_DB = -100;

function audible(clip) {
  return (
    clip.enabled !== false &&
    !clip.offline &&
    Boolean(clip.url) &&
    (clip.type?.startsWith("audio") || clip.type?.startsWith("video"))
  );
}

/** Clipes com som nas faixas pedidas (A1–A3 e o som dos vídeos em V1–V3). */
export function audibleClips(clips, tracks) {
  return clips.filter((clip) => tracks.includes(clip.track) && audible(clip));
}

/**
 * Envelope de energia da timeline em [from, to]: soma das potências dos clipes que tocam em cada janela.
 * `buffers` mapeia a URL da mídia para um AudioBuffer (getChannelData, sampleRate, numberOfChannels).
 */
export function timelineEnvelope({ clips, buffers, from = 0, to, windowSeconds = WINDOW_SECONDS, useVolume = true }) {
  const end = to ?? clips.reduce((value, clip) => Math.max(value, clipEnd(clip)), 0);
  const count = Math.max(0, Math.ceil((end - from) / windowSeconds));
  const power = new Float64Array(count);
  clips.forEach((clip) => {
    const buffer = buffers.get(clip.url);
    if (!buffer) return;
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    const rate = buffer.sampleRate;
    const gain = useVolume ? (clip.volume ?? 100) / 100 : 1;
    const first = Math.max(0, Math.floor((clip.start - from) / windowSeconds));
    const last = Math.min(count, Math.ceil((clipEnd(clip) - from) / windowSeconds));
    for (let index = first; index < last; index += 1) {
      const t0 = Math.max(clip.start, from + index * windowSeconds);
      const t1 = Math.min(clipEnd(clip), from + (index + 1) * windowSeconds);
      if (t1 <= t0) continue;
      const s0 = Math.floor(((clip.sourceIn || 0) + (t0 - clip.start) * speedFactor(clip)) * rate);
      const s1 = Math.min(buffer.length, Math.ceil(((clip.sourceIn || 0) + (t1 - clip.start) * speedFactor(clip)) * rate));
      if (s1 <= s0) continue;
      let sum = 0;
      channels.forEach((data) => {
        for (let sample = s0; sample < s1; sample += 1) sum += data[sample] * data[sample];
      });
      power[index] += (sum / ((s1 - s0) * channels.length)) * gain * gain;
    }
  });
  const db = Float32Array.from(power, (value) => (value > 0 ? Math.max(FLOOR_DB, 10 * Math.log10(value)) : FLOOR_DB));
  return { from, windowSeconds, db };
}

function percentile(sorted, fraction) {
  if (!sorted.length) return FLOOR_DB;
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)))];
}

/**
 * Limiar automático: ponto entre o ruído de fundo (percentil 10) e o nível da fala (percentil 90).
 * Sensibilidade 1–10: quanto maior, mais alto o limiar e mais trechos contam como silêncio.
 */
export function autoThreshold(db, sensitivity = 5) {
  const sorted = Array.from(db).sort((a, b) => a - b);
  const floor = percentile(sorted, 0.1);
  const speech = percentile(sorted, 0.9);
  const level = Math.max(1, Math.min(10, Number(sensitivity) || 5));
  const k = 0.08 + ((level - 1) / 9) * 0.42;
  const threshold = Math.max(-70, Math.min(-12, floor + k * (speech - floor)));
  return { threshold, floor, speech };
}

// Trechos contínuos abaixo do limiar; estalos curtos (< 60 ms) dentro de um silêncio não o interrompem.
function quietRuns(envelope, threshold) {
  const { db, from, windowSeconds } = envelope;
  const bridge = Math.round(0.06 / windowSeconds);
  const quiet = Array.from(db, (value) => value < threshold);
  let index = 0;
  while (index < quiet.length) {
    if (quiet[index]) {
      index += 1;
      continue;
    }
    let stop = index;
    while (stop < quiet.length && !quiet[stop]) stop += 1;
    if (index > 0 && stop < quiet.length && stop - index <= bridge) quiet.fill(true, index, stop);
    index = stop;
  }
  const runs = [];
  index = 0;
  while (index < quiet.length) {
    if (!quiet[index]) {
      index += 1;
      continue;
    }
    let stop = index;
    while (stop < quiet.length && quiet[stop]) stop += 1;
    runs.push([from + index * windowSeconds, from + stop * windowSeconds]);
    index = stop;
  }
  return runs;
}

/**
 * Silêncios a remover. As margens mantêm um respiro: `padAfter` depois do fim da fala e `padBefore`
 * antes de a fala voltar. Trechos que ficariam menores que 0,1 s são ignorados.
 */
export function detectSilences(envelope, { threshold, minSilence = 0.5, padBefore = 0.12, padAfter = 0.15 }) {
  const end = envelope.from + envelope.db.length * envelope.windowSeconds;
  return quietRuns(envelope, threshold)
    .filter(([start, stop]) => stop - start >= minSilence)
    .map(([start, stop]) => [
      start <= envelope.from + 1e-9 ? start : start + padAfter,
      stop >= end - 1e-9 ? stop : stop - padBefore,
    ])
    .filter(([start, stop]) => stop - start >= 0.1);
}

/** Pontos de corte no meio das pausas, sem criar pedaços menores que `minClip`. */
export function detectPauses(envelope, { threshold, minPause = 0.25, minClip = 1.5 }) {
  const end = envelope.from + envelope.db.length * envelope.windowSeconds;
  const cuts = [];
  let previous = envelope.from;
  quietRuns(envelope, threshold)
    .filter(([start, stop]) => stop - start >= minPause && start > envelope.from + 1e-9 && stop < end - 1e-9)
    .forEach(([start, stop]) => {
      const time = Math.round(((start + stop) / 2) * 1000) / 1000;
      if (time - previous >= minClip && end - time >= minClip) {
        cuts.push(time);
        previous = time;
      }
    });
  return cuts;
}

/** Trechos com voz (acima do limiar), unindo intervalos menores que `mergeGap`. */
export function voiceSegments(envelope, { threshold, mergeGap = 0.6, minLength = 0.15 }) {
  const { db, from, windowSeconds } = envelope;
  const segments = [];
  let index = 0;
  while (index < db.length) {
    if (db[index] < threshold) {
      index += 1;
      continue;
    }
    let stop = index;
    while (stop < db.length && db[stop] >= threshold) stop += 1;
    const segment = [from + index * windowSeconds, from + stop * windowSeconds];
    const last = segments[segments.length - 1];
    if (last && segment[0] - last[1] < mergeGap) last[1] = segment[1];
    else segments.push(segment);
    index = stop;
  }
  return segments.filter(([start, stop]) => stop - start >= minLength);
}

/** Nível de um clipe sem o volume atual: RMS dos trechos com som (porta relativa de −20 dB) e pico. */
export function clipLevels(clip, buffer) {
  const envelope = timelineEnvelope({ clips: [clip], buffers: new Map([[clip.url, buffer]]), from: clip.start, to: clipEnd(clip), useVolume: false });
  const values = Array.from(envelope.db).filter((value) => value > FLOOR_DB);
  if (!values.length) return null;
  const loudest = Math.max(...values);
  const active = values.filter((value) => value >= loudest - 20);
  const rms = 10 * Math.log10(active.reduce((sum, value) => sum + 10 ** (value / 10), 0) / active.length);
  const rate = buffer.sampleRate;
  const s0 = Math.floor((clip.sourceIn || 0) * rate);
  const s1 = Math.min(buffer.length, Math.ceil(((clip.sourceIn || 0) + clip.duration * speedFactor(clip)) * rate));
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let sample = s0; sample < s1; sample += 1) peak = Math.max(peak, Math.abs(data[sample]));
  }
  return { rms, peak: peak > 0 ? 20 * Math.log10(peak) : FLOOR_DB };
}
