import { describe, expect, it } from "vitest";
import { getSocialFormat, SOCIAL_FORMATS } from "./socialFormats";

describe("social network format presets", () => {
  it("covers the common feed, vertical, landscape and professional network exports", () => {
    expect(SOCIAL_FORMATS.map((item) => item.id)).toEqual([
      "4:5",
      "1:1",
      "9:16",
      "16:9",
      "1.91:1",
      "3:2",
    ]);
    expect(getSocialFormat("4:5")).toMatchObject({ width: 1080, height: 1350 });
    expect(getSocialFormat("9:16")).toMatchObject({ width: 1080, height: 1920 });
    expect(getSocialFormat("16:9")).toMatchObject({ width: 1920, height: 1080 });
    expect(getSocialFormat("1.91:1")).toMatchObject({ width: 1200, height: 628 });
    expect(getSocialFormat("3:2")).toMatchObject({ width: 1200, height: 800 });
  });

  it("falls back safely to the Instagram portrait preset", () => {
    expect(getSocialFormat("unknown").id).toBe("4:5");
  });
});
