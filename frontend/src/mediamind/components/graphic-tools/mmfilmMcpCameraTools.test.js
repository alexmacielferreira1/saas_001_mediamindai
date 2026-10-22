import { describe, expect, it, vi } from "vitest";
import { mmfilmCatalogue, runMMFilmTool } from "./mmfilmMcpTools";

const RATE = 1000;

// Gerador pseudoaleatório determinístico (mulberry32).
function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "Gravação" sintética: rajadas de ruído de volume aleatório separadas por pausas quase silenciosas.
function bursts(seconds, seed) {
  const next = random(seed);
  const data = new Float32Array(Math.round(seconds * RATE));
  let position = 0;
  while (position < data.length) {
    const gap = Math.round((0.05 + next() * 0.35) * RATE);
    for (let i = 0; i < gap && position < data.length; i += 1, position += 1) data[position] = (next() - 0.5) * 0.002;
    const length = Math.round((0.05 + next() * 0.25) * RATE);
    const amplitude = 0.1 + next() * 0.7;
    for (let i = 0; i < length && position < data.length; i += 1, position += 1) data[position] = (next() - 0.5) * 2 * amplitude;
  }
  return data;
}

const buffer = (data) => ({ sampleRate: RATE, length: data.length, numberOfChannels: 1, getChannelData: () => data });
const excerpt = (world, from, seconds) => world.slice(Math.round(from * RATE), Math.round((from + seconds) * RATE));

// AudioBuffer em trechos [segundos, amplitude].
function levels(parts) {
  const data = new Float32Array(Math.round(parts.reduce((sum, [seconds]) => sum + seconds, 0) * RATE));
  let position = 0;
  parts.forEach(([seconds, amplitude]) => {
    const count = Math.round(seconds * RATE);
    data.fill(amplitude, position, position + count);
    position += count;
  });
  return buffer(data);
}

function envWith(buffers) {
  const loadBuffers = vi.fn(async (clips) => new Map(clips.filter((clip) => buffers[clip.url]).map((clip) => [clip.url, buffers[clip.url]])));
  return { loadBuffers };
}

const clip = (id, track, start, duration, extra = {}) => ({
  id,
  name: id,
  track,
  type: track.startsWith("A") ? "audio/wav" : "video/mp4",
  url: id,
  start,
  duration,
  sourceIn: 0,
  speed: 100,
  volume: 100,
  keyframes: [],
  ...extra,
});

const state = (clips, extra = {}) => ({ clips, markers: [], selectedIds: [], trackState: {}, media: [], ...extra });
const near = (value, expected) => expect(Math.abs(value - expected)).toBeLessThan(0.002);

describe("sync.waveform", () => {
  const world = bursts(40, 11);
  const buffers = {
    rec: buffer(excerpt(world, 0, 30)),
    cam: buffer(excerpt(world, 4.567, 20)),
    alone: buffer(bursts(20, 77)),
  };
  // Gravador em A1; câmera com vídeo em V1 e o próprio som vinculado em A2 (mesmo recurso e ponto);
  // uma fonte sem som em comum, um efeito sonoro e uma faixa bloqueada que ficam de fora.
  const timeline = (extra = {}) =>
    state(
      [
        clip("rec", "A1", 0, 30, { name: "gravador.wav" }),
        clip("camV", "V1", 10, 20, { url: "cam", assetId: "cam" }),
        clip("camA", "A2", 10, 20, { url: "cam", assetId: "cam", name: "" }),
        clip("alone", "A3", 2, 20),
        clip("whoosh", "A3", 25, 1, { sfx: true, url: "rec" }),
        clip("trava", "V3", 0, 5, { url: "rec" }),
        clip("titulo", "V2", 0, 3, { type: "text/title", url: "" }),
      ],
      { trackState: { V3: { locked: true } }, ...extra },
    );

  it("o catálogo oferece as fontes com som como referência (sem efeitos)", () => {
    const options = mmfilmCatalogue(timeline()).tools.find((tool) => tool.id === "sync.waveform").params.find((param) => param.key === "reference").options;
    expect(options).toEqual([
      ["auto", "Automática (gravador/áudio mais longo)"],
      ["rec", "A1 · gravador.wav"],
      ["camA", "A2 · camA"],
      ["alone", "A3 · alone"],
      ["trava", "V3 · trava"],
    ]);
  });

  it("alinha a câmera ao gravador e o vídeo vinculado anda junto", async () => {
    const env = envWith(buffers);
    const result = await runMMFilmTool("sync.waveform", timeline(), {}, env);
    expect(env.loadBuffers.mock.calls[0][0].map((item) => item.id)).toEqual(["rec", "camA", "alone"]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.headline).toEqual({ count: "2/3", text: "fontes sincronizadas com a referência" });
    expect(result.summary).toBe("1 fonte(s) alinhada(s) à referência");
    expect(result.items.map((item) => [item.id, item.timecode, item.badge, item.selected])).toEqual([
      ["rec", "A1", "Referência", false],
      ["camA", "A2", "Sincronizado", true],
      ["alone", "A3", "Não achou o mesmo som", false],
    ]);
    expect(result.items[0].label).toBe("gravador.wav · referência");
    expect(result.items[1].label).toMatch(/^camA · −5,4\d\d s · confiança (alta|media)$/);
    expect(result.items[2].label).toBe("alone · +0,000 s · confiança baixa");
    const byId = Object.fromEntries(result.clips.map((item) => [item.id, item]));
    near(byId.camA.start, 4.567);
    near(byId.camV.start, 4.567);
    expect(byId.camV.volume).toBe(100);
    expect(byId.alone.start).toBe(2);
    expect(byId.trava.start).toBe(0);
  });

  it("referência escolhida, deslocamento positivo e áudio das câmeras desligado", async () => {
    const result = await runMMFilmTool("sync.waveform", timeline(), { reference: "camA", muteCameras: true }, envWith(buffers));
    expect(result.items[1].label).toBe("camA · referência");
    expect(result.items[0].label).toMatch(/^gravador\.wav · \+5,4\d\d s/);
    expect(result.summary).toBe("1 fonte(s) alinhada(s) à referência · áudio das câmeras desligado");
    const byId = Object.fromEntries(result.clips.map((item) => [item.id, item]));
    near(byId.rec.start, 5.433);
    expect(byId.camA.start).toBe(10);
    expect(byId.camV.volume).toBe(100);
  });

  it("com áudio externo sincronizado, o vídeo vinculado fica sem som", async () => {
    const result = await runMMFilmTool("sync.waveform", timeline(), { muteCameras: true }, envWith(buffers));
    expect(result.clips.find((item) => item.id === "camV").volume).toBe(0);
  });

  it("usa só os selecionados (ou todos, sem seleção) e nada para mover quando nada foi marcado", async () => {
    const env = envWith(buffers);
    const selected = await runMMFilmTool("sync.waveform", timeline({ selectedIds: ["rec", "camA"] }), { onlySelected: true }, env);
    expect(env.loadBuffers.mock.calls[0][0].map((item) => item.id)).toEqual(["rec", "camA"]);
    expect(selected.headline.count).toBe("2/2");
    const all = await runMMFilmTool("sync.waveform", timeline(), { onlySelected: true, selectedItems: [] }, env);
    expect(env.loadBuffers.mock.calls[1][0]).toHaveLength(3);
    expect(all).toMatchObject({ ok: true, count: 0, summary: "Nenhuma fonte para mover: todas já estão alinhadas ou sem som em comum." });
    expect(all.clips).toBeUndefined();
    expect(all.items).toHaveLength(3);
  });

  it("clipes já alinhados que são vínculos entre si não se movem duas vezes", async () => {
    const twins = state([
      clip("rec", "A1", 0, 30),
      clip("camA", "A2", 10, 20, { url: "cam", assetId: "cam" }),
      clip("camB", "A3", 10, 20, { url: "cam", assetId: "cam" }),
    ]);
    const result = await runMMFilmTool("sync.waveform", twins, {}, envWith(buffers));
    expect(result.count).toBe(2);
    const byId = Object.fromEntries(result.clips.map((item) => [item.id, item]));
    near(byId.camA.start, 4.567);
    near(byId.camB.start, 4.567);
  });

  it("exige duas fontes com som legível", async () => {
    const expected = { ok: false, summary: "Coloque pelo menos duas fontes com som na timeline (câmeras e/ou áudio externo), em qualquer posição." };
    expect(await runMMFilmTool("sync.waveform", state([clip("rec", "A1", 0, 30)]), {}, envWith(buffers))).toEqual(expected);
    expect(await runMMFilmTool("sync.waveform", timeline(), {}, envWith({ rec: buffers.rec }))).toEqual({
      ok: false,
      summary: "Não foi possível ler o som de pelo menos duas fontes.",
    });
  });
});

describe("multicam.cut", () => {
  const LOUD = 0.5; // −6 dB
  const BLEED = 0.05; // −26 dB: a voz da outra pessoa no microfone
  // Pessoa 1 fala 0–4 s, pessoa 2 fala 4–8 s, as duas juntas 8–11 s.
  const mics = {
    mic1: levels([
      [4, LOUD],
      [4, BLEED],
      [3, LOUD],
    ]),
    mic2: levels([
      [4, BLEED],
      [4, LOUD],
      [3, LOUD],
    ]),
  };
  const timeline = (extra = {}) =>
    state(
      [
        clip("cam1", "V1", 0, 11),
        clip("cam2", "V2", 0, 11),
        clip("geral", "V3", 0, 11),
        clip("mic1", "A1", 0, 11),
        clip("mic2", "A2", 0, 11),
        clip("pop", "A2", 5, 0.5, { sfx: true }),
      ],
      extra,
    );

  it("corta para quem fala e para a geral quando as duas falam juntas", async () => {
    const env = envWith(mics);
    const result = await runMMFilmTool("multicam.cut", timeline(), { wide: "V3" }, env);
    expect(env.loadBuffers.mock.calls.map((call) => call[0].map((item) => item.id))).toEqual([["mic1"], ["mic2"]]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
    expect(result.headline).toEqual({ count: 3, text: "plano(s) · ritmo normal" });
    expect(result.summary).toBe("2 troca(s) de câmera · planos fora do ar ficam desativados (nada é apagado)");
    expect(result.details).toEqual([
      "00:00,00 → 00:03,80 · Pessoa 1 (V1)",
      "00:03,80 → 00:07,80 · Pessoa 2 (V2)",
      "00:07,80 → 00:11,00 · Geral (V3)",
    ]);
    const onAir = result.clips.filter((item) => item.enabled === true).map((item) => item.track);
    expect(onAir).toEqual(["V1", "V2", "V3"]);
    expect(result.clips.filter((item) => item.track === "A1")).toHaveLength(1);
  });

  it("sem câmera geral, falas juntas mantêm o plano atual", async () => {
    const result = await runMMFilmTool("multicam.cut", timeline(), { pace: "rapido" }, envWith(mics));
    expect(result.headline.text).toBe("plano(s) · ritmo rapido");
    expect(result.details).toEqual(["00:00,00 → 00:03,80 · Pessoa 1 (V1)", "00:03,80 → 00:11,00 · Pessoa 2 (V2)"]);
    expect(result.clips.find((item) => item.id === "geral")).toEqual(timeline().clips[2]);
  });

  it("um único plano conta zero trocas", async () => {
    const solo = { mic1: levels([[11, LOUD]]), mic2: levels([[11, BLEED]]) };
    const result = await runMMFilmTool("multicam.cut", timeline(), {}, envWith(solo));
    expect(result.count).toBe(1);
    expect(result.summary).toMatch(/^0 troca\(s\)/);
  });

  it("ninguém falando: microfones sem duração", async () => {
    const empty = state([clip("mic1", "A1", 0, 0), clip("mic2", "A2", 0, 0)]);
    expect(await runMMFilmTool("multicam.cut", empty, {}, envWith(mics))).toEqual({ ok: true, count: 0, summary: "Ninguém falando nas trilhas dos microfones." });
  });

  it("explica configuração incompleta, câmera bloqueada e microfone sem som", async () => {
    const env = envWith(mics);
    expect(await runMMFilmTool("multicam.cut", timeline(), { mic2: "none" }, env)).toEqual({
      ok: false,
      summary: "Configure pelo menos 2 pessoas, cada uma com microfone e câmera.",
    });
    expect(await runMMFilmTool("multicam.cut", timeline(), { cam1: "none" }, env)).toMatchObject({ ok: false });
    expect(await runMMFilmTool("multicam.cut", timeline({ trackState: { V3: { locked: true } } }), { wide: "V3" }, env)).toEqual({
      ok: false,
      summary: "A faixa de câmera V3 está bloqueada.",
    });
    expect(await runMMFilmTool("multicam.cut", timeline(), { mic3: "A3", cam3: "V3" }, env)).toEqual({
      ok: false,
      summary: "Pessoa 3: não há som na trilha A3.",
    });
    expect(env.loadBuffers).toHaveBeenCalledTimes(2);
  });
});
