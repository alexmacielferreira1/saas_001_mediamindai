import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import DesignCraftWorkspace from "./DesignCraftWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";

const frames = (container) => [...container.querySelectorAll("[data-frame-id]")];

beforeEach(() => localStorage.clear());

describe("MMDesign · ferramentas de um clique do MCP", () => {
  it("registra a grade só enquanto está ativo, cria colunas, aplica estilo e desfaz", async () => {
    const { container, rerender } = render(<DesignCraftWorkspace active assets={[]} onOpenFiles={() => {}} />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmdesign", label: "MMDesign" });
    expect(provider.catalogue().tools.map((tool) => tool.id)).toContain("pages.columns");
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);
    expect(await act(() => provider.apply("text.title", {}))).toEqual({ ok: false, summary: "Selecione um quadro na página (ferramenta Seleção)." });

    const preview = await act(() => provider.analyze("pages.columns", { count: 2 }));
    expect(preview.summary).toMatch(/^Prévia \(nada foi alterado\): 2 coluna\(s\) de texto/);
    expect(frames(container)).toHaveLength(0);

    // Duas ações em fila: as colunas ficam selecionadas e o estilo vai na primeira.
    const [cols, title] = await act(async () => [await provider.apply("pages.columns", { count: 2 }), await provider.apply("text.title", {})]);
    expect(cols).toMatchObject({ ok: true, count: 2 });
    expect(cols.doc).toBeUndefined();
    expect(title).toMatchObject({ ok: true, summary: 'Estilo "Título principal" aplicado em "Coluna 1"' });
    expect(frames(container)).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Estilo");
    expect(provider.canUndo()).toBe(true);
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.getByText("Coluna 1")).toBeInTheDocument();
    act(() => {
      provider.undo();
    });
    await waitFor(() => expect(frames(container)).toHaveLength(0));

    rerender(<DesignCraftWorkspace active={false} assets={[]} onOpenFiles={() => {}} />);
    expect(currentMCPActions()).toBeNull();
  });
});
