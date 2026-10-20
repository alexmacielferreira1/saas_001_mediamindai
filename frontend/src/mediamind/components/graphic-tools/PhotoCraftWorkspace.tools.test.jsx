import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PhotoCraftWorkspace, {
  ADJUSTMENT_PRESETS,
  applyFilterOps,
  boxBlur,
  clampRect,
  filterOpsToCss,
  flattenOrder,
  floodSelect,
  layerType,
  mixByCoverage,
  normalizeRect,
  pixelate,
  pointInPolygon,
  renderDocument,
  selectionCoverage,
  toLayerPoint,
  toneLut,
} from "./PhotoCraftWorkspace";

// ---- canvas 2D mínimo para jsdom (sem pixels reais de desenho) ----
const log = [];
class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
    this._state = {};
  }
  _pixels() {
    const size = this.canvas.width * this.canvas.height * 4;
    if (!this.canvas._data || this.canvas._data.length !== size) this.canvas._data = new Uint8ClampedArray(size);
    return this.canvas._data;
  }
  getImageData(x, y, w, h) {
    const src = this._pixels();
    const data = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row += 1) data.set(src.subarray(((y + row) * this.canvas.width + x) * 4, ((y + row) * this.canvas.width + x + w) * 4), row * w * 4);
    return { data, width: w, height: h };
  }
  putImageData(image) {
    this._pixels().set(image.data);
    log.push(["putImageData", this.canvas]);
  }
  createLinearGradient() {
    return { addColorStop() {} };
  }
  createRadialGradient() {
    return { addColorStop() {} };
  }
}
for (const method of ["save", "restore", "translate", "scale", "rotate", "beginPath", "closePath", "moveTo", "lineTo", "arc", "rect", "roundRect", "ellipse", "fill", "stroke", "clip", "clearRect", "fillRect", "fillText", "drawImage"]) {
  FakeContext.prototype[method] = function record(...args) {
    log.push([method, this.canvas, args, { ...this._state }]);
  };
}
for (const prop of ["globalAlpha", "globalCompositeOperation", "fillStyle", "strokeStyle", "lineWidth", "lineCap", "lineJoin", "font", "textAlign", "textBaseline", "shadowColor", "shadowBlur", "shadowOffsetY", "imageSmoothingQuality"]) {
  Object.defineProperty(FakeContext.prototype, prop, {
    get() {
      return this._state[prop];
    },
    set(value) {
      this._state[prop] = value;
    },
  });
}

let dataUrlCounter = 0;
let createdBlobs = [];
let downloads = [];

beforeEach(() => {
  log.length = 0;
  createdBlobs = [];
  downloads = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function getContext() {
    if (!this._ctx) this._ctx = new FakeContext(this);
    return this._ctx;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => `data:image/png;base64,TEST${(dataUrlCounter += 1)}`);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(callback, type = "image/png") {
    callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type }));
  });
  URL.createObjectURL = vi.fn((blob) => {
    createdBlobs.push(blob);
    return `blob:mmphoto-${createdBlobs.length}`;
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() {
    downloads.push(this.download);
  });
});

afterEach(() => {
  delete URL.createObjectURL;
  delete URL.revokeObjectURL;
});

function renderPhoto() {
  return render(<PhotoCraftWorkspace assets={[]} selected={null} onSelect={() => {}} onOpenFiles={() => {}} />);
}

function stageRect() {
  vi.spyOn(screen.getByTestId("mmphoto-stage"), "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 });
}

function menu(item, command) {
  fireEvent.click(screen.getByRole("button", { name: item }));
  fireEvent.click(screen.getAllByRole("button", { name: command }).at(-1));
}

const doc = () => screen.getByLabelText("Documento do MMPhoto");

describe("MMPhoto — funções puras", () => {
  it("aplica filtros CSS em pixels conforme a especificação", () => {
    const gray = applyFilterOps(new Uint8ClampedArray([255, 0, 0, 255]), [["grayscale", 1]]);
    expect(gray[0]).toBe(gray[1]);
    expect(gray[0]).toBe(54);
    expect([...applyFilterOps(new Uint8ClampedArray([10, 20, 30, 255]), [["invert", 1]])]).toEqual([245, 235, 225, 255]);
    expect([...applyFilterOps(new Uint8ClampedArray([100, 100, 100, 255]), [["brightness", 1.5]])]).toEqual([150, 150, 150, 255]);
    expect(filterOpsToCss(ADJUSTMENT_PRESETS["Matiz/Sat."])).toBe("hue-rotate(30deg) saturate(1.2)");
    expect(Object.keys(ADJUSTMENT_PRESETS)).toHaveLength(12);
  });

  it("calcula cobertura de seleção retangular, poligonal e por máscara", () => {
    const rect = selectionCoverage({ type: "rect", rect: { x: 1, y: 1, w: 2, h: 1 } }, 4, 3);
    expect([...rect]).toEqual([0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 0]);
    const poly = selectionCoverage({ type: "polygon", points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }] }, 4, 3);
    expect(poly.filter(Boolean)).toHaveLength(8);
    const mask = selectionCoverage({ type: "mask", spans: [[2, 0, 2]] }, 4, 3);
    expect([...mask.slice(8)]).toEqual([255, 255, 0, 0]);
    expect(selectionCoverage(null, 2, 1).every((v) => v === 255)).toBe(true);
    expect(pointInPolygon({ x: 1, y: 1 }, [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }])).toBe(true);
    expect(normalizeRect({ x: 5, y: 8 }, { x: 1, y: 2 })).toEqual({ x: 1, y: 2, w: 4, h: 6 });
    expect(clampRect({ x: -5, y: 2, w: 20, h: 3 }, 10, 4)).toEqual({ x: 0, y: 2, w: 10, h: 2 });
  });

  it("seleciona região contígua por tolerância (Seleção rápida)", () => {
    const data = new Uint8ClampedArray(3 * 2 * 4);
    for (let p = 0; p < 6; p += 1) data.set(p === 2 || p === 5 ? [255, 255, 255, 255] : [0, 0, 0, 255], p * 4);
    const sel = floodSelect(data, 3, 2, 0, 0, 10);
    expect(sel.spans).toEqual([[0, 0, 2], [1, 0, 2]]);
    expect(sel.bounds).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(floodSelect(data, 3, 2, 9, 9)).toBeNull();
  });

  it("mapeia o ponto do documento para a camada transformada (inverso)", () => {
    const transform = { x: 100, y: 0, scale: 200, rotation: 90 };
    const p = toLayerPoint({ x: 600, y: 420 }, transform, 1000, 800);
    expect(p.x).toBeCloseTo(510);
    expect(p.y).toBeCloseTo(400);
    expect(toLayerPoint({ x: 3, y: 4 }, undefined, 10, 10)).toEqual({ x: 3, y: 4 });
  });

  it("ordena camadas da base para o topo e mistura pela seleção", () => {
    const layers = [{ id: "top", visible: true }, { id: "hidden", visible: false }, { id: "bottom", visible: true }];
    expect(flattenOrder(layers).map((l) => l.id)).toEqual(["bottom", "top"]);
    const target = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0]);
    mixByCoverage(target, new Uint8ClampedArray([9, 9, 9, 9, 9, 9, 9, 9]), new Uint8Array([255, 0]));
    expect([...target]).toEqual([9, 9, 9, 9, 0, 0, 0, 0]);
    expect(layerType({ id: "adjust" })).toBe("adjustment");
    expect(layerType({ kind: "T" })).toBe("text");
  });

  it("desfoque preserva área uniforme, pixelização faz média por bloco e curva neutra é identidade", () => {
    const flat = new Uint8ClampedArray(4 * 4 * 4).fill(80);
    expect([...boxBlur(flat, 4, 4, 2)].every((v) => Math.round(v) === 80)).toBe(true);
    const px = pixelate(new Uint8ClampedArray([0, 0, 0, 0, 100, 100, 100, 100]), 2, 1, 2);
    expect([...px]).toEqual([50, 50, 50, 50, 50, 50, 50, 50]);
    const lut = toneLut({});
    expect(lut.r[37]).toBe(37);
    expect(toneLut({ temperature: 100 }).r[100]).toBeGreaterThan(100);
  });

  it("achata respeitando ordem, opacidade e modo de mesclagem", () => {
    const surface = document.createElement("canvas");
    surface.width = 4;
    surface.height = 4;
    const canvas = renderDocument({
      docSize: { w: 4, h: 4 },
      layers: [
        { id: "top", type: "raster", bitmap: "x", visible: true, opacity: 50, blendMode: "multiply", transform: { x: 0, y: 0, scale: 100, rotation: 0 } },
        { id: "background", visible: true, opacity: 100, blendMode: "normal", transform: { x: 0, y: 0, scale: 100, rotation: 0 } },
      ],
      getSurface: (key) => (key === "top" ? surface : null),
    });
    const draws = log.filter(([method, target]) => method === "drawImage" && target === canvas);
    expect(draws).toHaveLength(2);
    expect(draws[0][3].globalCompositeOperation).toBe("source-over");
    expect(draws[1][3]).toMatchObject({ globalCompositeOperation: "multiply", globalAlpha: 0.5 });
  });
});

describe("MMPhoto — controles", () => {
  it("Exportar PNG gera um PNG real a partir das camadas (sem texto)", async () => {
    renderPhoto();
    menu("Arquivo", "Exportar PNG");
    await waitFor(() => expect(downloads).toEqual(["mmphoto-documento.png"]));
    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0].type).toBe("image/png");
    expect(await createdBlobs[0].text()).not.toContain("MMPhoto export");
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", undefined);
    expect(screen.getByRole("status")).toHaveTextContent("Exportado mmphoto-documento.png (1200 × 800 px)");
  });

  it("Exportar como permite JPG", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("jpg");
    renderPhoto();
    fireEvent.click(screen.getByRole("button", { name: "Exportar como" }));
    await waitFor(() => expect(downloads).toEqual(["mmphoto-documento.jpg"]));
    expect(createdBlobs[0].type).toBe("image/jpeg");
  });

  it("Pincel pinta traço que segue o arraste, com desfazer e refazer", () => {
    renderPhoto();
    stageRect();
    fireEvent.click(screen.getByRole("button", { name: "Pincel (B)" }));
    fireEvent.pointerDown(doc(), { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(doc(), { clientX: 200, clientY: 150 });
    fireEvent.pointerUp(doc(), { clientX: 200, clientY: 150 });
    expect(log.some(([method, , args]) => method === "lineTo" && args[0] === 200 && args[1] === 150)).toBe(true);
    expect(screen.getByLabelText("Camada Pessoa recortada no documento").tagName).toBe("CANVAS");
    expect(screen.getByText("▸ Pincel")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.queryByText("▸ Pincel")).toHaveClass("text-slate-600");
    menu("Editar", "Refazer");
    expect(screen.getByText("▸ Pincel")).toHaveClass("text-blue-300");
  });

  it("Borracha apaga com destination-out e Clone exige origem com Alt+clique", () => {
    renderPhoto();
    stageRect();
    fireEvent.click(screen.getByRole("button", { name: "Borracha (E)" }));
    fireEvent.pointerDown(doc(), { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(doc(), { clientX: 50, clientY: 50 });
    expect(log.some(([method, , , state]) => method === "drawImage" && state.globalCompositeOperation === "destination-out")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clone (S)" }));
    fireEvent.pointerDown(doc(), { clientX: 10, clientY: 10 });
    expect(screen.getByRole("status")).toHaveTextContent("Alt+clique para definir a origem");
    fireEvent.pointerDown(doc(), { clientX: 10, clientY: 10, altKey: true });
    expect(screen.getByLabelText("Origem do clone")).toBeInTheDocument();
    fireEvent.pointerDown(doc(), { clientX: 300, clientY: 300 });
    fireEvent.pointerUp(doc(), { clientX: 300, clientY: 300 });
    expect(log.some(([method, , args]) => method === "drawImage" && args[1] === 290 && args[2] === 290)).toBe(true);
  });

  it("Letreiro e Laço criam a seleção do arraste; Recorte recorta o documento", () => {
    renderPhoto();
    stageRect();
    fireEvent.click(screen.getByRole("button", { name: "Letreiro (M)" }));
    fireEvent.pointerDown(doc(), { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(doc(), { clientX: 300, clientY: 200 });
    fireEvent.pointerUp(doc(), { clientX: 300, clientY: 200 });
    const shape = screen.getByLabelText("Seleção Letreiro").querySelector("rect");
    expect(shape).toHaveAttribute("x", "100");
    expect(shape).toHaveAttribute("width", "200");
    fireEvent.click(screen.getByRole("button", { name: "Laço (L)" }));
    fireEvent.pointerDown(doc(), { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(doc(), { clientX: 90, clientY: 10 });
    fireEvent.pointerMove(doc(), { clientX: 90, clientY: 90 });
    fireEvent.pointerUp(doc(), { clientX: 90, clientY: 90 });
    expect(screen.getByLabelText("Seleção Laço").querySelector("polygon")).toHaveAttribute("points", "10,10 90,10 90,90");
    fireEvent.click(screen.getByRole("button", { name: "Recorte (C)" }));
    fireEvent.pointerDown(doc(), { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(doc(), { clientX: 600, clientY: 400 });
    fireEvent.pointerUp(doc(), { clientX: 600, clientY: 400 });
    expect(screen.getByText("Doc: 600 × 400 px")).toBeInTheDocument();
    expect(screen.getByText("▸ Recortar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByText("Doc: 1200 × 800 px")).toBeInTheDocument();
  });

  it("Mover desloca a camada com histórico e Texto cria camada editável", () => {
    renderPhoto();
    stageRect();
    fireEvent.pointerDown(doc(), { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(doc(), { clientX: 140, clientY: 120 });
    fireEvent.pointerUp(doc(), { clientX: 140, clientY: 120 });
    expect(screen.getByLabelText("Posição X da camada")).not.toHaveValue(0);
    expect(screen.getByText("▸ Mover")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(doc(), { clientX: 600, clientY: 400 });
    const text = screen.getByLabelText("Texto de Texto 5");
    expect(text).toHaveAttribute("contenteditable", "true");
    text.textContent = "Olá MMPhoto";
    fireEvent.blur(text);
    expect(text).toHaveTextContent("Olá MMPhoto");
    expect(screen.getByText("▸ Editar texto")).toBeInTheDocument();
  });

  it("botões de ajuste criam camadas de ajuste e filtros alteram pixels", () => {
    renderPhoto();
    fireEvent.click(screen.getAllByRole("button", { name: "Ajustes" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "P&B" }));
    expect(screen.getByRole("button", { name: "P&B 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Camada P&B 1 no documento")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pessoa recortada" }));
    fireEvent.click(screen.getByRole("button", { name: "Desfoque" }));
    expect(screen.getByText("▸ Desfoque")).toBeInTheDocument();
    expect(log.some(([method]) => method === "putImageData")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Neural" }));
    expect(screen.getByRole("status")).toHaveTextContent("não estão disponíveis");
  });

  it("fx, abas e itens de menu antes mortos respondem", () => {
    vi.spyOn(window, "prompt").mockReturnValueOnce("600").mockReturnValueOnce("90");
    renderPhoto();
    fireEvent.click(screen.getByRole("button", { name: "Estilo de camada (fx)" }));
    expect(screen.getByRole("button", { name: "Estilo de camada (fx)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Bibliotecas" }));
    expect(screen.getByText(/bibliotecas compartilhadas ficam no MMLibs/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Canais" }).at(-1));
    fireEvent.click(screen.getByRole("button", { name: "◉ Vermelho" }));
    expect(screen.getByRole("button", { name: "◉ Vermelho" })).toHaveAttribute("aria-pressed", "true");
    menu("Imagem", "Tamanho da imagem");
    expect(screen.getByText("Doc: 600 × 400 px")).toBeInTheDocument();
    menu("Imagem", "Rotação da imagem");
    expect(screen.getByText("Doc: 400 × 600 px")).toBeInTheDocument();
    menu("3D", "Nova camada 3D");
    expect(screen.getByRole("status")).toHaveTextContent("não estão disponíveis");
    menu("Ajuda", "Atalhos do MMPhoto");
    expect(screen.getByRole("status")).toHaveTextContent("Ctrl+Shift+Z");
    menu("Janela", "Camadas");
    expect(screen.getByTestId("photo-layer-list")).toBeInTheDocument();
  });

  it("Caneta cria caminho que vira seleção e atalhos mudam ferramenta e pincel", () => {
    renderPhoto();
    stageRect();
    fireEvent.click(screen.getByRole("button", { name: "Caneta (P)" }));
    for (const [x, y] of [[10, 10], [100, 10], [100, 100]]) fireEvent.pointerDown(doc(), { clientX: x, clientY: y });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.click(screen.getAllByRole("button", { name: "Caminhos" }).at(-1));
    fireEvent.click(screen.getByRole("button", { name: /Caminho 1 \(3 pontos\)/ }));
    expect(screen.getByLabelText("Seleção Caminho")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: "b" });
    });
    fireEvent.keyDown(window, { key: "]" });
    expect(screen.getByText("Pincel · 25 px")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "5", code: "Digit5" });
    expect(screen.getByText("Opacidade: 50%")).toBeInTheDocument();
  });
});

describe("MMPhoto — rótulos", () => {
  it("o modo de mesclagem screen aparece como Tela (não Divisão)", () => {
    renderPhoto();
    const select = screen.getByLabelText("Modo de mesclagem da camada");
    const screenOption = [...select.options].find((option) => option.value === "screen");
    expect(screenOption.textContent).toBe("Tela");
    expect([...select.options].some((option) => option.textContent === "Divisão")).toBe(false);
  });
});
