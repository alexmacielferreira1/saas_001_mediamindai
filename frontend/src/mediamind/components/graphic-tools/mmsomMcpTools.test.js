import { describe, expect, it } from "vitest";
import { MMSOM_TABS, mmsomCatalogue, runMMSomTool } from "./mmsomMcpTools";

const track = (id, name, extra = {}) => ({ id, name, volume: 100, pan: 0, mute: false, solo: false, ...extra });
const state = (tracks = [track(1, "Voz principal", { peaks: [0.1, 0.5] }), track(2, "Trilha musical", { peaks: [0.25], volume: 80 })]) => ({ tracks });
const run = (id, current, params) => runMMSomTool(id, current, params);
const byId = (result, id) => result.tracks.find((item) => item.id === id);

describe("catálogo do MMSom", () => {
  it("lista abas, ferramentas e as faixas atuais como opções (voz x música)", () => {
    const catalogue = mmsomCatalogue(state());
    expect(catalogue.tabs).toBe(MMSOM_TABS);
    expect(new Set(catalogue.tools.map((tool) => tool.tab))).toEqual(new Set(MMSOM_TABS.map((tab) => tab.id)));
    for (const tool of catalogue.tools) expect(tool.icon && tool.description).toBeTruthy();
    const params = (id) => Object.fromEntries(catalogue.tools.find((tool) => tool.id === id).params.map((param) => [param.key, param]));
    expect(params("inserts.voice").tracks).toMatchObject({ default: ["1"], options: [["1", "Voz principal"], ["2", "Trilha musical"]] });
    expect(params("mix.under").tracks.default).toEqual(["2"]);
    expect(params("mix.volume").tracks.default).toEqual(["1", "2"]);
    expect(mmsomCatalogue().tools.find((tool) => tool.id === "inserts.eq").params[0].options).toEqual([]);
  });

  it("ferramenta desconhecida, faixas não escolhidas e erros inesperados", () => {
    expect(run("nada", state())).toEqual({ ok: false, summary: "Ferramenta desconhecida: nada" });
    expect(run("mix.volume", state(), { tracks: [] })).toEqual({ ok: false, summary: "Escolha uma ou mais faixas." });
    expect(run("inserts.eq", state(), { tracks: undefined })).toEqual({ ok: false, summary: "Escolha uma ou mais faixas." });
    expect(() => run("mix.balance", state([track(1, "A", { peaks: "x" })]))).toThrow(TypeError);
  });
});

describe("mix", () => {
  it("equilibra pelos picos reais, baixando a faixa mais alta", () => {
    const result = run("mix.balance", state());
    expect(result).toMatchObject({ ok: true, count: 2, summary: "Níveis equilibrados pelo pico em -12,0 dB (Voz principal, Trilha musical)" });
    expect(byId(result, 1).volume).toBe(70);
    expect(byId(result, 2).volume).toBe(100);
    expect(result.details[0]).toBe("Voz principal: pico -6,0 dB → volume -6,0 dB");
    expect(run("mix.balance", state([track(1, "A", { peaks: [0.5] }), track(2, "B", { peaks: [0] }), track(3, "C")])).summary).toMatch(/duas ou mais faixas com áudio/);
  });

  it("define volume e abaixa a música sob a voz", () => {
    const volume = run("mix.volume", state(), { tracks: ["1"], db: -4 });
    expect(volume.summary).toBe("Volume -4,0 dB em Voz principal");
    expect(byId(volume, 1).volume).toBe(80);
    expect(byId(volume, 2).volume).toBe(80);
    const under = run("mix.under", state(), { reduction: -8 });
    expect(under.summary).toBe("Trilha musical 8 dB mais baixa(s) para a voz aparecer");
    expect(byId(under, 2).volume).toBe(40);
    expect(byId(run("mix.under", state([track(1, "Música", { volume: 5 })]), { reduction: -18 }), 1).volume).toBe(0);
  });

  it("abre o estéreo e centraliza", () => {
    const three = state([track(1, "A"), track(2, "B"), track(3, "C")]);
    const open = run("mix.spread", three, { width: 50 });
    expect(open.tracks.map((item) => item.pan)).toEqual([-50, 0, 50]);
    expect(open.summary).toBe("Estéreo aberto de -50 a 50 (3 faixas)");
    expect(run("mix.spread", state([track(1, "A")])).summary).toMatch(/duas ou mais faixas/);
    expect(run("mix.center", { tracks: open.tracks })).toMatchObject({ ok: true, count: 2 });
    expect(run("mix.center", three)).toEqual({ ok: false, summary: "Todas as faixas já estão no centro." });
  });

  it("limpa mutes e solos", () => {
    const result = run("mix.clear", state([track(1, "A", { mute: true }), track(2, "B", { solo: true }), track(3, "C")]));
    expect(result.summary).toBe("Mute/solo limpos em A, B");
    expect(result.tracks.every((item) => !item.mute && !item.solo)).toBe(true);
    expect(run("mix.clear", state())).toEqual({ ok: false, summary: "Nenhuma faixa está silenciada ou em solo." });
  });
});

describe("inserts", () => {
  it("aplica e desliga presets de EQ", () => {
    const voice = run("inserts.eq", state(), { tracks: ["1"], preset: "brilho" });
    expect(voice.summary).toBe("EQ Brilho em Voz principal");
    expect(byId(voice, 1).eq).toBe("brilho");
    expect(byId(run("inserts.eq", { tracks: voice.tracks }, { tracks: ["1"], preset: "off" }), 1).eq).toBeUndefined();
  });

  it("liga e desliga o compressor", () => {
    expect(run("inserts.comp", state()).tracks.every((item) => item.compressor)).toBe(true);
    expect(run("inserts.comp", state(), { mode: "off" }).summary).toBe("Compressor desligado em Voz principal, Trilha musical");
  });

  it("monta a cadeia de voz nas faixas de voz", () => {
    const result = run("inserts.voice", state([track(1, "Locução", { pan: 30 }), track(2, "Música")]));
    expect(result.summary).toBe("Cadeia de voz (EQ Voz + compressor, centro) em Locução");
    expect(byId(result, 1)).toMatchObject({ eq: "voz", compressor: true, pan: 0 });
    expect(byId(result, 2).eq).toBeUndefined();
  });
});

describe("solo, silenciar e clipes", () => {
  it("solo exclusivo e mute nas faixas escolhidas", () => {
    const result = run("mix.solo", state([track(1, "Voz"), track(2, "Música", { solo: true })]));
    expect(result.summary).toBe("Solo em Voz (as outras ficam mudas na reprodução e no mixdown)");
    expect(result.tracks.map((item) => item.solo)).toEqual([true, false]);
    const muted = run("mix.mute", state());
    expect(muted.summary).toBe("Silenciada(s) Trilha musical");
    expect(byId(muted, 2).mute).toBe(true);
    expect(run("mix.mute", { tracks: muted.tracks }, { tracks: ["2"], mode: "off" }).summary).toBe("Som de volta em Trilha musical");
  });

  it("alinha o início dos clipes com áudio", () => {
    const current = state([track(1, "A", { src: "a" }), track(2, "B"), track(3, "C", { src: "c", start: 9 })]);
    const result = run("clips.align", current, { at: 2.5 });
    expect(result.summary).toBe("2 clipe(s) começando em 2,5 s");
    expect(result.tracks.map((item) => item.start)).toEqual([2.5, undefined, 2.5]);
    expect(run("clips.align", current, { tracks: ["2"] }).summary).toBe("As faixas escolhidas não têm áudio na linha do tempo.");
  });

  it("coloca os clipes em sequência na ordem atual", () => {
    const current = state([track(1, "Bloco 2", { src: "b", start: 20, duration: 10 }), track(2, "Bloco 1", { src: "a", duration: 4.25 }), track(3, "Sem áudio")]);
    const result = run("clips.sequence", current, { gap: 1 });
    expect(result.summary).toBe("2 clipes em sequência, 1 s entre eles (termina em 18,9 s)");
    expect(byId(result, 2).start).toBe(3.6);
    expect(byId(result, 1).start).toBe(8.85);
    const long = run("clips.sequence", state([track(1, "A", { src: "a", start: 0, duration: 100 }), track(2, "B", { src: "b", start: 1, duration: 30 })]), { gap: 0 });
    expect(long.summary).toBe("2 clipes em sequência, 0 s entre eles (termina em 130 s) — passa dos 120 s da régua");
    expect(run("clips.sequence", current, { tracks: ["1", "3"] }).summary).toMatch(/duas ou mais faixas com áudio/);
  });
});
