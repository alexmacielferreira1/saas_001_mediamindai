// Sincronização de câmeras e áudios do MMFilm pela forma de onda, toda no navegador e sem bibliotecas.
// Convenção de atraso usada em todo o arquivo: `lag` positivo significa que o mesmo som aparece
// `lag` depois em B do que em A, ou seja, b[i + lag] ≈ a[i].
//
// Passos: envelope de "onset" (subidas de energia a cada 10 ms, robusto a eco e a microfones diferentes)
// → correlação cruzada normalizada para o atraso grosso → correlação das amostras em ±50 ms para ~1 amostra
// → plano de deslocamentos por fonte, com sincronização em cadeia quando não há som em comum com a referência.

export const HOP_SECONDS = 0.01;
const LOG_FLOOR = 1e-10;

/**
 * Limiares da confiança. `strength` é a significância do pico, r·√(quadros em comum) (r = correlação
 * normalizada), e `distinct` é (pico − melhor candidato fora da vizinhança) / pico (0 a 1): quanto o pico se
 * destaca dos outros atrasos. Em fontes sem relação, a significância por acaso ficou abaixo de ~8 nos testes
 * sintéticos; o mesmo som com 5 s em comum dá ~22.
 * - alta: strength ≥ 15 e distinct ≥ 0,4
 * - media: strength ≥ 10 e distinct ≥ 0,25
 * - baixa: o resto (tratada como "não achou o mesmo som"; o plano tenta a cadeia)
 */
export const CONFIDENCE_THRESHOLDS = {
  alta: { strength: 15, distinct: 0.4 },
  media: { strength: 10, distinct: 0.25 },
};

export function confidenceLabel(strength, distinct) {
  const { alta, media } = CONFIDENCE_THRESHOLDS;
  if (strength >= alta.strength && distinct >= alta.distinct) return "alta";
  if (strength >= media.strength && distinct >= media.distinct) return "media";
  return "baixa";
}

// Média dos canais em um Float32Array.
function monoSamples(buffer) {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < buffer.length; index += 1) mono[index] += data[index] / buffer.numberOfChannels;
  }
  return mono;
}

/**
 * Força de onset a cada `hop` segundos no trecho [from, from + duration] do buffer (tempo da mídia):
 * log da energia média por janela, diferença positiva com a janela anterior e normalização
 * (média zero, variância um). Sinal sem variação devolve zeros.
 */
export function onsetEnvelope(buffer, { from = 0, duration, hop = HOP_SECONDS } = {}) {
  const rate = buffer.sampleRate;
  const total = duration ?? buffer.length / rate - from;
  const count = Math.max(0, Math.floor(total / hop + 1e-9));
  const mono = monoSamples(buffer);
  const energy = new Float32Array(count);
  for (let frame = 0; frame < count; frame += 1) {
    const s0 = Math.max(0, Math.round((from + frame * hop) * rate));
    const s1 = Math.min(buffer.length, Math.round((from + (frame + 1) * hop) * rate));
    let sum = 0;
    for (let sample = s0; sample < s1; sample += 1) sum += mono[sample] * mono[sample];
    energy[frame] = Math.log(s1 > s0 ? sum / (s1 - s0) + LOG_FLOOR : LOG_FLOOR);
  }
  const onset = new Float32Array(count);
  for (let frame = 1; frame < count; frame += 1) onset[frame] = Math.max(0, energy[frame] - energy[frame - 1]);
  let mean = 0;
  onset.forEach((value) => {
    mean += value / Math.max(1, count);
  });
  let variance = 0;
  onset.forEach((value) => {
    variance += (value - mean) ** 2 / Math.max(1, count);
  });
  const deviation = Math.sqrt(variance);
  if (deviation < 1e-9) return onset.fill(0);
  return onset.map((value) => (value - mean) / deviation);
}

function squaredPrefix(values) {
  const prefix = new Float64Array(values.length + 1);
  for (let index = 0; index < values.length; index += 1) prefix[index + 1] = prefix[index] + values[index] * values[index];
  return prefix;
}

/**
 * Correlação cruzada direta (O(n · atrasos)) entre dois envelopes, normalizada pela energia do trecho em comum.
 * Atrasos com menos de `minOverlap` quadros em comum são ignorados (padrão: 200 quadros = 2 s, ou o menor envelope).
 * O pico é escolhido pela significância r·√(quadros em comum): sem isso, atrasos com pouco trecho em comum
 * (bordas) dão correlações altas por acaso. `distinct` compara essa significância no pico com a do melhor
 * candidato fora da vizinhança (`neighbourhood` quadros); `score` é a correlação r no pico.
 * Devolve { lag (quadros de B em relação a A), score, strength, distinct, confidence }.
 */
export function crossCorrelate(a, b, maxLagFrames = a.length + b.length, { minOverlap = 200, neighbourhood = 5 } = {}) {
  const na = a.length;
  const nb = b.length;
  if (!na || !nb) return { lag: 0, score: 0, strength: 0, distinct: 0, confidence: "baixa" };
  const need = Math.max(1, Math.min(minOverlap, na, nb));
  const maxLag = Math.min(Math.max(0, Math.floor(maxLagFrames)), na + nb);
  const pa = squaredPrefix(a);
  const pb = squaredPrefix(b);
  const scores = new Float64Array(2 * maxLag + 1);
  const strength = new Float64Array(2 * maxLag + 1).fill(-Infinity);
  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    const i0 = Math.max(0, -lag);
    const i1 = Math.min(na, nb - lag);
    if (i1 - i0 < need) continue;
    let sum = 0;
    for (let index = i0; index < i1; index += 1) sum += a[index] * b[index + lag];
    const energy = Math.sqrt((pa[i1] - pa[i0]) * (pb[i1 + lag] - pb[i0 + lag]));
    scores[lag + maxLag] = energy > 0 ? sum / energy : 0;
    strength[lag + maxLag] = scores[lag + maxLag] * Math.sqrt(i1 - i0);
  }
  let best = maxLag;
  strength.forEach((value, index) => {
    if (value > strength[best]) best = index;
  });
  let second = 0;
  strength.forEach((value, index) => {
    if (Math.abs(index - best) > neighbourhood) second = Math.max(second, value);
  });
  const score = scores[best];
  const significance = strength[best];
  const distinct = score > 0 ? (significance - second) / significance : 0;
  return { lag: best - maxLag, score, strength: significance, distinct, confidence: confidenceLabel(significance, distinct) };
}

/**
 * Refina um atraso grosso (segundos, tempo da mídia: B(t + lag) ≈ A(t)) correlacionando as amostras
 * de um trecho curto (o de maior energia, até `excerpt` segundos) em ±`window` segundos, com interpolação
 * parabólica do pico. Sem trecho em comum, devolve o atraso grosso.
 */
export function refineLag(bufferA, bufferB, coarseSeconds, { window = 0.05, excerpt = 1 } = {}) {
  const rateA = bufferA.sampleRate;
  const rateB = bufferB.sampleRate;
  const t0 = Math.max(0, -(coarseSeconds - window));
  const t1 = Math.min(bufferA.length / rateA, bufferB.length / rateB - (coarseSeconds + window));
  if (t1 - t0 < 2 / rateA) return coarseSeconds;
  const a = monoSamples(bufferA);
  const b = monoSamples(bufferB);
  const span = Math.min(excerpt, t1 - t0);
  let start = t0;
  let loudest = -1;
  for (let candidate = t0; candidate + span <= t1 + 1e-9; candidate += span / 2) {
    let energy = 0;
    const s1 = Math.round((candidate + span) * rateA);
    for (let sample = Math.round(candidate * rateA); sample < s1; sample += 1) energy += a[sample] * a[sample];
    if (energy > loudest) {
      loudest = energy;
      start = candidate;
    }
  }
  const s0 = Math.round(start * rateA);
  const s1 = Math.min(bufferA.length, Math.round((start + span) * rateA));
  const k0 = Math.round((coarseSeconds - window) * rateA);
  const k1 = Math.round((coarseSeconds + window) * rateA);
  const scores = new Float64Array(k1 - k0 + 1);
  for (let k = k0; k <= k1; k += 1) {
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let sample = s0; sample < s1; sample += 1) {
      const index = Math.min(b.length - 1, Math.max(0, Math.round(((sample + k) / rateA) * rateB)));
      ab += a[sample] * b[index];
      aa += a[sample] * a[sample];
      bb += b[index] * b[index];
    }
    const energy = Math.sqrt(aa * bb);
    scores[k - k0] = energy > 0 ? ab / energy : 0;
  }
  let best = 0;
  scores.forEach((value, index) => {
    if (value > scores[best]) best = index;
  });
  let delta = 0;
  if (best > 0 && best < scores.length - 1) {
    const curvature = scores[best - 1] - 2 * scores[best] + scores[best + 1];
    delta = (0.5 * (scores[best - 1] - scores[best + 1])) / Math.min(curvature, -1e-12);
  }
  return (k0 + best + delta) / rateA;
}

const sourceIn = (source) => source.clip.sourceIn || 0;

// Referência padrão: a fonte mais longa nas faixas de áudio (gravador/lapela); sem áudio externo, a mais longa.
function defaultReference(sources) {
  const audio = sources.filter((source) => source.clip.track.startsWith("A"));
  const pool = audio.length ? audio : sources;
  return pool.reduce((best, source) => (source.clip.duration > best.clip.duration ? source : best));
}

/**
 * Plano de sincronização. `sources` = [{ id, name, clip, buffer }] (clip com track, start, sourceIn, duration).
 * Cada fonte é comparada com a referência; se a confiança for baixa, tenta-se uma fonte já sincronizada (cadeia).
 * Devolve, na ordem recebida: [{ id, name, offset (segundos a SOMAR em clip.start), confidence, status, via }].
 * Limitação: considera velocidade 1x (clip.speed é ignorado na análise).
 */
export function planSync(sources, { referenceId, hop = HOP_SECONDS, minOverlapSeconds = 2, window = 0.05 } = {}) {
  if (!sources.length) return [];
  const reference = sources.find((source) => source.id === referenceId) || defaultReference(sources);
  const envelopes = new Map(
    sources.map((source) => [
      source.id,
      onsetEnvelope(source.buffer, { from: sourceIn(source), duration: source.clip.duration, hop }),
    ]),
  );
  // Atraso (segundos no tempo do clipe) de `other` em relação a `base`, ou null se a confiança for baixa.
  const align = (base, other) => {
    const result = crossCorrelate(envelopes.get(base.id), envelopes.get(other.id), undefined, {
      minOverlap: Math.round(minOverlapSeconds / hop),
    });
    if (result.confidence === "baixa") return { ...result, lagSeconds: null };
    const shift = sourceIn(other) - sourceIn(base);
    const fine = refineLag(base.buffer, other.buffer, result.lag * hop + shift, { window: Math.max(window, 2 * hop) });
    return { ...result, lagSeconds: fine - shift };
  };
  const starts = new Map([[reference.id, reference.clip.start]]);
  const results = new Map([[reference.id, { status: "referencia", confidence: null, via: null }]]);
  const settle = (source, base, result, status) => {
    starts.set(source.id, starts.get(base.id) - result.lagSeconds);
    results.set(source.id, { status, confidence: result.confidence, via: base.id });
  };
  let pending = [];
  sources.forEach((source) => {
    if (source === reference) return;
    const result = align(reference, source);
    if (result.lagSeconds === null) pending.push(source);
    else settle(source, reference, result, "sincronizado");
  });
  let progress = true;
  while (progress && pending.length) {
    progress = false;
    pending = pending.filter((source) => {
      let chosen = null;
      sources.forEach((base) => {
        if (base === reference || base === source || !starts.has(base.id)) return;
        const result = align(base, source);
        if (result.lagSeconds !== null && (!chosen || result.distinct > chosen.result.distinct)) chosen = { base, result };
      });
      if (!chosen) return true;
      settle(source, chosen.base, chosen.result, "cadeia");
      progress = true;
      return false;
    });
  }
  return sources.map((source) => {
    const result = results.get(source.id) || { status: "sem_som_comum", confidence: "baixa", via: null };
    const offset = starts.has(source.id) ? starts.get(source.id) - source.clip.start : 0;
    return { id: source.id, name: source.name, offset, ...result };
  });
}

/**
 * Aplica o plano: move os clipes pelo offset (fontes "sem_som_comum" ficam onde estão). Se algum clipe
 * terminar antes do zero, a timeline inteira é deslocada igualmente. Com `muteCameraAudio`, havendo áudio
 * externo sincronizado (faixa A), os vídeos sincronizados das faixas V ficam com volume 0. Não altera a lista recebida.
 */
export function applySync(clips, plan, { muteCameraAudio = false } = {}) {
  const offsets = new Map(plan.filter((entry) => entry.status !== "sem_som_comum").map((entry) => [entry.id, entry.offset]));
  const moved = clips.map((clip) => (offsets.get(clip.id) ? { ...clip, start: clip.start + offsets.get(clip.id) } : clip));
  const lowest = Math.min(0, ...moved.map((clip) => clip.start));
  let next = lowest < 0 ? moved.map((clip) => ({ ...clip, start: clip.start - lowest })) : moved;
  const external = clips.some((clip) => offsets.has(clip.id) && clip.track.startsWith("A"));
  if (muteCameraAudio && external) {
    next = next.map((clip) =>
      offsets.has(clip.id) && clip.track.startsWith("V") && /^video\//.test(clip.type) ? { ...clip, volume: 0 } : clip,
    );
  }
  return next;
}
