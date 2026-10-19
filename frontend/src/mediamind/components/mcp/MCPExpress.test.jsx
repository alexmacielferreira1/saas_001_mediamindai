import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MCPExpress from "./MCPExpress";
import { createMCPQueue } from "../../lib/mcpApi";

vi.mock("../../lib/mcpApi", () => ({
  listMCPTools: vi.fn().mockResolvedValue({
    tools: [
      { name: "mmfilm.timeline", module: "mmfilm", title: "Ler timeline", available: true },
      { name: "mmfilm.inspect", module: "mmfilm", title: "Inspecionar projeto", available: true },
      { name: "ai-tools.prompt", module: "ai-tools", title: "Executar prompt com IA cadastrada", available: true },
    ],
  }),
  createMCPQueue: vi.fn().mockResolvedValue({ status: "completed" }),
}));

function renderExpress() {
  return render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=photocraft"]}><MCPExpress /></MemoryRouter>);
}

describe("MCPExpress", () => {
  beforeEach(() => vi.clearAllMocks());
  it("searches and adds exactly the operation the user selects", () => {
    renderExpress();
    fireEvent.change(screen.getByRole("textbox", { name: "Pesquisar operações MCP" }), { target: { value: "pele" } });
    fireEvent.click(screen.getByRole("option", { name: /Corrigir pele/i }));
    expect(screen.getByRole("button", { name: "Remover Corrigir pele" })).toBeInTheDocument();
  });

  it("opens the operation picker without randomly adding an operation", () => {
    renderExpress();
    expect(screen.queryByRole("button", { name: "Remover Corrigir pele" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar operação MCP" }));
    expect(screen.getByRole("listbox", { name: "Operações disponíveis" })).toBeInTheDocument();
    expect(screen.getByText("4 ativas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover Corrigir pele" })).not.toBeInTheDocument();
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
    expect(screen.getByText("Timeline aberta · Corte principal", { selector: "span" })).toBeInTheDocument();
  });

  it("offers direct execution for one operation and for all active operations", () => {
    renderExpress();
    expect(screen.getByRole("button", { name: "Executar Recortar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Executar 4 ações ativas/ })).toBeEnabled();
  });

  it("opens the real Assistant command in Ferramentas IA", () => {
    render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPExpress /></MemoryRouter>);
    expect(screen.getByLabelText("MCP Express")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Executar Executar prompt com IA cadastrada" })).toBeInTheDocument();
  });

  it("does not claim to transcribe by sending a generic prompt", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPExpress /></MemoryRouter>);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Executar Transcrever" }));

    expect(createMCPQueue).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/ainda precisa da ponte MCP/i);
  });

  it("sends the explicit assistant prompt to the registered MCP tool", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPExpress /></MemoryRouter>);
    await act(async () => {});
    fireEvent.change(screen.getByRole("textbox", { name: "Descreva a ação MCP" }), { target: { value: "Analise a ideia" } });

    fireEvent.click(screen.getByRole("button", { name: "Executar Executar prompt com IA cadastrada" }));

    await waitFor(() => expect(createMCPQueue).toHaveBeenCalledWith(expect.objectContaining({
      tool_name: "ai-tools.prompt",
      instruction: "Analise a ideia\nExecutar prompt com IA cadastrada",
      execution_mode: "immediate",
    })));
    expect(await screen.findByRole("status")).toHaveTextContent(/concluída/i);
  });

  it("does not send unconnected AI actions as prompts when executing a batch", async () => {
    render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPExpress /></MemoryRouter>);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Executar 4 ações ativas" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/1 ação\(ões\)/i));
    expect(screen.getByRole("status")).toHaveTextContent(/3 não executadas/i);
    expect(createMCPQueue).toHaveBeenCalledTimes(1);
    expect(createMCPQueue).toHaveBeenCalledWith(expect.objectContaining({ tool_name: "ai-tools.prompt" }));
  });

  it("does not report a failed MCP request as a submitted batch action", async () => {
    createMCPQueue.mockRejectedValueOnce(new Error("Falha de conexão"));
    render(<MemoryRouter initialEntries={["/ferramentas-ia"]}><MCPExpress /></MemoryRouter>);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Executar 4 ações ativas" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/nenhuma ação foi enviada/i));
    expect(screen.getByRole("status")).toHaveTextContent(/verifique a conexão/i);
  });
});
