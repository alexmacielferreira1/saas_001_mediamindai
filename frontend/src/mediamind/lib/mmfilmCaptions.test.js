import { afterEach, describe, expect, it } from "vitest";
import {
  CAPTION_TEMPLATES,
  FILLERS,
  captionClips,
  captionStyleCss,
  captionTemplate,
  detectFillers,
  fillerRanges,
  fontAvailable,
  normalizeToken,
  parseSubtitles,
  reflowCaptions,
  retemplateCaptions,
  scoreTitles,
  strongWords,
  toSrt,
  wordsFromCues,
} from "./mmfilmCaptions";
import { removeRanges } from "./mmfilmEdits";

const w = (word, start, end) => ({ word, start, end });

// Envelope de 10 ms: trechos [início, fim, dB]; o resto fica em `base` dB.
function envelope(duration, parts, base = -10) {
  const windowSeconds = 0.01;
  const db = new Float32Array(Math.round(duration / windowSeconds)).fill(base);
  parts.forEach(([start, end, value]) => db.fill(value, Math.round(start / windowSeconds), Math.round(end / windowSeconds)));
  return { from: 0, windowSeconds, db };
}

describe("normalizeToken", () => {
  it("remove acento, maiúsculas e pontuação", () => {
    expect(normalizeToken("Éh,")).toBe("eh");
    expect(normalizeToken(undefined)).toBe("");
    expect(normalizeToken(null)).toBe("");
  });
});

describe("parseSubtitles", () => {
  it("lê SRT com vírgula, CRLF, BOM e tags", () => {
    const srt =
      "﻿2\r\n00:00:03,500 --> 00:00:05,000\r\n<i>segunda</i> {\\an8}linha\r\n\r\n1\r\n00:00:01,000 --> 00:00:02,250\r\nOlá&nbsp;mundo\r\n  \r\nfim\r\n";
    expect(parseSubtitles(srt)).toEqual([
      { start: 1, end: 2.25, text: "Olá mundo" },
      { start: 3.5, end: 5, text: "segunda linha" },
    ]);
  });

  it("lê VTT com ponto, horas opcionais e configurações; ignora blocos inválidos", () => {
    const vtt = [
      "WEBVTT",
      "",
      "NOTE comentário",
      "",
      "01:02.5 --> 01:04.000 align:start position:10%",
      "<v Ana>Oi</v>",
      "texto",
      "",
      "1:00:00.000 --> 1:00:01",
      "uma hora",
      "",
      "00:05.000 --> 00:04.000",
      "fim antes do início",
      "",
      "xx --> 00:01.000",
      "tempo inválido",
      "",
      "00:01.000 --> yy",
      "fim inválido",
      "",
      "00:07.000 --> 00:08.000",
      "<b></b>",
    ].join("\n");
    expect(parseSubtitles(vtt)).toEqual([
      { start: 62.5, end: 64, text: "Oi\ntexto" },
      { start: 3600, end: 3601, text: "uma hora" },
    ]);
    expect(parseSubtitles(null)).toEqual([]);
  });
});

describe("wordsFromCues e toSrt", () => {
  it("divide o tempo da legenda pelo tamanho das palavras", () => {
    const words = wordsFromCues([{ start: 0, end: 1, text: "eu\nvou —" }]);
    expect(words).toEqual([
      { word: "eu", start: 0, end: 0.333 },
      { word: "vou", start: 0.333, end: 0.833 },
      { word: "—", start: 0.833, end: 1 },
    ]);
  });

  it("gera SRT com horas e limita tempos negativos", () => {
    expect(toSrt([{ start: -1, end: 3725.5, text: "a\nb" }, { start: 1, end: 2, text: "c" }])).toBe(
      "1\n00:00:00,000 --> 01:02:05,500\na\nb\n\n2\n00:00:01,000 --> 00:00:02,000\nc\n",
    );
  });

  it("ida e volta SRT preserva tempos e texto", () => {
    const cues = [{ start: 1.2, end: 2.4, text: "olá" }];
    expect(parseSubtitles(toSrt(cues))).toEqual(cues);
  });
});

const FALA = [
  w("Olá", 0, 0.3),
  w("pessoal,", 0.35, 0.8),
  w("hoje", 0.85, 1.1),
  w("vamos", 1.15, 1.4),
  w("falar.", 1.45, 1.8),
  w("Tudo", 2.6, 2.8),
  w("bem?", 2.85, 3.1),
];

describe("reflowCaptions", () => {
  it("modo linhas respeita caracteres, linhas, fim de frase e pausas", () => {
    const cues = reflowCaptions(FALA, { maxChars: 12, maxLines: 1 });
    expect(cues.map((cue) => [cue.text, cue.start, cue.end])).toEqual([
      ["Olá pessoal,", 0, 0.8],
      ["hoje vamos", 0.85, 1.4],
      ["falar.", 1.45, 1.8],
      ["Tudo bem?", 2.6, 3.1],
    ]);
    expect(cues[0].words).toEqual([w("Olá", 0, 0.3), w("pessoal,", 0.35, 0.8)]);
    cues.forEach((cue) => cue.text.split("\n").forEach((line) => expect(line.length).toBeLessThanOrEqual(12)));
  });

  it("usa várias linhas, divide pela duração máxima e pela pausa", () => {
    const words = [w("um", 0, 0.5), w("dois", 0.5, 1), w("três", 1, 1.5), w("quatro", 1.5, 4), w("cinco", 5, 5.2)];
    const cues = reflowCaptions(words, { maxChars: 9, maxLines: 6, maxDuration: 3 });
    expect(cues.map((cue) => cue.text)).toEqual(["um dois\ntrês", "quatro", "cinco"]);
  });

  it("quebra à força palavra maior que a linha e limita parâmetros", () => {
    const words = [w("a", 0, 0.1), w("abcdefghij", 0.1, 0.5), w("b", 0.5, 0.6)];
    const cues = reflowCaptions(words, { maxChars: 4, maxLines: 10 });
    expect(cues.map((cue) => cue.text)).toEqual(["a\nabcd\nefgh\nij b"]);
    const single = reflowCaptions(words, { maxChars: 4, maxLines: 0 });
    expect(single.map((cue) => [cue.text, cue.start, cue.end])).toEqual([
      ["a", 0, 0.1],
      ["abcd", 0.1, 0.26],
      ["efgh", 0.26, 0.42],
      ["ij b", 0.42, 0.6],
    ]);
    single.forEach((cue) => cue.text.split("\n").forEach((line) => expect(line.length).toBeLessThanOrEqual(4)));
    expect(reflowCaptions([w("palavra", 0, 1)], { maxChars: "x" })[0].text).toBe("palavra");
  });

  it("modo palavra: uma por legenda, emenda intervalos curtos e aplica maiúsculas/pontuação", () => {
    const cues = reflowCaptions([{ text: "olá,", start: 0, end: 0.4 }, w("mundo!", 0.5, 0.9), w("...", 1, 1.1), w("fim", 2, 2.4), w("sobreposto", 2.3, 2.6), w("x", NaN, 1)], {
      mode: "palavra",
      uppercase: true,
      stripPunctuation: true,
      maxChars: 6,
    });
    expect(cues.map((cue) => [cue.text, cue.start, cue.end])).toEqual([
      ["OLÁ", 0, 0.5],
      ["MUNDO", 0.5, 0.9],
      ["FIM", 2, 2.4],
      ["SOBREP\nOSTO", 2.3, 2.6],
    ]);
    expect(cues[0].words).toEqual([w("OLÁ", 0, 0.4)]);
  });

  it("funciona sem opções e com lista vazia", () => {
    expect(reflowCaptions([])).toEqual([]);
    expect(reflowCaptions([{ start: 0, end: 1 }])).toEqual([]);
    expect(reflowCaptions([w("oi", 0, 1)])).toHaveLength(1);
  });
});

describe("detectFillers", () => {
  it("expõe listas por idioma", () => {
    expect(Object.keys(FILLERS)).toEqual(["pt", "en", "es"]);
    expect(FILLERS.pt.isolated).toContain("então");
  });

  it('"eu eu fui" remove o primeiro "eu"; "hum" sai; palavra normal fica', () => {
    const words = [w("hum", 0, 0.3), w("Eu", 0.4, 0.6), w("eu,", 0.65, 0.8), w("fui", 0.85, 1.1)];
    expect(detectFillers(words)).toEqual([
      { id: "hesitacao-1", start: 0, end: 0.3, word: "hum", kind: "hesitacao", certain: false },
      { id: "repeticao-2", start: 0.4, end: 0.6, word: "Eu", kind: "repeticao", certain: false },
    ]);
    expect(detectFillers(words, { hesitations: false }).map((item) => item.word)).toEqual(["Eu"]);
    expect(detectFillers(words, { repetitions: false }).map((item) => item.word)).toEqual(["hum"]);
  });

  it("hesitações alongadas e repetidas não viram repetição; ignora tokens vazios", () => {
    const words = [w("Hmmm…", 0, 0.3), w("hum", 0.4, 0.6), w("—", 0.6, 0.7), w("ok", 0.7, 0.9)];
    expect(detectFillers(words).map((item) => [item.word, item.kind])).toEqual([
      ["Hmmm…", "hesitacao"],
      ["hum", "hesitacao"],
    ]);
  });

  it('palavras ambíguas ("é", "então") só contam isoladas', () => {
    const words = [
      w("então", 0, 0.3),
      w("é", 1, 1.1),
      w("bom", 1.12, 1.3),
      w("ééé…", 1.4, 1.8),
      w("e", 3, 3.1),
      w("casa", 3.2, 3.5),
      w("é", 4, 4.1),
    ];
    expect(detectFillers(words, { language: "pt-BR" }).map((item) => [item.word, item.start])).toEqual([
      ["então", 0],
      ["ééé…", 1.4],
      ["é", 4],
    ]);
  });

  it("usa listas de inglês e espanhol; idioma desconhecido cai em português", () => {
    expect(detectFillers([w("um", 0, 1), w("so...", 1, 2)], { language: "en" }).map((item) => item.word)).toEqual(["um", "so..."]);
    expect(detectFillers([w("um", 0, 1)], { language: "pt" })).toEqual([]);
    expect(detectFillers([w("este...", 0, 1), w("ehm", 1, 2)], { language: "es" })).toHaveLength(2);
    expect(detectFillers([w("hum", 0, 1)], { language: "xx" })).toHaveLength(1);
    expect(detectFillers([w("hum", 0, 1)], { language: null })).toHaveLength(1);
    expect(detectFillers([{ text: "hum", start: 0, end: 1 }])).toHaveLength(1);
  });

  it("com envelope leva o corte ao meio das pausas e marca certeza", () => {
    const words = [w("eu", 1, 1.2), w("eu", 1.3, 1.5), w("fui", 1.6, 1.9)];
    const env = envelope(3, [
      [0.7, 0.78, -60],
      [0.8, 1.0, -60],
      [1.2, 1.3, -60],
      [1.5, 1.53, -60],
      [1.9, 3, -60],
    ]);
    const [item] = detectFillers(words, { envelope: env, threshold: -40 });
    expect(item).toMatchObject({ start: 0.9, end: 1.25, certain: true });
    const [auto] = detectFillers(words, { envelope: env });
    expect(auto).toMatchObject({ start: 0.9, end: 1.25, certain: true });
  });

  it("sem pausa dos dois lados (ou envelope vazio) mantém os tempos e fica incerto", () => {
    const words = [w("eu", 1, 1.2), w("eu", 1.3, 1.5)];
    const loud = envelope(3, []);
    expect(detectFillers(words, { envelope: loud, threshold: -40 })[0]).toMatchObject({ start: 1, end: 1.2, certain: false });
    const onlyBefore = envelope(3, [[0.8, 1, -60]]);
    expect(detectFillers(words, { envelope: onlyBefore, threshold: -40 })[0].certain).toBe(false);
    expect(detectFillers(words, { envelope: { from: 0, windowSeconds: 0.01, db: [] } })[0].certain).toBe(false);
  });

  it("fillerRanges une os trechos para removeRanges", () => {
    const ranges = fillerRanges([
      { start: 1, end: 1.5 },
      { start: 1.5, end: 2 },
      { start: 3, end: 3.2 },
    ]);
    expect(ranges).toEqual([
      [1, 2],
      [3, 3.2],
    ]);
    const clips = removeRanges([{ id: "c", track: "V1", start: 0, duration: 4, sourceIn: 0 }], ranges);
    expect(clips.reduce((sum, clip) => sum + clip.duration, 0)).toBeCloseTo(2.8);
  });
});

describe("scoreTitles e strongWords", () => {
  it("pontua números, ênfase, maiúsculas e pontuação a partir de legendas", () => {
    const cues = [
      { start: 0, end: 4, text: "e então a gente foi lá" },
      { start: 5, end: 9, text: "isso NUNCA aconteceu\ncom 3 pessoas!" },
      { start: 10, end: 14, text: "você sabe o segredo? — X 2024" },
      { start: 30, end: 34, text: "ganhei mil reais" },
      { start: 35, end: 39, text: "uma ideia boa" },
    ];
    const titles = scoreTitles(cues, { count: "medio" });
    expect(titles.map((item) => item.text)).toEqual(["isso NUNCA aconteceu com 3 pessoas!", "ganhei mil reais"]);
    expect(titles[0].score).toBeGreaterThan(titles[1].score);
    expect(scoreTitles(cues, { count: "poucos" })).toHaveLength(1);
    expect(scoreTitles(cues, { count: "muitos" }).length).toBeGreaterThanOrEqual(3);
    expect(scoreTitles(cues, { count: "outro" })).toHaveLength(2);
    expect(scoreTitles(cues)).toHaveLength(2);
  });

  it("não sobrepõe títulos e desempata pelo início", () => {
    const cues = [
      { start: 0, end: 30, text: "segredo" },
      { start: 25, end: 40, text: "segredo" },
      { start: 1, end: 2, text: "segredo" },
    ];
    const titles = scoreTitles(cues, { count: "medio" });
    expect(titles.map((item) => item.start)).toEqual([0]);
  });

  it("aceita palavras ({word} ou {text, prob}) e retorna vazio sem frases fortes", () => {
    const words = [w("o", 0, 0.2), w("melhor", 0.2, 0.6), w("dia.", 0.6, 1)];
    expect(scoreTitles(words, { language: "pt" })).toEqual([{ start: 0, end: 1, text: "o melhor dia.", score: expect.any(Number) }]);
    const backend = [{ text: "the", start: 0, end: 0.2, prob: 0.9 }, { text: "best", start: 0.2, end: 0.5, prob: 0.9 }];
    expect(scoreTitles(backend, { language: "en" })[0].text).toBe("the best");
    expect(scoreTitles([{ start: 0, end: 1, text: "de que o" }])).toEqual([]);
    expect(scoreTitles([])).toEqual([]);
  });

  it("strongWords marca números e ênfase com espaçamento mínimo", () => {
    const words = [w("tenho", 0, 0.3), w("2", 0.3, 0.5), w("NUNCA", 0.6, 0.9), w("—", 1, 1.1), w("dez", 2, 2.2), { text: "jamais", start: 4, end: 4.3 }];
    expect(strongWords(words)).toEqual([
      { time: 0.3, word: "2" },
      { time: 2, word: "dez" },
      { time: 4, word: "jamais" },
    ]);
    expect(strongWords(words, { minGap: 0 }).map((item) => item.word)).toEqual(["2", "NUNCA", "dez", "jamais"]);
    expect(strongWords([w("never", 0, 1)], { language: "en" })).toHaveLength(1);
  });
});

describe("modelos e clipes de legenda", () => {
  it("modelos próprios têm todos os campos e ids únicos", () => {
    expect(CAPTION_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(CAPTION_TEMPLATES.length).toBeLessThanOrEqual(12);
    expect(new Set(CAPTION_TEMPLATES.map((item) => item.id)).size).toBe(CAPTION_TEMPLATES.length);
    const keys = ["id", "name", "folder", "font", "weight", "size", "fill", "stroke", "strokeWidth", "box", "boxColor", "align", "position", "uppercase", "highlightColor", "animation"];
    CAPTION_TEMPLATES.forEach((item) => {
      keys.forEach((key) => expect(item).toHaveProperty(key));
      expect(["none", "pop", "fade", "slide", "typewriter"]).toContain(item.animation);
      expect(["bottom", "center", "top"]).toContain(item.position);
    });
  });

  it("captionTemplate resolve id, objeto e desconhecido", () => {
    expect(captionTemplate("mm-karaoke-ambar").name).toBe("Karaokê Âmbar");
    expect(captionTemplate({ id: "custom" })).toEqual({ id: "custom" });
    expect(captionTemplate("nao-existe")).toBe(CAPTION_TEMPLATES[0]);
    expect(captionTemplate()).toBe(CAPTION_TEMPLATES[0]);
  });

  it("captionClips cria títulos de legenda na trilha com estilo e palavras", () => {
    const cues = reflowCaptions([w("oi", 0, 0.5), w("gente", 0.5, 1)]);
    const [clip] = captionClips(cues, { template: "mm-tarja-escura", overrides: { fill: "#FF0000" }, idPrefix: "leg" });
    expect(clip).toMatchObject({ id: "leg-1", name: "oi gente", type: "text/title", caption: true, track: "V3", start: 0, duration: 1, text: "oi gente" });
    expect(clip.captionStyle).toMatchObject({ id: "mm-tarja-escura", fill: "#FF0000" });
    expect(clip.captionWords).toHaveLength(2);
    const [plain] = captionClips([{ start: 2, end: 2, text: "a\nb" }]);
    expect(plain).toMatchObject({ id: "caption-1", name: "a", duration: 0.05, track: "V3" });
    expect(plain).not.toHaveProperty("captionWords");
    expect(plain.captionStyle.id).toBe(CAPTION_TEMPLATES[0].id);
  });

  it("retemplateCaptions troca só o estilo das legendas", () => {
    const clips = [
      { id: "a", type: "text/title", caption: true, start: 1, duration: 2, text: "corrigido", captionStyle: CAPTION_TEMPLATES[0] },
      { id: "b", type: "text/title", start: 0, duration: 5, text: "título" },
      { id: "c", type: "video/mp4", caption: true, start: 0, duration: 5 },
    ];
    const next = retemplateCaptions(clips, "mm-rodape-limpo", { size: 40 });
    expect(next[0]).toMatchObject({ start: 1, duration: 2, text: "corrigido", captionStyle: { id: "mm-rodape-limpo", size: 40 } });
    expect(next[1]).toBe(clips[1]);
    expect(next[2]).toBe(clips[2]);
    expect(retemplateCaptions(clips, CAPTION_TEMPLATES[1])[0].captionStyle.id).toBe(CAPTION_TEMPLATES[1].id);
  });
});

describe("captionStyleCss e fontAvailable", () => {
  afterEach(() => {
    delete document.fonts;
  });

  it("gera contorno, caixa, posição e maiúsculas", () => {
    const css = captionStyleCss(captionTemplate("mm-bloco-branco"), 0.5);
    expect(css).toMatchObject({ fontFamily: expect.stringContaining('"Montserrat"'), fontSize: "36px", WebkitTextStroke: "3px #000000", textTransform: "uppercase", bottom: "8%" });
    expect(css).not.toHaveProperty("backgroundColor");
    const boxed = captionStyleCss(captionTemplate("mm-topo-aviso"));
    expect(boxed).toMatchObject({ top: "8%", backgroundColor: "#DC2626E6", borderRadius: "8px" });
    const center = captionStyleCss({ position: "center", strokeWidth: 0, uppercase: false });
    expect(center).toMatchObject({ top: "50%", transform: "translateY(-50%)", textTransform: "none", WebkitTextStroke: undefined });
    expect(captionStyleCss({ position: "lado" }).bottom).toBe("8%");
    expect(captionStyleCss().fontSize).toBe(`${CAPTION_TEMPLATES[0].size}px`);
  });

  it("fontAvailable usa document.fonts.check com proteção", () => {
    expect(fontAvailable("Inter")).toBe(true);
    Object.defineProperty(document, "fonts", { value: { check: (spec) => spec.includes("Inter") }, configurable: true });
    expect(fontAvailable("Inter")).toBe(true);
    expect(fontAvailable("Outra")).toBe(false);
    Object.defineProperty(document, "fonts", {
      value: {
        check: () => {
          throw new Error("x");
        },
      },
      configurable: true,
    });
    expect(fontAvailable("Inter")).toBe(true);
    Object.defineProperty(document, "fonts", { value: {}, configurable: true });
    expect(fontAvailable("Inter")).toBe(true);
  });
});
