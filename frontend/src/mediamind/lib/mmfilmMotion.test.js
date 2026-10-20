import { describe, expect, it } from "vitest";
import { animatedClip, autoZoomPlan, motionPreset, seeded } from "./mmfilmMotion";

describe("clipe animado", () => {
  it("sem movimento devolve o mesmo objeto", () => {
    const clip = { id: "a", start: 0, duration: 2 };
    expect(animatedClip(clip, 1)).toBe(clip);
    expect(animatedClip(null, 1)).toBeNull();
  });

  it("aplica as curvas sobre os valores do clipe no tempo local", () => {
    const clip = {
      start: 10,
      duration: 2,
      x: 5,
      motion: { scale: [[0, 1], [2, 2]], x: [[0, 0], [2, 100]], y: [[0, -10], [2, 10]], rotation: [[0, 0], [2, 4]] },
    };
    expect(animatedClip(clip, 11)).toMatchObject({ scale: 150, x: 55, y: 0, rotation: 2 });
    expect(animatedClip({ ...clip, scale: 50, y: 3, rotation: 1 }, 11)).toMatchObject({ scale: 75, y: 3, rotation: 3 });
  });

  it("prende o tempo local entre 0 e a duração e usa valores neutros sem curva", () => {
    const clip = { start: 10, duration: 2, motion: { scale: [[0, 1], [2, 2]] } };
    expect(animatedClip(clip, 5)).toMatchObject({ scale: 100, x: 0, y: 0, rotation: 0 });
    expect(animatedClip(clip, 50).scale).toBe(200);
  });
});

describe("variação determinística", () => {
  it("mesma entrada, mesmo valor, sempre em [0, 1)", () => {
    expect(seeded(3, 1)).toBe(seeded(3, 1));
    expect(seeded(3)).toBe(seeded(3, 0));
    expect(seeded(3, 1)).not.toBe(seeded(3, 2));
    for (let index = 0; index < 50; index += 1) {
      expect(seeded(index)).toBeGreaterThanOrEqual(0);
      expect(seeded(index)).toBeLessThan(1);
    }
  });
});

describe("movimentos rápidos", () => {
  it("punch in segura o take inteiro; punch out volta ao normal no meio", () => {
    expect(motionPreset("punch", 2)).toEqual({ scale: [[0, 1.15, "hold"], [2, 1.15]] });
    expect(motionPreset("punch", 2, { direction: "out" })).toEqual({ scale: [[0, 1.15, "hold"], [1, 1, "hold"], [2, 1]] });
  });

  it("zoom suave aproxima ou afasta, com intensidade limitada a 1–10", () => {
    expect(motionPreset("zoom", 3)).toEqual({ scale: [[0, 1, "ease"], [3, 1.1]] });
    expect(motionPreset("zoom", 3, { direction: "out", intensity: 99 })).toEqual({ scale: [[0, 1.2, "ease"], [3, 1]] });
    expect(motionPreset("zoom", 3, { intensity: -5 })).toEqual({ scale: [[0, 1, "ease"], [3, 1.02]] });
    expect(motionPreset("zoom", 3, { intensity: "x" })).toEqual(motionPreset("zoom", 3));
  });

  it("shake dura no máximo 0,5 s, diminui até parar e é determinístico pela semente", () => {
    const shake = motionPreset("shake", 4, { seed: 2 });
    expect(shake.x).toHaveLength(16);
    expect(shake.x.at(-1).map((value) => value + 0)).toEqual([0.5, 0]);
    expect(shake.y.at(-1).map((value) => value + 0)).toEqual([0.5, 0]);
    expect(shake.rotation.at(-1).map((value) => value + 0)).toEqual([0.5, 0]);
    expect(shake.scale).toEqual([[0, 1.04], [4, 1.04]]);
    expect(motionPreset("shake", 4, { seed: 2 })).toEqual(shake);
    expect(motionPreset("shake", 4, { seed: 3 }).x).not.toEqual(shake.x);
    expect(motionPreset("shake", 0.05).x).toHaveLength(3);
  });

  it("pan para a direita ou esquerda e rotação, com leve aproximação", () => {
    expect(motionPreset("pan", 2)).toEqual({ x: [[0, -60, "ease"], [2, 60]], scale: [[0, 1.08], [2, 1.08]] });
    expect(motionPreset("pan", 2, { direction: "left" }).x).toEqual([[0, 60, "ease"], [2, -60]]);
    expect(motionPreset("rotate", 2)).toEqual({ rotation: [[0, -3, "ease"], [2, 3]], scale: [[0, 1.08], [2, 1.08]] });
  });

  it("tipo desconhecido não tem movimento", () => {
    expect(motionPreset("girar", 2)).toBeNull();
  });
});

describe("zoom automático", () => {
  const takes = (count, duration = 2) => Array.from({ length: count }, (_, index) => ({ id: `t${index}`, duration }));

  it("médio: um a cada 3 takes, nunca seguidos, e o terceiro zoom afasta", () => {
    const plan = autoZoomPlan(takes(12));
    expect(plan.map((item) => item.id)).toEqual(["t2", "t5", "t8", "t11"]);
    expect(plan.map((item) => item.kind)).toEqual(["aproximar", "aproximar", "afastar", "aproximar"]);
    const [first] = plan;
    expect(first.motion.scale[0]).toEqual([0, 1, "ease"]);
    expect(first.motion.scale[1][0]).toBe(0.7);
    expect(first.motion.scale[1][1]).toBeGreaterThanOrEqual(1.08);
    expect(first.motion.scale[1][1]).toBeLessThanOrEqual(1.13);
    expect(first.motion.scale[2]).toEqual([2, first.motion.scale[1][1]]);
    const out = plan[2].motion.scale;
    expect(out[0][2]).toBe("ease");
    expect(out[1]).toEqual([0.7, 1]);
    expect(out[2]).toEqual([2, 1]);
  });

  it("quantidade poucos/muitos e sem alternar para afastar", () => {
    expect(autoZoomPlan(takes(8), { amount: "poucos" }).map((item) => item.id)).toEqual(["t3", "t7"]);
    expect(autoZoomPlan(takes(6), { amount: "muitos" }).map((item) => item.id)).toEqual(["t1", "t3", "t5"]);
    expect(autoZoomPlan(takes(6), { amount: "outro" }).map((item) => item.id)).toEqual(["t2", "t5"]);
    expect(autoZoomPlan(takes(12), { zoomOut: false }).every((item) => item.kind === "aproximar")).toBe(true);
  });

  it("estilos: rápido com rampa curta e degrau final; suave ao longo do take; desconhecido = médio", () => {
    const fast = autoZoomPlan(takes(3), { style: "rapido" })[0].motion.scale;
    expect(fast).toHaveLength(3);
    expect(fast[1][0]).toBe(0.25);
    expect(fast[1][1]).toBeGreaterThanOrEqual(1.12);
    const smooth = autoZoomPlan(takes(3), { style: "suave" })[0].motion.scale;
    expect(smooth).toHaveLength(2);
    expect(smooth[1][0]).toBe(2);
    expect(autoZoomPlan(takes(3), { style: "x" })).toEqual(autoZoomPlan(takes(3)));
  });

  it("pula takes menores que 1 s e limita a rampa à metade do take", () => {
    expect(autoZoomPlan([...takes(2), { id: "curto", duration: 0.5 }])).toEqual([]);
    const plan = autoZoomPlan(takes(3, 1));
    expect(plan[0].motion.scale.map(([time]) => time)).toEqual([0, 0.5, 1]);
  });
});
