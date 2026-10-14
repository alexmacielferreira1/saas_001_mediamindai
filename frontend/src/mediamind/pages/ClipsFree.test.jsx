import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  });

  it("turns an uploaded source into an editable local clip session", () => {
    render(<ClipsFree />);

    expect(screen.getByRole("heading", { name: "CLIPSFREE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar sugestões" })).toBeDisabled();

    const video = new File(["video"], "entrevista.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Selecionar vídeo"), { target: { files: [video] } });

    expect(screen.getByText("entrevista.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar sugestões" })).toBeEnabled();
    expect(screen.getByLabelText("Prévia do vídeo de origem")).toHaveAttribute("src", "blob:clipsfree-source");
  });

  it("creates editable clip suggestions from the local source", () => {
    render(<ClipsFree />);
    const video = new File(["video"], "podcast.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Selecionar vídeo"), { target: { files: [video] } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar sugestões" }));

    expect(screen.getByRole("heading", { name: "Sugestões de cortes" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Abrir no editor" })).toHaveLength(3);
  });

  it("lists finished productions on the left without pretending an unlinked master is playable", () => {
    render(<ClipsFree />);

    expect(screen.getByRole("heading", { name: "Mídias finalizadas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /EP049.*Vacinação infantil/i }));

    expect(screen.getByText(/master ainda não foi vinculado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Prévia do vídeo de origem")).not.toBeInTheDocument();
  });

  it("opens the full six-stage editing workflow for a selected suggestion", () => {
    render(<ClipsFree />);
    const video = new File(["video"], "podcast.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Selecionar vídeo"), { target: { files: [video] } });
    fireEvent.click(screen.getByRole("button", { name: "Gerar sugestões" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Abrir no editor" })[0]);

    expect(screen.getByRole("button", { name: /Edição do corte/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Redes e formatos/ })).toBeInTheDocument();
  });
});
