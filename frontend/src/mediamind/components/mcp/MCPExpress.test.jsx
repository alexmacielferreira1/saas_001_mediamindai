import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MCPExpress from "./MCPExpress";

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

  it("opens the matching MCP flow with only active operations", () => {
    const opened = vi.fn();
    window.addEventListener("mm:mcp-open", opened);
    renderExpress();
    fireEvent.click(screen.getByRole("button", { name: "Desligar Recortar" }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir MCP/ }));
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ appId: "mmphoto", actions: ["Ajustar luz e cor", "Aplicar identidade"] }) }));
    window.removeEventListener("mm:mcp-open", opened);
  });
});
