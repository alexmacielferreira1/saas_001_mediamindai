import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unzipSync } from "fflate";
import PhotoCraftWorkspace from "./PhotoCraftWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";

// O modelo de IA (WASM) não roda no jsdom: a máscara é fornecida pelo teste; o resto do caminho é o real.
const segmentation = vi.hoisted(() => ({ segmentPersonCanvas: vi.fn() }));
vi.mock("../../lib/personSegmentation", () => segmentation);
const objects = vi.hoisted(() => ({ segmentObjectCanvas: vi.fn() }));
vi.mock("../../lib/objectSegmentation", () => objects);

const puts = [];
class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
  }
  _pixels() {
    const size = this.canvas.width * this.canvas.height * 4;
    if (!this.canvas._data || this.canvas._data.length !== size) this.canvas._data = new Uint8ClampedArray(size).fill(200);
    return this.canvas._data;
  }
  getImageData(x, y, w, h) {
    return { data: Uint8ClampedArray.from(this._pixels().subarray(0, w * h * 4)), width: w, height: h };
  }
  putImageData(image) {
    this._pixels().set(image.data);
    puts.push(Uint8ClampedArray.from(image.data));
  }
  createLinearGradient() {
    return { addColorStop() {} };
  }
  createRadialGradient() {
    return { addColorStop() {} };
  }
}
for (const method of ["save", "restore", "translate", "scale", "rotate", "beginPath", "closePath", "moveTo", "lineTo", "arc", "rect", "roundRect", "ellipse", "fill", "stroke", "clip", "clearRect", "fillRect", "fillText", "drawImage"]) {
  FakeContext.prototype[method] = () => {};
}

let downloads = [];
let blobs = [];
beforeEach(() => {
  localStorage.clear();
  puts.length = 0;
  downloads = [];
  blobs = [];
  segmentation.segmentPersonCanvas.mockReset();
  objects.segmentObjectCanvas.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function getContext() {
    if (!this._ctx) this._ctx = new FakeContext(this);
    return this._ctx;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => "data:image/png;base64,FUNDO");
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(callback, type) {
    callback(new Blob([new Uint8Array([this.width % 256, this.height % 256])], { type }));
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() {
    downloads.push(this.download);
  });
  URL.createObjectURL = vi.fn((blob) => {
    blobs.push(blob);
    return "blob:zip";
  });
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const props = { assets: [], selected: null, onSelect: () => {}, onOpenFiles: () => {} };
const status = () => screen.getAllByRole("status").map((node) => node.textContent).join(" | ");

describe("MMPhoto · remover fundo e exportar variações pelo MCP", () => {
  it("remove o fundo da pessoa com a máscara do modelo e desfaz", async () => {
    // Máscara 2×1: metade esquerda fundo (0), metade direita pessoa (1).
    segmentation.segmentPersonCanvas.mockResolvedValue({ width: 2, height: 1, values: new Float32Array([0, 1]) });
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    const result = await act(() => provider.apply("bg.person", {}));
    expect(result).toEqual({ ok: true, count: 1, summary: 'Remover fundo (pessoa, IA local) em "Pessoa recortada" · camada inteira' });
    expect(segmentation.segmentPersonCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement));
    const pixels = puts.at(-1);
    const alphas = [...pixels].filter((_, i) => i % 4 === 3);
    expect(alphas[0]).toBe(0);
    expect(alphas.at(-1)).toBe(200);
    expect(provider.canUndo()).toBe(true);
  });

  it("não altera nada quando o modelo não acha pessoa ou falha", async () => {
    segmentation.segmentPersonCanvas.mockResolvedValueOnce({ width: 2, height: 1, values: new Float32Array([0, 0.1]) });
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    expect(await act(() => provider.apply("bg.person", {}))).toEqual({ ok: false, summary: expect.stringMatching(/Nenhuma pessoa identificada/) });
    expect(puts).toHaveLength(0);

    segmentation.segmentPersonCanvas.mockRejectedValueOnce(new Error("Não foi possível remover o fundo. modelo indisponível"));
    expect(await act(() => provider.apply("bg.person", {}))).toEqual({ ok: false, summary: "Não foi possível remover o fundo. modelo indisponível" });

    // Máscara válida, mas o navegador não entrega os pixels: a operação falha e nada é gravado.
    segmentation.segmentPersonCanvas.mockResolvedValueOnce({ width: 1, height: 1, values: new Float32Array([1]) });
    HTMLCanvasElement.prototype.getContext.mockImplementation(() => null);
    expect(await act(() => provider.apply("bg.person", {}))).toEqual({ ok: false, summary: expect.stringMatching(/Não foi possível aplicar remover fundo/) });
  });

  it("recorta ou apaga o objeto sob o ponto com a máscara do modelo", async () => {
    objects.segmentObjectCanvas.mockResolvedValue({ width: 2, height: 1, values: new Float32Array([0, 1]) });
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    const keep = await act(() => provider.apply("bg.object", { x: 75, y: 50 }));
    expect(keep).toMatchObject({ ok: true, summary: 'Recortar objeto (fundo transparente) em "Pessoa recortada" · IA local · ponto 75% × 50%' });
    expect(objects.segmentObjectCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), { x: 0.75, y: 0.5 });
    let alphas = [...puts.at(-1)].filter((_, i) => i % 4 === 3);
    expect([alphas[0], alphas.at(-1)]).toEqual([0, 200]);

    expect((await act(() => provider.apply("bg.object", { keep: "background" }))).ok).toBe(true);
    alphas = [...puts.at(-1)].filter((_, i) => i % 4 === 3);
    expect(alphas.at(-1)).toBe(0);
  });

  it("não altera nada quando a IA não acha objeto no ponto ou falha", async () => {
    objects.segmentObjectCanvas.mockResolvedValueOnce({ width: 2, height: 1, values: new Float32Array([0, 0]) }).mockRejectedValueOnce(new Error("Não foi possível recortar o objeto. modelo indisponível"));
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    expect(await act(() => provider.apply("bg.object", {}))).toEqual({ ok: false, summary: expect.stringMatching(/não encontrou um objeto nesse ponto/) });
    expect(await act(() => provider.apply("bg.object", {}))).toEqual({ ok: false, summary: "Não foi possível recortar o objeto. modelo indisponível" });
    expect(puts).toHaveLength(0);
    // Máscara válida, mas o navegador não entrega os pixels: a operação falha e nada é gravado.
    objects.segmentObjectCanvas.mockResolvedValueOnce({ width: 1, height: 1, values: new Float32Array([1]) });
    HTMLCanvasElement.prototype.getContext.mockImplementation(() => null);
    expect(await act(() => provider.apply("bg.object", {}))).toEqual({ ok: false, summary: expect.stringMatching(/Não foi possível aplicar recortar objeto/) });
  });

  it("remove fundo liso de verdade e explica quando não há fundo de cor única", async () => {
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    // Camada inteira de uma cor só: tudo pareceria fundo, então nada muda.
    const result = await act(() => provider.apply("bg.flat", {}));
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/imagem inteira parece ser fundo/);
  });

  it("exporta um .zip com as variações sem alterar o documento nem o desfazer", async () => {
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    const preview = await act(() => provider.analyze("doc.export", { variants: ["original", "1:1"], format: "png", maxWidth: 600 }));
    expect(preview.summary).toBe("Prévia (nada foi alterado): 2 variação(ões) em PNG num arquivo .zip");
    expect(downloads).toEqual([]);

    const result = await act(() => provider.apply("doc.export", { variants: ["original", "1:1"], format: "png", maxWidth: 600 }));
    expect(result).toMatchObject({ ok: true, count: 2, details: ["original-600x400.png", "1x1-600x600.png"] });
    expect(downloads).toEqual(["mmphoto-documento-variacoes.zip"]);
    const zip = blobs.at(-1);
    expect(zip.type).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(files)).toEqual(["original-600x400.png", "1x1-600x600.png"]);
    expect([...files["1x1-600x600.png"]]).toEqual([600 % 256, 600 % 256]);
    expect(status()).toContain("Exportado mmphoto-documento-variacoes.zip com 2 arquivo(s).");
    expect(provider.canUndo()).toBe(false);
    expect(screen.getByText("Doc: 1200 × 800 px")).toBeInTheDocument();
  });

  it("explica a falha quando o navegador não gera a imagem", async () => {
    HTMLCanvasElement.prototype.toBlob.mockImplementation((callback) => callback(null));
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    expect(await act(() => provider.apply("doc.export", {}))).toEqual({ ok: false, summary: "Falha ao exportar variações: O navegador não gerou o arquivo de imagem." });

    HTMLCanvasElement.prototype.toBlob.mockImplementation(() => {
      throw Object.assign(new Error("tainted"), { name: "SecurityError" });
    });
    expect(await act(() => provider.apply("doc.export", {}))).toEqual({ ok: false, summary: "O navegador bloqueou a exportação porque a imagem vem de outra origem." });
  });
});
