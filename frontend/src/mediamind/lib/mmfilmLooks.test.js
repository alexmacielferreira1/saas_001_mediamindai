import { describe, expect, it } from "vitest";
import { layerFilter } from "../components/graphic-tools/filmcraftRender";
import {
  COLOR_FIELDS,
  LOOKS,
  TRANSITIONS,
  applyLook,
  drawLookOverlays,
  drawTransitionFrame,
  findLook,
  lookFilter,
  lookOverlays,
  overlayStyles,
  removeLook,
  resolveTransition,
  transitionProgress,
  transitionState,
  transitionWindows,
} from "./mmfilmLooks";

function fakeContext({ alpha } = {}) {
  const calls = [];
  const stack = [];
  const context = { calls, globalAlpha: alpha, filter: "none", globalCompositeOperation: "source-over" };
  ["translate", "scale", "beginPath", "rect", "arc", "clip", "fillRect"].forEach((name) => {
    context[name] = (...args) => {
      calls.push([name, ...args]);
      if (name === "fillRect") {
        calls.push(["paint", { alpha: context.globalAlpha, fill: context.fillStyle, blend: context.globalCompositeOperation, filter: context.filter }]);
      }
    };
  });
  context.save = () => {
    stack.push({ globalAlpha: context.globalAlpha, filter: context.filter, globalCompositeOperation: context.globalCompositeOperation });
    calls.push(["save"]);
  };
  context.restore = () => {
    Object.assign(context, stack.pop());
    calls.push(["restore"]);
  };
  return context;
}

const named = (context, name) => context.calls.filter((call) => call[0] === name);

const baseClip = {
  exposure: 0,
  contrast: 100,
  saturation: 100,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
};

describe("catálogo de looks", () => {
  it("tem 15+ looks próprios, só com campos de cor conhecidos", () => {
    expect(LOOKS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(LOOKS.map((item) => item.id)).size).toBe(LOOKS.length);
    LOOKS.forEach((item) => {
      Object.keys(item.params).forEach((field) => expect(COLOR_FIELDS).toHaveProperty(field));
      Object.keys(item.filters).forEach((name) => expect(["sepia", "grayscale", "hueRotate"]).toContain(name));
      if (item.tint) expect(item.tint).toEqual({ color: expect.stringMatching(/^#/), alpha: expect.any(Number), blend: expect.any(String) });
    });
  });

  it("encontra por id ou objeto", () => {
    expect(findLook("vintage").name).toBe("Vintage");
    const custom = { id: "meu", params: {}, filters: {} };
    expect(findLook(custom)).toBe(custom);
    expect(findLook({ id: "x" })).toBeNull();
    expect(findLook("nada")).toBeNull();
  });
});

describe("aplicar look", () => {
  it("intensidade 100 soma os deslocamentos e guarda o que aplicou", () => {
    const clip = applyLook({ ...baseClip, id: "a" }, "cinema-quente");
    expect(clip).toMatchObject({ id: "a", contrast: 110, saturation: 105, temperature: 25, highlights: -5, shadows: -8 });
    expect(clip.look).toEqual({
      id: "cinema-quente",
      intensity: 100,
      applied: { contrast: 10, saturation: 5, temperature: 25, highlights: -5, shadows: -8 },
      filters: { sepia: 8 },
      tint: { color: "#ff9a3c", alpha: 0.08, blend: "soft-light" },
    });
  });

  it("intensidade 0 = imagem original; intensidade parcial escala tudo", () => {
    const original = { ...baseClip, exposure: 7 };
    const none = applyLook(original, "neon", 0);
    expect(lookFilter(none)).toBe(lookFilter(original));
    expect(lookOverlays(none)).toEqual([]);
    const half = applyLook(original, "neon", 50);
    expect(half).toMatchObject({ contrast: 110, saturation: 122.5, tint: 7.5 });
    expect(half.look).toMatchObject({ intensity: 50, filters: { hueRotate: 5 }, tint: { alpha: 0.05 } });
    expect(applyLook(original, "neon", "x").look.intensity).toBe(0);
    expect(applyLook(original, "neon", 500).look.intensity).toBe(100);
  });

  it("respeita as faixas dos campos e desfaz exatamente ao trocar ou remover", () => {
    const manual = { ...baseClip, saturation: 30, contrast: 190 };
    const gray = applyLook(manual, "pb-contraste");
    expect(gray).toMatchObject({ saturation: 0, contrast: 200 });
    expect(gray.look.applied).toMatchObject({ saturation: -30, contrast: 10 });
    const swapped = applyLook(gray, "vivo");
    expect(swapped).toMatchObject({ saturation: 65, contrast: 200, look: { id: "vivo" } });
    expect(removeLook(gray)).toEqual(manual);
    expect(applyLook(gray, null)).toEqual(manual);
    expect(removeLook(manual)).toBe(manual);
    expect(removeLook(null)).toBeNull();
  });

  it("campos ausentes partem do neutro; parâmetros desconhecidos e looks sem extras são aceitos", () => {
    const clip = applyLook({}, { id: "x", params: { exposure: 10, brilho: 5 }, filters: {} });
    expect(clip).toEqual({ exposure: 10, look: { id: "x", intensity: 100, applied: { exposure: 10 }, filters: {}, tint: null } });
    expect(removeLook({ look: { id: "y" } })).toEqual({});
    expect(removeLook({ look: { applied: { contrast: 10 } } })).toEqual({ contrast: 90 });
  });
});

describe("filtro e sobreposições", () => {
  it("é idêntico ao layerFilter para clipes sem look e com campos neutros", () => {
    [{}, baseClip, { exposure: -20, contrast: 130, saturation: 0 }, { ...baseClip, exposure: 12 }].forEach((clip) =>
      expect(lookFilter(clip)).toBe(layerFilter(clip)),
    );
    expect(lookFilter(null)).toBe("brightness(100%) contrast(100%) saturate(100%)");
  });

  it("acrescenta realces/brancos, sombras/pretos e filtros do look", () => {
    const clip = { ...baseClip, highlights: 20, whites: 10, shadows: 20, blacks: -10, look: { filters: { grayscale: 100, sepia: 30, hueRotate: -6 } } };
    expect(lookFilter(clip)).toBe(
      "brightness(100%) contrast(100%) saturate(100%) brightness(104%) contrast(98%) grayscale(100%) sepia(30%) hue-rotate(-6deg)",
    );
  });

  it("sobreposições: temperatura, matiz e cor do look", () => {
    expect(lookOverlays(null)).toEqual([]);
    expect(lookOverlays({ temperature: 50, tint: -100 })).toEqual([
      { color: "#ff8a00", alpha: 0.075, blend: "soft-light" },
      { color: "#00ff66", alpha: 0.12, blend: "soft-light" },
    ]);
    expect(lookOverlays({ temperature: -100, tint: 50, look: { tint: { color: "#123456", alpha: 0.2, blend: "multiply" } } })).toEqual([
      { color: "#0066ff", alpha: 0.15, blend: "soft-light" },
      { color: "#ff00ff", alpha: 0.06, blend: "soft-light" },
      { color: "#123456", alpha: 0.2, blend: "multiply" },
    ]);
    expect(lookOverlays({ look: { tint: { color: "#000", alpha: 0 } } })).toEqual([]);
  });

  it("interruptores do Lumetri: Correção básica e Criativo desligados saem do filtro e das sobreposições", () => {
    const clip = {
      ...baseClip,
      exposure: 20,
      saturation: 0,
      highlights: 20,
      temperature: 50,
      look: { filters: { sepia: 30 }, tint: { color: "#123456", alpha: 0.2, blend: "multiply" } },
    };
    const neutral = "brightness(100%) contrast(100%) saturate(100%)";
    expect(lookFilter({ ...clip, colorBypass: { basic: true } })).toBe(`${neutral} sepia(30%)`);
    expect(layerFilter({ ...clip, colorBypass: { basic: true } })).toBe(neutral);
    expect(lookOverlays({ ...clip, colorBypass: { basic: true } })).toEqual([{ color: "#123456", alpha: 0.2, blend: "multiply" }]);
    expect(lookFilter({ ...clip, colorBypass: { creative: true } })).toBe(
      "brightness(120%) contrast(100%) saturate(0%) brightness(103%)",
    );
    expect(lookOverlays({ ...clip, colorBypass: { creative: true } })).toEqual([{ color: "#ff8a00", alpha: 0.075, blend: "soft-light" }]);
    expect(lookFilter({ ...clip, colorBypass: { basic: true, creative: true } })).toBe(neutral);
    expect(lookOverlays({ ...clip, colorBypass: { basic: true, creative: true } })).toEqual([]);
  });

  it("desenha as sobreposições no canvas e gera estilos da prévia", () => {
    const clip = applyLook({ ...baseClip, temperature: 20 }, "sombrio");
    const context = fakeContext({ alpha: 0.5 });
    drawLookOverlays(context, clip, 640, 360);
    expect(named(context, "fillRect")).toEqual([
      ["fillRect", 0, 0, 640, 360],
      ["fillRect", 0, 0, 640, 360],
    ]);
    const paints = named(context, "paint").map((call) => call[1]);
    expect(paints[0]).toEqual({ alpha: 0.015, fill: "#ff8a00", blend: "soft-light", filter: "none" });
    expect(paints[1]).toMatchObject({ fill: "#0b1d2a", blend: "multiply", alpha: 0.075 });
    expect(context.globalCompositeOperation).toBe("source-over");
    const noAlpha = fakeContext();
    drawLookOverlays(noAlpha, { temperature: 100 }, 10, 10);
    expect(named(noAlpha, "paint")[0][1].alpha).toBe(0.15);
    expect(overlayStyles({ tint: 100 })).toEqual([
      { position: "absolute", inset: 0, pointerEvents: "none", backgroundColor: "#ff00ff", opacity: 0.12, mixBlendMode: "soft-light" },
    ]);
  });
});

describe("transições", () => {
  it("tem 12+ transições próprias e resolve id, nome legado e objeto", () => {
    expect(TRANSITIONS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TRANSITIONS.map((item) => item.id)).size).toBe(TRANSITIONS.length);
    expect(resolveTransition("Dip to Black")).toMatchObject({ id: "mergulho-preto", duration: 0.8 });
    expect(resolveTransition("circulo").duration).toBe(0.6);
    expect(resolveTransition({ id: "glitch", duration: 1.5 }).duration).toBe(1.5);
    expect(resolveTransition({ id: "glitch", duration: -1 }).duration).toBe(0.4);
    expect(resolveTransition("nada")).toBeNull();
    expect(resolveTransition(null)).toBeNull();
  });

  it("todas começam mostrando só a camada que sai e terminam só com a que entra", () => {
    TRANSITIONS.forEach((item) => {
      const start = transitionState(item, 0);
      const end = transitionState(item, 1);
      expect(start.outgoing).toMatchObject({ opacity: 1, dx: 0, dy: 0, scale: 1, blur: 0, glitch: 0 });
      const incomingHidden =
        start.incoming.opacity === 0 ||
        Math.abs(start.incoming.dx) >= 1920 ||
        Math.abs(start.incoming.dy) >= 1080 ||
        start.incoming.clip?.width === 0 ||
        start.incoming.clip?.r === 0;
      expect(incomingHidden).toBe(true);
      expect(end.incoming).toMatchObject({ opacity: 1, dx: 0, dy: 0, scale: 1, blur: 0, glitch: 0 });
      expect(end.overlay?.alpha ?? 0).toBe(0);
    });
  });

  it("estados intermediários", () => {
    expect(transitionState("dissolver", 0.25).incoming.opacity).toBe(0.25);
    expect(transitionState("dissolver-filme", 0.25).incoming.opacity).toBe(0.125);
    expect(transitionState("mergulho-preto", 0.25)).toMatchObject({
      outgoing: { opacity: 1 },
      incoming: { opacity: 0 },
      overlay: { color: "#000", alpha: 0.5 },
    });
    expect(transitionState("mergulho-branco", 0.75)).toMatchObject({
      outgoing: { opacity: 0 },
      incoming: { opacity: 1 },
      overlay: { color: "#fff", alpha: 0.5 },
    });
    expect(transitionState("deslizar-cima", 0.5).incoming.dy).toBe(540);
    expect(transitionState("deslizar-direita", 0.5).incoming.dx).toBe(-960);
    expect(transitionState("deslizar-baixo", 0.5).incoming.dy).toBe(-540);
    expect(transitionState("empurrar-esquerda", 0.5)).toMatchObject({ outgoing: { dx: -960 }, incoming: { dx: 960 } });
    expect(transitionState("empurrar-direita", 0.5)).toMatchObject({ outgoing: { dx: 960 }, incoming: { dx: -960 } });
    expect(transitionState("zoom-entrar", 0.5)).toMatchObject({ outgoing: { scale: 1.25, opacity: 0.5 }, incoming: { scale: 0.9 } });
    expect(transitionState("zoom-sair", 0.5)).toMatchObject({ outgoing: { scale: 0.85 }, incoming: { scale: 1.15, opacity: 0.5 } });
    expect(transitionState("desfoque", 0.5)).toMatchObject({ outgoing: { blur: 15 }, incoming: { blur: 15, opacity: 0.5 } });
    expect(transitionState("wipe-linear", 0.5).incoming.clip).toEqual({ shape: "rect", x: 0, y: 0, width: 960, height: 1080 });
    expect(transitionState("circulo", 0.5).incoming.clip).toMatchObject({ shape: "circle", cx: 960, cy: 540 });
    const glitch = transitionState("glitch", 0.5, { seed: 4 });
    expect(glitch).toEqual(transitionState("glitch", 0.5, { seed: 4 }));
    expect(glitch.outgoing.glitch).toBe(1);
    expect(glitch.incoming.dx).toBe(-glitch.outgoing.dx);
    const seen = new Set(Array.from({ length: 11 }, (_, i) => transitionState("glitch", 0.05 + i * 0.09).incoming.opacity));
    expect(seen).toEqual(new Set([0, 1]));
    expect(transitionState("dissolver", "x").incoming.opacity).toBe(0);
    expect(transitionState("dissolver", 3).incoming.opacity).toBe(1);
  });

  it("transição desconhecida vira corte seco no meio", () => {
    expect(transitionState("nada", 0.4)).toMatchObject({ outgoing: { opacity: 1 }, incoming: { opacity: 0 } });
    expect(transitionState("nada", 0.6)).toMatchObject({ outgoing: { opacity: 0 }, incoming: { opacity: 1 } });
  });

  it("janelas entre clipes encostados, por faixa, com duração limitada e alinhamento", () => {
    const clips = [
      { id: "b", track: "V1", start: 4, duration: 0.4, transition: { id: "dissolver", duration: 1 } },
      { id: "a", track: "V1", start: 0, duration: 4 },
      { id: "c", track: "V1", start: 4.4, duration: 3, transition: "Dip to White" },
      { id: "d", track: "V1", start: 8, duration: 2, transition: "circulo" },
      { id: "e", track: "V2", start: 0, duration: 2 },
      { id: "f", track: "V2", start: 2, duration: 2, transition: "nada" },
      { id: "g", track: "V2", start: 4, duration: 2, transition: "glitch", enabled: false },
      null,
    ];
    const windows = transitionWindows(clips);
    expect(windows).toEqual([
      expect.objectContaining({ from: 3.8, to: 4.2, cut: 4, track: "V1", outgoingId: "a", incomingId: "b", transition: expect.objectContaining({ id: "dissolver", duration: 0.4 }) }),
      expect.objectContaining({ from: 4.2, to: 4.6, outgoingId: "b", incomingId: "c", transition: expect.objectContaining({ id: "mergulho-branco" }) }),
    ]);
    expect(transitionWindows(clips, { track: "V2" })).toEqual([]);
    expect(transitionWindows(clips, { track: "V1", align: "start" })[0]).toMatchObject({ from: 4, to: 4.4 });
    expect(transitionWindows(clips, { track: "V1", align: "end" })[0]).toMatchObject({ from: 3.6, to: 4 });
    expect(transitionWindows()).toEqual([]);
    expect(transitionProgress(windows[0], 4)).toBeCloseTo(0.5);
    expect(transitionProgress(windows[0], 0)).toBe(0);
    expect(transitionProgress({ from: 1, to: 1 }, 2)).toBe(1);
  });
});

describe("desenho da transição", () => {
  it("aplica estado das camadas, recortes e sobreposição; pula camadas invisíveis ou ausentes", () => {
    const context = fakeContext({ alpha: 0.5 });
    const drawn = [];
    const draw = (layer, values) => drawn.push([layer.id, values.opacity, context.globalAlpha, context.filter]);
    const state = {
      outgoing: { opacity: 1, dx: 960, dy: 0, scale: 1, blur: 10, glitch: 0, clip: null },
      incoming: { opacity: 0.5, dx: 0, dy: 54, scale: 2, blur: 0, glitch: 0, clip: { shape: "circle", cx: 960, cy: 540, r: 100 } },
      overlay: { color: "#000", alpha: 0.4 },
    };
    drawTransitionFrame(context, { outgoing: { id: "a" }, incoming: { id: "b" }, state, draw, width: 960, height: 540 });
    expect(drawn).toEqual([
      ["a", 1, 0.5, "blur(5px)"],
      ["b", 0.5, 0.25, "none"],
    ]);
    expect(named(context, "translate")).toEqual([
      ["translate", 960, 270],
      ["translate", -480, -270],
      ["translate", 480, 297],
      ["translate", -480, -270],
    ]);
    expect(named(context, "scale")).toEqual([["scale", 2, 2]]);
    expect(named(context, "arc")).toEqual([["arc", 480, 270, 50, 0, Math.PI * 2]]);
    expect(named(context, "clip")).toHaveLength(1);
    expect(named(context, "paint")[0][1]).toMatchObject({ alpha: 0.4, fill: "#000", filter: "none" });
    expect(context.globalAlpha).toBe(0.5);

    const wipe = fakeContext();
    const order = [];
    drawTransitionFrame(wipe, {
      outgoing: null,
      incoming: { id: "b" },
      state: transitionState("wipe-linear", 0.5),
      draw: (layer) => order.push(layer.id),
    });
    expect(order).toEqual(["b"]);
    expect(named(wipe, "rect")).toEqual([["rect", 0, 0, 960, 1080]]);
    expect(named(wipe, "fillRect")).toEqual([]);

    const hidden = fakeContext();
    drawTransitionFrame(hidden, {
      outgoing: { id: "a" },
      incoming: { id: "b" },
      state: { outgoing: null, incoming: { opacity: 0 }, overlay: { color: "#fff", alpha: 0 } },
      draw: () => order.push("x"),
    });
    expect(order).toEqual(["b"]);
    expect(hidden.calls).toEqual([]);
  });
});
