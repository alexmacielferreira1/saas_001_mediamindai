import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LightCraftWorkspace, PdfCraftWorkspace } from "./RemainingCraftWorkspaces";
import { currentMCPActions } from "../../lib/mcpActions";

const photos = [
  { id: "a", name: "Praia.jpg", type: "image/jpeg", url: "blob:a" },
  { id: "b", name: "Retrato.png", type: "image/png", url: "blob:b" },
];
const pdf = { id: "p", name: "Relatório.pdf", type: "application/pdf", url: "blob:pdf" };
const SAMPLE = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R >> endobj
%%EOF`;

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
    drawImage: vi.fn(),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(40) }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  }));
  window.Image = class {
    constructor() {
      this.naturalWidth = 8;
      this.naturalHeight = 6;
    }
    set src(value) {
      this._src = value;
      setTimeout(() => this.onload?.(), 0);
    }
    get src() {
      return this._src;
    }
  };
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(SAMPLE).buffer,
    blob: async () => new Blob([SAMPLE], { type: "application/pdf" }),
  }));
});

function Light({ active }) {
  const [selected, setSelected] = useState(photos[0]);
  return <LightCraftWorkspace active={active} assets={photos} selected={selected} onSelect={setSelected} onOpenFiles={vi.fn()} />;
}
function Pdf({ active, assets = [pdf] }) {
  const [selected, setSelected] = useState(assets[0] || null);
  return <PdfCraftWorkspace active={active} assets={assets} selected={selected} onSelect={setSelected} onOpenFiles={vi.fn()} />;
}
const slider = (name) => screen.getByText(name, { selector: "span" }).closest("label").querySelector("input");
const star = (n) => screen.getByLabelText(`${n} estrela(s)`).querySelector("svg");

describe("MMLight · ferramentas de um clique do MCP", () => {
  it("registra só enquanto está ativo, revela e avalia de verdade, enfileira e desfaz", async () => {
    const { rerender } = render(<Light active />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmlight", label: "MMLight" });
    expect(provider.catalogue().tools.map((tool) => tool.id)).toContain("tone.light");
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);

    const preview = await act(() => provider.analyze("tone.light", { exposure: 30 }));
    expect(preview).toEqual({ ok: true, count: 1, summary: "Prévia (nada foi alterado): Luz em Praia.jpg: exposição +30, contraste +10" });
    expect(slider("exposição")).toHaveValue("0");
    expect(await act(() => provider.analyze("catalog.sync", {}))).toEqual({
      ok: false,
      summary: "Selecione outras fotos na tira (Ctrl+clique ou Shift+clique) para sincronizar.",
    });

    // Duas ações seguidas sem redesenhar (fila): a segunda lê as fotos deixadas pela primeira.
    const [light, rate] = await act(async () => [await provider.apply("tone.light", { exposure: 30 }), await provider.apply("catalog.rate", { stars: 4 })]);
    expect(light.ok).toBe(true);
    expect(light).not.toHaveProperty("photos");
    expect(rate).toEqual({ ok: true, count: 1, summary: "1 foto(s) com 4 estrela(s)" });
    expect(slider("exposição")).toHaveValue("30");
    expect(slider("sombras")).toHaveValue("24");
    expect(star(4)).toHaveClass("fill-amber-400");
    expect(screen.getByRole("status")).toHaveTextContent("MCP · 1 foto(s) com 4 estrela(s)");

    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(star(4)).not.toHaveClass("fill-amber-400");
    expect(slider("exposição")).toHaveValue("30");
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(slider("exposição")).toHaveValue("0");
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Última ação desfeita.");
    expect(provider.canUndo()).toBe(false);

    // Ajuste automático usa a foto decodificada.
    await waitFor(async () => expect((await provider.analyze("tone.auto", {})).ok).toBe(true));

    rerender(<Light active={false} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("não desfaz por cima de uma alteração feita à mão depois da ação do MCP", async () => {
    render(<Light active />);
    const provider = currentMCPActions();
    await act(() => provider.apply("catalog.collection", { entry: "Retratos" }));
    expect(screen.getByLabelText("Coleção Retratos")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Coleção Retratos"));
    expect(screen.getByLabelText("Praia.jpg")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("2 estrela(s)"));
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(screen.getByRole("status")).toHaveTextContent("As fotos mudaram depois da ação do MCP");
    expect(star(2)).toHaveClass("fill-amber-400");
    expect(screen.getByLabelText("Praia.jpg")).toBeInTheDocument();
    expect(provider.canUndo()).toBe(false);
    expect(await act(() => provider.apply("mask.ai", {}))).toEqual({ ok: false, summary: "Máscaras por IA ainda não estão disponíveis no MMLight." });
  });
});

describe("PDF · ferramentas de um clique do MCP", () => {
  const layer = () => screen.getByTestId("pdf-annotation-layer");

  it("grava na camada de anotação, enfileira, desfaz e sai ao desativar", async () => {
    const { rerender } = render(<Pdf active />);
    await waitFor(() => expect(screen.getByText("Página 1 de 1")).toBeInTheDocument());
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmpdf", label: "PDF" });
    expect(provider.catalogue().tools.find((tool) => tool.id === "protect.encrypt").status).toBe("soon");

    const preview = await act(() => provider.analyze("edit.watermark", { text: "SIGILOSO" }));
    expect(preview.summary).toBe("Prévia (nada foi alterado): Marca d'água “SIGILOSO” em todas as páginas (camada de anotação do MMPDF)");
    expect(layer().querySelector('[data-annotation="watermark"]')).toBeNull();

    const [watermark, note] = await act(async () => [
      await provider.apply("edit.watermark", { text: "SIGILOSO" }),
      await provider.apply("comment.note", { text: "Rever" }),
    ]);
    expect(watermark).not.toHaveProperty("annotations");
    expect(note).toEqual({ ok: true, count: 1, summary: "Nota adicionada na página 1 (camada de anotação do MMPDF)" });
    expect(layer().querySelector('[data-annotation="watermark"]')).toHaveTextContent("SIGILOSO");
    expect(screen.getByText("Rever")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Nota adicionada na página 1");

    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.queryByText("Rever")).not.toBeInTheDocument();
    expect(layer().querySelector('[data-annotation="watermark"]')).not.toBeNull();
    act(() => {
      provider.undo();
    });
    expect(layer().querySelector('[data-annotation="watermark"]')).toBeNull();
    expect(provider.canUndo()).toBe(false);

    // Alteração à mão depois da ação: o desfazer do MCP não passa por cima.
    await act(() => provider.apply("comment.stamp", { stamp: "REVISADO" }));
    fireEvent.doubleClick(screen.getByText("REVISADO"));
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(screen.getByRole("status")).toHaveTextContent("As anotações mudaram depois da ação do MCP");
    expect(screen.queryByText("REVISADO")).not.toBeInTheDocument();

    rerender(<Pdf active={false} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("pede um PDF aberto antes de aplicar", async () => {
    render(<Pdf active assets={[]} />);
    expect(await act(() => currentMCPActions().apply("edit.text", { text: "Oi" }))).toEqual({ ok: false, summary: "Abra um PDF primeiro." });
  });
});
