import { describe, expect, it, vi } from "vitest";
import { MMFILM_TABS, mmfilmCatalogue, runMMFilmTool, timecode } from "./mmfilmMcpTools";

const RATE = 1000;
const LOUD = 0.5; // ≈ −6 dBFS
const QUIET = 0.001; // −60 dBFS

// AudioBuffer falso: trechos [segundos, amplitude] em sequência, a 1000 Hz.
function fakeBuffer(parts) {
  const length = Math.round(parts.reduce((sum, [seconds]) => sum + seconds, 0) * RATE);
  const data = new Float32Array(length);
  let position = 0;
  parts.forEach(([seconds, amplitude]) => {
    const count = Math.round(seconds * RATE);
    data.fill(amplitude, position, position + count);
    position += count;
  });
  return { sampleRate: RATE, length, numberOfChannels: 1, getChannelData: () => data };
}

// Ambiente real da ferramenta, com os buffers decodificados indexados pela URL da mídia.
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

// Fala 1 s, silêncio 1 s, fala 1 s.
const speechWithGap = fakeBuffer([[1, LOUD], [1, QUIET], [1, LOUD]]);

describe("formatação", () => {
  it("timecode mm:ss,cc e nunca negativo", () => {
    expect(timecode(65.25)).toBe("01:05,25");
    expect(timecode(-3)).toBe("00:00,00");
    expect(timecode(1.15)).toBe("00:01,15");
    expect(timecode(3.8)).toBe("00:03,80");
    expect(timecode(3599.99)).toBe("59:59,99");
  });

  it("catálogo lista as abas, as ferramentas e os sons do projeto", () => {
    const catalogue = mmfilmCatalogue({
      media: [
        { id: "s1", name: "Whoosh", type: "audio/wav" },
        { id: "s2", name: "Pop", type: "audio/mpeg", offline: true },
        { id: "img", name: "Foto", type: "image/png" },
        { id: "x", name: "Sem tipo" },
      ],
    });
    expect(catalogue.tabs).toBe(MMFILM_TABS);
    const sfx = catalogue.tools.find((tool) => tool.id === "sfx.auto");
    expect(sfx.params.find((param) => param.key === "cutSounds").options).toEqual([["s1", "Whoosh"], ["s2", "Pop (offline)"]]);
    expect(catalogue.tools.map((tool) => tool.id)).toContain("autoedit");
    expect(mmfilmCatalogue().tools).toHaveLength(catalogue.tools.length);
    expect(mmfilmCatalogue({}).tools.find((tool) => tool.id === "sfx.auto").params.find((param) => param.key === "cutSounds").options).toEqual([]);
  });
});

describe("execução das ferramentas", () => {
  it("ferramenta desconhecida não executa nada", async () => {
    expect(await runMMFilmTool("nada", state([]), {}, envWith({}))).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
  });

  it("erros inesperados sobem para quem chamou", async () => {
    const env = { loadBuffers: async () => Promise.reject(new Error("falha de rede")) };
    await expect(runMMFilmTool("silence.remove", state([clip("voz", "A1", 0, 3)]), null, env)).rejects.toThrow("falha de rede");
    await expect(runMMFilmTool("autoedit", state([clip("voz", "A1", 0, 3)]), null, env)).rejects.toThrow("falha de rede");
  });
});

describe("silêncios", () => {
  const base = () =>
    state(
      [
        clip("voz", "A1", 0, 3, { assetId: "cam" }),
        clip("cam", "V1", 0, 3, { assetId: "cam" }),
        clip("musica", "A2", 0, 3),
      ],
      { markers: [0.5, 1.5, 2.5] },
    );

  it("remove o silêncio em todas as faixas, desloca marcadores e protege a música", async () => {
    const env = envWith({ voz: speechWithGap });
    const result = await runMMFilmTool("silence.remove", base(), {}, env);
    // O som do vídeo vinculado ao mesmo recurso em A1 não é lido duas vezes.
    expect(env.loadBuffers.mock.calls[0][0].map((item) => item.id)).toEqual(["voz"]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.summary).toMatch(/^1 silêncio\(s\) · −0,73 s · limiar .* \(auto · ruído −?-60,0 dB · fala -6,0 dB\)$/);
    expect(result.details).toEqual(["00:01,15 → 00:01,88 (0,73 s)"]);
    const voice = result.clips.filter((item) => item.track === "A1");
    expect(voice.map((item) => [item.start, item.duration].map((value) => Math.round(value * 100) / 100))).toEqual([
      [0, 1.15],
      [1.15, 1.12],
    ]);
    expect(result.clips.find((item) => item.id === "musica")).toMatchObject({ start: 0, duration: 3 });
    expect(result.markers.map((time) => Math.round(time * 100) / 100)).toEqual([0.5, 1.15, 1.77]);
  });

  it("faixas bloqueadas ficam intactas e sem faixa de música tudo é cortado", async () => {
    const result = await runMMFilmTool(
      "silence.remove",
      { ...base(), trackState: { V1: { locked: true } } },
      { musicTracks: null },
      envWith({ voz: speechWithGap }),
    );
    expect(result.clips.find((item) => item.id === "cam")).toMatchObject({ start: 0, duration: 3 });
    expect(result.clips.filter((item) => item.track === "A2")).toHaveLength(2);
  });

  it("limiar manual: sem trechos abaixo dele, nada é removido", async () => {
    const result = await runMMFilmTool("silence.remove", base(), { thresholdMode: "manual", threshold: -70 }, envWith({ voz: speechWithGap }));
    expect(result).toMatchObject({ ok: true, count: 0, summary: "Nenhum silêncio encontrado (limiar -70,0 dB, manual). Tente aumentar a sensibilidade." });
    expect(result.waveform.regions).toEqual([]);
    expect(result.clips).toBeUndefined();
  });

  it("explica quando não há o que analisar", async () => {
    const env = envWith({ voz: speechWithGap });
    expect(await runMMFilmTool("silence.remove", state([]), {}, env)).toMatchObject({ ok: false, summary: expect.stringContaining("timeline está vazia") });
    expect(await runMMFilmTool("silence.remove", base(), { scope: "selection" }, env)).toMatchObject({
      ok: false,
      summary: expect.stringContaining("Selecione um ou mais clipes"),
    });
    expect(await runMMFilmTool("silence.remove", base(), { analysisTracks: null }, env)).toMatchObject({
      ok: false,
      summary: expect.stringContaining("Nenhum clipe com som"),
    });
    expect(await runMMFilmTool("silence.remove", base(), {}, envWith({}))).toMatchObject({
      ok: false,
      summary: expect.stringContaining("Não foi possível ler o áudio"),
    });
  });

  it("trecho dos clipes selecionados", async () => {
    const result = await runMMFilmTool("silence.remove", { ...base(), selectedIds: ["voz"] }, { scope: "selection" }, envWith({ voz: speechWithGap }));
    expect(result.count).toBe(1);
  });
});

describe("cortes nas pausas", () => {
  const pauses = fakeBuffer([[2, LOUD], [0.4, QUIET], [2, LOUD]]);
  const base = () => state([clip("voz", "A1", 0, 4.4), clip("musica", "A2", 0, 4.4)]);

  it("divide os clipes no meio da pausa sem apagar nada e sem cortar a música", async () => {
    const result = await runMMFilmTool("cuts.pauses", base(), {}, envWith({ voz: pauses }));
    expect(result).toMatchObject({ ok: true, count: 1, summary: "1 corte(s) nas pausas da fala · nada foi apagado", details: ["Corte em 00:02,20"] });
    expect(result.clips.filter((item) => item.track === "A1").map((item) => item.duration)).toEqual([2.2, expect.closeTo(2.2)]);
    expect(result.clips.filter((item) => item.track === "A2")).toHaveLength(1);
    const unprotected = await runMMFilmTool("cuts.pauses", base(), { musicTracks: null }, envWith({ voz: pauses }));
    expect(unprotected.clips.filter((item) => item.track === "A2")).toHaveLength(2);
  });

  it("sem pausas não altera a timeline", async () => {
    const result = await runMMFilmTool("cuts.pauses", base(), {}, envWith({ voz: fakeBuffer([[4.4, LOUD]]) }));
    expect(result).toMatchObject({ ok: true, count: 0 });
    expect(result.summary).toBe("Nenhum ponto de corte encontrado nas pausas da fala.");
    expect(result.clips).toBeUndefined();
  });
});

describe("zoom automático", () => {
  const takes = (count, duration = 2) =>
    Array.from({ length: count }, (_, index) => clip(`t${index}`, "V1", index * duration, duration, index === 2 ? { name: "" } : {}));

  it("aplica zoom em takes espaçados", async () => {
    const result = await runMMFilmTool(
      "motion.autozoom",
      state([...takes(6), clip("titulo", "V1", 0, 2, { type: "text/title" }), clip("som", "V1", 0, 2, { type: "audio/wav" }), clip("x", "V1", 0, 2, { enabled: false })]),
      {},
      envWith({}),
    );
    expect(result).toMatchObject({ ok: true, count: 2, summary: "Zoom em 2 de 6 takes (0 afastando)" });
    expect(result.details).toEqual(["00:04,00 · take · aproximar", "00:10,00 · t5 · aproximar"]);
    expect(result.clips.find((item) => item.id === "t2").motion.scale).toHaveLength(3);
    expect(result.clips.find((item) => item.id === "t0").motion).toBeUndefined();
  });

  it("faixa bloqueada, poucos takes ou takes curtos", async () => {
    expect(await runMMFilmTool("motion.autozoom", state(takes(6), { trackState: { V1: { locked: true } } }), {}, envWith({}))).toEqual({
      ok: false,
      summary: "A faixa V1 está bloqueada.",
    });
    expect((await runMMFilmTool("motion.autozoom", state(takes(1)), {}, envWith({}))).summary).toMatch(/pelo menos 2 takes de vídeo em V1/);
    expect(await runMMFilmTool("motion.autozoom", state([...takes(6, 0.5), clip("semtipo", "V2", 0, 1, { type: undefined })]), {}, envWith({}))).toEqual({
      ok: true,
      count: 0,
      summary: "Nenhum take longo o bastante para o zoom (mínimo 1 s).",
    });
  });
});

describe("movimentos nos clipes selecionados", () => {
  const base = () =>
    state(
      [
        clip("v1", "V1", 0, 2),
        clip("img", "V3", 0, 2, { type: undefined }),
        clip("a1", "A1", 0, 2),
        clip("trava", "V2", 0, 2),
        clip("fora", "V1", 2, 2),
      ],
      { selectedIds: ["v1", "img", "a1", "trava"], trackState: { V2: { locked: true } } },
    );

  it.each([
    ["motion.punch", "Punch in", "scale"],
    ["motion.zoom", "Zoom suave", "scale"],
    ["motion.shake", "Camera shake", "x"],
    ["motion.pan", "Pan", "x"],
    ["motion.rotate", "Rotação", "rotation"],
  ])("%s aplica só em vídeo/imagem/título de faixas V desbloqueadas", async (toolId, label, property) => {
    const result = await runMMFilmTool(toolId, base(), {}, envWith({}));
    expect(result).toMatchObject({ ok: true, count: 2, summary: `${label} aplicado em 2 clipe(s)` });
    const byId = Object.fromEntries(result.clips.map((item) => [item.id, item]));
    expect(byId.v1.motion[property]).toBeDefined();
    expect(byId.img.motion[property]).toBeDefined();
    expect(byId.a1.motion).toBeUndefined();
    expect(byId.trava.motion).toBeUndefined();
    expect(byId.fora.motion).toBeUndefined();
  });

  it("parâmetros de intensidade e direção chegam ao movimento", async () => {
    const result = await runMMFilmTool("motion.pan", base(), { direction: "left", intensity: 10 }, envWith({}));
    expect(result.clips[0].motion.x).toEqual([[0, 120, "ease"], [2, -120]]);
  });

  it("sem seleção válida explica o que fazer", async () => {
    const result = await runMMFilmTool("motion.punch", { ...base(), selectedIds: ["a1"] }, {}, envWith({}));
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/^Selecione um ou mais clipes de vídeo/);
  });

  it("remover movimento", async () => {
    const withMotion = base();
    withMotion.clips[0] = { ...withMotion.clips[0], motion: { scale: [[0, 1]] } };
    withMotion.clips[4] = { ...withMotion.clips[4], motion: { scale: [[0, 1]] } };
    const result = await runMMFilmTool("motion.reset", withMotion, {}, envWith({}));
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Movimento removido de 1 clipe(s)" });
    expect("motion" in result.clips[0]).toBe(false);
    expect(result.clips[4].motion).toBeDefined();
    expect(await runMMFilmTool("motion.reset", base(), {}, envWith({}))).toEqual({ ok: true, count: 0, summary: "Os clipes selecionados não têm movimento." });
  });
});

describe("normalização", () => {
  const buffers = {
    voz: fakeBuffer([[1, LOUD]]),
    baixo: fakeBuffer([[1, 0.01]]),
    mudo: fakeBuffer([[1, 0]]),
  };
  const base = () =>
    state([
      clip("voz", "A1", 0, 1),
      clip("baixo", "A1", 1, 1, { name: "" }),
      clip("mudo", "A1", 2, 1),
      clip("perdido", "A1", 3, 1, { name: undefined }),
      clip("trava", "A2", 0, 1),
    ], { trackState: { A2: { locked: true } } });

  it("nivela cada clipe ao alvo e explica os limitados e os ilegíveis", async () => {
    const result = await runMMFilmTool("audio.normalize", base(), { tracks: ["A1", "A2"] }, envWith(buffers));
    expect(result).toMatchObject({ ok: true, count: 2, summary: "2 clipe(s) nivelado(s) para -18,0 dB (pico ≤ -1,0 dB)" });
    expect(result.details).toEqual([
      "voz: -6,0 dB → volume 25%",
      "clipe: -40,0 dB → volume 200% (limitado pelo volume máximo)",
      "mudo: sem som legível, mantido",
      "clipe: sem som legível, mantido",
    ]);
    const byId = Object.fromEntries(result.clips.map((item) => [item.id, item]));
    expect(byId.voz.volume).toBe(25);
    expect(byId.baixo.volume).toBe(200);
    expect(byId.mudo.volume).toBe(100);
    expect(byId.trava.volume).toBe(100);
  });

  it("só a seleção, quando pedido", async () => {
    const result = await runMMFilmTool("audio.normalize", { ...base(), selectedIds: ["voz"] }, { scope: "selection" }, envWith(buffers));
    expect(result.count).toBe(1);
    expect(await runMMFilmTool("audio.normalize", base(), { scope: "selection" }, envWith(buffers))).toMatchObject({
      ok: false,
      summary: expect.stringContaining("Selecione um ou mais clipes"),
    });
  });

  it("sem clipes com som ou sem nenhum medido", async () => {
    expect((await runMMFilmTool("audio.normalize", base(), { tracks: null }, envWith(buffers))).summary).toBe(
      "Nenhum clipe com som (online) nas faixas escolhidas.",
    );
    const none = await runMMFilmTool("audio.normalize", state([clip("mudo", "A1", 0, 1)]), {}, envWith(buffers));
    expect(none).toEqual({ ok: true, count: 0, summary: "Nenhum clipe pôde ser medido.", details: ["mudo: sem som legível, mantido"] });
  });
});

describe("ducking", () => {
  const base = () =>
    state([
      clip("voz", "A1", 0, 3),
      clip("musica", "A2", 0, 3),
      clip("efeito", "A2", 0, 1, { sfx: true }),
      clip("off", "A2", 1, 1, { enabled: false }),
    ]);

  it("cria a curva de volume nos clipes de música durante a voz", async () => {
    const result = await runMMFilmTool("audio.duck", base(), { autoDetect: false, voiceTracks: ["A1", "A2"] }, envWith({ voz: speechWithGap }));
    expect(result).toMatchObject({ ok: true, count: 2, summary: "Música abaixa -12,0 dB em 2 trecho(s) de voz · 1 clipe(s) de música" });
    expect(result.details).toEqual(["Voz 00:00,00 → 00:01,00", "Voz 00:02,00 → 00:03,00"]);
    const byId = Object.fromEntries(result.clips.map((item) => [item.id, item]));
    expect(byId.musica.gainKeys[0]).toEqual([0, -12]);
    expect(byId.efeito.gainKeys).toBeUndefined();
    expect(byId.voz.gainKeys).toBeUndefined();
  });

  it("sem música desbloqueada, sem faixas de voz ou sem voz", async () => {
    const locked = { ...base(), trackState: { A2: { locked: true } } };
    expect((await runMMFilmTool("audio.duck", locked, { autoDetect: false }, envWith({ voz: speechWithGap }))).summary).toBe(
      "Nenhum clipe de música nas faixas escolhidas (desbloqueadas).",
    );
    expect((await runMMFilmTool("audio.duck", base(), { autoDetect: false, musicTracks: null }, envWith({}))).ok).toBe(false);
    expect((await runMMFilmTool("audio.duck", base(), { autoDetect: false, voiceTracks: null }, envWith({}))).summary).toMatch(/^Nenhum clipe com som/);
    expect(await runMMFilmTool("audio.duck", base(), { autoDetect: false, thresholdMode: "manual", threshold: 0 }, envWith({ voz: speechWithGap }))).toEqual({
      ok: true,
      count: 0,
      summary: "Nenhum trecho de voz encontrado nas faixas de voz.",
    });
  });

  it("remover ducking respeita faixas bloqueadas", async () => {
    const keys = [[0, -12]];
    const clips = [clip("m1", "A2", 0, 1, { gainKeys: keys }), clip("m2", "A3", 0, 1, { gainKeys: keys }), clip("voz", "A1", 0, 1)];
    const result = await runMMFilmTool("audio.unduck", state(clips, { trackState: { A3: { locked: true } } }), {}, envWith({}));
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Ducking removido de 1 clipe(s)" });
    expect("gainKeys" in result.clips[0]).toBe(false);
    expect(result.clips[1].gainKeys).toBe(keys);
    expect(result.clips[2]).toBe(clips[2]);
    expect(await runMMFilmTool("audio.unduck", state([clip("voz", "A1", 0, 1)]), {}, envWith({}))).toEqual({ ok: true, count: 0, summary: "Nenhum clipe com ducking." });
  });
});

describe("SFX automático", () => {
  const media = [
    { id: "w1", assetId: "asset-w1", mediaDuration: 0.6, name: "whoosh1", type: "audio/wav", url: "w1", duration: 0.6 },
    { id: "w2", name: "whoosh2", type: "audio/wav", url: "w2" },
    { id: "p1", name: "pop", type: "audio/wav", url: "p1", duration: 0.3 },
    { id: "p2", name: "pop2", type: "audio/wav", url: "p2", duration: 0.3 },
    { id: "off", name: "offline", type: "audio/wav", url: "off", offline: true },
  ];
  const timeline = () =>
    state(
      [
        clip("t1", "V1", 0, 2),
        clip("t2", "V1", 2, 2),
        clip("t3", "V1", 4, 2),
        clip("t4", "V1", 6, 2),
        clip("titulo", "V2", 5, 2, { type: "text/title" }),
        clip("titulo2", "V2", 9, 2, { type: "text/title" }),
        clip("antigo", "A3", 12, 1, { sfx: true }),
        clip("meu", "A3", 9, 1),
      ],
      { media },
    );
  const params = { cutSounds: ["w1", "w2", "off"], textSounds: ["p1", "p2"] };

  it("alterna os sons nos cortes e títulos, pula faixa ocupada e substitui os anteriores", async () => {
    const result = await runMMFilmTool("sfx.auto", timeline(), params, envWith({}));
    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
    expect(result.summary).toBe("3 som(ns) em A3 · 2 pulado(s): faixa ocupada · sons automáticos anteriores substituídos");
    expect(result.details).toEqual(["00:01,75 · whoosh1", "00:03,75 · whoosh2", "00:05,75 · whoosh1"]);
    const placed = result.clips.filter((item) => item.sfx);
    expect(placed.map((item) => [item.start, item.duration, item.volume])).toEqual([
      [1.75, 0.6, 50],
      [3.75, 1.5, 50],
      [5.75, 0.6, 50],
    ]);
    expect(placed[0]).toMatchObject({ assetId: "asset-w1", mediaDuration: 0.6, track: "A3", sourceIn: 0, speed: 100 });
    expect(placed[1]).toMatchObject({ assetId: "w2", mediaDuration: undefined });
    expect(result.clips.some((item) => item.id === "antigo")).toBe(false);
    expect(result.clips.some((item) => item.id === "meu")).toBe(true);
  });

  it("sem sons de título, só os cortes recebem som", async () => {
    const result = await runMMFilmTool("sfx.auto", timeline(), { cutSounds: ["w1"], textSounds: null, minGap: 0.3, maxLength: 0.4 }, envWith({}));
    expect(result.details).toEqual(["00:01,80 · whoosh1", "00:03,80 · whoosh1", "00:05,80 · whoosh1"]);
  });

  it("cortes em outra faixa (edição só de voz em A1), sem contar os sons automáticos", async () => {
    const voice = state(
      [clip("v1", "A1", 0, 2), clip("v2", "A1", 2, 2), clip("velho", "A1", 4, 1, { sfx: true }), clip("v3", "A1", 5, 2)],
      { media },
    );
    const result = await runMMFilmTool("sfx.auto", voice, { cutSounds: ["w1"], titles: false, cutTrack: "A1" }, envWith({}));
    expect(result.details).toEqual(["00:01,75 · whoosh1"]);
    expect((await runMMFilmTool("sfx.auto", voice, { cutSounds: ["w1"], titles: false, cutTrack: "V2" }, envWith({}))).summary).toBe(
      "Nenhum corte entre takes em V2 nem entrada de título encontrados para receber sons.",
    );
  });

  it("explica faixa bloqueada, falta de sons e falta de pontos", async () => {
    expect(await runMMFilmTool("sfx.auto", { ...timeline(), trackState: { A3: { locked: true } } }, params, envWith({}))).toEqual({
      ok: false,
      summary: "A faixa A3 está bloqueada.",
    });
    expect((await runMMFilmTool("sfx.auto", timeline(), { cutSounds: null }, envWith({}))).summary).toMatch(/^Escolha os sons/);
    expect(await runMMFilmTool("sfx.auto", state([clip("t1", "V1", 0, 2)], { media }), { ...params, titles: false }, envWith({}))).toEqual({
      ok: true,
      count: 0,
      summary: "Nenhum corte entre takes em V1 nem entrada de título encontrados para receber sons.",
    });
  });

  it("limpar SFX remove só os sons automáticos de faixas desbloqueadas", async () => {
    const clips = [clip("s1", "A3", 0, 1, { sfx: true }), clip("s2", "A2", 0, 1, { sfx: true }), clip("meu", "A3", 2, 1)];
    const result = await runMMFilmTool("sfx.clear", state(clips, { trackState: { A2: { locked: true } } }), {}, envWith({}));
    expect(result).toEqual({ ok: true, count: 1, clips: [clips[1], clips[2]], summary: "1 som(ns) automático(s) removido(s)" });
    expect(await runMMFilmTool("sfx.clear", state([clips[2]]), {}, envWith({}))).toEqual({ ok: true, count: 0, summary: "Nenhum som automático na timeline." });
  });
});

describe("Auto Edit", () => {
  const timeline = (extra = []) =>
    state([clip("voz", "A1", 0, 3), clip("cam", "V1", 0, 3, { url: "" }), ...extra], { markers: [2.5] });

  it("roda as etapas padrão em sequência, explica as puladas e vira uma só alteração", async () => {
    const steps = { sync: false, fillers: false, cuts: false, captions: false, titles: false, normalize: true };
    const result = await runMMFilmTool("autoedit", timeline([clip("musica", "A2", 0, 3)]), steps, envWith({ voz: speechWithGap, musica: fakeBuffer([[3, LOUD]]) }));
    expect(result.ok).toBe(true);
    expect(result.count).toBe(4);
    expect(result.summary).toBe("Auto Edit concluído em 4 etapa(s) · um único “Desfazer” volta tudo");
    expect(result.details[0]).toMatch(/^Remover silêncios: 1 silêncio\(s\)/);
    expect(result.details[1]).toBe("Auto Zoom: Nenhum take longo o bastante para o zoom (mínimo 1 s).");
    expect(result.details[2]).toMatch(/^Auto Ducking: Música abaixa/);
    expect(result.details[3]).toMatch(/^Normalizar áudio: \d clipe\(s\) nivelado\(s\)/);
    expect(result.markers.map((time) => Math.round(time * 100) / 100)).toEqual([1.77]);
    const music = result.clips.find((item) => item.id === "musica");
    expect(music.duration).toBe(3);
    expect(music.gainKeys.length).toBeGreaterThan(0);
  });

  it("etapa sem condição é pulada com a explicação", async () => {
    const steps = { sync: false, silences: false, fillers: false, zoom: false, captions: false, titles: false, normalize: false, cuts: true };
    const result = await runMMFilmTool("autoedit", timeline(), steps, envWith({ voz: fakeBuffer([[3, LOUD]]) }));
    expect(result.details).toEqual([
      "Detectar cortes: Nenhum ponto de corte encontrado nas pausas da fala.",
      expect.stringMatching(/^Auto Ducking: pulado — Nenhuma trilha de voz detectada/),
    ]);
    expect(result.summary).toBe("Auto Edit não alterou a timeline.");
    expect(result.clips).toBeUndefined();
    expect(result.markers).toBeUndefined();
  });

  it("sem etapas ligadas não há o que fazer", async () => {
    const off = { sync: false, silences: false, fillers: false, cuts: false, multicam: false, zoom: false, captions: false, titles: false, ducking: false, normalize: false, sfx: false };
    expect(await runMMFilmTool("autoedit", timeline(), off, envWith({}))).toEqual({ ok: false, summary: "Ligue pelo menos uma etapa do Auto Edit." });
  });
});
