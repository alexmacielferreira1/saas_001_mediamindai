// Catálogo de ferramentas de um clique do MMFilm para o MCP (grade de ícones no Copiloto).
// Cada ferramenta é uma função pura sobre o estado da timeline: devolve os novos clipes/marcadores e um resumo.
// Nada aqui é simulado: a análise lê o áudio real das mídias e a aplicação altera a timeline (com desfazer).
import {
  ArchiveRestore,
  AudioLines,
  AudioWaveform,
  Captions,
  Crosshair,
  Eraser,
  Layers,
  LayoutGrid,
  Mic,
  Move3d,
  MoveHorizontal,
  Music2,
  RefreshCcw,
  RotateCw,
  Save,
  Scissors,
  Settings,
  Sparkles,
  Type,
  Vibrate,
  Volume1,
  Volume2,
  WandSparkles,
  ZoomIn,
  Zap,
} from "lucide-react";
import { autoThreshold, audibleClips, clipLevels, detectSilences, pauseCandidates, timelineEnvelope, voiceSegments } from "../../lib/mmfilmAudioAnalysis";
import { duckingKeys, normalizeGain, sfxPoints } from "../../lib/mmfilmAudioMix";
import { clipEnd, mergeRanges, removeRanges, splitAtTimes, timeAfterRemoval } from "../../lib/mmfilmEdits";
import { autoZoomPlan, motionPreset } from "../../lib/mmfilmMotion";
import { CAPTION_TEMPLATES, strongWords, wordsFromCues } from "../../lib/mmfilmCaptions";

const CAPTION_TEMPLATE_OPTIONS = CAPTION_TEMPLATES.map((item) => [item.id, `${item.folder} · ${item.name}`]);
import { mmfilmTextTools } from "./mmfilmMcpTextTools";
import { mmfilmCameraTools } from "./mmfilmMcpCameraTools";
import { TEXT_ANIMATION_OPTIONS, mmfilmMotionTools } from "./mmfilmMcpMotionTools";

const TITLE_TYPE = "text/title";
const ALL_TRACKS = [
  ["V1", "V1 (som do vídeo)"],
  ["V2", "V2 (som do vídeo)"],
  ["V3", "V3 (som do vídeo)"],
  ["A1", "A1"],
  ["A2", "A2"],
  ["A3", "A3"],
];
const AUDIO_TRACKS = [
  ["A1", "A1"],
  ["A2", "A2"],
  ["A3", "A3"],
];
const VIDEO_TRACKS = [
  ["V1", "V1"],
  ["V2", "V2"],
  ["V3", "V3"],
];

export const MMFILM_TABS = [
  { id: "autoedit", label: "Auto Edit", icon: Zap, description: "Sincroniza, analisa o áudio, remove silêncios, corta, cria legendas e títulos e faz o ducking como um editor faria. Você só escolhe as etapas." },
  { id: "silencios", label: "Silêncios", icon: AudioWaveform, description: "Detecta silêncios pelo volume do áudio e remove os trechos fechando os buracos em todas as trilhas destravadas." },
  { id: "cortes", label: "Cortes", icon: Scissors, description: "Encontra pontos de corte naturais e divide os clipes, sem apagar nada. Confira a lista antes de aplicar." },
  { id: "sfx", label: "Sound FX", icon: Music2, description: "Lê os cortes, os textos e as palavras fortes da timeline e escolhe um som para cada momento. Os sons se alternam para não repetir." },
  { id: "legendas", label: "Legendas", icon: Captions, description: "Legendas a partir da transcrição ou de um SRT, com templates próprios: palavra por palavra ou em linhas, fonte, cores e caixa." },
  { id: "transcricao", label: "Transcrição", icon: Mic, description: "Transcrição com o tempo de cada palavra: base de cortes por frase, vícios de linguagem, legendas, títulos e SFX nas palavras fortes." },
  { id: "audio", label: "Áudio", icon: AudioLines, description: "Ducking e normalização trabalham só com a curva de volume e o ganho do clipe. Seus arquivos de áudio não são alterados." },
  { id: "sincronizar", label: "Sincronizar", icon: RefreshCcw, description: "Coloque câmeras e áudios externos na timeline, em qualquer posição: o som de cada um é comparado e tudo se alinha à referência." },
  { id: "multicamera", label: "Multicâmera", icon: LayoutGrid, description: "Um microfone e uma câmera por pessoa: mede quem fala a cada 10 ms e corta para a câmera certa. Nada é apagado." },
  { id: "movimento", label: "Movimentos", icon: Move3d, description: "Movimentos de câmera prontos nos clipes selecionados, sem keyframe na mão, com intensidade de 1 a 10." },
  { id: "motionpresets", label: "Motion Presets", icon: Layers, description: "Animações de entrada e saída nos clipes selecionados." },
  { id: "texto", label: "Animação de texto", icon: Type, description: "Animações para títulos e legendas, aplicadas ao texto selecionado mantendo o estilo." },
  { id: "packs", label: "Presets e transições", icon: Sparkles, description: "Transições, looks de cor, títulos e créditos próprios, com prévia." },
  { id: "config", label: "Configurações", icon: Settings, description: "Backups da sequência e preferências das ferramentas." },
];

const pad = (value) => String(value).padStart(2, "0");
export function timecode(seconds) {
  // Centésimos inteiros (com tolerância) para 1,15 s não virar "01,14" por erro de ponto flutuante.
  const centis = Math.floor(Math.max(0, seconds) * 100 + 1e-6);
  return `${pad(Math.floor(centis / 6000))}:${pad(Math.floor(centis / 100) % 60)},${pad(centis % 100)}`;
}
const secondsText = (value) => `${value.toFixed(2).replace(".", ",")} s`;
const dbText = (value) => `${value.toFixed(1).replace(".", ",")} dB`;
const dbToVolume = (db) => Math.round(Math.min(200, 10 ** (db / 20) * 100));

class ToolError extends Error {}

// ---------- parâmetros comuns ----------
const sensitivity = { key: "sensitivity", label: "Sensibilidade", type: "range", min: 1, max: 10, step: 1, default: 5, help: "Mais alta = mais trechos contam como silêncio." };
const scope = {
  key: "scope",
  label: "Trecho",
  type: "select",
  default: "sequence",
  options: [
    ["sequence", "Sequência inteira"],
    ["selection", "Só os clipes selecionados"],
  ],
};
const analysisTracks = { key: "analysisTracks", label: "Faixas com a voz (analisadas)", type: "multi", default: ["A1", "V1"], options: ALL_TRACKS };
const musicTracks = { key: "musicTracks", label: "Faixas de música (não são cortadas)", type: "multi", default: ["A2", "A3"], options: AUDIO_TRACKS };
const intensity = { key: "intensity", label: "Intensidade", type: "range", min: 1, max: 10, step: 1, default: 5 };
const backupParam = {
  key: "backup",
  label: "Backup automático",
  type: "toggle",
  default: true,
  description: "Guarda uma cópia da sequência antes da alteração (Configurações › Backups).",
};

// ---------- auxiliares de estado ----------
function lockedTrack(state, track) {
  return Boolean(state.trackState?.[track]?.locked);
}

function analysisRange(state, params) {
  if (params.scope === "selection") {
    const chosen = state.clips.filter((clip) => state.selectedIds.includes(clip.id));
    if (!chosen.length) throw new ToolError("Selecione um ou mais clipes na timeline ou use “Sequência inteira”.");
    return [Math.min(...chosen.map((clip) => clip.start)), Math.max(...chosen.map(clipEnd))];
  }
  const end = state.clips.reduce((value, clip) => Math.max(value, clipEnd(clip)), 0);
  if (!(end > 0)) throw new ToolError("A timeline está vazia: adicione mídias antes de usar esta ferramenta.");
  return [0, end];
}

// Som dos vídeos que já tem o mesmo áudio vinculado numa faixa A não é contado duas vezes.
function soundClips(state, tracks) {
  const list = audibleClips(state.clips, tracks);
  return list.filter(
    (clip) =>
      !clip.track.startsWith("V") ||
      !list.some((item) => item.track.startsWith("A") && item.assetId && item.assetId === clip.assetId && Math.abs(item.start - clip.start) < 0.002),
  );
}

async function envelopeFor(state, params, env, tracks = params.analysisTracks) {
  const [from, to] = analysisRange(state, params);
  const clips = soundClips(state, tracks || []);
  if (!clips.length) throw new ToolError("Nenhum clipe com som (online) nas faixas analisadas. Confira as faixas escolhidas e se as mídias estão religadas.");
  const buffers = await env.loadBuffers(clips);
  if (!clips.some((clip) => buffers.get(clip.url)))
    throw new ToolError("Não foi possível ler o áudio das mídias (formato sem áudio ou mídia indisponível).");
  const envelope = timelineEnvelope({ clips, buffers, from, to });
  const auto = autoThreshold(envelope.db, params.sensitivity);
  const threshold = params.thresholdMode === "manual" ? Number(params.threshold) : auto.threshold;
  return { envelope, threshold, auto, range: [from, to] };
}

// Forma de onda resumida (até 160 colunas, −60…0 dB → 0…1) com as regiões marcadas e o limite.
export function waveformData(envelope, regions = [], threshold) {
  const { db, from, windowSeconds } = envelope;
  const columns = Math.max(1, Math.min(160, db.length));
  const size = db.length / columns;
  const level = (value) => Math.max(0, Math.min(1, (value + 60) / 60));
  const peaks = Array.from({ length: columns }, (_, column) => {
    let peak = -Infinity;
    for (let index = Math.floor(column * size); index < Math.max(Math.floor(column * size) + 1, Math.floor((column + 1) * size)); index += 1)
      peak = Math.max(peak, db[index] ?? -Infinity);
    return Math.round(level(peak) * 100) / 100;
  });
  return {
    peaks,
    duration: db.length * windowSeconds,
    regions: regions.map(([start, end]) => ({ start: start - from, end: end - from, kind: "silencio" })),
    threshold: threshold === undefined ? undefined : level(threshold),
  };
}

function rangesDetail(ranges) {
  return ranges.slice(0, 40).map(([start, end]) => `${timecode(start)} → ${timecode(end)} (${secondsText(end - start)})`);
}

// ---------- ferramentas ----------
async function removeSilences(state, params, env) {
  const { envelope, threshold, auto } = await envelopeFor(state, params, env);
  const ranges = mergeRanges(
    detectSilences(envelope, {
      threshold,
      minSilence: params.minSilence,
      padBefore: params.padBefore / 1000,
      padAfter: params.padAfter / 1000,
    }),
  );
  const total = ranges.reduce((sum, [start, end]) => sum + end - start, 0);
  const how = params.thresholdMode === "manual" ? "manual" : `auto · ruído ${dbText(auto.floor)} · fala ${dbText(auto.speech)}`;
  const waveform = waveformData(envelope, ranges, threshold);
  if (!ranges.length)
    return { ok: true, count: 0, waveform, summary: `Nenhum silêncio encontrado (limiar ${dbText(threshold)}, ${how}). Tente aumentar a sensibilidade.` };
  const music = params.musicTracks || [];
  const clips = removeRanges(state.clips, ranges, { skipTrack: (track) => lockedTrack(state, track) || music.includes(track) });
  return {
    ok: true,
    count: ranges.length,
    clips,
    markers: state.markers.map((time) => timeAfterRemoval(time, ranges)),
    headline: { count: ranges.length, text: `silêncio(s) encontrado(s) · ${secondsText(total)} no total`, aside: `limite ${dbText(threshold)}` },
    waveform,
    summary: `${ranges.length} silêncio(s) · −${secondsText(total)} · limiar ${dbText(threshold)} (${how})`,
    details: rangesDetail(ranges),
  };
}

// Pontos de fim de frase: fim das legendas da timeline cujo texto termina em . ! ? ou …
function sentenceEnds(state) {
  return state.clips
    .filter((clip) => clip.type === TITLE_TYPE && clip.caption && /[.!?…]["”']?\s*$/.test(String(clip.text || "")))
    .map((clip) => ({ time: Math.round(clipEnd(clip) * 1000) / 1000, label: `fim de frase: “${String(clip.text).slice(-28)}”`, badge: "frase" }));
}

function spaced(points, { from, to, minClip }) {
  const kept = [];
  let previous = from;
  points
    .sort((a, b) => a.time - b.time)
    .forEach((point) => {
      if (point.time - previous >= minClip && to - point.time >= minClip) {
        kept.push(point);
        previous = point.time;
      }
    });
  return kept;
}

async function cutAtPauses(state, params, env) {
  const mode = params.mode || "pausas";
  let points;
  let note;
  if (mode === "frase") {
    const [from, to] = analysisRange(state, params);
    points = spaced(sentenceEnds(state).filter((point) => point.time > from && point.time < to), { from, to, minClip: params.minClip });
    note = "nos fins de frase das legendas";
    if (!sentenceEnds(state).length)
      throw new ToolError("Sem legendas com pontuação na timeline: importe um SRT (rodapé › Importar SRT) ou transcreva antes.");
  } else if (mode === "cena") {
    const [from, to] = analysisRange(state, params);
    if (!env.sceneChanges) throw new ToolError("A detecção de mudança de cena não está disponível neste navegador.");
    const scenes = await env.sceneChanges(state.clips.filter((clip) => clip.track === "V1" && clip.type?.startsWith("video") && clip.enabled !== false), {
      sensitivity: params.sensitivity,
    });
    points = spaced(
      scenes.filter((scene) => scene.time > from && scene.time < to).map((scene) => ({ time: scene.time, label: `mudança de cena (${Math.round(scene.score * 100)}%)`, badge: "cena" })),
      { from, to, minClip: params.minClip },
    );
    note = "nas mudanças de cena";
  } else {
    const { envelope, threshold } = await envelopeFor(state, params, env);
    points = pauseCandidates(envelope, {
      threshold,
      minPause: params.minPause,
      minClip: params.minClip,
      padBefore: (params.padBefore ?? 0) / 1000,
      padAfter: (params.padAfter ?? 0) / 1000,
    }).map((pause) => ({ time: pause.time, label: `pausa de ${secondsText(pause.length)}`, badge: "pausa" }));
    note = "nas pausas da fala";
  }
  if (!points.length) return { ok: true, count: 0, summary: `Nenhum ponto de corte encontrado ${note}.` };
  const items = points.map((point, index) => ({ id: `corte-${index}`, time: point.time, timecode: timecode(point.time), label: point.label, badge: point.badge }));
  const chosen = params.selectedItems ? items.filter((item) => params.selectedItems.includes(item.id)) : items;
  if (!chosen.length) throw new ToolError("Marque pelo menos um corte da lista para aplicar.");
  const times = chosen.map((item) => item.time);
  const music = params.musicTracks || [];
  return {
    ok: true,
    count: times.length,
    clips: splitAtTimes(state.clips, times, { skipTrack: (track) => lockedTrack(state, track) || music.includes(track) }),
    headline: { count: items.length, text: "cortes detectados" },
    items,
    summary: `${times.length} corte(s) ${note} · nada foi apagado`,
    details: times.slice(0, 40).map((time) => `Corte em ${timecode(time)}`),
  };
}

function visualTakes(state, track) {
  return state.clips
    .filter((clip) => clip.track === track && !clip.type?.startsWith("audio") && clip.type !== TITLE_TYPE && clip.enabled !== false)
    .sort((a, b) => a.start - b.start);
}

function autoZoom(state, params) {
  if (lockedTrack(state, params.track)) throw new ToolError(`A faixa ${params.track} está bloqueada.`);
  const takes = visualTakes(state, params.track);
  if (takes.length < 2) throw new ToolError(`São necessários pelo menos 2 takes de vídeo em ${params.track} (corte antes com “Silêncios” ou “Cortes”).`);
  const plan = autoZoomPlan(takes, { amount: params.amount, style: params.style, zoomOut: params.zoomOut });
  if (!plan.length) return { ok: true, count: 0, summary: "Nenhum take longo o bastante para o zoom (mínimo 1 s)." };
  const byId = new Map(plan.map((item) => [item.id, item]));
  return {
    ok: true,
    count: plan.length,
    clips: state.clips.map((clip) => (byId.has(clip.id) ? { ...clip, motion: byId.get(clip.id).motion } : clip)),
    summary: `Zoom em ${plan.length} de ${takes.length} takes (${plan.filter((item) => item.kind === "afastar").length} afastando)`,
    details: plan.map((item) => {
      const clip = takes.find((take) => take.id === item.id);
      return `${timecode(clip.start)} · ${clip.name || "take"} · ${item.kind}`;
    }),
  };
}

function selectedVisual(state) {
  const chosen = state.clips.filter(
    (clip) => state.selectedIds.includes(clip.id) && clip.track.startsWith("V") && !clip.type?.startsWith("audio") && !lockedTrack(state, clip.track),
  );
  if (!chosen.length) throw new ToolError("Selecione um ou mais clipes de vídeo, imagem ou título (faixas V desbloqueadas) na timeline.");
  return chosen;
}

const motionTool = (kind, label) => (state, params) => {
  const chosen = selectedVisual(state);
  const ids = new Set(chosen.map((clip) => clip.id));
  return {
    ok: true,
    count: chosen.length,
    clips: state.clips.map((clip, index) =>
      ids.has(clip.id) ? { ...clip, motion: motionPreset(kind, clip.duration, { intensity: params.intensity, direction: params.direction, seed: index }) } : clip,
    ),
    summary: `${label} aplicado em ${chosen.length} clipe(s)`,
  };
};

function resetMotion(state) {
  const chosen = selectedVisual(state).filter((clip) => clip.motion);
  if (!chosen.length) return { ok: true, count: 0, summary: "Os clipes selecionados não têm movimento." };
  const ids = new Set(chosen.map((clip) => clip.id));
  return {
    ok: true,
    count: chosen.length,
    clips: state.clips.map((clip) => {
      if (!ids.has(clip.id)) return clip;
      const { motion: _motion, ...rest } = clip;
      return rest;
    }),
    summary: `Movimento removido de ${chosen.length} clipe(s)`,
  };
}

/**
 * Papéis das trilhas pelo próprio som: música é contínua (volume estável, desvio < 6 dB nas janelas com som);
 * voz varia e tem pausas. Trilhas sem som legível ficam de fora.
 */
export async function detectTrackRoles(state, env) {
  const roles = { voice: [], music: [] };
  for (const track of ["A1", "A2", "A3", "V1", "V2", "V3"]) {
    const clips = soundClips(state, [track]).filter((clip) => !clip.sfx);
    if (!clips.length) continue;
    const buffers = await env.loadBuffers(clips);
    if (!clips.some((clip) => buffers.get(clip.url))) continue;
    const { db } = timelineEnvelope({ clips, buffers, from: 0, to: Math.max(...clips.map(clipEnd)) });
    const covered = Array.from(db).filter((value) => value > -90);
    if (!covered.length) continue;
    const mean = covered.reduce((sum, value) => sum + value, 0) / covered.length;
    const deviation = Math.sqrt(covered.reduce((sum, value) => sum + (value - mean) ** 2, 0) / covered.length);
    roles[deviation < 6 ? "music" : "voice"].push(track);
  }
  return roles;
}

async function ducking(state, params, env) {
  let musicTracks = params.musicTracks || [];
  let voiceTracks = params.voiceTracks || [];
  if (params.autoDetect) {
    const roles = await detectTrackRoles(state, env);
    if (!roles.music.length) throw new ToolError("Nenhuma trilha de música detectada (som contínuo). Desligue “Detectar automaticamente” e escolha as trilhas.");
    if (!roles.voice.length) throw new ToolError("Nenhuma trilha de voz detectada. Desligue “Detectar automaticamente” e escolha as trilhas.");
    musicTracks = roles.music;
    voiceTracks = roles.voice;
  }
  const music = musicTracks.filter((track) => !lockedTrack(state, track));
  const targets = state.clips.filter((clip) => music.includes(clip.track) && clip.enabled !== false && !clip.sfx);
  if (!targets.length) throw new ToolError("Nenhum clipe de música nas faixas escolhidas (desbloqueadas).");
  const voice = voiceTracks.filter((track) => !music.includes(track));
  const { envelope, threshold, range } = await envelopeFor(state, { ...params, scope: "sequence" }, env, voice);
  const segments = voiceSegments(envelope, { threshold });
  if (!segments.length) return { ok: true, count: 0, summary: "Nenhum trecho de voz encontrado nas faixas de voz." };
  const ids = new Set(targets.map((clip) => clip.id));
  const options = { reduction: Number(params.reduction), attack: params.attack / 1000, release: params.release / 1000 };
  const speaking = segments.reduce((sum, [start, end]) => sum + end - start, 0);
  const share = Math.round((speaking / Math.max(1e-6, range[1] - range[0])) * 100);
  return {
    ok: true,
    count: segments.length,
    clips: state.clips.map((clip) => (ids.has(clip.id) ? { ...clip, gainKeys: duckingKeys(clip, segments, options) } : clip)),
    headline: { count: segments.length, text: `trecho(s) de voz em ${voice.join(", ")} (${share}% do tempo) · música em ${music.join(", ")}` },
    waveform: waveformData(envelope, [], threshold),
    summary: `Música abaixa ${dbText(options.reduction)} em ${segments.length} trecho(s) de voz · ${targets.length} clipe(s) de música`,
    details: segments.slice(0, 40).map(([start, end]) => `Voz ${timecode(start)} → ${timecode(end)}`),
  };
}

function removeDucking(state) {
  const targets = state.clips.filter((clip) => clip.gainKeys && !lockedTrack(state, clip.track));
  if (!targets.length) return { ok: true, count: 0, summary: "Nenhum clipe com ducking." };
  return {
    ok: true,
    count: targets.length,
    clips: state.clips.map((clip) => {
      if (!clip.gainKeys || lockedTrack(state, clip.track)) return clip;
      const { gainKeys: _keys, ...rest } = clip;
      return rest;
    }),
    summary: `Ducking removido de ${targets.length} clipe(s)`,
  };
}

async function normalize(state, params, env) {
  const tracks = (params.tracks || []).filter((track) => !lockedTrack(state, track));
  const scoped = params.scope === "selection" ? state.clips.filter((clip) => state.selectedIds.includes(clip.id)) : state.clips;
  if (params.scope === "selection" && !scoped.length) throw new ToolError("Selecione um ou mais clipes na timeline ou use “Sequência inteira”.");
  const clips = soundClips({ ...state, clips: scoped }, tracks);
  if (!clips.length) throw new ToolError("Nenhum clipe com som (online) nas faixas escolhidas.");
  const buffers = await env.loadBuffers(clips);
  const changes = new Map();
  const details = [];
  clips.forEach((clip) => {
    const buffer = buffers.get(clip.url);
    const levels = buffer && clipLevels(clip, buffer);
    if (!levels) {
      details.push(`${clip.name || "clipe"}: sem som legível, mantido`);
      return;
    }
    const { gain, limited } = normalizeGain(levels, { target: params.target, peakMax: params.peakMax });
    const volume = dbToVolume(gain);
    changes.set(clip.id, volume);
    details.push(`${clip.name || "clipe"}: ${dbText(levels.rms)} → volume ${volume}%${limited ? ` (limitado pelo ${limited})` : ""}`);
  });
  if (!changes.size) return { ok: true, count: 0, summary: "Nenhum clipe pôde ser medido.", details };
  return {
    ok: true,
    count: changes.size,
    headline: { count: changes.size, text: `clipe(s) com ganho calculado para ${dbText(params.target)}` },
    clips: state.clips.map((clip) => (changes.has(clip.id) ? { ...clip, volume: changes.get(clip.id) } : clip)),
    summary: `${changes.size} clipe(s) nivelado(s) para ${dbText(params.target)} (pico ≤ ${dbText(params.peakMax)})`,
    details,
  };
}

function sfxClip(asset, track, start, duration, volume) {
  return {
    ...asset,
    assetId: asset.assetId ?? asset.id,
    mediaDuration: asset.mediaDuration ?? asset.duration,
    id: crypto.randomUUID(),
    track,
    start: Math.round(start * 1000) / 1000,
    duration,
    sourceIn: 0,
    opacity: 100,
    volume,
    speed: 100,
    x: 0,
    y: 0,
    scale: 100,
    rotation: 0,
    keyframes: [],
    sfx: true,
  };
}

function autoSfx(state, params) {
  if (lockedTrack(state, params.track)) throw new ToolError(`A faixa ${params.track} está bloqueada.`);
  const sounds = (ids) => state.media.filter((item) => (ids || []).includes(item.id) && !item.offline && item.url);
  const pools = { corte: sounds(params.cutSounds), texto: sounds(params.textSounds), forte: sounds(params.hitSounds) };
  const wantsStrong = params.strong && pools.forte.length > 0;
  if (!(params.cuts && pools.corte.length) && !(params.titles && pools.texto.length) && !wantsStrong)
    throw new ToolError("Escolha os sons: importe arquivos de áudio (Mídia › Importar) e marque-os nas listas de sons.");
  const base = sfxPoints(state.clips, {
    cuts: params.cuts && pools.corte.length > 0,
    titles: params.titles && pools.texto.length > 0,
    minGap: params.minGap,
    videoTracks: [params.cutTrack],
  });
  const strongPoints = wantsStrong
    ? strongWords(wordsFromCues(state.clips.filter((clip) => clip.caption).map((clip) => ({ start: clip.start, end: clipEnd(clip), text: String(clip.text || "") }))), {
        language: params.language || "pt",
      }).map((item) => ({ time: Math.round(item.time * 1000) / 1000, trigger: "forte" }))
    : [];
  const points = [];
  [...base, ...strongPoints]
    .sort((a, b) => a.time - b.time)
    .forEach((point) => {
      if (!points.length || point.time - points[points.length - 1].time >= params.minGap) points.push(point);
    });
  if (!points.length)
    return { ok: true, count: 0, summary: `Nenhum corte entre takes em ${params.cutTrack} nem entrada de título encontrados para receber sons.` };
  const kept = state.clips.filter((clip) => !(clip.sfx && clip.track === params.track));
  const turn = { corte: 0, texto: 0, forte: 0 };
  const placed = [];
  let skipped = 0;
  points.forEach(({ time, trigger }) => {
    const pool = pools[trigger];
    const asset = pool[turn[trigger] % pool.length];
    turn[trigger] += 1;
    const duration = Math.max(0.1, Math.min(params.maxLength, Number(asset.duration) || params.maxLength));
    const start = trigger === "corte" ? Math.max(0, time - Math.min(0.25, duration / 2)) : time;
    const busy = [...kept, ...placed].some(
      (clip) => clip.track === params.track && clip.start < start + duration - 1e-6 && clipEnd(clip) > start + 1e-6,
    );
    if (busy) {
      skipped += 1;
      return;
    }
    placed.push(sfxClip(asset, params.track, start, duration, dbToVolume(params.volume)));
  });
  return {
    ok: true,
    count: placed.length,
    clips: [...kept, ...placed],
    headline: { count: placed.length, text: `som(ns) em ${params.track}` },
    summary: `${placed.length} som(ns) em ${params.track}${skipped ? ` · ${skipped} pulado(s): faixa ocupada` : ""} · sons automáticos anteriores substituídos`,
    details: placed.map((clip) => `${timecode(clip.start)} · ${clip.name}`),
  };
}

function clearSfx(state) {
  const removed = state.clips.filter((clip) => clip.sfx && !lockedTrack(state, clip.track));
  if (!removed.length) return { ok: true, count: 0, summary: "Nenhum som automático na timeline." };
  const ids = new Set(removed.map((clip) => clip.id));
  return { ok: true, count: removed.length, clips: state.clips.filter((clip) => !ids.has(clip.id)), summary: `${removed.length} som(ns) automático(s) removido(s)` };
}

// ---------- Auto Edit: etapas em sequência sobre o mesmo estado, um único desfazer ----------
const AUTO_STEPS = [
  ["sync", "Sincronizar câmeras e áudio", "sync.waveform"],
  ["silences", "Remover silêncios", "silence.remove"],
  ["fillers", "Cortar vícios de linguagem", "fillers.remove"],
  ["cuts", "Detectar cortes", "cuts.pauses"],
  ["multicam", "Corte multicâmera automático", "multicam.cut"],
  ["zoom", "Auto Zoom", "motion.autozoom"],
  ["captions", "Criar legendas", "captions.create"],
  ["titles", "Títulos animados", "titles.create"],
  ["ducking", "Auto Ducking", "audio.duck"],
  ["normalize", "Normalizar áudio", "audio.normalize"],
  ["sfx", "SFX automático", "sfx.auto"],
];

async function autoEdit(state, params, env, tools) {
  let current = state;
  const details = [];
  let changed = false;
  const overrides = { language: params.language, count: params.titleCount, template: params.template, backup: false };
  for (const [key, label, toolId] of AUTO_STEPS) {
    if (!params[key]) continue;
    const tool = tools.find((item) => item.id === toolId);
    const toolParams = Object.fromEntries(Object.entries(overrides).filter(([name, value]) => value !== undefined && tool.params.some((param) => param.key === name)));
    try {
      const outcome = await tool.run(current, { ...defaultsOf(tool), ...toolParams }, env, tools);
      details.push(`${label}: ${outcome.summary}`);
      if (outcome.clips) {
        current = { ...current, clips: outcome.clips, markers: outcome.markers || current.markers };
        changed = true;
      }
    } catch (error) {
      if (!(error instanceof ToolError)) throw error;
      details.push(`${label}: pulado — ${error.message}`);
    }
  }
  if (!details.length) throw new ToolError("Ligue pelo menos uma etapa do Auto Edit.");
  return {
    ok: true,
    count: details.length,
    clips: changed ? current.clips : undefined,
    markers: changed ? current.markers : undefined,
    summary: changed ? `Auto Edit concluído em ${details.length} etapa(s) · um único “Desfazer” volta tudo` : "Auto Edit não alterou a timeline.",
    details,
  };
}

const defaultsOf = (tool) => Object.fromEntries(tool.params.map((param) => [param.key, param.default]));

/** Catálogo com as opções do momento (sons importados no projeto). */
export function mmfilmCatalogue(input = {}) {
  const state = { clips: [], markers: [], selectedIds: [], media: [], ...input };
  const audioMedia = (state.media || []).filter((item) => item.type?.startsWith("audio")).map((item) => [item.id, `${item.name}${item.offline ? " (offline)" : ""}`]);
  const noSounds = "Nenhum áudio no projeto. Importe sons (Mídia › Importar) para usá-los aqui.";
  const backups = state.backups || [];
  const targets = { sfx: "A3", captions: "V3", ...(state.targets || {}) };
  const kit = {
    targets,
    ToolError,
    timecode,
    lockedTrack,
    envelopeFor,
    soundClips,
    backupParam,
    ALL_TRACKS,
    AUDIO_TRACKS,
    VIDEO_TRACKS,
    textAnimationOptions: () => [["nenhuma", "Sem animação"], ...TEXT_ANIMATION_OPTIONS],
    captionTemplateOptions: () => CAPTION_TEMPLATE_OPTIONS,
  };
  const tools = [
    {
      id: "autoedit",
      tab: "autoedit",
      label: "Auto Edit",
      icon: WandSparkles,
      description: "Um clique, dez etapas: sincroniza, remove silêncios e vícios, corta, troca câmeras, dá zoom, cria legendas e títulos, faz o ducking e normaliza.",
      how: "As etapas rodam na ordem da lista, cada uma com os valores padrão da sua ferramenta (idioma, quantidade de títulos e estilo vêm daqui). Etapas sem condição (ex.: só uma câmera, sem música, sem texto na timeline) são puladas e explicadas no resultado. Antes de mexer, um backup da sequência é guardado; tudo vira uma única alteração e um “Desfazer” volta a timeline inteira.",
      params: [
        { key: "sync", label: "1 · Sincronizar câmeras e áudio", type: "toggle", default: true, section: "Etapas (na ordem em que rodam)", help: "Alinha câmeras e áudios externos pela forma de onda." },
        { key: "silences", label: "2 · Remover silêncios", type: "toggle", default: true, section: "Etapas (na ordem em que rodam)", help: "Tira as pausas longas em todas as trilhas, sem perder a sincronia." },
        { key: "fillers", label: "3 · Cortar vícios de linguagem", type: "toggle", default: true, section: "Etapas (na ordem em que rodam)", help: "“ãh”, “é…”, “tipo”, “né” e palavras repetidas (precisa de texto na timeline)." },
        { key: "cuts", label: "4 · Detectar cortes", type: "toggle", default: true, section: "Etapas (na ordem em que rodam)", help: "Divide os clipes nas pausas naturais da fala." },
        { key: "multicam", label: "5 · Corte multicâmera automático", type: "toggle", default: false, section: "Etapas (na ordem em que rodam)", help: "Troca de câmera conforme quem fala (configure as pessoas na aba Multicâmera)." },
        { key: "zoom", label: "6 · Auto Zoom", type: "toggle", default: true, section: "Etapas (na ordem em que rodam)", help: "Zoom rápido, médio ou suave em alguns takes." },
        { key: "captions", label: "7 · Criar legendas", type: "toggle", default: true, section: "Etapas (na ordem em que rodam)", help: "Legendas com o template escolhido (precisa de texto na timeline)." },
        { key: "titles", label: "8 · Títulos animados", type: "toggle", default: true, section: "Etapas (na ordem em que rodam)", help: "As frases de maior impacto em destaque." },
        { key: "ducking", label: "9 · Auto Ducking", type: "toggle", default: true, section: "Etapas (na ordem em que rodam)", help: "A música abaixa sozinha quando alguém fala." },
        { key: "normalize", label: "10 · Normalizar áudio", type: "toggle", default: false, section: "Etapas (na ordem em que rodam)", help: "A voz num nível constante, pico abaixo de −1 dB." },
        { key: "sfx", label: "Extra · SFX automático", type: "toggle", default: false, section: "Etapas (na ordem em que rodam)", help: "Precisa de sons marcados na ferramenta SFX." },
        { key: "language", label: "Idioma do texto", type: "select", default: "pt", options: [["pt", "Português"], ["en", "English"], ["es", "Español"]], section: "Texto" },
        { key: "titleCount", label: "Quantidade de títulos", type: "chips", default: "medio", options: [["poucos", "Poucos"], ["medio", "Médio"], ["muitos", "Muitos"]], section: "Texto" },
        { key: "template", label: "Estilo das legendas", type: "select", default: "mm-bloco-branco", options: CAPTION_TEMPLATE_OPTIONS, section: "Texto" },
        { ...backupParam, section: "Texto" },
      ],
      confirm: "Executar o Auto Edit nas etapas ligadas? Um backup da sequência é guardado antes e um único Desfazer volta tudo.",
      applyLabel: "Executar Auto Edit",
      run: (current, params, env) => autoEdit(current, params, env, tools),
    },
    {
      id: "silence.remove",
      tab: "silencios",
      label: "Remover silêncios",
      icon: AudioWaveform,
      description: "Encontra pausas sem fala e apaga esses trechos em todas as faixas desbloqueadas, fechando os buracos.",
      how: "Mede o volume a cada 10 ms. O limiar automático fica entre o ruído de fundo (10% mais baixo) e a fala (10% mais alto); a sensibilidade move esse ponto. Silêncios a partir do mínimo são removidos mantendo as margens de respiro. Faixas de música e bloqueadas não são cortadas.",
      params: [
        { ...scope, label: "Trecho da timeline", section: "Onde cortar" },
        { ...analysisTracks, label: "Trilha analisada (voz)", section: "Onde cortar", help: "Com música de fundo, analise só a trilha da voz." },
        { ...musicTracks, label: "Não cortar a música", section: "Onde cortar", help: "A trilha de música continua inteira. Trilhas travadas também são preservadas." },
        { ...backupParam, section: "Onde cortar" },
        { ...sensitivity, section: "Precisão do corte" },
        { key: "minSilence", label: "Silêncio mínimo", type: "stepper", min: 0.2, max: 3, step: 0.05, default: 0.5, unit: "s", section: "Precisão do corte", help: "Pausas mais curtas que isso ficam." },
        { key: "thresholdMode", label: "Limite de volume", type: "select", default: "auto", options: [["auto", "Automático"], ["manual", "Manual (dB)"]], section: "Precisão do corte", help: "Abaixo deste volume, o trecho conta como silêncio." },
        { key: "threshold", label: "Limite manual", type: "stepper", min: -70, max: -12, step: 1, default: -40, unit: "dB", section: "Precisão do corte", when: { key: "thresholdMode", equals: "manual" } },
        { key: "padBefore", label: "Margem antes da fala", type: "stepper", min: 0, max: 500, step: 10, default: 120, unit: "ms", section: "Precisão do corte", help: "Aumente se as palavras estiverem sendo cortadas." },
        { key: "padAfter", label: "Margem depois da fala", type: "stepper", min: 0, max: 500, step: 10, default: 150, unit: "ms", section: "Precisão do corte", help: "Aumente se as palavras estiverem sendo cortadas." },
      ],
      live: true,
      confirm: "Remover os silêncios em todas as trilhas destravadas? Com o backup ligado, uma cópia da sequência é guardada antes; o Desfazer volta tudo.",
      applyLabel: "Remover silêncios",
      run: removeSilences,
    },
    {
      id: "cuts.pauses",
      tab: "cortes",
      label: "Detectar cortes",
      icon: Scissors,
      description: "Encontra pontos de corte nas pausas da fala, no fim de cada frase ou nas mudanças de cena e só divide os clipes.",
      how: "Pausas: o corte fica no meio da pausa, respeitando as margens. Fim de frase: usa as legendas da timeline (SRT importado ou transcrição) que terminam em . ! ? ou …. Mudança de cena: compara quadros do vídeo em V1. Cortes que deixariam pedaços menores que o clipe mínimo são ignorados. Nada é apagado.",
      params: [
        {
          key: "mode",
          label: "Cortar em",
          type: "select",
          default: "pausas",
          options: [
            ["pausas", "Pausas na fala"],
            ["frase", "Fim de frase (legendas/SRT)"],
            ["cena", "Mudança de cena (vídeo)"],
          ],
          section: "Detecção",
          help: "Escolha o que define um ponto natural de corte.",
        },
        { ...sensitivity, section: "Detecção", help: "Mais alta = mais cortes encontrados." },
        { ...scope, label: "Trecho da timeline", section: "Detecção" },
        { key: "minPause", label: "Pausa mínima", type: "stepper", min: 0.1, max: 2, step: 0.05, default: 0.25, unit: "s", section: "Precisão", when: { key: "mode", equals: "pausas" } },
        { key: "minClip", label: "Clipe mínimo", type: "stepper", min: 0.5, max: 6, step: 0.1, default: 1.5, unit: "s", section: "Precisão", description: "Nunca cria clipes menores que isso." },
        { key: "padBefore", label: "Margem antes", type: "stepper", min: 0, max: 500, step: 10, default: 80, unit: "ms", section: "Precisão", when: { key: "mode", equals: "pausas" } },
        { key: "padAfter", label: "Margem depois", type: "stepper", min: 0, max: 500, step: 10, default: 80, unit: "ms", section: "Precisão", when: { key: "mode", equals: "pausas" }, description: "O corte fica dentro da pausa, respeitando essas margens." },
        { ...analysisTracks, section: "Trilhas", when: { key: "mode", equals: "pausas" } },
        { ...musicTracks, section: "Trilhas" },
      ],
      live: true,
      applyLabel: "Aplicar cortes",
      run: cutAtPauses,
    },
    {
      id: "motion.autozoom",
      tab: "movimento",
      label: "Zoom automático",
      icon: ZoomIn,
      description: "Aplica zooms variados em takes espaçados (nunca dois seguidos) para dar ritmo à edição.",
      how: "Poucos ≈ 1 a cada 4 takes, médio ≈ 1 a cada 3, muitos ≈ 1 a cada 2. Rápido: 12–18% em 0,25 s; médio: 8–13% em 0,7 s; suave: 5–9% ao longo do take. Cerca de 1/3 dos zooms afastam.",
      params: [
        { key: "amount", label: "Quantidade", type: "select", default: "medio", options: [["poucos", "Poucos"], ["medio", "Médio"], ["muitos", "Muitos"]] },
        { key: "style", label: "Estilo", type: "select", default: "medio", options: [["rapido", "Rápido"], ["medio", "Médio"], ["suave", "Suave"]] },
        { key: "zoomOut", label: "Alternar com zoom afastando", type: "toggle", default: true },
        { key: "track", label: "Faixa dos takes", type: "select", default: "V1", options: VIDEO_TRACKS },
      ],
      applyLabel: "Aplicar zoom",
      run: autoZoom,
    },
    {
      id: "motion.punch",
      tab: "movimento",
      label: "Punch in",
      icon: Crosshair,
      description: "Corte seco aproximado no clipe selecionado (in) ou aproximado só na primeira metade (out).",
      params: [intensity, { key: "direction", label: "Tipo", type: "select", default: "in", options: [["in", "Punch in (take inteiro)"], ["out", "Punch in/out (volta no meio)"]] }],
      analyze: false,
      run: motionTool("punch", "Punch in"),
    },
    {
      id: "motion.zoom",
      tab: "movimento",
      label: "Zoom suave",
      icon: Sparkles,
      description: "Aproxima ou afasta devagar durante todo o clipe selecionado (efeito Ken Burns).",
      params: [intensity, { key: "direction", label: "Direção", type: "select", default: "in", options: [["in", "Aproximar"], ["out", "Afastar"]] }],
      analyze: false,
      run: motionTool("zoom", "Zoom suave"),
    },
    {
      id: "motion.shake",
      tab: "movimento",
      label: "Camera shake",
      icon: Vibrate,
      description: "Tremida de câmera no começo do clipe selecionado (0,5 s), diminuindo até parar.",
      params: [intensity],
      analyze: false,
      run: motionTool("shake", "Camera shake"),
    },
    {
      id: "motion.pan",
      tab: "movimento",
      label: "Pan",
      icon: MoveHorizontal,
      description: "Desliza o quadro de um lado para o outro durante o clipe, com leve aproximação para não mostrar bordas.",
      params: [intensity, { key: "direction", label: "Direção", type: "select", default: "right", options: [["right", "Para a direita"], ["left", "Para a esquerda"]] }],
      analyze: false,
      run: motionTool("pan", "Pan"),
    },
    {
      id: "motion.rotate",
      tab: "movimento",
      label: "Rotação",
      icon: RotateCw,
      description: "Gira levemente o quadro durante o clipe, com aproximação para esconder as bordas.",
      params: [intensity],
      analyze: false,
      run: motionTool("rotate", "Rotação"),
    },
    {
      id: "motion.reset",
      tab: "movimento",
      label: "Remover movimento",
      icon: Move3d,
      description: "Tira zoom, shake, pan e rotação aplicados pelas ferramentas dos clipes selecionados.",
      params: [],
      analyze: false,
      run: resetMotion,
    },
    {
      id: "audio.normalize",
      tab: "audio",
      label: "Normalizar",
      icon: Volume2,
      description: "Ajusta o volume de cada clipe para o mesmo nível médio, sem deixar o pico estourar.",
      how: "Mede o RMS só dos trechos com som de cada clipe (ignora o volume atual) e calcula o ganho até o alvo. Se o pico passaria do limite, o ganho é reduzido. O volume do clipe vai até 200% (+6 dB).",
      params: [
        { ...scope, section: "Normalizar" },
        { key: "tracks", label: "Trilha", type: "multi", default: ["A1", "V1"], options: ALL_TRACKS, section: "Normalizar" },
        { key: "target", label: "Nível alvo da fala", type: "range", min: -30, max: -10, step: 1, default: -18, unit: "dB", section: "Normalizar", help: "Nível médio da voz depois do ajuste (padrão −18 dB)." },
        { key: "peakMax", label: "Pico máximo", type: "stepper", min: -6, max: 0, step: 0.5, default: -1, unit: "dB", section: "Normalizar", help: "O ganho é limitado para o pico ficar abaixo disso." },
      ],
      applyLabel: "Aplicar ganho",
      run: normalize,
    },
    {
      id: "audio.duck",
      tab: "audio",
      label: "Auto ducking",
      icon: Volume1,
      description: "Abaixa a música automaticamente enquanto alguém fala e devolve o volume nas pausas.",
      how: "Detecta os trechos de voz (pausas menores que 0,6 s viram um só trecho) e cria uma curva de volume nos clipes de música: desce antes da fala (ataque) e sobe depois (retorno). Na detecção automática, música é a trilha de som contínuo e voz a que varia. Aparece no preview, na reprodução e na exportação.",
      params: [
        { key: "autoDetect", label: "Detectar trilhas automaticamente", type: "toggle", default: true, section: "Auto Ducking", description: "Voz = som que varia e tem pausas; música = som contínuo." },
        { key: "voiceTracks", label: "Trilha de voz", type: "multi", default: ["A1", "V1"], options: ALL_TRACKS, section: "Auto Ducking", when: { key: "autoDetect", equals: false } },
        { key: "musicTracks", label: "Trilha de música", type: "multi", default: ["A2"], options: AUDIO_TRACKS, section: "Auto Ducking", when: { key: "autoDetect", equals: false } },
        {
          key: "reduction",
          label: "Quanto abaixar",
          type: "chips",
          default: -12,
          options: [-6, -9, -12, -15, -18].map((value) => [value, `${value} dB`]),
          section: "Auto Ducking",
          help: "Redução da música enquanto há fala.",
        },
        { key: "attack", label: "Ataque", type: "stepper", min: 20, max: 500, step: 10, default: 100, unit: "ms", section: "Auto Ducking", help: "Quanto antes da fala a música começa a descer." },
        { key: "release", label: "Retorno", type: "stepper", min: 50, max: 1500, step: 10, default: 300, unit: "ms", section: "Auto Ducking", help: "Quanto depois da fala a música volta." },
        { ...sensitivity, section: "Auto Ducking", help: "Mais alta = só a fala mais forte conta como voz." },
      ],
      applyLabel: "Aplicar ducking",
      run: ducking,
    },
    {
      id: "audio.unduck",
      tab: "audio",
      label: "Remover ducking",
      icon: Music2,
      description: "Apaga as curvas de volume criadas pelo ducking, devolvendo a música ao volume normal.",
      params: [],
      analyze: false,
      run: removeDucking,
    },
    {
      id: "sfx.auto",
      tab: "sfx",
      label: "SFX automático",
      icon: Zap,
      description: "Coloca sons nos cortes entre takes (whoosh) e na entrada dos títulos (pop), alternando os arquivos.",
      how: "Usa só sons que você importou no projeto. Cortes = encontro de dois takes na faixa escolhida (V1 para vídeo, A1 para edição só de voz); textos = início de cada título (legendas não contam). Respeita o espaço mínimo e não sobrepõe clipes que já estão na faixa escolhida. Rodar de novo substitui os sons automáticos anteriores.",
      params: [
        { key: "cuts", label: "Cortes e transições", type: "toggle", default: true, section: "Quando tocar", description: "Whoosh ou swoosh em cada troca de clipe." },
        { key: "cutTrack", label: "Faixa dos cortes", type: "select", default: "V1", options: [...VIDEO_TRACKS, ["A1", "A1 (edição só de voz)"], ["A2", "A2"]], section: "Quando tocar", when: { key: "cuts", equals: true } },
        { key: "titles", label: "Entrada de textos e títulos", type: "toggle", default: true, section: "Quando tocar", description: "Click ou pop quando um título entra (legendas não contam)." },
        { key: "strong", label: "Palavras fortes na fala", type: "toggle", default: false, section: "Quando tocar", description: "Hit/impacto em números e palavras de ênfase das legendas da timeline." },
        { key: "cutSounds", label: "Sons para cortes (whoosh)", type: "multi", default: [], options: audioMedia, empty: noSounds, section: "Sons usados" },
        { key: "textSounds", label: "Sons para títulos (pop/click)", type: "multi", default: [], options: audioMedia, empty: noSounds, section: "Sons usados" },
        { key: "hitSounds", label: "Sons para palavras fortes (hit/impacto)", type: "multi", default: [], options: audioMedia, empty: noSounds, section: "Sons usados", when: { key: "strong", equals: true } },
        { key: "minGap", label: "Espaço mínimo entre sons", type: "range", min: 0.3, max: 3, step: 0.1, default: 0.8, unit: "s", section: "Ajustes", help: "Dois sons nunca ficam mais perto que isso." },
        { key: "volume", label: "Volume dos SFX", type: "stepper", min: -24, max: 0, step: 1, default: -6, unit: "dB", section: "Ajustes" },
        { key: "maxLength", label: "Duração máxima do som", type: "stepper", min: 0.3, max: 4, step: 0.1, default: 1.5, unit: "s", section: "Ajustes" },
        { key: "track", label: "Trilha de SFX", type: "select", default: targets.sfx, options: AUDIO_TRACKS, section: "Ajustes" },
      ],
      applyLabel: "Aplicar SFX",
      run: autoSfx,
    },
    {
      id: "sfx.clear",
      tab: "sfx",
      label: "Limpar SFX",
      icon: Eraser,
      description: "Remove todos os sons colocados pelo SFX automático (os seus clipes de áudio ficam).",
      params: [],
      analyze: false,
      run: clearSfx,
    },
    {
      id: "backup.create",
      tab: "config",
      label: "Fazer backup agora",
      icon: Save,
      description: "Guarda uma cópia da sequência como está agora (fica nesta lista de backups do navegador).",
      params: [],
      analyze: false,
      applyLabel: "Guardar backup",
      run: () => ({ ok: true, count: 0, createBackup: "Backup manual", summary: "Backup da sequência guardado." }),
    },
    {
      id: "backup.restore",
      tab: "config",
      label: "Restaurar backup",
      icon: ArchiveRestore,
      description: "Volta a sequência para um backup automático ou manual. A restauração também pode ser desfeita.",
      params: [
        {
          key: "backupId",
          label: "Backup",
          type: "select",
          default: backups[0]?.id ?? "",
          options: backups.length ? backups.map((item) => [item.id, `${item.time} · ${item.label}`]) : [["", "Nenhum backup ainda"]],
        },
      ],
      analyze: false,
      confirm: "Trocar a sequência atual pelo backup escolhido? O Desfazer volta para a versão atual.",
      applyLabel: "Restaurar",
      run: (current, params) => {
        const chosen = backups.find((item) => item.id === params.backupId);
        if (!chosen) throw new ToolError("Nenhum backup escolhido. Os backups são criados antes de cada alteração com “Backup automático” ligado.");
        return { ok: true, count: chosen.clips.length, clips: chosen.clips, markers: chosen.markers, summary: `Sequência restaurada para “${chosen.label}” (${chosen.time}).` };
      },
    },
    ...mmfilmTextTools(kit),
    ...mmfilmCameraTools(kit, state),
    ...mmfilmMotionTools(kit),
  ];
  return { tabs: MMFILM_TABS, tools };
}

/**
 * Executa uma ferramenta. Erros de condição (sem seleção, sem som…) viram resultado `ok: false`
 * com a explicação; erros inesperados sobem para quem chamou.
 */
export async function runMMFilmTool(toolId, state, params, env) {
  const catalogue = mmfilmCatalogue(state);
  const tool = catalogue.tools.find((item) => item.id === toolId);
  if (!tool) return { ok: false, summary: `Ferramenta desconhecida: ${toolId}` };
  try {
    return await tool.run(state, { ...defaultsOf(tool), ...(params || {}) }, env, catalogue.tools);
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, summary: error.message };
    throw error;
  }
}
