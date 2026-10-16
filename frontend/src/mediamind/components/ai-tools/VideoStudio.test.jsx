import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VideoStudio from "./VideoStudio";

const api = vi.hoisted(() => ({
  getAICompanies: vi.fn(),
  getAIConnections: vi.fn(),
  generateVideoStudioStage: vi.fn(),
}));

vi.mock("../../../api/generation", () => api);
vi.mock("../../lib/empresaContext", () => ({
  useEmpresa: () => ({ currentEmpresa: { id: "company-a", nome: "Empresa A" }, isGlobal: false }),
}));

const renderStudio = () => render(<MemoryRouter><VideoStudio /></MemoryRouter>);

describe("VideoStudio", () => {
  beforeEach(() => {
    api.getAICompanies.mockReset();
    api.getAIConnections.mockReset();
    api.generateVideoStudioStage.mockReset();
    api.getAICompanies.mockResolvedValue({
      companies: [{ id: "company-a", name: "Empresa A" }],
      is_superadmin: false,
    });
    api.getAIConnections.mockResolvedValue({
      connections: [
        {
          id: "claude-id",
          name: "Claude Roteiros",
          provider: "anthropic",
          model: "claude-sonnet-5-5",
          enabled: true,
          key_configured: true,
        },
      ],
      default_connection_id: "claude-id",
      tool_connections: { "video-studio": "claude-id" },
    });
  });

  it("starts from an idea and executes the first stage with the selected saved Claude connection", async () => {
    api.generateVideoStudioStage.mockResolvedValue({
      text: "ROTEIRO GERADO",
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      connection_id: "claude-id",
    });
    renderStudio();

    fireEvent.change(await screen.findByLabelText("Ideia do vídeo"), {
      target: { value: "Uma médica retorna à cidade natal" },
    });
    expect(await screen.findByLabelText("Conexão de IA")).toHaveValue("claude-id");
    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));

    expect(await screen.findByLabelText("Resultado do roteiro")).toHaveValue("ROTEIRO GERADO");
    expect(api.generateVideoStudioStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "roteiro",
        connection_id: "claude-id",
        prompt: expect.stringContaining("Uma médica retorna à cidade natal"),
      }),
    );
  });

  it("runs the complete eight-stage pipeline sequentially", async () => {
    api.generateVideoStudioStage.mockImplementation(async ({ stage }) => ({
      text: `Resultado ${stage}`,
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      connection_id: "claude-id",
    }));
    renderStudio();
    fireEvent.change(await screen.findByLabelText("Ideia do vídeo"), {
      target: { value: "Uma ideia para o vídeo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Executar etapas pendentes" }));

    expect(await screen.findByText("Pipeline concluído. Revise o pacote antes de exportar.")).toBeInTheDocument();
    expect(api.generateVideoStudioStage).toHaveBeenCalledTimes(8);
    expect(api.generateVideoStudioStage.mock.calls.map(([payload]) => payload.stage)).toEqual([
      "roteiro", "elementos", "mood_style", "character_sheets", "shot_list", "storyboard", "prompts", "multiplanos",
    ]);
  });

  it("keeps multiple draft projects open independently and lets the editor resume either one", async () => {
    renderStudio();

    await screen.findByLabelText("Ideia do vídeo");
    expect(screen.getByRole("region", { name: "Projetos abertos" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Recolher Novo projeto de vídeo/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Novo projeto" }));

    expect(screen.getAllByRole("button", { name: /Recolher Novo projeto de vídeo/i })).toHaveLength(2);
    expect(screen.getAllByText(/0\/8 etapas · salvo automaticamente/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: /Recolher Novo projeto de vídeo/i })[0]);
    expect(screen.getAllByRole("button", { name: /Expandir Novo projeto de vídeo/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Recolher Novo projeto de vídeo/i })).toHaveLength(1);
  });

  it("turns the generated shot list into editable scenes inside the same production flow", async () => {
    api.generateVideoStudioStage.mockResolvedValue({
      text: "Cena 1 — A médica chega ao hospital.\nCena 2 — Ela conversa com a equipe.",
      provider: "anthropic",
      model: "claude",
    });
    renderStudio();
    fireEvent.change(await screen.findByLabelText("Ideia do vídeo"), {
      target: { value: "Uma história sobre trabalho em equipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Executar etapas pendentes" }));
    await screen.findByText("Pipeline concluído. Revise o pacote antes de exportar.");
    fireEvent.click(screen.getByRole("button", { name: "Shot list" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar cenas editáveis" }));

    expect(await screen.findByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByLabelText("Texto / legenda")).toHaveValue(
      "Cena 1 — A médica chega ao hospital.",
    );
    fireEvent.change(screen.getByLabelText("Texto / legenda"), {
      target: { value: "A médica entra no hospital" },
    });
    expect(screen.getByLabelText("Texto / legenda")).toHaveValue(
      "A médica entra no hospital",
    );
  });

  it("keeps previous stage results when a later provider call fails", async () => {
    api.generateVideoStudioStage
      .mockResolvedValueOnce({ text: "ROTEIRO GERADO", provider: "anthropic", model: "claude" })
      .mockRejectedValueOnce(new Error("Falha temporária"));
    renderStudio();
    fireEvent.change(await screen.findByLabelText("Ideia do vídeo"), {
      target: { value: "Uma ideia de documentário" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));
    expect(await screen.findByLabelText("Resultado do roteiro")).toHaveValue("ROTEIRO GERADO");
    fireEvent.click(screen.getByRole("button", { name: "Elementos" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha temporária");
    fireEvent.click(screen.getByRole("button", { name: "Roteiro" }));
    expect(screen.getByLabelText("Resultado do roteiro")).toHaveValue("ROTEIRO GERADO");
  });

  it("preserves old results but marks them for review after the idea changes", async () => {
    api.generateVideoStudioStage.mockResolvedValue({ text: "ROTEIRO ORIGINAL", provider: "anthropic", model: "claude" });
    renderStudio();
    const idea = await screen.findByLabelText("Ideia do vídeo");
    fireEvent.change(idea, { target: { value: "Ideia original" } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));
    expect(await screen.findByLabelText("Resultado do roteiro")).toHaveValue("ROTEIRO ORIGINAL");

    fireEvent.change(idea, { target: { value: "Ideia nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Elementos" }));
    expect(await screen.findByText(/etapa anterior foi alterada/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Roteiro" }));
    expect(screen.getByLabelText("Resultado do roteiro")).toHaveValue("ROTEIRO ORIGINAL");
  });

  it("explains how to configure a connection when none is registered", async () => {
    api.getAIConnections.mockResolvedValue({
      connections: [],
      default_connection_id: null,
      tool_connections: {},
    });
    renderStudio();
    expect(await screen.findByText("Nenhuma IA ativa cadastrada para esta empresa.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar IA" })).toHaveAttribute("href", "/configuracoes/ia");
    await waitFor(() => expect(screen.getByRole("button", { name: "Gerar etapa atual" })).toBeDisabled());
  });
});
