import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MCPCenter from "./MCPCenter";

const api = vi.hoisted(() => ({ listMCPTools: vi.fn(), callMCPTool: vi.fn() }));
vi.mock("../../lib/mcpApi", () => api);

const catalog = {
  mode: "read_only",
  modules: [
    { id: "system", label: "Sistema", description: "Descoberta", status: "connected" },
    { id: "mmfilm", label: "MMFilm", description: "Timeline", status: "connected" },
    { id: "mmphoto", label: "MMPhoto", description: "Imagem", status: "planned" },
  ],
  tools: [
    { name: "system.capabilities", module: "system", title: "Descobrir capacidades", description: "Lista capacidades", effect: "read", available: true },
    { name: "mmphoto.inspect", module: "mmphoto", title: "Inspecionar imagem", description: "Lê imagem", effect: "read", available: false },
  ],
};

describe("MCPCenter", () => {
  beforeEach(() => {
    api.listMCPTools.mockReset().mockResolvedValue(catalog);
    api.callMCPTool.mockReset().mockResolvedValue({
      tool: "system.capabilities",
      status: "completed",
      correlation_id: "corr-1",
      duration_ms: 4.2,
      result: { connected_modules: ["system", "mmfilm"] },
    });
  });

  it("shows connected and planned adapters without pretending they all work", async () => {
    render(<MCPCenter />);

    expect(await screen.findByRole("heading", { name: "Centro MCP MediaMind" })).toBeInTheDocument();
    expect(screen.getByText("MMFilm")).toBeInTheDocument();
    expect(screen.getByText("MMPhoto")).toBeInTheDocument();
    expect(screen.getAllByText("Conectado").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /MMPhotoPlanejado/i }));
    expect(screen.getByRole("button", { name: "Executar Inspecionar imagem" })).toBeDisabled();
  });

  it("runs a real read-only tool and records its result", async () => {
    render(<MCPCenter />);
    fireEvent.click(await screen.findByRole("button", { name: "Executar Descobrir capacidades" }));

    expect(await screen.findByText("Chamada concluída")).toBeInTheDocument();
    expect(screen.getByText("corr-1")).toBeInTheDocument();
    expect(api.callMCPTool).toHaveBeenCalledWith("system.capabilities", {});
  });

  it("shows backend failure instead of a simulated result", async () => {
    api.callMCPTool.mockRejectedValueOnce(new Error("MCP indisponível"));
    render(<MCPCenter />);
    fireEvent.click(await screen.findByRole("button", { name: "Executar Descobrir capacidades" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("MCP indisponível");
    expect(screen.queryByText("Chamada concluída")).not.toBeInTheDocument();
  });
});
