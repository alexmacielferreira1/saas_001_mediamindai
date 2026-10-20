import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mediaApi, clipsApi } = vi.hoisted(() => ({
  mediaApi: { uploadMediaAsset: vi.fn(), exportMediaClip: vi.fn(), listMediaAssets: vi.fn(() => Promise.resolve([])), resolveMediaUrl: (url) => url },
  clipsApi: { startClipAnalysis: vi.fn() },
}));
const aiApi = vi.hoisted(() => ({ getAIConnections: vi.fn() }));
vi.mock("../../api/media", () => mediaApi);
vi.mock("../../api/clips", () => clipsApi);
vi.mock("../../api/generation", () => aiApi);
vi.mock("../lib/empresaContext", () => ({ useEmpresa: () => ({ current: "tenant", isGlobal: false }) }));
vi.mock("../auth", () => ({ useAuth: () => ({ user: {} }) }));
vi.mock("../lib/producaoStore", () => ({ useProducaoProjetos: () => [] }));

import ClipsFree from "./ClipsFree";

const candidate = {
  id: "candidate-1",
  quote: "A vacinação protege toda a comunidade.",
  start: 12,
  end: 42,
  score: 70,
  dimensions: { hook: 20, flow: 18, value: 17, shareability: 15 },
  evidence: [{ text: "A", start: 12, end: 12.3 }, { text: "vacinação", start: 12.3, end: 13 }, { text: "protege", start: 13, end: 14 }],
  captions: [{ start: 12, end: 14, text: "A vacinação protege" }],
};

async function analyse() {
  render(<ClipsFree />);
  await screen.findByRole("option", { name: /IA com créditos/i });
  fireEvent.change(screen.getByLabelText("Selecionar vídeo"), { target: { files: [new File(["v"], "podcast.mp4", { type: "video/mp4" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Gerar sugestões" }));
  await screen.findByRole("heading", { name: "Sugestões de cortes" });
}

describe("CLIPSFREE recursos adicionais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => "blob:item");
    URL.revokeObjectURL = vi.fn();
    mediaApi.uploadMediaAsset.mockResolvedValue({ id: "asset-real" });
    clipsApi.startClipAnalysis.mockResolvedValue({ id: "analysis", status: "completed", message: "Análise concluída.", candidates: [candidate] });
    aiApi.getAIConnections.mockResolvedValue({ connections: [{ id: "credits-ai", name: "IA com créditos", model: "m", enabled: true, key_configured: true }], tool_connections: { "auto-clips": "credits-ai" }, can_manage: true });
  });

  it("applies duration presets to the analysis request", async () => {
    render(<ClipsFree />);
    await screen.findByRole("option", { name: /IA com créditos/i });
    fireEvent.click(screen.getByRole("button", { name: "Curtos 15–30s" }));
    expect(screen.getByLabelText("Duração mínima")).toHaveValue(15);
    expect(screen.getByLabelText("Duração máxima")).toHaveValue(30);
    fireEvent.change(screen.getByLabelText("Selecionar vídeo"), { target: { files: [new File(["v"], "a.mp4", { type: "video/mp4" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar sugestões" }));
    await waitFor(() => expect(clipsApi.startClipAnalysis).toHaveBeenCalledWith("asset-real", "credits-ai", expect.objectContaining({ minimum: 15, maximum: 30 })));
  });

  it("explains the score with the four server dimensions", async () => {
    await analyse();
    fireEvent.click(screen.getByRole("button", { name: /Detalhes da nota 70/ }));
    const breakdown = screen.getByLabelText(/Composição da nota/);
    expect(within(breakdown).getByText("Gancho")).toBeInTheDocument();
    expect(within(breakdown).getByText("20/25")).toBeInTheDocument();
    expect(within(breakdown).getByText("15/25")).toBeInTheDocument();
  });

  it("exports every real suggestion as MP4 with burned captions and reports each result", async () => {
    mediaApi.exportMediaClip.mockResolvedValue({ blob: new Blob(["mp4"]), filename: "corte.mp4" });
    await analyse();
    fireEvent.click(screen.getByRole("button", { name: "Exportar todos em MP4 (9:16)" }));
    const list = await screen.findByLabelText("Exportação em lote");
    await waitFor(() => expect(within(list).getByText("Pronto")).toBeInTheDocument());
    const payload = mediaApi.exportMediaClip.mock.calls[0][0];
    expect(payload).toMatchObject({ asset_id: "asset-real", source_in: 12, duration: 30 });
    expect(payload.properties.clip_render).toMatchObject({ aspect: "9:16", captions: [{ start: 0, end: 2, text: "A vacinação protege" }] });
    expect(payload.properties.clip_render.captions[0].words).toHaveLength(3);
    expect(within(list).getByRole("link", { name: "Baixar" })).toHaveAttribute("href", "blob:item");
  });

  it("shows a failed item instead of pretending the batch export worked", async () => {
    mediaApi.exportMediaClip.mockRejectedValue(new Error("O motor local de exportação não está disponível."));
    await analyse();
    fireEvent.click(screen.getByRole("button", { name: "Exportar todos em MP4 (9:16)" }));
    const list = await screen.findByLabelText("Exportação em lote");
    expect(await within(list).findByText(/Falhou: O motor local/)).toBeInTheDocument();
    expect(within(list).queryByRole("link", { name: "Baixar" })).not.toBeInTheDocument();
  });

  it("opens the editor with word-timed captions from the analysis", async () => {
    await analyse();
    fireEvent.click(screen.getByRole("button", { name: "Editor" }));
    fireEvent.click(screen.getByRole("button", { name: /Análise IA e legendas/ }));
    expect(screen.getAllByText(/3 palavra\(s\) com tempo real/).length).toBeGreaterThan(0);
  });
});
