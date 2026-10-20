// Ferramentas de legenda do CLIPSFREE: modelos de estilo, quebra de linha,
// geração a partir de palavras temporizadas reais, dividir/unir, verificação,
// SRT/VTT e as instruções de renderização enviadas ao exportador de MP4.
// Nenhuma função inventa texto ou tempo: tudo deriva da transcrição ou da edição.

export const CAPTION_TEMPLATES = [
  { id: 'impacto', label: 'Impacto', uppercase: true, box: true, karaoke: false, color: '#FFFFFF', highlight: '#FFD400' },
  { id: 'dinamico', label: 'Dinâmico', uppercase: false, box: true, karaoke: false, color: '#0F172A', highlight: '#FFFFFF', outline: '#FCD34D' },
  { id: 'limpo', label: 'Limpo', uppercase: false, box: false, karaoke: false, color: '#FFFFFF', highlight: '#FFFFFF' },
  { id: 'karaoke', label: 'Karaokê', uppercase: true, box: false, karaoke: true, color: '#FFFFFF', highlight: '#FACC15' },
  { id: 'neon', label: 'Neon', uppercase: true, box: false, karaoke: true, color: '#E0F2FE', highlight: '#22D3EE' },
  { id: 'contorno', label: 'Contorno', uppercase: false, box: false, karaoke: false, color: '#FFFFFF', highlight: '#F472B6' },
];

export const DEFAULT_CAPTION_SETTINGS = {
  fontSize: 64,
  color: '',
  highlight: '',
  maxChars: 28,
  keywords: '',
  emojis: false,
};

export const CLIP_DURATION_PRESETS = [
  { id: 'curto', label: '15s', seconds: 15 },
  { id: 'medio', label: '30s', seconds: 30 },
  { id: 'longo', label: '45s', seconds: 45 },
  { id: 'maximo', label: '60s', seconds: 60 },
];

export const SESSION_DURATION_PRESETS = [
  { id: 'padrao', label: 'Padrão 20–60s', minimum: 20, maximum: 60 },
  { id: 'curtos', label: 'Curtos 15–30s', minimum: 15, maximum: 30 },
  { id: 'medios', label: 'Médios 30–45s', minimum: 30, maximum: 45 },
  { id: 'longos', label: 'Longos 45–60s', minimum: 45, maximum: 60 },
];

export const EXPORT_PRESETS = [
  { id: '16:9', label: 'Horizontal 16:9 (YouTube)', aspect: '16:9' },
  { id: '9:16', label: 'Vertical 9:16 (Shorts, Reels, TikTok)', aspect: '9:16' },
  { id: '1:1', label: 'Quadrado 1:1 (feed)', aspect: '1:1' },
];

// Dicionário próprio de ênfase com emoji (somente prévia e SRT/VTT).
const EMOJI_WORDS = {
  dinheiro: '💰', amor: '❤️', ideia: '💡', fogo: '🔥', atenção: '⚠️', cuidado: '⚠️', sucesso: '🏆',
  tempo: '⏰', música: '🎵', saúde: '🩺', vacina: '💉', criança: '🧒', casa: '🏠', trabalho: '💼',
  dica: '👉', importante: '❗', verdade: '✅', segredo: '🤫', rápido: '⚡', mundo: '🌎',
};

export function templateFor(id) {
  return CAPTION_TEMPLATES.find((item) => item.id === id) || CAPTION_TEMPLATES[0];
}

export function normalizeWord(word) {
  return String(word || '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, '');
}

export function keywordList(value) {
  return String(value || '').split(/[,;\n]/).map(normalizeWord).filter(Boolean);
}

export function emojiFor(word) {
  return EMOJI_WORDS[normalizeWord(word)] || '';
}

// Quebra gulosa por palavras respeitando quebras manuais (\n) e o limite por linha.
export function wrapCaptionText(text, maxChars = 28) {
  const limit = Math.max(8, Number(maxChars) || 28);
  const lines = [];
  for (const block of String(text || '').split(/\r?\n/)) {
    let current = '';
    for (const word of block.split(/\s+/).filter(Boolean)) {
      if (current && current.length + 1 + word.length > limit) { lines.push(current); current = word; }
      else current = current ? `${current} ${word}` : word;
    }
    if (current) lines.push(current);
  }
  return lines;
}

function cueFromWords(words, id) {
  return {
    id,
    start_ms: Math.round(words[0].start_ms),
    end_ms: Math.round(words[words.length - 1].end_ms),
    texto: words.map((word) => word.text).join(' '),
    palavras: words.map((word) => ({ ...word })),
    cortar_audio: false,
    origem: 'transcricao',
  };
}

// Converte palavras temporizadas (segundos, do backend) em ms e filtra pelo IN/OUT.
export function wordsInRange(words = [], inMs = 0, outMs = Infinity) {
  return (words || [])
    .map((word) => ({ text: String(word.text || '').trim(), start_ms: Math.round(Number(word.start) * 1000), end_ms: Math.round(Number(word.end) * 1000) }))
    .filter((word) => word.text && Number.isFinite(word.start_ms) && Number.isFinite(word.end_ms) && word.end_ms > word.start_ms)
    .filter((word) => word.start_ms >= inMs && word.end_ms <= (outMs || Infinity))
    .sort((a, b) => a.start_ms - b.start_ms);
}

// Palavras reais das análises do CLIPSFREE (evidence), sem repetir a mesma palavra.
export function transcriptWordsFromCandidates(candidates = [], inMs = 0, outMs = Infinity) {
  const seen = new Set();
  const words = [];
  for (const candidate of candidates || []) {
    for (const word of wordsInRange(candidate.evidence || candidate.words || [], inMs, outMs)) {
      const key = `${word.start_ms}:${word.end_ms}:${word.text}`;
      if (!seen.has(key)) { seen.add(key); words.push(word); }
    }
  }
  return words.sort((a, b) => a.start_ms - b.start_ms);
}

// Agrupa palavras em legendas por quantidade de palavras, caracteres, duração e pausas.
export function buildCaptionsFromWords(words = [], { maxWords = 6, maxChars = 32, maxDurationMs = 3500, pauseMs = 700 } = {}) {
  const cues = [];
  let group = [];
  const stamp = Date.now();
  const flush = () => { if (group.length) { cues.push(cueFromWords(group, `l-${stamp}-${cues.length}`)); group = []; } };
  for (const word of words) {
    if (group.length) {
      const last = group[group.length - 1];
      const chars = group.map((item) => item.text).join(' ').length + 1 + word.text.length;
      if (group.length >= maxWords || chars > maxChars || word.end_ms - group[0].start_ms > maxDurationMs || word.start_ms - last.end_ms > pauseMs) flush();
    }
    group.push(word);
  }
  flush();
  return cues;
}

// Ao editar o texto, mantém os tempos por palavra somente se a contagem coincidir.
export function applyCaptionText(caption, texto) {
  const tokens = String(texto).split(/\s+/).filter(Boolean);
  const palavras = Array.isArray(caption.palavras) && caption.palavras.length === tokens.length
    ? caption.palavras.map((word, index) => ({ ...word, text: tokens[index] }))
    : [];
  return { ...caption, texto, palavras, editada: true };
}

// Divide no tempo indicado (ou no meio), repartindo palavras/texto sem duplicar.
export function splitCaption(caption, atMs, newId = `l-${Date.now()}`) {
  const start = Number(caption.start_ms) || 0;
  const end = Number(caption.end_ms) || start;
  const words = Array.isArray(caption.palavras) ? caption.palavras : [];
  if (words.length >= 2) {
    const target = Number.isFinite(atMs) && atMs > start && atMs < end ? atMs : (start + end) / 2;
    let index = words.findIndex((word) => word.start_ms >= target);
    if (index <= 0) index = Math.ceil(words.length / 2);
    const left = words.slice(0, index);
    const right = words.slice(index);
    return [
      { ...caption, end_ms: right[0].start_ms, texto: left.map((w) => w.text).join(' '), palavras: left },
      { ...caption, id: newId, start_ms: right[0].start_ms, texto: right.map((w) => w.text).join(' '), palavras: right },
    ];
  }
  const tokens = String(caption.texto || '').split(/\s+/).filter(Boolean);
  const mid = Number.isFinite(atMs) && atMs > start && atMs < end ? Math.round(atMs) : Math.round((start + end) / 2);
  const cut = tokens.length >= 2 ? Math.max(1, Math.round(tokens.length * ((mid - start) / Math.max(1, end - start)))) : tokens.length;
  return [
    { ...caption, end_ms: mid, texto: tokens.slice(0, cut).join(' '), palavras: [] },
    { ...caption, id: newId, start_ms: mid, texto: tokens.slice(cut).join(' '), palavras: [] },
  ];
}

export function mergeCaptions(first, second) {
  const words = [...(first.palavras || []), ...(second.palavras || [])];
  const keepWords = (first.palavras || []).length > 0 && (second.palavras || []).length > 0;
  return {
    ...first,
    start_ms: Math.min(first.start_ms, second.start_ms),
    end_ms: Math.max(first.end_ms, second.end_ms),
    texto: [first.texto, second.texto].map((value) => String(value || '').trim()).filter(Boolean).join(' '),
    palavras: keepWords ? words : [],
  };
}

export function sortCaptions(captions = []) {
  return [...captions].sort((a, b) => (a.start_ms - b.start_ms) || (a.end_ms - b.end_ms));
}

// Verificações de qualidade; nenhuma bloqueia a edição.
export function captionIssues(captions = [], { inMs = 0, outMs = 0, format = '16:9', maxChars = 28 } = {}) {
  const issues = [];
  const sorted = sortCaptions(captions);
  sorted.forEach((caption, index) => {
    const label = `Legenda ${index + 1}`;
    if (!(caption.end_ms > caption.start_ms)) issues.push({ id: caption.id, tipo: 'tempo', texto: `${label}: o fim precisa ser posterior ao início.` });
    if (outMs > inMs && (caption.start_ms < inMs || caption.end_ms > outMs)) issues.push({ id: caption.id, tipo: 'intervalo', texto: `${label}: fica fora do intervalo IN/OUT e será recortada na exportação.` });
    const next = sorted[index + 1];
    if (next && next.start_ms < caption.end_ms) issues.push({ id: caption.id, tipo: 'sobreposicao', texto: `${label}: sobrepõe a legenda seguinte.` });
    const lines = wrapCaptionText(caption.texto, maxChars);
    if (lines.length > 2) issues.push({ id: caption.id, tipo: 'linhas', texto: `${label}: ocupa ${lines.length} linhas; o ideal são até 2.` });
    const seconds = Math.max(0.001, (caption.end_ms - caption.start_ms) / 1000);
    const cps = String(caption.texto || '').replace(/\s+/g, '').length / seconds;
    if (caption.end_ms > caption.start_ms && cps > 20) issues.push({ id: caption.id, tipo: 'leitura', texto: `${label}: ${Math.round(cps)} caracteres por segundo; leitura difícil.` });
    if (!String(caption.texto || '').trim()) issues.push({ id: caption.id, tipo: 'vazia', texto: `${label}: sem texto; não será exportada.` });
    if (format === '9:16' && (caption.posicao || 'bottom') === 'bottom') issues.push({ id: caption.id, tipo: 'area-segura', texto: `${label}: na base do vertical 9:16 pode ficar sob botões e descrição das redes; prefira Centro.` });
  });
  return issues;
}

function pad(value, size = 2) { return String(value).padStart(size, '0'); }

function timestamp(ms, separator) {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(total % 1000, 3)}`;
}

function exportable(captions, inMs) {
  return sortCaptions(captions)
    .filter((caption) => String(caption.texto || '').trim() && caption.end_ms > caption.start_ms)
    .map((caption) => ({ ...caption, start: Math.max(0, caption.start_ms - inMs), end: Math.max(0, caption.end_ms - inMs) }))
    .filter((caption) => caption.end > caption.start);
}

function decorate(text, settings) {
  if (!settings?.emojis) return text;
  return String(text).split(/(\s+)/).map((part) => { const emoji = emojiFor(part); return emoji ? `${part} ${emoji}` : part; }).join('');
}

export function captionsToSrt(captions = [], { inMs = 0, maxChars = 0, settings = null } = {}) {
  return exportable(captions, inMs).map((caption, index) => {
    const text = decorate(caption.texto, settings);
    const body = maxChars ? wrapCaptionText(text, maxChars).join('\n') : String(text).trim();
    return `${index + 1}\n${timestamp(caption.start, ',')} --> ${timestamp(caption.end, ',')}\n${body}`;
  }).join('\n\n');
}

export function captionsToVtt(captions = [], { inMs = 0, maxChars = 0, settings = null } = {}) {
  const cues = exportable(captions, inMs).map((caption) => {
    const text = decorate(caption.texto, settings);
    const body = maxChars ? wrapCaptionText(text, maxChars).join('\n') : String(text).trim();
    const line = { top: ' line:10%', center: ' line:50%' }[caption.posicao] || '';
    return `${timestamp(caption.start, '.')} --> ${timestamp(caption.end, '.')}${line}\n${body}`;
  });
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

function parseTimestamp(value) {
  const match = String(value).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!match) return NaN;
  const [, h = '0', m, s, frac] = match;
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(frac.padEnd(3, '0'));
}

// Importa SRT ou WebVTT. Tempos são relativos ao IN do corte (mesma regra da exportação).
export function parseSubtitles(content, { inMs = 0 } = {}) {
  const text = String(content || '').replace(/^﻿/, '').replace(/\r/g, '');
  const blocks = text.split(/\n{2,}/);
  const cues = [];
  const stamp = Date.now();
  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim() !== '');
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0) continue;
    const [rawStart, rawRest] = lines[timingIndex].split('-->');
    const start = parseTimestamp(rawStart);
    const end = parseTimestamp(String(rawRest).trim().split(/\s+/)[0]);
    const body = lines.slice(timingIndex + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !body) continue;
    cues.push({ id: `l-${stamp}-${cues.length}`, start_ms: inMs + start, end_ms: inMs + end, texto: body, palavras: [], cortar_audio: false, origem: 'importada' });
  }
  if (!cues.length) throw new Error('Nenhuma legenda válida encontrada no arquivo SRT/VTT.');
  return cues;
}

function hexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : fallback;
}

// Instruções enviadas em properties.clip_render. Retorna null quando nada foi pedido,
// preservando o comportamento anterior da exportação.
export function buildClipRenderOptions(clip, { aspect = '', burnCaptions = false, burnTitles = false, applyCuts = false } = {}) {
  const inMs = Number(clip.in_ms) || 0;
  const outMs = Number(clip.out_ms) || 0;
  const duration = Math.max(0, outMs - inMs);
  const settings = { ...DEFAULT_CAPTION_SETTINGS, ...(clip.legenda_config || {}) };
  const template = templateFor(clip.legenda_estilo || 'impacto');
  const toRange = (start, end) => ({ start: Math.max(0, start - inMs) / 1000, end: Math.min(duration, end - inMs) / 1000 });
  const options = {};
  if (aspect) {
    options.aspect = aspect;
    options.fit = clip.reenquadramento === 'fit' ? 'fit' : 'fill';
    options.focus_x = Math.min(1, Math.max(0, Number(clip.foco_x ?? 0.5)));
  }
  if (burnCaptions) {
    const captions = sortCaptions(clip.legendas || [])
      .filter((caption) => String(caption.texto || '').trim() && caption.end_ms > caption.start_ms && caption.end_ms > inMs && caption.start_ms < outMs)
      .map((caption) => {
        const range = toRange(caption.start_ms, caption.end_ms);
        const words = (caption.palavras || [])
          .filter((word) => word.end_ms > word.start_ms && word.end_ms > inMs && word.start_ms < outMs)
          .map((word) => ({ text: word.text, ...toRange(word.start_ms, word.end_ms) }))
          .filter((word) => word.end > word.start);
        return { ...range, text: String(caption.texto).trim(), position: caption.posicao || 'bottom', words };
      })
      .filter((caption) => caption.end > caption.start);
    if (captions.length) {
      options.captions = captions;
      options.caption_style = {
        font_size: Math.min(200, Math.max(16, Number(settings.fontSize) || 64)),
        color: hexColor(settings.color, template.color.toUpperCase()),
        highlight_color: hexColor(settings.highlight, template.highlight.toUpperCase()),
        outline_color: (template.outline || '#000000').toUpperCase(),
        box: template.box,
        uppercase: template.uppercase,
        karaoke: template.karaoke,
        max_chars: Math.min(80, Math.max(8, Number(settings.maxChars) || 28)),
        keywords: keywordList(settings.keywords).slice(0, 50),
      };
    }
  }
  if (burnTitles) {
    const titles = (clip.cgs || [])
      .filter((layer) => layer.tipo === 'titulo' && String(layer.titulo || '').trim() && layer.end_ms > layer.start_ms && layer.end_ms > inMs && layer.start_ms < outMs)
      .map((layer) => ({ ...toRange(layer.start_ms, layer.end_ms), text: String(layer.titulo).trim().slice(0, 300) }))
      .filter((layer) => layer.end > layer.start)
      .slice(0, 50);
    if (titles.length) options.titles = titles;
  }
  if (applyCuts) {
    const skip = (clip.cortes_video || [])
      .filter((cut) => cut.end_ms > cut.start_ms && cut.end_ms > inMs && cut.start_ms < outMs)
      .map((cut) => toRange(cut.start_ms, cut.end_ms))
      .filter((cut) => cut.end > cut.start);
    if (skip.length) options.skip = skip;
  }
  return Object.keys(options).length ? options : null;
}
