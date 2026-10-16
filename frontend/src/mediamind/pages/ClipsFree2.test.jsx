import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const clipsFree2Api = vi.hoisted(() => ({ createClipsFree2Session: vi.fn() }));
const mediaApi = vi.hoisted(() => ({ uploadMediaAsset: vi.fn() }));
vi.mock("../../api/clipsFree2", () => clipsFree2Api);
vi.mock("../../api/media", () => mediaApi);

import ClipsFree2 from "./ClipsFree2";

describe("CLIPSFREE2", () => {
  it("creates a local manual review after selecting a real source", async () => {
    clipsFree2Api.createClipsFree2Session.mockResolvedValue({
      id: "session-1", status: "manual_review", candidates: [],
      message: "A análise automática não está configurada. Continue com o corte manual.",
    });
    mediaApi.uploadMediaAsset.mockResolvedValue({ id: "asset-1" });
    render(<ClipsFree2 />);

    expect(screen.getByRole("heading", { name: "CLIPSFREE2" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Vídeo para cortar"), {
      target: { files: [new File(["video"], "entrevista.mp4", { type: "video/mp4" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar sessão de corte" }));

    expect(await screen.findByText(/corte manual/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Entrada do corte")).toBeInTheDocument();
  });

  it("lets the editor add a manual candidate when automatic analysis is unavailable", async () => {
    clipsFree2Api.createClipsFree2Session.mockResolvedValue({
      id: "session-2", status: "manual_review", candidates: [],
      message: "A análise automática não está configurada. Continue com o corte manual.",
    });
    mediaApi.uploadMediaAsset.mockResolvedValue({ id: "asset-2" });
    render(<ClipsFree2 />);
    fireEvent.change(screen.getByLabelText("Vídeo para cortar"), {
      target: { files: [new File(["video"], "manual.mp4", { type: "video/mp4" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar sessão de corte" }));
    await screen.findByText(/corte manual/i);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar corte manual" }));

    expect(screen.getByRole("heading", { name: "Cortes sugeridos" })).toBeInTheDocument();
    expect(screen.getByText("Corte manual 1")).toBeInTheDocument();
  });

  it("opens a clearly labeled visual demonstration without uploading media", () => {
    render(<ClipsFree2 />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir demonstração visual" }));

    expect(screen.getAllByText(/modo demonstração visual/i)).not.toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Cortes sugeridos" })).toBeInTheDocument();
    expect(screen.getByText("Abertura que prende a atenção")).toBeInTheDocument();
  });
});
