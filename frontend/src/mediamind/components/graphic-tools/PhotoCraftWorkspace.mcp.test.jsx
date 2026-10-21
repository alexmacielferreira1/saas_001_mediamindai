import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PhotoCraftWorkspace from "./PhotoCraftWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";

// Canvas 2D mínimo para jsdom: guarda os pixels de verdade (getImageData/putImageData) e ignora o desenho.
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
    puts.push(image.data);
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

let dataUrls = 0;
beforeEach(() => {
  localStorage.clear();
  puts.length = 0;
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function getContext() {
    if (!this._ctx) this._ctx = new FakeContext(this);
    return this._ctx;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => `data:image/png;base64,MCP${(dataUrls += 1)}`);
});

const props = { assets: [], selected: null, onSelect: () => {}, onOpenFiles: () => {} };
const layerNames = () => screen.getAllByLabelText(/^Camada .* no documento$/).map((node) => node.getAttribute("aria-label"));

describe("MMPhoto · ferramentas de um clique do MCP", () => {
  it("registra a grade só enquanto está ativo e cria ajuste com desfazer", async () => {
    const { rerender } = render(<PhotoCraftWorkspace active {...props} />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmphoto", label: "MMPhoto" });
    expect(provider.catalogue().tools.map((tool) => tool.id)).toContain("filter.blur");
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);

    const preview = await act(() => provider.analyze("adjust.bw", { intensity: 60 }));
    expect(preview).toEqual({ ok: true, count: 1, summary: expect.stringMatching(/^Prévia \(nada foi alterado\): Camada de ajuste "P&B 1" \(60%\)/) });
    expect(layerNames()).not.toContain("Camada P&B 1 no documento");
    expect(await act(() => provider.analyze("adjust.clear", {}))).toMatchObject({ ok: true, count: 1 });

    const result = await act(() => provider.apply("adjust.bw", { intensity: 60 }));
    expect(result).toEqual({ ok: true, count: 1, summary: 'Camada de ajuste "P&B 1" (60%) criada: afeta todas as camadas abaixo' });
    expect(layerNames()).toContain("Camada P&B 1 no documento");
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Camada de ajuste");
    expect(provider.canUndo()).toBe(true);
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    await waitFor(() => expect(layerNames()).not.toContain("Camada P&B 1 no documento"));

    rerender(<PhotoCraftWorkspace active={false} {...props} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("aplica filtro nos pixels reais da camada ativa e explica quando não dá", async () => {
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();

    const pixels = await act(() => provider.apply("filter.pixelate", { size: 4 }));
    expect(pixels).toMatchObject({ ok: true, summary: 'Pixelização (blocos de 4 px) em "Pessoa recortada" · camada inteira' });
    expect(puts.length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Pixelização");

    const opacity = await act(() => provider.apply("layer.opacity", { opacity: 30 }));
    expect(opacity.summary).toBe('Opacidade de "Pessoa recortada": 100% → 30%');

    HTMLCanvasElement.prototype.getContext.mockImplementation(() => null);
    const failed = await act(() => provider.apply("filter.blur", {}));
    expect(failed.ok).toBe(false);
    expect(failed.summary).toMatch(/Não foi possível aplicar desfoque/);

    fireEvent.click(screen.getByLabelText("Camada Curvas 1 no documento"));
    expect(await act(() => provider.apply("filter.blur", {}))).toEqual({ ok: false, summary: "Camadas de ajuste não têm pixels. Selecione uma camada de imagem." });
  });

  it("gira, redimensiona e recorta o documento pelos caminhos do app", async () => {
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    expect(screen.getByText("Doc: 1200 × 800 px")).toBeInTheDocument();

    expect(await act(() => provider.apply("doc.rotate", { angle: "90" }))).toMatchObject({ ok: true });
    expect(screen.getByText("Doc: 800 × 1200 px")).toBeInTheDocument();

    expect(await act(() => provider.apply("doc.resize", { percent: 50 }))).toMatchObject({ ok: true, summary: "Tamanho da imagem 50%: 800 × 1200 → 400 × 600 px" });
    expect(screen.getByText("Doc: 400 × 600 px")).toBeInTheDocument();
    expect(await act(() => provider.apply("doc.social", { format: "1:1" }))).toMatchObject({ ok: true, summary: "Quadrado 1:1 (feed): 400 × 600 → 400 × 400 px" });
    expect(screen.getByText("Doc: 400 × 400 px")).toBeInTheDocument();

    expect((await act(() => provider.apply("doc.crop", {}))).ok).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Selecionar tudo" }).at(-1));
    expect(await act(() => provider.apply("doc.crop", {}))).toMatchObject({ ok: true, summary: "Recortar na seleção: 400 × 400 → 400 × 400 px" });
  });

  it("duplica o fundo pelo app, recorta para redes e avisa quando o automático não muda nada", async () => {
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    // Camada uniforme (cinza 200): auto contraste não tem o que esticar.
    expect(await act(() => provider.apply("auto.contrast", {}))).toEqual({ ok: false, summary: expect.stringMatching(/nada a corrigir/) });

    fireEvent.click(within(screen.getByTestId("photo-layer-list")).getByRole("button", { name: "Plano de fundo" }));
    const dupBg = await act(() => provider.apply("layer.duplicate", {}));
    expect(dupBg).toMatchObject({ ok: true, summary: '"Plano de fundo" duplicado (a foto vira uma camada editável)' });
    expect(layerNames()).toContain("Camada Plano de fundo cópia no documento");
    expect(await act(() => provider.apply("layer.duplicate", {}))).toMatchObject({ ok: true, summary: '"Plano de fundo cópia" duplicado' });

    // A cópia ainda está carregando os pixels (no navegador é instantâneo): o recorte avisa em vez de fingir.
    expect(await act(() => provider.apply("doc.social", { format: "9:16" }))).toEqual({ ok: false, summary: "Carregando os pixels das camadas. Tente novamente em instantes." });
  });

  it("duplicar o fundo informa a falha quando o app não consegue rasterizar", async () => {
    render(<PhotoCraftWorkspace {...props} />);
    const provider = currentMCPActions();
    fireEvent.click(within(screen.getByTestId("photo-layer-list")).getByRole("button", { name: "Plano de fundo" }));
    HTMLCanvasElement.prototype.getContext.mockImplementation(() => null);
    const result = await act(() => provider.apply("layer.duplicate", {}));
    expect(result.ok).toBe(false);
    expect(result.summary).toBeTruthy();
  });

  it("documento com pixels ainda carregando não é alterado", async () => {
    const OriginalImage = window.Image;
    window.Image = class {
      set src(value) {
        this._src = value;
      }
    };
    try {
      render(<PhotoCraftWorkspace {...props} />);
      const provider = currentMCPActions();
      // Rasteriza e aplica ruído; desfazer volta ao bitmap rasterizado, que precisa ser recarregado.
      await act(() => provider.apply("filter.noise", {}));
      act(() => {
        provider.undo();
      });
      const result = await act(() => provider.apply("doc.rotate", {}));
      expect(result).toEqual({ ok: false, summary: "Carregando os pixels das camadas. Tente novamente em instantes." });
      expect(screen.getByText("Doc: 1200 × 800 px")).toBeInTheDocument();
    } finally {
      window.Image = OriginalImage;
    }
  });
});
