import { describe, expect, it } from "vitest";
import { drawProgramFrame, drawStyledText, programComposition, programLayers } from "./filmcraftRender";

const clip = (values) => ({ id: values.id, track: "V1", type: "video/mp4", url: `blob:${values.id}`, start: 0, duration: 5, ...values });
const NEUTRAL_FX = { opacityFactor: 1, blur: 0, scaleX: 1, glitch: 0 };

// Contexto 2D falso que grava chamadas de método e atribuições de propriedades, em ordem.
function fakeContext({ measure = true } = {}) {
  const calls = [];
  const values = { globalAlpha: 1, filter: "none", globalCompositeOperation: "source-over", fillStyle: "#000" };
  const context = { calls };
  ["save", "restore", "fillRect", "translate", "rotate", "scale", "beginPath", "rect", "arc", "clip", "drawImage", "fillText", "strokeText", "transform"].forEach((name) => {
    context[name] = (...args) => calls.push([name, ...args]);
  });
  if (measure) context.measureText = (text) => ({ width: String(text).length * 10 });
  ["globalAlpha", "filter", "globalCompositeOperation", "fillStyle", "strokeStyle", "lineWidth", "lineJoin", "font", "textAlign", "textBaseline"].forEach((name) => {
    Object.defineProperty(context, name, {
      get: () => values[name],
      set: (value) => {
        values[name] = value;
        calls.push([`=${name}`, value]);
      },
    });
  });
  return context;
}
const named = (context, name) => context.calls.filter(([call]) => call === name);
const sets = (context, name) => named(context, `=${name}`).map(([, value]) => value);

describe("programComposition", () => {
  it("sem transições devolve as mesmas camadas de programLayers, com _fx do motion", () => {
    const clips = [
      clip({ id: "a", motion: { opacity: [[0, 0.5], [5, 0.5]], blur: [[0, 4], [5, 4]] } }),
      clip({ id: "b", track: "V2" }),
      clip({ id: "audio", track: "A1", type: "audio/wav" }),
    ];
    const result = programComposition(clips, 1, {});
    expect(result.map((item) => item.id)).toEqual(programLayers(clips, 1, {}).map((item) => item.id));
    expect(result[0]._fx.visual).toMatchObject({ opacityFactor: 0.5, blur: 4 });
    expect(result[1]._fx).toEqual({ visual: NEUTRAL_FX });
    expect(programComposition()).toEqual([]);
  });

  it("na janela da transição entram o clipe que sai e o que entra, com estados e overlay do mergulho", () => {
    const clips = [clip({ id: "out", duration: 2 }), clip({ id: "in", start: 2, duration: 2, transition: { id: "mergulho-preto", duration: 1 } }), clip({ id: "top", track: "V2" })];
    const before = programComposition(clips, 1.75, {});
    expect(before.map((item) => item.id)).toEqual(["out", "in", "top"]);
    expect(before[0]._fx.transition).toMatchObject({ opacity: 1 });
    expect(before[1]._fx.transition).toMatchObject({ opacity: 0 });
    expect(before[1]._fx.overlay).toEqual({ color: "#000", alpha: 0.5 });
    expect(before[0]._fx.window).toBe(before[1]._fx.window);
    const after = programComposition(clips, 2.25, {});
    expect(after.map((item) => item.id)).toEqual(["out", "in", "top"]);
    expect(after[1]._fx.transition.opacity).toBe(1);
    // Fora da janela, só a camada visível.
    expect(programComposition(clips, 3, {}).map((item) => item.id)).toEqual(["in", "top"]);
    // Faixa oculta não entra nas janelas.
    expect(programComposition(clips, 1.75, { V1: { visible: false } }).map((item) => item.id)).toEqual(["top"]);
  });

  it("transição gravada como texto legado (“Dissolver”) também vale", () => {
    const clips = [clip({ id: "out", duration: 2 }), clip({ id: "in", start: 2, duration: 2, transition: "Dissolver" })];
    const result = programComposition(clips, 2, {});
    expect(result.map((item) => item.id)).toEqual(["out", "in"]);
    expect(result[1]._fx.transition.opacity).toBe(0.5);
    expect(result[1]._fx.overlay).toBeUndefined();
  });

  it("quando os dois clipes do corte já estão visíveis, a janela entra uma vez só", () => {
    const clips = [clip({ id: "out", duration: 2.0000001 }), clip({ id: "in", start: 2, duration: 2, transition: "dissolver" })];
    expect(programLayers(clips, 2, {})).toHaveLength(2);
    expect(programComposition(clips, 2, {}).map((item) => item.id)).toEqual(["out", "in"]);
  });
});

describe("drawStyledText", () => {
  it("caixa, contorno, alinhamento central e posição embaixo (padrão)", () => {
    const context = fakeContext();
    drawStyledText(context, "Oi\nmundo", { box: true, strokeWidth: 3 }, 1920, 1080);
    expect(context.font).toBe('800 64px "Inter", Inter, Arial, sans-serif');
    expect(context.textAlign).toBe("center");
    const texts = named(context, "fillText");
    expect(texts.map((call) => call.slice(1, 3))).toEqual([
      ["Oi", 960],
      ["mundo", 960],
    ]);
    expect(texts[0][3]).toBeCloseTo(1080 * 0.92 - 64 * 1.15 * 2 + 64 * 1.15 * 0.5);
    expect(texts[1][3]).toBeCloseTo(1080 * 0.92 - 64 * 1.15 * 2 + 64 * 1.15 * 1.5);
    const box = named(context, "fillRect")[0];
    expect(box[1]).toBeCloseTo(960 - 10 - 64 * 0.3);
    expect(box[3]).toBeCloseTo(20 + 64 * 0.6);
    expect(sets(context, "fillStyle")).toEqual(["#000000B3", "#fff", "#000000B3", "#fff"]);
    expect(sets(context, "strokeStyle")[0]).toBe("#000");
    expect(sets(context, "lineWidth")[0]).toBe(6);
    expect(named(context, "strokeText")).toHaveLength(2);
  });

  it("alinha à esquerda no topo e em maiúsculas, com cores e fonte do estilo", () => {
    const context = fakeContext();
    const style = { align: "left", position: "top", uppercase: true, box: true, boxColor: "#123", fill: "#ff0", stroke: "#00f", strokeWidth: 0, size: 32, weight: 400, font: "Roboto" };
    drawStyledText(context, "abc", style, 960, 540);
    expect(context.font).toBe('400 16px "Roboto", Inter, Arial, sans-serif');
    const [, text, x, y] = named(context, "fillText")[0];
    expect([text, x]).toEqual(["ABC", 48]);
    expect(y).toBeCloseTo(540 * 0.08 + 16 * 1.15 * 0.5);
    expect(named(context, "fillRect")[0][1]).toBeCloseTo(48 - 16 * 0.3);
    expect(sets(context, "fillStyle")).toEqual(["#123", "#ff0"]);
    expect(named(context, "strokeText")).toHaveLength(0);
  });

  it("alinha à direita no centro; sem measureText estima a largura; tamanho mínimo de 8 px", () => {
    const context = fakeContext({ measure: false });
    drawStyledText(context, "abcd", { align: "right", position: "center", box: true, size: 4 }, 1000, 1080);
    const [, , x, y] = named(context, "fillText")[0];
    expect(x).toBe(950);
    expect(y).toBeCloseTo(540);
    const box = named(context, "fillRect")[0];
    expect(box[3]).toBeCloseTo(4 * 8 * 0.6 + 8 * 0.3 * 2);
    expect(box[1]).toBeCloseTo(950 - 4 * 8 * 0.6 - 8 * 0.3);
  });

  it("measureText que não devolve largura usa a estimativa", () => {
    const context = fakeContext();
    context.measureText = () => undefined;
    drawStyledText(context, "ab", { box: true }, 1920, 1080);
    expect(named(context, "fillRect")[0][3]).toBeCloseTo(2 * 64 * 0.6 + 64 * 0.6);
  });
});

describe("drawProgramFrame com composição", () => {
  const frame = (composition, extra = {}) => {
    const context = fakeContext();
    drawProgramFrame(context, { composition, width: 1920, height: 1080, ...extra });
    return context;
  };
  const layer = (values, fx) => ({ ...clip(values), _fx: { visual: { ...NEUTRAL_FX }, ...fx } });

  it("opacidade do motion e da transição multiplicam; desfoque soma no filtro; escala horizontal no scale", () => {
    const context = frame([layer({ id: "a", opacity: 50 }, { visual: { ...NEUTRAL_FX, opacityFactor: 0.5, blur: 2, scaleX: -1 }, transition: { opacity: 0.8, dx: 0, dy: 0, scale: 1, blur: 3, glitch: 0, clip: null } })]);
    expect(sets(context, "globalAlpha")).toContain(0.5 * 0.5 * 0.8);
    expect(sets(context, "filter").at(-1)).toBe("brightness(100%) contrast(100%) saturate(100%) blur(5px)");
    expect(named(context, "scale")).toEqual([["scale", -1, 1]]);
    expect(named(context, "translate")[0]).toEqual(["translate", 960, 540]);
    expect(named(context, "translate")[1]).toEqual(["translate", -960, -540]);
  });

  it("transição desloca, escala e recorta em retângulo ou círculo", () => {
    const rect = frame([layer({ id: "a" }, { transition: { opacity: 1, dx: 192, dy: -108, scale: 0.5, blur: 0, glitch: 0, clip: { shape: "rect", x: 0, y: 0, width: 960, height: 1080 } } })], {});
    expect(named(rect, "translate")[0]).toEqual(["translate", 960 + 192, 540 - 108]);
    expect(named(rect, "scale")[0]).toEqual(["scale", 0.5, 0.5]);
    expect(named(rect, "rect")[0]).toEqual(["rect", 0, 0, 960, 1080]);
    expect(named(rect, "clip")).toHaveLength(2);

    const context = fakeContext();
    drawProgramFrame(context, {
      composition: [layer({ id: "a" }, { transition: { opacity: 1, dx: 0, dy: 0, scale: 1, blur: 0, glitch: 0, clip: { shape: "circle", cx: 960, cy: 540, r: 100 } } })],
      width: 960,
      height: 540,
    });
    expect(named(context, "arc")[0]).toEqual(["arc", 480, 270, 50, 0, Math.PI * 2]);
    expect(named(context, "scale")).toHaveLength(1);
  });

  it("glitch desenha duas cópias deslocadas em “lighter”", () => {
    const video = { videoWidth: 1920, videoHeight: 1080 };
    const context = frame([layer({ id: "v" }, { visual: { ...NEUTRAL_FX, glitch: 0.5 } })], { sources: new Map([["v", video]]) });
    expect(named(context, "drawImage")).toHaveLength(3);
    expect(sets(context, "globalCompositeOperation")).toEqual(["lighter"]);
    expect(sets(context, "globalAlpha").at(-1)).toBeCloseTo(0.35 * 0.5);
    const shifts = named(context, "translate").slice(-2).map((call) => call[1]);
    expect(shifts).toEqual([7, -14]);
    // Glitch vindo da transição também conta.
    const fromTransition = frame([layer({ id: "v" }, { transition: { opacity: 1, dx: 0, dy: 0, scale: 1, blur: 0, glitch: 1, clip: null } })], { sources: new Map([["v", video]]) });
    expect(named(fromTransition, "drawImage")).toHaveLength(3);
  });

  it("sobreposições de look/temperatura/matiz e overlay de mergulho são desenhadas depois da camada", () => {
    const looked = frame([layer({ id: "a", look: { tint: { color: "#f00", alpha: 0.2, blend: "soft-light" } } })]);
    expect(sets(looked, "fillStyle")).toContain("#f00");
    expect(frame([layer({ id: "b", temperature: 20 })]).calls.some(([name, value]) => name === "=fillStyle" && value === "#ff8a00")).toBe(true);
    expect(frame([layer({ id: "c", tint: -20 })]).calls.some(([name, value]) => name === "=fillStyle" && value === "#00ff66")).toBe(true);

    const dip = frame([layer({ id: "d" }, { overlay: { color: "#fff", alpha: 0.4 } })]);
    expect(named(dip, "fillRect").at(-1)).toEqual(["fillRect", 0, 0, 1920, 1080]);
    expect(sets(dip, "fillStyle").at(-1)).toBe("#fff");
    expect(sets(dip, "globalAlpha").at(-1)).toBe(0.4);
    const none = frame([layer({ id: "e" }, { overlay: { color: "#fff", alpha: 0 } })]);
    expect(named(none, "fillRect")).toHaveLength(1);
  });

  it("camada sem _fx usa valores neutros", () => {
    const context = frame([clip({ id: "a", opacity: 60 })]);
    expect(sets(context, "globalAlpha")).toContain(0.6);
    expect(sets(context, "filter").at(-1)).toBe("brightness(100%) contrast(100%) saturate(100%)");
  });

  it("modo legado com `time` usa os canais extras do motion", () => {
    const context = fakeContext();
    drawProgramFrame(context, { layers: [clip({ id: "a", motion: { blur: [[0, 10], [5, 10]] } })], width: 1920, height: 1080, time: 1 });
    expect(sets(context, "filter").at(-1)).toBe("brightness(100%) contrast(100%) saturate(100%) blur(10px)");
  });
});

describe("títulos com animação de texto", () => {
  const title = (values) => clip({ type: "text/title", track: "V2", textAnimation: "aparecer", ...values });
  const draw = (layers, time = 1) => {
    const context = fakeContext();
    drawProgramFrame(context, { composition: layers, width: 1920, height: 1080, time });
    return context;
  };

  it("sem captionStyle usa o estilo padrão do título animado", () => {
    const context = draw([title({ id: "t", text: "Olá" })]);
    const text = named(context, "fillText")[0];
    expect(text[1]).toBe("Olá");
    expect(context.font).toBe(`bold ${Math.round(1920 * 0.035)}px sans-serif`);
    expect(named(draw([title({ id: "n", name: "Nome", text: "" })]), "fillText")[0][1]).toBe("Nome");
    expect(named(draw([title({ id: "v", name: undefined, text: undefined })]), "fillText")[0][1]).toBe("");
  });

  it("com captionStyle aplica fonte, cor e posição topo/embaixo/centro; maiúsculas no texto animado", () => {
    const top = draw([title({ id: "t", text: "olá", captionStyle: { position: "top", size: 100, font: "Roboto", weight: 500, fill: "#ff0", uppercase: true } })]);
    expect(top.font).toBe('500 100px "Roboto", Inter, Arial, sans-serif');
    expect(sets(top, "fillStyle")).toContain("#ff0");
    expect(named(top, "translate").at(-1)[2]).toBeCloseTo(1080 * 0.12);
    expect(named(top, "fillText")[0][1]).toBe("OLÁ");

    const bottom = draw([title({ id: "t", name: "Nome", text: "", captionStyle: { position: "bottom" } })]);
    expect(bottom.font).toBe('800 64px "Inter", Inter, Arial, sans-serif');
    expect(sets(bottom, "fillStyle")).toContain("#fff");
    expect(named(bottom, "translate").at(-1)[2]).toBeCloseTo(1080 * 0.85);
    expect(named(bottom, "fillText")[0][1]).toBe("Nome");

    const center = draw([title({ id: "t", text: undefined, name: undefined, captionStyle: { position: "center", uppercase: true } })]);
    expect(named(center, "translate").at(-1)[2]).toBe(540);
    expect(named(center, "fillText")).toHaveLength(1);
    expect(named(center, "fillText")[0][1]).toBe("");
  });

  it("sem `time` o título animado cai no desenho estático (com ou sem captionStyle)", () => {
    const plain = fakeContext();
    drawProgramFrame(plain, { layers: [title({ id: "t", text: "A" })], width: 1920, height: 1080 });
    expect(plain.font).toBe(`bold ${Math.round(1920 * 0.035)}px sans-serif`);
    const styled = fakeContext();
    drawProgramFrame(styled, { layers: [title({ id: "t", name: "B", text: "", captionStyle: { position: "top" } })], width: 1920, height: 1080 });
    expect(named(styled, "fillText")[0][1]).toBe("B");
    const empty = fakeContext();
    drawProgramFrame(empty, { layers: [clip({ id: "x", type: "text/title", track: "V2", captionStyle: {} }), clip({ id: "y", type: "text/title", track: "V2" })], width: 1920, height: 1080 });
    expect(named(empty, "fillText").map((call) => call[1])).toEqual(["", ""]);
  });
});
