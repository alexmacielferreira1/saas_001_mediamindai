import { describe, expect, it } from "vitest";
import { baseNode, createDocument } from "./FigCraftWorkspace";
import { nothingChanged, pixelsVisiblyChanged, sameData } from "./mcpToolGuards";
import { runMMDesignTool } from "./mmdesignMcpTools";
import { runMMFigTool } from "./mmfigMcpTools";
import { runMMLightTool } from "./mmlightMcpTools";
import { runMMPhotoTool } from "./mmphotoMcpTools";
import { runMMVectorTool } from "./mmvectorMcpTools";

describe("proteções comuns", () => {
  it("sameData compara dados sem depender da ordem das chaves e trata undefined como ausente", () => {
    expect(sameData({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameData({ a: 1, style: undefined }, { a: 1 })).toBe(true);
    expect(sameData({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameData([1, 2], [1, 2, 3])).toBe(false);
    expect(sameData([1], { 0: 1 })).toBe(false);
    expect(sameData(new Uint8ClampedArray([1, 2]), new Uint8ClampedArray([1, 2]))).toBe(true);
    expect(sameData(new Uint8ClampedArray([1, 2]), new Uint8ClampedArray([1, 3]))).toBe(false);
    expect(sameData(new Uint8ClampedArray([1]), [1])).toBe(false);
    expect(sameData(null, {})).toBe(false);
    expect(sameData("a", "a")).toBe(true);
  });

  it("nothingChanged explica a recusa com o nome da ferramenta", () => {
    expect(nothingChanged("Opacidade")).toEqual({ ok: false, summary: "Opacidade: nada a alterar, o resultado seria igual ao estado atual." });
  });

  it("pixelsVisiblyChanged ignora mudanças de cor em pixels transparentes", () => {
    const before = new Uint8ClampedArray([10, 10, 10, 0, 50, 50, 50, 255]);
    expect(pixelsVisiblyChanged(before, new Uint8ClampedArray([99, 99, 99, 0, 50, 50, 50, 255]))).toBe(false);
    expect(pixelsVisiblyChanged(before, new Uint8ClampedArray([10, 10, 10, 0, 51, 50, 50, 255]))).toBe(true);
    expect(pixelsVisiblyChanged(before, new Uint8ClampedArray([10, 10, 10, 40, 50, 50, 50, 255]))).toBe(true);
    expect(pixelsVisiblyChanged(before, new Uint8ClampedArray([10, 10, 10, 0, 50, 50, 50, 200]))).toBe(true);
  });
});

// Regressões encontradas pela varredura (photo-light-vector-design-fig.mcpsweep.test.js): ok:true sem alterar nada.
describe("sem sucesso falso nos catálogos", () => {
  const photoLayer = (id, extra = {}) => ({ id, name: id, visible: true, opacity: 100, blendMode: "normal", transform: { x: 0, y: 0, scale: 100, rotation: 0 }, ...extra });
  const photo = (extra = {}) => ({ layers: [photoLayer("foto", { type: "raster", bitmap: "x" })], activeLayer: "foto", docSize: { w: 100, h: 80 }, selection: null, colors: { fg: "#000000", bg: "#ffffff" }, ...extra });

  it("MMPhoto: opacidade/mesclagem iguais às atuais, recorte do documento inteiro e pixels sem mudança visível", () => {
    const same = "nada a alterar, o resultado seria igual ao estado atual.";
    expect(runMMPhotoTool("layer.opacity", photo(), { opacity: 100 }).summary).toBe(`Opacidade: ${same}`);
    expect(runMMPhotoTool("layer.opacity", photo(), { opacity: 40 }).ok).toBe(true);
    expect(runMMPhotoTool("layer.blend", photo(), { mode: "normal" })).toEqual({ ok: false, summary: `Mesclagem: ${same}` });
    expect(runMMPhotoTool("doc.crop", photo({ selection: { type: "rect", rect: { x: -5, y: -5, w: 200, h: 200 } } }))).toEqual({ ok: false, summary: "A seleção cobre o documento inteiro: não há o que recortar." });
    const transparent = new Uint8ClampedArray(4 * 4);
    expect(() => runMMPhotoTool("filter.noise", photo()).pixels(transparent, 2, 2)).toThrow("nada mudou nos pixels");
    const blocks = new Uint8ClampedArray([9, 9, 9, 255, 9, 9, 9, 255]);
    expect(() => runMMPhotoTool("filter.pixelate", photo(), { size: 2 }).pixels(blocks, 2, 1)).toThrow("nada mudou nos pixels");
  });

  it("MMLight: repetir avaliação, look ou máscara não finge sucesso", () => {
    const state = { sourceId: "a", sourceName: "A.jpg", photos: { a: { rating: 5 } }, albums: {}, pickedIds: [] };
    expect(runMMLightTool("catalog.rate", state, { stars: 5 })).toEqual({ ok: false, summary: "Avaliar: nada a alterar, o resultado seria igual ao estado atual." });
    const look = runMMLightTool("color.look", state);
    expect(look.ok).toBe(true);
    expect(runMMLightTool("color.look", { ...state, photos: look.photos }).ok).toBe(false);
  });

  it("MMVector: objeto já na frente ou já alinhado é recusado", () => {
    const objects = [{ id: "a", name: "a", x: 0, y: 0, w: 10, h: 10, color: "#ff0000" }, { id: "b", name: "b", x: 0, y: 20, w: 10, h: 10, color: "#00ff00" }];
    expect(runMMVectorTool("arrange.front", { objects, selectedIds: ["a"] })).toEqual({ ok: false, summary: "Para frente: nada a alterar, o resultado seria igual ao estado atual." });
    expect(runMMVectorTool("align.left", { objects, selectedIds: ["a", "b"] }).ok).toBe(false);
    expect(runMMVectorTool("arrange.front", { objects, selectedIds: ["b"] }).ok).toBe(true);
  });

  it("MMDesign: quadro já centralizado ou mesmo tamanho de texto é recusado", () => {
    const doc = { pageCount: 2, frames: { 1: [{ id: "t", type: "text", x: 65, y: 10, w: 80, h: 20, text: "A", size: 18 }] } };
    expect(runMMDesignTool("layout.centerX", { doc, selectedId: "t", pageKey: "1" })).toEqual({ ok: false, summary: "Centro H: nada a alterar, o resultado seria igual ao estado atual." });
    expect(runMMDesignTool("text.size", { doc, selectedId: "t", pageKey: "1" }, { size: 18 }).ok).toBe(false);
    expect(runMMDesignTool("layout.centerY", { doc, selectedId: "t", pageKey: "1" }).ok).toBe(true);
  });

  it("MMFig: alinhar o que já está alinhado é recusado; exportar continua planejando", () => {
    const doc = createDocument();
    const pageId = doc.pages[0].id;
    const a = baseNode("rect", { x: 0, y: 0 });
    const b = baseNode("rect", { x: 0, y: 200 });
    for (const node of [a, b]) {
      doc.nodes[node.id] = node;
      doc.roots[pageId].push(node.id);
    }
    const state = { doc, pageId, selection: [a.id, b.id] };
    expect(runMMFigTool("align.edges", state, { edge: "left" })).toEqual({ ok: false, summary: "Alinhar: nada a alterar, o resultado seria igual ao estado atual." });
    expect(runMMFigTool("align.edges", state, { edge: "top" }).ok).toBe(true);
    expect(runMMFigTool("export.file", state).exportJob.ids).toEqual([a.id, b.id]);
  });
});
