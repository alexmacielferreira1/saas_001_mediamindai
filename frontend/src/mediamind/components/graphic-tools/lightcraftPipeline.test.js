import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADJUST,
  MASK_SIZE,
  autoAdjust,
  developImageData,
  maskWeight,
  paintBrush,
} from "./lightcraftPipeline";

function image(width, height, fill) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const [r, g, b] = fill(i % width, Math.floor(i / width));
    data.set([r, g, b, 255], i * 4);
  }
  return { width, height, data };
}
const gray = (v) => image(4, 4, () => [v, v, v]);
const develop = (img, change, options) =>
  developImageData(img, { ...DEFAULT_ADJUST, ...change }, options).data;

describe("lightcraft develop pipeline", () => {
  it("keeps pixels unchanged with neutral settings", () => {
    const src = image(3, 3, (x, y) => [x * 80, y * 90, 120]);
    const before = [...src.data];
    expect([...develop(src, {})]).toEqual(before);
  });

  it("realces darken only bright tones; sombras lift only dark tones", () => {
    expect(develop(gray(230), { realces: -100 })[0]).toBeLessThan(230);
    expect(develop(gray(20), { realces: -100 })[0]).toBe(20);
    expect(develop(gray(30), { sombras: 100 })[0]).toBeGreaterThan(30);
    expect(develop(gray(240), { sombras: 100 })[0]).toBe(240);
  });

  it("brancos and pretos move the extremes", () => {
    expect(develop(gray(220), { brancos: 100 })[0]).toBeGreaterThan(220);
    expect(develop(gray(25), { pretos: -100 })[0]).toBeLessThan(25);
    expect(develop(gray(128), { brancos: 100 })[0]).toBe(128);
  });

  it("claridade and textura increase local contrast around edges", () => {
    const edge = () => image(40, 40, (x) => (x < 20 ? [90, 90, 90] : [160, 160, 160]));
    const plain = develop(edge(), {});
    const textured = develop(edge(), { textura: 100 });
    const clear = develop(edge(), { claridade: 100 });
    const at = (data, x) => data[(20 * 40 + x) * 4];
    expect(at(textured, 19)).toBeLessThan(at(plain, 19));
    expect(at(textured, 20)).toBeGreaterThan(at(plain, 20));
    expect(at(clear, 18)).toBeLessThan(at(plain, 18));
    expect(at(clear, 21)).toBeGreaterThan(at(plain, 21));
  });

  it("exposure, contrast, saturation and monochrome profile", () => {
    expect(develop(gray(100), { exposição: 50 })[0]).toBeGreaterThan(100);
    expect(develop(gray(60), { contraste: 50 })[0]).toBeLessThan(60);
    const red = () => image(1, 1, () => [200, 80, 80]);
    const out = develop(red(), { saturação: -100 });
    expect(out[0]).toBe(out[1]);
    const mono = develop(red(), {}, { profile: "Monocromático" });
    expect(mono[0]).toBe(mono[2]);
  });

  it("applies mask adjustments only where the mask has weight", () => {
    const masks = [{ type: "linear", adjust: { ...DEFAULT_ADJUST, exposição: 80 } }];
    const out = develop(image(1, 10, () => [100, 100, 100]), {}, { masks });
    expect(out[0]).toBeGreaterThan(100);
    expect(out[9 * 4]).toBe(100);
    expect(maskWeight({ type: "radial" }, 0.5, 0.5)).toBe(1);
    expect(maskWeight({ type: "radial" }, 0, 0)).toBe(0);
  });

  it("paints a brush mask grid", () => {
    const grid = paintBrush([], 0.5, 0.5);
    expect(grid).toHaveLength(MASK_SIZE * MASK_SIZE);
    expect(maskWeight({ type: "brush", grid }, 0.5, 0.5)).toBeGreaterThan(0);
    expect(maskWeight({ type: "brush", grid }, 0.02, 0.02)).toBe(0);
  });

  it("auto adjust brightens a dark image", () => {
    expect(autoAdjust(gray(30)).exposição).toBeGreaterThan(0);
    expect(autoAdjust(gray(230)).exposição).toBeLessThan(0);
  });
});
