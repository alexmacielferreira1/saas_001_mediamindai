import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UniversalCopilot from "./UniversalCopilot";
import { createMCPQueue, listMCPTools } from "../../lib/mcpApi";
import { clearMCPContext, publishMCPContext, timelineContext } from "../../lib/mcpTargetContext";
import { registerMCPActions } from "../../lib/mcpActions";

vi.mock("../../lib/mcpApi", () => ({ listMCPTools: vi.fn(), createMCPQueue: vi.fn() }));
vi.mock("../../auth", () => ({ useAuth: () => ({ user: { role: "editor" } }) }));
vi.mock("../../../api/httpClient", () => ({ request: vi.fn() }));
vi.mock("./CopilotAISettings", () => ({ default: () => null }));

const ASSET = "11111111-2222-4333-8444-555555555555";

async function openTimelineCard() {
  render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><UniversalCopilot /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /MCP · MMFilm/ }));
  const card = (await screen.findByText("Ler timeline")).closest("div.space-y-2");
  return within(card);
}

describe("UniversalCopilot MCP", () => {
  beforeEach(() => {
    localStorage.setItem("mm_copilot_open", "1");
    listMCPTools.mockResolvedValue({ tools: [{ name: "mmfilm.timeline", module: "mmfilm", title: "Ler timeline", available: true }] });
  });
  afterEach(() => { clearMCPContext("mmfilm"); vi.clearAllMocks(); });

  it("blocks asset tools when no Acervo media is identified instead of reading the whole Acervo", async () => {
    const card = await openTimelineCard();
    await waitFor(() => expect(card.getByRole("button", { name: /Executar agora/ })).toBeEnabled());

    fireEvent.click(card.getByRole("button", { name: /Executar agora/ }));

    expect(createMCPQueue).not.toHaveBeenCalled();
    expect(await screen.findByText(/Nenhuma mídia do Acervo foi identificada/)).toBeInTheDocument();
  });

  it("sends the open timeline with its real asset ids and reports a failed execution truthfully", async () => {
    createMCPQueue.mockResolvedValue({ id: "q1", status: "failed", results: [{ status: "failed", error: { message: "Identificador de mídia inválido." } }] });
    const card = await openTimelineCard();
    act(() => publishMCPContext(timelineContext({ source: "mmfilm", sequenceName: "Entrevista final", clips: [{ assetId: ASSET }] })));
    await waitFor(() => expect(card.getByRole("button", { name: /Executar agora/ })).toBeEnabled());

    fireEvent.click(card.getByRole("button", { name: /Executar agora/ }));

    await waitFor(() => expect(createMCPQueue).toHaveBeenCalledWith(expect.objectContaining({
      tool_name: "mmfilm.timeline",
      targets: [expect.objectContaining({ id: "mmfilm:Entrevista final", kind: "timeline", asset_ids: [ASSET] })],
    })));
    expect(await screen.findByText(/não conseguiu executar a operação\. Identificador de mídia inválido/)).toBeInTheDocument();
    expect(screen.queryByText(/Backend informou conclusão/)).not.toBeInTheDocument();
  });
});

function localProvider(overrides = {}) {
  return {
    source: "mmfilm",
    label: "MMFilm",
    catalogue: () => ({
      tabs: [{ id: "corte", label: "Cortes" }],
      tools: [
        { id: "silence.remove", tab: "corte", label: "Remover silêncios", description: "Apaga pausas", params: [{ key: "nivel", label: "Sensibilidade", type: "range", min: 1, max: 10, default: 5 }] },
        { id: "motion.punch", tab: "corte", label: "Punch in", description: "Aproxima", analyze: false, params: [] },
      ],
    }),
    analyze: vi.fn(async () => ({ ok: true, summary: "Prévia" })),
    apply: vi.fn(async (toolId) => ({ ok: true, summary: `${toolId} aplicado` })),
    undo: vi.fn(() => true),
    canUndo: () => true,
    ...overrides,
  };
}

function renderOnMMFilm() {
  return render(<MemoryRouter initialEntries={["/ferramentas-graficas?tool=filmcraft"]}><UniversalCopilot /></MemoryRouter>);
}

function enqueue(label) {
  fireEvent.click(screen.getByRole("button", { name: label, expanded: false }));
  fireEvent.click(screen.getByRole("button", { name: /Adicionar à fila/ }));
}

describe("UniversalCopilot · ferramentas locais em ícones", () => {
  let unregister = () => {};
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mm_copilot_open", "1");
    listMCPTools.mockResolvedValue({ tools: [] });
  });
  afterEach(() => { unregister(); vi.clearAllMocks(); });

  it("abre o MCP com a grade da ferramenta aberta e aplica direto, registrando no histórico", async () => {
    const provider = localProvider();
    unregister = registerMCPActions(provider);
    renderOnMMFilm();
    expect(await screen.findByRole("region", { name: "Ferramentas MMFilm" })).toBeInTheDocument();
    expect(screen.queryByText("Projeto e destino")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Punch in", expanded: false }));
    fireEvent.click(screen.getByRole("button", { name: /Aplicar agora/ }));
    expect(await screen.findByText("motion.punch aplicado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Executado/ }));
    expect(screen.getByText("MMFilm · Punch in")).toBeInTheDocument();
  });

  it("enfileira várias ações e executa a fila em ordem no aplicativo aberto", async () => {
    const provider = localProvider();
    unregister = registerMCPActions(provider);
    renderOnMMFilm();
    await screen.findByRole("region", { name: "Ferramentas MMFilm" });
    enqueue("Remover silêncios");
    enqueue("Punch in");
    expect(screen.getByText("Sensibilidade 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Executar fila \(2\)/ }));
    await waitFor(() => expect(provider.apply).toHaveBeenCalledTimes(2));
    expect(provider.apply.mock.calls.map(([id]) => id)).toEqual(["silence.remove", "motion.punch"]);
    expect(provider.apply).toHaveBeenNthCalledWith(1, "silence.remove", { nivel: 5 });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Executar fila/ })).toBeNull());
    expect(screen.getAllByText("completed").length).toBeGreaterThanOrEqual(2);
  });

  it("para na primeira falha, permite executar uma operação sozinha e remover da fila", async () => {
    const provider = localProvider({
      apply: vi.fn()
        .mockResolvedValueOnce({ ok: false, summary: "Selecione clipes" })
        .mockRejectedValueOnce(new Error("Web Audio indisponível"))
        .mockRejectedValueOnce({})
        .mockResolvedValue({ ok: true, summary: "feito" }),
    });
    unregister = registerMCPActions(provider);
    renderOnMMFilm();
    await screen.findByRole("region", { name: "Ferramentas MMFilm" });
    enqueue("Punch in");
    enqueue("Remover silêncios");
    fireEvent.click(screen.getByRole("button", { name: /Executar fila \(2\)/ }));
    expect(await screen.findByText("Punch in: Selecione clipes")).toBeInTheDocument();
    expect(provider.apply).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Executar Punch in" }));
    expect(await screen.findByText("Web Audio indisponível", { selector: "p[role=status]" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Executar Punch in" }));
    expect(await screen.findByText("Falha na ferramenta.", { selector: "p[role=status]" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover Punch in da fila" }));
    expect(screen.queryByRole("button", { name: "Executar Punch in" })).toBeNull();
    expect(screen.getByRole("button", { name: /Executar fila \(1\)/ })).toBeInTheDocument();
  });

  it("bloqueia a execução quando o aplicativo da operação não está mais aberto", async () => {
    const provider = localProvider();
    unregister = registerMCPActions(provider);
    renderOnMMFilm();
    await screen.findByRole("region", { name: "Ferramentas MMFilm" });
    enqueue("Punch in");
    act(() => unregister());
    act(() => { unregister = registerMCPActions(localProvider({ source: "outro", label: "Outro app" })); });
    fireEvent.click(await screen.findByRole("button", { name: "Executar Punch in" }));
    expect(await screen.findByText("Abra MMFilm para executar “Punch in”.")).toBeInTheDocument();
    expect(provider.apply).not.toHaveBeenCalled();
    expect(screen.getByText("blocked")).toBeInTheDocument();
  });

  it("mantém destino, mídias e ferramentas do servidor recolhidos, mas acessíveis", async () => {
    unregister = registerMCPActions(localProvider());
    renderOnMMFilm();
    await screen.findByRole("region", { name: "Ferramentas MMFilm" });
    fireEvent.click(screen.getByRole("button", { name: /Mostrar destino, mídias e ferramentas do servidor/ }));
    expect(screen.getByText("Projeto e destino")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Recolher destino, mídias e ferramentas do servidor/ }));
    expect(screen.queryByText("Projeto e destino")).toBeNull();
  });
});