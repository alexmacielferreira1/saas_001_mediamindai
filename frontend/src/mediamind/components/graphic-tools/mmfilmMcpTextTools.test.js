import { afterEach, describe, expect, it, vi } from "vitest";
import { CAPTION_TEMPLATES } from "../../lib/mmfilmCaptions";
import { mmfilmCatalogue, runMMFilmTool } from "./mmfilmMcpTools";
import { CAPTION_FONTS, captionCuesFrom } from "./mmfilmMcpTextTools";

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

function envWith(buffers) {
  const loadBuffers = vi.fn(async (clips) => new Map(clips.filter((clip) => buffers[clip.url]).map((clip) => [clip.url, buffers[clip.url]])));
  return { loadBuffers };
}

const media = (id, track, start, duration, extra = {}) => ({
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

const caption = (id, start, duration, text, extra = {}) => ({
  id,
  name: text,
  type: "text/title",
  caption: true,
  track: "V3",
  start,
  duration,
  sourceIn: 0,
  speed: 100,
  text,
  ...extra,
});

const state = (clips, extra = {}) => ({ clips, markers: [], selectedIds: [], trackState: {}, media: [], ...extra });
const noEnv = envWith({});

afterEach(() => {
  delete document.fonts;
  vi.restoreAllMocks();
});

describe("catálogo de texto", () => {
  it("expõe as ferramentas, as fontes e a faixa de legendas configurável", () => {
    const tools = mmfilmCatalogue({ targets: { captions: "V2" } }).tools;
    const create = tools.find((tool) => tool.id === "captions.create");
    expect(create.params.find((param) => param.key === "track").default).toBe("V2");
    expect(create.params.find((param) => param.key === "font").options).toHaveLength(CAPTION_FONTS.length + 1);
    expect(create.params.find((param) => param.key === "template").options[0][0]).toBe(CAPTION_TEMPLATES[0].id);
    const titles = tools.find((tool) => tool.id === "titles.create");
    expect(titles.params.find((param) => param.key === "animation").options[0]).toEqual(["nenhuma", "Sem animação"]);
    expect(tools.find((tool) => tool.id === "transcribe.run").status).toBe("soon");
  });

  it("captionCuesFrom lê só legendas, em ordem, e trata texto ausente", () => {
    const cues = captionCuesFrom([
      caption("b", 2, 1, "dois"),
      media("cam", "V1", 0, 5),
      caption("a", 0, 1.5, undefined),
      { ...caption("t", 1, 1, "título"), caption: false },
    ]);
    expect(cues).toEqual([
      { start: 0, end: 1.5, text: "" },
      { start: 2, end: 3, text: "dois" },
    ]);
  });
});

describe("captions.create", () => {
  const timeline = () =>
    state([
      media("cam", "V1", 0, 6),
      caption("old-1", 0, 2, "Olá pessoal tudo bem."),
      caption("old-2", 2, 2, "Hoje vamos falar de edição"),
    ]);

  it("cria legendas em linhas a partir do SRT da timeline e substitui as antigas", async () => {
    vi.spyOn(Date, "now").mockReturnValue(36 ** 3);
    const result = await runMMFilmTool("captions.create", timeline(), {}, noEnv);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
    expect(result.clips.filter((clip) => clip.id.startsWith("old"))).toHaveLength(0);
    expect(result.clips[0].id).toBe("cam");
    const created = result.clips.filter((clip) => clip.caption);
    expect(created.map((clip) => clip.id)).toEqual(["legenda-1000-1", "legenda-1000-2"]);
    expect(created.every((clip) => clip.track === "V3")).toBe(true);
    expect(created[0].captionStyle).toMatchObject({ id: CAPTION_TEMPLATES[0].id, font: CAPTION_TEMPLATES[0].font });
    expect(result.headline).toEqual({ count: 2, text: `legenda(s) em V3 · ${CAPTION_TEMPLATES[0].name}` });
    expect(result.summary).toBe(`2 legenda(s) em até 2 linha(s) com o template “${CAPTION_TEMPLATES[0].name}”`);
    expect(result.details[0]).toBe("00:00,00 · Olá pessoal tudo bem.");
  });

  it("palavra por palavra com estilo próprio (fonte, cor, tamanho, alinhamento e caixa)", async () => {
    const result = await runMMFilmTool(
      "captions.create",
      timeline(),
      { mode: "palavra", template: "mm-tarja-escura", font: "Arial", fill: "#FF0000", size: "40", align: "left", box: "nao", uppercase: true, track: "V2" },
      noEnv,
    );
    expect(result.count).toBe(9);
    expect(result.summary).toBe("9 legenda(s) palavra por palavra com o template “Tarja Escura”");
    const first = result.clips.find((clip) => clip.caption);
    expect(first).toMatchObject({ text: "OLÁ", track: "V2" });
    expect(first.captionStyle).toMatchObject({ font: "Arial", fill: "#FF0000", size: 40, align: "left", box: false, weight: 700 });
  });

  it("caixa ligada e campos 'template' mantêm o estilo do template", async () => {
    const result = await runMMFilmTool("captions.create", timeline(), { template: "mm-contorno-fino", box: "sim", font: "template", align: "template" }, noEnv);
    const style = result.clips.find((clip) => clip.caption).captionStyle;
    expect(style).toMatchObject({ box: true, font: "Inter", align: "center", size: 54 });
  });

  it("avisa quando a fonte não está instalada", async () => {
    const check = vi.fn(() => false);
    Object.defineProperty(document, "fonts", { value: { check }, configurable: true });
    const result = await runMMFilmTool("captions.create", timeline(), { font: "Impact" }, noEnv);
    expect(check).toHaveBeenCalledWith('16px "Impact"');
    expect(result.summary).toContain("Fonte “Impact” não instalada neste computador");
  });

  it("usa as palavras da transcrição quando existem", async () => {
    const transcript = { words: [{ word: "Transcrito", start: 1, end: 1.5 }, { word: "aqui", start: 1.5, end: 2 }] };
    const result = await runMMFilmTool("captions.create", state([], { transcript }), {}, noEnv);
    expect(result.clips).toHaveLength(1);
    expect(result.clips[0]).toMatchObject({ text: "Transcrito aqui", start: 1 });
  });

  it("transcrição sem palavras cai nas legendas; sem texto algum explica o motivo", async () => {
    const empty = await runMMFilmTool("captions.create", state([media("cam", "V1", 0, 3)], { transcript: { words: [] } }), {}, noEnv);
    expect(empty).toEqual({ ok: false, summary: "Sem texto na timeline: importe um SRT (rodapé › Importar SRT) ou transcreva antes." });
    const fallback = await runMMFilmTool("captions.create", { ...timeline(), transcript: { words: [] } }, {}, noEnv);
    expect(fallback.count).toBe(2);
  });

  it("palavras vazias não geram legenda", async () => {
    const transcript = { words: [{ word: "   ", start: 0, end: 1 }] };
    expect(await runMMFilmTool("captions.create", state([], { transcript }), {}, noEnv)).toEqual({ ok: true, count: 0, summary: "Nenhuma palavra para legendar." });
  });

  it("faixa bloqueada não recebe legendas", async () => {
    const result = await runMMFilmTool("captions.create", { ...timeline(), trackState: { V3: { locked: true } } }, {}, noEnv);
    expect(result).toEqual({ ok: false, summary: "A faixa V3 está bloqueada." });
  });
});

describe("captions.retemplate e captions.copystyle", () => {
  const styled = { ...CAPTION_TEMPLATES[2], fill: "#123456" };
  const timeline = (extra = {}) =>
    state(
      [
        media("cam", "V1", 0, 6),
        caption("c1", 0, 2, "um", { captionStyle: styled }),
        caption("c2", 2, 2, "dois", { captionStyle: CAPTION_TEMPLATES[0] }),
        caption("trava", 4, 2, "três", { track: "V2", captionStyle: CAPTION_TEMPLATES[0] }),
      ],
      { trackState: { V2: { locked: true } }, ...extra },
    );

  it("troca o template das legendas destravadas e mantém tempos, textos e faixas bloqueadas", async () => {
    const before = timeline();
    const result = await runMMFilmTool("captions.retemplate", before, { template: "mm-maquina", size: 30 }, noEnv);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
    expect(result.headline).toEqual({ count: 2, text: "legenda(s) com o template “Máquina de Escrever”" });
    expect(result.summary).toBe("Template trocado em 2 legenda(s), mesmos tempos e textos");
    expect(result.clips[0]).toBe(before.clips[0]);
    expect(result.clips[1]).toMatchObject({ start: 0, text: "um", captionStyle: { id: "mm-maquina", size: 30 } });
    expect(result.clips[3]).toBe(before.clips[3]);
  });

  it("retemplate avisa da fonte ausente e explica quando não há legenda livre", async () => {
    Object.defineProperty(document, "fonts", { value: { check: () => false }, configurable: true });
    const result = await runMMFilmTool("captions.retemplate", timeline(), { font: "Verdana" }, noEnv);
    expect(result.summary).toContain("Fonte “Verdana” não instalada");
    const none = await runMMFilmTool("captions.retemplate", state([caption("trava", 0, 1, "x", { track: "V2" })], { trackState: { V2: { locked: true } } }), {}, noEnv);
    expect(none).toEqual({ ok: false, summary: "Não há legendas (desbloqueadas) na timeline para trocar o template." });
  });

  it("copia o estilo da legenda selecionada para as outras destravadas", async () => {
    const result = await runMMFilmTool("captions.copystyle", timeline({ selectedIds: ["cam", "c1"] }), {}, noEnv);
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Estilo de “um” copiado para 1 legenda(s)" });
    expect(result.clips[2].captionStyle).toEqual(styled);
    expect(result.clips[2].captionStyle).not.toBe(styled);
    expect(result.clips[3].captionStyle).toBe(CAPTION_TEMPLATES[0]);
  });

  it("usa o texto quando a legenda não tem nome e explica quando não há outras", async () => {
    const lonely = state([{ ...caption("c1", 0, 2, "sozinha", { captionStyle: styled }), name: "" }], { selectedIds: ["c1"] });
    expect(await runMMFilmTool("captions.copystyle", lonely, {}, noEnv)).toEqual({ ok: true, count: 0, summary: "Não há outras legendas para receber o estilo." });
    const unnamed = state([{ ...caption("c1", 0, 2, "texto", { captionStyle: styled }), name: "" }, caption("c2", 2, 1, "b")], { selectedIds: ["c1"] });
    expect((await runMMFilmTool("captions.copystyle", unnamed, {}, noEnv)).summary).toBe("Estilo de “texto” copiado para 1 legenda(s)");
  });

  it("sem legenda estilizada selecionada não copia nada", async () => {
    const result = await runMMFilmTool("captions.copystyle", timeline({ selectedIds: ["cam"] }), {}, noEnv);
    expect(result).toEqual({ ok: false, summary: "Selecione na timeline uma legenda que já tenha o estilo desejado." });
  });
});

describe("captions.exportsrt e transcrição", () => {
  it("baixa as legendas como SRT com o nome escolhido ou o padrão", async () => {
    const timeline = state([caption("b", 2, 1.5, "segunda"), caption("a", 0, 1, "primeira")]);
    const result = await runMMFilmTool("captions.exportsrt", timeline, { fileName: "captions" }, noEnv);
    expect(result).toEqual({
      ok: true,
      count: 2,
      download: {
        name: "captions.srt",
        type: "application/x-subrip",
        text: "1\n00:00:00,000 --> 00:00:01,000\nprimeira\n\n2\n00:00:02,000 --> 00:00:03,500\nsegunda\n",
      },
      summary: "2 legenda(s) exportada(s) em SRT",
    });
    expect((await runMMFilmTool("captions.exportsrt", timeline, { fileName: "" }, noEnv)).download.name).toBe("legendas.srt");
    expect((await runMMFilmTool("captions.exportsrt", timeline, {}, noEnv)).download.name).toBe("legendas.srt");
  });

  it("sem legendas não exporta", async () => {
    expect(await runMMFilmTool("captions.exportsrt", state([]), {}, noEnv)).toEqual({ ok: false, summary: "Não há legendas na timeline para exportar." });
  });

  it("transcrever ainda está em breve e importar SRT abre o seletor de arquivo", async () => {
    expect(await runMMFilmTool("transcribe.run", state([]), {}, noEnv)).toEqual({ ok: false, summary: "Em breve." });
    expect(await runMMFilmTool("transcribe.importsrt", state([]), {}, noEnv)).toEqual({
      ok: true,
      count: 0,
      openCaptionFile: true,
      summary: "Escolha o arquivo SRT ou VTT na janela que abriu.",
    });
  });
});

describe("fillers.remove", () => {
  // Fala 0–1,1 s, pausa, "ãh" 1,2–1,5 s, pausa, fala 1,6–2 s e silêncio até 3 s.
  const voice = fakeBuffer([
    [1.1, LOUD],
    [0.1, QUIET],
    [0.3, LOUD],
    [0.1, QUIET],
    [0.4, LOUD],
    [1, QUIET],
  ]);
  const withVoice = () =>
    state(
      [
        media("voz", "A1", 0, 3),
        media("musica", "A2", 0, 3),
        caption("c1", 0, 1.1, "falando"),
        caption("c2", 1.2, 0.3, "ãh"),
        caption("c3", 1.6, 0.4, "texto"),
      ],
      { markers: [0.5, 1.8] },
    );

  it("com o áudio da voz corta no meio das pausas, desloca marcadores e protege a música", async () => {
    const env = envWith({ voz: voice, musica: voice });
    const result = await runMMFilmTool("fillers.remove", withVoice(), {}, env);
    expect(env.loadBuffers.mock.calls[0][0].map((clip) => clip.id)).toEqual(["voz"]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.items).toEqual([{ id: "hesitacao-1", time: 1.15, timecode: "00:01,15", label: "hesitação: “ãh”", badge: "hesitação", selected: true }]);
    expect(result.headline).toEqual({ count: 1, text: "vício(s) encontrado(s) · 1 com pausa clara" });
    expect(result.summary).toBe("1 vício(s) cortado(s) · −0,40 s");
    const music = result.clips.filter((clip) => clip.track === "A2");
    expect(music).toHaveLength(1);
    expect(music[0]).toMatchObject({ start: 0, duration: 3 });
    expect(result.clips.filter((clip) => clip.track === "A1")).toHaveLength(2);
    expect(result.markers.map((time) => Math.round(time * 100) / 100)).toEqual([0.5, 1.4]);
  });

  it("sem música protegida e com faixa bloqueada", async () => {
    const result = await runMMFilmTool(
      "fillers.remove",
      { ...withVoice(), trackState: { A1: { locked: true } } },
      { musicTracks: null },
      envWith({ voz: voice, musica: voice }),
    );
    expect(result.count).toBe(1);
    expect(result.clips.filter((clip) => clip.track === "A2")).toHaveLength(2);
    expect(result.clips.filter((clip) => clip.track === "A1")).toEqual([withVoice().clips[0]]);
  });

  const noAudio = () => state([caption("c1", 0, 2, "eu eu fui"), caption("c2", 2, 1, "ãh lá")], { markers: [2.5] });

  it("sem áudio, os itens ficam para conferir e nada é cortado", async () => {
    const result = await runMMFilmTool("fillers.remove", noAudio(), {}, noEnv);
    expect(result).toMatchObject({ ok: true, count: 0, summary: "Nada marcado para cortar: confira a lista e marque os itens." });
    expect(result.items.map((item) => [item.id, item.label, item.badge, item.selected])).toEqual([
      ["repeticao-1", "repetição: “eu” (confira)", "repetida", false],
      ["hesitacao-2", "hesitação: “ãh” (confira)", "hesitação", false],
    ]);
    expect(result.headline.text).toBe("vício(s) encontrado(s) · 0 com pausa clara");
    expect(result.clips).toBeUndefined();
  });

  it("corta os itens marcados pelo usuário", async () => {
    const result = await runMMFilmTool("fillers.remove", noAudio(), { selectedItems: ["repeticao-1", "hesitacao-2"] }, noEnv);
    expect(result.count).toBe(2);
    expect(result.summary).toMatch(/^2 vício\(s\) cortado\(s\) · −\d,\d\d s$/);
    expect(result.markers[0]).toBeLessThan(2.5);
  });

  it("texto limpo não tem vícios; sem texto explica; erros inesperados do áudio sobem", async () => {
    const clean = state([caption("c1", 0, 2, "texto sem nada")]);
    expect(await runMMFilmTool("fillers.remove", clean, {}, noEnv)).toEqual({ ok: true, count: 0, summary: "Nenhum vício de linguagem encontrado no texto da timeline." });
    expect((await runMMFilmTool("fillers.remove", state([]), {}, noEnv)).summary).toContain("Sem texto na timeline");
    const env = { loadBuffers: () => Promise.reject(new Error("falha de leitura")) };
    await expect(runMMFilmTool("fillers.remove", withVoice(), {}, env)).rejects.toThrow("falha de leitura");
  });
});

describe("titles.create", () => {
  const phrases = () =>
    state(
      [
        caption("c1", 0, 0.5, "Isso é INCRÍVEL demais!"),
        caption("c2", 12, 6, "Nunca faça esse erro de novo"),
        caption("c3", 25, 2, "O segredo são 3 passos"),
        media("ocupado", "V2", 25.5, 1, { type: "image/png" }),
      ],
      { selectedIds: [] },
    );

  it("cria títulos nas frases de impacto, pula a faixa ocupada e limita a duração", async () => {
    vi.spyOn(Date, "now").mockReturnValue(35);
    const result = await runMMFilmTool("titles.create", phrases(), { count: "muitos" }, noEnv);
    expect(result.ok).toBe(true);
    expect(result.items.map((item) => item.label)).toEqual(["Isso é INCRÍVEL demais!", "Nunca faça esse erro de novo", "O segredo são 3 passos"]);
    expect(result.items[0]).toMatchObject({ id: "titulo-0", time: 0, timecode: "00:00,00" });
    expect(result.items[0].badge).toMatch(/^nota \d+(,\d+)?$/);
    expect(result.headline).toEqual({ count: 3, text: "frase(s) de impacto" });
    expect(result.count).toBe(2);
    expect(result.summary).toBe("2 título(s) animado(s) em V2 · 1 pulado(s): faixa ocupada");
    const created = result.clips.filter((clip) => clip.titleHighlight);
    expect(created.map((clip) => [clip.id, clip.start, clip.duration, clip.text, clip.textAnimation])).toEqual([
      ["titulo-z-0", 0, 1.2, "ISSO É INCRÍVEL DEMAIS!", "pop-palavras"],
      ["titulo-z-1", 12, 4, "NUNCA FAÇA ESSE ERRO DE NOVO", "pop-palavras"],
    ]);
    expect(created[0].captionStyle).toMatchObject({ id: "mm-vertical-centro", position: "center" });
  });

  it("respeita os itens escolhidos, sem maiúsculas e sem animação", async () => {
    const result = await runMMFilmTool(
      "titles.create",
      phrases(),
      { count: "muitos", selectedItems: ["titulo-1"], uppercase: false, animation: "nenhuma" },
      noEnv,
    );
    expect(result.summary).toBe("1 título(s) animado(s) em V2");
    const created = result.clips.filter((clip) => clip.titleHighlight);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ text: "Nunca faça esse erro de novo", track: "V2", textAnimation: undefined });
  });

  it("usa as palavras da transcrição", async () => {
    const transcript = { words: [{ word: "Atenção", start: 1, end: 1.4 }, { word: "agora!", start: 1.4, end: 2 }] };
    const result = await runMMFilmTool("titles.create", state([], { transcript }), {}, noEnv);
    expect(result.count).toBe(1);
    expect(result.clips[0]).toMatchObject({ text: "ATENÇÃO AGORA!", start: 1, duration: 1.2 });
  });

  it("explica faixa bloqueada, falta de texto e falta de frases de impacto", async () => {
    expect(await runMMFilmTool("titles.create", { ...phrases(), trackState: { V2: { locked: true } } }, {}, noEnv)).toEqual({
      ok: false,
      summary: "A faixa V2 está bloqueada.",
    });
    expect((await runMMFilmTool("titles.create", state([]), {}, noEnv)).summary).toContain("Sem texto na timeline");
    expect(await runMMFilmTool("titles.create", state([caption("c1", 0, 2, "a o e")]), {}, noEnv)).toEqual({
      ok: true,
      count: 0,
      summary: "Nenhuma frase de impacto encontrada.",
    });
  });
});
