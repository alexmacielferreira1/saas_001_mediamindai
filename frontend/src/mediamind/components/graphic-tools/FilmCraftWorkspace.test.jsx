import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

describe("FilmCraftWorkspace media browser", () => {
  it("adds an acervo drag to the project without creating a timeline clip", () => {
    render(<FilmCraftWorkspace />);
    const payload = { id: 'project-acervo', name: 'Mídia do acervo', kind: 'video', src: '/api/v1/media/assets/project-acervo/stream', duration: 12, mimeType: 'video/mp4' };
    fireEvent.drop(screen.getByLabelText('Pasta Projeto MMFilm'), { dataTransfer: { getData: type => type === 'application/x-timeline2-media' ? JSON.stringify(payload) : '' } });
    expect(screen.getByRole('button', {name:'Mídia do acervo',exact:true})).toHaveAttribute('draggable','true');
    expect(screen.getByText(/0 clipes · 0 marcadores/)).toBeInTheDocument();
  });
  it("accepts an acervo drag directly onto a video track", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const track = container.querySelector('[data-track-id="V1"]');
    const payload = { id: 'acervo-17', name: 'Acervo reportagem', kind: 'video', src: '/api/v1/media/assets/acervo-17/stream', duration: 12, mimeType: 'video/mp4' };
    fireEvent.drop(track, { clientX: 200, dataTransfer: { getData: type => type === 'application/x-timeline2-media' ? JSON.stringify(payload) : '' } });
    expect(container.querySelector('[data-track-id="V1"]').textContent).toContain('Acervo reportagem');
  });
  it("opens a clicked media item in the source monitor without inserting it", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const input = container.querySelector(
      'input[accept="video/*,audio/*,image/*"]',
    );
    fireEvent.change(input, {
      target: {
        files: [new File(["video"], "Cena.mp4", { type: "video/mp4" })],
      },
    });

    const mediaItem = screen.getByRole("button", { name: /Cena\.mp4/ });
    fireEvent.click(mediaItem);
    fireEvent.doubleClick(mediaItem);

    expect(screen.getByText("Origem ☰")).toBeInTheDocument();
    expect(screen.getByText(/0 clipes · 0 marcadores/)).toBeInTheDocument();
  });

  it("offers Premiere-style media actions from the context menu", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const input = container.querySelector(
      'input[accept="video/*,audio/*,image/*"]',
    );
    fireEvent.change(input, {
      target: {
        files: [new File(["video"], "Cena.mp4", { type: "video/mp4" })],
      },
    });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Cena.mp4" }));
    expect(
      screen.getByRole("menuitem", { name: "Abrir no Monitor de Origem" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Religar mídia…" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Tornar offline" }),
    ).toBeInTheDocument();
  });
});
