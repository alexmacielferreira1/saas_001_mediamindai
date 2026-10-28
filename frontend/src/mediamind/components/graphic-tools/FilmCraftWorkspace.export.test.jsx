import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";
import * as render$ from "./filmcraftRender";
import * as media$ from "../../../api/media";

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

// A peça exportada também é enviada ao Acervo (origin "export").
vi.mock("../../../api/media", async (importOriginal) => ({ ...(await importOriginal()), uploadMediaAsset: vi.fn() }));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  vi.mocked(media$.uploadMediaAsset).mockReset();
  vi.mocked(media$.uploadMediaAsset).mockResolvedValue({ id: "salvo-1" });
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
    // Vídeo em V1 + áudio vinculado em A1.
    expect(options.clips.map((clip) => clip.track)).toEqual(["V1", "A1"]);
    expect(screen.getByText("Renderizando 0%")).toBeInTheDocument();
    report(0.42);
    await screen.findByText("Renderizando 42%");
    finish();
    await screen.findByText("Concluído");
    expect(render$.downloadBlob).toHaveBeenCalledWith(blob, "Entrega final.webm");
    const [file, meta] = vi.mocked(media$.uploadMediaAsset).mock.calls[0];
    expect(file).toMatchObject({ name: "Entrega final.webm", type: "video/webm" });
    expect(meta).toEqual({ origin: "export" });
  });

  it("salva no Acervo e na pasta de destino, e avisa se o Acervo recusar", async () => {
    const blob = new Blob(["webm"], { type: "video/webm" });
    vi.mocked(render$.renderTimelineToWebm).mockResolvedValue(blob);
    vi.mocked(media$.uploadMediaAsset)
      .mockResolvedValueOnce({ id: "salvo-1", export_path: "empresa/2026-10-28/Seq.webm" })
      .mockRejectedValueOnce(new Error("Sem espaço no servidor"));
    setup();
    fireEvent.click(exportButton());
    expect(await screen.findByText(/salvo no Acervo e na pasta de destino \(empresa\/2026-10-28\/Seq\.webm\)/)).toBeInTheDocument();

    fireEvent.click(exportButton());
    expect((await screen.findAllByText(/baixado, mas não foi salvo no Acervo: Sem espaço no servidor/)).length).toBeGreaterThan(0);
    expect(render$.downloadBlob).toHaveBeenCalledTimes(2);
  });

  it("sem pasta de destino configurada diz só que ficou no Acervo", async () => {
    vi.mocked(render$.renderTimelineToWebm).mockResolvedValue(new Blob(["webm"], { type: "video/webm" }));
    vi.mocked(media$.uploadMediaAsset).mockRejectedValueOnce({}).mockResolvedValueOnce({ id: "salvo-2" });
    setup();
    fireEvent.click(exportButton());
    expect((await screen.findAllByText(/não foi salvo no Acervo: erro desconhecido/)).length).toBeGreaterThan(0);
    fireEvent.click(exportButton());
    expect(await screen.findByText(/downloads do navegador e salvo no Acervo$/)).toBeInTheDocument();
  });

  it("exportação que perdeu o som avisa na fila (nunca sai muda em silêncio)", async () => {
    const blob = new Blob(["webm"], { type: "video/webm" });
    vi.mocked(render$.renderTimelineToWebm).mockImplementation(async (options) => {
      options.onWarning("o arquivo saiu sem áudio: este navegador não tem Web Audio");
      return blob;
    });
    setup();
    fireEvent.click(exportButton());
    await screen.findByText("Concluído");
    expect(screen.getByRole("alert")).toHaveTextContent("Aviso: o arquivo saiu sem áudio");
    expect(render$.downloadBlob).toHaveBeenCalledWith(blob, "Sequência 01.webm");
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
