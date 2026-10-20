import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MCPToolPanel from "./MCPToolPanel";

function makeProvider(overrides = {}) {
  return {
    source: "teste",
    label: "App de teste",
    catalogue: () => ({
      tabs: [
        { id: "corte", label: "Cortes" },
        { id: "som", label: "Som" },
      ],
      tools: [
        {
          id: "silencio",
          tab: "corte",
          label: "Remover silêncios",
          description: "Apaga pausas",
          how: "Mede o volume a cada 10 ms",
          applyLabel: "Remover",
          params: [
            { key: "nivel", label: "Sensibilidade", type: "range", min: 1, max: 10, step: 1, default: 5, help: "Mais alta = mais cortes" },
            { key: "margem", label: "Margem", type: "range", min: 0, max: 1, step: 0.1, default: 0.5, unit: "s" },
            { key: "modo", label: "Limite", type: "select", default: "auto", options: [["auto", "Automático"], ["manual", "Manual"]] },
            { key: "musica", label: "Proteger música", type: "toggle", default: true },
            { key: "faixas", label: "Faixas", type: "multi", default: ["A1"], options: [["A1", "A1"], ["A2", "A2"]] },
            { key: "sons", label: "Sons", type: "multi", default: [], options: [], empty: "Importe sons primeiro" },
            { key: "aviso", label: "Use fones", type: "info" },
          ],
        },
        { id: "reset", tab: "som", label: "Limpar sons", description: "Remove sons automáticos", analyze: false, params: [] },
        { id: "simples", tab: "som", label: "Só aplicar", description: "Sem parâmetros declarados", icon: () => <svg data-testid="icone-proprio" /> },
        {
          id: "passo",
          tab: "som",
          label: "Volume",
          description: "Faixa sem passo",
          params: [
            { key: "db", label: "Ganho", type: "range", min: -6, max: 6, default: 0 },
            { key: "lista", label: "Lista", type: "multi", options: [["x", "Opção X"]] },
            { key: "vazio", label: "Vazio", type: "multi", options: [] },
          ],
        },
      ],
    }),
    analyze: vi.fn(async () => ({ ok: true, summary: "Prévia: 3 silêncios", details: ["00:01 → 00:02"] })),
    apply: vi.fn(async () => ({ ok: true, summary: "3 silêncios removidos" })),
    undo: vi.fn(() => true),
    canUndo: vi.fn(() => true),
    ...overrides,
  };
}

const card = (name) => screen.getByRole("button", { name, expanded: false });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("Grade de ferramentas MCP", () => {
  it("filtra por guia e por busca e explica quando não acha nada", () => {
    render(<MCPToolPanel provider={makeProvider()} />);
    expect(screen.getByRole("button", { name: /Todos/ })).toHaveTextContent("4");
    fireEvent.click(screen.getByRole("button", { name: /^Som/ }));
    expect(screen.queryByRole("button", { name: "Remover silêncios" })).toBeNull();
    expect(screen.getByRole("button", { name: "Limpar sons" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Todos/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar ferramentas" }), { target: { value: "pausas" } });
    expect(screen.getByRole("button", { name: "Remover silêncios" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar sons" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar ferramentas" }), { target: { value: "xyz" } });
    expect(screen.getByText("Nenhuma ferramenta encontrada.")).toBeInTheDocument();
  });

  it("guarda favoritos por aplicativo e mostra a guia de favoritos", () => {
    const { unmount } = render(<MCPToolPanel provider={makeProvider()} />);
    fireEvent.click(screen.getByRole("button", { name: /★ Favoritos/ }));
    expect(screen.getByText(/Marque a estrela/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Todos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar aos favoritos: Limpar sons" }));
    fireEvent.click(screen.getByRole("button", { name: /★ Favoritos/ }));
    expect(screen.getByRole("button", { name: "Limpar sons" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover silêncios" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("mm_mcp_tool_favorites_v1"))).toEqual({ teste: ["reset"] });
    unmount();
    render(<MCPToolPanel provider={makeProvider()} />);
    fireEvent.click(screen.getByRole("button", { name: "Remover dos favoritos: Limpar sons" }));
    expect(JSON.parse(localStorage.getItem("mm_mcp_tool_favorites_v1"))).toEqual({ teste: [] });
  });

  it("abre o detalhamento abaixo, ajusta parâmetros e analisa sem aplicar", async () => {
    const provider = makeProvider();
    render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Remover silêncios"));
    const detail = screen.getByLabelText("Detalhes: Remover silêncios");
    expect(within(detail).getByText("Apaga pausas")).toBeInTheDocument();
    expect(within(detail).getByText("Use fones")).toBeInTheDocument();
    expect(within(detail).getByText("Importe sons primeiro")).toBeInTheDocument();
    expect(within(detail).getByText("0,5 s")).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("button", { name: /Como funciona/ }));
    expect(within(detail).getByText("Mede o volume a cada 10 ms")).toBeInTheDocument();
    fireEvent.change(within(detail).getByLabelText(/Sensibilidade/), { target: { value: "8" } });
    fireEvent.change(within(detail).getByLabelText("Limite"), { target: { value: "manual" } });
    fireEvent.click(within(detail).getByRole("checkbox", { name: "Proteger música" }));
    fireEvent.click(within(detail).getByRole("checkbox", { name: "A2" }));
    fireEvent.click(within(detail).getByRole("checkbox", { name: "A1" }));
    fireEvent.click(within(detail).getByRole("button", { name: /Analisar/ }));
    expect(await within(detail).findByText("Prévia: 3 silêncios")).toBeInTheDocument();
    expect(within(detail).getByText("00:01 → 00:02")).toBeInTheDocument();
    expect(provider.analyze).toHaveBeenCalledWith("silencio", { nivel: 8, margem: 0.5, modo: "manual", musica: false, faixas: ["A2"], sons: [], aviso: undefined });
    expect(provider.apply).not.toHaveBeenCalled();
  });

  it("aplica, registra a execução, desfaz e fecha ao clicar de novo", async () => {
    const provider = makeProvider();
    const onExecuted = vi.fn();
    render(<MCPToolPanel provider={provider} onExecuted={onExecuted} />);
    fireEvent.click(card("Remover silêncios"));
    fireEvent.click(screen.getByRole("button", { name: /^Remover$/ }));
    expect(await screen.findByText("3 silêncios removidos")).toBeInTheDocument();
    expect(onExecuted).toHaveBeenCalledWith(expect.objectContaining({ outcome: { ok: true, summary: "3 silêncios removidos" } }));
    fireEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    expect(screen.getByText("Última alteração desfeita.")).toBeInTheDocument();
    provider.undo.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: /Desfazer/ }));
    expect(screen.getByText("Nada para desfazer.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover silêncios", expanded: true }));
    expect(screen.queryByLabelText("Detalhes: Remover silêncios")).toBeNull();
  });

  it("mostra a falha real da ferramenta, inclusive em erros inesperados", async () => {
    const onExecuted = vi.fn();
    const provider = makeProvider({
      apply: vi.fn(async () => {
        throw new Error("Web Audio indisponível");
      }),
      analyze: vi.fn(async () => {
        throw {};
      }),
      canUndo: () => false,
    });
    render(<MCPToolPanel provider={provider} onExecuted={onExecuted} />);
    fireEvent.click(card("Remover silêncios"));
    expect(screen.getByRole("button", { name: /Desfazer/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Remover$/ }));
    expect(await screen.findByText("Web Audio indisponível")).toBeInTheDocument();
    expect(onExecuted).toHaveBeenCalledWith(expect.objectContaining({ outcome: { ok: false, summary: "Web Audio indisponível" } }));
    fireEvent.click(screen.getByRole("button", { name: /Analisar/ }));
    expect(await screen.findByText("Falha ao executar a ferramenta.")).toBeInTheDocument();
    expect(onExecuted).toHaveBeenCalledTimes(1);
  });

  it("enfileira com os parâmetros atuais e esconde Analisar quando a ferramenta não tem prévia", async () => {
    const onEnqueue = vi.fn();
    render(<MCPToolPanel provider={makeProvider()} onEnqueue={onEnqueue} />);
    fireEvent.click(card("Limpar sons"));
    expect(screen.queryByRole("button", { name: /Analisar/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar à fila/ }));
    expect(onEnqueue).toHaveBeenCalledWith({ tool: expect.objectContaining({ id: "reset" }), params: {}, description: "" });
    expect(screen.getByText("“Limpar sons” adicionado à fila com os parâmetros atuais.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover silêncios" }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar à fila/ }));
    expect(onEnqueue).toHaveBeenLastCalledWith(expect.objectContaining({ description: "Sensibilidade 5 · Margem 0,5 s · Limite: Automático · Proteger música · Faixas: 1 · Sons: 0" }));
  });

  it("aceita ferramentas sem parâmetros, com ícone próprio e faixa sem passo", async () => {
    const provider = makeProvider();
    render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Só aplicar"));
    expect(screen.getAllByTestId("icone-proprio").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: /Aplicar agora/ }));
    await waitFor(() => expect(provider.apply).toHaveBeenCalledWith("simples", {}));
    fireEvent.click(card("Volume"));
    expect(screen.getByLabelText(/Ganho/)).toHaveAttribute("step", "1");
    expect(screen.getByText("Nenhuma opção disponível.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Opção X" }));
    expect(screen.getByRole("checkbox", { name: "Opção X" })).toBeChecked();
  });

  it("funciona sem armazenamento local e troca de aplicativo limpando a seleção", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const { rerender } = render(<MCPToolPanel provider={makeProvider()} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar aos favoritos: Limpar sons" }));
    expect(screen.getByRole("button", { name: "Remover dos favoritos: Limpar sons" })).toBeInTheDocument();
    fireEvent.click(card("Remover silêncios"));
    rerender(<MCPToolPanel provider={makeProvider({ source: "outro", label: "Outro" })} />);
    await waitFor(() => expect(screen.queryByLabelText("Detalhes: Remover silêncios")).toBeNull());
    expect(screen.getByRole("region", { name: "Ferramentas Outro" })).toBeInTheDocument();
  });
});
