import { beforeEach, describe, expect, it, vi } from "vitest";

// O WASM do modelo não roda no jsdom: o adaptador do MediaPipe é substituído; o resto do caminho é o real.
const adapter = vi.hoisted(() => ({ resolve: vi.fn(), create: vi.fn() }));
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: adapter.resolve },
  InteractiveSegmenter: { createFromOptions: adapter.create },
}));

describe("segmentObjectCanvas", () => {
  beforeEach(() => {
    vi.resetModules();
    adapter.resolve.mockReset().mockResolvedValue({ files: true });
  });

  it("carrega o modelo local e devolve a máscara do objeto no ponto", async () => {
    const values = new Float32Array([0, 1]);
    const segment = vi.fn((_image, roi, callback) => callback({ confidenceMasks: [{ width: 2, height: 1, getAsFloat32Array: () => values }] }));
    adapter.create.mockReset().mockResolvedValue({ segment });
    const { segmentObjectCanvas } = await import("./objectSegmentation");
    const canvas = document.createElement("canvas");
    const mask = await segmentObjectCanvas(canvas, { x: 0.25, y: 0.75 });
    expect(adapter.resolve).toHaveBeenCalledWith("/vision/wasm");
    expect(adapter.create).toHaveBeenCalledWith({ files: true }, expect.objectContaining({ baseOptions: { modelAssetPath: "/models/magic_touch.tflite" }, outputConfidenceMasks: true }));
    expect(segment).toHaveBeenCalledWith(canvas, { keypoint: { x: 0.25, y: 0.75 } }, expect.any(Function));
    expect([...mask.values]).toEqual([0, 1]);
    expect(mask.values).not.toBe(values);
    // O modelo é carregado uma vez só.
    await segmentObjectCanvas(canvas, { x: 0, y: 0 });
    expect(adapter.create).toHaveBeenCalledTimes(1);
  });

  it("explica quando o modelo não devolve máscara ou não carrega (e tenta carregar de novo depois)", async () => {
    adapter.create.mockReset().mockResolvedValue({ segment: vi.fn((_image, _roi, callback) => callback({})) });
    let mod = await import("./objectSegmentation");
    await expect(mod.segmentObjectCanvas(document.createElement("canvas"), { x: 0, y: 0 })).rejects.toThrow("Não foi possível recortar o objeto. O modelo não devolveu a máscara do objeto.");

    vi.resetModules();
    adapter.create.mockReset().mockRejectedValueOnce({}).mockResolvedValue({ segment: vi.fn((_image, _roi, callback) => callback({ confidenceMasks: [{ width: 1, height: 1, getAsFloat32Array: () => [1] }] })) });
    mod = await import("./objectSegmentation");
    await expect(mod.segmentObjectCanvas(document.createElement("canvas"), { x: 0, y: 0 })).rejects.toThrow("Verifique sua conexão");
    expect((await mod.segmentObjectCanvas(document.createElement("canvas"), { x: 0, y: 0 })).width).toBe(1);
  });
});
