import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FigCraftWorkspace from "./FigCraftWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";

// Vista inicial: zoom 0.5 com deslocamento (80, 80). Tela (x, y) => mundo ((x - 80) * 2, (y - 80) * 2).
const canvas = () => screen.getByLabelText("Canvas do MMFig");
function drag(el, from, to) {
  fireEvent.pointerDown(el, { clientX: from[0], clientY: from[1], button: 0, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1], pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1], pointerId: 1 });
}
function draw(from, to) {
  fireEvent.click(screen.getByRole("button", { name: "Retângulo (R)" }));
  drag(canvas(), from, to);
}
const status = () => screen.getByRole("status", { name: "Mensagens do MMFig" });
const layer = (name) => screen.getAllByRole("button", { name: `Camada ${name}` });
function xOf(name) {
  fireEvent.click(layer(name).at(-1)); // a original fica por baixo das cópias
  return Number(screen.getByLabelText("Posição X").value);
}
function twoRectangles() {
  draw([180, 180], [200, 200]);
  draw([260, 180], [280, 200]);
  drag(canvas(), [150, 150], [300, 260]);
  expect(screen.getByText("2 camadas selecionadas")).toBeInTheDocument();
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("MMFig · ferramentas de um clique do MCP", () => {
  it("registra só enquanto ativo, analisa sem alterar, aplica duas ações seguidas e desfaz pelo histórico", async () => {
    const { rerender } = render(<FigCraftWorkspace active />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmfig", label: "MMFig" });
    expect(provider.catalogue().tools.map((tool) => tool.id)).toContain("align.edges");
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);
    twoRectangles();

    const preview = await act(() => provider.analyze("align.edges", { edge: "left" }));
    expect(preview).toEqual({ ok: true, count: 2, summary: "Prévia (nada foi alterado): 2 camada(s) alinhada(s) à esquerda da seleção" });
    expect(await act(() => provider.analyze("align.distribute", {}))).toEqual({ ok: false, summary: "Esta ferramenta precisa de 3 ou mais camadas selecionadas." });
    expect(xOf("Retângulo 2")).toBe(360);
    drag(canvas(), [150, 150], [300, 260]);

    // Fila: duas ações sem redesenhar entre elas; a segunda parte do documento deixado pela primeira.
    const [aligned, repeated] = await act(async () => [
      await provider.apply("align.edges", { edge: "left" }),
      await provider.apply("layout.repeat", { rows: 1, columns: 3, gap: 10 }),
    ]);
    expect(aligned).toEqual({ ok: true, count: 2, summary: "2 camada(s) alinhada(s) à esquerda da seleção" });
    expect(repeated).toEqual({ ok: true, count: 4, summary: "4 cópia(s) em grade 1×3 (10 px entre as células)" });
    expect(screen.getByText("6 camadas selecionadas")).toBeInTheDocument();
    expect(layer("Retângulo 2")).toHaveLength(3);
    expect(status()).toHaveTextContent("MCP · 4 cópia(s) em grade 1×3");
    expect(xOf("Retângulo 2")).toBe(200);
    expect(provider.canUndo()).toBe(true);

    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(layer("Retângulo 2")).toHaveLength(1);
    expect(status()).toHaveTextContent("MCP · Última ação desfeita.");
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(xOf("Retângulo 2")).toBe(360);
    expect(provider.canUndo()).toBe(false);

    rerender(<FigCraftWorkspace active={false} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("não desfaz por cima de edições feitas depois e exporta de verdade sem entrar no histórico", async () => {
    render(<FigCraftWorkspace />);
    const provider = currentMCPActions();
    twoRectangles();
    expect((await act(() => provider.apply("style.corners", { radius: 8 }))).ok).toBe(true);
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(screen.queryByRole("button", { name: "Camada Retângulo 1" })).not.toBeInTheDocument();
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(status()).toHaveTextContent("desfazer cancelado");
    expect(provider.canUndo()).toBe(false);
    fireEvent.keyDown(canvas(), { key: "z", ctrlKey: true });
    expect(layer("Retângulo 1")).toHaveLength(1);

    const createObjectURL = vi.fn(() => "blob:mmfig");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const exported = await act(() => provider.apply("export.file", { format: "svg" }));
    expect(exported).toEqual({ ok: true, count: 2, summary: "Arquivo pagina-1.svg gerado (200×40 px)." });
    expect(createObjectURL.mock.calls[0][0].type).toBe("image/svg+xml");
    expect(click).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent("MCP · Arquivo pagina-1.svg gerado");
    expect(provider.canUndo()).toBe(false);
  });
});
