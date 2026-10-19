import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listDarkChannels: vi.fn(),
  createDarkChannel: vi.fn(),
  updateDarkChannel: vi.fn(),
  listDarkChannelScripts: vi.fn(),
  createDarkChannelScript: vi.fn(),
  updateDarkChannelScript: vi.fn(),
}));
vi.mock("../../api/darkChannels", () => api);
vi.mock("../lib/empresaContext", () => ({
  useEmpresa: () => ({ currentEmpresa: { id: "tenant-1", nome: "Empresa" } }),
}));
vi.mock("./VideoGeneration", () => ({
  default: ({ initialDraft, workspaceKey, productLabel, embedded }) => <div data-testid="video-studio" data-topic={initialDraft?.topic} data-workspace={workspaceKey} data-product={productLabel} data-embedded={embedded}>{initialDraft?.script}</div>,
}));
vi.mock("./ClipsFree", () => ({
  default: ({ darkChannelId, darkScriptId, workspaceKey }) => <div data-testid="clipsfree-studio" data-channel={darkChannelId} data-script={darkScriptId} data-workspace={workspaceKey} />,
}));
vi.mock("./ThumbnailStudio", () => ({
  default: ({ darkChannelId, darkScriptId, workspaceKey, initialTitle }) => <div data-testid="thumbnail-studio" data-channel={darkChannelId} data-script={darkScriptId} data-workspace={workspaceKey} data-title={initialTitle} />,
}));

import DarkChannels from "./DarkChannels";

describe("Canais Dark", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listDarkChannels.mockResolvedValue({ channels: [{ id: "channel-1", name: "Histórias", niche: "História", format: "long", publishing_mode: "manual" }] });
    api.listDarkChannelScripts.mockImplementation(async (channelId) => ({ scripts: channelId === "channel-1" ? [{ id: "script-1", channel_id: "channel-1", topic: "A cidade perdida", title: "A cidade perdida", script: "Abertura original", status: "draft", validation_status: "pending" }] : [] }));
  });

  it("creates channels and topic scripts as persisted drafts", async () => {
    api.createDarkChannel.mockResolvedValue({ id: "new-channel", name: "Mistérios", niche: "Mistérios", format: "both", publishing_mode: "manual" });
    api.createDarkChannelScript.mockResolvedValue({ id: "new-script", channel_id: "new-channel", topic: "Novo tema", title: "Novo tema", script: "", status: "draft", validation_status: "pending" });
    render(<DarkChannels />);

    await screen.findByRole("button", { name: /Histórias/ });
    expect(screen.queryByLabelText("Nome do canal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo canal" }));
    fireEvent.change(screen.getByLabelText("Nome do canal"), { target: { value: "Mistérios" } });
    fireEvent.change(screen.getByLabelText("Nicho do canal"), { target: { value: "Mistérios" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar canal" }));
    await waitFor(() => expect(api.createDarkChannel).toHaveBeenCalledWith({
      name: "Mistérios", niche: "Mistérios", audience: "", language: "pt-BR", format: "long", publishing_mode: "manual",
    }));

    expect(await screen.findByRole("heading", { name: "Mistérios" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo roteiro" }));
    fireEvent.change(screen.getByLabelText("Tema do novo roteiro"), { target: { value: "Novo tema" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar", exact: true }));
    await waitFor(() => expect(api.createDarkChannelScript).toHaveBeenCalledWith("new-channel", { topic: "Novo tema", title: "Novo tema" }));
  });

  it("keeps the empty channel view compact and does not pull MediaMind production content", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [] });
    render(<DarkChannels />);

    expect(await screen.findByText("Nenhum canal cadastrado ainda." )).toBeInTheDocument();
    expect(screen.queryByText(/Acervo MediaMind|materiais disponíveis no acervo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nome do canal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo canal" }));
    expect(screen.getByLabelText("Nome do canal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("opens a saved script in the shared video workflow and keeps publishing manual by default", async () => {
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Pastas e roteiros" }));
    fireEvent.click(await screen.findByRole("button", { name: /A cidade perdida/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Abrir no pipeline/ }));

    expect(await screen.findByTestId("video-studio")).toHaveAttribute("data-topic", "A cidade perdida");
    expect(screen.getByTestId("video-studio")).toHaveAttribute("data-workspace", "canais-dark:channel-1:script-1");
    expect(screen.getByTestId("video-studio")).toHaveAttribute("data-product", "Canais Dark · geração audiovisual");
    expect(screen.getByTestId("video-studio")).toHaveTextContent("Abertura original");
    expect(screen.getByLabelText("Publicação do canal")).toHaveValue("manual");
    expect(screen.queryByLabelText(/chave.*api/i)).not.toBeInTheDocument();
  });

  it("keeps the complete generation pipeline accessible before a channel has been selected", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [] });
    render(<DarkChannels />);

    fireEvent.click(await screen.findByRole("tab", { name: "Gerar vídeos" }));

    expect(await screen.findByTestId("video-studio")).toHaveAttribute("data-workspace", "canais-dark:rascunho-avulso");
    expect(screen.getByText(/Ao selecionar um canal e roteiro, o contexto deles será enviado ao pipeline automaticamente/)).toBeInTheDocument();
  });

  it("embeds the existing ClipsFree screen in the channel cuts tab with isolated channel and script identifiers", async () => {
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Cortes" }));

    expect(await screen.findByTestId("clipsfree-studio")).toHaveAttribute("data-channel", "channel-1");
    expect(screen.getByTestId("clipsfree-studio")).toHaveAttribute("data-script", "script-1");
    expect(screen.getByTestId("clipsfree-studio")).toHaveAttribute("data-workspace", "canais-dark:channel-1:script-1:cuts");
  });

  it("embeds the existing art studio for the selected channel script", async () => {
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Thumbs" }));

    expect(await screen.findByTestId("thumbnail-studio")).toHaveAttribute("data-channel", "channel-1");
    expect(screen.getByTestId("thumbnail-studio")).toHaveAttribute("data-script", "script-1");
    expect(screen.getByTestId("thumbnail-studio")).toHaveAttribute("data-title", "A cidade perdida");
  });

  it("keeps production stages available without a selected script and unlocks materials only after the first script", async () => {
    api.listDarkChannelScripts.mockResolvedValue({ scripts: [] });
    api.createDarkChannelScript.mockResolvedValue({ id: "first-script", channel_id: "channel-1", topic: "Primeiro tema", title: "Primeiro tema", script: "", status: "draft", validation_status: "pending" });
    render(<DarkChannels />);
    const materialsTab = await screen.findByRole("tab", { name: "Materiais" });
    expect(materialsTab).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Pastas e roteiros" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Gerar vídeos" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Thumbs" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Cortes" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Revisão final" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Agendados e publicados" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Analytics" })).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", { name: "Gerar vídeos" }));
    expect(await screen.findByTestId("video-studio")).toHaveAttribute("data-workspace", "canais-dark:channel-1:projeto-livre");
    fireEvent.click(screen.getByRole("tab", { name: "Thumbs" }));
    expect(await screen.findByTestId("thumbnail-studio")).toHaveAttribute("data-workspace", "canais-dark:channel-1:canal:thumbs");
    fireEvent.click(screen.getByRole("tab", { name: "Cortes" }));
    expect((await screen.findByTestId("clipsfree-studio")).getAttribute("data-script")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Novo roteiro" }));
    fireEvent.change(screen.getByLabelText("Tema do novo roteiro"), { target: { value: "Primeiro tema" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar", exact: true }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Materiais" })).toBeEnabled());
    expect(api.createDarkChannelScript).toHaveBeenCalledWith("channel-1", { topic: "Primeiro tema", title: "Primeiro tema" });
  });

  it("exposes each channel script as a persistent in-page tab for switching without returning to the scripts stage", async () => {
    api.listDarkChannelScripts.mockResolvedValue({ scripts: [
      { id: "script-1", channel_id: "channel-1", topic: "A cidade perdida", title: "A cidade perdida", script: "Abertura original", status: "draft", validation_status: "pending" },
      { id: "script-2", channel_id: "channel-1", topic: "Outra história", title: "Outra história", script: "Outro texto", status: "draft", validation_status: "pending" },
    ] });
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Gerar vídeos" }));
    const scriptTabs = await screen.findByRole("tablist", { name: "Roteiros do canal" });
    expect(within(scriptTabs).getByRole("tab", { name: "A cidade perdida" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(scriptTabs).getByRole("tab", { name: "Outra história" }));
    expect(within(scriptTabs).getByRole("tab", { name: "Outra história" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByTestId("video-studio")).toHaveTextContent("Outro texto");
    fireEvent.click(within(scriptTabs).getByRole("tab", { name: "Todo o canal" }));
    expect(within(scriptTabs).getByRole("tab", { name: "Todo o canal" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByTestId("video-studio")).toHaveAttribute("data-workspace", "canais-dark:channel-1:projeto-livre");
  });

  it("provides separate workflow tabs for every channel-production stage", async () => {
    render(<DarkChannels />);

    const tabs = await screen.findByRole("tablist", { name: "Etapas do canal" });
    expect(tabs.querySelectorAll('[role="tab"]')).toHaveLength(9);
    expect(screen.getByRole("tab", { name: "Canais" })).toHaveAttribute("aria-selected", "true");

    const stages = ["Pastas e roteiros", "Materiais", "Gerar vídeos", "Thumbs", "Cortes", "Revisão final", "Agendados e publicados", "Analytics"];
    for (const stage of stages) {
      fireEvent.click(screen.getByRole("tab", { name: stage }));
      expect(screen.getByRole("tabpanel", { name: stage })).toBeInTheDocument();
    }
  });

  it("keeps folders and original materials in the independent channel, linking them to scripts only on request", async () => {
    let savedWorkflow = {};
    api.updateDarkChannel.mockImplementation(async (id, patch) => ({ id, name: "Histórias", niche: "História", ...patch }));
    api.updateDarkChannelScript.mockImplementation(async (channelId, scriptId, patch) => ({
      id: scriptId, channel_id: channelId, topic: "A cidade perdida", title: "A cidade perdida", script: "Abertura original", status: "draft", validation_status: "pending",
      workflow: savedWorkflow = { ...savedWorkflow, ...(patch.workflow || {}) },
    }));
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Pastas e roteiros" }));

    fireEvent.change(screen.getByLabelText("Nome da pasta de assuntos"), { target: { value: "Civilizações" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pasta" }));
    await waitFor(() => expect(api.updateDarkChannel).toHaveBeenCalledWith("channel-1", { topic_folders: ["Civilizações"] }));
    fireEvent.click(screen.getByRole("button", { name: "Civilizações" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { workflow: { folder_name: "Civilizações" } }));

    fireEvent.click(screen.getByRole("tab", { name: "Materiais" }));
    fireEvent.change(screen.getByLabelText("Nome do material"), { target: { value: "Vídeo próprio" } });
    fireEvent.change(screen.getByLabelText("Link do material"), { target: { value: "https://example.com/video.mp4" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    await waitFor(() => expect(api.updateDarkChannel).toHaveBeenLastCalledWith("channel-1", {
      materials: [{ title: "Vídeo próprio", reference: "https://example.com/video.mp4", kind: "link" }],
    }));
    expect(await screen.findByText("Vídeo próprio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Vincular ao roteiro" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenLastCalledWith("channel-1", "script-1", {
      workflow: { materials: [{ title: "Vídeo próprio", reference: "https://example.com/video.mp4", kind: "link" }] },
    }));
  });

  it("persists final publication metadata on the channel's own script", async () => {
    api.updateDarkChannelScript.mockImplementation(async (channelId, scriptId, changes) => ({
      id: scriptId,
      channel_id: channelId,
      topic: "A cidade perdida",
      title: changes.title || "A cidade perdida",
      script: "Abertura original",
      status: "draft",
      validation_status: "pending",
      workflow: { ...changes.workflow, metrics: { views: 0, likes: 0, comments: 0 } },
    }));
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Pastas e roteiros" }));
    fireEvent.click(await screen.findByRole("button", { name: /A cidade perdida/ }));
    fireEvent.click(screen.getByRole("tab", { name: "Revisão final" }));
    fireEvent.change(screen.getByLabelText("Título de publicação"), { target: { value: "A história que ninguém contou" } });
    fireEvent.change(screen.getByLabelText("Descrição do vídeo"), { target: { value: "Descrição independente" } });
    fireEvent.change(screen.getByLabelText("Título da thumbnail"), { target: { value: "A cidade revelada" } });
    fireEvent.change(screen.getByLabelText("Imagem da thumbnail"), { target: { value: "https://cdn.example/thumb.png" } });
    fireEvent.change(screen.getByLabelText("Formato do vídeo"), { target: { value: "9:16" } });
    fireEvent.click(screen.getByLabelText("YouTube"));
    fireEvent.change(screen.getByLabelText("Data e hora de publicação"), { target: { value: "2026-11-02T14:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão e programação" }));

    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", {
      workflow: {
        final_title: "A história que ninguém contou", description: "Descrição independente", tags: [],
        thumbnail_title: "A cidade revelada", thumbnail_reference: "https://cdn.example/thumb.png",
        video_format: "9:16", target_channels: ["youtube"], scheduled_at: new Date("2026-11-02T14:30").toISOString(),
      },
      title: "A história que ninguém contou",
    }));
  });

  it("shows scheduled and published scripts from channel data in one publishing list", async () => {
    api.listDarkChannelScripts.mockResolvedValue({ scripts: [
      { id: "scheduled-1", topic: "Vídeo futuro", title: "Vídeo futuro", script: "", status: "approved", workflow: { final_title: "Lançamento", scheduled_at: "2026-11-02T14:30:00Z", target_channels: ["youtube"] } },
      { id: "published-1", topic: "Vídeo publicado", title: "Vídeo publicado", script: "", status: "approved", workflow: { final_title: "Já foi ao ar", publication_url: "https://youtube.com/watch?v=real", published_at: "2026-10-01T12:00:00Z" } },
      { id: "draft-1", topic: "Rascunho", title: "Rascunho", script: "", status: "draft", workflow: {} },
    ] });
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Agendados e publicados" }));

    expect(await screen.findByRole("button", { name: /Lançamento.*Agendado/ })).toHaveTextContent("YouTube");
    expect(screen.getByRole("button", { name: /Já foi ao ar.*Publicado/ })).toHaveTextContent("youtube.com/watch?v=real");
    const publishingPanel = screen.getByRole("tabpanel", { name: "Agendados e publicados" });
    expect(within(publishingPanel).queryByRole("button", { name: /Rascunho/ })).not.toBeInTheDocument();
  });

  it("does not present manually entered or mock metrics as live social analytics", async () => {
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Analytics" }));

    expect(await screen.findByText("Nenhuma rede social conectada")).toBeInTheDocument();
    expect(screen.getByText(/não mostramos números de demonstração/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Visualizações")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Curtidas")).not.toBeInTheDocument();
  });
});
