import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";
import * as render$ from "./filmcraftRender";

// jsdom não grava canvas: substituímos só o suporte e o gravador; o restante (intervalo, nomes, camadas) é real.
vi.mock("./filmcraftRender", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exportSupport: vi.fn(() => ({ supported: true, reason: "", audio: true, mimeType: "video/webm;codecs=vp9,opus" })),
    renderTimelineToWebm: vi.fn(),
    downloadBlob: vi.fn(),
  };
});

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  localStorage.clear();
  vi.mocked(render$.renderTimelineToWebm).mockReset();
  vi.mocked(render$.downloadBlob).mockReset();
});
afterEach(() => vi.clearAllMocks());

function setup() {
  const view = render(<FilmCraftWorkspace />);
  const payload = { id: "cena", name: "Cena", kind: "video", src: "/api/v1/media/assets/cena/stream", duration: 8, mimeType: "video/mp4" };
  fireEvent.drop(view.container.querySelector('[data-track-id="V1"]'), {
    clientX: 0,
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Exportar" })[0]);
  return view;
}
// Botão Exportar do painel de exportação (o do cabeçalho troca de workspace).
function exportButton() {
  return screen.getAllByRole("button", { name: "Exportar" }).find((button) => button.title);
}

describe("MMFilm — exportação WebM", () => {
  it("Exportar renderiza a sequência com as configurações escolhidas e baixa o .webm", async () => {
    const blob = new Blob(["webm"], { type: "video/webm" });
    let report;
    let finish;
    vi.mocked(render$.renderTimelineToWebm).mockImplementation((options) => {
      report = options.onProgress;
      return new Promise((resolve) => {
        finish = () => resolve(blob);
      });
    });
    setup();
    expect(screen.getByDisplayValue("Pasta de downloads do navegador")).toHaveAttribute("readonly");
    expect(screen.queryByDisplayValue(/C:\\Users/)).toBeNull();
    fireEvent.change(screen.getByDisplayValue("Sequência 01"), { target: { value: "Entrega final" } });
    fireEvent.change(screen.getByDisplayValue("Corresponder à origem – Alta taxa de bits"), { target: { value: "TikTok 1080×1920" } });
    fireEvent.change(screen.getByDisplayValue("9.94"), { target: { value: "4" } });
    expect(screen.getByText(/Entrega final\.webm/)).toBeInTheDocument();
    expect(screen.getByText(/WebM \(VP9\/VP8\) · 1080×1920 · 29,97 fps · Progressivo · 8,0 s/)).toBeInTheDocument();
    expect(screen.getByText(/Tamanho estimado: 4 MB/)).toBeInTheDocument();

    fireEvent.click(exportButton());
    const options = vi.mocked(render$.renderTimelineToWebm).mock.calls[0][0];
    expect(options).toMatchObject({ width: 1080, height: 1920, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 320_000, includeAudio: true, range: { start: 0, end: 8 } });
    expect(options.clips).toHaveLength(1);
    expect(screen.getByText("Renderizando 0%")).toBeInTheDocument();
    report(0.42);
    await screen.findByText("Renderizando 42%");
    finish();
    await screen.findByText("Concluído");
    expect(render$.downloadBlob).toHaveBeenCalledWith(blob, "Entrega final.webm");
  });

  it("Parar cancela a renderização em curso e a fila mostra Cancelado", async () => {
    vi.mocked(render$.renderTimelineToWebm).mockImplementation(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("cancelada"), { name: "AbortError" })));
        }),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar" }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar fila" }));
    await screen.findByText("Renderizando 0%");
    fireEvent.click(screen.getByRole("button", { name: "Parar" }));
    await screen.findByText("Cancelado");
    // a fila para: o segundo item não começa
    expect(render$.renderTimelineToWebm).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Pronto")).toBeInTheDocument();
    expect(render$.downloadBlob).not.toHaveBeenCalled();
  });

  it("falha real aparece na linha da fila, sem arquivo baixado", async () => {
    vi.mocked(render$.renderTimelineToWebm).mockRejectedValue(new Error("mídia offline “Cena” — religue antes de exportar"));
    setup();
    fireEvent.click(exportButton());
    await screen.findByText(/Falhou: mídia offline/);
    expect(render$.downloadBlob).not.toHaveBeenCalled();
    const row = screen.getByText(/Falhou:/).closest(".border");
    fireEvent.click(within(row).getByRole("button", { name: /Remover/ }));
    expect(screen.queryByText(/Falhou:/)).toBeNull();
  });

  it("sem MediaRecorder/captureStream o botão Exportar fica desabilitado com explicação", () => {
    vi.mocked(render$.exportSupport).mockReturnValueOnce({ supported: false, reason: "MediaRecorder indisponível" });
    setup();
    expect(exportButton()).toBeDisabled();
    expect(exportButton()).toHaveAttribute("title", "Exportação indisponível neste navegador: MediaRecorder indisponível");
  });
});
