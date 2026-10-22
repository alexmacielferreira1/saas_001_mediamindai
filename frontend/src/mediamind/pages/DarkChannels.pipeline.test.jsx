import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listDarkChannels: vi.fn(),
  createDarkChannel: vi.fn(),
  updateDarkChannel: vi.fn(),
  listDarkChannelScripts: vi.fn(),
  createDarkChannelScript: vi.fn(),
  updateDarkChannelScript: vi.fn(),
  getDarkStructure: vi.fn(),
  listDarkStructureTemplates: vi.fn(),
}));
vi.mock("../../api/darkChannels", () => api);
vi.mock("../lib/empresaContext", () => ({
  useEmpresa: () => ({ currentEmpresa: { id: "tenant-1", nome: "Empresa" } }),
}));
vi.mock("./VideoGeneration", () => ({
  default: ({ initialDraft, workspaceKey, onDraftChange }) => <div data-testid="video-studio" data-workspace={workspaceKey} data-draft={JSON.stringify(initialDraft || null)}>
    {onDraftChange && <button type="button" onClick={() => onDraftChange("Texto vindo do pipeline")}>Alterar no pipeline</button>}
  </div>,
}));
vi.mock("./ClipsFree", () => ({
  default: ({ darkScriptId, onDraftChange }) => <div data-testid="clipsfree-studio" data-script={darkScriptId}>
    <button type="button" onClick={() => onDraftChange({ suggestions: [{ title: "Gancho", start: 0, end: 12 }, { start: "x", end: 0 }, { start: 5, end: 9 }] })}>Sugerir cortes</button>
    <button type="button" onClick={() => onDraftChange({})}>Sessão vazia</button>
  </div>,
}));
vi.mock("./ThumbnailStudio", () => ({
  default: ({ thumbnailContext, initialTitle }) => <div data-testid="thumbnail-studio" data-title={initialTitle} data-context={JSON.stringify(thumbnailContext)} />,
}));

import DarkChannels from "./DarkChannels";

// Etapas do pipeline de produção do Canais Dark (aba "Pastas e roteiros" em diante).
const channel = { id: "channel-1", name: "Histórias", niche: "História", topic_folders: ["Reis"], materials: [{ title: "Mapa", reference: "https://cdn.example/mapa.png", kind: "image" }] };
const baseScripts = () => [
  { id: "script-1", channel_id: "channel-1", topic: "A cidade perdida", title: "A cidade perdida", script: "Abertura", status: "draft", validation_status: "pending", workflow: { materials: [{ title: "Mapa", reference: "https://cdn.example/mapa.png", kind: "image" }], scheduled_at: "2026-11-02T14:30:00Z", target_channels: ["youtube"], metrics: { views: 9 } } },
  { id: "script-2", channel_id: "channel-1", topic: "Só tema", script: "", status: "draft", validation_status: "pending" },
  { id: "script-3", channel_id: "channel-1", topic: "Arquivado", title: "Arquivado", script: "", status: "archived" },
];

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.listDarkChannels.mockResolvedValue({ channels: [channel] });
  api.getDarkStructure.mockResolvedValue({ languages: [], niches: [], decisions: [] });
  api.listDarkStructureTemplates.mockResolvedValue({ templates: [] });
  api.listDarkChannelScripts.mockResolvedValue({ scripts: baseScripts() });
  api.updateDarkChannelScript.mockImplementation(async (channelId, scriptId, changes) => ({
    ...baseScripts().find((item) => item.id === scriptId), ...changes, workflow: { ...(baseScripts().find((item) => item.id === scriptId).workflow || {}), ...(changes.workflow || {}) },
  }));
  api.updateDarkChannel.mockImplementation(async (id, patch) => ({ ...channel, ...patch, id }));
});

async function openStage(name) {
  render(<DarkChannels />);
  await screen.findByRole("button", { name: /^Histórias/ });
  await waitFor(() => expect(screen.getByRole("tab", { name: "Materiais" })).toBeEnabled());
  fireEvent.click(screen.getByRole("tab", { name }));
}

describe("Canais Dark · roteiros e salvamento automático", () => {
  it("autosaves typed script text, saves on blur and on demand, and reports failures without losing the draft", async () => {
    await openStage("Pastas e roteiros");
    const text = await screen.findByLabelText("Texto do roteiro");
    fireEvent.change(text, { target: { value: "Novo texto" } });
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { script: "Novo texto" }), { timeout: 3000 });
    expect(await screen.findByRole("status")).toHaveTextContent("Roteiro salvo automaticamente.");

    api.updateDarkChannelScript.mockRejectedValueOnce(new Error("Sem conexão.")).mockRejectedValueOnce({});
    fireEvent.change(text, { target: { value: "Texto 2" } });
    fireEvent.blur(text);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão.");
    fireEvent.click(screen.getByRole("button", { name: "Salvar roteiro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar o roteiro."));
    fireEvent.click(screen.getByRole("button", { name: "Salvar roteiro" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Roteiro salvo.");
    expect(api.updateDarkChannelScript).toHaveBeenLastCalledWith("channel-1", "script-1", { script: "Texto 2" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends a script to validation, approves it and shows update errors", async () => {
    await openStage("Pastas e roteiros");
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para validação" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { status: "in_review" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Etapa do roteiro atualizada.");
    const approve = screen.getByRole("button", { name: "Aprovar roteiro" });
    await waitFor(() => expect(approve).toBeEnabled());
    api.updateDarkChannelScript.mockRejectedValueOnce(new Error("Somente revisores aprovam.")).mockRejectedValueOnce({});
    fireEvent.click(approve);
    expect(await screen.findByRole("alert")).toHaveTextContent("Somente revisores aprovam.");
    fireEvent.click(screen.getByRole("button", { name: "Aprovar roteiro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível atualizar o roteiro."));
  });

  it("flushes a pending save when leaving the stage or switching script", async () => {
    await openStage("Pastas e roteiros");
    const text = await screen.findByLabelText("Texto do roteiro");
    fireEvent.change(text, { target: { value: "Antes de sair" } });
    fireEvent.click(screen.getByRole("tab", { name: "Analytics" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { script: "Antes de sair" }));
    expect(await screen.findByText(/Roteiro em contexto: A cidade perdida · redes desejadas: youtube/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Pastas e roteiros" }));
    fireEvent.change(await screen.findByLabelText("Texto do roteiro"), { target: { value: "Ao trocar" } });
    fireEvent.click(screen.getByRole("button", { name: /Só tema/ }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { script: "Ao trocar" }));
    expect(screen.getByRole("heading", { level: 4, name: "Só tema" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar para validação" })).toBeDisabled();
  });

  it("saves the pending text when the page is closed before the autosave timer", async () => {
    const view = render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Pastas e roteiros" }));
    fireEvent.change(await screen.findByLabelText("Texto do roteiro"), { target: { value: "Fechando a aba" } });
    view.unmount();
    expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { script: "Fechando a aba" });
  });

  it("creates scripts from the scripts stage and reports creation errors", async () => {
    api.createDarkChannelScript.mockRejectedValueOnce(new Error("Limite de roteiros.")).mockRejectedValueOnce({});
    await openStage("Pastas e roteiros");
    fireEvent.change(screen.getByLabelText("Tema do roteiro"), { target: { value: "  Novo tema  " } });
    fireEvent.click(screen.getByRole("button", { name: "Criar roteiro" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite de roteiros.");
    fireEvent.click(screen.getByRole("button", { name: "Criar roteiro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível criar o roteiro."));
    expect(api.createDarkChannelScript).toHaveBeenCalledWith("channel-1", { topic: "Novo tema", title: "Novo tema" });
    fireEvent.change(screen.getByLabelText("Tema do roteiro"), { target: { value: "   " } });
    fireEvent.submit(screen.getByLabelText("Tema do roteiro").closest("form"));
    expect(api.createDarkChannelScript).toHaveBeenCalledTimes(2);
  });

  it("adds folders, assigns and clears them, and reports folder errors", async () => {
    api.updateDarkChannel.mockRejectedValueOnce(new Error("Pasta recusada.")).mockRejectedValueOnce({});
    await openStage("Pastas e roteiros");
    fireEvent.change(screen.getByLabelText("Nome da pasta de assuntos"), { target: { value: "Reis" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pasta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pasta recusada.");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pasta" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível criar a pasta."));
    expect(api.updateDarkChannel).toHaveBeenCalledWith("channel-1", { topic_folders: ["Reis"] });
    fireEvent.submit(screen.getByLabelText("Nome da pasta de assuntos").closest("form"));
    await waitFor(() => expect(api.updateDarkChannel).toHaveBeenCalledTimes(3));
    expect(await screen.findByRole("status")).toHaveTextContent("Pasta de assunto criada neste canal.");
    expect(screen.getByLabelText("Nome da pasta de assuntos")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Reis" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { workflow: { folder_name: "Reis" } }));
    fireEvent.click(await screen.findByRole("button", { name: "Sem pasta" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenLastCalledWith("channel-1", "script-1", { workflow: { folder_name: "" } }));
    api.updateDarkChannelScript.mockRejectedValueOnce(new Error("Etapa recusada.")).mockRejectedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Reis" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Etapa recusada.");
    fireEvent.click(screen.getByRole("button", { name: "Reis" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar esta etapa."));
  });

  it("handles script lists without items, failed loads and late answers after the channel changed", async () => {
    let lateResolve;
    let lateReject;
    api.listDarkChannels.mockResolvedValue({ channels: [channel, { id: "channel-2", name: "Mistérios", niche: "Mistérios" }, { id: "channel-3", name: "Lendas", niche: "Lendas" }] });
    api.listDarkChannelScripts
      .mockReturnValueOnce(new Promise((resolve) => { lateResolve = resolve; }))
      .mockReturnValueOnce(new Promise((_resolve, reject) => { lateReject = reject; }))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Roteiros indisponíveis."))
      .mockRejectedValueOnce({});
    render(<DarkChannels />);
    await screen.findByRole("button", { name: /^Histórias/ });
    fireEvent.click(screen.getByRole("button", { name: /^Mistérios/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Lendas/ }));
    await act(async () => { lateResolve({ scripts: baseScripts() }); lateReject(new Error("tarde")); });
    expect(screen.queryByText("tarde")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Visão do canal" })).toHaveTextContent("0 roteiros");
    fireEvent.click(screen.getByRole("button", { name: /^Mistérios/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Roteiros indisponíveis.");
    fireEvent.click(screen.getByRole("button", { name: /^Histórias/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar os roteiros."));
  });
});

describe("Canais Dark · materiais, vídeo, cortes e thumbs", () => {
  it("rejects duplicate materials, reports material errors and does not link the same material twice", async () => {
    api.updateDarkChannel.mockRejectedValueOnce(new Error("Material recusado.")).mockRejectedValueOnce({});
    await openStage("Materiais");
    expect(screen.getByText("Canal: Histórias · roteiro ativo: A cidade perdida")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prévia ↗" })).toHaveAttribute("href", "https://cdn.example/mapa.png");
    expect(screen.getByRole("button", { name: "No roteiro" })).toBeDisabled();
    expect(screen.getByText("1 materiais vinculados ao roteiro “A cidade perdida”.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome do material"), { target: { value: "Mapa de novo" } });
    fireEvent.change(screen.getByLabelText("Link do material"), { target: { value: "https://cdn.example/mapa.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Este material já está cadastrado neste canal.");

    fireEvent.change(screen.getByLabelText("Link do material"), { target: { value: "https://cdn.example/voz.mp3" } });
    fireEvent.change(screen.getByLabelText("Tipo do material"), { target: { value: "audio" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Material recusado.");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar o material no canal."));
    fireEvent.change(screen.getByLabelText("Nome do material"), { target: { value: "   " } });
    fireEvent.submit(screen.getByLabelText("Nome do material").closest("form"));
    expect(api.updateDarkChannel).toHaveBeenCalledTimes(2);
  });

  it("links channel materials to a script and reports linking errors", async () => {
    api.updateDarkChannelScript.mockRejectedValueOnce(new Error("Vínculo recusado.")).mockRejectedValueOnce({});
    await openStage("Materiais");
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Só tema" }));
    expect(screen.getByText("Canal: Histórias · roteiro ativo: Só tema")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vincular ao roteiro" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vínculo recusado.");
    fireEvent.click(screen.getByRole("button", { name: "Vincular ao roteiro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível vincular o material ao roteiro."));
    api.updateDarkChannelScript.mockResolvedValueOnce({ ...baseScripts()[1] });
    fireEvent.click(screen.getByRole("button", { name: "Vincular ao roteiro" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Material do canal vinculado ao roteiro selecionado.");
    expect(screen.getByRole("button", { name: "No roteiro" })).toBeDisabled();

    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Todo o canal" }));
    expect(screen.queryByRole("button", { name: /Vincular ao roteiro|No roteiro/ })).not.toBeInTheDocument();
  });

  it("shows the empty material state for a channel without materials", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [{ id: "channel-1", name: "Histórias", niche: "História" }] });
    await openStage("Materiais");
    expect(screen.getByText("Nenhum material próprio cadastrado neste canal ainda.")).toBeInTheDocument();
  });

  it("sends the opened script with its linked materials and channel defaults to the video pipeline and autosaves its edits", async () => {
    await openStage("Pastas e roteiros");
    fireEvent.click(await screen.findByRole("button", { name: /Abrir no pipeline/ }));
    const studio = await screen.findByTestId("video-studio");
    expect(JSON.parse(studio.dataset.draft)).toEqual({
      id: "script-1", title: "A cidade perdida", topic: "A cidade perdida", script: "Abertura", channelName: "Histórias", channelAudience: "",
      language: "pt-BR", availableAssets: "Mapa (image): https://cdn.example/mapa.png", niche: "História", format: "long",
    });
    fireEvent.click(screen.getByRole("button", { name: "Alterar no pipeline" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { script: "Texto vindo do pipeline" }), { timeout: 3000 });

    fireEvent.click(screen.getByRole("tab", { name: "Pastas e roteiros" }));
    fireEvent.click(screen.getByRole("button", { name: /Só tema/ }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir no pipeline/ }));
    expect(JSON.parse((await screen.findByTestId("video-studio")).dataset.draft)).toMatchObject({ id: "script-2", title: "Só tema", script: "", availableAssets: "" });
  });

  it("uses the selected script as video context without opening it explicitly and keeps channel data", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [{ ...channel, audience: "Adultos", language: "en-US", format: "shorts" }] });
    await openStage("Gerar vídeos");
    const studio = await screen.findByTestId("video-studio");
    expect(JSON.parse(studio.dataset.draft)).toMatchObject({ id: "script-1", channelAudience: "Adultos", language: "en-US", format: "shorts", availableAssets: "Mapa (image): https://cdn.example/mapa.png" });
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Só tema" }));
    expect(JSON.parse(screen.getByTestId("video-studio").dataset.draft)).toMatchObject({ id: "script-2", title: "Só tema", script: "", availableAssets: "" });
    fireEvent.click(screen.getByRole("button", { name: "Alterar no pipeline" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-2", { script: "Texto vindo do pipeline" }), { timeout: 3000 });
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Todo o canal" }));
    expect(JSON.parse(screen.getByTestId("video-studio").dataset.draft)).toEqual({ channelName: "Histórias", channelAudience: "Adultos", language: "en-US", niche: "História", format: "shorts" });
    expect(screen.queryByRole("button", { name: "Alterar no pipeline" })).not.toBeInTheDocument();
  });

  it("keeps valid cut suggestions from ClipsFree in the script draft only when a script is selected", async () => {
    await openStage("Cortes");
    expect(screen.getByTestId("clipsfree-studio")).toHaveAttribute("data-script", "script-1");
    fireEvent.click(screen.getByRole("button", { name: "Sugerir cortes" }));
    fireEvent.click(screen.getByRole("button", { name: "Sessão vazia" }));
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Todo o canal" }));
    fireEvent.click(screen.getByRole("button", { name: "Sugerir cortes" }));
    expect(screen.getByTestId("clipsfree-studio").getAttribute("data-script")).toBeNull();
    expect(api.updateDarkChannelScript).not.toHaveBeenCalled();
  });

  it("passes channel, folders, scripts and the edited script text to the art studio", async () => {
    await openStage("Pastas e roteiros");
    fireEvent.change(await screen.findByLabelText("Texto do roteiro"), { target: { value: "Texto em edição" } });
    fireEvent.click(screen.getByRole("tab", { name: "Thumbs" }));
    const context = JSON.parse((await screen.findByTestId("thumbnail-studio")).dataset.context);
    expect(context.folders).toEqual(["Reis"]);
    expect(context.scripts[0].script).toBe("Texto em edição");
    expect(context.scripts[1].script).toBe("");
    expect(context.selectedScript).toMatchObject({ title: "A cidade perdida", script: "Texto em edição" });
    expect(context.materials).toHaveLength(1);
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Todo o canal" }));
    expect(JSON.parse(screen.getByTestId("thumbnail-studio").dataset.context).selectedScript).toBeNull();
    expect(screen.getByTestId("thumbnail-studio")).toHaveAttribute("data-title", "Histórias");
  });
});

describe("Canais Dark · revisão, publicação e canal", () => {
  it("reviews tags, thumbnail preview and networks, keeps existing schedule and reports save errors", async () => {
    await openStage("Revisão final");
    expect(screen.getByLabelText("Título de publicação")).toHaveValue("A cidade perdida");
    fireEvent.change(screen.getByLabelText("Tags do vídeo"), { target: { value: "história, , mistério" } });
    fireEvent.change(screen.getByLabelText("Imagem da thumbnail"), { target: { value: "https://cdn.example/thumb.png" } });
    expect(screen.getByRole("img", { name: "Prévia da thumbnail" })).toHaveAttribute("src", "https://cdn.example/thumb.png");
    fireEvent.click(screen.getByLabelText("Instagram"));
    fireEvent.click(screen.getByLabelText("YouTube"));
    fireEvent.change(screen.getByLabelText("Data e hora de publicação"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão e programação" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", {
      workflow: expect.objectContaining({ tags: ["história", "mistério"], target_channels: ["instagram"], scheduled_at: "" }),
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("Etapa salva no registro próprio do Canais Dark.");

    api.updateDarkChannelScript.mockRejectedValueOnce(new Error("Revisão recusada."));
    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão e programação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Revisão recusada.");
    fireEvent.click(screen.getByRole("button", { name: "Enviar para validação" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenLastCalledWith("channel-1", "script-1", { status: "in_review" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Aprovar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenLastCalledWith("channel-1", "script-1", { status: "approved" }));
    expect(screen.getByText(/Status atual: approved/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir e conferir no Estúdio de Arte" }));
    expect(screen.getByRole("tab", { name: "Thumbs" })).toHaveAttribute("aria-selected", "true");
  });

  it("omits empty schedule fields for a script that never had them and asks for a script when none is selected", async () => {
    api.updateDarkChannelScript.mockImplementation(async (_channelId, scriptId, changes) => ({ ...baseScripts()[1], ...changes }));
    await openStage("Revisão final");
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Só tema" }));
    expect(screen.getByLabelText("Título de publicação")).toHaveValue("Só tema");
    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão e programação" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledTimes(1));
    const [, , changes] = api.updateDarkChannelScript.mock.calls[0];
    expect(changes.workflow).not.toHaveProperty("scheduled_at");
    expect(changes.workflow).not.toHaveProperty("target_channels");
    expect(changes).toEqual({ workflow: expect.objectContaining({ final_title: "Só tema" }), title: "Só tema" });
    expect(await screen.findByRole("status")).toHaveTextContent("Etapa salva");
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar revisão e programação" })).toBeEnabled());

    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Todo o canal" }));
    expect(screen.getByText(/Escolha uma aba de roteiro acima/)).toBeInTheDocument();
  });

  it("lists the publication queue, selects a script from it and registers an external publication", async () => {
    api.listDarkChannelScripts.mockResolvedValue({ scripts: [
      ...baseScripts(),
      { id: "script-4", topic: "Sem rede", script: "", status: "approved", workflow: { publication_url: "https://youtube.com/watch?v=x" } },
      { id: "script-5", topic: "Outra rede", script: "", status: "approved", workflow: { published_at: "2026-09-01T10:00:00Z", target_channels: ["kwai"] } },
    ] });
    api.updateDarkChannelScript.mockRejectedValueOnce({});
    await openStage("Agendados e publicados");
    const panel = screen.getByRole("tabpanel", { name: "Agendados e publicados" });
    expect(within(panel).getByRole("button", { name: /Sem rede.*Publicado/ })).toHaveTextContent("Rede não definida · URL registrada");
    expect(within(panel).getByRole("button", { name: /Outra rede.*Publicado/ })).toHaveTextContent("kwai · 2026-09-01T10:00:00Z");
    fireEvent.click(within(panel).getByRole("button", { name: /Sem rede/ }));
    expect(screen.getByLabelText("URL publicada")).toHaveValue("https://youtube.com/watch?v=x");
    fireEvent.click(within(panel).getByRole("button", { name: /A cidade perdida.*Agendado/ }));
    expect(screen.getByRole("button", { name: "Registrar publicação" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("URL publicada"), { target: { value: "https://youtube.com/watch?v=novo" } });
    fireEvent.change(screen.getByLabelText("Data publicada"), { target: { value: "2026-11-03T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar publicação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar esta etapa.");
    fireEvent.click(screen.getByRole("button", { name: "Registrar publicação" }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenLastCalledWith("channel-1", "script-1", {
      workflow: { publication_url: "https://youtube.com/watch?v=novo", published_at: new Date("2026-11-03T10:00").toISOString() },
    }));
    fireEvent.change(screen.getByLabelText("Data publicada"), { target: { value: "" } });
    expect(screen.getByLabelText("Data publicada")).toHaveValue("");
  });

  it("keeps the publication queue empty without dates and hides the external form without a script", async () => {
    api.listDarkChannelScripts.mockResolvedValue({ scripts: [] });
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Agendados e publicados" }));
    expect(await screen.findByText(/Ainda não há vídeos agendados nem publicados/)).toBeInTheDocument();
    expect(screen.queryByLabelText("URL publicada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Analytics" }));
    expect(screen.queryByText(/Roteiro em contexto/)).not.toBeInTheDocument();
  });

  it("switches the publishing mode back to manual and reports publishing-mode errors", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [{ ...channel, publishing_mode: "automatic" }] });
    api.updateDarkChannel.mockRejectedValueOnce(new Error("Integração ausente.")).mockRejectedValueOnce({});
    await openStage("Analytics");
    const select = screen.getByLabelText("Publicação do canal");
    expect(select).toHaveValue("automatic");
    fireEvent.change(select, { target: { value: "manual" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Integração ausente.");
    fireEvent.change(screen.getByLabelText("Publicação do canal"), { target: { value: "manual" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar a opção de publicação."));
    fireEvent.change(screen.getByLabelText("Publicação do canal"), { target: { value: "manual" } });
    expect(await screen.findByRole("status")).toHaveTextContent("Publicação manual selecionada.");
    expect(screen.getByLabelText("Publicação do canal")).toHaveValue("manual");
  });

  it("keeps the selected channel after reloading the list and ignores archived channels for the first selection", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [{ id: "old", name: "Antigo", niche: "X", archived: true }, channel] });
    render(<DarkChannels />);
    expect(await screen.findByRole("button", { name: /^Histórias/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(api.listDarkChannelScripts).toHaveBeenCalledWith("channel-1"));
    expect(api.listDarkChannelScripts).not.toHaveBeenCalledWith("old");
  });
});

describe("Canais Dark · falhas de gravação e dados incompletos", () => {
  it("keeps navigating while a pending script save keeps failing, retrying it on every move", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [channel, { id: "channel-2", name: "Mistérios", niche: "Mistérios" }] });
    await openStage("Pastas e roteiros");
    api.updateDarkChannelScript.mockRejectedValue(new Error("Servidor fora do ar."));
    fireEvent.change(await screen.findByLabelText("Texto do roteiro"), { target: { value: "Rascunho que não salva" } });
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("Servidor fora do ar.");
    const calls = () => api.updateDarkChannelScript.mock.calls.length;
    let before = calls();
    fireEvent.click(screen.getByRole("button", { name: /Só tema/ }));
    await waitFor(() => expect(calls()).toBeGreaterThan(before));
    before = calls();
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "A cidade perdida" }));
    await waitFor(() => expect(calls()).toBeGreaterThan(before));
    before = calls();
    fireEvent.click(screen.getByRole("tab", { name: "Analytics" }));
    await waitFor(() => expect(calls()).toBeGreaterThan(before));
    before = calls();
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Todo o canal" }));
    await waitFor(() => expect(calls()).toBeGreaterThan(before));
    before = calls();
    fireEvent.click(screen.getByRole("tab", { name: "Canais" }));
    fireEvent.click(screen.getByRole("button", { name: /^Mistérios/ }));
    await waitFor(() => expect(calls()).toBeGreaterThan(before));
    expect(screen.getByRole("alert")).toHaveTextContent("Servidor fora do ar.");
    for (const call of api.updateDarkChannelScript.mock.calls) expect(call).toEqual(["channel-1", "script-1", { script: "Rascunho que não salva" }]);
  });

  it("ignores a second folder assignment while the first is saving and empty folder names", async () => {
    let finish;
    api.listDarkChannels.mockResolvedValue({ channels: [{ id: "channel-1", name: "Histórias", niche: "História" }, { id: "channel-2", name: "Mistérios", niche: "Mistérios" }] });
    api.updateDarkChannel.mockImplementation(async (id, patch) => ({ id, name: "Histórias", niche: "História", ...patch }));
    await openStage("Pastas e roteiros");
    fireEvent.submit(screen.getByLabelText("Nome da pasta de assuntos").closest("form"));
    expect(api.updateDarkChannel).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nome da pasta de assuntos"), { target: { value: "Batalhas" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pasta" }));
    await waitFor(() => expect(api.updateDarkChannel).toHaveBeenCalledWith("channel-1", { topic_folders: ["Batalhas"] }));
    const folder = await screen.findByRole("button", { name: "Batalhas" });

    api.updateDarkChannelScript.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    fireEvent.click(folder);
    fireEvent.click(screen.getByRole("button", { name: "Sem pasta" }));
    expect(api.updateDarkChannelScript).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ...baseScripts()[0], workflow: undefined }); });
    expect(await screen.findByRole("status")).toHaveTextContent("Etapa salva no registro próprio do Canais Dark.");
    expect(screen.getByRole("button", { name: "Batalhas" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("tab", { name: "Materiais" }));
    fireEvent.change(screen.getByLabelText("Nome do material"), { target: { value: "Narração" } });
    fireEvent.change(screen.getByLabelText("Link do material"), { target: { value: "https://cdn.example/voz.mp3" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    await waitFor(() => expect(api.updateDarkChannel).toHaveBeenLastCalledWith("channel-1", { materials: [{ title: "Narração", reference: "https://cdn.example/voz.mp3", kind: "link" }] }));
    expect(await screen.findByRole("status")).toHaveTextContent("Material salvo no acervo próprio deste canal.");
    expect(screen.getByRole("button", { name: /^Vincular ao roteiro$/ })).toBeEnabled();
  });

  it("tolerates channels and workflows saved with missing fields", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [{ id: "channel-1", materials: [{ title: "A", reference: "https://a", kind: "link" }, { title: "B", reference: "https://b", kind: "link" }] }] });
    api.listDarkChannelScripts.mockResolvedValue({ scripts: [
      { id: "script-1", channel_id: "channel-1", topic: "Tema incompleto", script: "", status: "draft", workflow: { final_title: "", target_channels: null, materials: [{ title: "A", reference: "https://a", kind: "link" }] } },
    ] });
    api.updateDarkChannelScript.mockImplementation(async (_channelId, scriptId, changes) => ({ id: scriptId, topic: "Tema incompleto", script: "", status: "draft", workflow: { ...changes.workflow } }));
    render(<DarkChannels />);
    fireEvent.click(await screen.findByRole("tab", { name: "Pastas e roteiros" }));
    fireEvent.click(await screen.findByRole("button", { name: /Abrir no pipeline/ }));
    expect(JSON.parse((await screen.findByTestId("video-studio")).dataset.draft)).toMatchObject({ title: "Tema incompleto", channelName: "", niche: "", format: "long" });

    fireEvent.click(screen.getByRole("tab", { name: "Thumbs" }));
    expect(JSON.parse(screen.getByTestId("thumbnail-studio").dataset.context)).toMatchObject({ folders: [], selectedScript: { script: "" }, scripts: [{ script: "" }] });

    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Tema incompleto" }));
    fireEvent.click(screen.getByRole("tab", { name: "Gerar vídeos" }));
    expect(JSON.parse(screen.getByTestId("video-studio").dataset.draft)).toMatchObject({ id: "script-1", language: "pt-BR", format: "long" });
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Todo o canal" }));
    expect(JSON.parse(screen.getByTestId("video-studio").dataset.draft)).toMatchObject({ channelAudience: "", language: "pt-BR", format: "long" });
    fireEvent.click(within(screen.getByRole("tablist", { name: "Roteiros do canal" })).getByRole("tab", { name: "Tema incompleto" }));

    fireEvent.click(screen.getByRole("tab", { name: "Analytics" }));
    expect(screen.getByText(/Roteiro em contexto: Tema incompleto · redes desejadas: não definidas na Revisão final/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Revisão final" }));
    expect(screen.getByLabelText("YouTube")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("TikTok"));
    expect(screen.getByLabelText("TikTok")).toBeChecked();

    fireEvent.click(screen.getByRole("tab", { name: "Materiais" }));
    fireEvent.click(screen.getByRole("button", { name: /^Vincular ao roteiro$/ }));
    await waitFor(() => expect(api.updateDarkChannelScript).toHaveBeenCalledWith("channel-1", "script-1", { workflow: { materials: [{ title: "A", reference: "https://a", kind: "link" }, { title: "B", reference: "https://b", kind: "link" }] } }));
  });
});
