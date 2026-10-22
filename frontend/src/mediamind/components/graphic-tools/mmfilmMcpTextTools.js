// Ferramentas de texto do MMFilm para o MCP: legendas com templates próprios, vícios de linguagem, títulos de
// impacto e SRT. A fonte das palavras são as legendas da timeline (SRT importado ou transcrição); os tempos de
// palavra vindos de SRT são estimados pelo tamanho de cada palavra.
import { Captions, Download, FileUp, Heading, MessageSquareX, Mic, Palette, Repeat2 } from "lucide-react";
import {
  CAPTION_TEMPLATES,
  captionClips,
  captionTemplate,
  detectFillers,
  fillerRanges,
  fontAvailable,
  reflowCaptions,
  retemplateCaptions,
  scoreTitles,
  toSrt,
  wordsFromCues,
} from "../../lib/mmfilmCaptions";
import { clipEnd, removeRanges, timeAfterRemoval } from "../../lib/mmfilmEdits";

const TITLE_TYPE = "text/title";
const LANGUAGES = [
  ["pt", "Português"],
  ["en", "English"],
  ["es", "Español"],
];
export const CAPTION_FONTS = ["Inter", "Montserrat", "Arial", "Georgia", "Courier New", "Impact", "Verdana", "Trebuchet MS"];

export const captionCuesFrom = (clips) =>
  clips
    .filter((clip) => clip.caption && clip.type === TITLE_TYPE)
    .sort((a, b) => a.start - b.start)
    .map((clip) => ({ start: clip.start, end: clipEnd(clip), text: String(clip.text || "") }));

function wordsOf(state, kit) {
  if (state.transcript?.words?.length) return state.transcript.words;
  const cues = captionCuesFrom(state.clips);
  if (!cues.length) throw new kit.ToolError("Sem texto na timeline: importe um SRT (rodapé › Importar SRT) ou transcreva antes.");
  return wordsFromCues(cues);
}

function styleOverrides(params) {
  const overrides = {};
  if (params.font && params.font !== "template") overrides.font = params.font;
  if (params.fill) overrides.fill = params.fill;
  if (params.size) overrides.size = Number(params.size);
  if (params.align && params.align !== "template") overrides.align = params.align;
  if (params.box === "sim") overrides.box = true;
  if (params.box === "nao") overrides.box = false;
  return overrides;
}

function fontNote(style) {
  return fontAvailable(style.font) ? "" : ` · Fonte “${style.font}” não instalada neste computador: o navegador usa outra parecida — instale-a ou escolha outra.`;
}

function createCaptions(state, params, kit) {
  if (kit.lockedTrack(state, params.track)) throw new kit.ToolError(`A faixa ${params.track} está bloqueada.`);
  const words = wordsOf(state, kit);
  const cues = reflowCaptions(words, {
    mode: params.mode,
    maxChars: params.maxChars,
    maxLines: params.maxLines,
    uppercase: params.uppercase,
    stripPunctuation: params.stripPunctuation,
  });
  if (!cues.length) return { ok: true, count: 0, summary: "Nenhuma palavra para legendar." };
  const style = { ...captionTemplate(params.template), ...styleOverrides(params) };
  const created = captionClips(cues, { template: style, track: params.track, idPrefix: `legenda-${Date.now().toString(36)}` });
  const kept = state.clips.filter((clip) => !(clip.caption && clip.type === TITLE_TYPE));
  return {
    ok: true,
    count: created.length,
    clips: [...kept, ...created],
    headline: { count: created.length, text: `legenda(s) em ${params.track} · ${style.name}` },
    summary: `${created.length} legenda(s) ${params.mode === "palavra" ? "palavra por palavra" : `em até ${params.maxLines} linha(s)`} com o template “${style.name}”${fontNote(style)}`,
    details: cues.slice(0, 12).map((cue) => `${kit.timecode(cue.start)} · ${cue.text.replace(/\n/g, " / ")}`),
  };
}

function retemplate(state, params, kit) {
  const captions = state.clips.filter((clip) => clip.caption && clip.type === TITLE_TYPE && !kit.lockedTrack(state, clip.track));
  if (!captions.length) throw new kit.ToolError("Não há legendas (desbloqueadas) na timeline para trocar o template.");
  const style = { ...captionTemplate(params.template), ...styleOverrides(params) };
  return {
    ok: true,
    count: captions.length,
    clips: state.clips.map((clip) => (kit.lockedTrack(state, clip.track) ? clip : retemplateCaptions([clip], style)[0])),
    headline: { count: captions.length, text: `legenda(s) com o template “${style.name}”` },
    summary: `Template trocado em ${captions.length} legenda(s), mesmos tempos e textos${fontNote(style)}`,
  };
}

function copyStyleFromSelection(state, kit) {
  const source = state.clips.find((clip) => state.selectedIds.includes(clip.id) && clip.type === TITLE_TYPE && clip.captionStyle);
  if (!source) throw new kit.ToolError("Selecione na timeline uma legenda que já tenha o estilo desejado.");
  const others = state.clips.filter((clip) => clip.caption && clip.type === TITLE_TYPE && clip.id !== source.id && !kit.lockedTrack(state, clip.track));
  if (!others.length) return { ok: true, count: 0, summary: "Não há outras legendas para receber o estilo." };
  const ids = new Set(others.map((clip) => clip.id));
  return {
    ok: true,
    count: others.length,
    clips: state.clips.map((clip) => (ids.has(clip.id) ? { ...clip, captionStyle: { ...source.captionStyle } } : clip)),
    summary: `Estilo de “${source.name || source.text}” copiado para ${others.length} legenda(s)`,
  };
}

function exportSrt(state, params, kit) {
  const cues = captionCuesFrom(state.clips);
  if (!cues.length) throw new kit.ToolError("Não há legendas na timeline para exportar.");
  return {
    ok: true,
    count: cues.length,
    download: { name: `${params.fileName || "legendas"}.srt`, type: "application/x-subrip", text: toSrt(cues) },
    summary: `${cues.length} legenda(s) exportada(s) em SRT`,
  };
}

async function removeFillers(state, params, env, kit) {
  const words = wordsOf(state, kit);
  let envelope;
  let threshold;
  try {
    ({ envelope, threshold } = await kit.envelopeFor(state, { ...params, scope: "sequence" }, env));
  } catch (error) {
    if (!(error instanceof kit.ToolError)) throw error;
  }
  const found = detectFillers(words, { language: params.language, hesitations: params.hesitations, repetitions: params.repetitions, envelope, threshold });
  if (!found.length) return { ok: true, count: 0, summary: "Nenhum vício de linguagem encontrado no texto da timeline." };
  const items = found.map((item) => ({
    id: item.id,
    time: item.start,
    timecode: kit.timecode(item.start),
    label: `${item.kind === "repeticao" ? "repetição" : "hesitação"}: “${item.word}”${item.certain ? "" : " (confira)"}`,
    badge: item.kind === "repeticao" ? "repetida" : "hesitação",
    selected: item.certain,
  }));
  const chosenIds = params.selectedItems || found.filter((item) => item.certain).map((item) => item.id);
  const chosen = found.filter((item) => chosenIds.includes(item.id));
  const base = {
    headline: { count: found.length, text: `vício(s) encontrado(s) · ${found.filter((item) => item.certain).length} com pausa clara` },
    items,
  };
  if (!chosen.length) return { ok: true, count: 0, ...base, summary: "Nada marcado para cortar: confira a lista e marque os itens." };
  const ranges = fillerRanges(chosen);
  const music = params.musicTracks || [];
  return {
    ok: true,
    count: chosen.length,
    clips: removeRanges(state.clips, ranges, { skipTrack: (track) => kit.lockedTrack(state, track) || music.includes(track) }),
    markers: state.markers.map((time) => timeAfterRemoval(time, ranges)),
    ...base,
    summary: `${chosen.length} vício(s) cortado(s) · −${(ranges.reduce((sum, [start, end]) => sum + end - start, 0)).toFixed(2).replace(".", ",")} s`,
  };
}

function animatedTitles(state, params, kit) {
  if (kit.lockedTrack(state, params.track)) throw new kit.ToolError(`A faixa ${params.track} está bloqueada.`);
  const cues = state.transcript?.words?.length ? state.transcript.words : captionCuesFrom(state.clips);
  if (!cues.length) throw new kit.ToolError("Sem texto na timeline: importe um SRT (rodapé › Importar SRT) ou transcreva antes.");
  const phrases = scoreTitles(cues, { language: params.language, count: params.count });
  if (!phrases.length) return { ok: true, count: 0, summary: "Nenhuma frase de impacto encontrada." };
  const items = phrases.map((phrase, index) => ({
    id: `titulo-${index}`,
    time: phrase.start,
    timecode: kit.timecode(phrase.start),
    label: phrase.text,
    badge: `nota ${String(phrase.score).replace(".", ",")}`,
  }));
  const chosen = params.selectedItems ? phrases.filter((_, index) => params.selectedItems.includes(`titulo-${index}`)) : phrases;
  const free = chosen.filter(
    (phrase) => !state.clips.some((clip) => clip.track === params.track && clip.start < phrase.end && clipEnd(clip) > phrase.start),
  );
  const created = free.map((phrase, index) => ({
    id: `titulo-${Date.now().toString(36)}-${index}`,
    name: phrase.text.slice(0, 40),
    type: TITLE_TYPE,
    track: params.track,
    start: phrase.start,
    duration: Math.max(1.2, Math.min(4, phrase.end - phrase.start)),
    sourceIn: 0,
    text: params.uppercase ? phrase.text.toUpperCase() : phrase.text,
    titleHighlight: true,
    textAnimation: params.animation === "nenhuma" ? undefined : params.animation,
    captionStyle: { ...captionTemplate(params.template), position: "center" },
    opacity: 100,
    volume: 100,
    speed: 100,
    x: 0,
    y: 0,
    scale: 100,
    rotation: 0,
    keyframes: [],
  }));
  return {
    ok: true,
    count: created.length,
    clips: [...state.clips, ...created],
    headline: { count: phrases.length, text: "frase(s) de impacto" },
    items,
    summary: `${created.length} título(s) animado(s) em ${params.track}${chosen.length - created.length ? ` · ${chosen.length - created.length} pulado(s): faixa ocupada` : ""}`,
  };
}

const templateOptions = () => CAPTION_TEMPLATES.map((item) => [item.id, `${item.folder} · ${item.name}`]);
const styleParams = (section) => [
  { key: "template", label: "Template", type: "select", default: CAPTION_TEMPLATES[0].id, options: templateOptions(), section, help: "Templates próprios do MediaMind, por pasta." },
  { key: "font", label: "Fonte", type: "select", default: "template", options: [["template", "A do template"], ...CAPTION_FONTS.map((font) => [font, font])], section, description: "Troca só a fonte; cores, animação e o resto do template continuam." },
  { key: "fill", label: "Cor do texto", type: "color", default: "", section },
  { key: "size", label: "Tamanho", type: "stepper", min: 0, max: 200, step: 2, default: 0, unit: "px", section, help: "0 = tamanho do template." },
  { key: "align", label: "Alinhamento", type: "chips", default: "template", options: [["template", "Template"], ["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]], section },
  { key: "box", label: "Caixa atrás do texto", type: "chips", default: "template", options: [["template", "Template"], ["sim", "Ligada"], ["nao", "Desligada"]], section },
];

/** Ferramentas de texto (recebe os auxiliares do catálogo principal para evitar dependência circular). */
export function mmfilmTextTools(kit) {
  return [
    {
      id: "captions.create",
      tab: "legendas",
      label: "Criar legendas",
      icon: Captions,
      description: "Gera as legendas a partir do texto da timeline (SRT importado ou transcrição), palavra por palavra ou em até 6 linhas.",
      how: "As palavras saem das legendas existentes (tempo estimado pelo tamanho de cada palavra) ou da transcrição. As linhas nunca passam do limite de caracteres e quebram em pausas e fins de frase. As legendas antigas são substituídas; o Desfazer volta tudo.",
      params: [
        { key: "mode", label: "Formato", type: "chips", default: "linhas", options: [["palavra", "Palavra por palavra"], ["linhas", "Linhas"]], section: "1. Formato" },
        { key: "maxLines", label: "Linhas por legenda", type: "stepper", min: 1, max: 6, step: 1, default: 2, section: "1. Formato", when: { key: "mode", equals: "linhas" } },
        { key: "maxChars", label: "Caracteres por linha", type: "stepper", min: 10, max: 60, step: 1, default: 32, section: "1. Formato", help: "Nenhuma linha estoura a tela, nem em vídeo vertical." },
        { key: "uppercase", label: "MAIÚSCULAS", type: "toggle", default: false, section: "1. Formato" },
        { key: "stripPunctuation", label: "Remover pontuação", type: "toggle", default: false, section: "1. Formato" },
        ...styleParams("2. Estilo"),
        { key: "track", label: "Faixa das legendas", type: "select", default: kit.targets.captions, options: [["V3", "V3"], ["V2", "V2"]], section: "2. Estilo" },
      ],
      applyLabel: "Criar legendas",
      run: (state, params) => createCaptions(state, params, kit),
    },
    {
      id: "captions.retemplate",
      tab: "legendas",
      label: "Re-transcrever legendas",
      icon: Repeat2,
      description: "Troca o template das legendas que já estão na timeline, sem refazer nada: mesmos tempos, mesma trilha, textos corrigidos.",
      params: styleParams("Novo estilo"),
      applyLabel: "Trocar template",
      run: (state, params) => retemplate(state, params, kit),
    },
    {
      id: "captions.copystyle",
      tab: "legendas",
      label: "Estilo da timeline",
      icon: Palette,
      description: "Copia o estilo da legenda selecionada na timeline para todas as outras legendas.",
      params: [],
      analyze: false,
      run: (state) => copyStyleFromSelection(state, kit),
    },
    {
      id: "captions.exportsrt",
      tab: "legendas",
      label: "Exportar SRT",
      icon: Download,
      description: "Baixa as legendas da timeline como arquivo .srt.",
      params: [{ key: "fileName", label: "Nome do arquivo", type: "select", default: "legendas", options: [["legendas", "legendas.srt"], ["captions", "captions.srt"]] }],
      analyze: false,
      applyLabel: "Baixar SRT",
      run: (state, params) => exportSrt(state, params, kit),
    },
    {
      id: "transcribe.run",
      tab: "transcricao",
      label: "Transcrever",
      icon: Mic,
      status: "soon",
      soonReason: "a transcrição com tempo por palavra vai usar o serviço que o ClipsFree já tem. Enquanto isso, use “Importar SRT” (pode ser o SRT exportado da transcrição de outro programa).",
      description: "Transcreve a fala da timeline com o tempo de cada palavra.",
      params: [],
      run: () => ({ ok: false, summary: "Em breve." }),
    },
    {
      id: "transcribe.importsrt",
      tab: "transcricao",
      label: "Importar SRT",
      icon: FileUp,
      description: "Escolhe um arquivo SRT ou VTT e cria as legendas na timeline (base para cortes por frase, vícios, títulos e SFX).",
      params: [],
      analyze: false,
      applyLabel: "Escolher arquivo",
      run: () => ({ ok: true, count: 0, openCaptionFile: true, summary: "Escolha o arquivo SRT ou VTT na janela que abriu." }),
    },
    {
      id: "fillers.remove",
      tab: "transcricao",
      label: "Vícios de linguagem",
      icon: MessageSquareX,
      description: "Encontra hesitações (ãh, é…, hum) e palavras repetidas (“eu eu”) e corta os trechos marcados, fechando os buracos.",
      how: "Hesitações da lista do idioma contam sempre; palavras como “tipo”, “né” e “então” só quando isoladas por pausas. Repetição marca a primeira palavra. Com o áudio da voz, o corte vai para o meio das pausas ao redor (itens já marcados); sem pausa clara, o item fica desmarcado para você conferir.",
      params: [
        { key: "language", label: "Idioma do texto", type: "select", default: "pt", options: LANGUAGES, section: "Vícios" },
        { key: "hesitations", label: "Hesitações", type: "toggle", default: true, section: "Vícios", description: "ãh, é…, hum, hmm, ahn" },
        { key: "repetitions", label: "Palavras repetidas", type: "toggle", default: true, section: "Vícios", description: "“eu eu”, “que que”: tira a primeira" },
        { key: "analysisTracks", label: "Trilha da voz (para achar as pausas)", type: "multi", default: ["A1", "V1"], options: kit.ALL_TRACKS, section: "Trilhas" },
        { key: "musicTracks", label: "Não cortar a música", type: "multi", default: ["A2", "A3"], options: kit.AUDIO_TRACKS, section: "Trilhas" },
        { ...kit.backupParam, section: "Trilhas" },
      ],
      confirm: "Cortar os vícios marcados em todas as trilhas destravadas? O Desfazer volta tudo.",
      applyLabel: "Cortar vícios",
      run: (state, params, env) => removeFillers(state, params, env, kit),
    },
    {
      id: "titles.create",
      tab: "legendas",
      label: "Títulos animados",
      icon: Heading,
      description: "Escolhe as frases de maior impacto da fala e cria títulos animados em destaque.",
      how: "Pontua cada frase por palavras-chave (sem palavras vazias do idioma); números e palavras de ênfase pesam mais. A timeline é dividida em faixas e a melhor frase de cada uma vira título. Faixa ocupada no trecho é pulada.",
      params: [
        { key: "language", label: "Idioma do texto", type: "select", default: "pt", options: LANGUAGES, section: "Títulos" },
        { key: "count", label: "Quantidade de títulos", type: "chips", default: "medio", options: [["poucos", "Poucos"], ["medio", "Médio"], ["muitos", "Muitos"]], section: "Títulos" },
        { key: "animation", label: "Animação", type: "select", default: "pop-palavras", options: kit.textAnimationOptions(), section: "Títulos" },
        { key: "template", label: "Estilo", type: "select", default: "mm-vertical-centro", options: templateOptions(), section: "Títulos" },
        { key: "uppercase", label: "MAIÚSCULAS", type: "toggle", default: true, section: "Títulos" },
        { key: "track", label: "Faixa dos títulos", type: "select", default: "V2", options: [["V2", "V2"], ["V3", "V3"]], section: "Títulos" },
      ],
      applyLabel: "Criar títulos",
      run: (state, params) => animatedTitles(state, params, kit),
    },
  ];
}
