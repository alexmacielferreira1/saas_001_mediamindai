import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CraftLibraryWorkspace from "./CraftLibraryWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";

const assets = [
  { id: "a1", name: "Logo.png", type: "image/png", url: "blob:a1" },
  { id: "a2", name: "Entrevista.mp4", type: "video/mp4", url: "blob:a2" },
  { id: "a3", name: "Roteiro.pdf", type: "application/pdf", url: "blob:a3" },
];
const props = { assets, selected: null, onSelect: vi.fn(), onOpenFiles: vi.fn() };
const assetButton = (name) => screen.queryByText(name, { selector: "p" });

beforeEach(() => localStorage.clear());

describe("Bibliotecas · ferramentas de um clique do MCP", () => {
  it("registra só enquanto está ativo, filtra de verdade e desfaz", async () => {
    const { rerender } = render(<CraftLibraryWorkspace active {...props} />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmlibs", label: "Bibliotecas" });
    expect(provider.catalogue().tools.find((tool) => tool.id === "folder.remove").params[0].options).toHaveLength(3);
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);

    const preview = await act(() => provider.analyze("filter.category", { category: "Vídeos" }));
    expect(preview).toEqual({ ok: true, count: 1, summary: "Prévia (nada foi alterado): Mostrando 1 ativo(s) em Vídeos" });
    expect(assetButton("Logo.png")).toBeInTheDocument();

    // Duas ações seguidas sem redesenhar: a segunda lê o estado deixado pela primeira.
    const [category, favorite] = await act(async () => [await provider.apply("filter.category", { category: "Vídeos" }), await provider.apply("fav.visible", {})]);
    expect(category).toEqual({ ok: true, count: 1, summary: "Mostrando 1 ativo(s) em Vídeos" });
    expect(favorite).toMatchObject({ ok: true, count: 1, items: [{ id: "a2", label: "Entrevista.mp4", badge: "Vídeos" }] });
    expect(favorite).not.toHaveProperty("favorites");
    expect(assetButton("Logo.png")).not.toBeInTheDocument();
    expect(assetButton("Entrevista.mp4")).toBeInTheDocument();
    expect(screen.getByText("3 ativos · 1 favoritos")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("MCP · 1 ativo(s) adicionado(s) aos favoritos");

    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(screen.getByText("3 ativos · 0 favoritos")).toBeInTheDocument();
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(assetButton("Logo.png")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("MCP · Última ação desfeita.");

    // Relatório não altera nada nem entra no desfazer.
    const report = await act(() => provider.apply("report.inventory", {}));
    expect(report).toMatchObject({ ok: true, count: 0, headline: { count: 3 } });
    expect(provider.canUndo()).toBe(false);

    rerender(<CraftLibraryWorkspace active={false} {...props} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("cria pasta na barra lateral e não desfaz se a biblioteca mudou depois", async () => {
    render(<CraftLibraryWorkspace active {...props} />);
    const provider = currentMCPActions();
    await act(() => provider.apply("folder.create", { name: "Clientes" }));
    expect(screen.getByText("▸ Clientes")).toBeInTheDocument();
    await act(() => provider.apply("filter.view", { view: "lista" }));
    expect(screen.getByRole("button", { name: "Visualização em lista" })).toHaveClass("border-cyan-400");
    fireEvent.click(screen.getByRole("button", { name: "Visualização em grade" }));
    act(() => {
      expect(provider.undo()).toBe(false);
    });
    expect(screen.getByRole("status")).toHaveTextContent("A biblioteca mudou depois da ação do MCP");
    expect(screen.getByText("▸ Clientes")).toBeInTheDocument();
    expect(provider.canUndo()).toBe(false);
  });

  it("ferramenta que falha não altera a biblioteca nem entra no desfazer", async () => {
    render(<CraftLibraryWorkspace active {...props} />);
    const result = await act(() => currentMCPActions().apply("assets.restore", {}));
    expect(result).toEqual({ ok: false, summary: "A Lixeira está vazia." });
    expect(assetButton("Roteiro.pdf")).toBeInTheDocument();
    expect(currentMCPActions().canUndo()).toBe(false);
  });

  it("mover para pasta: a pasta passa a guardar o ativo e filtra a grade", async () => {
    render(<CraftLibraryWorkspace active {...props} />);
    const provider = currentMCPActions();
    const preview = await act(() => provider.analyze("assets.move", { folder: "identidade" }));
    expect(preview.items.map((item) => item.id)).toEqual(["a1", "a2", "a3"]);
    expect(preview).not.toHaveProperty("folderAssets");
    await act(() => provider.apply("assets.move", { folder: "identidade", selectedItems: ["a1"] }));
    expect(screen.getByRole("status")).toHaveTextContent("MCP · 1 ativo(s) guardado(s) em “Identidade visual”");

    // Pasta lateral abre a pasta: só o ativo guardado aparece.
    fireEvent.click(screen.getByRole("button", { name: "▸ Identidade visual" }));
    expect(assetButton("Logo.png")).toBeInTheDocument();
    expect(assetButton("Entrevista.mp4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← Todas as pastas" }));
    expect(screen.getByRole("button", { name: /Identidade visual\s*1 ativos/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Projetos\s*0 ativos/ }));
    expect(screen.getByText("Pasta vazia")).toBeInTheDocument();

    // "Sem pasta" mostra o que não foi guardado; esvaziar devolve o ativo.
    fireEvent.click(screen.getByRole("button", { name: "Sem pasta" }));
    expect(assetButton("Logo.png")).not.toBeInTheDocument();
    expect(assetButton("Roteiro.pdf")).toBeInTheDocument();
    await act(() => provider.apply("folder.empty", { folder: "identidade" }));
    expect(assetButton("Logo.png")).toBeInTheDocument();
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    expect(assetButton("Logo.png")).not.toBeInTheDocument();
  });

  it("etiquetar mostra a etiqueta no cartão, na seção Tags e na pesquisa", async () => {
    render(<CraftLibraryWorkspace active {...props} />);
    const provider = currentMCPActions();
    await act(() => provider.apply("assets.tags", { action: "add", tag: "Cliente", selectedItems: ["a2", "a3"] }));
    expect(screen.getAllByText("#cliente")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    fireEvent.click(screen.getByRole("button", { name: "#cliente 2" }));
    expect(screen.getByPlaceholderText(/Pesquisar ativos/)).toHaveValue("cliente");
    expect(assetButton("Logo.png")).not.toBeInTheDocument();
    expect(assetButton("Entrevista.mp4")).toBeInTheDocument();
    expect(assetButton("Roteiro.pdf")).toBeInTheDocument();
    await act(() => provider.apply("assets.tags", { action: "remove", tag: "cliente", selectedItems: ["a3"] }));
    expect(screen.getAllByText("#cliente")).toHaveLength(1);
  });

  it("excluir manda para a Lixeira (sem apagar) e dá para restaurar pela tela", async () => {
    render(<CraftLibraryWorkspace active {...props} />);
    const provider = currentMCPActions();
    expect(provider.catalogue().tools.find((tool) => tool.id === "assets.delete").confirm).toMatch(/Nenhum arquivo é apagado/);
    await act(() => provider.apply("assets.delete", { selectedItems: ["a1", "a3"] }));
    expect(assetButton("Logo.png")).not.toBeInTheDocument();
    expect(assetButton("Roteiro.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("3 ativos · 0 favoritos · 2 na Lixeira")).toBeInTheDocument();
    expect(assets).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /Lixeira/ }));
    expect(assetButton("Logo.png")).toBeInTheDocument();
    expect(assetButton("Entrevista.mp4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar Logo.png" }));
    expect(assetButton("Logo.png")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Restaurar Roteiro.pdf" }), { key: "a" });
    expect(assetButton("Roteiro.pdf")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Restaurar Roteiro.pdf" }), { key: "Enter" });
    expect(screen.getByText("Lixeira vazia")).toBeInTheDocument();
    // A lixeira mudou pela tela: o desfazer do MCP é cancelado para não perder isso.
    act(() => {
      expect(provider.undo()).toBe(false);
    });

    // Dentro da Lixeira não há o que excluir; de volta a Todos os ativos, exclui e restaura todos.
    expect((await act(() => provider.apply("assets.delete", {}))).summary).toMatch(/^Você está na Lixeira/);
    fireEvent.click(screen.getByRole("button", { name: "Todos os ativos" }));
    await act(() => provider.apply("assets.delete", { selectedItems: ["a2"] }));
    expect(assetButton("Entrevista.mp4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Lixeira/ }));
    fireEvent.click(screen.getByRole("button", { name: "Restaurar todos" }));
    fireEvent.click(screen.getByRole("button", { name: "Todos os ativos" }));
    expect(assetButton("Entrevista.mp4")).toBeInTheDocument();
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
