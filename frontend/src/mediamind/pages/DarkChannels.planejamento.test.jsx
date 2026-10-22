import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listDarkChannels: vi.fn(),
  createDarkChannel: vi.fn(),
  updateDarkChannel: vi.fn(),
  getDarkStructure: vi.fn(),
  listDarkStructureTemplates: vi.fn(),
  getDarkStructureTemplate: vi.fn(),
  importDarkStructure: vi.fn(),
  exportDarkStructure: vi.fn(),
  updateDarkStructure: vi.fn(),
  updateDarkDecision: vi.fn(),
  listDarkChannelScripts: vi.fn(),
  createDarkChannelScript: vi.fn(),
  updateDarkChannelScript: vi.fn(),
}));
vi.mock("../../api/darkChannels", () => api);
vi.mock("../lib/empresaContext", () => ({
  useEmpresa: () => ({ currentEmpresa: { id: "tenant-1", nome: "Empresa" } }),
}));
vi.mock("./VideoGeneration", () => ({ default: () => <div data-testid="video-studio" /> }));
vi.mock("./ClipsFree", () => ({ default: () => <div data-testid="clipsfree-studio" /> }));
vi.mock("./ThumbnailStudio", () => ({ default: ({ darkChannelId }) => <div data-testid="thumbnail-studio" data-channel={darkChannelId} /> }));

// Planejamento da rede (antigo "Canais Dark 2"), agora as três primeiras abas da página única /canais-dark.
import DarkChannels from "./DarkChannels";
import { planningPayload } from "../components/darkChannels/DarkChannelsPlanning";

const structure = {
  schema: "mediamind.dark-structure/v1", name: "Padrão MediaMind", source: "padrao", is_default: true,
  languages: [{ code: "pt-BR", name: "Português (Brasil)" }, { code: "en-US", name: "Inglês (EUA)", regional_frame: "EUA" }],
  niches: [{ code: "historia", name: "História", subniches: ["Antiga", { name: "Medieval" }, { code: "mod" }, {}] }, { code: "ciencia", name: "Ciência", subniches: [] }],
};
const pkg = { schema: "mediamind.dark-structure/v1", name: "Padrão MediaMind", languages: structure.languages, niches: structure.niches, channels: [{ external_id: "c-1" }] };
const templates = [
  { id: "padrao", name: "Padrão", description: "Estrutura genérica", languages_count: 2, niches_count: 2, channels_count: 0 },
  { id: "religioso-multilingue", name: "Religioso multilíngue", languages_count: 5, niches_count: 3, channels_count: 12, decisions_count: 7 },
];
const importResult = (dryRun) => ({ dry_run: dryRun, structure: { languages_count: 2, niches_count: 2 }, channels: { created: ["c-1"], updated: ["c-2"], unchanged: ["c-3"] }, errors: [] });
const channels = [
  { id: "a", name: "Roma Antiga", niche: "História", niche_code: "historia", subniche: "Antiga", language: "pt-BR", lifecycle_status: "ativo", external_id: "his-pt-01", format: "long", weekly_target: 3, target_platforms: ["youtube"], alt_names: ["Roma Eterna"], topic_folders: ["Imperadores"], notes: "Nota", regional_frame: "BR" },
  { id: "b", name: "Ancient Tales", niche: "História", niche_code: "historia", language: "en-US", lifecycle_status: "lancamento", launch_wave: 2, format: "shorts", weekly_target: 2 },
  { id: "c", name: "Ciência Já", niche: "Ciência", niche_code: "ciencia", lifecycle_status: "pausado", format: "both" },
  { id: "d", name: "Arquivado", niche: "Velho", archived: true },
  { id: "e", name: "Livre", niche: "Curiosidades", lifecycle_status: "custom" },
];

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.listDarkChannels.mockResolvedValue({ channels });
  api.getDarkStructure.mockResolvedValue(structure);
  api.listDarkStructureTemplates.mockResolvedValue({ templates });
  api.listDarkChannelScripts.mockResolvedValue({ scripts: [] });
});

async function renderPage() {
  render(<DarkChannels />);
  await screen.findByRole("button", { name: /^Roma Antiga/ });
  await waitFor(() => expect(api.getDarkStructure).toHaveBeenCalled());
}

async function openStructure() {
  await renderPage();
  fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByRole("button", { name: "Aplicar modelo Padrão" });
  return dialog;
}

function uploadJson(dialog, content, name = "estrutura.json") {
  const file = new File([content], name, { type: "application/json" });
  fireEvent.change(within(dialog).getByLabelText("Arquivo JSON da estrutura"), { target: { files: [file] } });
}

async function openNewChannelForm() {
  await renderPage();
  fireEvent.click(screen.getByRole("button", { name: "Novo canal" }));
  const form = screen.getByRole("form", { name: "Novo canal" });
  await waitFor(() => expect(within(within(form).getByLabelText("Nicho do canal")).getByRole("option", { name: "História" })).toBeInTheDocument());
  return form;
}

describe("Canais Dark · cadastro", () => {
  it("sends language, structured niche, subniche and planning fields when creating a channel", async () => {
    api.createDarkChannel.mockResolvedValue({ id: "new", name: "Medieval EN", niche: "História", niche_code: "historia", subniche: "Medieval", language: "en-US" });
    const form = await openNewChannelForm();
    expect(within(form).getByLabelText("Idioma do canal")).toHaveValue("pt-BR");
    fireEvent.change(within(form).getByLabelText("Nome do canal"), { target: { value: "Medieval EN" } });
    fireEvent.change(within(form).getByLabelText("Código do canal"), { target: { value: "HIS-EN-02" } });
    fireEvent.change(within(form).getByLabelText("Idioma do canal"), { target: { value: "en-US" } });
    expect(within(form).getByLabelText("Recorte regional")).toHaveValue("EUA");
    fireEvent.change(within(form).getByLabelText("Nicho do canal"), { target: { value: "historia" } });
    const subniches = within(form).getByLabelText("Subnicho do canal");
    expect(within(subniches).getAllByRole("option").map((option) => option.textContent)).toEqual(["Nenhum (opcional)", "Antiga", "Medieval", "mod"]);
    fireEvent.change(subniches, { target: { value: "Medieval" } });
    fireEvent.change(within(form).getByLabelText("Status do canal"), { target: { value: "planejado" } });
    fireEvent.change(within(form).getByLabelText("Onda de lançamento"), { target: { value: "3" } });
    fireEvent.change(within(form).getByLabelText("Meta semanal de vídeos"), { target: { value: "5" } });
    fireEvent.click(within(form).getByLabelText("YouTube"));
    fireEvent.click(within(form).getByLabelText("TikTok"));
    fireEvent.click(within(form).getByLabelText("TikTok"));
    fireEvent.change(within(form).getByLabelText("Nomes alternativos"), { target: { value: "Medieval Tales, , Dark Ages, Dark Ages" } });
    fireEvent.change(within(form).getByLabelText("Pastas de tema"), { target: { value: "Reis, Batalhas" } });
    fireEvent.change(within(form).getByLabelText("Notas do canal"), { target: { value: "  Começar em janeiro  " } });
    fireEvent.change(within(form).getByLabelText("Público-alvo"), { target: { value: "Adultos" } });
    fireEvent.change(within(form).getByLabelText("Formato do canal"), { target: { value: "both" } });
    fireEvent.change(within(form).getByLabelText("Modo de publicação"), { target: { value: "automatic" } });
    fireEvent.click(within(form).getByRole("button", { name: "Criar canal" }));

    await waitFor(() => expect(api.createDarkChannel).toHaveBeenCalledWith({
      name: "Medieval EN", external_id: "his-en-02", niche: "História", niche_code: "historia", subniche: "Medieval", audience: "Adultos",
      language: "en-US", regional_frame: "EUA", format: "both", publishing_mode: "automatic", lifecycle_status: "planejado", launch_wave: 3,
      weekly_target: 5, target_platforms: ["youtube"], alt_names: ["Medieval Tales", "Dark Ages"], notes: "Começar em janeiro", topic_folders: ["Reis", "Batalhas"],
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("Canal “Medieval EN” criado.");
    expect(screen.queryByRole("form", { name: "Novo canal" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Detalhes do canal" })).toHaveTextContent("Medieval EN");
  });

  it("accepts a custom niche and a custom language code outside the structure", async () => {
    api.createDarkChannel.mockResolvedValue({ id: "new", name: "Curioso", niche: "Curiosidades", language: "es-MX" });
    const form = await openNewChannelForm();
    fireEvent.change(within(form).getByLabelText("Nome do canal"), { target: { value: "Curioso" } });
    fireEvent.change(within(form).getByLabelText("Idioma do canal"), { target: { value: "__custom__" } });
    fireEvent.change(within(form).getByLabelText("Código do idioma"), { target: { value: "es-MX" } });
    fireEvent.change(within(form).getByLabelText("Nicho do canal"), { target: { value: "__custom__" } });
    expect(within(form).queryByLabelText("Subnicho do canal")).not.toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText("Outro nicho"), { target: { value: "Curiosidades" } });
    fireEvent.click(within(form).getByRole("button", { name: "Criar canal" }));

    await waitFor(() => expect(api.createDarkChannel).toHaveBeenCalledWith({
      name: "Curioso", niche: "Curiosidades", audience: "", language: "es-MX", format: "long", publishing_mode: "manual",
      lifecycle_status: "ativo", weekly_target: 0, target_platforms: [], alt_names: [], notes: "", topic_folders: [],
    }));
  });

  it("does not submit without a niche and shows the API error when creation fails", async () => {
    api.createDarkChannel.mockRejectedValue(new Error("Sem permissão para criar canais."));
    const form = await openNewChannelForm();
    fireEvent.change(within(form).getByLabelText("Nome do canal"), { target: { value: "Sem nicho" } });
    fireEvent.submit(form);
    expect(api.createDarkChannel).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByLabelText("Nicho do canal"), { target: { value: "ciencia" } });
    expect(within(form).queryByLabelText("Subnicho do canal")).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Criar canal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão para criar canais.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form", { name: "Novo canal" })).not.toBeInTheDocument();
  });

  it("falls back to a free niche field and the default language when the structure is unavailable", async () => {
    api.getDarkStructure.mockRejectedValue(new Error("Estrutura fora do ar."));
    api.createDarkChannel.mockResolvedValue({ id: "new", name: "Livre 2", niche: "Mistérios" });
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Novo canal" }));
    const form = screen.getByRole("form", { name: "Novo canal" });
    expect(within(form).getByLabelText("Nicho do canal").tagName).toBe("INPUT");
    expect(within(within(form).getByLabelText("Idioma do canal")).getAllByRole("option").map((option) => option.value)).toEqual(["pt-BR", "__custom__"]);
    fireEvent.change(within(form).getByLabelText("Nome do canal"), { target: { value: "Livre 2" } });
    fireEvent.change(within(form).getByLabelText("Nicho do canal"), { target: { value: "Mistérios" } });
    fireEvent.click(within(form).getByRole("button", { name: "Criar canal" }));
    await waitFor(() => expect(api.createDarkChannel).toHaveBeenCalledWith(expect.objectContaining({ niche: "Mistérios", language: "pt-BR" })));
  });

  it("converts planning drafts into API payloads", () => {
    expect(planningPayload({ lifecycle_status: "ideia", launch_wave: "0", weekly_target: "-3", target_platforms: [], alt_names: "", notes: " ", topic_folders: "" }))
      .toEqual({ lifecycle_status: "ideia", weekly_target: 0, target_platforms: [], alt_names: [], notes: "", topic_folders: [] });
    expect(planningPayload({ lifecycle_status: "ativo", launch_wave: "4", weekly_target: "abc", target_platforms: ["facebook"], alt_names: "A,B", notes: "x", topic_folders: "P" }))
      .toEqual({ lifecycle_status: "ativo", launch_wave: 4, weekly_target: 0, target_platforms: ["facebook"], alt_names: ["A", "B"], notes: "x", topic_folders: ["P"] });
  });
});

describe("Canais Dark · resumo, filtros e detalhes", () => {
  it("summarizes the network and shows language, lifecycle, wave and code badges on cards", async () => {
    await renderPage();
    const summary = screen.getByRole("region", { name: "Resumo da rede" });
    expect(within(summary).getByText("Canais").nextSibling).toHaveTextContent("4");
    expect(within(summary).getByText("Ativos").nextSibling).toHaveTextContent("1");
    expect(within(summary).getByText("Em implementação ou lançamento").nextSibling).toHaveTextContent("1");
    expect(within(summary).getByText("Meta semanal total").nextSibling).toHaveTextContent("5");
    expect(within(summary).getByRole("button", { name: "Filtrar nicho História" })).toHaveTextContent("2");

    const roma = screen.getByRole("button", { name: /^Roma Antiga/ });
    expect(roma).toHaveTextContent("his-pt-01");
    expect(roma).toHaveTextContent("História / Antiga");
    expect(roma).toHaveTextContent("Ativo");
    expect(roma).toHaveTextContent("3/semana");
    const ancient = screen.getByRole("button", { name: /Ancient Tales/ });
    expect(ancient).toHaveTextContent("en-US");
    expect(ancient).toHaveTextContent("Em lançamento");
    expect(ancient).toHaveTextContent("Onda 2");
    expect(ancient).toHaveTextContent("Shorts");
    expect(screen.getByRole("button", { name: /Ciência Já/ })).toHaveTextContent("pt-BR");
    expect(screen.getByRole("button", { name: /Livre/ })).toHaveTextContent("custom");
    expect(screen.queryByRole("button", { name: /Arquivado/ })).not.toBeInTheDocument();
  });

  it("filters cards by niche, language, status and search, with counts", async () => {
    await renderPage();
    expect(screen.getByText("Mostrando 4 de 4 canais")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Filtrar por idioma")).getByRole("option", { name: "Inglês (EUA) (en-US) (1)" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Filtrar por nicho")).getByRole("option", { name: "História (2)" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Filtrar por status")).getByRole("option", { name: "Pausado (1)" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por idioma"), { target: { value: "en-US" } });
    expect(screen.getByText("Mostrando 1 de 4 canais")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Roma Antiga/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filtrar por idioma"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Filtrar por nicho"), { target: { value: "historia" } });
    expect(screen.getByText("Mostrando 2 de 4 canais")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filtrar por status"), { target: { value: "pausado" } });
    expect(screen.getByText("Nenhum canal corresponde aos filtros.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    fireEvent.change(screen.getByLabelText("Buscar canal"), { target: { value: "eterna" } });
    expect(screen.getByText("Mostrando 1 de 4 canais")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Roma Antiga/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar canal"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Filtrar status Pausado" }));
    expect(screen.getByText("Mostrando 1 de 4 canais")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar idioma Inglês (EUA) (en-US)" }));
    expect(screen.getByLabelText("Filtrar por status")).toHaveValue("all");
    expect(screen.getByText("Mostrando 1 de 4 canais")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar nicho Ciência" }));
    expect(screen.getByRole("button", { name: /Ciência Já/ })).toBeInTheDocument();
  });

  it("keeps a filter value visible with zero count after the channel list changes", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Filtrar por status"), { target: { value: "pausado" } });
    api.listDarkChannels.mockResolvedValue({ channels: channels.filter((channel) => channel.id !== "c") });
    api.getDarkStructureTemplate.mockResolvedValue(pkg);
    api.importDarkStructure.mockImplementation(async (_pkg, { dryRun }) => importResult(dryRun));
    fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: "Aplicar modelo Padrão" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Confirmar importação" }));
    await waitFor(() => expect(api.listDarkChannels).toHaveBeenCalledTimes(2));
    await within(dialog).findByRole("status");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(within(screen.getByLabelText("Filtrar por status")).getByRole("option", { name: "pausado (0)" })).toBeInTheDocument());
  });

  it("shows channel details without a link to another page and saves planning through PATCH", async () => {
    api.updateDarkChannel.mockImplementation(async (id, patch) => ({ ...channels[0], ...patch, id }));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Roma Antiga/ }));
    const details = screen.getByRole("region", { name: "Detalhes do canal" });
    expect(details).toHaveTextContent("Português (Brasil) (pt-BR) · BR · Vídeos longos · his-pt-01");
    expect(details).toHaveTextContent("Plataformas: YouTube");
    expect(within(details).queryByRole("link", { name: /Abrir no pipeline/ })).not.toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Ir para Pastas e roteiros" })).toBeInTheDocument();
    const form = within(details).getByRole("form", { name: "Planejamento do canal" });
    expect(within(form).getByLabelText("Meta semanal de vídeos")).toHaveValue(3);
    expect(within(form).getByLabelText("Nomes alternativos")).toHaveValue("Roma Eterna");
    expect(within(form).getByLabelText("Pastas de tema")).toHaveValue("Imperadores");
    fireEvent.change(within(form).getByLabelText("Status do canal"), { target: { value: "em_espera" } });
    fireEvent.change(within(form).getByLabelText("Onda de lançamento"), { target: { value: "1" } });
    fireEvent.click(within(form).getByLabelText("Instagram"));
    fireEvent.click(within(form).getByRole("button", { name: "Salvar planejamento" }));

    await waitFor(() => expect(api.updateDarkChannel).toHaveBeenCalledWith("a", {
      lifecycle_status: "em_espera", launch_wave: 1, weekly_target: 3, target_platforms: ["youtube", "instagram"], alt_names: ["Roma Eterna"], notes: "Nota", topic_folders: ["Imperadores"],
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("Planejamento do canal salvo.");
    expect(screen.getByRole("button", { name: /^Roma Antiga/ })).toHaveTextContent("Em espera");
    expect(screen.getByRole("button", { name: /^Roma Antiga/ })).toHaveTextContent("Onda 1");

    fireEvent.click(screen.getByRole("button", { name: /Ancient Tales/ }));
    expect(within(screen.getByRole("form", { name: "Planejamento do canal" })).getByLabelText("Onda de lançamento")).toHaveValue(2);
    fireEvent.click(screen.getByRole("button", { name: /Ciência Já/ }));
    expect(within(screen.getByRole("form", { name: "Planejamento do canal" })).getByLabelText("Meta semanal de vídeos")).toHaveValue(0);
  });

  it("shows the API error when saving planning is rejected", async () => {
    api.updateDarkChannel.mockRejectedValue(new Error("Acesso negado."));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Ciência Já/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar planejamento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Acesso negado.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows empty and error states for the channel list", async () => {
    api.listDarkChannels.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Falha ao listar."));
    const { unmount } = render(<DarkChannels />);
    expect(await screen.findByText(/Nenhum canal cadastrado ainda/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Filtrar nicho/ })).not.toBeInTheDocument();
    unmount();
    render(<DarkChannels />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao listar.");
  });
});

describe("Canais Dark · estrutura", () => {
  it("lists templates and applies one only after the dry-run preview, then reloads channels and structure", async () => {
    api.getDarkStructureTemplate.mockResolvedValue(pkg);
    api.importDarkStructure.mockImplementation(async (_pkg, { dryRun }) => importResult(dryRun));
    const dialog = await openStructure();
    expect(within(dialog).getByText("Padrão do sistema")).toBeInTheDocument();
    expect(within(dialog).getByText("2 idiomas · 2 nichos · 4 canais")).toBeInTheDocument();
    expect(within(dialog).getByText("Religioso multilíngue")).toBeInTheDocument();
    expect(within(dialog).getByText("5 idiomas · 3 nichos · 12 canais · 7 decisões")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar modelo Religioso multilíngue" }));
    const preview = await within(dialog).findByRole("region", { name: "Prévia da importação" });
    expect(api.getDarkStructureTemplate).toHaveBeenCalledWith("religioso-multilingue");
    expect(api.importDarkStructure).toHaveBeenCalledTimes(1);
    expect(api.importDarkStructure).toHaveBeenLastCalledWith(pkg, { dryRun: true });
    expect(preview).toHaveTextContent("Prévia — nada foi gravado ainda");
    expect(preview).toHaveTextContent("Modelo Religioso multilíngue");
    expect(preview).toHaveTextContent("Canais a criar: 1");
    expect(preview).toHaveTextContent("c-1");
    expect(preview).toHaveTextContent("Canais a atualizar: 1");
    expect(preview).toHaveTextContent("Sem alteração: 1");

    fireEvent.click(within(preview).getByRole("button", { name: "Confirmar importação" }));
    await waitFor(() => expect(api.importDarkStructure).toHaveBeenLastCalledWith(pkg, { dryRun: false }));
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Importação concluída: 2 idiomas, 2 nichos; 1 canais criados, 1 atualizados, 1 sem alteração.");
    await waitFor(() => expect(api.listDarkChannels).toHaveBeenCalledTimes(2));
    expect(api.getDarkStructure).toHaveBeenCalledTimes(2);
    expect(within(dialog).queryByRole("region", { name: "Prévia da importação" })).not.toBeInTheDocument();
  });

  it("accepts a plain array of templates and reports when none or failures happen", async () => {
    api.listDarkStructureTemplates.mockResolvedValueOnce(templates.slice(0, 1));
    const dialog = await openStructure();
    expect(within(dialog).queryByText("Religioso multilíngue")).not.toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    api.listDarkStructureTemplates.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
    expect(await within(await screen.findByRole("dialog")).findByText("Nenhum modelo disponível.")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    api.listDarkStructureTemplates.mockRejectedValueOnce(new Error("Modelos indisponíveis."));
    fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
    expect(await within(await screen.findByRole("dialog")).findByText("Modelos indisponíveis.")).toBeInTheDocument();
  });

  it("rejects invalid JSON files without calling the API", async () => {
    const dialog = await openStructure();
    uploadJson(dialog, "{ isto não é json");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Arquivo inválido: o conteúdo não é um JSON válido.");
    expect(api.importDarkStructure).not.toHaveBeenCalled();
  });

  it("rejects JSON files with the wrong schema without calling the API", async () => {
    const dialog = await openStructure();
    uploadJson(dialog, JSON.stringify({ schema: "outro/v9", niches: [] }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Formato não reconhecido");
    uploadJson(dialog, JSON.stringify([1, 2]));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("mediamind.dark-structure/v1"));
    expect(api.importDarkStructure).not.toHaveBeenCalled();
  });

  it("rejects files larger than 5 MB and ignores an empty selection", async () => {
    const dialog = await openStructure();
    fireEvent.change(within(dialog).getByLabelText("Arquivo JSON da estrutura"), { target: { files: [] } });
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    const file = new File(["{}"], "grande.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(within(dialog).getByLabelText("Arquivo JSON da estrutura"), { target: { files: [file] } });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Arquivo muito grande");
    expect(api.importDarkStructure).not.toHaveBeenCalled();
  });

  it("previews an imported file and shows the API error when the real import is rejected, without fake success", async () => {
    api.importDarkStructure.mockImplementation(async (_pkg, { dryRun }) => {
      if (dryRun) return { dry_run: true, channels: { unchanged: ["c-9"] } };
      throw Object.assign(new Error("Você não tem permissão para importar a estrutura."), { status: 403 });
    });
    const dialog = await openStructure();
    uploadJson(dialog, JSON.stringify(pkg), "minha.json");
    const preview = await within(dialog).findByRole("region", { name: "Prévia da importação" });
    expect(preview).toHaveTextContent("Arquivo minha.json");
    expect(preview).toHaveTextContent("0 idiomas · 0 nichos");
    expect(api.importDarkStructure).toHaveBeenCalledWith(pkg, { dryRun: true });

    fireEvent.click(within(preview).getByRole("button", { name: "Confirmar importação" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Você não tem permissão para importar a estrutura.");
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    expect(api.listDarkChannels).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("region", { name: "Prévia da importação" })).toBeInTheDocument();
  });

  it("reports zero counts when the API confirms an import without details", async () => {
    api.importDarkStructure.mockImplementation(async (_pkg, { dryRun }) => dryRun ? importResult(true) : {});
    const dialog = await openStructure();
    uploadJson(dialog, JSON.stringify({ schema: "mediamind.dark-structure/v1" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Confirmar importação" }));
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Importação concluída: 0 idiomas, 0 nichos; 0 canais criados, 0 atualizados, 0 sem alteração.");
  });

  it("blocks confirmation when the dry run reports errors and lets the preview be discarded", async () => {
    api.importDarkStructure.mockResolvedValue({ ...importResult(true), errors: ["Canal c-1: nicho inexistente", { message: "Idioma xx inválido" }, { field: "x" }] });
    const dialog = await openStructure();
    uploadJson(dialog, JSON.stringify(pkg));
    const preview = await within(dialog).findByRole("region", { name: "Prévia da importação" });
    expect(within(preview).getByRole("alert")).toHaveTextContent("Canal c-1: nicho inexistente");
    expect(within(preview).getByRole("alert")).toHaveTextContent("Idioma xx inválido");
    expect(within(preview).getByRole("alert")).toHaveTextContent('{"field":"x"}');
    expect(within(preview).getByRole("button", { name: "Confirmar importação" })).toBeDisabled();
    fireEvent.click(within(preview).getByRole("button", { name: "Descartar prévia" }));
    expect(within(dialog).queryByRole("region", { name: "Prévia da importação" })).not.toBeInTheDocument();
  });

  it("shows the API error when a template cannot be loaded", async () => {
    api.getDarkStructureTemplate.mockRejectedValue(new Error("Modelo indisponível."));
    const dialog = await openStructure();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar modelo Padrão" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Modelo indisponível.");
    expect(api.importDarkStructure).not.toHaveBeenCalled();
  });

  it("downloads the exported structure as a JSON file and reports export errors", async () => {
    const createObjectURL = vi.fn(() => "blob:estrutura");
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const downloads = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { downloads.push(this.download); });
    api.exportDarkStructure.mockResolvedValueOnce(pkg).mockRejectedValueOnce(new Error("Exportação negada."));
    const dialog = await openStructure();

    fireEvent.click(within(dialog).getByRole("button", { name: "Exportar estrutura" }));
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Estrutura exportada");
    expect(downloads).toEqual(["estrutura-canais-dark.json"]);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("application/json");
    const text = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
    expect(JSON.parse(text)).toEqual(pkg);

    fireEvent.click(within(dialog).getByRole("button", { name: "Exportar estrutura" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Exportação negada.");
    click.mockRestore();
    Object.assign(URL, { createObjectURL: originalCreate, revokeObjectURL: originalRevoke });
  });

  it("identifies an imported structure and shows structure load failures", async () => {
    api.getDarkStructure.mockResolvedValueOnce({ ...structure, source: "importado", name: "Rede do Alex" }).mockRejectedValueOnce(new Error("Estrutura fora do ar."));
    const dialog = await openStructure();
    expect(within(dialog).getByText("Importada")).toBeInTheDocument();
    expect(within(dialog).getByText(/Rede do Alex/)).toBeInTheDocument();
    api.getDarkStructureTemplate.mockResolvedValue(pkg);
    api.importDarkStructure.mockImplementation(async (_pkg, { dryRun }) => importResult(dryRun));
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar modelo Padrão" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Confirmar importação" }));
    expect(await within(dialog).findByText(/Não foi possível carregar a estrutura atual: Estrutura fora do ar./)).toBeInTheDocument();
  });

  it("shows a loading state while the structure has not arrived", async () => {
    api.getDarkStructure.mockReturnValue(new Promise(() => {}));
    api.listDarkStructureTemplates.mockReturnValue(new Promise(() => {}));
    render(<DarkChannels />);
    await screen.findByRole("button", { name: /^Roma Antiga/ });
    fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Carregando…")).toBeInTheDocument();
    expect(within(dialog).getByText("Carregando modelos…")).toBeInTheDocument();
  });
});

describe("Canais Dark · dados incompletos e erros sem mensagem", () => {
  it("handles channels and structures with missing optional data", async () => {
    api.getDarkStructure.mockResolvedValue({ ...structure, languages: [...structure.languages, { code: "fr" }] });
    api.listDarkChannels.mockResolvedValue({ channels: [{ id: "x", name: "Sem dados", target_platforms: ["outra"] }] });
    api.listDarkStructureTemplates.mockResolvedValue([{ id: "vazio", name: "Vazio" }]);
    api.createDarkChannel.mockResolvedValue({ id: "y", name: "Novo" });
    render(<DarkChannels />);
    const card = await screen.findByRole("button", { name: /Sem dados/ });
    expect(card).toHaveTextContent("Sem nicho · Vídeos longos");
    fireEvent.click(card);
    expect(screen.getByRole("region", { name: "Detalhes do canal" })).toHaveTextContent("Plataformas: outra");

    fireEvent.click(screen.getByRole("button", { name: "Novo canal" }));
    const form = screen.getByRole("form", { name: "Novo canal" });
    await waitFor(() => expect(within(within(form).getByLabelText("Idioma do canal")).getByRole("option", { name: "fr" })).toBeInTheDocument());
    fireEvent.change(within(form).getByLabelText("Recorte regional"), { target: { value: "Quebec" } });
    fireEvent.change(within(form).getByLabelText("Idioma do canal"), { target: { value: "__custom__" } });
    fireEvent.change(within(form).getByLabelText("Nome do canal"), { target: { value: "Novo" } });
    fireEvent.change(within(form).getByLabelText("Nicho do canal"), { target: { value: "ciencia" } });
    fireEvent.submit(form);
    await waitFor(() => expect(api.createDarkChannel).toHaveBeenCalledWith(expect.objectContaining({ language: "pt-BR", niche: "Ciência", niche_code: "ciencia" })));
    expect(api.createDarkChannel.mock.calls[0][0]).not.toHaveProperty("regional_frame");

    api.importDarkStructure.mockResolvedValue({ channels: { created: ["z"] } });
    fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("0 idiomas · 0 nichos · 0 canais")).toBeInTheDocument();
    uploadJson(dialog, "");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("não é um JSON válido");
    uploadJson(dialog, JSON.stringify(pkg));
    expect(await within(dialog).findByRole("region", { name: "Prévia da importação" })).toHaveTextContent("Sem alteração: 0");
  });

  it("ignores template responses that arrive after the dialog was closed", async () => {
    let resolveTemplates;
    let rejectTemplates;
    api.listDarkStructureTemplates
      .mockReturnValueOnce(new Promise((resolve) => { resolveTemplates = resolve; }))
      .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectTemplates = reject; }));
    await renderPage();
    for (const settle of [() => resolveTemplates(templates), () => rejectTemplates(new Error("tarde"))]) {
      fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      settle();
      await Promise.resolve();
    }
    expect(screen.queryByText("tarde")).not.toBeInTheDocument();
  });

  it("reports unreadable files and revokes the download URL later", async () => {
    const readAsText = vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function () { this.onerror(); });
    const dialog = await openStructure();
    uploadJson(dialog, "{}");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Não foi possível ler o arquivo selecionado.");
    readAsText.mockRestore();

    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const realSetTimeout = window.setTimeout;
    const timer = vi.spyOn(window, "setTimeout").mockImplementation((callback, delay, ...args) => {
      if (delay === 30000) { callback(); return 0; }
      return realSetTimeout(callback, delay, ...args);
    });
    api.exportDarkStructure.mockResolvedValueOnce(pkg);
    fireEvent.click(within(dialog).getByRole("button", { name: "Exportar estrutura" }));
    await within(dialog).findByRole("status");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
    timer.mockRestore(); click.mockRestore();
    Object.assign(URL, { createObjectURL: originalCreate, revokeObjectURL: originalRevoke });
  });

  it("does not send a second planning save while the first one is running", async () => {
    let finish;
    api.updateDarkChannel.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Ciência Já/ }));
    const form = screen.getByRole("form", { name: "Planejamento do canal" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.updateDarkChannel).toHaveBeenCalledTimes(1);
    finish({ ...channels[2] });
    expect(await screen.findByRole("status")).toHaveTextContent("Planejamento do canal salvo.");
  });

  it("uses Portuguese fallback messages when API errors have no message", async () => {
    api.listDarkChannels.mockRejectedValueOnce({});
    api.getDarkStructure.mockRejectedValueOnce({});
    const first = render(<DarkChannels />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os canais.");
    fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
    expect(await within(await screen.findByRole("dialog")).findByText(/Não foi possível carregar a estrutura de nichos e idiomas./)).toBeInTheDocument();
    first.unmount();

    api.listDarkStructureTemplates.mockRejectedValueOnce({});
    let dialog;
    render(<DarkChannels />);
    await screen.findByRole("button", { name: /^Roma Antiga/ });
    fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
    dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Não foi possível carregar os modelos.")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    api.getDarkStructureTemplate.mockRejectedValueOnce({});
    api.exportDarkStructure.mockRejectedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Estrutura" }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: "Aplicar modelo Padrão" }));
    expect(await within(dialog).findByText("Não foi possível carregar o modelo.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Exportar estrutura" }));
    expect(await within(dialog).findByText("Não foi possível exportar a estrutura.")).toBeInTheDocument();
    api.importDarkStructure.mockRejectedValueOnce({});
    uploadJson(dialog, JSON.stringify(pkg));
    expect(await within(dialog).findByText("Não foi possível analisar o arquivo.")).toBeInTheDocument();
    api.importDarkStructure.mockResolvedValueOnce(importResult(true)).mockRejectedValueOnce({});
    uploadJson(dialog, JSON.stringify(pkg));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Confirmar importação" }));
    expect(await within(dialog).findByText("Não foi possível importar a estrutura.")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    api.createDarkChannel.mockRejectedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Novo canal" }));
    const form = screen.getByRole("form", { name: "Novo canal" });
    fireEvent.change(within(form).getByLabelText("Nome do canal"), { target: { value: "X" } });
    fireEvent.change(within(form).getByLabelText("Nicho do canal"), { target: { value: "ciencia" } });
    fireEvent.click(within(form).getByRole("button", { name: "Criar canal" }));
    expect(await screen.findByText("Não foi possível criar o canal.")).toBeInTheDocument();

    api.updateDarkChannel.mockRejectedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: /Ciência Já/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar planejamento" }));
    expect(await screen.findByText("Não foi possível salvar o planejamento.")).toBeInTheDocument();
  });
});

describe("Canais Dark · decisões, nichos e idiomas e escolha de nomes", () => {
  const pendingDecision = { id: "d1", title: "Voz do nicho", question: "Qual voz?", options: ["Masculina", "Feminina"], recommendation: "Feminina", scope: "nicho", ref: "historia", status: "pendente", answer: "", notes: "", decided_at: null };
  const decidedDecision = { id: "d2", title: "Formato", question: "?", options: [], scope: "geral", status: "decidida", answer: "Longo", notes: "", decided_at: null };
  const withDecisions = { ...structure, decisions: [pendingDecision, decidedDecision] };

  it("counts pending decisions, opens the Decisões tab from the summary tile and updates after deciding", async () => {
    api.getDarkStructure.mockResolvedValue(withDecisions);
    api.updateDarkDecision.mockResolvedValue({ ...pendingDecision, status: "decidida", answer: "Feminina" });
    await renderPage();
    const tile = await screen.findByRole("button", { name: "Decisões pendentes 1" });
    expect(screen.getByRole("tab", { name: /^Decisões ?1$/ })).toHaveAttribute("aria-selected", "false");
    fireEvent.click(tile);
    expect(screen.getByRole("tab", { name: /^Decisões ?1$/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("region", { name: "Canais da rede" })).not.toBeInTheDocument();
    const decision = screen.getByRole("article", { name: "Decisão: Voz do nicho" });
    fireEvent.click(within(decision).getByRole("radio", { name: /Feminina/ }));
    fireEvent.click(within(decision).getByRole("button", { name: "Decidir" }));
    await waitFor(() => expect(api.updateDarkDecision).toHaveBeenCalledWith("d1", { status: "decidida", answer: "Feminina", notes: "" }));
    expect(await screen.findByRole("button", { name: "Decisões pendentes 0" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Decisões" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar nicho História" }));
    expect(screen.getByRole("tab", { name: "Canais" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Mostrando 2 de 4 canais")).toBeInTheDocument();
  });

  it("edits niches and languages in their own tab and warns before leaving with unsaved changes", async () => {
    api.updateDarkStructure.mockImplementation(async (body) => ({ ...structure, ...body }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Nichos e idiomas" }));
    fireEvent.change(screen.getByLabelText("Nome do nicho 2"), { target: { value: "Ciências" } });
    expect(screen.getByRole("tab", { name: /Nichos e idiomas\s*\(não salvo\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Canais" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Nome do nicho 2")).toHaveValue("Ciências");
    fireEvent.click(screen.getByRole("tab", { name: /Nichos e idiomas/ }));
    expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("tab", { name: "Decisões" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("tab", { name: "Decisões" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/Nenhuma decisão registrada/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Nichos e idiomas" }));
    expect(screen.getByLabelText("Nome do nicho 2")).toHaveValue("Ciência");
    fireEvent.change(screen.getByLabelText("Nome do nicho 2"), { target: { value: "Ciências" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar estrutura" }));
    expect(await screen.findByText("Estrutura salva.")).toBeInTheDocument();
    expect(api.updateDarkStructure).toHaveBeenCalledWith(expect.objectContaining({ decisions: [] }));
    fireEvent.click(screen.getByRole("tab", { name: "Canais" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Filtrar nicho Ciências" })).toBeInTheDocument();
    confirm.mockRestore();

    fireEvent.click(screen.getByRole("tab", { name: "Decisões" }));
    fireEvent.click(screen.getByRole("button", { name: "Novo canal" }));
    expect(screen.getByRole("tab", { name: "Canais" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("form", { name: "Novo canal" })).toBeInTheDocument();
  });

  it("sorts cards by launch wave, niche and name and marks names still to be defined", async () => {
    api.listDarkChannels.mockResolvedValue({ channels: [...channels, { id: "f", name: "[A DEFINIR] Fé PT", niche: "Fé", launch_wave: 1, alt_names: ["Luz Diária"] }, { id: "g", niche: "Ciência", launch_wave: 1 }, { id: "h", name: "Água", niche: "Ciência", launch_wave: 1 }] });
    render(<DarkChannels />);
    await screen.findByRole("button", { name: /^Roma Antiga/ });
    const cards = within(screen.getByRole("region", { name: "Canais da rede" })).getAllByRole("button").filter((card) => card.hasAttribute("aria-pressed"));
    expect(cards.map((card) => card.querySelector("span").textContent)).toEqual(["", "Água", "[A DEFINIR] Fé PT", "Ancient Tales", "Ciência Já", "Livre", "Roma Antiga"]);
    expect(cards[2]).toHaveTextContent("nome a definir");
    expect(cards[1]).not.toHaveTextContent("nome a definir");
  });

  it("chooses a channel name from its alternatives, keeping the previous real name as an alternative", async () => {
    const placeholder = { id: "f", name: "[A DEFINIR] Fé PT", niche: "Fé", alt_names: ["Luz Diária", "Fé Viva"] };
    api.listDarkChannels.mockResolvedValue({ channels: [...channels, placeholder] });
    api.updateDarkChannel.mockImplementation(async (id, patch) => ({ ...[...channels, placeholder].find((item) => item.id === id), ...patch }));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /\[A DEFINIR\] Fé PT/ }));
    const names = screen.getByRole("group", { name: "Nomes alternativos do canal" });
    expect(names).toHaveTextContent("Escolha o nome:");
    fireEvent.click(within(names).getByRole("button", { name: "Usar “Luz Diária” como nome" }));
    await waitFor(() => expect(api.updateDarkChannel).toHaveBeenCalledWith("f", { name: "Luz Diária", alt_names: ["Fé Viva"] }));
    expect(await screen.findByRole("status")).toHaveTextContent("Canal renomeado para “Luz Diária”.");
    expect(screen.getByRole("region", { name: "Detalhes do canal" })).toHaveTextContent("Nomes alternativos:Fé Viva");
    expect(within(screen.getByRole("form", { name: "Planejamento do canal" })).getByLabelText("Nomes alternativos")).toHaveValue("Fé Viva");

    fireEvent.click(screen.getByRole("button", { name: /^Roma Antiga/ }));
    fireEvent.click(screen.getByRole("button", { name: "Usar “Roma Eterna” como nome" }));
    await waitFor(() => expect(api.updateDarkChannel).toHaveBeenLastCalledWith("a", { name: "Roma Eterna", alt_names: ["Roma Antiga"] }));

    api.updateDarkChannel.mockRejectedValueOnce(new Error("Nome já usado.")).mockRejectedValueOnce({});
    fireEvent.click(await screen.findByRole("button", { name: "Usar “Roma Antiga” como nome" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nome já usado.");
    fireEvent.click(screen.getByRole("button", { name: "Usar “Roma Antiga” como nome" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível renomear o canal.");
  });

  it("does not rename twice while a rename is running", async () => {
    let finish;
    api.updateDarkChannel.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    api.listDarkChannels.mockResolvedValue({ channels: [{ ...channels[0], alt_names: ["Roma Eterna", "Roma Antiga"] }] });
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Roma Antiga/ }));
    fireEvent.click(screen.getByRole("button", { name: "Usar “Roma Eterna” como nome" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar “Roma Antiga” como nome" }));
    expect(api.updateDarkChannel).toHaveBeenCalledTimes(1);
    expect(api.updateDarkChannel).toHaveBeenCalledWith("a", { name: "Roma Eterna", alt_names: ["Roma Antiga"] });
    finish({ ...channels[0], name: "Roma Eterna", alt_names: ["Roma Antiga"] });
    expect(await screen.findByRole("status")).toHaveTextContent("Canal renomeado para “Roma Eterna”.");
  });

  it("shows decision counts in the import preview", async () => {
    api.getDarkStructureTemplate.mockResolvedValue(pkg);
    api.importDarkStructure.mockResolvedValue({ ...importResult(true), structure: { languages_count: 2, niches_count: 2, decisions_count: 4, decisions_pending: 3 } });
    const dialog = await openStructure();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar modelo Padrão" }));
    expect(await within(dialog).findByRole("region", { name: "Prévia da importação" })).toHaveTextContent("2 nichos · 4 decisões (3 pendentes)");
    api.importDarkStructure.mockResolvedValue({ ...importResult(true), structure: { languages_count: 1, niches_count: 1, decisions_count: 2 } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar modelo Padrão" }));
    await waitFor(() => expect(within(dialog).getByRole("region", { name: "Prévia da importação" })).toHaveTextContent("2 decisões (0 pendentes)"));
  });
});
