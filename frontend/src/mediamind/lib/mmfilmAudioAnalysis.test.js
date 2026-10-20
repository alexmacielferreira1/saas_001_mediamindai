import { describe, expect, it } from "vitest";
import {
  FLOOR_DB,
  WINDOW_SECONDS,
  audibleClips,
  autoThreshold,
  clipLevels,
  detectPauses,
  detectSilences,
  timelineEnvelope,
  voiceSegments,
} from "./mmfilmAudioAnalysis";

const RATE = 1000;
const LOUD = 0.5; // ≈ −6 dBFS
const QUIET = 0.001; // −60 dBFS
const LOUD_DB = 20 * Math.log10(LOUD);

// AudioBuffer falso: trechos [segundos, amplitude] em sequência, a 1000 Hz.
function fakeBuffer(parts, { channels = 1, rate = RATE } = {}) {
  const length = Math.round(parts.reduce((sum, [seconds]) => sum + seconds, 0) * rate);
  const data = new Float32Array(length);
  let position = 0;
  parts.forEach(([seconds, amplitude]) => {
    const count = Math.round(seconds * rate);
    data.fill(amplitude, position, position + count);
    position += count;
  });
  return { sampleRate: rate, length, numberOfChannels: channels, getChannelData: () => data };
}

// Envelope direto em dB: trechos [segundos, dB] com janelas de 10 ms.
function envelopeOf(parts, from = 0) {
  const values = [];
  parts.forEach(([seconds, db]) => {
    for (let index = 0; index < Math.round(seconds / WINDOW_SECONDS); index += 1) values.push(db);
  });
  return { from, windowSeconds: WINDOW_SECONDS, db: Float32Array.from(values) };
}

const clip = (values) => ({ id: "c", track: "A1", type: "audio/wav", url: "voz", start: 0, duration: 1, ...values });

describe("clipes com som", () => {
  it("considera só áudio/vídeo habilitado, online e com URL nas faixas pedidas", () => {
    const clips = [
      clip({ id: "a1" }),
      clip({ id: "v1", track: "V1", type: "video/mp4" }),
      clip({ id: "a2", track: "A2" }),
      clip({ id: "off", enabled: false }),
      clip({ id: "offline", offline: true }),
      clip({ id: "semurl", url: "" }),
      clip({ id: "titulo", type: "text/title" }),
      clip({ id: "semtipo", type: undefined }),
    ];
    expect(audibleClips(clips, ["A1", "V1"]).map((item) => item.id)).toEqual(["a1", "v1"]);
  });
});

describe("envelope da timeline", () => {
  it("mede o RMS em dBFS por janela de 10 ms até o fim dos clipes", () => {
    const envelope = timelineEnvelope({ clips: [clip({})], buffers: new Map([["voz", fakeBuffer([[1, LOUD]])]]) });
    expect(envelope.from).toBe(0);
    expect(envelope.windowSeconds).toBe(WINDOW_SECONDS);
    expect(envelope.db).toHaveLength(100);
    expect(envelope.db[0]).toBeCloseTo(LOUD_DB, 3);
    expect(envelope.db[99]).toBeCloseTo(LOUD_DB, 3);
  });

  it("aplica o volume do clipe, a menos que useVolume seja falso", () => {
    const buffers = new Map([["voz", fakeBuffer([[1, LOUD]])]]);
    const half = timelineEnvelope({ clips: [clip({ volume: 50 })], buffers });
    expect(half.db[10]).toBeCloseTo(LOUD_DB - 6.0206, 2);
    const raw = timelineEnvelope({ clips: [clip({ volume: 50 })], buffers, useVolume: false });
    expect(raw.db[10]).toBeCloseTo(LOUD_DB, 3);
  });

  it("respeita velocidade e entrada na origem", () => {
    const buffers = new Map([["voz", fakeBuffer([[0.5, LOUD], [0.5, 0]])]]);
    const fast = timelineEnvelope({ clips: [clip({ duration: 0.5, speed: 200 })], buffers });
    expect(fast.db[10]).toBeCloseTo(LOUD_DB, 3);
    expect(fast.db[40]).toBe(FLOOR_DB);
    const late = timelineEnvelope({ clips: [clip({ duration: 0.5, sourceIn: 0.5 })], buffers });
    expect(Array.from(late.db).every((value) => value === FLOOR_DB)).toBe(true);
  });

  it("mídia sem buffer fica em silêncio e mídia curta para no fim do arquivo", () => {
    const missing = timelineEnvelope({ clips: [clip({})], buffers: new Map() });
    expect(Array.from(missing.db).every((value) => value === FLOOR_DB)).toBe(true);
    const short = timelineEnvelope({ clips: [clip({ duration: 1 })], buffers: new Map([["voz", fakeBuffer([[0.5, LOUD]])]]) });
    expect(short.db[10]).toBeCloseTo(LOUD_DB, 3);
    expect(short.db[80]).toBe(FLOOR_DB);
  });

  it("soma a potência de clipes sobrepostos e de vários canais", () => {
    const buffers = new Map([
      ["a", fakeBuffer([[1, LOUD]])],
      ["b", fakeBuffer([[1, LOUD]], { channels: 2 })],
    ]);
    const envelope = timelineEnvelope({ clips: [clip({ url: "a" }), clip({ url: "b", start: 0.5 })], buffers });
    expect(envelope.db).toHaveLength(150);
    expect(envelope.db[20]).toBeCloseTo(LOUD_DB, 3);
    expect(envelope.db[70]).toBeCloseTo(LOUD_DB + 3.0103, 2);
    expect(envelope.db[120]).toBeCloseTo(LOUD_DB, 3);
  });

  it("janela [from, to] recorta clipes que começam antes e ignora janelas de borda vazias", () => {
    const buffers = new Map([["voz", fakeBuffer([[2, LOUD]])]]);
    const envelope = timelineEnvelope({ clips: [clip({ duration: 2 })], buffers, from: 0.5, to: 1 });
    expect(envelope.from).toBe(0.5);
    expect(envelope.db).toHaveLength(50);
    expect(envelope.db[0]).toBeCloseTo(LOUD_DB, 3);
    const edge = timelineEnvelope({ clips: [clip({ start: 0.29, duration: 0.2 })], buffers, to: 1 });
    expect(edge.db[28]).toBe(FLOOR_DB);
    expect(edge.db[29]).toBeCloseTo(LOUD_DB, 3);
  });

  it("potência ínfima é presa no piso de −100 dB", () => {
    const envelope = timelineEnvelope({ clips: [clip({})], buffers: new Map([["voz", fakeBuffer([[1, 1e-7]])]]) });
    expect(envelope.db[0]).toBe(FLOOR_DB);
  });
});

describe("limiar automático", () => {
  const db = envelopeOf([[0.1, -60], [0.1, -6]]).db;

  it("fica entre o ruído (percentil 10) e a fala (percentil 90) conforme a sensibilidade", () => {
    expect(autoThreshold(db)).toMatchObject({ floor: -60, speech: -6 });
    expect(autoThreshold(db).threshold).toBeCloseTo(-60 + (0.08 + (4 / 9) * 0.42) * 54, 4);
    expect(autoThreshold(db, 1).threshold).toBeCloseTo(-60 + 0.08 * 54, 4);
    expect(autoThreshold(db, 10).threshold).toBeCloseTo(-33, 4);
  });

  it("limita a sensibilidade a 1–10 e trata valores inválidos como 5", () => {
    expect(autoThreshold(db, 99).threshold).toBeCloseTo(autoThreshold(db, 10).threshold);
    expect(autoThreshold(db, -3).threshold).toBeCloseTo(autoThreshold(db, 1).threshold);
    expect(autoThreshold(db, "x").threshold).toBeCloseTo(autoThreshold(db, 5).threshold);
    expect(autoThreshold(db, 0).threshold).toBeCloseTo(autoThreshold(db, 5).threshold);
  });

  it("prende o limiar entre −70 e −12 dB (inclusive sem dados)", () => {
    expect(autoThreshold([])).toEqual({ threshold: -70, floor: FLOOR_DB, speech: FLOOR_DB });
    expect(autoThreshold(envelopeOf([[0.1, -20], [0.1, 0]]).db, 10).threshold).toBe(-12);
  });
});

describe("silêncios", () => {
  it("remove o silêncio do meio mantendo as margens de respiro", () => {
    const ranges = detectSilences(envelopeOf([[1, -6], [1, -60], [1, -6]]), { threshold: -30 });
    expect(ranges).toHaveLength(1);
    expect(ranges[0][0]).toBeCloseTo(1.15);
    expect(ranges[0][1]).toBeCloseTo(1.88);
  });

  it("silêncios no começo e no fim não recebem margem do lado da borda", () => {
    const ranges = detectSilences(envelopeOf([[0.6, -60], [1, -6], [0.6, -60]], 2), { threshold: -30 });
    expect(ranges[0][0]).toBeCloseTo(2);
    expect(ranges[0][1]).toBeCloseTo(2.48);
    expect(ranges[1][0]).toBeCloseTo(3.75);
    expect(ranges[1][1]).toBeCloseTo(4.2);
  });

  it("ignora silêncios menores que o mínimo e trechos que ficariam com menos de 0,1 s", () => {
    const envelope = envelopeOf([[1, -6], [0.3, -60], [1, -6], [0.35, -60], [1, -6], [0.4, -60], [1, -6]]);
    expect(detectSilences(envelope, { threshold: -30 })).toEqual([]);
    const ranges = detectSilences(envelope, { threshold: -30, minSilence: 0.3 });
    expect(ranges).toHaveLength(1);
    expect(ranges[0][0]).toBeCloseTo(3.8);
    expect(ranges[0][1]).toBeCloseTo(3.93);
  });

  it("estalos curtos (até 60 ms) não interrompem o silêncio; sons mais longos sim", () => {
    const click = detectSilences(envelopeOf([[1, -6], [0.5, -60], [0.05, -6], [0.5, -60], [1, -6]]), { threshold: -30, padBefore: 0, padAfter: 0 });
    expect(click).toHaveLength(1);
    expect(click[0][0]).toBeCloseTo(1);
    expect(click[0][1]).toBeCloseTo(2.05);
    const word = detectSilences(envelopeOf([[1, -6], [0.5, -60], [0.1, -6], [0.5, -60], [1, -6]]), { threshold: -30, padBefore: 0, padAfter: 0 });
    expect(word).toHaveLength(2);
  });
});

describe("pausas", () => {
  it("corta no meio das pausas internas sem criar pedaços menores que o clipe mínimo", () => {
    const envelope = envelopeOf([
      [0.5, -60], // começo: não é pausa interna
      [2, -6],
      [0.4, -60], // corte em 2,7
      [0.5, -6],
      [0.15, -60], // pausa curta demais
      [0.3, -6],
      [0.4, -60], // 4,05: perto demais do corte anterior
      [2, -6],
      [0.4, -60], // corte em 6,45
      [2, -6],
      [0.4, -60], // 8,85: perto demais do fim
      [0.5, -6],
      [0.5, -60], // fim: não é pausa interna
    ]);
    expect(detectPauses(envelope, { threshold: -30 })).toEqual([2.7, 6.45]);
    expect(detectPauses(envelope, { threshold: -30, minClip: 3 })).toEqual([4.05]);
  });
});

describe("trechos de voz", () => {
  const envelope = envelopeOf([[0.5, -60], [1, -6], [0.3, -60], [1, -6], [1, -60], [0.1, -6], [1, -60], [0.5, -6]]);

  it("une intervalos curtos e descarta trechos menores que o mínimo", () => {
    const segments = voiceSegments(envelope, { threshold: -30 });
    expect(segments).toHaveLength(2);
    expect(segments[0][0]).toBeCloseTo(0.5);
    expect(segments[0][1]).toBeCloseTo(2.8);
    expect(segments[1][0]).toBeCloseTo(4.9);
    expect(segments[1][1]).toBeCloseTo(5.4);
  });

  it("mergeGap e minLength configuráveis", () => {
    expect(voiceSegments(envelope, { threshold: -30, mergeGap: 0.2 })).toHaveLength(3);
    expect(voiceSegments(envelope, { threshold: -30, minLength: 0 })).toHaveLength(3);
  });
});

describe("nível do clipe", () => {
  it("clipe mudo não tem nível", () => {
    expect(clipLevels(clip({}), fakeBuffer([[1, 0]]))).toBeNull();
  });

  it("RMS só dos trechos com som (porta de −20 dB) e pico, ignorando o volume atual", () => {
    const levels = clipLevels(clip({ volume: 10 }), fakeBuffer([[0.5, LOUD], [0.5, QUIET]], { channels: 2 }));
    expect(levels.rms).toBeCloseTo(LOUD_DB, 3);
    expect(levels.peak).toBeCloseTo(LOUD_DB, 3);
  });

  it("mede a partir da entrada na origem, com velocidade", () => {
    const buffer = fakeBuffer([[0.5, QUIET], [1, LOUD]]);
    const levels = clipLevels(clip({ start: 3, duration: 0.5, sourceIn: 0.5, speed: 200 }), buffer);
    expect(levels.rms).toBeCloseTo(LOUD_DB, 3);
    expect(levels.peak).toBeCloseTo(LOUD_DB, 3);
  });

  it("pico zero vira o piso de −100 dB", () => {
    const loud = new Float32Array(1000).fill(LOUD);
    const silent = new Float32Array(1000);
    let reads = 0;
    // O envelope lê o canal antes do pico; se a segunda leitura vier zerada, o pico cai no piso.
    const buffer = { sampleRate: RATE, length: 1000, numberOfChannels: 1, getChannelData: () => (reads++ === 0 ? loud : silent) };
    expect(clipLevels(clip({}), buffer).peak).toBe(FLOOR_DB);
  });
});
