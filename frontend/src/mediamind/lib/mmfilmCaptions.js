// Legendas, vícios de linguagem e títulos do MMFilm (M06), em funções puras do navegador.
// Entrada: palavras temporizadas {word|text, start, end} vindas da transcrição do backend
// ou estimadas a partir de um SRT/VTT importado (wordsFromCues). Nada inventa texto:
// tempos e palavras sempre derivam da transcrição ou das legendas existentes.
import { autoThreshold } from "./mmfilmAudioAnalysis";
import { mergeRanges } from "./mmfilmEdits";

const TITLE_TYPE = "text/title";
const ms = (value) => Math.round(value * 1000) / 1000;
const wordOf = (item) => String(item.word ?? item.text ?? "");

/** Minúsculas, sem acento e sem pontuação: "Éh," → "eh". */
export function normalizeToken(word) {
  return String(word ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

// Minúsculas e sem pontuação, mas com acento ("é" ≠ "e" em português).
const accentKey = (word) =>
  String(word)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
// Hesitações alongadas ("hmmm", "ãããh") viram a forma curta ("hm", "ah").
const hesitationKey = (word) => normalizeToken(word).replace(/(\p{L})\1+/gu, "$1");

// ---------------------------------------------------------------- SRT / VTT

function parseTime(value) {
  const match = String(value)
    .trim()
    .match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;
  const [, hours = "0", minutes, seconds, fraction = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(`0.${fraction}`);
}

const cleanCueText = (text) =>
  text
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

/** SRT ou WebVTT → [{start, end, text}] ordenadas. Horas opcionais, vírgula ou ponto, tags removidas. */
export function parseSubtitles(text) {
  const cues = [];
  String(text ?? "")
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .forEach((block) => {
      const lines = block.split("\n");
      const timing = lines.findIndex((line) => line.includes("-->"));
      if (timing < 0) return;
      const [left, right] = lines[timing].split("-->");
      const start = parseTime(left);
      const end = parseTime(right.trim().split(/\s+/)[0]);
      const body = cleanCueText(lines.slice(timing + 1).join("\n"));
      if (start === null || end === null || end <= start || !body) return;
      cues.push({ start: ms(start), end: ms(end), text: body });
    });
  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Palavras estimadas de cada legenda: o tempo da legenda é dividido proporcionalmente ao tamanho
 * de cada palavra (não há tempo real por palavra num SRT).
 */
export function wordsFromCues(cues) {
  const words = [];
  cues.forEach((cue) => {
    const parts = String(cue.text).split(/\s+/).filter(Boolean);
    const weights = parts.map((part) => Math.max(1, normalizeToken(part).length));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let cursor = cue.start;
    parts.forEach((part, index) => {
      const end = index === parts.length - 1 ? cue.end : cursor + ((cue.end - cue.start) * weights[index]) / total;
      words.push({ word: part, start: ms(cursor), end: ms(end) });
      cursor = end;
    });
  });
  return words;
}

const pad = (value, size = 2) => String(value).padStart(size, "0");
function srtTime(seconds) {
  const total = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const secs = Math.floor((total % 60000) / 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(total % 1000, 3)}`;
}

/** Legendas → texto SRT (numeração a partir de 1). */
export function toSrt(cues) {
  return cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join("\n");
}

// ---------------------------------------------------------------- Reflow

function prepareWords(words, { uppercase, stripPunctuation }) {
  return words
    .map((item) => {
      let text = wordOf(item).trim();
      if (stripPunctuation) text = text.replace(/[^\p{L}\p{N}\s'’-]+/gu, "");
      if (uppercase) text = text.toUpperCase();
      return { word: text, raw: wordOf(item), start: Number(item.start), end: Number(item.end) };
    })
    .filter((item) => item.word && Number.isFinite(item.start) && Number.isFinite(item.end))
    .sort((a, b) => a.start - b.start);
}

// Pedaços de no máximo `size` caracteres (palavra maior que a linha é quebrada à força).
const chunk = (text, size) => text.match(new RegExp(`[\\s\\S]{1,${size}}`, "gu"));

/**
 * Palavras → legendas.
 * - `palavra`: uma palavra por legenda (estilo karaokê/Reels); a legenda dura até a próxima palavra
 *   quando o intervalo é menor que `pauseSplit`.
 * - `linhas`: até `maxLines` linhas de no máximo `maxChars` caracteres; quebra em pausas ≥ `pauseSplit`,
 *   fim de frase (. ! ? …) ou quando a legenda passaria de `maxDuration` segundos.
 * Cada legenda traz `words` (tempo real ou estimado de cada palavra) para o destaque do karaokê.
 */
export function reflowCaptions(
  words,
  { mode = "linhas", maxChars = 32, maxLines = 2, maxDuration = 3, pauseSplit = 0.5, uppercase = false, stripPunctuation = false, minDuration = 0.6 } = {},
) {
  const list = prepareWords(words, { uppercase, stripPunctuation });
  const lineLimit = Math.max(1, Math.min(6, Math.round(Number(maxLines) || 1)));
  const charLimit = Math.max(1, Math.round(Number(maxChars) || 32));
  const wordOut = (item) => ({ word: item.word, start: ms(item.start), end: ms(item.end) });

  if (mode === "palavra") {
    return list.map((item, index) => {
      const next = list[index + 1];
      const end = next && next.start - item.end < pauseSplit ? Math.max(item.end, next.start) : item.end;
      return { start: ms(item.start), end: ms(end), text: chunk(item.word, charLimit).join("\n"), words: [wordOut(item)] };
    });
  }

  const cues = [];
  let current = null;
  const flush = () => {
    if (current) cues.push({ start: ms(current.start), end: ms(current.end), text: current.lines.join("\n"), words: current.words });
    current = null;
  };
  list.forEach((item, index) => {
    const previous = list[index - 1];
    if (
      current &&
      (item.start - previous.end >= pauseSplit || /[.!?…]["')\]]*$/u.test(previous.raw) || item.end - current.start > maxDuration)
    ) {
      flush();
    }
    const pieces = chunk(item.word, charLimit);
    if (current) {
      // Linhas que a legenda atual terá com esta palavra (1º pedaço tenta caber na última linha).
      const lines = [...current.lines];
      pieces.forEach((piece, at) => {
        const last = lines[lines.length - 1];
        if (at === 0 && `${last} ${piece}`.length <= charLimit) lines[lines.length - 1] = `${last} ${piece}`;
        else lines.push(piece);
      });
      if (lines.length > lineLimit) flush();
      else current.lines = lines;
    }
    if (!current) {
      // Palavra que sozinha passa de `maxLines` linhas: os primeiros blocos viram legendas próprias,
      // com o tempo da palavra dividido pelos caracteres.
      let lines = pieces;
      let start = item.start;
      const perChar = (item.end - item.start) / item.word.length;
      while (lines.length > lineLimit) {
        const head = lines.slice(0, lineLimit);
        const end = start + perChar * head.join("").length;
        cues.push({ start: ms(start), end: ms(end), text: head.join("\n"), words: [wordOut(item)] });
        lines = lines.slice(lineLimit);
        start = end;
      }
      current = { start, lines, words: [] };
    }
    current.end = item.end;
    current.words.push(wordOut(item));
  });
  flush();
  return mergeShortCues(cues, { minDuration, pauseSplit, charLimit, lineLimit });
}

// Legenda curta demais para ler (ex.: "É…" sozinho por 0,1 s) se junta à seguinte quando estão coladas e cabem.
function mergeShortCues(cues, { minDuration, pauseSplit, charLimit, lineLimit }) {
  const result = [];
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    const next = cues[index + 1];
    if (next && cue.end - cue.start < minDuration && next.start - cue.end < pauseSplit) {
      const lines = wrapWords(`${cue.text.replace(/\n/g, " ")} ${next.text.replace(/\n/g, " ")}`.split(/\s+/), charLimit);
      if (lines.length <= lineLimit) {
        cues[index + 1] = { start: cue.start, end: next.end, text: lines.join("\n"), words: [...cue.words, ...next.words] };
        continue;
      }
    }
    result.push(cue);
  }
  return result;
}

function wrapWords(words, charLimit) {
  const lines = [];
  words.filter(Boolean).forEach((word) => {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= charLimit) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  });
  return lines;
}

// ---------------------------------------------------------------- Vícios de linguagem

/**
 * Vícios por idioma.
 * - `hesitations`: sempre contam (comparadas sem acento e com letras repetidas reduzidas: "hmmm" = "hm").
 * - `isolated`: palavras que também têm uso normal ("é", "tipo", "né", "então"…); só contam quando
 *   estão isoladas — escritas com reticências ("é…") ou com pausa ≥ 0,3 s antes E depois
 *   (início/fim da fala contam como pausa). Comparadas com acento ("é" ≠ "e").
 */
export const FILLERS = {
  pt: {
    hesitations: ["ah", "ahn", "an", "eh", "ehn", "hm", "hum", "uh", "uhm", "mm", "mhm"],
    isolated: ["é", "tipo", "né", "então", "assim", "bom", "enfim", "sabe"],
  },
  en: {
    hesitations: ["uh", "um", "uhm", "er", "erm", "ah", "eh", "hm", "mm", "mhm"],
    isolated: ["like", "so", "well", "basically", "actually", "literally", "right"],
  },
  es: {
    hesitations: ["eh", "ehm", "em", "ah", "hm", "mm", "uh"],
    isolated: ["este", "bueno", "pues", "tipo", "vale", "digamos"],
  },
};

const STOPWORDS = {
  pt: "a o e é de da do das dos em no na nos nas um uma uns umas que se por para pra com sem ao aos à às ou mas como mais menos isso isto esse essa este esta aquele aquela ele ela eles elas eu tu você vocês nós me te lhe nos vos meu minha seu sua nosso nossa foi ser ter tem está estou são era há já não sim só também então porque quando onde qual quem lá aqui aí",
  en: "a an the and or but of to in on at by for with from as is are was were be been being it its this that these those i you he she we they me him her us them my your his our their not no yes so do does did have has had will would can could just than then there here what which who when where why how",
  es: "a el la los las un una unos unas y o pero de del al en con sin por para que se es son era fue ser estar está están lo le les me te nos mi tu su sus este esta ese esa eso esto yo tú él ella nosotros ellos no sí ya muy más menos como cuando donde qué quién",
};
const EMPHASIS = {
  pt: "nunca sempre jamais todo todos toda todas nada ninguém melhor pior maior menor incrível absurdo segredo importante atenção cuidado verdade grátis rápido primeiro último única único demais impossível enorme gigante chocante perigo erro urgente agora simplesmente exatamente totalmente garantido",
  en: "never always every all nothing nobody best worst biggest smallest amazing incredible secret important warning careful truth free fast first last only huge impossible shocking danger mistake urgent now totally exactly guaranteed",
  es: "nunca siempre jamás todo todos nada nadie mejor peor mayor menor increíble secreto importante atención cuidado verdad gratis rápido primero último único enorme imposible peligro error urgente ahora totalmente exactamente",
};
const NUMBER_WORDS = {
  pt: "dois três quatro cinco seis sete oito nove dez onze doze vinte trinta cinquenta cem cento mil milhão milhões bilhão bilhões metade dobro triplo",
  en: "two three four five six seven eight nine ten eleven twelve twenty thirty fifty hundred thousand million millions billion billions half double triple",
  es: "dos tres cuatro cinco seis siete ocho nueve diez once doce veinte treinta cincuenta cien mil millón millones billón mitad doble triple",
};
const wordSet = (text) => new Set(text.split(" ").map(normalizeToken));
const LEXICON = Object.fromEntries(
  Object.keys(FILLERS).map((language) => [
    language,
    {
      hesitations: new Set(FILLERS[language].hesitations.map(hesitationKey)),
      isolated: new Set(FILLERS[language].isolated.map(accentKey)),
      stopwords: wordSet(STOPWORDS[language]),
      emphasis: wordSet(EMPHASIS[language]),
      numbers: wordSet(NUMBER_WORDS[language]),
    },
  ]),
);
const lexicon = (language) => LEXICON[String(language ?? "").slice(0, 2).toLowerCase()] ?? LEXICON.pt;

const ISOLATION_GAP = 0.3;
const MIN_PAUSE = 0.07;
const SEARCH = 0.25;

// Trechos silenciosos (≥ 70 ms) do envelope, em segundos.
function quietRuns(envelope, threshold) {
  const { db, from, windowSeconds } = envelope;
  const runs = [];
  let index = 0;
  while (index < db.length) {
    if (db[index] >= threshold) {
      index += 1;
      continue;
    }
    let stop = index;
    while (stop < db.length && db[stop] < threshold) stop += 1;
    if ((stop - index) * windowSeconds >= MIN_PAUSE - 1e-9) runs.push([from + index * windowSeconds, from + stop * windowSeconds]);
    index = stop;
  }
  return runs;
}

const distance = ([start, end], time) => (time < start ? start - time : time > end ? time - end : 0);
function closestRun(runs, time, accept) {
  return runs
    .filter((run) => distance(run, time) <= SEARCH && accept((run[0] + run[1]) / 2))
    .sort((a, b) => distance(a, time) - distance(b, time))[0];
}

/**
 * Hesitações e repetições a cortar: [{id, start, end, word, kind, certain}].
 * Repetição: mesma palavra seguida (sem acento/maiúsculas) → marca a primeira ("eu eu fui" → corta o 1º "eu").
 * Com `envelope` (mmfilmAudioAnalysis), o corte é levado ao meio das pausas (≥ 70 ms) antes e depois
 * da palavra e marcado `certain: true`; sem pausas dos dois lados (ou sem envelope), fica nos tempos
 * da transcrição com `certain: false` (o usuário confirma).
 */
export function detectFillers(words, { language = "pt", hesitations = true, repetitions = true, envelope, threshold } = {}) {
  const lex = lexicon(language);
  const list = words
    .map((item) => ({ raw: wordOf(item), start: Number(item.start), end: Number(item.end) }))
    .filter((item) => normalizeToken(item.raw))
    .sort((a, b) => a.start - b.start);
  const runs = envelope?.db?.length ? quietRuns(envelope, threshold ?? autoThreshold(envelope.db).threshold) : null;
  const items = [];
  const add = (item, kind) => {
    let { start, end } = item;
    let certain = false;
    if (runs) {
      const middle = (start + end) / 2;
      const before = closestRun(runs, start, (mid) => mid < middle);
      const after = closestRun(runs, end, (mid) => mid > middle);
      if (before && after) {
        start = (before[0] + before[1]) / 2;
        end = (after[0] + after[1]) / 2;
        certain = true;
      }
    }
    items.push({ id: `${kind}-${items.length + 1}`, start: ms(start), end: ms(end), word: item.raw, kind, certain });
  };
  list.forEach((item, index) => {
    const previous = list[index - 1];
    const next = list[index + 1];
    if (hesitations) {
      const always = lex.hesitations.has(hesitationKey(item.raw));
      const gapBefore = previous ? item.start - previous.end : Infinity;
      const gapAfter = next ? next.start - item.end : Infinity;
      const key = accentKey(item.raw);
      const isolated =
        (lex.isolated.has(key) || lex.isolated.has(key.replace(/(\p{L})\1+/gu, "$1"))) &&
        (/(…|\.\.\.)$/.test(item.raw.trim()) || (gapBefore >= ISOLATION_GAP && gapAfter >= ISOLATION_GAP));
      if (always || isolated) {
        add(item, "hesitacao");
        return;
      }
    }
    if (repetitions && next && normalizeToken(next.raw) === normalizeToken(item.raw)) add(item, "repeticao");
  });
  return items;
}

/** Trechos [início, fim] unidos dos itens escolhidos, prontos para `removeRanges`. */
export function fillerRanges(items) {
  return mergeRanges(items.map((item) => [item.start, item.end]));
}

// ---------------------------------------------------------------- Títulos e palavras fortes

const isNumber = (lex, key) => /\d/.test(key) || lex.numbers.has(key);

function phraseScore(text, lex) {
  const tokens = String(text).split(/\s+/).filter(Boolean);
  let score = 0;
  tokens.forEach((token) => {
    const key = normalizeToken(token);
    if (!key || lex.stopwords.has(key)) return;
    score += 1;
    if (isNumber(lex, key)) score += 3;
    if (lex.emphasis.has(key)) score += 2.5;
    if (key.length > 1 && /\p{L}/u.test(token) && token === token.toUpperCase() && token !== token.toLowerCase()) score += 1;
  });
  if (!score) return 0;
  if (/!/.test(text)) score += 1;
  if (/\?/.test(text)) score += 0.5;
  return Math.round((score / Math.sqrt(tokens.length)) * 100) / 100;
}

const TITLE_SPACING = { poucos: 45, medio: 20, muitos: 10 };

/**
 * Frases de maior impacto para títulos animados: palavras-chave (sem stopwords do idioma), números
 * e palavras de ênfase pesam mais. A timeline é dividida em faixas iguais (Poucos ≈ 1 a cada 45 s,
 * Médio ≈ 20 s, Muitos ≈ 10 s) e a melhor frase de cada faixa é escolhida, sem sobreposição.
 * Aceita palavras temporizadas ({word} ou {text, prob} do backend) ou legendas prontas ({start, end, text}).
 */
export function scoreTitles(input, { language = "pt", count = "medio" } = {}) {
  const lex = lexicon(language);
  const phrases = input.some((item) => "word" in item || "prob" in item)
    ? reflowCaptions(input, { maxChars: 40, maxLines: 2, maxDuration: 5, pauseSplit: 0.6 }).map((cue) => ({ ...cue, text: cue.text.replace(/\n/g, " ") }))
    : input.map((cue) => ({ start: cue.start, end: cue.end, text: String(cue.text).replace(/\n/g, " ") }));
  const scored = phrases.map((phrase) => ({ start: phrase.start, end: phrase.end, text: phrase.text, score: phraseScore(phrase.text, lex) })).filter((item) => item.score > 0);
  if (!scored.length) return [];
  const first = Math.min(...phrases.map((item) => item.start));
  const last = Math.max(...phrases.map((item) => item.end));
  const buckets = Math.max(1, Math.round((last - first) / (TITLE_SPACING[count] ?? TITLE_SPACING.medio)));
  const size = (last - first) / buckets;
  const chosen = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const best = scored
      .filter((item) => {
        const position = Math.min(buckets - 1, Math.floor(((item.start + item.end) / 2 - first) / size));
        return position === bucket && !chosen.some((other) => item.start < other.end && other.start < item.end);
      })
      .sort((a, b) => b.score - a.score || a.start - b.start)[0];
    if (best) chosen.push(best);
  }
  return chosen.sort((a, b) => a.start - b.start);
}

/** Palavras fortes (números e ênfase) para batidas de efeito sonoro, com espaçamento mínimo. */
export function strongWords(words, { language = "pt", minGap = 1 } = {}) {
  const lex = lexicon(language);
  const hits = [];
  [...words]
    .sort((a, b) => a.start - b.start)
    .forEach((item) => {
      const key = normalizeToken(wordOf(item));
      if (!key || !(isNumber(lex, key) || lex.emphasis.has(key))) return;
      const last = hits[hits.length - 1];
      if (last && item.start - last.time < minGap) return;
      hits.push({ time: ms(Number(item.start)), word: wordOf(item) });
    });
  return hits;
}

// ---------------------------------------------------------------- Modelos e clipes de legenda

const template = (id, name, folder, options) => ({
  id,
  name,
  folder,
  font: "Inter",
  weight: 800,
  size: 64,
  fill: "#FFFFFF",
  stroke: "#000000",
  strokeWidth: 0,
  box: false,
  boxColor: "#000000B3",
  align: "center",
  position: "bottom",
  uppercase: false,
  highlightColor: "#FFFFFF",
  animation: "none",
  ...options,
});

/** Modelos próprios do MediaMind (nomes e combinações autorais). */
export const CAPTION_TEMPLATES = [
  template("mm-bloco-branco", "Bloco Branco", "Bold", { font: "Montserrat", weight: 900, size: 72, strokeWidth: 6, uppercase: true, animation: "pop" }),
  template("mm-tarja-escura", "Tarja Escura", "Bold", { box: true, boxColor: "#000000CC", weight: 700, size: 58, animation: "fade" }),
  template("mm-contorno-fino", "Contorno Fino", "Minimal", { weight: 600, size: 54, strokeWidth: 2 }),
  template("mm-texto-leve", "Texto Leve", "Minimal", { font: "Georgia", weight: 400, size: 52, fill: "#F8FAFC", strokeWidth: 1, stroke: "#0F172A", animation: "fade" }),
  template("mm-vertical-centro", "Centro Vertical", "Vertical", { font: "Montserrat", weight: 900, size: 88, strokeWidth: 8, uppercase: true, position: "center", animation: "pop" }),
  template("mm-vertical-limao", "Limão Vertical", "Vertical", { font: "Montserrat", weight: 900, size: 80, fill: "#C6F432", strokeWidth: 7, uppercase: true, position: "center", animation: "slide" }),
  template("mm-karaoke-ambar", "Karaokê Âmbar", "Karaoke", { weight: 800, size: 66, strokeWidth: 5, uppercase: true, highlightColor: "#FFB020", animation: "pop" }),
  template("mm-karaoke-ciano", "Karaokê Ciano", "Karaoke", { weight: 800, size: 62, box: true, boxColor: "#0B1220D9", highlightColor: "#22D3EE", animation: "fade" }),
  template("mm-rodape-limpo", "Rodapé Limpo", "Lower thirds", { weight: 600, size: 44, align: "left", strokeWidth: 0, box: true, boxColor: "#111827E6", animation: "slide" }),
  template("mm-rodape-faixa", "Faixa de Rodapé", "Lower thirds", { weight: 700, size: 42, align: "left", fill: "#111111", box: true, boxColor: "#FDE047", animation: "slide" }),
  template("mm-maquina", "Máquina de Escrever", "Minimal", { font: "Courier New", weight: 700, size: 50, fill: "#F5F5F4", box: true, boxColor: "#00000099", animation: "typewriter" }),
  template("mm-topo-aviso", "Aviso no Topo", "Bold", { weight: 900, size: 56, fill: "#FFFFFF", box: true, boxColor: "#DC2626E6", uppercase: true, position: "top", animation: "pop" }),
];

/** Modelo por id (ou o próprio objeto); desconhecido → o primeiro. */
export function captionTemplate(value) {
  if (value && typeof value === "object") return value;
  return CAPTION_TEMPLATES.find((item) => item.id === value) ?? CAPTION_TEMPLATES[0];
}

/** Legendas → clipes de título com `caption: true` na trilha de legendas. */
export function captionClips(cues, { template: chosen, overrides = {}, track = "V3", idPrefix = "caption" } = {}) {
  const captionStyle = { ...captionTemplate(chosen), ...overrides };
  return cues.map((cue, index) => ({
    id: `${idPrefix}-${index + 1}`,
    name: String(cue.text).split("\n")[0],
    type: TITLE_TYPE,
    caption: true,
    track,
    start: ms(cue.start),
    duration: ms(Math.max(0.05, cue.end - cue.start)),
    sourceIn: 0,
    text: cue.text,
    captionStyle,
    ...(cue.words ? { captionWords: cue.words } : {}),
    opacity: 100,
    volume: 100,
    speed: 100,
    x: 0,
    y: 0,
    scale: 100,
    rotation: 0,
  }));
}

/** Re-transcrever: troca o estilo das legendas existentes, mantendo tempos, trilha e texto (inclusive correções). */
export function retemplateCaptions(clips, chosen, overrides = {}) {
  const captionStyle = { ...captionTemplate(chosen), ...overrides };
  return clips.map((clip) => (clip.caption && clip.type === TITLE_TYPE ? { ...clip, captionStyle } : clip));
}

const FONT_FALLBACK = "Inter, Arial, Helvetica, sans-serif";
const POSITION = {
  bottom: { bottom: "8%" },
  center: { top: "50%", transform: "translateY(-50%)" },
  top: { top: "8%" },
};

/** Estilo React para a prévia da legenda no player (`scale` = altura do player / 1080). */
export function captionStyleCss(style, scale = 1) {
  const value = { ...CAPTION_TEMPLATES[0], ...style };
  const px = (number) => `${Math.round(number * scale * 100) / 100}px`;
  return {
    position: "absolute",
    left: "5%",
    right: "5%",
    ...(POSITION[value.position] ?? POSITION.bottom),
    fontFamily: `"${value.font}", ${FONT_FALLBACK}`,
    fontWeight: value.weight,
    fontSize: px(value.size),
    lineHeight: 1.15,
    color: value.fill,
    textAlign: value.align,
    textTransform: value.uppercase ? "uppercase" : "none",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    WebkitTextStroke: value.strokeWidth > 0 ? `${px(value.strokeWidth)} ${value.stroke}` : undefined,
    paintOrder: "stroke fill",
    ...(value.box
      ? { backgroundColor: value.boxColor, padding: `${px(value.size * 0.12)} ${px(value.size * 0.3)}`, borderRadius: px(8), boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }
      : {}),
  };
}

/** A fonte está disponível? Sem a API `document.fonts` (ou em erro) responde true para não gerar aviso falso. */
export function fontAvailable(font) {
  try {
    const fonts = globalThis.document?.fonts;
    return typeof fonts?.check === "function" ? fonts.check(`16px "${font}"`) : true;
  } catch {
    return true;
  }
}
