import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VideoStudio from "./VideoStudio";

const api = vi.hoisted(() => ({
  getAICompanies: vi.fn(),
  getAIConnections: vi.fn(),
  generateVideoStudioStage: vi.fn(),
  putVideoAsset: vi.fn(),
  getVideoAsset: vi.fn(),
  deleteVideoAsset: vi.fn(),
}));

vi.mock("../../../api/generation", () => api);
vi.mock("./videoStudioAssets", () => ({
  putVideoAsset: api.putVideoAsset,
  getVideoAsset: api.getVideoAsset,
  deleteVideoAsset: api.deleteVideoAsset,
}));
vi.mock("../../lib/empresaContext", () => ({
  useEmpresa: () => ({ currentEmpresa: { id: "company-a", nome: "Empresa A" }, isGlobal: false }),
}));

const renderStudio = (props = {}) => render(<MemoryRouter><VideoStudio {...props} /></MemoryRouter>);

describe("VideoStudio", () => {
  beforeEach(() => {
    api.getAICompanies.mockReset();
    api.getAIConnections.mockReset();
    api.generateVideoStudioStage.mockReset();
    api.putVideoAsset.mockReset();
    api.getVideoAsset.mockReset();
    api.deleteVideoAsset.mockReset();
    api.getVideoAsset.mockResolvedValue(null);
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

    fireEvent.change(await screen.findByLabelText("Ideia ou roteiro do vídeo"), {
      target: { value: "Uma médica retorna à cidade natal" },
    });
    expect(await screen.findByLabelText("Conexão de IA")).toHaveValue("claude-id");
    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));

    expect(await screen.findByLabelText("Ideia ou roteiro do vídeo")).toHaveValue("ROTEIRO GERADO");
    expect(api.generateVideoStudioStage).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "roteiro",
        connection_id: "claude-id",
        prompt: expect.stringContaining("Uma médica retorna à cidade natal"),
      }),
    );
  });

  it("opens a saved Dark Channels script in the same project and uses registered AI connections", async () => {
    api.generateVideoStudioStage.mockResolvedValue({ text: "ROTEIRO DESENVOLVIDO", provider: "anthropic", model: "claude-sonnet-5-5" });
    renderStudio({
      initialDraft: { id: "dark-script-1", title: "História do farol", topic: "Um farol abandonado", script: "Abertura já aprovada", channelName: "Mistérios", channelAudience: "Público adulto", language: "Inglês", availableAssets: "Foto do farol (image): https://example.com/farol.png", niche: "História", format: "shorts" },
    });

    expect(await screen.findByLabelText("Ideia ou roteiro do vídeo")).toHaveValue("Abertura já aprovada");
    fireEvent.click(screen.getByRole("button", { name: /Direcionamento opcional/ }));
    expect(await screen.findByLabelText("Formato")).toHaveValue("9:16");
    expect(screen.getByLabelText("Idioma")).toHaveValue("Inglês");
    expect(screen.getByLabelText("Público-alvo / canal")).toHaveValue("Público adulto");
    expect(screen.getByLabelText("Mídias e elementos disponíveis (descrição)")).toHaveValue("Foto do farol (image): https://example.com/farol.png");
    expect(await screen.findByLabelText("Conexão de IA")).toHaveValue("claude-id");
    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));
    expect(await screen.findByLabelText("Ideia ou roteiro do vídeo")).toHaveValue("ROTEIRO DESENVOLVIDO");
    expect(api.generateVideoStudioStage).toHaveBeenCalledWith(expect.objectContaining({
      connection_id: "claude-id",
      prompt: expect.stringContaining("Abertura já aprovada"),
    }));
    expect(api.generateVideoStudioStage.mock.calls[0][0].prompt).toContain("availableAssets: Foto do farol (image): https://example.com/farol.png");
  });

  it("runs the complete eight-stage pipeline sequentially", async () => {
    api.generateVideoStudioStage.mockImplementation(async ({ stage }) => ({
      text: `Resultado ${stage}`,
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      connection_id: "claude-id",
    }));
    renderStudio();
    fireEvent.change(await screen.findByLabelText("Ideia ou roteiro do vídeo"), {
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

    await screen.findByLabelText("Ideia ou roteiro do vídeo");
    expect(screen.getAllByRole("tab", { name: /Novo projeto de vídeo/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Novo projeto" }));

    expect(await screen.findAllByRole("tab", { name: /Novo projeto de vídeo/ })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("tab", { name: /Novo projeto de vídeo/ })[0]);
    expect(screen.getAllByRole("tab", { selected: true, name: /Novo projeto de vídeo/ })).toHaveLength(1);
  });

  it("turns the generated shot list into editable scenes inside the same production flow", async () => {
    api.generateVideoStudioStage.mockResolvedValue({
      text: "Cena 1 — A médica chega ao hospital.\nCena 2 — Ela conversa com a equipe.",
      provider: "anthropic",
      model: "claude",
    });
    renderStudio();
    fireEvent.change(await screen.findByLabelText("Ideia ou roteiro do vídeo"), {
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
    fireEvent.change(await screen.findByLabelText("Ideia ou roteiro do vídeo"), {
      target: { value: "Uma ideia de documentário" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));
    expect(await screen.findByLabelText("Ideia ou roteiro do vídeo")).toHaveValue("ROTEIRO GERADO");
    fireEvent.click(screen.getByRole("button", { name: "Elementos" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Falha temporária");
    fireEvent.click(screen.getByRole("button", { name: "Roteiro" }));
    expect(screen.getByLabelText("Ideia ou roteiro do vídeo")).toHaveValue("ROTEIRO GERADO");
  });

  it("preserves old results but marks them for review after the idea changes", async () => {
    api.generateVideoStudioStage
      .mockResolvedValueOnce({ text: "ROTEIRO ORIGINAL", provider: "anthropic", model: "claude" })
      .mockResolvedValueOnce({ text: "ELEMENTOS ORIGINAIS", provider: "anthropic", model: "claude" });
    renderStudio();
    const idea = await screen.findByLabelText("Ideia ou roteiro do vídeo");
    fireEvent.change(idea, { target: { value: "Ideia original" } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));
    expect(await screen.findByLabelText("Ideia ou roteiro do vídeo")).toHaveValue("ROTEIRO ORIGINAL");

    fireEvent.click(screen.getByRole("button", { name: "Elementos" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar etapa atual" }));
    expect(await screen.findByLabelText("Resultado do elementos")).toHaveValue("ELEMENTOS ORIGINAIS");
    fireEvent.click(screen.getByRole("button", { name: "Roteiro" }));
    fireEvent.change(idea, { target: { value: "Ideia nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Elementos" }));
    expect(await screen.findByText(/etapa anterior foi alterada/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Roteiro" }));
    expect(screen.getByLabelText("Ideia ou roteiro do vídeo")).toHaveValue("Ideia nova");
    fireEvent.click(screen.getByRole("button", { name: "Elementos" }));
    expect(screen.getByLabelText("Resultado do elementos")).toHaveValue("ELEMENTOS ORIGINAIS");
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

  it("stores a dark-channel media file in that script's isolated workspace", async () => {
    const file = new File(["image"], "capa.png", { type: "image/png" });
    api.putVideoAsset.mockResolvedValue({ id: "dark-asset", projectId: "project-1", name: file.name, type: file.type, size: file.size });
    renderStudio({ workspaceKey: "canais-dark:channel-1:script-1", initialDraft: { id: "script-1", topic: "Mistério", script: "Roteiro" } });

    fireEvent.change(await screen.findByLabelText("Adicionar arquivos"), { target: { files: [file] } });

    await waitFor(() => expect(api.putVideoAsset).toHaveBeenCalledWith(file, expect.any(String), "canais-dark:channel-1:script-1"));
    await waitFor(() => expect(api.getVideoAsset).toHaveBeenCalledWith("dark-asset", "canais-dark:channel-1:script-1"));
  });
});
