import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mediaApi, clipsApi } = vi.hoisted(() => ({
  mediaApi: { uploadMediaAsset: vi.fn() },
  clipsApi: { startClipAnalysis: vi.fn() },
}));
const aiApi = vi.hoisted(() => ({ getAIConnections: vi.fn() }));

vi.mock("../../api/media", () => mediaApi);
vi.mock("../../api/clips", () => clipsApi);
vi.mock("../../api/generation", () => aiApi);

vi.mock("../lib/producaoStore", () => ({
  useProducaoProjetos: () => [
    { id: 6, etapa: "finalizado", episodio: "EP049", programa: "Pediátricos", titulo: "Vacinação infantil" },
    { id: 7, etapa: "em_edicao", episodio: "EP048", programa: "Minuto Simers", titulo: "Não aparece" },
  ],
}));

import ClipsFree from "./ClipsFree";

describe("CLIPSFREE", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:clipsfree-source");
    URL.revokeObjectURL = vi.fn();
    mediaApi.uploadMediaAsset.mockResolvedValue({ id: "asset-real", stream_url: "/api/v1/media/assets/asset-real/stream" });
    clipsApi.startClipAnalysis.mockResolvedValue({
      id: "analysis-real",
      status: "unavailable",
      candidates: [],
      message: "A transcrição ainda não está configurada para esta empresa.",
    });
    aiApi.getAIConnections.mockResolvedValue({ connections: [{ id: "credits-ai", name: "IA com créditos", model: "modelo-real", enabled: true, key_configured: true }] });
  });

  it("turns an uploaded source into an editable local clip session", async () => {
    render(<ClipsFree />);

    expect(screen.getByRole("heading", { name: "CLIPSFREE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar sugestões" })).toBeDisabled();
    await screen.findByRole("option", { name: /IA com créditos/i });

    const video = new File(["video"], "entrevista.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Selecionar vídeo"), { target: { files: [video] } });

    expect(screen.getByText("entrevista.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar sugestões" })).toBeEnabled();
    expect(screen.getByLabelText("Prévia do vídeo de origem")).toHaveAttribute("src", "blob:clipsfree-source");
  });

  it("uploads the source with the selected registered AI and never invents suggestions when unavailable", async () => {
    render(<ClipsFree />);
    await screen.findByRole("option", { name: /IA com créditos/i });
    const video = new File(["video"], "podcast.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Selecionar vídeo"), { target: { files: [video] } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar sugestões" }));

    expect(await screen.findByText(/transcrição ainda não está configurada/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sugestões de cortes" })).not.toBeInTheDocument();
    expect(mediaApi.uploadMediaAsset).toHaveBeenCalledWith(video, { origin: "clipsfree" });
    expect(clipsApi.startClipAnalysis).toHaveBeenCalledWith("asset-real", "credits-ai");
  });

  it("lists finished productions on the left without pretending an unlinked master is playable", () => {
    render(<ClipsFree />);

    expect(screen.getByRole("heading", { name: "Mídias finalizadas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /EP049.*Vacinação infantil/i }));

    expect(screen.getByText(/master ainda não foi vinculado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Prévia do vídeo de origem")).not.toBeInTheDocument();
  });

});
