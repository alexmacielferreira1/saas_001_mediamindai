import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MCPExpress from "./MCPExpress";

vi.mock("../../lib/mcpApi", () => ({
  listMCPTools: vi.fn().mockResolvedValue({
    tools: [
      { name: "mmfilm.timeline", module: "mmfilm", title: "Ler timeline", available: true },
      { name: "mmfilm.inspect", module: "mmfilm", title: "Inspecionar projeto", available: true },
    ],
  }),
  createMCPQueue: vi.fn().mockResolvedValue({ status: "completed" }),
}));

function renderExpress() {
  return render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=photocraft"]}><MCPExpress /></MemoryRouter>);
}

describe("MCPExpress", () => {
  it("searches and adds exactly the operation the user selects", () => {
    renderExpress();
    fireEvent.change(screen.getByRole("textbox", { name: "Pesquisar operações MCP" }), { target: { value: "fundo" } });
    fireEvent.click(screen.getByRole("option", { name: /Remover fundo/i }));
    expect(screen.getByText("Remover fundo")).toBeInTheDocument();
  });

  it("opens the operation picker without randomly adding an operation", () => {
    renderExpress();
    expect(screen.queryByText("Remover fundo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar operação MCP" }));
    expect(screen.getByRole("listbox", { name: "Operações disponíveis" })).toBeInTheDocument();
    expect(screen.getByText("3 ativas")).toBeInTheDocument();
  });

  it("lets the user turn an operation off and remove it", () => {
    renderExpress();
    const toggle = screen.getByRole("button", { name: "Desligar Recortar" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Ligar Recortar" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Remover Recortar" }));
    expect(screen.queryByRole("button", { name: /Recortar/ })).not.toBeInTheDocument();
  });

  it("keeps the complete MCP panel independent from Express", () => {
    const opened = vi.fn();
    window.addEventListener("mm:mcp-open", opened);
    renderExpress();
    fireEvent.click(screen.getByRole("button", { name: "Desligar Recortar" }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir painel completo/ }));
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ appId: "mmphoto" }) }));
    expect(opened.mock.calls[0][0].detail.operations).toBeUndefined();
    window.removeEventListener("mm:mcp-open", opened);
  });

  it("shows the active timeline as the Express execution target", () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPExpress /></MemoryRouter>);
    expect(screen.getByRole("combobox", { name: "Alvo de execução MCP Express" })).toHaveValue("timeline");
    expect(screen.getByText("Timeline aberta · Corte principal")).toBeInTheDocument();
  });

  it("offers direct execution for one operation and for all active operations", () => {
    renderExpress();
    expect(screen.getByRole("button", { name: "Executar Recortar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Executar 3 ações ativas/ })).toBeEnabled();
  });

  it("opens the real Assistant command in Ferramentas IA", () => {
    render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPExpress /></MemoryRouter>);
    expect(screen.getByLabelText("MCP Express")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Executar rapidamente Executar prompt com IA cadastrada/i })).toBeInTheDocument();
  });
});
