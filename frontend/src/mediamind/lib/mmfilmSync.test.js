import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_THRESHOLDS,
  applySync,
  confidenceLabel,
  crossCorrelate,
  onsetEnvelope,
  planSync,
  refineLag,
} from "./mmfilmSync";

const RATE = 1000;

// Gerador pseudoaleatório determinístico (mulberry32).
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "Gravação" sintética: rajadas de ruído de duração e volume aleatórios separadas por pausas quase silenciosas.
function bursts(seconds, seed, rate = RATE) {
  const next = random(seed);
  const data = new Float32Array(Math.round(seconds * rate));
  let position = 0;
  while (position < data.length) {
    const gap = Math.round((0.05 + next() * 0.35) * rate);
    for (let i = 0; i < gap && position < data.length; i += 1, position += 1) data[position] = (next() - 0.5) * 0.002;
    const length = Math.round((0.05 + next() * 0.25) * rate);
    const amplitude = 0.1 + next() * 0.7;
    for (let i = 0; i < length && position < data.length; i += 1, position += 1) data[position] = (next() - 0.5) * 2 * amplitude;
  }
  return data;
}

const buffer = (data, rate = RATE) => ({ sampleRate: rate, length: data.length, numberOfChannels: 1, getChannelData: () => data });

// Trecho [from, from + seconds] de um sinal, com eco opcional e ruído de fundo próprio (outro microfone).
function excerpt(world, from, seconds, { echo = 0, noise = 0, seed = 99 } = {}) {
  const next = random(seed);
  const start = Math.round(from * RATE);
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i += 1) {
    const direct = world[start + i] || 0;
    const delayed = echo ? world[start + i - 30] || 0 : 0;
    out[i] = direct + echo * delayed + (next() - 0.5) * noise;
  }
  return out;
}

const clip = (id, track, start, duration, extra = {}) => ({
  id,
  track,
  start,
  duration,
  sourceIn: 0,
  speed: 100,
  volume: 100,
  enabled: true,
  url: `blob:${id}`,
  type: track.startsWith("A") ? "audio/wav" : "video/mp4",
  ...extra,
});

describe("onsetEnvelope", () => {
  it("normaliza a força de onset para média zero e variância um", () => {
    const envelope = onsetEnvelope(buffer(bursts(10, 1)));
    expect(envelope).toHaveLength(1000);
    const mean = envelope.reduce((sum, value) => sum + value, 0) / envelope.length;
    const variance = envelope.reduce((sum, value) => sum + (value - mean) ** 2, 0) / envelope.length;
    expect(mean).toBeCloseTo(0, 4);
    expect(variance).toBeCloseTo(1, 3);
  });

  it("devolve zeros para sinal sem variação, faz a média dos canais e tolera trecho além do fim", () => {
    const data = bursts(2, 2);
    const inverted = data.map((value) => -value);
    const stereo = { sampleRate: RATE, length: data.length, numberOfChannels: 2, getChannelData: (i) => (i ? inverted : data) };
    expect(Array.from(onsetEnvelope(stereo, { from: 0.5, duration: 1 }))).toEqual(new Array(100).fill(0));
    const beyond = onsetEnvelope(buffer(data), { from: 1.5, duration: 1 });
    expect(beyond).toHaveLength(100);
    expect(beyond.every(Number.isFinite)).toBe(true);
    expect(onsetEnvelope(buffer(new Float32Array(0)))).toHaveLength(0);
  });
});

describe("crossCorrelate", () => {
  const noise = (length, seed) => {
    const next = random(seed);
    return Float32Array.from({ length }, () => next() - 0.5);
  };

  it("acha o atraso de B em relação a A com confiança alta", () => {
    const a = noise(1000, 3);
    const b = new Float32Array(1000);
    for (let i = 0; i < 1000 - 37; i += 1) b[i + 37] = a[i];
    const result = crossCorrelate(a, b);
    expect(result.lag).toBe(37);
    expect(result.score).toBeGreaterThan(0.9);
    expect(result.confidence).toBe("alta");
    const reverse = crossCorrelate(b, a, 100);
    expect(reverse.lag).toBe(-37);
  });

  it("classifica som fraco em comum como média e sinais sem relação como baixa", () => {
    const a = noise(1000, 4);
    const other = noise(1000, 5);
    const weak = a.map((value, i) => 0.4 * value + other[i]);
    const media = crossCorrelate(a, weak, 100);
    expect(media.lag).toBe(0);
    expect(media.confidence).toBe("media");
    expect(crossCorrelate(a, other, 100).confidence).toBe("baixa");
  });

  it("trata vetores vazios, sem energia e sem candidatos fora da vizinhança", () => {
    expect(crossCorrelate(new Float32Array(0), noise(10, 6))).toEqual({ lag: 0, score: 0, strength: 0, distinct: 0, confidence: "baixa" });
    const silent = crossCorrelate(new Float32Array(50), new Float32Array(50), 3);
    expect(silent).toMatchObject({ score: 0, distinct: 0, confidence: "baixa" });
    const a = noise(300, 7);
    const alone = crossCorrelate(a, a, 2);
    expect(alone).toMatchObject({ lag: 0, distinct: 1, confidence: "alta" });
    expect(alone.score).toBeCloseTo(1, 6);
    expect(crossCorrelate(a, a, -5).lag).toBe(0);
  });

  it("documenta os limiares da confiança", () => {
    expect(CONFIDENCE_THRESHOLDS).toEqual({ alta: { strength: 15, distinct: 0.4 }, media: { strength: 10, distinct: 0.25 } });
    expect(confidenceLabel(15, 0.4)).toBe("alta");
    expect(confidenceLabel(14.9, 0.9)).toBe("media");
    expect(confidenceLabel(30, 0.3)).toBe("media");
    expect(confidenceLabel(9.9, 0.9)).toBe("baixa");
    expect(confidenceLabel(30, 0.2)).toBe("baixa");
  });
});

describe("refineLag", () => {
  const world = bursts(20, 8);

  it("refina um atraso grosso até a amostra (1 ms a 1 kHz)", () => {
    const a = buffer(excerpt(world, 2, 10));
    const b = buffer(excerpt(world, 2 - 0.457, 12, { noise: 0.01 }));
    expect(refineLag(a, b, 0.44)).toBeCloseTo(0.457, 3);
    expect(Math.abs(refineLag(a, b, 0.47, { window: 0.02, excerpt: 0.5 }) - 0.457)).toBeLessThan(0.0015);
  });

  it("aceita taxas diferentes entre as fontes", () => {
    const a = buffer(excerpt(world, 5, 5));
    const source = excerpt(world, 5 - 0.25, 8);
    const doubled = new Float32Array(source.length * 2).map((_, i) => source[Math.floor(i / 2)]);
    expect(Math.abs(refineLag(a, buffer(doubled, 2 * RATE), 0.23) - 0.25)).toBeLessThan(0.0015);
  });

  it("devolve o atraso grosso sem trecho em comum e para na borda sem som", () => {
    const a = buffer(excerpt(world, 0, 2));
    expect(refineLag(a, buffer(excerpt(world, 0, 2)), 5)).toBe(5);
    expect(refineLag(a, buffer(new Float32Array(4000)), 0.1)).toBeCloseTo(0.05, 6);
  });
});

describe("planSync", () => {
  const world = bursts(60, 11);

  it("alinha câmeras ao gravador (referência automática) com erro menor que 2 ms", () => {
    const sources = [
      { id: "cam1", name: "cam1.mp4", clip: clip("cam1", "V1", 10, 20), buffer: buffer(excerpt(world, 4.567, 20, { echo: 0.4, noise: 0.02, seed: 1 })) },
      { id: "rec", name: "gravador.wav", clip: clip("rec", "A1", 0, 30), buffer: buffer(excerpt(world, 0, 30, { noise: 0.005, seed: 2 })) },
      { id: "cam2", name: "cam2.mp4", clip: clip("cam2", "V2", 3, 25, { sourceIn: 2 }), buffer: buffer(excerpt(world, 1.2, 28, { noise: 0.02, seed: 3 })) },
    ];
    const plan = planSync(sources);
    expect(plan.map((entry) => entry.status)).toEqual(["sincronizado", "referencia", "sincronizado"]);
    expect(plan[1]).toMatchObject({ id: "rec", name: "gravador.wav", offset: 0, confidence: null, via: null });
    // cam1 começa em 4.567 do gravador; cam2 (sourceIn 2) mostra o gravador a partir de 3.2.
    expect(Math.abs(plan[0].offset - (4.567 - 10))).toBeLessThan(0.002);
    expect(Math.abs(plan[2].offset - (3.2 - 3))).toBeLessThan(0.002);
    expect(plan[0]).toMatchObject({ confidence: "alta", via: "rec" });
  });

  it("usa a referência escolhida e, sem áudio externo, a fonte mais longa", () => {
    const sources = [
      { id: "short", name: "a", clip: clip("short", "V1", 0, 10), buffer: buffer(excerpt(world, 10, 10)) },
      { id: "long", name: "b", clip: clip("long", "V2", 0, 20), buffer: buffer(excerpt(world, 5, 20)) },
    ];
    const automatic = planSync(sources);
    expect(automatic[1].status).toBe("referencia");
    expect(Math.abs(automatic[0].offset - 5)).toBeLessThan(0.002);
    const chosen = planSync(sources, { referenceId: "short" });
    expect(chosen[0].status).toBe("referencia");
    expect(Math.abs(chosen[1].offset + 5)).toBeLessThan(0.002);
    expect(planSync([sources[1], sources[0]]).map((entry) => entry.status)).toEqual(["referencia", "sincronizado"]);
    expect(planSync([])).toEqual([]);
  });

  it("sincroniza em cadeia quem não tem som em comum com a referência e marca quem não tem com ninguém", () => {
    const unrelated = bursts(20, 77);
    const sources = [
      { id: "ref", name: "ref", clip: clip("ref", "A1", 0, 25), buffer: buffer(excerpt(world, 0, 25)) },
      { id: "late", name: "late", clip: clip("late", "V2", 0, 20), buffer: buffer(excerpt(world, 40, 20)) },
      { id: "bridge", name: "bridge", clip: clip("bridge", "V1", 0, 25), buffer: buffer(excerpt(world, 20, 25)) },
      { id: "alone", name: "alone", clip: clip("alone", "V3", 2, 20), buffer: buffer(unrelated) },
      { id: "bridge2", name: "bridge2", clip: clip("bridge2", "V4", 0, 25), buffer: buffer(excerpt(world, 22, 25)) },
    ];
    const plan = planSync(sources);
    expect(plan[2]).toMatchObject({ status: "sincronizado", via: "ref" });
    expect(Math.abs(plan[2].offset - 20)).toBeLessThan(0.002);
    expect(plan[1]).toMatchObject({ status: "cadeia", confidence: "alta" });
    expect(["bridge", "bridge2"]).toContain(plan[1].via);
    expect(Math.abs(plan[4].offset - 22)).toBeLessThan(0.002);
    expect(Math.abs(plan[1].offset - 40)).toBeLessThan(0.002);
    expect(plan[3]).toMatchObject({ status: "sem_som_comum", confidence: "baixa", via: null, offset: 0 });
  });
});

describe("applySync", () => {
  const clips = [
    clip("rec", "A1", 0, 30),
    clip("cam1", "V1", 10, 20),
    clip("cam2", "V2", 3, 20),
    clip("title", "V3", 1, 5, { type: "image/png" }),
  ];

  it("move os clipes pelo offset sem alterar a lista original", () => {
    const plan = [
      { id: "rec", offset: 0, status: "referencia" },
      { id: "cam1", offset: -5.433, status: "sincronizado" },
      { id: "cam2", offset: 4, status: "sem_som_comum" },
    ];
    const next = applySync(clips, plan);
    expect(next.map((item) => item.start)).toEqual([0, 10 - 5.433, 3, 1]);
    expect(next[0]).toBe(clips[0]);
    expect(clips[1].start).toBe(10);
    expect(next.every((item) => item.volume === 100)).toBe(true);
  });

  it("desloca tudo igualmente para nenhum clipe começar antes do zero", () => {
    const next = applySync(clips, [{ id: "cam2", offset: -5, status: "cadeia" }]);
    expect(next.map((item) => item.start)).toEqual([2, 12, 0, 3]);
  });

  it("silencia o áudio das câmeras sincronizadas quando há áudio externo", () => {
    const plan = [
      { id: "rec", offset: 0, status: "referencia" },
      { id: "cam1", offset: 1, status: "sincronizado" },
      { id: "title", offset: 0, status: "sincronizado" },
    ];
    const muted = applySync(clips, plan, { muteCameraAudio: true });
    expect(muted.map((item) => item.volume)).toEqual([100, 0, 100, 100]);
    const videoOnly = applySync(clips, plan.slice(1), { muteCameraAudio: true });
    expect(videoOnly.map((item) => item.volume)).toEqual([100, 100, 100, 100]);
  });
});
