import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import MCPDock from "./MCPDock";
import { clearMCPContext, publishMCPContext, timelineContext } from "../../lib/mcpTargetContext";

const TIMELINE_ASSET = "11111111-2222-4333-8444-555555555555";
afterEach(() => { clearMCPContext("mmfilm"); });

const mcpApi = vi.hoisted(() => ({
  createMCPQueue: vi.fn(),
  executeMCPQueue: vi.fn(),
}));
vi.mock("../../lib/mcpApi", () => ({
  listMCPTools: vi.fn().mockResolvedValue({
    modules: [
      { id: "mmfilm", status: "connected" },
      { id: "mmphoto", status: "planned" },
      { id: "ai-tools", status: "connected" },
    ],
    tools: [
      { name: "mmfilm.inspect", module: "mmfilm", title: "Inspecionar projeto", available: true },
      { name: "mmfilm.timeline", module: "mmfilm", title: "Ler timeline", available: true },
      { name: "mmphoto.inspect", module: "mmphoto", title: "Inspecionar imagem", available: false },
      { name: "ai-tools.prompt", module: "ai-tools", title: "Executar prompt com IA cadastrada", available: true },
      { name: "ai-tools.video_studio", module: "ai-tools", title: "Gerar etapa do Video Studio", available: true },
    ],
  }),
  listMCPQueues: vi.fn().mockResolvedValue({ queues: [] }),
  createMCPQueue: mcpApi.createMCPQueue,
  executeMCPQueue: mcpApi.executeMCPQueue,
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

  it("renders MCP in the IA tools area and keeps other areas out", async () => {
    const { unmount } = render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPDock /></MemoryRouter>);
    expect(await screen.findByTestId("mcp-dock")).toBeInTheDocument();
    unmount();
    render(<MemoryRouter initialEntries={["/corp?tab=producao"]}><MCPDock /></MemoryRouter>);
    expect(screen.queryByTestId("mcp-dock")).not.toBeInTheDocument();
  });

  it("submits an IA prompt without requiring a project", async () => {
    mcpApi.createMCPQueue.mockResolvedValueOnce({
      id: "queue-ai",
      status: "completed",
      results: [{ status: "completed", text: "Resposta do provedor" }],
      target_projects: [],
      create_projects: [],
      output_mode: "internal",
    });
    render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPDock /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Ferramentas IA/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /Operações e prompt/i }), { target: { value: "Resuma este briefing." } });
    fireEvent.click(screen.getByRole("button", { name: /Etapas 3 e 4/ }));
    fireEvent.click(screen.getByRole("button", { name: "Executar pacote agora" }));

    await waitFor(() => expect(mcpApi.createMCPQueue).toHaveBeenCalledWith(expect.objectContaining({
      module: "ai-tools",
      tool_name: "ai-tools.prompt",
      targets: [expect.objectContaining({ id: "assistant", instruction: "Resuma este briefing." })],
    })));
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

  it("does not offer a timeline target that was never opened", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /MMFilm/i }));
    fireEvent.click(screen.getByRole("button", { name: /Usar timeline aberta/ }));
    expect(screen.queryByText(/Corte principal/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Abra uma timeline no MMFilm/);
    expect(screen.getByText("0 alvo(s) selecionado(s)")).toBeInTheDocument();
  });

  it("lets MMFilm target the active timeline before building the task package", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    act(() => publishMCPContext(timelineContext({ source: "mmfilm", sequenceName: "Entrevista final", clips: [{ assetId: TIMELINE_ASSET }] })));
    fireEvent.click(await screen.findByRole("button", { name: /MMFilm/i }));

    expect(screen.getByRole("button", { name: /Usar timeline aberta/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Usar timeline aberta/ }));
    expect(screen.getByText("Timeline aberta · Entrevista final")).toBeInTheDocument();
  });

  it("keeps the timeline selected when it arrives from MCP Express", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    act(() => publishMCPContext(timelineContext({ source: "mmfilm", sequenceName: "Entrevista final", clips: [{ assetId: TIMELINE_ASSET }] })));
    window.dispatchEvent(new CustomEvent("mm:mcp-open", { detail: { appId: "mmfilm", target: "timeline", prompt: "Ler timeline", operations: [] } }));
    expect(await screen.findByText("Timeline aberta · Entrevista final")).toBeInTheDocument();
  });

  it("labels the immediate package action as execute now", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    act(() => publishMCPContext(timelineContext({ source: "mmfilm", sequenceName: "Entrevista final", clips: [{ assetId: TIMELINE_ASSET }] })));
    fireEvent.click(await screen.findByRole("button", { name: /MMFilm/i }));
    fireEvent.click(screen.getByRole("button", { name: /Usar timeline aberta/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Operações e prompt/i }), { target: { value: "Ler timeline" } });
    fireEvent.click(screen.getByRole("button", { name: /Etapas 3 e 4/ }));

    expect(screen.getByRole("button", { name: "Executar pacote agora" })).toBeEnabled();
  });

  it("executes an authorized individual tool instead of only copying its title", async () => {
    mcpApi.createMCPQueue.mockResolvedValueOnce({
      id: "queue-1",
      status: "completed",
      results: [{ status: "completed", asset_count: 1 }],
      target_projects: ["Projeto MCP"],
      create_projects: [],
      output_mode: "internal",
    });
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /MMFilm/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do novo projeto" }), { target: { value: "Projeto MCP" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Novo" }));
    fireEvent.click(screen.getByRole("button", { name: "Executar individualmente Inspecionar projeto" }));

    await waitFor(() => expect(mcpApi.createMCPQueue).toHaveBeenCalledWith(expect.objectContaining({
      tool_name: "mmfilm.inspect",
      execution_mode: "immediate",
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("concluída");
  });

  it("shows persisted MCP executions in history", async () => {
    mcpApi.createMCPQueue.mockResolvedValueOnce({
      id: "queue-history",
      name: "Ação individual · MMFilm",
      status: "completed",
      results: [{ status: "completed", asset_count: 1 }],
      target_projects: ["Projeto histórico"],
      create_projects: [],
      output_mode: "internal",
    });
    render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><MCPDock /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /MMFilm/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do novo projeto" }), { target: { value: "Projeto histórico" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Novo" }));
    fireEvent.click(screen.getByRole("button", { name: "Executar individualmente Inspecionar projeto" }));
    await screen.findByText(/Execução concluída/);
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));

    expect(screen.getByText("Ação individual · MMFilm")).toBeInTheDocument();
    expect(screen.getByText(/1 resultado/)).toBeInTheDocument();
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
