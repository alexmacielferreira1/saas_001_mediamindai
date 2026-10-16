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
    aiApi.getAIConnections.mockResolvedValue({ connections: [{ id: "credits-ai", name: "IA com créditos", model: "modelo-real", enabled: true, key_configured: true }], tool_connections: { "auto-clips": "credits-ai" }, can_manage: true });
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
    fireEvent.click(screen.getByRole("button", { name: "Abrir editor manual" }));
    expect(screen.getByRole("heading", { name: "Corte manual" })).toBeInTheDocument();
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

  it("opens the new-cut intake with project, file and authorized URL choices", () => {
    render(<ClipsFree />);

    fireEvent.click(screen.getByRole("button", { name: "Novo corte" }));

    expect(screen.getByRole("heading", { name: "Novo corte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar projeto finalizado/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar arquivo/ })).toBeInTheDocument();
    expect(screen.getByLabelText("URL do vídeo")).toBeInTheDocument();
  });

  it("shows returned suggestions as reviewable cuts before opening the editor", async () => {
    clipsApi.startClipAnalysis.mockResolvedValueOnce({
      id: "analysis-real",
      status: "completed",
      message: "Análise concluída.",
      candidates: [{
        id: "candidate-1",
        quote: "A vacinação protege toda a comunidade.",
        start: 12,
        end: 42,
        score: 88,
        rationale: "O trecho começa com uma afirmação completa e tem contexto suficiente.",
        captions: [{ start: 12, end: 16, text: "A vacinação protege" }],
      }],
    });
    render(<ClipsFree />);
    await screen.findByRole("option", { name: /IA com créditos/i });
    fireEvent.change(screen.getByLabelText("Selecionar vídeo"), { target: { files: [new File(["video"], "podcast.mp4", { type: "video/mp4" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar sugestões" }));

    expect(await screen.findByRole("heading", { name: "Sugestões de cortes" })).toBeInTheDocument();
    expect(screen.getByText("A vacinação protege toda a comunidade.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Revisar trecho 00:12 a 00:42/ })).toBeInTheDocument();
    expect(screen.getByText("1 legenda temporizada")).toBeInTheDocument();
  });

  it("shows the admin-assigned AI without exposing a selector to regular users", async () => {
    aiApi.getAIConnections.mockResolvedValueOnce({
      connections: [{ id: "credits-ai", name: "IA definida pela empresa", model: "modelo-real", enabled: true, key_configured: true }],
      tool_connections: { "auto-clips": "credits-ai" },
      can_manage: false,
    });
    render(<ClipsFree />);

    expect(await screen.findByText("IA definida pela empresa")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "IA para analisar e legendar" })).not.toBeInTheDocument();
    expect(screen.getByText("A IA desta ferramenta é definida pela administração da empresa.")).toBeInTheDocument();
  });

});
