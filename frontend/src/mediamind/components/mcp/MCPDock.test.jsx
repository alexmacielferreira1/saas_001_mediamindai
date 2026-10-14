import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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
vi.mock("../../../api/media", () => ({
  listMediaAssets: vi.fn().mockResolvedValue([{ id: "asset-real", title: "Entrevista real", stream_url: "/api/v1/media/assets/asset-real/stream" }]),
  mediaStreamUrl: (asset) => asset?.stream_url || "",
}));

describe("MCPDock", () => {
  function CurrentPath() {
    const location = useLocation();
    return <output data-testid="current-path">{`${location.pathname}${location.search}`}</output>;
  }
  function RouteControls() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate("/corp?tab=producao")}>Abrir produção</button><button onClick={() => navigate("/ferramentas-graficas?tool=filmcraft")}>Abrir ferramentas gráficas</button></>;
  }
  it("identifies itself as MCP and participates in the page layout", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    expect(await screen.findByText("MCP")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-dock")).toHaveClass("shrink-0");
    expect(screen.getByTestId("mcp-dock")).not.toHaveClass("fixed");
  });

  it("opens the corresponding MMFilm screen and its MCP panel", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=photocraft"]}><MCPDock /><CurrentPath /></MemoryRouter>);

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
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /><CurrentPath /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /MMPhoto/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/ferramentas-graficas?tool=photocraft");
    fireEvent.click(screen.getByRole("button", { name: /MMSom/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/ferramentas-graficas?tool=mmsom");
  });

  it("keeps the IA tools shortcut in the MCP rail", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /><CurrentPath /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Ferramentas IA/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/ferramentas-ia");
  });

  it("keeps MMSom followed by Word, Excel and PowerPoint at the end of the app rail", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    await screen.findByText("MCP");
    const names = screen.getByRole("navigation", { name: "Aplicativos MCP" })
      .querySelectorAll("button");
    expect([...names].slice(-6).map((button) => button.getAttribute("aria-label"))).toEqual([
      "MMSom — planejado",
      "Word — planejado",
      "Excel — planejado",
      "PowerPoint — planejado",
      "Configuração MCP",
      "Adicionar aplicativos MCP",
    ]);
  });

  it("does not render MCP outside the graphic tools area", () => {
    render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPDock /></MemoryRouter>);
    expect(screen.queryByTestId("mcp-dock")).not.toBeInTheDocument();
  });

  it("preserves hook order when navigating out of and back into graphic tools", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /><CurrentPath /><RouteControls /></MemoryRouter>);
    expect(await screen.findByTestId("mcp-dock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir produção" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/corp?tab=producao");
    expect(screen.queryByTestId("mcp-dock")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir ferramentas gráficas" }));
    expect(await screen.findByTestId("mcp-dock")).toBeInTheDocument();
  });

  it("loads persisted media into the MCP project step", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /MMFilm/ }));
    expect(await screen.findByRole("button", { name: "Selecionar mídia Entrevista real" })).toBeInTheDocument();
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
