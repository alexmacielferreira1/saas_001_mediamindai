import { describe, expect, it } from "vitest";
import { keyValueAt } from "./mmfilmEdits";
import { animatedClip } from "./mmfilmMotion";
import {
  MOTION_CATEGORIES,
  MOTION_PRESETS,
  NEUTRAL,
  STYLE_PARTS,
  cloneStyle,
  effectiveVisual,
  findMotionPreset,
  mergeMotion,
  motionPresetCurves,
  quickMove,
} from "./mmfilmMotionPresets";

describe("catálogo de motion presets", () => {
  it("tem 25+ presets próprios em todas as categorias pedidas, com entrada e saída", () => {
    expect(MOTION_PRESETS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(MOTION_PRESETS.map((item) => item.id)).size).toBe(MOTION_PRESETS.length);
    ["Deslizar", "Zoom", "Rotação 2D", "Rotação 3D", "Desfoque", "Glitch", "Tremor", "Escala", "Elástico"].forEach((category) =>
      expect(MOTION_CATEGORIES).toContain(category),
    );
    MOTION_PRESETS.forEach((item) => expect(item.kinds).toEqual(["in", "out"]));
  });

  it("toda curva normalizada começa em 0, usa canais conhecidos e termina no valor neutro", () => {
    MOTION_PRESETS.forEach((item) => {
      Object.entries(item.curves).forEach(([channel, keys]) => {
        expect(channel in NEUTRAL).toBe(true);
        expect(keys[0][0]).toBe(0);
        expect(keys.at(-1)[1]).toBe(NEUTRAL[channel]);
        keys.forEach(([u], index) => index && expect(u).toBeGreaterThan(keys[index - 1][0]));
      });
    });
  });

  it("encontra por id ou objeto", () => {
    expect(findMotionPreset("porta").category).toBe("Rotação 3D");
    const custom = { id: "c", kinds: ["in"], curves: { x: [[0, 5], [1, 0]] } };
    expect(findMotionPreset(custom)).toBe(custom);
    expect(findMotionPreset({ id: "x" })).toBeNull();
    expect(findMotionPreset("nada")).toBeNull();
  });
});

describe("curvas no clipe", () => {
  it("entrada ocupa o início e assenta no clipe", () => {
    const curves = motionPresetCurves("deslizar-esquerda", "in", 4, { length: 0.5 });
    expect(curves).toEqual({ x: [[0, -1920, "ease"], [0.5, 0]] });
    const clip = { start: 10, duration: 4, x: 0, motion: curves };
    expect(animatedClip(clip, 10).x).toBe(-1920);
    expect(animatedClip(clip, 12).x).toBe(0);
  });

  it("saída espelha no tempo e termina exatamente no fim do clipe", () => {
    const curves = motionPresetCurves("mola-lateral", "out", 3);
    expect(curves.x).toEqual([[2.5, 0, "ease"], [2.625, -14, "ease"], [2.75, 48, "ease"], [3, -480]]);
    const fade = motionPresetCurves("aparecer", "out", 3).opacity;
    expect(fade).toEqual([[2.5, 1], [3, 0]]);
    expect(keyValueAt(fade, 1, 1)).toBe(1);
  });

  it("entrada + saída: clipe curto divide o tempo igualmente; nunca passa do fim", () => {
    const curves = motionPresetCurves("crescer", "both", 0.6, { length: 0.5 });
    expect(curves.scale).toEqual([[0, 0, "ease"], [0.3, 1], [0.3, 1, "ease"], [0.6, 0]]);
    MOTION_PRESETS.forEach((item) => {
      const all = motionPresetCurves(item, "both", 0.8, { length: 1 });
      Object.values(all).forEach((keys) => keys.forEach(([time]) => expect(time).toBeLessThanOrEqual(0.8)));
    });
    expect(motionPresetCurves("crescer", "in", 0.2, { length: 1 }).scale.at(-1)[0]).toBe(0.2);
  });

  it("rejeita preset, modo ou duração inválidos", () => {
    expect(motionPresetCurves("nada", "in", 2)).toBeNull();
    expect(motionPresetCurves("crescer", "in", 0)).toBeNull();
    expect(motionPresetCurves("crescer", "lado", 2)).toBeNull();
    expect(motionPresetCurves({ id: "s", kinds: ["in"], curves: { x: [[0, 1], [1, 0]] } }, "out", 2)).toBeNull();
    expect(motionPresetCurves("crescer", "in", 2, { length: 0 })).toBeNull();
    expect(motionPresetCurves("crescer", "in", 2, { length: "x" })).toBeNull();
    expect(motionPresetCurves("crescer", "in", 2, {})).toEqual({ scale: [[0, 0, "ease"], [0.5, 1]] });
  });

  it("glitch e tremor são determinísticos e voltam a zero", () => {
    const one = motionPresetCurves("glitch", "in", 2);
    expect(one).toEqual(motionPresetCurves("glitch", "in", 2));
    expect(one.glitch[0]).toEqual([0, 1, "hold"]);
    expect(one.x.at(-1)[1]).toBe(0);
    expect(motionPresetCurves("tremor", "in", 2).y.at(-1)).toEqual([0.5, 0]);
  });
});

describe("juntar movimentos", () => {
  it("casos vazios", () => {
    const existing = { x: [[0, 1]] };
    expect(mergeMotion(existing, null)).toBe(existing);
    expect(mergeMotion(undefined, undefined)).toBeNull();
    expect(mergeMotion(null, existing)).toEqual(existing);
  });

  it("mantém canais de um lado só e substitui canais desconhecidos ou vazios", () => {
    const merged = mergeMotion({ x: [[0, 5]], custom: [[0, 1]], y: [] }, { opacity: [[0, 0], [1, 1]], custom: [[0, 2]], y: [[0, 3]] });
    expect(merged).toEqual({ x: [[0, 5]], custom: [[0, 2]], y: [[0, 3]], opacity: [[0, 0], [1, 1]] });
    expect(mergeMotion({ x: [[0, 5]] }, { x: [] })).toEqual({ x: [[0, 5]] });
    expect(mergeMotion({ x: [[0, 5]] }, { x: "?" })).toEqual({ x: [[0, 5]] });
  });

  it("compõe: fatores multiplicam, deslocamentos somam, glitch usa o maior", () => {
    const merged = mergeMotion(
      { scale: [[0, 1], [2, 2]], x: [[0, 10], [2, 10]], glitch: [[0, 0.2], [2, 0.2]] },
      { scale: [[0, 1], [1, 3]], x: [[1, 5]], glitch: [[0, 0.5], [2, 0]] },
    );
    expect(merged.scale).toEqual([[0, 1], [1, 4.5], [2, 6]]);
    expect(merged.x).toEqual([[0, 15], [1, 15], [2, 15]]);
    expect(merged.glitch).toEqual([[0, 0.5], [2, 0.2]]);
  });

  it("amostra trechos suavizados e preserva degraus de hold", () => {
    const eased = mergeMotion({ x: [[0, 0, "ease"], [0.1, 10]] }, { x: [[0, 0], [0.1, 0]] }).x;
    expect(eased.length).toBe(4);
    expect(eased[1][1]).toBeCloseTo(keyValueAt([[0, 0, "ease"], [0.1, 10]], eased[1][0]), 3);
    const later = mergeMotion({ y: [[0, 0], [0.5, 0, "ease"], [0.6, 10]] }, { y: [[0, 0], [0.6, 0]] }).y;
    expect(later.map((key) => key[0])).toEqual([0, 0.5, 0.5333, 0.5667, 0.6]);
    const held = mergeMotion({ opacity: [[0, 0, "hold"], [1, 1]] }, { opacity: [[0, 1], [1, 1]] }).opacity;
    expect(held).toEqual([[0, 0], [0.999, 0], [1, 1]]);
  });
});

describe("visual efetivo", () => {
  it("neutro sem movimento e lê os canais extras no tempo local", () => {
    expect(effectiveVisual({ start: 0, duration: 1 }, 0.5)).toEqual({ opacityFactor: 1, blur: 0, scaleX: 1, glitch: 0 });
    expect(effectiveVisual(null, 0)).toEqual({ opacityFactor: 1, blur: 0, scaleX: 1, glitch: 0 });
    const clip = { start: 10, duration: 2, motion: motionPresetCurves("desfoque", "in", 2, { length: 1 }) };
    expect(effectiveVisual(clip, 10)).toEqual({ opacityFactor: 0, blur: 30, scaleX: 1, glitch: 0 });
    expect(effectiveVisual(clip, 50)).toEqual({ opacityFactor: 1, blur: 0, scaleX: 1, glitch: 0 });
    const odd = { start: 0, duration: 1, motion: { opacity: [[0, 3]], blur: [[0, -4]], glitch: [[0, 2]], scaleX: [[0, -1]] } };
    expect(effectiveVisual(odd, 0)).toEqual({ opacityFactor: 1, blur: 0, scaleX: -1, glitch: 1 });
  });
});

describe("movimentos rápidos extras", () => {
  it("motion blur: pico no meio sem movimento; proporcional à velocidade com movimento", () => {
    expect(quickMove("motionblur", 2)).toEqual({ blur: [[0, 0, "ease"], [1, 8, "ease"], [2, 0]] });
    const motion = motionPresetCurves("deslizar-esquerda", "in", 2, { length: 0.5 });
    const { blur } = quickMove("motionblur", 2, { motion, intensity: 10 });
    expect(blur[0][0]).toBe(0);
    expect(Math.max(...blur.map((key) => key[1]))).toBeGreaterThan(5);
    expect(blur.at(-1)[1]).toBe(0);
    const still = quickMove("motionblur", 1, { motion: { scale: [[0, 1], [1, 2]], rotation: [[0, 0], [1, 30]] } }).blur;
    expect(still.length).toBeLessThan(31);
  });

  it("escala, centralizar e casos sem suporte", () => {
    expect(quickMove("escala", 2, { intensity: 10 })).toEqual({ scale: [[0, 1, "ease"], [1, 1.12, "ease"], [2, 1]] });
    expect(quickMove("centralizar", 2, { clip: { x: 100, y: -50 } })).toEqual({
      x: [[0, 0, "ease"], [0.6, -100], [2, -100]],
      y: [[0, 0, "ease"], [0.6, 50], [2, 50]],
    });
    expect(quickMove("centralizar", 0.4, { target: { x: 1000, y: 500 } })).toEqual({
      x: [[0, 0, "ease"], [0.4, -40]],
      y: [[0, 0, "ease"], [0.4, 40]],
    });
    expect(quickMove("centralizar", 1, { clip: {} }).x[1]).toEqual([0.6, 0]);
    expect(quickMove("centralizar", 1)).toBeNull();
    expect(quickMove("speedramp", 2)).toBeNull();
    expect(quickMove("escala", 0)).toBeNull();
    expect(quickMove("escala", 2, { intensity: "x" }).scale[1][1]).toBe(1.06);
  });
});

describe("clonar estilo", () => {
  const source = {
    id: "s",
    start: 0,
    duration: 2,
    scale: 120,
    x: 10,
    y: 20,
    rotation: 3,
    opacity: 80,
    exposure: 5,
    contrast: 110,
    saturation: 90,
    temperature: 12,
    tint: -4,
    highlights: 1,
    shadows: 2,
    whites: 3,
    blacks: 4,
    motion: { scale: [[0, 1, "ease"], [2, 1.2]], note: "x" },
    effects: [{ id: "glow", amount: 3 }],
    look: { id: "vintage", intensity: 50 },
  };
  const targets = [
    { id: "a", start: 5, duration: 4, name: "A", anchorX: 5 },
    { id: "b", start: 9, duration: 1, text: "B", exposure: -10 },
    { id: "c", start: 10, duration: 2 },
  ];

  it("copia tudo com tempos proporcionais, sem compartilhar referências nem tocar em identidade", () => {
    const result = cloneStyle(source, targets);
    expect(result.map((clip) => clip.motion.scale.at(-1)[0])).toEqual([4, 1, 2]);
    expect(result[0]).toMatchObject({ id: "a", start: 5, duration: 4, name: "A", scale: 120, contrast: 110, look: { id: "vintage" } });
    expect(result[0]).not.toHaveProperty("anchorX");
    expect(result[1]).toMatchObject({ text: "B", exposure: 5 });
    expect(result[0].effects).not.toBe(source.effects);
    expect(result[0].effects).toEqual(source.effects);
    expect(result[0].motion.note).toBe("x");
    expect(targets[0]).not.toHaveProperty("scale");
  });

  it("modo absoluto, partes escolhidas e entradas inválidas", () => {
    expect(cloneStyle(source, targets, { timing: "absolute" })[0].motion.scale.at(-1)[0]).toBe(2);
    const onlyColor = cloneStyle(source, targets, { parts: ["color", "inexistente"] })[0];
    expect(onlyColor).toMatchObject({ exposure: 5, blacks: 4 });
    expect(onlyColor).not.toHaveProperty("motion");
    expect(cloneStyle({ ...source, duration: 0 }, targets)[0].motion.scale.at(-1)[0]).toBe(2);
    expect(cloneStyle(null, targets)).toBe(targets);
    expect(cloneStyle(source, null)).toEqual([]);
    expect(Object.keys(STYLE_PARTS)).toEqual(["transform", "opacity", "color", "motion", "effects", "look"]);
  });
});
