import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import SoundCraft from "./SoundCraft";
import { currentMCPActions } from "../lib/mcpActions";

beforeEach(() => localStorage.clear());

const pan = (name) => screen.getByLabelText(`Pan ${name}`);

describe("MMSom · ferramentas de um clique do MCP", () => {
  it("registra só com a Mesa integrada aberta e a aba ativa; aplica e desfaz", async () => {
    const { rerender } = render(<SoundCraft active />);
    expect(currentMCPActions()).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Mesa integrada" }));
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmsom", label: "MMSom" });
    expect(provider.catalogue().tools.find((tool) => tool.id === "inserts.voice").params[0].default).toEqual(["1"]);
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);
    expect(await act(() => provider.apply("mix.balance", {}))).toEqual({ ok: false, summary: expect.stringMatching(/duas ou mais faixas com áudio/) });

    const preview = await act(() => provider.analyze("mix.spread", { width: 60 }));
    expect(preview.summary).toBe("Prévia (nada foi alterado): Estéreo aberto de -60 a 60 (2 faixas)");
    expect(pan("Voz principal")).toHaveValue("0");
    expect(await act(() => provider.analyze("mix.center", {}))).toEqual({ ok: false, summary: "Todas as faixas já estão no centro." });

    const result = await act(() => provider.apply("mix.spread", { width: 60 }));
    expect(result).toEqual({ ok: true, count: 2, summary: "Estéreo aberto de -60 a 60 (2 faixas)" });
    expect(pan("Voz principal")).toHaveValue("-60");
    expect(pan("Trilha musical")).toHaveValue("60");
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Estéreo aberto");
    expect(provider.canUndo()).toBe(true);
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(pan("Voz principal")).toHaveValue("0");
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Última ação desfeita.");

    rerender(<SoundCraft active={false} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("não desfaz por cima de uma edição manual feita depois", async () => {
    render(<SoundCraft />);
    fireEvent.click(screen.getByRole("tab", { name: "Mesa integrada" }));
    const provider = currentMCPActions();
    await act(() => provider.apply("inserts.comp", {}));
    fireEvent.change(pan("Voz principal"), { target: { value: "25" } });
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(pan("Voz principal")).toHaveValue("25");
    expect(provider.canUndo()).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("desfazer cancelado");
  });
});
