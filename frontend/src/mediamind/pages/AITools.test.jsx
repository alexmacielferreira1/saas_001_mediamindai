import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

vi.mock("../lib/producaoStore", () => ({ useProducaoProjetos: () => [] }));
vi.mock("../lib/creativeToolsApi", () => ({
  listCreativeDocuments: vi.fn().mockResolvedValue([]),
  createCreativeDocument: vi.fn(),
  updateCreativeDocument: vi.fn(),
  approveCreativeDocument: vi.fn(),
}));
vi.mock("../lib/mcpApi", () => ({
  listMCPTools: vi.fn().mockResolvedValue({ mode: "read_only", modules: [], tools: [] }),
  callMCPTool: vi.fn(),
}));

import AITools from "./AITools";

describe("AITools", () => {
  it("keeps the original tools and adds the four generative studios", async () => {
    render(
      <MemoryRouter initialEntries={["/ferramentas-ia"]}>
        <AITools />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Ferramentas IA e Editoração" })).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "Ferramentas IA" }).querySelectorAll('[role="tab"]'),
    ).toHaveLength(17);
    expect(screen.queryByRole("tab", { name: "MCP Central" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Arte" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Thumbnails IA" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Carrossel IA" })).toHaveTextContent("Carrossel");
    expect(screen.getByRole("tab", { name: "Vídeo Studio" })).toHaveTextContent("Vídeo");
    expect(screen.getByText("Sua foto")).toBeInTheDocument();
    expect(screen.getByText("Sua mensagem")).toBeInTheDocument();
    expect(screen.getByText("Suas 3 ideias")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar 3 novas ideias" })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Prévia /)).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Gerador de Imagem" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Gerador de Vídeo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Objeto 3D" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mundo 3D" })).toBeInTheDocument();
  });

  it("opens an honest image generation workspace", () => {
    render(
      <MemoryRouter initialEntries={["/ferramentas-ia?tool=image-generator"]}>
        <AITools />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Criar imagem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Descreva a imagem")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar imagem" })).toBeDisabled();
    expect(screen.getByText(/provedor de geração não configurado/i)).toBeInTheDocument();
  });

  it("opens the dubbing workspace with editable subtitles", async () => {
    render(
      <MemoryRouter initialEntries={["/ferramentas-ia?tool=ai-dubbing"]}>
        <AITools />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Dublagem IA/ }));
    expect(await screen.findByLabelText("Texto original")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /executar/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the complete thumbnail editor as the first IA tool", async () => {
    render(
      <MemoryRouter initialEntries={["/ferramentas-ia?tool=thumbnails"]}>
        <AITools />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Ferramentas IA e Editoração" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Thumbnails IA" })).toBeInTheDocument();
  });
});
