import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EffectCraftWorkspace from "./EffectCraftWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";

const props = { assets: [], selected: null, onSelect: vi.fn(), onOpenFiles: vi.fn() };
const layerElement = () => screen.getByLabelText(/^Camada .* na composição$/);
const status = () => screen.getByRole("status", { name: "Status do MMEffect" });

beforeEach(() => localStorage.clear());

describe("MMEffects · ferramentas de um clique do MCP", () => {
  it("registra a grade só enquanto está ativo e anima a camada com desfazer", async () => {
    const { rerender } = render(<EffectCraftWorkspace active {...props} />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmeffects", label: "MMEffects" });
    expect(provider.catalogue().tools.map((tool) => tool.id)).toContain("anim.fadein");
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);

    const preview = await act(() => provider.analyze("anim.spin", { turns: 1 }));
    expect(preview).toEqual({ ok: true, count: 2, summary: 'Prévia (nada foi alterado): Girar em "Controller" (0 s → 10 s) · 2 quadro(s)-chave' });
    expect(screen.getByLabelText("Valor Rotação da camada")).toHaveValue(0);

    const result = await act(() => provider.apply("anim.spin", { turns: 1 }));
    expect(result).toEqual({ ok: true, count: 2, summary: 'Girar em "Controller" (0 s → 10 s) · 2 quadro(s)-chave' });
    expect(result.patch).toBeUndefined();
    expect(screen.getByLabelText("Valor Rotação da camada")).toHaveValue(108);
    expect(status()).toHaveTextContent("MCP · Girar");
    expect(provider.canUndo()).toBe(true);
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    await waitFor(() => expect(screen.getByLabelText("Valor Rotação da camada")).toHaveValue(0));

    rerender(<EffectCraftWorkspace active={false} {...props} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("aplica efeitos e marcadores reais, em fila, e explica quando não dá", async () => {
    render(<EffectCraftWorkspace {...props} />);
    const provider = currentMCPActions();

    // Duas ações seguidas sem redesenhar: a segunda lê o estado deixado pela primeira.
    const [blur, glow] = await act(async () => [await provider.apply("fx.blur", { amount: 6 }), await provider.apply("fx.glow", {})]);
    expect(blur.ok && glow.ok).toBe(true);
    expect(layerElement().style.filter).toContain("blur(6px)");
    expect(layerElement().style.filter).toContain("drop-shadow");

    expect(await act(() => provider.apply("markers.rhythm", { interval: 5, offset: 0 }))).toMatchObject({ ok: true, count: 3 });
    expect(screen.getByLabelText("Marcador da composição em 5.00s")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Background" }));
    runLock();
    expect(await act(() => provider.apply("anim.fadein", {}))).toEqual({ ok: false, summary: 'A camada "Background" está bloqueada: desbloqueie para animar.' });
  });
});

// O cadeado da camada (sem rótulo próprio) fica logo depois do botão de solo.
function runLock() {
  fireEvent.click(screen.getByLabelText("Ativar solo de Background").nextElementSibling);
}
