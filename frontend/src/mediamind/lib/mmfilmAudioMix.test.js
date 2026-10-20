import { describe, expect, it } from "vitest";
import { duckingKeys, gainDbAt, normalizeGain, sfxPoints } from "./mmfilmAudioMix";

const music = { id: "m", track: "A2", start: 10, duration: 10 };

describe("ducking", () => {
  it("abaixa durante a voz com ataque e retorno, unindo trechos próximos", () => {
    expect(duckingKeys(music, [[12, 13], [13.2, 14]])).toEqual([
      [1.9, 0],
      [2, -12],
      [4, -12],
      [4.3, 0],
    ]);
  });

  it("ignora trechos fora do clipe e aceita redução, ataque e retorno próprios", () => {
    expect(duckingKeys(music, [[1, 2], [30, 31]])).toEqual([]);
    expect(duckingKeys(music, [[12, 13]], { reduction: -20, attack: 0.5, release: 1 })).toEqual([
      [1.5, 0],
      [2, -20],
      [3, -20],
      [4, 0],
    ]);
  });

  it("trecho que começa antes do clipe já entra abaixado (chaves no mesmo tempo viram uma)", () => {
    expect(duckingKeys(music, [[9.5, 11]])).toEqual([
      [0, -12],
      [1, -12],
      [1.3, 0],
    ]);
  });

  it("trecho que passa do fim do clipe termina abaixado", () => {
    expect(duckingKeys(music, [[19, 21]])).toEqual([
      [8.9, 0],
      [9, -12],
      [10, -12],
    ]);
  });

  it("ganho da curva no tempo local (0 sem curva)", () => {
    expect(gainDbAt({}, 1)).toBe(0);
    expect(gainDbAt({ gainKeys: [[0, 0], [1, -12]] }, 0.5)).toBe(-6);
  });
});

describe("normalização", () => {
  it("leva o RMS ao alvo quando o pico e o volume permitem", () => {
    expect(normalizeGain({ rms: -24, peak: -10 })).toEqual({ gain: 6, limited: null });
    expect(normalizeGain({ rms: -6, peak: -3 })).toEqual({ gain: -12, limited: null });
  });

  it("limita pelo pico máximo", () => {
    expect(normalizeGain({ rms: -24, peak: -3 })).toEqual({ gain: 2, limited: "pico" });
    expect(normalizeGain({ rms: -24, peak: -3 }, { peakMax: -6 })).toEqual({ gain: -3, limited: "pico" });
  });

  it("limita pelo volume máximo do clipe (+6 dB)", () => {
    expect(normalizeGain({ rms: -40, peak: -30 })).toEqual({ gain: 6.02, limited: "volume máximo" });
    expect(normalizeGain({ rms: -40, peak: -30 }, { target: -30, maxGain: 20 })).toEqual({ gain: 10, limited: null });
  });
});

describe("pontos de efeitos sonoros", () => {
  const take = (id, start, duration, extra = {}) => ({ id, track: "V1", type: "video/mp4", start, duration, ...extra });
  const clips = [
    take("d", 7, 1),
    take("a", 0, 2),
    take("b", 2, 2),
    take("c", 5, 2),
    take("off", 8, 2, { enabled: false }),
    take("v2", 9, 2, { track: "V2" }),
    take("tituloV1", 12, 1, { type: "text/title" }),
    { id: "t1", track: "V2", type: "text/title", start: 2.3, duration: 2 },
    { id: "legenda", track: "V3", type: "text/title", caption: true, start: 15, duration: 2 },
    { id: "t2", track: "V2", type: "text/title", start: 12, duration: 2 },
    { id: "t3", track: "V2", type: "text/title", start: 13, duration: 2, enabled: false },
  ];

  it("cortes só onde os takes se encostam e títulos sem legendas, respeitando o espaço mínimo", () => {
    expect(sfxPoints(clips)).toEqual([
      { time: 2, trigger: "corte" },
      { time: 7, trigger: "corte" },
      { time: 12, trigger: "texto" },
    ]);
    expect(sfxPoints(clips, { minGap: 0.2 }).map((point) => point.time)).toEqual([2, 2.3, 7, 12]);
  });

  it("cortes ou títulos podem ser desligados e as faixas de vídeo escolhidas", () => {
    expect(sfxPoints(clips, { cuts: false })).toEqual([{ time: 2.3, trigger: "texto" }, { time: 12, trigger: "texto" }]);
    expect(sfxPoints(clips, { titles: false }).map((point) => point.trigger)).toEqual(["corte", "corte"]);
    expect(sfxPoints(clips, { titles: false, videoTracks: ["V2"] })).toEqual([]);
  });

  it("sons automáticos (sfx) na faixa não contam como takes", () => {
    const clips = [take("a", 0, 2), take("s", 2, 1, { sfx: true }), take("b", 3, 2)];
    expect(sfxPoints(clips, { titles: false })).toEqual([]);
    expect(sfxPoints([take("a", 0, 2), take("s", 2, 1, { sfx: true }), take("b", 2, 2)], { titles: false })).toEqual([{ time: 2, trigger: "corte" }]);
  });

  it("takes que começam juntos no zero não geram corte", () => {
    expect(sfxPoints([take("a", 0, 2), take("b", 0, 2)], { titles: false })).toEqual([]);
  });
});
