import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UniversalCopilot from "./UniversalCopilot";
import { createMCPQueue, listMCPTools } from "../../lib/mcpApi";
import { clearMCPContext, publishMCPContext, timelineContext } from "../../lib/mcpTargetContext";

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
