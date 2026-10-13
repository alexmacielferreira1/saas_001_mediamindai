import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MCPDock from "./MCPDock";

vi.mock("../../lib/mcpApi", () => ({
  listMCPTools: vi.fn().mockResolvedValue({
    modules: [
      { id: "mmfilm", status: "connected" },
      { id: "mmphoto", status: "planned" },
    ],
  }),
  listMCPQueues: vi.fn().mockResolvedValue({ queues: [] }),
  createMCPQueue: vi.fn(),
  executeMCPQueue: vi.fn(),
}));

describe("MCPDock", () => {
  function CurrentPath() {
    const location = useLocation();
    return <output data-testid="current-path">{`${location.pathname}${location.search}`}</output>;
  }
  it("identifies itself as MCP and participates in the page layout", async () => {
    render(<MemoryRouter><MCPDock /></MemoryRouter>);
    expect(await screen.findByText("MCP")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-dock")).toHaveClass("shrink-0");
    expect(screen.getByTestId("mcp-dock")).not.toHaveClass("fixed");
  });

  it("opens the corresponding MMFilm screen and its MCP panel", async () => {
    render(<MemoryRouter initialEntries={["/corp?tab=producao&sub=workspace"]}><MCPDock /><CurrentPath /></MemoryRouter>);

    const mmfilm = await screen.findByRole("button", { name: /MMFilm/i });
    fireEvent.click(mmfilm);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/ferramentas-graficas?tool=filmcraft");
    expect(screen.getByRole("dialog", { name: "Painel MCP MMFilm" })).toBeInTheDocument();
  });

  it("moves active Express operations into the selected MCP form", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=photocraft"]}><MCPDock /></MemoryRouter>);
    window.dispatchEvent(new CustomEvent("mm:mcp-open", { detail: {
      appId: "mmphoto",
      prompt: "Preparar capa",
      operations: [{ label: "Recortar", enabled: true }, { label: "Remover fundo", enabled: false }],
    } }));
    expect(await screen.findByRole("dialog", { name: "Painel MCP MMPhoto" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Operações e prompt/i })).toHaveValue("Preparar capa\nRecortar");
    fireEvent.click(screen.getByRole("button", { name: /Etapas 3 e 4/ }));
    expect(screen.getByText("3. Pacote de tarefas")).toBeInTheDocument();
    expect(screen.getByText("4. Execução e fila")).toBeInTheDocument();
  });

  it("routes each MM application to its matching workspace", async () => {
    render(<MemoryRouter><MCPDock /><CurrentPath /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /MMPhoto/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/ferramentas-graficas?tool=photocraft");
    fireEvent.click(screen.getByRole("button", { name: /MMSom/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/ferramentas-graficas?tool=mmsom");
  });

  it("keeps MMSom immediately before Office at the end of the app rail", async () => {
    render(<MemoryRouter><MCPDock /></MemoryRouter>);
    await screen.findByText("MCP");
    const names = screen.getByRole("navigation", { name: "Aplicativos MCP" })
      .querySelectorAll("button");
    expect([...names].slice(-5).map((button) => button.getAttribute("aria-label"))).toEqual([
      "MMSom — planejado",
      "Office — planejado",
      "IA — planejado",
      "Configuração MCP",
      "Adicionar aplicativos MCP",
    ]);
  });

  it("opens AI tools and its MCP panel from the final application icon", async () => {
    render(<MemoryRouter initialEntries={["/"]}><MCPDock /><CurrentPath /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /IA —/ }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/ferramentas-ia");
    expect(screen.getByRole("dialog", { name: "Painel MCP IA" })).toBeInTheDocument();
  });

  it("uses MM product names and opens the MCP center from the gear", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    await screen.findByText("MCP");
    expect(screen.getByRole("button", { name: /MMFilm/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MMEffects/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MMPhoto/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MMVector/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Premiere/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Configuração MCP" }));
    expect(screen.getByRole("dialog", { name: "Configuração MCP" })).toBeInTheDocument();
    expect(screen.getByText("MMFilm selecionado para configuração")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Centro MCP MediaMind/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Configuração de IA/i })).toBeInTheDocument();
  });
});
