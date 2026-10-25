import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EffectCraftWorkspace from "./EffectCraftWorkspace";

vi.setConfig({ testTimeout: 40000 });

function renderWorkspace() {
  return render(<EffectCraftWorkspace assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} />);
}
const value = (label) => screen.getByLabelText(`Valor ${label} da camada`);
const align = (name) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

// Caixa padrão da camada: x 22%, y 34%, 60% × 22% da composição, âncora no centro, escala 100%.
// Posição X desloca a caixa em (x - 960) / 1920 da largura da caixa (mesma conta do canvas).
describe("MMEffect — alinhar a camada à composição", () => {
  it("alinha as bordas reais da caixa da camada às bordas e ao centro da composição", () => {
    renderWorkspace();
    expect(value("X")).toHaveValue("960");
    align("Alinhar à esquerda");
    expect(value("X")).toHaveValue("256");
    align("Alinhar à direita");
    expect(value("X")).toHaveValue("1536");
    align("Centralizar horizontalmente");
    expect(value("X")).toHaveValue("896");
    align("Alinhar ao topo");
    expect(value("Y")).toHaveValue("-1129.09");
    align("Alinhar à base");
    expect(value("Y")).toHaveValue("2700");
    align("Centralizar verticalmente");
    expect(value("Y")).toHaveValue("785.45");
    expect(screen.getByRole("status", { name: "Status do MMEffect" })).toHaveTextContent(/composição/);
  });

  it("considera a escala ao redor da âncora", () => {
    renderWorkspace();
    fireEvent.change(value("Escala"), { target: { value: "50" } });
    align("Alinhar à esquerda");
    // left% = 22 + (x-960)/1920*60 + 30*(1-0.5) → 0  ⇒  x = 960 - 1920*37/60
    expect(value("X")).toHaveValue("-224");
  });

  it("sem camada selecionada os botões ficam desabilitados com motivo", () => {
    renderWorkspace();
    fireEvent.keyDown(window, { key: "Escape" });
    const button = screen.getByRole("button", { name: "Alinhar à esquerda" });
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toMatch(/Selecione uma camada/);
    expect(screen.getByLabelText("Alinhar camadas a")).toBeDisabled();
  });
});
