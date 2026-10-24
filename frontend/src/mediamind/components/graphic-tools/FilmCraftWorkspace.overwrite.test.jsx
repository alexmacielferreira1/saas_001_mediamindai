import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";

// Sobrescrever como no Premiere: colocar um clipe sobre outro na mesma faixa apara/divide o de baixo
// (vídeo e áudio vinculado); Ctrl (ou o modo inserção) insere e empurra.
const PX = 12;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function lane(container, track = "V1") {
  return container.querySelector(`[data-track-id="${track}"]`);
}
function clipsOn(container, track = "V1") {
  return [...lane(container, track).querySelectorAll("[data-clip-id]")];
}
const round = (value) => Math.round(value * 1000) / 1000;
function geometry(container, track = "V1") {
  return clipsOn(container, track)
    .map((node) => [round(Number(node.dataset.start)), round(Number(node.dataset.duration))])
    .sort((a, b) => a[0] - b[0]);
}
// Invariante: depois de qualquer operação, nenhuma faixa tem dois clipes no mesmo trecho.
function expectNoOverlap(container) {
  for (const track of ["V1", "V2", "V3", "A1", "A2", "A3"]) {
    const list = geometry(container, track);
    list.slice(1).forEach(([start], index) => {
      const [previousStart, previousDuration] = list[index];
      expect(previousStart + previousDuration, `${track} sobreposta`).toBeLessThanOrEqual(start + 1e-6);
    });
  }
}
function dropMedia(container, { id, name, seconds = 0, track = "V1", duration = 8, ctrlKey = false }) {
  const payload = { id, name, kind: "video", src: `/api/v1/media/assets/${id}/stream`, duration, mimeType: "video/mp4" };
  const event = createEvent.drop(lane(container, track), {
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
  // O jsdom não leva clientX/ctrlKey para eventos de arrastar: definidos no próprio evento.
  Object.defineProperty(event, "clientX", { value: seconds * PX });
  Object.defineProperty(event, "ctrlKey", { value: ctrlKey });
  fireEvent(lane(container, track), event);
}
function select(container, start, track = "V1") {
  fireEvent.click(clipsOn(container, track).find((node) => round(Number(node.dataset.start)) === start));
}

describe("MMFilm — soltar mídia sobre clipe existente", () => {
  it("B solto em 4 s sobre A[0-8] apara A em V1 e A1 (não sobrepõe)", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 4 });
    expect(geometry(container, "V1")).toEqual([[0, 4], [4, 8]]);
    expect(geometry(container, "A1")).toEqual([[0, 4], [4, 8]]);
    expectNoOverlap(container);
  });

  it("B no meio de A divide A em duas partes nas duas faixas", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 3, duration: 3 });
    expect(geometry(container, "V1")).toEqual([[0, 3], [3, 3], [6, 2]]);
    expect(geometry(container, "A1")).toEqual([[0, 3], [3, 3], [6, 2]]);
    // A parte final de A continua vinculada ao seu áudio: selecionar uma seleciona a outra.
    select(container, 6);
    expect(clipsOn(container, "A1").find((node) => node.dataset.start === "6").className).toContain("ring-2");
    expectNoOverlap(container);
  });

  it("Ctrl ao soltar (ou o modo inserção) insere e empurra o resto", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 4, duration: 2, ctrlKey: true });
    expect(geometry(container, "V1")).toEqual([[0, 4], [4, 2], [6, 4]]);
    expect(geometry(container, "A1")).toEqual([[0, 4], [4, 2], [6, 4]]);
    expectNoOverlap(container);
  });
});

describe("MMFilm — operações que colocam clipes sobrescrevem", () => {
  it("Duplicar sobre o clipe seguinte sobrescreve em vez de empilhar", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 8, duration: 10 });
    select(container, 0);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));
    expect(geometry(container, "V1")).toEqual([[0, 8], [8, 8], [16, 2]]);
    expect(geometry(container, "A1")).toEqual([[0, 8], [8, 8], [16, 2]]);
    expectNoOverlap(container);
  });

  it("+1 quadro empurra sobre o vizinho aparando-o", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 8 });
    select(container, 0);
    fireEvent.click(screen.getByRole("button", { name: "+1 quadro" }));
    const v1 = geometry(container, "V1");
    expect(v1[0]).toEqual([round(1 / 30), 8]);
    expect(v1[1][0]).toBeCloseTo(8 + 1 / 30, 3);
    expect(geometry(container, "A1")).toEqual(v1);
    expectNoOverlap(container);
  });

  it("Rate stretch pelo painel estica o par vinculado e sobrescreve o seguinte", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 8 });
    select(container, 0);
    const field = screen.getByRole("spinbutton", { name: "Rate stretch · duração" });
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "10" } });
    fireEvent.blur(field);
    expect(geometry(container, "V1")).toEqual([[0, 10], [10, 6]]);
    expect(geometry(container, "A1")).toEqual([[0, 10], [10, 6]]);
    expectNoOverlap(container);
  });

  it("Texto sem faixa de vídeo livre sobrescreve na faixa clicada", async () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A", track: "V1" });
    dropMedia(container, { id: "b", name: "B", track: "V2" });
    dropMedia(container, { id: "c", name: "C", track: "V3" });
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.click(clipsOn(container, "V2")[0], { clientX: 2 * PX });
    const dialog = await screen.findByRole("dialog", { name: "Texto do título" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Texto do título" }), { target: { value: "Abertura" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(geometry(container, "V2")).toEqual([[0, 2], [2, 5], [7, 1]]));
    expectNoOverlap(container);
  });
});
