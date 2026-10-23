// Ferramentas de movimento, animação de texto, transições e looks do MMFilm para o MCP.
// Tudo é gravado no clipe (motion, textAnimation, transition, look) e aparece no preview e na exportação.
import {
  ArrowRightLeft,
  Ban,
  Blend,
  Box,
  Clapperboard,
  Copy,
  Droplets,
  Eye,
  Focus,
  Keyboard,
  LogIn,
  LogOut,
  Maximize,
  Palette,
  RotateCw,
  Scaling,
  ScrollText,
  Sparkle,
  Vibrate,
  Waves,
  Wind,
  ZoomIn,
  Zap,
} from "lucide-react";
import { captionTemplate } from "../../lib/mmfilmCaptions";
import { clipEnd } from "../../lib/mmfilmEdits";
import { LOOKS, TRANSITIONS, applyLook, removeLook } from "../../lib/mmfilmLooks";
import { MOTION_CATEGORIES, MOTION_PRESETS, STYLE_PARTS, cloneStyle, mergeMotion, motionPresetCurves, quickMove } from "../../lib/mmfilmMotionPresets";
import { TEXT_ANIMATIONS, TEXT_ANIMATION_GROUPS } from "../../lib/mmfilmTextAnimation";

const TITLE_TYPE = "text/title";
const CATEGORY_ICONS = { Deslizar: ArrowRightLeft, Zoom: ZoomIn, "Rotação 2D": RotateCw, "Rotação 3D": Box, Desfoque: Droplets, Glitch: Zap, Tremor: Vibrate, Escala: Maximize, Elástico: Waves, Opacidade: Eye };
const GROUP_ICONS = { Entrada: LogIn, Digitação: Keyboard, Ênfase: Sparkle, Saída: LogOut };
const slug = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

export const TEXT_ANIMATION_OPTIONS = TEXT_ANIMATIONS.map((item) => [item.id, `${item.group} · ${item.name}`]);

function selectedVisual(state, kit) {
  const chosen = state.clips.filter(
    (clip) => state.selectedIds.includes(clip.id) && clip.track.startsWith("V") && !clip.type?.startsWith("audio") && !kit.lockedTrack(state, clip.track),
  );
  if (!chosen.length) throw new kit.ToolError("Selecione um ou mais clipes de vídeo, imagem ou título (faixas V desbloqueadas) na timeline.");
  return chosen;
}

function patchClips(state, ids, change) {
  return state.clips.map((clip) => (ids.has(clip.id) ? change(clip) : clip));
}

function motionPresetTool(category, kit) {
  const presets = MOTION_PRESETS.filter((item) => item.category === category);
  return {
    id: `motionpreset.${slug(category)}`,
    tab: "motionpresets",
    label: category,
    icon: CATEGORY_ICONS[category] || Box,
    description: `Animação de entrada e/ou saída (${presets.length} preset(s) de ${category.toLowerCase()}) nos clipes selecionados.`,
    params: [
      { key: "preset", label: "Preset", type: "select", default: presets[0].id, options: presets.map((item) => [item.id, item.name]) },
      { key: "kind", label: "Onde", type: "chips", default: "in", options: [["in", "Entrada"], ["out", "Saída"], ["both", "Entrada + Saída"]], help: "Entrada anima o começo do clipe; Saída, o final." },
      { key: "length", label: "Duração da animação", type: "stepper", min: 0.1, max: 3, step: 0.1, default: 0.5, unit: "s" },
      { key: "keep", label: "Somar ao movimento que o clipe já tem", type: "toggle", default: true, description: "Desligado, substitui zoom, shake e outros movimentos do clipe." },
    ],
    analyze: false,
    run: (state, params) => {
      const chosen = selectedVisual(state, kit);
      const preset = presets.find((item) => item.id === params.preset) || presets[0];
      const ids = new Set(chosen.map((clip) => clip.id));
      return {
        ok: true,
        count: chosen.length,
        clips: patchClips(state, ids, (clip) => {
          const curves = motionPresetCurves(preset, params.kind, clip.duration, { length: params.length });
          return { ...clip, motion: params.keep ? mergeMotion(clip.motion, curves) : curves };
        }),
        summary: `“${preset.name}” (${params.kind === "both" ? "entrada e saída" : params.kind === "in" ? "entrada" : "saída"}) em ${chosen.length} clipe(s)`,
      };
    },
  };
}

function textAnimationTool(group, kit) {
  const presets = TEXT_ANIMATIONS.filter((item) => item.group === group);
  return {
    id: `textanim.${slug(group)}`,
    tab: "texto",
    label: `Texto · ${group}`,
    icon: GROUP_ICONS[group] || Sparkle,
    description: `${presets.length} animação(ões) de ${group.toLowerCase()} para títulos e legendas selecionados, mantendo o estilo do texto.`,
    params: [{ key: "preset", label: "Animação", type: "select", default: presets[0].id, options: presets.map((item) => [item.id, item.name]) }],
    analyze: false,
    run: (state, params) => {
      const chosen = state.clips.filter((clip) => state.selectedIds.includes(clip.id) && clip.type === TITLE_TYPE && !kit.lockedTrack(state, clip.track));
      if (!chosen.length) throw new kit.ToolError("Selecione na timeline um ou mais títulos ou legendas.");
      const preset = presets.find((item) => item.id === params.preset) || presets[0];
      return {
        ok: true,
        count: chosen.length,
        clips: patchClips(state, new Set(chosen.map((clip) => clip.id)), (clip) => ({ ...clip, textAnimation: preset.id })),
        summary: `Animação “${preset.name}” em ${chosen.length} texto(s)`,
      };
    },
  };
}

function quickMoveTool(kind, label, icon, description, kit) {
  return {
    id: `motion.${kind}`,
    tab: "movimento",
    label,
    icon,
    description,
    params: [{ key: "intensity", label: "Intensidade", type: "range", min: 1, max: 10, step: 1, default: 5 }],
    analyze: false,
    run: (state, params) => {
      const chosen = selectedVisual(state, kit);
      let count = 0;
      const clips = patchClips(state, new Set(chosen.map((clip) => clip.id)), (clip) => {
        const curves = quickMove(kind, clip.duration, { intensity: params.intensity, motion: clip.motion, clip });
        if (!curves) return clip;
        count += 1;
        return { ...clip, motion: mergeMotion(clip.motion, curves) };
      });
      return { ok: true, count, clips, summary: `${label} aplicado em ${count} clipe(s)` };
    },
  };
}

function cloneStyleTool(kit) {
  return {
    id: "motion.clonestyle",
    tab: "movimento",
    label: "Clonar estilo",
    icon: Copy,
    description: "Copia movimento, opacidade, cor, look e efeitos do primeiro clipe selecionado e cola nos outros selecionados.",
    how: "Selecione primeiro o clipe com o estilo pronto (ele fica como referência) e depois, com Ctrl/Shift, os clipes que vão receber. Os tempos das animações acompanham a duração de cada clipe (modo relativo).",
    params: [
      {
        key: "parts",
        label: "O que copiar",
        type: "multi",
        default: Object.keys(STYLE_PARTS),
        options: [["transform", "Posição, escala e rotação"], ["opacity", "Opacidade"], ["color", "Cor"], ["motion", "Movimento (keyframes)"], ["effects", "Efeitos"], ["look", "Look de cor"]],
      },
      { key: "timing", label: "Tempos das animações", type: "chips", default: "relative", options: [["relative", "Acompanhar a duração"], ["absolute", "Mesmos segundos"]] },
    ],
    analyze: false,
    run: (state, params) => {
      const source = state.clips.find((clip) => clip.id === (state.primaryId || state.selectedIds[0]));
      // Só clipes visuais recebem o estilo (a seleção vinculada também traz o áudio dos vídeos).
      const targets = state.clips.filter(
        (clip) =>
          state.selectedIds.includes(clip.id) &&
          clip.id !== source?.id &&
          clip.track.startsWith("V") &&
          !clip.type?.startsWith("audio") &&
          !kit.lockedTrack(state, clip.track),
      );
      if (!source || !targets.length) throw new kit.ToolError("Selecione o clipe de referência e pelo menos mais um clipe para receber o estilo.");
      const updated = new Map(cloneStyle(source, targets, { parts: params.parts, timing: params.timing }).map((clip) => [clip.id, clip]));
      return {
        ok: true,
        count: targets.length,
        clips: state.clips.map((clip) => updated.get(clip.id) || clip),
        summary: `Estilo de “${source.name || "clipe"}” clonado em ${targets.length} clipe(s)`,
      };
    },
  };
}

// Cortes (encontros de clipes) na faixa: o clipe que entra recebe a transição.
function incomingClips(state, track, onlySelected) {
  const ordered = state.clips.filter((clip) => clip.track === track && clip.enabled !== false).sort((a, b) => a.start - b.start);
  return ordered.filter((clip, index) => {
    const previous = ordered[index - 1];
    if (!previous || Math.abs(clipEnd(previous) - clip.start) > 0.002) return false;
    return !onlySelected || state.selectedIds.includes(clip.id) || state.selectedIds.includes(previous.id);
  });
}

function packsTools(kit) {
  const titleClip = (text, start, duration, params, extra = {}) => ({
    id: `pack-${Date.now().toString(36)}-${Math.round(start * 1000)}`,
    name: text.split("\n")[0].slice(0, 40),
    type: TITLE_TYPE,
    track: params.track,
    start,
    duration,
    sourceIn: 0,
    text,
    captionStyle: { ...captionTemplate(params.template), position: "center" },
    textAnimation: params.animation === "nenhuma" ? undefined : params.animation,
    opacity: 100,
    volume: 100,
    speed: 100,
    x: 0,
    y: 0,
    scale: 100,
    rotation: 0,
    keyframes: [],
    ...extra,
  });
  const titleParams = (defaults) => [
    { key: "text", label: "Texto", type: "text", default: defaults.text, rows: defaults.rows || 2 },
    { key: "duration", label: "Duração", type: "stepper", min: 1, max: 20, step: 0.5, default: defaults.duration, unit: "s" },
    { key: "template", label: "Estilo", type: "select", default: defaults.template, options: kit.captionTemplateOptions() },
    { key: "animation", label: "Animação", type: "select", default: defaults.animation, options: [["nenhuma", "Sem animação"], ...TEXT_ANIMATION_OPTIONS] },
    { key: "track", label: "Faixa", type: "select", default: "V2", options: kit.VIDEO_TRACKS },
  ];
  const placeTitle = (state, params, where) => {
    if (!String(params.text || "").trim()) throw new kit.ToolError("Escreva o texto.");
    if (kit.lockedTrack(state, params.track)) throw new kit.ToolError(`A faixa ${params.track} está bloqueada.`);
    const end = state.clips.reduce((value, clip) => Math.max(value, clipEnd(clip)), 0);
    const start = where === "end" ? end : 0;
    const busy = state.clips.some((clip) => clip.track === params.track && clip.start < start + params.duration && clipEnd(clip) > start);
    if (busy) throw new kit.ToolError(`A faixa ${params.track} já tem conteúdo nesse trecho. Escolha outra faixa.`);
    return titleClip(String(params.text).trim(), start, params.duration, params);
  };
  return [
    {
      id: "packs.transition",
      tab: "packs",
      label: "Transições",
      icon: Blend,
      description: `${TRANSITIONS.length} transições próprias (dissolver, mergulho, deslizar, empurrar, zoom, desfoque, cortina, círculo, glitch) nos cortes.`,
      how: "A transição fica centrada no corte, metade antes e metade depois, limitada pela duração dos dois clipes. Usa um pouco de mídia além das pontas de cada clipe; se não houver, o quadro da ponta segura.",
      params: [
        { key: "transition", label: "Transição", type: "select", default: "dissolver", options: TRANSITIONS.map((item) => [item.id, `${item.category} · ${item.name}`]) },
        { key: "duration", label: "Duração", type: "stepper", min: 0.1, max: 3, step: 0.1, default: 0.5, unit: "s" },
        { key: "track", label: "Faixa", type: "select", default: "V1", options: kit.VIDEO_TRACKS },
        { key: "onlySelected", label: "Só nos cortes dos clipes selecionados", type: "toggle", default: false, description: "Desligado, aplica em todos os cortes da faixa." },
      ],
      analyze: false,
      run: (state, params) => {
        if (kit.lockedTrack(state, params.track)) throw new kit.ToolError(`A faixa ${params.track} está bloqueada.`);
        const targets = incomingClips(state, params.track, params.onlySelected);
        if (!targets.length) throw new kit.ToolError(`Nenhum corte (dois clipes encostados) em ${params.track}${params.onlySelected ? " entre os selecionados" : ""}.`);
        const ids = new Set(targets.map((clip) => clip.id));
        const name = TRANSITIONS.find((item) => item.id === params.transition)?.name;
        return {
          ok: true,
          count: targets.length,
          clips: patchClips(state, ids, (clip) => ({ ...clip, transition: { id: params.transition, duration: params.duration } })),
          summary: `“${name}” em ${targets.length} corte(s) de ${params.track}`,
        };
      },
    },
    {
      id: "packs.notransition",
      tab: "packs",
      label: "Remover transições",
      icon: Ban,
      description: "Volta os cortes da faixa para corte seco.",
      params: [{ key: "track", label: "Faixa", type: "select", default: "V1", options: kit.VIDEO_TRACKS }],
      analyze: false,
      run: (state, params) => {
        const targets = state.clips.filter((clip) => clip.track === params.track && clip.transition && !kit.lockedTrack(state, clip.track));
        if (!targets.length) return { ok: true, count: 0, summary: `Nenhuma transição em ${params.track}.` };
        return {
          ok: true,
          count: targets.length,
          clips: patchClips(state, new Set(targets.map((clip) => clip.id)), (clip) => ({ ...clip, transition: undefined })),
          summary: `${targets.length} transição(ões) removida(s)`,
        };
      },
    },
    {
      id: "packs.look",
      tab: "packs",
      label: "Looks de cor",
      icon: Palette,
      description: `${LOOKS.length} looks próprios (cinema, P&B, retrô, clima, drama, suave, estilizado) com intensidade ajustável.`,
      how: "O look soma ajustes de cor aos que o clipe já tem e guarda o que mudou: trocar ou remover o look não perde seus ajustes manuais.",
      params: [
        { key: "look", label: "Look", type: "select", default: LOOKS[0].id, options: LOOKS.map((item) => [item.id, `${item.category} · ${item.name}`]) },
        { key: "intensity", label: "Intensidade", type: "range", min: 0, max: 100, step: 5, default: 100, unit: "%" },
        { key: "scope", label: "Aplicar em", type: "chips", default: "selection", options: [["selection", "Selecionados"], ["track", "Toda a faixa V1"]] },
      ],
      analyze: false,
      run: (state, params) => {
        const chosen =
          params.scope === "track"
            ? state.clips.filter((clip) => clip.track === "V1" && !clip.type?.startsWith("audio") && clip.type !== TITLE_TYPE && !kit.lockedTrack(state, "V1"))
            : selectedVisual(state, kit);
        if (!chosen.length) throw new kit.ToolError("Nenhum clipe de vídeo em V1.");
        const look = LOOKS.find((item) => item.id === params.look);
        return {
          ok: true,
          count: chosen.length,
          clips: patchClips(state, new Set(chosen.map((clip) => clip.id)), (clip) => applyLook(clip, look, params.intensity)),
          summary: `Look “${look.name}” (${params.intensity}%) em ${chosen.length} clipe(s)`,
        };
      },
    },
    {
      id: "packs.nolook",
      tab: "packs",
      label: "Remover look",
      icon: Eye,
      description: "Tira o look dos clipes selecionados, mantendo os ajustes de cor manuais.",
      params: [],
      analyze: false,
      run: (state) => {
        const chosen = selectedVisual(state, kit).filter((clip) => clip.look);
        if (!chosen.length) return { ok: true, count: 0, summary: "Os clipes selecionados não têm look." };
        return { ok: true, count: chosen.length, clips: patchClips(state, new Set(chosen.map((clip) => clip.id)), removeLook), summary: `Look removido de ${chosen.length} clipe(s)` };
      },
    },
    {
      id: "packs.opening",
      tab: "packs",
      label: "Título de abertura",
      icon: Clapperboard,
      description: "Cria um título animado no começo da sequência.",
      params: titleParams({ text: "TÍTULO DO VÍDEO", duration: 3, template: "mm-vertical-centro", animation: "espacamento-in" }),
      analyze: false,
      run: (state, params) => {
        const clip = placeTitle(state, params, "start");
        return { ok: true, count: 1, clips: [...state.clips, clip], summary: `Título de abertura criado em ${params.track}` };
      },
    },
    {
      id: "packs.credits",
      tab: "packs",
      label: "Créditos finais",
      icon: ScrollText,
      description: "Cria os créditos no fim da sequência, com uma linha por crédito.",
      params: titleParams({ text: "Direção\nEdição\nProdução", duration: 6, template: "mm-texto-leve", animation: "subir-palavras", rows: 4 }),
      analyze: false,
      run: (state, params) => {
        const clip = placeTitle(state, params, "end");
        return { ok: true, count: 1, clips: [...state.clips, clip], summary: `Créditos criados no fim da sequência (${params.track})` };
      },
    },
  ];
}

export function mmfilmMotionTools(kit) {
  return [
    quickMoveTool("motionblur", "Motion blur", Wind, "Desfoque de movimento que acompanha a velocidade do zoom/pan do clipe (sem movimento, um desfoque rápido no meio).", kit),
    quickMoveTool("escala", "Pulso de escala", Scaling, "Cresce e volta ao tamanho normal ao longo do clipe.", kit),
    quickMoveTool("centralizar", "Centralizar", Focus, "Leva o clipe deslocado de volta ao centro do quadro com uma rampa suave.", kit),
    cloneStyleTool(kit),
    ...MOTION_CATEGORIES.map((category) => motionPresetTool(category, kit)),
    ...TEXT_ANIMATION_GROUPS.map((group) => textAnimationTool(group, kit)),
    {
      id: "textanim.remove",
      tab: "texto",
      label: "Remover animação",
      icon: Ban,
      description: "Tira a animação dos títulos e legendas selecionados.",
      params: [],
      analyze: false,
      run: (state) => {
        const chosen = state.clips.filter((clip) => state.selectedIds.includes(clip.id) && clip.textAnimation && !kit.lockedTrack(state, clip.track));
        if (!chosen.length) return { ok: true, count: 0, summary: "Os textos selecionados não têm animação." };
        return {
          ok: true,
          count: chosen.length,
          clips: patchClips(state, new Set(chosen.map((clip) => clip.id)), (clip) => ({ ...clip, textAnimation: undefined })),
          summary: `Animação removida de ${chosen.length} texto(s)`,
        };
      },
    },
    ...packsTools(kit),
  ];
}
