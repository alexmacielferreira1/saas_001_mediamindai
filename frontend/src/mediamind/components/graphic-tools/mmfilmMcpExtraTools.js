// Ferramentas extras do MMFilm para o MCP: transcrição (via serviço do Acervo), rampa de velocidade,
// multi-tela e biblioteca de efeitos sonoros do projeto com prévia.
import { Gauge, Library, Mic, PanelsTopLeft } from "lucide-react";
import { captionClips, captionTemplate } from "../../lib/mmfilmCaptions";
import { clipEnd } from "../../lib/mmfilmEdits";
import { isPersistedAssetId } from "../../lib/mcpTargetContext";

const TITLE_TYPE = "text/title";
const round = (value) => Math.round(value * 1000) / 1000;

// ---------------------------------------------------------------- Transcrever
// Converte segmentos da mídia (ms no arquivo) para legendas no tempo da timeline, recortando ao trecho usado.
export function segmentsToCues(clip, segments) {
  const speed = (clip.speed || 100) / 100;
  const from = clip.sourceIn || 0;
  const to = from + clip.duration * speed;
  return segments
    .map((segment) => ({ start: Number(segment.start_ms) / 1000, end: Number(segment.end_ms) / 1000, text: String(segment.texto ?? segment.text ?? "").trim() }))
    .filter((segment) => segment.text && segment.end > from && segment.start < to)
    .map((segment) => ({
      start: round(clip.start + (Math.max(from, segment.start) - from) / speed),
      end: round(clip.start + (Math.min(to, segment.end) - from) / speed),
      text: segment.text,
    }));
}

async function transcribe(state, params, env, kit) {
  if (kit.lockedTrack(state, params.track)) throw new kit.ToolError(`A faixa ${params.track} está bloqueada.`);
  const sources = kit
    .soundClips(state, ["A1", "A2", "A3", "V1", "V2", "V3"])
    .filter((clip) => !clip.sfx && isPersistedAssetId(clip.assetId) && !(params.musicTracks || []).includes(clip.track));
  if (!sources.length)
    throw new kit.ToolError(
      "A transcrição usa o serviço do Acervo: só funciona com mídias vindas do Acervo. Para arquivos do computador, use “Importar SRT” no rodapé.",
    );
  if (!env.transcribe) throw new kit.ToolError("O serviço de transcrição não está disponível nesta tela.");
  const cache = new Map();
  const cues = [];
  let reused = 0;
  for (const clip of sources) {
    if (!cache.has(clip.assetId)) {
      const result = await env.transcribe({ id: clip.assetId, title: clip.name, stream_url: clip.url, duration: clip.mediaDuration });
      if (result.reused) reused += 1;
      cache.set(clip.assetId, result.segments || []);
    }
    cues.push(...segmentsToCues(clip, cache.get(clip.assetId)));
  }
  if (!cues.length) return { ok: true, count: 0, summary: "A transcrição voltou sem falas no trecho usado na timeline." };
  cues.sort((a, b) => a.start - b.start);
  const created = captionClips(cues, { template: captionTemplate(params.template), track: params.track, idPrefix: `transcricao-${Date.now().toString(36)}` });
  // Legendas antigas em faixas bloqueadas ficam (o bloqueio protege a faixa inteira).
  const kept = params.replace ? state.clips.filter((clip) => !(clip.caption && clip.type === TITLE_TYPE && !kit.lockedTrack(state, clip.track))) : state.clips;
  return {
    ok: true,
    count: created.length,
    clips: [...kept, ...created],
    headline: { count: created.length, text: `fala(s) transcrita(s) em ${params.track}` },
    summary: `${created.length} legenda(s) da transcrição de ${cache.size} mídia(s)${reused ? ` (${reused} reaproveitada(s) do Acervo)` : ""}`,
    details: cues.slice(0, 12).map((cue) => `${kit.timecode(cue.start)} · ${cue.text}`),
  };
}

// ---------------------------------------------------------------- Rampa de velocidade
const SHAPES = {
  acelerar: (x) => x,
  desacelerar: (x) => 1 - x,
  "ida-volta": (x) => 1 - Math.abs(2 * x - 1),
};

/** Divide o clipe em `steps` pedaços com velocidades em rampa; devolve os pedaços e a nova duração total. */
export function speedRampPieces(clip, { from, to, shape, steps = 6 }) {
  const base = (clip.speed || 100) / 100;
  const span = clip.duration * base;
  const curve = SHAPES[shape] || SHAPES.acelerar;
  let start = clip.start;
  const pieces = Array.from({ length: steps }, (_, index) => {
    const speed = Math.round(from + (to - from) * curve((index + 0.5) / steps));
    const duration = round(span / steps / (speed / 100));
    const piece = {
      ...clip,
      id: index === 0 ? clip.id : `${clip.id}-rampa-${index}`,
      start: round(start),
      duration,
      sourceIn: round((clip.sourceIn || 0) + (span / steps) * index),
      speed,
      keyframes: [],
      motion: undefined,
      transition: index === 0 ? clip.transition : undefined,
    };
    start += duration;
    return piece;
  });
  return { pieces, total: round(start - clip.start) };
}

function speedRamp(state, params, kit) {
  const chosen = state.clips.filter(
    (clip) => state.selectedIds.includes(clip.id) && clip.type?.startsWith("video") && !kit.lockedTrack(state, clip.track),
  );
  if (!chosen.length) throw new kit.ToolError("Selecione um ou mais clipes de vídeo na timeline.");
  let clips = state.clips;
  chosen
    .sort((a, b) => b.start - a.start)
    .forEach((target) => {
      // O áudio vinculado (mesmo arquivo, mesmo início) recebe a mesma rampa para não perder a sincronia.
      const group = clips.filter(
        (clip) => clip.id === target.id || (clip.assetId && clip.assetId === target.assetId && Math.abs(clip.start - target.start) < 0.002 && !kit.lockedTrack(state, clip.track)),
      );
      const end = clipEnd(target);
      let delta = 0;
      const replaced = new Map(
        group.map((clip) => {
          const { pieces, total } = speedRampPieces(clip, { from: params.from, to: params.to, shape: params.shape });
          delta = total - clip.duration;
          return [clip.id, pieces];
        }),
      );
      const tracks = new Set(group.map((clip) => clip.track));
      clips = clips.flatMap((clip) => {
        if (replaced.has(clip.id)) return replaced.get(clip.id);
        if (tracks.has(clip.track) && clip.start >= end - 1e-6) return [{ ...clip, start: round(clip.start + delta) }];
        return [clip];
      });
    });
  return {
    ok: true,
    count: chosen.length,
    clips,
    summary: `Rampa de velocidade (${params.from}% → ${params.to}%, ${params.shape}) em ${chosen.length} clipe(s); os clipes seguintes da faixa acompanham`,
  };
}

// ---------------------------------------------------------------- Multi-tela
const NEUTRAL = { x: 0, y: 0, scale: 100, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 };
export const MULTI_LAYOUTS = {
  lado: { label: "2 lado a lado", count: 2, cells: [{ x: -480, cropLeft: 25, cropRight: 25 }, { x: 480, cropLeft: 25, cropRight: 25 }] },
  empilhado: { label: "2 empilhados", count: 2, cells: [{ y: -270, cropTop: 25, cropBottom: 25 }, { y: 270, cropTop: 25, cropBottom: 25 }] },
  tres: {
    label: "3 colunas",
    count: 3,
    cells: [
      { x: -640, cropLeft: 33.33, cropRight: 33.33 },
      { x: 0, cropLeft: 33.33, cropRight: 33.33 },
      { x: 640, cropLeft: 33.33, cropRight: 33.33 },
    ],
  },
  grade: {
    label: "Grade 2×2",
    count: 4,
    cells: [
      { x: -480, y: -270, scale: 50 },
      { x: 480, y: -270, scale: 50 },
      { x: -480, y: 270, scale: 50 },
      { x: 480, y: 270, scale: 50 },
    ],
  },
  pip: { label: "Imagem na imagem (PiP)", count: 2, cells: [{}, { x: 620, y: 330, scale: 30 }] },
};

function multiScreen(state, params, kit) {
  const layout = MULTI_LAYOUTS[params.layout];
  const order = ["V1", "V2", "V3"];
  const chosen = state.clips
    .filter((clip) => state.selectedIds.includes(clip.id) && order.includes(clip.track) && !clip.type?.startsWith("audio") && clip.type !== TITLE_TYPE && !kit.lockedTrack(state, clip.track))
    .sort((a, b) => order.indexOf(a.track) - order.indexOf(b.track) || a.start - b.start);
  if (chosen.length < layout.count)
    throw new kit.ToolError(`“${layout.label}” precisa de ${layout.count} clipes selecionados, um em cada faixa de vídeo (V1, V2, V3), tocando ao mesmo tempo.`);
  const cells = new Map(chosen.slice(0, layout.count).map((clip, index) => [clip.id, { ...NEUTRAL, ...layout.cells[index] }]));
  return {
    ok: true,
    count: cells.size,
    clips: state.clips.map((clip) => (cells.has(clip.id) ? { ...clip, ...cells.get(clip.id) } : clip)),
    summary: `Multi-tela “${layout.label}” em ${cells.size} clipe(s) (o primeiro fica na faixa mais baixa)`,
  };
}

// ---------------------------------------------------------------- Biblioteca de SFX
const CATEGORY_RULES = [
  ["Swoosh", /swoosh/i],
  ["Whoosh", /whoosh|woosh|swish/i],
  ["Hit", /\bhit|impact|punch|boom|thud/i],
  ["Rise", /rise|riser|build|sweep/i],
  ["Transição", /transi/i],
  ["Click", /click|clique|tap/i],
  ["Pop", /\bpop|bubble|bolha/i],
  ["Glitch", /glitch|digital|bug/i],
  ["UI", /\bui\b|interface|notif|beep|bip/i],
  ["Grave", /bass|drop|sub\b|grave/i],
  ["Cinemático", /cinema|trailer|braam/i],
];
export const soundCategory = (name) => CATEGORY_RULES.find(([, pattern]) => pattern.test(String(name)))?.[0] || "Outros";

function libraryItems(state, category) {
  return state.media
    .filter((item) => item.type?.startsWith("audio") && !item.offline && item.url)
    .map((item) => ({ item, category: soundCategory(item.name) }))
    .filter((entry) => category === "todas" || entry.category === category);
}

function sfxLibrary(state, params, kit) {
  const entries = libraryItems(state, params.category);
  if (!entries.length)
    throw new kit.ToolError(
      params.category === "todas"
        ? "Nenhum som no projeto. Importe seus arquivos de efeito (Mídia › Importar); as categorias saem do nome do arquivo."
        : `Nenhum som na categoria “${params.category}”.`,
    );
  const items = entries.map(({ item, category }) => ({
    id: item.id,
    timecode: category,
    label: item.name,
    badge: item.duration ? `${Number(item.duration).toFixed(1).replace(".", ",")} s` : undefined,
    selected: false,
    preview: true,
  }));
  const base = { headline: { count: entries.length, text: `som(ns) ${params.category === "todas" ? "no projeto" : `em ${params.category}`}` }, items };
  const chosen = entries.filter(({ item }) => (params.selectedItems || []).includes(item.id));
  if (!chosen.length) return { ok: true, count: 0, ...base, summary: "Ouça na lista (▶) e marque os sons para colocar no indicador." };
  if (kit.lockedTrack(state, params.track)) throw new kit.ToolError(`A faixa ${params.track} está bloqueada.`);
  let start = state.playhead || 0;
  const placed = [];
  for (const { item } of chosen) {
    const duration = Math.max(0.1, Math.min(params.maxLength, Number(item.duration) || params.maxLength));
    const busy = [...state.clips, ...placed].some((clip) => clip.track === params.track && clip.start < start + duration - 1e-6 && clipEnd(clip) > start + 1e-6);
    if (busy) throw new kit.ToolError(`A faixa ${params.track} está ocupada em ${kit.timecode(start)}: mova o indicador ou troque a trilha de SFX no rodapé.`);
    placed.push({
      ...item,
      assetId: item.assetId ?? item.id,
      mediaDuration: item.mediaDuration ?? item.duration,
      id: `sfx-${Date.now().toString(36)}-${placed.length}`,
      track: params.track,
      start: round(start),
      duration,
      sourceIn: 0,
      volume: Math.round(Math.min(200, 10 ** (params.volume / 20) * 100)),
      speed: 100,
      opacity: 100,
      x: 0,
      y: 0,
      scale: 100,
      rotation: 0,
      keyframes: [],
    });
    start += duration;
  }
  return { ok: true, count: placed.length, clips: [...state.clips, ...placed], ...base, summary: `${placed.length} som(ns) colocado(s) em ${params.track} a partir de ${kit.timecode(state.playhead || 0)}` };
}

export function mmfilmExtraTools(kit, state) {
  const categories = [...new Set(state.media.filter((item) => item.type?.startsWith("audio")).map((item) => soundCategory(item.name)))];
  return [
    {
      id: "transcribe.run",
      tab: "transcricao",
      label: "Transcrever",
      icon: Mic,
      description: "Transcreve a fala das mídias do Acervo na timeline e cria as legendas no tempo certo (reaproveita transcrição já salva).",
      how: "Usa o mesmo serviço de transcrição do ClipsFree: se a mídia já foi transcrita no Acervo, a transcrição salva é reaproveitada; senão, o servidor transcreve uma vez e guarda. As falas são recortadas ao trecho de cada clipe e convertidas para o tempo da timeline (inclusive com velocidade). Arquivos do computador não são enviados: para eles, use Importar SRT.",
      params: [
        { key: "template", label: "Estilo das legendas", type: "select", default: "mm-tarja-escura", options: kit.captionTemplateOptions() },
        { key: "track", label: "Faixa das legendas", type: "select", default: kit.targets.captions, options: [["V3", "V3"], ["V2", "V2"]] },
        { key: "replace", label: "Substituir as legendas que já estão na timeline", type: "toggle", default: true },
        { key: "musicTracks", label: "Não transcrever (música)", type: "multi", default: ["A2", "A3"], options: kit.AUDIO_TRACKS },
      ],
      analyze: false,
      confirm: "Transcrever as mídias do Acervo da timeline? Se já houver transcrição salva, ela é reaproveitada.",
      applyLabel: "Transcrever",
      run: (current, params, env) => transcribe(current, params, env, kit),
    },
    {
      id: "motion.speedramp",
      tab: "movimento",
      label: "Rampa de velocidade",
      icon: Gauge,
      description: "Acelera ou desacelera o clipe aos poucos (speed ramp), em 6 degraus, levando junto o áudio vinculado.",
      how: "O clipe é dividido em 6 pedaços do mesmo trecho de mídia, cada um com uma velocidade da rampa. A duração muda conforme as velocidades e os clipes seguintes da faixa acompanham, sem abrir buraco.",
      params: [
        { key: "shape", label: "Rampa", type: "chips", default: "acelerar", options: [["acelerar", "Acelerar"], ["desacelerar", "Desacelerar"], ["ida-volta", "Ida e volta"]] },
        { key: "from", label: "Velocidade inicial", type: "stepper", min: 25, max: 400, step: 25, default: 100, unit: "%" },
        { key: "to", label: "Velocidade máxima", type: "stepper", min: 25, max: 400, step: 25, default: 250, unit: "%" },
      ],
      analyze: false,
      run: (current, params) => speedRamp(current, params, kit),
    },
    {
      id: "packs.multiscreen",
      tab: "packs",
      label: "Multi-tela",
      icon: PanelsTopLeft,
      description: "Monta tela dividida com os clipes selecionados: lado a lado, empilhados, 3 colunas, grade 2×2 ou imagem na imagem.",
      how: "Selecione um clipe em cada faixa de vídeo (V1, V2, V3) tocando no mesmo trecho. O primeiro é o da faixa mais baixa. Posição, escala e recorte são ajustados e continuam editáveis nos controles de efeito.",
      params: [{ key: "layout", label: "Layout", type: "select", default: "lado", options: Object.entries(MULTI_LAYOUTS).map(([id, layout]) => [id, layout.label]) }],
      analyze: false,
      run: (current, params) => multiScreen(current, params, kit),
    },
    {
      id: "sfx.library",
      tab: "sfx",
      label: "Biblioteca de sons",
      icon: Library,
      description: "Sons do projeto por categoria (pelo nome do arquivo), com prévia: ouça, marque e coloque no indicador.",
      how: "As categorias saem do nome do arquivo (whoosh, hit, rise, click, pop, glitch…). Use seus próprios sons ou sons livres (CC0). Os sons marcados entram em sequência a partir do indicador, na trilha de SFX do rodapé.",
      params: [
        { key: "category", label: "Categoria", type: "chips", default: "todas", options: [["todas", "Todas"], ...categories.map((name) => [name, name])] },
        { key: "volume", label: "Volume", type: "stepper", min: -24, max: 6, step: 1, default: -6, unit: "dB" },
        { key: "maxLength", label: "Duração máxima", type: "stepper", min: 0.3, max: 10, step: 0.1, default: 3, unit: "s" },
        { key: "track", label: "Trilha de SFX", type: "select", default: kit.targets.sfx, options: kit.AUDIO_TRACKS },
      ],
      live: true,
      applyLabel: "Colocar no indicador",
      run: (current, params) => sfxLibrary(current, params, kit),
    },
  ];
}
