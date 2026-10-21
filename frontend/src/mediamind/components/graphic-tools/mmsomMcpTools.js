// Catálogo de ferramentas de um clique do MMSom (Mesa integrada) para o MCP (grade de ícones no Copiloto).
// `run` é pura sobre { tracks } e devolve { ok, summary, tracks }; a mesa aplica as faixas e o MCP guarda
// o estado anterior para desfazer. Condições não atendidas viram { ok: false, summary }.
import { AlignStartVertical, Gauge, Headphones, ListEnd, MicOff, MicVocal, MoveHorizontal, Scale, SlidersVertical, Speaker, Volume1, VolumeX, Waves } from "lucide-react";
import { DEFAULT_CLIP_START, TIMELINE_SECONDS } from "../../pages/SoundCraft";

export const MMSOM_TABS = [
  { id: "mix", label: "Mix" },
  { id: "inserts", label: "Inserts" },
  { id: "clipes", label: "Clipes" },
];

const EQ_OPTIONS = [
  ["voz", "Voz"],
  ["grave", "Grave"],
  ["brilho", "Brilho"],
  ["off", "Desligado"],
];

class ToolError extends Error {}

const toDb = (volume) => (volume - 100) * 0.2;
const fromDb = (db) => Math.max(0, Math.min(100, Math.round(100 + db / 0.2)));
const dbText = (db) => `${db.toFixed(1).replace(".", ",")} dB`;

function chosen(state, ids) {
  const list = state.tracks.filter((track) => (ids || []).map(String).includes(String(track.id)));
  if (!list.length) throw new ToolError("Escolha uma ou mais faixas.");
  return list;
}

const patchTracks = (state, patches) => state.tracks.map((track) => (patches.has(track.id) ? { ...track, ...patches.get(track.id) } : track));
const names = (list) => list.map((track) => track.name).join(", ");

// ---------- mix ----------
function balance(state) {
  const measured = state.tracks.filter((track) => track.peaks?.some((peak) => peak > 0));
  if (measured.length < 2) throw new ToolError("Precisa de duas ou mais faixas com áudio carregado (importado ou gravado) para equilibrar.");
  // O volume da mesa só atenua (100 = 0 dB): todas descem até o pico da faixa mais baixa.
  const peakDb = (track) => 20 * Math.log10(Math.max(...track.peaks));
  const target = Math.min(...measured.map(peakDb));
  const patches = new Map(measured.map((track) => [track.id, { volume: fromDb(target - peakDb(track)) }]));
  return {
    ok: true,
    count: measured.length,
    summary: `Níveis equilibrados pelo pico em ${dbText(target)} (${names(measured)})`,
    details: measured.map((track) => `${track.name}: pico ${dbText(peakDb(track))} → volume ${dbText(toDb(patches.get(track.id).volume))}`),
    tracks: patchTracks(state, patches),
  };
}

function setVolume(state, params) {
  const list = chosen(state, params.tracks);
  return {
    ok: true,
    count: list.length,
    summary: `Volume ${dbText(params.db)} em ${names(list)}`,
    tracks: patchTracks(state, new Map(list.map((track) => [track.id, { volume: fromDb(params.db) }]))),
  };
}

function underVoice(state, params) {
  const music = chosen(state, params.tracks);
  const patches = new Map(music.map((track) => [track.id, { volume: fromDb(toDb(track.volume) + params.reduction) }]));
  return {
    ok: true,
    count: music.length,
    summary: `${names(music)} ${String(Math.abs(params.reduction)).replace(".", ",")} dB mais baixa(s) para a voz aparecer`,
    tracks: patchTracks(state, patches),
  };
}

function spread(state, params) {
  if (state.tracks.length < 2) throw new ToolError("Precisa de duas ou mais faixas para abrir o estéreo.");
  const step = (params.width * 2) / (state.tracks.length - 1);
  return {
    ok: true,
    count: state.tracks.length,
    summary: `Estéreo aberto de ${-params.width} a ${params.width} (${state.tracks.length} faixas)`,
    tracks: state.tracks.map((track, index) => ({ ...track, pan: Math.round(-params.width + step * index) })),
  };
}

function center(state) {
  const off = state.tracks.filter((track) => track.pan);
  if (!off.length) return { ok: false, summary: "Todas as faixas já estão no centro." };
  return { ok: true, count: off.length, summary: `${off.length} faixa(s) de volta ao centro`, tracks: state.tracks.map((track) => ({ ...track, pan: 0 })) };
}

function clearFlags(state) {
  const flagged = state.tracks.filter((track) => track.mute || track.solo);
  if (!flagged.length) return { ok: false, summary: "Nenhuma faixa está silenciada ou em solo." };
  return { ok: true, count: flagged.length, summary: `Mute/solo limpos em ${names(flagged)}`, tracks: state.tracks.map((track) => ({ ...track, mute: false, solo: false })) };
}

function solo(state, params) {
  const list = chosen(state, params.tracks);
  const ids = new Set(list.map((track) => track.id));
  return {
    ok: true,
    count: list.length,
    summary: `Solo em ${names(list)} (as outras ficam mudas na reprodução e no mixdown)`,
    tracks: state.tracks.map((track) => ({ ...track, solo: ids.has(track.id) })),
  };
}

function mute(state, params) {
  const list = chosen(state, params.tracks);
  const on = params.mode === "on";
  return { ok: true, count: list.length, summary: `${on ? "Silenciada(s)" : "Som de volta em"} ${names(list)}`, tracks: patchTracks(state, new Map(list.map((track) => [track.id, { mute: on }]))) };
}

// ---------- clipes (posição na linha do tempo) ----------
const startOf = (track) => track.start ?? DEFAULT_CLIP_START;
const secondsText = (value) => `${String(Math.round(value * 10) / 10).replace(".", ",")} s`;

function alignStart(state, params) {
  const list = chosen(state, params.tracks).filter((track) => track.src);
  if (!list.length) throw new ToolError("As faixas escolhidas não têm áudio na linha do tempo.");
  return {
    ok: true,
    count: list.length,
    summary: `${list.length} clipe(s) começando em ${secondsText(params.at)}`,
    tracks: patchTracks(state, new Map(list.map((track) => [track.id, { start: params.at }]))),
  };
}

function sequenceClips(state, params) {
  const list = chosen(state, params.tracks).filter((track) => track.src && track.duration > 0);
  if (list.length < 2) throw new ToolError("Escolha duas ou mais faixas com áudio carregado (com duração conhecida).");
  let cursor = Math.min(...list.map(startOf));
  const patches = new Map();
  for (const track of [...list].sort((a, b) => startOf(a) - startOf(b))) {
    patches.set(track.id, { start: Math.round(cursor * 100) / 100 });
    cursor += track.duration + params.gap;
  }
  const end = cursor - params.gap;
  return {
    ok: true,
    count: list.length,
    summary: `${list.length} clipes em sequência, ${secondsText(params.gap)} entre eles (termina em ${secondsText(end)})${end > TIMELINE_SECONDS ? " — passa dos 120 s da régua" : ""}`,
    tracks: patchTracks(state, patches),
  };
}

// ---------- inserts ----------
function eq(state, params) {
  const list = chosen(state, params.tracks);
  const value = params.preset === "off" ? undefined : params.preset;
  const label = EQ_OPTIONS.find(([key]) => key === params.preset)[1];
  return { ok: true, count: list.length, summary: `EQ ${label} em ${names(list)}`, tracks: patchTracks(state, new Map(list.map((track) => [track.id, { eq: value }]))) };
}

function compressor(state, params) {
  const list = chosen(state, params.tracks);
  const on = params.mode === "on";
  return { ok: true, count: list.length, summary: `Compressor ${on ? "ligado" : "desligado"} em ${names(list)}`, tracks: patchTracks(state, new Map(list.map((track) => [track.id, { compressor: on }]))) };
}

function voiceChain(state, params) {
  const list = chosen(state, params.tracks);
  return {
    ok: true,
    count: list.length,
    summary: `Cadeia de voz (EQ Voz + compressor, centro) em ${names(list)}`,
    tracks: patchTracks(state, new Map(list.map((track) => [track.id, { eq: "voz", compressor: true, pan: 0 }]))),
  };
}

// ---------- catálogo ----------
const isVoice = (track) => /voz|voice|locu|narra|fala/i.test(track.name);

export function mmsomCatalogue(state = { tracks: [] }) {
  const options = state.tracks.map((track) => [String(track.id), track.name]);
  const voices = state.tracks.filter(isVoice).map((track) => String(track.id));
  const others = state.tracks.filter((track) => !isVoice(track)).map((track) => String(track.id));
  const all = state.tracks.map((track) => String(track.id));
  const pick = (label, defaults) => ({ key: "tracks", label, type: "multi", default: defaults, options, empty: "Nenhuma faixa na mesa." });
  const toggle = { key: "mode", label: "Compressor", type: "select", default: "on", options: [["on", "Ligar"], ["off", "Desligar"]] };
  const tools = [
    { id: "mix.balance", tab: "mix", label: "Equilibrar", icon: Scale, description: "Iguala as faixas pelo pico do áudio real (a mais alta desce até a mais baixa).", how: "Lê os picos do áudio decodificado de cada faixa e ajusta o volume da mesa (que só atenua: 100 = 0 dB).", params: [], run: balance },
    { id: "mix.volume", tab: "mix", label: "Volume", icon: SlidersVertical, description: "Define o volume das faixas escolhidas.", params: [pick("Faixas", all), { key: "db", label: "Volume", type: "range", min: -20, max: 0, step: 0.2, default: -3, unit: "dB" }], run: setVolume },
    { id: "mix.under", tab: "mix", label: "Música sob a voz", icon: Volume1, description: "Abaixa as faixas de música para a voz ficar na frente.", params: [pick("Faixas de música", others), { key: "reduction", label: "Reduzir", type: "range", min: -18, max: -1, step: 1, default: -8, unit: "dB" }], run: underVoice },
    { id: "mix.spread", tab: "mix", label: "Abrir estéreo", icon: MoveHorizontal, description: "Distribui as faixas da esquerda para a direita.", params: [{ key: "width", label: "Abertura", type: "range", min: 10, max: 100, step: 5, default: 60 }], run: spread },
    { id: "mix.center", tab: "mix", label: "Centralizar", icon: Speaker, description: "Volta o pan de todas as faixas ao centro.", params: [], run: center },
    { id: "mix.clear", tab: "mix", label: "Limpar M/S", icon: VolumeX, description: "Tira todos os mutes e solos.", params: [], run: clearFlags },
    { id: "mix.solo", tab: "mix", label: "Solo", icon: Headphones, description: "Deixa só as faixas escolhidas tocando (as outras saem do solo).", params: [pick("Faixas em solo", voices)], run: solo },
    { id: "mix.mute", tab: "mix", label: "Silenciar", icon: MicOff, description: "Silencia ou devolve o som das faixas escolhidas.", params: [pick("Faixas", others), { key: "mode", label: "Ação", type: "select", default: "on", options: [["on", "Silenciar"], ["off", "Devolver o som"]] }], run: mute },
    {
      id: "clips.align",
      tab: "clipes",
      label: "Alinhar início",
      icon: AlignStartVertical,
      description: "Faz os clipes das faixas escolhidas começarem no mesmo instante.",
      params: [pick("Faixas", all), { key: "at", label: "Começar em", type: "range", min: 0, max: 60, step: 0.1, default: 0, unit: "s" }],
      run: alignStart,
    },
    {
      id: "clips.sequence",
      tab: "clipes",
      label: "Em sequência",
      icon: ListEnd,
      description: "Coloca os clipes um depois do outro (ex.: blocos de locução), na ordem atual.",
      params: [pick("Faixas", all), { key: "gap", label: "Espaço entre clipes", type: "range", min: 0, max: 5, step: 0.1, default: 0.5, unit: "s" }],
      run: sequenceClips,
    },
    { id: "inserts.voice", tab: "inserts", label: "Cadeia de voz", icon: MicVocal, description: "EQ de voz, compressor e voz no centro nas faixas escolhidas.", params: [pick("Faixas de voz", voices)], run: voiceChain },
    { id: "inserts.eq", tab: "inserts", label: "EQ", icon: Waves, description: "Aplica um preset do EQ de 7 bandas.", params: [pick("Faixas", all), { key: "preset", label: "Preset", type: "select", default: "voz", options: EQ_OPTIONS }], run: eq },
    { id: "inserts.comp", tab: "inserts", label: "Compressor", icon: Gauge, description: "Liga ou desliga o compressor nas faixas escolhidas.", params: [pick("Faixas", all), toggle], run: compressor },
  ];
  return { tabs: MMSOM_TABS, tools };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Executa (planeja) uma ferramenta. Erros de condição viram `ok: false`; erros inesperados sobem. */
export function runMMSomTool(toolId, state, params) {
  const tool = mmsomCatalogue(state).tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return tool.run(state, { ...defaultsOf(tool), ...(params || {}) });
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
