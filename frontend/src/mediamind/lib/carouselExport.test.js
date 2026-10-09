import { beforeEach, describe, expect, it, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
vi.mock("html2canvas", () => ({ default: vi.fn() }));
import html2canvas from "html2canvas";
import { buildCarouselZip } from "./carouselExport";
describe("local carousel export", () => {
  beforeEach(() => {
    html2canvas.mockResolvedValue({
      toBlob: (fn) => fn(new Blob(["png"], { type: "image/png" })),
    });
  });
  it("exports all slides with a consistent 1080px render scale and the editable document", async () => {
    const doc = {
      format: "4:5",
      slides: [
        { id: "one", type: "cover", title: "Capa" },
        { id: "two", type: "content", title: "Conteúdo" },
      ],
    };
    const elements = [{ offsetWidth: 432 }, { offsetWidth: 432 }];
    const blob = await buildCarouselZip(doc, elements);
    expect(html2canvas).toHaveBeenCalledWith(
      elements[0],
      expect.objectContaining({ scale: 2.5 }),
    );
    const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(archive).filter((k) => k.endsWith(".png"))).toHaveLength(
      2,
    );
    expect(JSON.parse(strFromU8(archive["carrossel.json"]))).toEqual(doc);
  });
  it("refuses an incomplete export rather than silently omitting slides", async () => {
    await expect(buildCarouselZip({ slides: [{}, {}] }, [{}])).rejects.toThrow(
      "Todos os slides",
    );
  });
});
