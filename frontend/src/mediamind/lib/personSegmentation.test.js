import { describe, expect, it } from "vitest";
import { applyPersonMask } from "./personSegmentation";
describe("person mask alpha", () => {
  it("removes background and preserves both RGB and source transparency", () => {
    const pixels = new Uint8ClampedArray([
      10, 20, 30, 255, 40, 50, 60, 128, 70, 80, 90, 255,
    ]);
    const result = applyPersonMask(pixels, new Float32Array([0, 1, 0.5]));
    expect([...result]).toEqual([
      10, 20, 30, 0, 40, 50, 60, 128, 70, 80, 90, 128,
    ]);
  });
  it("clamps probability outside the expected range", () => {
    expect([
      ...applyPersonMask(
        new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]),
        [-1, 2],
      ),
    ]).toEqual([1, 2, 3, 0, 4, 5, 6, 255]);
  });
});
