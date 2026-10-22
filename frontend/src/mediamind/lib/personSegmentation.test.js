import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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


// Exercises the entire cutout pipeline, including the model adapter and canvas
// composition. The WASM model itself is replaced, so these are regression tests,
// not a claim about segmentation quality for an arbitrary photograph.
const adapter = vi.hoisted(() => ({ resolve: vi.fn(), create: vi.fn() }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: adapter.resolve },
  ImageSegmenter: { createFromOptions: adapter.create },
}));

describe('local background removal pipeline', () => {
  let contexts;
  let model;
  beforeEach(() => {
    vi.resetModules();
    contexts = [];
    model = { segment: vi.fn((_image, callback) => callback({ confidenceMasks: [{ width: 2, height: 1, getAsFloat32Array: () => new Float32Array([0, 1]) }] })) };
    adapter.resolve.mockReset().mockResolvedValue({});
    adapter.create.mockReset().mockResolvedValue(model);
    vi.stubGlobal('Image', class {
      naturalWidth = 800; naturalHeight = 600;
      decode() { return Promise.resolve(); }
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:source');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      const context = { drawImage: vi.fn(), putImageData: vi.fn(), createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
      contexts.push(context); return context;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['cutout'], { type: 'image/png' })));
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No backend requests allowed'); }));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('loads local model assets, composes transparent PNG and never calls the API', async () => {
    const { removePersonBackground } = await import('./personSegmentation');
    const output = await removePersonBackground(new Blob(['photo'], { type: 'image/jpeg' }));
    expect(output.type).toBe('image/png');
    expect(adapter.resolve).toHaveBeenCalledWith('/vision/wasm');
    expect(adapter.create.mock.calls[0][1].baseOptions.modelAssetPath).toBe('/models/selfie_segmenter.tflite');
    expect([...contexts[1].putImageData.mock.calls[0][0].data]).toEqual([0, 0, 0, 0, 0, 0, 0, 255]);
    expect(contexts[0].drawImage).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source');
  });
  it('rejects a missing person instead of returning the original as a successful cutout', async () => {
    model.segment.mockImplementation((_image, cb) => cb({ confidenceMasks: [] }));
    const { removePersonBackground } = await import('./personSegmentation');
    await expect(removePersonBackground(new Blob(['photo']))).rejects.toThrow('identificar a pessoa');
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
  });
  it('allows another attempt after the model fails to initialize', async () => {
    adapter.create.mockRejectedValueOnce(new Error('model unavailable'));
    const { removePersonBackground } = await import('./personSegmentation');
    await expect(removePersonBackground(new Blob(['photo']))).rejects.toThrow('model unavailable');
    await expect(removePersonBackground(new Blob(['photo']))).resolves.toBeInstanceOf(Blob);
    expect(adapter.create).toHaveBeenCalledTimes(2);
  });
  it('reports failed PNG encoding and releases the original URL', async () => {
    HTMLCanvasElement.prototype.toBlob.mockImplementation(cb => cb(null));
    const { removePersonBackground } = await import('./personSegmentation');
    await expect(removePersonBackground(new Blob(['photo']))).rejects.toThrow('Falha ao criar PNG');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:source');
  });
});

describe("segmentPersonCanvas", () => {
  beforeEach(() => {
    vi.resetModules();
    adapter.resolve.mockReset().mockResolvedValue({});
  });

  it("devolve a máscara de pessoa do canvas (cópia dos valores do modelo)", async () => {
    const values = new Float32Array([0.1, 0.9]);
    adapter.create.mockReset().mockResolvedValue({ segment: vi.fn((_image, callback) => callback({ confidenceMasks: [{ width: 2, height: 1, getAsFloat32Array: () => values }] })) });
    const { segmentPersonCanvas } = await import("./personSegmentation");
    const result = await segmentPersonCanvas(document.createElement("canvas"));
    expect(result.width).toBe(2);
    expect([...result.values]).toEqual([...values]);
    expect(result.values).not.toBe(values);
  });

  it("usa a segunda máscara quando o modelo devolve categorias e explica falhas", async () => {
    adapter.create.mockReset().mockResolvedValue({ segment: vi.fn((_image, callback) => callback({ confidenceMasks: [{ width: 1, height: 1, getAsFloat32Array: () => new Float32Array([0]) }, { width: 1, height: 1, getAsFloat32Array: () => new Float32Array([1]) }] })) });
    let mod = await import("./personSegmentation");
    expect([...(await mod.segmentPersonCanvas(document.createElement("canvas"))).values]).toEqual([1]);

    vi.resetModules();
    adapter.create.mockReset().mockResolvedValue({ segment: vi.fn((_image, callback) => callback({})) });
    mod = await import("./personSegmentation");
    await expect(mod.segmentPersonCanvas(document.createElement("canvas"))).rejects.toThrow("Não foi possível remover o fundo. Não foi possível identificar a pessoa.");

    vi.resetModules();
    adapter.create.mockReset().mockRejectedValue({});
    mod = await import("./personSegmentation");
    await expect(mod.segmentPersonCanvas(document.createElement("canvas"))).rejects.toThrow("Verifique sua conexão");
  });
});
