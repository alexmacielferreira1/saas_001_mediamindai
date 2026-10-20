// Catálogo de ferramentas de um clique do MMFilm para o MCP (grade de ícones no Copiloto).
// Cada ferramenta é uma função pura sobre o estado da timeline: devolve os novos clipes/marcadores e um resumo.
// Nada aqui é simulado: a análise lê o áudio real das mídias e a aplicação altera a timeline (com desfazer).
import {
  AudioWaveform,
  Crosshair,
  Eraser,
  Move3d,
  MoveHorizontal,
  Music2,
  RotateCw,
  Scissors,
  Sparkles,
  Vibrate,
  Volume1,
  Volume2,
  WandSparkles,
  ZoomIn,
  Zap,
} from "lucide-react";
import { autoThreshold, audibleClips, clipLevels, detectPauses, detectSilences, timelineEnvelope, voiceSegments } from "../../lib/mmfilmAudioAnalysis";
import { duckingKeys, normalizeGain, sfxPoints } from "../../lib/mmfilmAudioMix";
import { clipEnd, mergeRanges, removeRanges, splitAtTimes, timeAfterRemoval } from "../../lib/mmfilmEdits";
import { autoZoomPlan, motionPreset } from "../../lib/mmfilmMotion";

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
  { id: "autoedit", label: "Auto Edit" },
  { id: "silencios", label: "Silêncios" },
  { id: "cortes", label: "Cortes" },
  { id: "movimento", label: "Movimento" },
  { id: "audio", label: "Áudio" },
  { id: "sfx", label: "Sound FX" },
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
  if (!ranges.length)
    return { ok: true, count: 0, summary: `Nenhum silêncio encontrado (limiar ${dbText(threshold)}, ${how}). Tente aumentar a sensibilidade.` };
  const music = params.musicTracks || [];
  const clips = removeRanges(state.clips, ranges, { skipTrack: (track) => lockedTrack(state, track) || music.includes(track) });
  return {
    ok: true,
    count: ranges.length,
    clips,
    markers: state.markers.map((time) => timeAfterRemoval(time, ranges)),
    summary: `${ranges.length} silêncio(s) · −${secondsText(total)} · limiar ${dbText(threshold)} (${how})`,
    details: rangesDetail(ranges),
  };
}

async function cutAtPauses(state, params, env) {
  const { envelope, threshold } = await envelopeFor(state, params, env);
  const times = detectPauses(envelope, { threshold, minPause: params.minPause, minClip: params.minClip });
  if (!times.length) return { ok: true, count: 0, summary: `Nenhuma pausa encontrada (limiar ${dbText(threshold)}).` };
  const music = params.musicTracks || [];
  return {
    ok: true,
    count: times.length,
    clips: splitAtTimes(state.clips, times, { skipTrack: (track) => lockedTrack(state, track) || music.includes(track) }),
    summary: `${times.length} corte(s) nas pausas da fala · nada foi apagado`,
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

async function ducking(state, params, env) {
  const music = (params.musicTracks || []).filter((track) => !lockedTrack(state, track));
  const targets = state.clips.filter((clip) => music.includes(clip.track) && clip.enabled !== false && !clip.sfx);
  if (!targets.length) throw new ToolError("Nenhum clipe de música nas faixas escolhidas (desbloqueadas).");
  const voice = (params.voiceTracks || []).filter((track) => !music.includes(track));
  const { envelope, threshold } = await envelopeFor(state, { ...params, scope: "sequence" }, env, voice);
  const segments = voiceSegments(envelope, { threshold });
  if (!segments.length) return { ok: true, count: 0, summary: "Nenhum trecho de voz encontrado nas faixas de voz." };
  const ids = new Set(targets.map((clip) => clip.id));
  const options = { reduction: params.reduction, attack: params.attack / 1000, release: params.release / 1000 };
  return {
    ok: true,
    count: segments.length,
    clips: state.clips.map((clip) => (ids.has(clip.id) ? { ...clip, gainKeys: duckingKeys(clip, segments, options) } : clip)),
    summary: `Música abaixa ${dbText(params.reduction)} em ${segments.length} trecho(s) de voz · ${targets.length} clipe(s) de música`,
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
  const pools = { corte: sounds(params.cutSounds), texto: sounds(params.textSounds) };
  if (params.cuts && !pools.corte.length && params.titles && !pools.texto.length)
    throw new ToolError("Escolha os sons: importe arquivos de áudio (Mídia › Importar) e marque-os nas listas de sons.");
  const points = sfxPoints(state.clips, {
    cuts: params.cuts && pools.corte.length > 0,
    titles: params.titles && pools.texto.length > 0,
    minGap: params.minGap,
    videoTracks: [params.cutTrack],
  });
  if (!points.length)
    return { ok: true, count: 0, summary: `Nenhum corte entre takes em ${params.cutTrack} nem entrada de título encontrados para receber sons.` };
  const base = state.clips.filter((clip) => !(clip.sfx && clip.track === params.track));
  const turn = { corte: 0, texto: 0 };
  const placed = [];
  let skipped = 0;
  points.forEach(({ time, trigger }) => {
    const pool = pools[trigger];
    const asset = pool[turn[trigger] % pool.length];
    turn[trigger] += 1;
    const duration = Math.max(0.1, Math.min(params.maxLength, Number(asset.duration) || params.maxLength));
    const start = trigger === "corte" ? Math.max(0, time - Math.min(0.25, duration / 2)) : time;
    const busy = [...base, ...placed].some(
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
    clips: [...base, ...placed],
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
  ["silences", "Remover silêncios", "silence.remove"],
  ["cuts", "Cortar nas pausas", "cuts.pauses"],
  ["zoom", "Zoom automático", "motion.autozoom"],
  ["normalize", "Normalizar voz", "audio.normalize"],
  ["ducking", "Ducking da música", "audio.duck"],
  ["sfx", "SFX automático", "sfx.auto"],
];

async function autoEdit(state, params, env, tools) {
  let current = state;
  const details = [];
  let changed = false;
  for (const [key, label, toolId] of AUTO_STEPS) {
    if (!params[key]) continue;
    const tool = tools.find((item) => item.id === toolId);
    try {
      const outcome = await tool.run(current, defaultsOf(tool), env, tools);
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
export function mmfilmCatalogue(state = { media: [] }) {
  const audioMedia = (state.media || []).filter((item) => item.type?.startsWith("audio")).map((item) => [item.id, `${item.name}${item.offline ? " (offline)" : ""}`]);
  const noSounds = "Nenhum áudio no projeto. Importe sons (Mídia › Importar) para usá-los aqui.";
  const tools = [
    {
      id: "autoedit",
      tab: "autoedit",
      label: "Auto Edit",
      icon: WandSparkles,
      description: "Roda as etapas escolhidas em ordem: silêncios, cortes, zoom, normalização, ducking e SFX.",
      how: "Cada etapa usa os valores padrão da sua ferramenta. Etapas sem condição (ex.: sem música para o ducking) são puladas e explicadas no resultado. Tudo vira uma única alteração: um “Desfazer” volta a timeline inteira.",
      params: [
        { key: "silences", label: "Remover silêncios", type: "toggle", default: true },
        { key: "cuts", label: "Cortar nas pausas", type: "toggle", default: false },
        { key: "zoom", label: "Zoom automático", type: "toggle", default: true },
        { key: "normalize", label: "Normalizar voz", type: "toggle", default: true },
        { key: "ducking", label: "Ducking da música", type: "toggle", default: true },
        { key: "sfx", label: "SFX automático (precisa de sons marcados na ferramenta SFX)", type: "toggle", default: false },
      ],
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
        scope,
        sensitivity,
        { key: "minSilence", label: "Silêncio mínimo", type: "range", min: 0.2, max: 3, step: 0.05, default: 0.5, unit: "s" },
        { key: "padBefore", label: "Margem antes da fala", type: "range", min: 0, max: 500, step: 10, default: 120, unit: "ms" },
        { key: "padAfter", label: "Margem depois da fala", type: "range", min: 0, max: 500, step: 10, default: 150, unit: "ms" },
        { key: "thresholdMode", label: "Limite de volume", type: "select", default: "auto", options: [["auto", "Automático"], ["manual", "Manual (dB)"]] },
        { key: "threshold", label: "Limite manual", type: "range", min: -70, max: -12, step: 1, default: -40, unit: "dB", help: "Usado só no modo manual." },
        analysisTracks,
        musicTracks,
      ],
      applyLabel: "Remover silêncios",
      run: removeSilences,
    },
    {
      id: "cuts.pauses",
      tab: "cortes",
      label: "Cortar nas pausas",
      icon: Scissors,
      description: "Divide os clipes no meio de cada pausa da fala, sem apagar nada — pronto para zoom e trocas de câmera.",
      how: "Usa o mesmo detector de silêncio; cada pausa a partir do mínimo vira um corte no meio. Cortes que deixariam pedaços menores que o clipe mínimo são ignorados.",
      params: [
        scope,
        sensitivity,
        { key: "minPause", label: "Pausa mínima", type: "range", min: 0.1, max: 2, step: 0.05, default: 0.25, unit: "s" },
        { key: "minClip", label: "Clipe mínimo", type: "range", min: 0.5, max: 6, step: 0.1, default: 1.5, unit: "s" },
        analysisTracks,
        musicTracks,
      ],
      applyLabel: "Cortar",
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
        scope,
        { key: "tracks", label: "Faixas", type: "multi", default: ["A1", "V1"], options: ALL_TRACKS },
        { key: "target", label: "Nível alvo", type: "range", min: -30, max: -10, step: 1, default: -18, unit: "dB" },
        { key: "peakMax", label: "Pico máximo", type: "range", min: -6, max: 0, step: 0.5, default: -1, unit: "dB" },
      ],
      applyLabel: "Normalizar",
      run: normalize,
    },
    {
      id: "audio.duck",
      tab: "audio",
      label: "Auto ducking",
      icon: Volume1,
      description: "Abaixa a música automaticamente enquanto alguém fala e devolve o volume nas pausas.",
      how: "Detecta os trechos de voz (pausas menores que 0,6 s viram um só trecho) e cria uma curva de volume nos clipes de música: desce antes da fala (ataque) e sobe depois (retorno). Aparece no preview, na reprodução e na exportação.",
      params: [
        { key: "voiceTracks", label: "Faixas de voz", type: "multi", default: ["A1", "V1"], options: ALL_TRACKS },
        { key: "musicTracks", label: "Faixas de música", type: "multi", default: ["A2"], options: AUDIO_TRACKS },
        { key: "reduction", label: "Redução", type: "range", min: -30, max: -3, step: 1, default: -12, unit: "dB" },
        { key: "attack", label: "Ataque", type: "range", min: 20, max: 500, step: 10, default: 100, unit: "ms" },
        { key: "release", label: "Retorno", type: "range", min: 50, max: 1500, step: 10, default: 300, unit: "ms" },
        sensitivity,
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
        { key: "cuts", label: "Som nos cortes", type: "toggle", default: true },
        { key: "cutSounds", label: "Sons para cortes (whoosh)", type: "multi", default: [], options: audioMedia, empty: noSounds },
        { key: "cutTrack", label: "Faixa dos cortes", type: "select", default: "V1", options: [...VIDEO_TRACKS, ["A1", "A1 (edição só de voz)"], ["A2", "A2"]] },
        { key: "titles", label: "Som na entrada de títulos", type: "toggle", default: true },
        { key: "textSounds", label: "Sons para títulos (pop/click)", type: "multi", default: [], options: audioMedia, empty: noSounds },
        { key: "minGap", label: "Espaço mínimo entre sons", type: "range", min: 0.3, max: 3, step: 0.1, default: 0.8, unit: "s" },
        { key: "volume", label: "Volume", type: "range", min: -24, max: 0, step: 1, default: -6, unit: "dB" },
        { key: "maxLength", label: "Duração máxima do som", type: "range", min: 0.3, max: 4, step: 0.1, default: 1.5, unit: "s" },
        { key: "track", label: "Faixa dos sons", type: "select", default: "A3", options: AUDIO_TRACKS },
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
