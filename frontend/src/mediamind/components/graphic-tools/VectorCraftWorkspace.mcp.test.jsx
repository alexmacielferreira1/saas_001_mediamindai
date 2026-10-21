import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VectorCraftWorkspace from "./VectorCraftWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";

const props = { assets: [], selected: null, onSelect: vi.fn(), onOpenFiles: vi.fn() };
const title = () => screen.getByRole("button", { name: "Título principal na prancheta" });

beforeEach(() => localStorage.clear());

describe("MMVector · ferramentas de um clique do MCP", () => {
  it("registra a grade só enquanto está ativo, alinha o objeto selecionado e desfaz", async () => {
    const { rerender } = render(<VectorCraftWorkspace active {...props} />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmvector", label: "MMVector" });
    expect(provider.catalogue().tools.map((tool) => tool.id)).toContain("align.left");
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);
    const before = title().getAttribute("style");

    const preview = await act(() => provider.analyze("align.left", {}));
    expect(preview).toEqual({ ok: true, count: 1, summary: "Prévia (nada foi alterado): 1 objeto(s) alinhado(s) à esquerda da prancheta" });
    expect(title().getAttribute("style")).toBe(before);
    expect(await act(() => provider.analyze("align.distH", {}))).toEqual({ ok: false, summary: "Esta ferramenta precisa de 3 ou mais objetos selecionados." });

    // Duas ações seguidas sem redesenhar: a segunda lê os objetos deixados pela primeira.
    const [left, flip] = await act(async () => [await provider.apply("align.left", {}), await provider.apply("transform.flipX", {})]);
    expect(left).toEqual({ ok: true, count: 1, summary: "1 objeto(s) alinhado(s) à esquerda da prancheta" });
    expect(flip.ok).toBe(true);
    expect(title().getAttribute("style")).not.toBe(before);
    expect(screen.getByRole("status")).toHaveTextContent("MCP · 1 objeto(s) espelhado(s) na horizontal");
    expect(provider.canUndo()).toBe(true);
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    act(() => {
      provider.undo();
    });
    await waitFor(() => expect(title().getAttribute("style")).toBe(before));

    rerender(<VectorCraftWorkspace active={false} {...props} />);
    expect(currentMCPActions()).toBeNull();
  });
});
