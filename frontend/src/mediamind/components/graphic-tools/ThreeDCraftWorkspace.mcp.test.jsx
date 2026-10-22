import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ThreeDCraftWorkspace from "./ThreeDCraftWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";

beforeEach(() => localStorage.clear());

describe("MM3D · ferramentas de um clique do MCP", () => {
  it("registra só enquanto está ativo, aplica na cena de verdade e desfaz", async () => {
    const { rerender } = render(<ThreeDCraftWorkspace active />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mm3d", label: "MM3D" });
    expect(provider.catalogue().tools.map((tool) => tool.id)).toContain("transform.center");
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);

    const preview = await act(() => provider.analyze("transform.center", {}));
    expect(preview).toEqual({ ok: true, count: 1, summary: "Prévia (nada foi alterado): Cubo centralizado no viewport" });
    expect(screen.getByLabelText("X de Cubo")).toHaveValue(52);
    expect(await act(() => provider.analyze("anim.clear", {}))).toEqual({ ok: false, summary: "Cubo não tem quadros-chave." });

    // Duas ações seguidas sem redesenhar: a segunda lê a cena deixada pela primeira.
    const [centered, added] = await act(async () => [await provider.apply("transform.center", {}), await provider.apply("objects.add", { type: "sphere", count: 1 })]);
    expect(centered).toEqual({ ok: true, count: 1, summary: "Cubo centralizado no viewport" });
    expect(added).toEqual({ ok: true, count: 1, summary: "1 esfera(s) adicionado(s) à cena" });
    expect(screen.getByRole("button", { name: "Objeto Cubo" })).toHaveStyle({ left: "50%" });
    expect(screen.getByLabelText("X de Esfera 1")).toHaveValue(50);
    expect(screen.getByRole("status")).toHaveTextContent("MCP · 1 esfera(s) adicionado(s) à cena");
    expect(provider.canUndo()).toBe(true);

    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.queryByRole("button", { name: "Esfera 1" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("X de Cubo")).toHaveValue(50);
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.getByLabelText("X de Cubo")).toHaveValue(52);
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Última ação desfeita.");

    const world = await act(() => provider.apply("world.lighting", { preset: "night", grid: true }));
    expect(world.ok).toBe(true);
    expect(screen.getByText("Exposição · 0.6")).toBeInTheDocument();

    rerender(<ThreeDCraftWorkspace active={false} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("não desfaz se a cena foi editada depois da ação do MCP", async () => {
    render(<ThreeDCraftWorkspace active />);
    const provider = currentMCPActions();
    await act(() => provider.apply("material.color", { color: "#ff0000" }));
    expect(screen.getByLabelText("Cor de Cubo")).toHaveValue("#ff0000");
    fireEvent.change(screen.getByLabelText("X de Cubo"), { target: { value: "70" } });
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(screen.getByRole("status")).toHaveTextContent("A cena mudou depois da ação do MCP");
    expect(screen.getByLabelText("Cor de Cubo")).toHaveValue("#ff0000");
    expect(provider.canUndo()).toBe(false);
  });

  it("ferramenta em breve não altera a cena", async () => {
    render(<ThreeDCraftWorkspace active />);
    const result = await act(() => currentMCPActions().apply("world.render", {}));
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/^Em breve:/);
    expect(currentMCPActions().canUndo()).toBe(false);
  });
});
