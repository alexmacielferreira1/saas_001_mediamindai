import { describe, expect, it, vi } from "vitest";
import { MULTI_LAYOUTS, segmentsToCues, soundCategory, speedRampPieces } from "./mmfilmMcpExtraTools";
import { mmfilmCatalogue, runMMFilmTool } from "./mmfilmMcpTools";

const ASSET = "11111111-2222-4333-8444-555555555555";
const OTHER = "22222222-3333-4444-8555-666666666666";
const clip = (id, track, start, duration, extra = {}) => ({
  id,
  name: id,
  track,
  start,
  duration,
  sourceIn: 0,
  speed: 100,
  url: `blob:${id}`,
  type: track.startsWith("A") ? "audio/wav" : "video/mp4",
  ...extra,
});
const state = (clips, extra = {}) => ({ clips, markers: [], trackState: {}, media: [], selectedIds: [], playhead: 0, ...extra });

describe("transcrever", () => {
  it("converte segmentos da mídia para o tempo da timeline, recortando ao trecho e respeitando a velocidade", () => {
    const cues = segmentsToCues(clip("v", "V1", 10, 4, { sourceIn: 2, speed: 200 }), [
      { start_ms: 0, end_ms: 1000, texto: "antes do trecho" },
      { start_ms: 1500, end_ms: 4000, texto: " começo " },
      { start_ms: 9000, end_ms: 12000, text: "fim" },
      { start_ms: 4000, end_ms: 5000, texto: "" },
      { start_ms: 4000, end_ms: 5000 },
      { start_ms: 20000, end_ms: 21000, texto: "depois" },
    ]);
    expect(cues).toEqual([
      { start: 10, end: 11, text: "começo" },
      { start: 13.5, end: 14, text: "fim" },
    ]);
  });

  it("transcreve só mídias do Acervo, uma vez por mídia, e cria as legendas", async () => {
    const transcribe = vi.fn(async (asset) =>
      asset.id === ASSET
        ? { segments: [{ start_ms: 0, end_ms: 2000, texto: "olá pessoal" }, { start_ms: 3000, end_ms: 4000, texto: "tudo bem?" }], reused: true }
        : { segments: [], reused: false },
    );
    const clips = [
      clip("v1", "V1", 0, 5, { assetId: ASSET }),
      clip("a1", "A1", 0, 5, { assetId: ASSET }),
      clip("musica", "A2", 0, 5, { assetId: OTHER }),
      clip("local", "A3", 0, 5, { assetId: "local-123" }),
      clip("velha", "V3", 1, 1, { type: "text/title", caption: true, text: "antiga" }),
    ];
    const result = await runMMFilmTool("transcribe.run", state(clips), {}, { transcribe });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(transcribe).toHaveBeenCalledWith({ id: ASSET, title: "a1", stream_url: "blob:a1", duration: undefined });
    expect(result).toMatchObject({ ok: true, count: 2, summary: "2 legenda(s) da transcrição de 1 mídia(s) (1 reaproveitada(s) do Acervo)" });
    expect(result.clips.some((item) => item.id === "velha")).toBe(false);
    expect(result.clips.filter((item) => item.caption).map((item) => [item.start, item.text, item.track])).toEqual([
      [0, "olá pessoal", "V3"],
      [3, "tudo bem?", "V3"],
    ]);
    const kept = await runMMFilmTool("transcribe.run", state(clips), { replace: false, musicTracks: null, track: "V2" }, { transcribe });
    expect(kept.summary).toBe("2 legenda(s) da transcrição de 2 mídia(s) (1 reaproveitada(s) do Acervo)");
    expect(kept.clips.some((item) => item.id === "velha")).toBe(true);
  });

  it("vários trechos da mesma mídia usam uma só transcrição; clipe sem velocidade/entrada usa o padrão", async () => {
    const transcribe = vi.fn(async () => ({ segments: [{ start_ms: 0, end_ms: 1000, texto: "oi" }], reused: false }));
    const clips = [clip("a1", "A1", 0, 2, { assetId: ASSET }), clip("a2", "A1", 5, 2, { assetId: ASSET, speed: undefined, sourceIn: undefined })];
    const result = await runMMFilmTool("transcribe.run", state(clips), {}, { transcribe });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe("2 legenda(s) da transcrição de 1 mídia(s)");
    expect(result.clips.filter((item) => item.caption).map((item) => item.start)).toEqual([0, 5]);
  });

  it("explica o que falta: mídia do Acervo, serviço ou falas", async () => {
    const acervo = state([clip("a1", "A1", 0, 5, { assetId: ASSET })]);
    expect((await runMMFilmTool("transcribe.run", state([clip("a1", "A1", 0, 5)]), {}, {})).summary).toMatch(/só funciona com mídias vindas do Acervo/);
    expect((await runMMFilmTool("transcribe.run", acervo, {}, {})).summary).toBe("O serviço de transcrição não está disponível nesta tela.");
    const empty = await runMMFilmTool("transcribe.run", acervo, {}, { transcribe: async () => ({}) });
    expect(empty).toEqual({ ok: true, count: 0, summary: "A transcrição voltou sem falas no trecho usado na timeline." });
  });
});

describe("rampa de velocidade", () => {
  it("divide em 6 degraus com a curva escolhida, sem perder mídia", () => {
    const base = clip("v", "V1", 2, 6, { sourceIn: 1, motion: { scale: [[0, 1]] }, transition: "Dissolver" });
    const up = speedRampPieces(base, { from: 100, to: 200, shape: "acelerar" });
    expect(up.pieces).toHaveLength(6);
    expect(up.pieces.map((piece) => piece.speed)).toEqual([108, 125, 142, 158, 175, 192]);
    expect(up.pieces[0]).toMatchObject({ id: "v", start: 2, sourceIn: 1, transition: "Dissolver", motion: undefined });
    expect(up.pieces[5]).toMatchObject({ id: "v-rampa-5", sourceIn: 6, transition: undefined });
    expect(up.total).toBeLessThan(6);
    expect(speedRampPieces(base, { from: 100, to: 200, shape: "desacelerar" }).pieces[0].speed).toBe(192);
    expect(speedRampPieces(base, { from: 100, to: 300, shape: "ida-volta" }).pieces.map((piece) => piece.speed)).toEqual([133, 200, 267, 267, 200, 133]);
    expect(speedRampPieces({ ...base, speed: undefined }, { from: 100, to: 100, shape: "outra" }).total).toBe(6);
  });

  it("leva junto o áudio vinculado e puxa os clipes seguintes da faixa", async () => {
    const clips = [
      clip("v", "V1", 0, 6, { assetId: ASSET }),
      clip("a", "A1", 0, 6, { assetId: ASSET }),
      clip("depois", "V1", 6, 2),
      clip("outra", "V2", 6, 2),
      clip("travada", "A3", 0, 6, { assetId: ASSET }),
    ];
    const result = await runMMFilmTool("motion.speedramp", state(clips, { selectedIds: ["v"], trackState: { A3: { locked: true } } }), { from: 100, to: 300 }, {});
    expect(result.ok).toBe(true);
    const ramp = result.clips.filter((item) => item.track === "V1" && item.id.startsWith("v"));
    expect(ramp).toHaveLength(6);
    expect(result.clips.filter((item) => item.track === "A1")).toHaveLength(6);
    const end = ramp.at(-1).start + ramp.at(-1).duration;
    expect(result.clips.find((item) => item.id === "depois").start).toBeCloseTo(end, 2);
    expect(result.clips.find((item) => item.id === "outra").start).toBe(6);
    expect(result.clips.find((item) => item.id === "travada").duration).toBe(6);
    expect((await runMMFilmTool("motion.speedramp", state(clips), {}, {})).summary).toMatch(/Selecione um ou mais clipes de vídeo/);
  });

  it("vários clipes na mesma faixa: o de trás primeiro, sem sobrepor", async () => {
    const clips = [clip("v1", "V1", 0, 3), clip("v2", "V1", 3, 3)];
    const result = await runMMFilmTool("motion.speedramp", state(clips, { selectedIds: ["v1", "v2"] }), { from: 200, to: 200 }, {});
    expect(result.count).toBe(2);
    const pieces = result.clips.filter((item) => item.track === "V1").sort((a, b) => a.start - b.start);
    expect(pieces).toHaveLength(12);
    pieces.slice(1).forEach((piece, index) => expect(piece.start).toBeCloseTo(pieces[index].start + pieces[index].duration, 2));
    expect(pieces.at(-1).start + pieces.at(-1).duration).toBeCloseTo(3, 2);
  });
});

describe("multi-tela", () => {
  const visual = [clip("c1", "V1", 0, 5), clip("c2", "V2", 0, 5), clip("c3", "V3", 0, 5), clip("t", "V3", 5, 2, { type: "text/title" })];

  it.each(Object.keys(MULTI_LAYOUTS))("monta o layout %s nos clipes selecionados, de baixo para cima", async (layout) => {
    const clips = [...visual, clip("c4", "V1", 5, 5)];
    const result = await runMMFilmTool("packs.multiscreen", state(clips, { selectedIds: ["c3", "c1", "c2", "c4", "t"] }), { layout }, {});
    const spec = MULTI_LAYOUTS[layout];
    if (spec.count > 4) return;
    if (spec.count === 4) {
      expect(result.ok).toBe(true);
      expect(result.count).toBe(4);
      return;
    }
    expect(result.count).toBe(spec.count);
    const first = result.clips.find((item) => item.id === "c1");
    expect(first).toMatchObject({ x: spec.cells[0].x ?? 0, scale: spec.cells[0].scale ?? 100 });
  });

  it("explica quando faltam clipes", async () => {
    const result = await runMMFilmTool("packs.multiscreen", state(visual, { selectedIds: ["c1"] }), { layout: "lado" }, {});
    expect(result).toEqual({ ok: false, summary: expect.stringMatching(/precisa de 2 clipes selecionados/) });
  });
});

describe("biblioteca de sons", () => {
  const media = [
    { id: "w", name: "Whoosh rápido.wav", type: "audio/wav", url: "blob:w", duration: 0.8 },
    { id: "h", name: "impact-01.mp3", type: "audio/mpeg", url: "blob:h" },
    { id: "x", name: "ambiente.wav", type: "audio/wav", url: "blob:x", duration: 12 },
    { id: "off", name: "pop.wav", type: "audio/wav", offline: true },
    { id: "img", name: "foto.png", type: "image/png", url: "blob:img" },
  ];

  it("classifica os sons pelo nome do arquivo", () => {
    expect(["Whoosh 1", "swoosh", "Big HIT", "riser", "transição", "click", "pop", "glitch", "UI beep", "bass drop", "trailer braam", "chuva"].map(soundCategory)).toEqual([
      "Whoosh",
      "Swoosh",
      "Hit",
      "Rise",
      "Transição",
      "Click",
      "Pop",
      "Glitch",
      "UI",
      "Grave",
      "Cinemático",
      "Outros",
    ]);
    const tool = mmfilmCatalogue({ media }).tools.find((item) => item.id === "sfx.library");
    expect(tool.params[0].options.map(([value]) => value)).toEqual(["todas", "Whoosh", "Hit", "Outros", "Pop"]);
  });

  it("lista com prévia e coloca os marcados em sequência a partir do indicador", async () => {
    const base = state([clip("voz", "A1", 0, 10)], { media, playhead: 2 });
    const listed = await runMMFilmTool("sfx.library", base, {}, {});
    expect(listed).toMatchObject({ ok: true, count: 0, summary: expect.stringMatching(/marque os sons/) });
    expect(listed.items.map((item) => [item.id, item.timecode, item.preview, item.badge])).toEqual([
      ["w", "Whoosh", true, "0,8 s"],
      ["h", "Hit", true, undefined],
      ["x", "Outros", true, "12,0 s"],
    ]);
    const placed = await runMMFilmTool("sfx.library", base, { selectedItems: ["w", "x"], volume: 0 }, {});
    const sounds = placed.clips.filter((item) => item.track === "A3");
    expect(sounds.map((item) => [item.name, item.start, item.duration, item.volume])).toEqual([
      ["Whoosh rápido.wav", 2, 0.8, 100],
      ["ambiente.wav", 2.8, 3, 100],
    ]);
    expect(placed.summary).toBe("2 som(ns) colocado(s) em A3 a partir de 00:02,00");
    const noPlayhead = await runMMFilmTool("sfx.library", { ...base, playhead: undefined }, { selectedItems: ["h"], track: "A2" }, {});
    expect(noPlayhead.clips.find((item) => item.track === "A2")).toMatchObject({ start: 0, duration: 3, assetId: "h" });
  });

  it("explica faixa ocupada, faixa bloqueada e falta de sons", async () => {
    const busy = state([clip("ocupa", "A3", 1, 5)], { media, playhead: 2 });
    expect((await runMMFilmTool("sfx.library", busy, { selectedItems: ["w"] }, {})).summary).toMatch(/A faixa A3 está ocupada em 00:02,00/);
    expect((await runMMFilmTool("sfx.library", { ...busy, trackState: { A3: { locked: true } } }, { selectedItems: ["w"] }, {})).summary).toBe(
      "A faixa A3 está bloqueada.",
    );
    expect((await runMMFilmTool("sfx.library", state([]), {}, {})).summary).toMatch(/^Nenhum som no projeto/);
    expect((await runMMFilmTool("sfx.library", state([], { media }), { category: "Glitch" }, {})).summary).toBe("Nenhum som na categoria “Glitch”.");
    expect((await runMMFilmTool("sfx.library", state([], { media }), { category: "Hit" }, {})).headline).toEqual({ count: 1, text: "som(ns) em Hit" });
  });
});
