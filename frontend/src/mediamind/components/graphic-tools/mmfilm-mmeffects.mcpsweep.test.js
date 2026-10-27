// Varredura de TODAS as ferramentas do MCP do MMFilm e do MMEffects (não é amostra): cada ferramenta roda com
// estado vazio, estado realista, estado "decorado" (com movimento, look, transição, ducking, SFX…) e faixas
// bloqueadas, com os parâmetros padrão e com cada opção de select/chips, cada toggle invertido e cada lista
// múltipla completa. Contrato verificado em cada execução:
// - não lança exceção e não altera o estado recebido;
// - devolve { ok: boolean, summary: texto não vazio };
// - ok:false não traz alteração (clips/markers/patch);
// - ok:true com alteração precisa mudar de fato o estado (sem sucesso falso) e produzir dados válidos;
// - faixas bloqueadas nunca são alteradas.
// O áudio é sintético (AudioBuffer falso com ruído determinístico), como nos testes das bibliotecas: exercita a
// análise real. Sem mídia, as ferramentas de análise têm de responder ok:false com o motivo.
import { describe, expect, it } from "vitest";
import { defaultParams } from "../../lib/mcpActions";
import { mmfilmCatalogue, runMMFilmTool } from "./mmfilmMcpTools";
import { mmeffectsCatalogue, runMMEffectsTool } from "./mmeffectsMcpTools";

const RATE = 1000;
const ASSET = "11111111-2222-4333-8444-555555555555";
const CAM2 = "22222222-3333-4444-8555-666666666666";

// ---------------------------------------------------------------- utilidades
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

// Trechos [segundos, amplitude] com ruído (para a correlação da sincronização ter o que comparar).
function signal(parts, seed) {
  const next = random(seed);
  const data = new Float32Array(Math.round(parts.reduce((sum, [seconds]) => sum + seconds, 0) * RATE));
  let position = 0;
  parts.forEach(([seconds, amplitude]) => {
    const count = Math.round(seconds * RATE);
    for (let i = 0; i < count; i += 1) data[position + i] = (next() - 0.5) * 2 * amplitude;
    position += count;
  });
  return data;
}
const buffer = (data) => ({ sampleRate: RATE, length: data.length, numberOfChannels: 1, getChannelData: () => data });

// Fala com pausas (10 s), câmera 2 com o mesmo som 0,3 s depois, música contínua.
const SPEECH = signal(
  [
    [0.9, 0.6],
    [0.6, 0.001],
    [1.2, 0.5],
    [0.9, 0.001],
    [0.7, 0.7],
    [0.5, 0.001],
    [1.4, 0.4],
    [0.8, 0.001],
    [1.0, 0.6],
    [0.4, 0.001],
    [1.6, 0.5],
  ],
  7,
);
const CAM2_DATA = new Float32Array(SPEECH.length);
CAM2_DATA.set(SPEECH.subarray(300).map((value) => value * 0.6));
const MUSIC = signal([[10, 0.15]], 11);
const BUFFERS = { cam1: buffer(SPEECH), cam2: buffer(CAM2_DATA), music: buffer(MUSIC) };

const loadBuffers = async (clips) => new Map(clips.filter((clip) => BUFFERS[clip.url]).map((clip) => [clip.url, BUFFERS[clip.url]]));
const REAL_ENV = {
  loadBuffers,
  sceneChanges: async () => [
    { time: 4, score: 0.8 },
    { time: 6.2, score: 0.55 },
  ],
  transcribe: async (asset) => ({
    reused: asset.id === ASSET,
    segments: [
      { start_ms: 0, end_ms: 2400, texto: "Olá pessoal, ãh tudo bem?" },
      { start_ms: 2600, end_ms: 5000, texto: "Hoje vamos ver 3 dicas incríveis." },
      { start_ms: 5200, end_ms: 8000, texto: "Eu eu acho que isso muda tudo!" },
    ],
  }),
};
// Sem mídia legível nem serviços: o que depende de áudio/vídeo/transcrição tem de falhar com motivo.
const NO_MEDIA_ENV = { loadBuffers: async () => new Map() };

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const finite = (value) => typeof value === "number" && Number.isFinite(value);

/** Variações de parâmetros: padrão, cada opção de select/chips, cada toggle invertido, cada lista múltipla completa. */
function variants(tool) {
  const base = defaultParams(tool);
  const list = [["padrão", {}]];
  for (const param of tool.params) {
    if ((param.type === "select" || param.type === "chips") && Array.isArray(param.options))
      param.options.forEach(([value]) => value !== param.default && list.push([`${param.key}=${value}`, { [param.key]: value }]));
    if (param.type === "toggle") list.push([`${param.key}=${!base[param.key]}`, { [param.key]: !base[param.key] }]);
    if (param.type === "multi" && param.options?.length) list.push([`${param.key}=todas`, { [param.key]: param.options.map(([value]) => value) }]);
  }
  return list;
}

// ---------------------------------------------------------------- MMFilm: estados
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
  opacity: 100,
  x: 0,
  y: 0,
  scale: 100,
  rotation: 0,
  keyframes: [],
  ...extra,
});
const caption = (id, start, duration, text) => clip(id, "V3", start, duration, { type: "text/title", caption: true, text, url: undefined, captionStyle: { font: "Inter", size: 48 } });

const EMPTY_FILM = { clips: [], markers: [], selectedIds: [], trackState: {}, media: [], backups: [], playhead: 0 };

function realFilm(extra = {}) {
  const clips = [
    clip("v1a", "V1", 0, 4, { url: "cam1", assetId: ASSET, x: 120 }),
    clip("v1b", "V1", 4, 6, { url: "cam1", assetId: ASSET, sourceIn: 4 }),
    clip("a1a", "A1", 0, 4, { url: "cam1", assetId: ASSET }),
    clip("a1b", "A1", 4, 6, { url: "cam1", assetId: ASSET, sourceIn: 4 }),
    clip("v2", "V2", 0, 8, { url: "cam2", assetId: CAM2 }),
    clip("titulo", "V2", 8, 2, { type: "text/title", text: "Inscreva-se", url: undefined }),
    clip("musica", "A2", 0, 10, { url: "music", assetId: "local-musica" }),
    caption("cap1", 0, 2.4, "Olá pessoal, ãh tudo bem?"),
    { ...caption("cap2", 2.6, 2.4, "Hoje vamos ver 3 dicas incríveis."), captionStyle: { font: "Impact", size: 60 } },
    caption("cap3", 5.2, 2.8, "Eu eu acho que isso muda tudo!"),
  ];
  const media = [
    { id: "whoosh", name: "Whoosh rápido.wav", type: "audio/wav", url: "sfx-whoosh", duration: 0.6 },
    { id: "pop", name: "Pop bolha.wav", type: "audio/wav", url: "sfx-pop", duration: 0.3 },
    { id: "hit", name: "Hit impacto.wav", type: "audio/wav", url: "sfx-hit", duration: 0.8 },
    { id: "velho", name: "Swoosh offline.wav", type: "audio/wav", offline: true },
    { id: "foto", name: "Foto.png", type: "image/png", url: "foto" },
  ];
  const backup = { id: "b1", label: "Antes de tudo", time: "10:00", clips: clips.slice(0, 3), markers: [1] };
  return {
    clips,
    markers: [2.5, 6],
    selectedIds: ["v1a", "v1b", "v2", "cap1"],
    primaryId: "v1a",
    trackState: {},
    media,
    backups: [backup],
    targets: { sfx: "A3", captions: "V3" },
    playhead: 8.5,
    ...extra,
  };
}

// Estado decorado: aplica de verdade algumas ferramentas para as de "remover" terem o que remover.
async function decoratedFilm() {
  let current = realFilm();
  const steps = [
    ["motion.zoom", {}],
    ["packs.look", {}],
    ["packs.transition", {}],
    ["textanim.entrada", {}],
    ["audio.duck", { autoDetect: false, voiceTracks: ["A1"], musicTracks: ["A2"] }],
    ["sfx.auto", { cutSounds: ["whoosh"], textSounds: ["pop"] }],
  ];
  for (const [toolId, params] of steps) {
    const result = await runMMFilmTool(toolId, current, params, REAL_ENV);
    expect(result.ok, `${toolId}: ${result.summary}`).toBe(true);
    current = { ...current, clips: result.clips, markers: result.markers || current.markers, selectedIds: [...current.selectedIds, "cap2"] };
  }
  return current;
}

const ALL_LOCKED = Object.fromEntries(["V1", "V2", "V3", "A1", "A2", "A3"].map((track) => [track, { locked: true }]));

// ---------------------------------------------------------------- MMFilm: contrato
function checkFilm(failures, where, before, result, toolId) {
  const fail = (message) => failures.push(`${where}: ${message}`);
  if (!result || typeof result !== "object") return fail("não devolveu objeto");
  if (typeof result.ok !== "boolean") fail(`ok não é booleano (${result.ok})`);
  if (typeof result.summary !== "string" || !result.summary.trim()) fail("summary vazio");
  if (!result.ok) {
    if (result.clips || result.markers || result.createBackup || result.download || result.openCaptionFile) fail("ok:false trouxe alteração");
    return;
  }
  if (result.clips !== undefined) {
    if (!Array.isArray(result.clips)) return fail("clips não é lista");
    const changed = !same(result.clips, before.clips) || (result.markers && !same(result.markers, before.markers));
    if (!changed) fail(`ok:true com clips idênticos (sucesso falso): ${result.summary}`);
    const ids = new Set();
    result.clips.forEach((item) => {
      if (ids.has(item.id)) fail(`id repetido ${item.id}`);
      ids.add(item.id);
      if (!finite(item.start) || item.start < -1e-9) fail(`${item.id}: início inválido ${item.start}`);
      if (!finite(item.duration) || item.duration <= 0) fail(`${item.id}: duração inválida ${item.duration}`);
      if (typeof item.track !== "string") fail(`${item.id}: faixa inválida`);
      if (item.speed !== undefined && !(finite(item.speed) && item.speed > 0)) fail(`${item.id}: velocidade inválida ${item.speed}`);
      if (item.volume !== undefined && !finite(item.volume)) fail(`${item.id}: volume inválido ${item.volume}`);
    });
    // Faixas bloqueadas: nenhum clipe delas muda, some ou aparece.
    const locked = (track) => Boolean(before.trackState?.[track]?.locked);
    const lockedBefore = before.clips.filter((item) => locked(item.track));
    const lockedAfter = result.clips.filter((item) => locked(item.track));
    // Restaurar backup troca a sequência inteira de propósito (pode ser desfeito), como um "voltar versão".
    if (toolId !== "backup.restore" && !same(lockedBefore, lockedAfter)) fail("alterou faixa bloqueada");
  } else if (result.markers) fail("markers sem clips");
  if (result.markers && !result.markers.every(finite)) fail("marcador inválido");
  if (result.download && !(result.download.name && result.download.text)) fail("download sem nome/conteúdo");
}

async function sweepFilm(label, state, env, failures, stats) {
  deepFreeze(state);
  const snapshot = JSON.stringify(state);
  const { tools } = mmfilmCatalogue(state);
  for (const tool of tools) {
    if (tool.status === "soon") continue;
    for (const [name, params] of variants(tool)) {
      const where = `[MMFilm ${label}] ${tool.id} (${name})`;
      stats.runs += 1;
      try {
        const result = await runMMFilmTool(tool.id, state, params, env);
        checkFilm(failures, where, state, result, tool.id);
        if (result?.ok) stats.ok.add(tool.id);
        if (result?.ok && result.clips) stats.changed.add(tool.id);
        // Lista para conferir (cortes, vícios, títulos, fontes, sons): aplica marcando todos os itens, como na grade.
        if (result?.ok && result.items?.length) {
          stats.runs += 1;
          const all = await runMMFilmTool(tool.id, state, { ...params, selectedItems: result.items.map((item) => item.id) }, env);
          checkFilm(failures, `${where} + todos os itens`, state, all, tool.id);
          if (all?.ok && all.clips) stats.changed.add(tool.id);
        }
      } catch (error) {
        failures.push(`${where}: lançou ${error?.name}: ${error?.message}`);
      }
      if (JSON.stringify(state) !== snapshot) failures.push(`${where}: alterou o estado recebido`);
    }
    stats.tools.add(tool.id);
  }
}

// ---------------------------------------------------------------- MMEffects: estados e contrato
const BASE_TRANSFORM = { x: 960, y: 540, scale: 100, rotation: 0, opacity: 100 };
const fxLayer = (id, extra = {}) => ({ id, name: id, visible: true, locked: false, start: 0, duration: 10, ...extra });
const EMPTY_FX = { layers: [], selectedLayer: null, transform: { ...BASE_TRANSFORM }, propertyKeyframes: {}, markers: [], appliedEffects: [], effectParams: {} };

function realFx(extra = {}) {
  return {
    layers: [
      fxLayer("lower-third", { name: "Lower Third", start: 6.5, duration: 3.2 }),
      fxLayer("text", { name: "MMEffect", text: "Olá mundo bonito", start: 2, duration: 4 }),
      fxLayer("logo", { name: "Logo", motionBlur: true }),
      fxLayer("background", { name: "Fundo", locked: true }),
    ],
    selectedLayer: "text",
    transform: { x: 900, y: 500, scale: 90, rotation: 10, opacity: 95 },
    propertyKeyframes: { text: { opacity: [{ time: 2, value: 0, interpolation: "linear" }, { time: 3, value: 95, interpolation: "linear" }] } },
    markers: [1, 2],
    appliedEffects: ["Glow"],
    effectParams: { Glow: { "Raio do brilho": 20, "Intensidade do brilho": 2 } },
    ...extra,
  };
}

function checkFx(failures, where, before, result) {
  const fail = (message) => failures.push(`${where}: ${message}`);
  if (!result || typeof result !== "object") return fail("não devolveu objeto");
  if (typeof result.ok !== "boolean") fail(`ok não é booleano (${result.ok})`);
  if (typeof result.summary !== "string" || !result.summary.trim()) fail("summary vazio");
  if (!result.ok) {
    if (result.patch) fail("ok:false trouxe patch");
    return;
  }
  if (!result.patch || !Object.keys(result.patch).length) return fail("ok:true sem patch");
  const known = ["layers", "transform", "propertyKeyframes", "markers", "appliedEffects", "effectParams"];
  Object.keys(result.patch).forEach((key) => !known.includes(key) && fail(`patch com chave desconhecida ${key}`));
  const after = { ...before, ...result.patch };
  if (same(after, before)) fail(`ok:true sem mudança (sucesso falso): ${result.summary}`);
  Object.entries(after.propertyKeyframes || {}).forEach(([layerId, properties]) =>
    Object.entries(properties).forEach(([property, frames]) =>
      frames.forEach((item) => (finite(item.time) && finite(item.value) ? null : fail(`quadro-chave inválido ${layerId}.${property}`))),
    ),
  );
  after.layers.forEach((layer) => {
    if (layer.start !== undefined && !(finite(layer.start) && layer.start >= 0)) fail(`${layer.id}: início inválido`);
    if (layer.duration !== undefined && !(finite(layer.duration) && layer.duration > 0)) fail(`${layer.id}: duração inválida`);
  });
  if (!after.markers.every(finite)) fail("marcador inválido");
  // Camada bloqueada não muda (nem os quadros-chave dela).
  before.layers
    .filter((layer) => layer.locked)
    .forEach((layer) => {
      if (!same(after.layers.find((item) => item.id === layer.id), layer)) fail(`alterou a camada bloqueada ${layer.id}`);
      if (!same(after.propertyKeyframes[layer.id], before.propertyKeyframes[layer.id])) fail(`animou a camada bloqueada ${layer.id}`);
    });
}

function sweepFx(label, state, failures, stats) {
  deepFreeze(state);
  const snapshot = JSON.stringify(state);
  for (const tool of mmeffectsCatalogue().tools) {
    if (tool.status === "soon") continue;
    for (const [name, params] of variants(tool)) {
      const where = `[MMEffects ${label}] ${tool.id} (${name})`;
      stats.runs += 1;
      try {
        const result = runMMEffectsTool(tool.id, state, params);
        checkFx(failures, where, state, result);
        if (result?.ok) stats.ok.add(tool.id);
      } catch (error) {
        failures.push(`${where}: lançou ${error?.name}: ${error?.message}`);
      }
      if (JSON.stringify(state) !== snapshot) failures.push(`${where}: alterou o estado recebido`);
    }
    stats.tools.add(tool.id);
  }
}

// ---------------------------------------------------------------- testes
describe("varredura do MCP do MMFilm (todas as ferramentas)", () => {
  it("nenhuma ferramenta está como 'em breve' sem executar", () => {
    expect(mmfilmCatalogue(realFilm()).tools.filter((tool) => tool.status === "soon")).toEqual([]);
  });

  it("estado vazio: tudo responde, sem exceção, e nada vira sucesso falso", async () => {
    const failures = [];
    const stats = { runs: 0, tools: new Set(), ok: new Set(), changed: new Set() };
    await sweepFilm("vazio", { ...EMPTY_FILM }, NO_MEDIA_ENV, failures, stats);
    await sweepFilm("vazio+env real", { ...EMPTY_FILM }, REAL_ENV, failures, stats);
    expect(failures).toEqual([]);
    expect(stats.tools.size).toBe(mmfilmCatalogue(EMPTY_FILM).tools.length);
    // Com a timeline vazia só os títulos de abertura/créditos criam algo; o resto explica que não há o que fazer.
    expect([...stats.changed].sort()).toEqual(["packs.credits", "packs.opening"]);
  });

  it("estado realista, sem mídia legível nem serviços: análise de áudio/vídeo/transcrição falha com motivo", async () => {
    const failures = [];
    const stats = { runs: 0, tools: new Set(), ok: new Set(), changed: new Set() };
    await sweepFilm("realista sem mídia", realFilm(), NO_MEDIA_ENV, failures, stats);
    expect(failures).toEqual([]);
    const reasons = {};
    for (const id of ["silence.remove", "audio.normalize", "sync.waveform", "multicam.cut", "transcribe.run"]) reasons[id] = (await runMMFilmTool(id, realFilm(), {}, NO_MEDIA_ENV)).summary;
    expect(reasons).toEqual({
      "silence.remove": expect.stringMatching(/Não foi possível ler o áudio/),
      "audio.normalize": expect.stringMatching(/Nenhum clipe pôde ser medido/),
      "sync.waveform": expect.stringMatching(/Não foi possível ler o som/),
      "multicam.cut": expect.any(String),
      "transcribe.run": expect.stringMatching(/serviço de transcrição não está disponível/),
    });
    expect((await runMMFilmTool("cuts.pauses", realFilm(), { mode: "cena" }, NO_MEDIA_ENV)).summary).toMatch(/mudança de cena não está disponível/);
  });

  it("estado realista com áudio sintético: todas as ferramentas cumprem o contrato", async () => {
    const failures = [];
    const stats = { runs: 0, tools: new Set(), ok: new Set(), changed: new Set() };
    await sweepFilm("realista", realFilm(), REAL_ENV, failures, stats);
    await sweepFilm("decorado", await decoratedFilm(), REAL_ENV, failures, stats);
    await sweepFilm("faixas bloqueadas", realFilm({ trackState: ALL_LOCKED }), REAL_ENV, failures, stats);
    // Uma câmera só: V2 fica livre para títulos de impacto e de abertura.
    const single = realFilm();
    await sweepFilm("uma câmera", { ...single, clips: single.clips.filter((item) => item.id !== "v2"), selectedIds: ["v1a", "cap1"] }, REAL_ENV, failures, stats);
    expect(failures).toEqual([]);
    const all = mmfilmCatalogue(realFilm()).tools.map((tool) => tool.id);
    expect(stats.tools.size).toBe(all.length);
    // Toda ferramenta executou com sucesso em pelo menos uma variação; "Importar SRT", "Exportar SRT" e
    // "Fazer backup" agem fora da timeline (arquivo/backup) e as demais alteram a timeline de verdade.
    expect(all.filter((id) => !stats.ok.has(id))).toEqual([]);
    expect(all.filter((id) => !stats.changed.has(id))).toEqual(["captions.exportsrt", "transcribe.importsrt", "backup.create"].filter((id) => all.includes(id)).sort((a, b) => all.indexOf(a) - all.indexOf(b)));
    console.info(`MMFilm: ${all.length} ferramentas, ${stats.runs} execuções (realista/decorado/bloqueado)`);
  }, 120000);
});

describe("varredura do MCP do MMEffects (todas as ferramentas)", () => {
  it("nenhuma ferramenta está como 'em breve' sem executar", () => {
    expect(mmeffectsCatalogue().tools.filter((tool) => tool.status === "soon")).toEqual([]);
  });

  it("estado vazio: sem camada, só as ferramentas da composição executam", () => {
    const failures = [];
    const stats = { runs: 0, tools: new Set(), ok: new Set(), changed: new Set() };
    sweepFx("vazio", { ...EMPTY_FX }, failures, stats);
    expect(failures).toEqual([]);
    expect([...stats.ok].sort()).toEqual(["fx.blur", "fx.color", "fx.glow", "fx.hue", "fx.particles", "fx.shadow", "markers.rhythm"]);
  });

  it("estado realista, decorado e com camada bloqueada: todas as ferramentas cumprem o contrato", () => {
    const failures = [];
    const stats = { runs: 0, tools: new Set(), ok: new Set(), changed: new Set() };
    sweepFx("realista", realFx(), failures, stats);
    sweepFx(
      "decorado",
      realFx({
        layers: realFx().layers.map((layer) => (layer.id === "text" ? { ...layer, textAnimation: { mode: "letters", start: 2, duration: 1, cursor: true }, threeD: true, anchor: { x: 1, y: 2 } } : layer)),
        appliedEffects: ["Glow", "Desfoque gaussiano"],
        effectParams: { Glow: { "Raio do brilho": 12, "Intensidade do brilho": 1 }, "Desfoque gaussiano": { Desfoque: 8 } },
      }),
      failures,
      stats,
    );
    sweepFx("camada bloqueada", realFx({ selectedLayer: "background" }), failures, stats);
    sweepFx("camada sumida", realFx({ selectedLayer: "apagada" }), failures, stats);
    expect(failures).toEqual([]);
    const all = mmeffectsCatalogue().tools.map((tool) => tool.id);
    expect(stats.tools.size).toBe(all.length);
    expect(all.filter((id) => !stats.ok.has(id))).toEqual([]);
    console.info(`MMEffects: ${all.length} ferramentas, ${stats.runs} execuções`);
  });
});

// ---------------------------------------------------------------- falhas achadas pela varredura (reprodução)
describe("regressões encontradas pela varredura", () => {
  it("títulos animados com a faixa ocupada nas frases não dizem sucesso com 0 títulos", async () => {
    const result = await runMMFilmTool("titles.create", realFilm(), {}, REAL_ENV);
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/^A faixa V2 já tem conteúdo nos trechos das \d+ frase\(s\) escolhida\(s\)/);
    expect(result.clips).toBeUndefined();
    const none = await runMMFilmTool("titles.create", realFilm(), { selectedItems: [] }, REAL_ENV);
    expect(none).toMatchObject({ ok: true, count: 0, summary: "Nenhuma frase marcada: marque na lista as frases que viram título." });
    expect(none.clips).toBeUndefined();
  });

  it("transcrever respeita faixa bloqueada (destino e legendas antigas)", async () => {
    const locked = await runMMFilmTool("transcribe.run", realFilm({ trackState: { V3: { locked: true } } }), {}, REAL_ENV);
    expect(locked).toEqual({ ok: false, summary: "A faixa V3 está bloqueada." });
    const other = await runMMFilmTool("transcribe.run", realFilm({ trackState: { V3: { locked: true } } }), { track: "V2" }, REAL_ENV);
    expect(other.ok).toBe(true);
    expect(other.clips.filter((item) => item.track === "V3").map((item) => item.id)).toEqual(["cap1", "cap2", "cap3"]);
  });

  it("criar legendas mantém as legendas de faixa bloqueada", async () => {
    const current = realFilm({ trackState: { V3: { locked: true } } });
    const result = await runMMFilmTool("captions.create", current, { track: "V2" }, REAL_ENV);
    expect(result.ok).toBe(true);
    expect(result.clips.filter((item) => item.track === "V3").map((item) => item.id)).toEqual(["cap1", "cap2", "cap3"]);
  });

  it("aplicar de novo o que já está aplicado vira ok:false (sem passo vazio de desfazer)", async () => {
    const first = await runMMFilmTool("packs.transition", realFilm(), {}, REAL_ENV);
    expect(first.ok).toBe(true);
    const again = await runMMFilmTool("packs.transition", { ...realFilm(), clips: first.clips }, {}, REAL_ENV);
    expect(again).toMatchObject({ ok: false, count: 0 });
    expect(again.summary).toMatch(/^Nada mudou na timeline \(já estava assim ou as faixas estão bloqueadas\): “Dissolver” em 1 corte/);
    expect(again.clips).toBeUndefined();
  });

  it("cortes com todas as faixas bloqueadas e Auto Edit não fingem alteração", async () => {
    const cuts = await runMMFilmTool("cuts.pauses", realFilm({ trackState: ALL_LOCKED }), {}, REAL_ENV);
    expect(cuts.ok).toBe(false);
    expect(cuts.clips).toBeUndefined();
    const auto = await runMMFilmTool("autoedit", realFilm({ trackState: ALL_LOCKED }), { silences: false }, REAL_ENV);
    expect(auto).toMatchObject({ ok: true, summary: "Auto Edit não alterou a timeline." });
    expect(auto.clips).toBeUndefined();
    expect(auto.details.find((line) => line.startsWith("Detectar cortes"))).toMatch(/^Detectar cortes: pulado — Nada mudou na timeline/);
  });

  it("MMEffects: suavização com a mesma interpolação não é sucesso falso", () => {
    const current = realFx();
    expect(runMMEffectsTool("anim.easing", current, { mode: "linear" })).toEqual({
      ok: false,
      summary: 'Os 2 quadro(s)-chave de "MMEffect" já estão com a interpolação Linear.',
    });
    expect(runMMEffectsTool("anim.easing", current, { mode: "hold" })).toMatchObject({ ok: true, count: 2 });
  });
});
