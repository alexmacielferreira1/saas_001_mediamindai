import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";
import { clearAudioBufferCache } from "./filmcraftAudio";
import { FakeAudioContext, fakeMediaFetch } from "./filmcraftTestAudio";

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  localStorage.clear();
  clearAudioBufferCache();
  FakeAudioContext.instances = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lane(container, track) {
  return container.querySelector(`[data-track-id="${track}"]`);
}
function drop(container, { id, name, track = "V1", kind = "video", duration = 8 }) {
  const payload = { id, name, kind, src: `/api/v1/media/assets/${id}/stream`, duration, mimeType: kind === "audio" ? "audio/mpeg" : "video/mp4" };
  fireEvent.drop(lane(container, track), {
    clientX: 0,
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
}
function openMixer() {
  const bar = screen.getByRole("button", { name: "Mídia" }).parentElement;
  fireEvent.click(within(bar).getByRole("button", { name: "Janela" }));
  const entry = [...bar.querySelectorAll(".min-w-56 > button")].find((node) => node.firstChild.textContent === "Mixer de faixa de áudio");
  fireEvent.click(entry);
}
function strip(id) {
  return screen.getByLabelText(`Volume ${id}`).closest(".flex-col");
}
// Segue a cadeia fonte → ganho do clipe → pan do clipe → entrada do barramento → ganho do barramento.
function busGainOf(source) {
  const panner = source.connections[0].connections[0];
  const input = panner.connections[0];
  return input.connections[0];
}

describe("MMFilm — mixer de áudio", () => {
  it("faders, pan e mudo do master são controlados; Mixer de clipe ajusta o clipe sob o indicador", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "musica", name: "Trilha", track: "A1", kind: "audio" });
    openMixer();
    fireEvent.change(screen.getByLabelText("Volume A1"), { target: { value: "-12" } });
    fireEvent.change(screen.getByLabelText("Pan A1"), { target: { value: "-30" } });
    expect(screen.getByLabelText("Volume A1")).toHaveValue("-12");
    expect(screen.getByLabelText("Pan A1")).toHaveValue("-30");

    fireEvent.click(screen.getByRole("button", { name: "Mixer de clipe" }));
    expect(screen.getByLabelText("Volume A1")).toHaveValue("0");
    expect(screen.getByLabelText("Volume A2")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Volume A1"), { target: { value: "-6" } });
    expect(screen.getByLabelText("Volume A1")).toHaveValue("-6");
    expect(screen.getByLabelText("Volume A1")).toHaveAttribute("title", "Clipe Trilha: -6 dB");

    fireEvent.click(screen.getByRole("button", { name: "Mixer de faixa ☰" }));
    expect(screen.getByLabelText("Volume A1")).toHaveValue("-12");

    const mute = within(strip("Mix")).getByRole("button", { name: "M" });
    fireEvent.click(mute);
    expect(mute.className).toContain("bg-amber-500");
    fireEvent.change(screen.getByLabelText("Canais A2"), { target: { value: "Mono" } });
    expect(screen.getByLabelText("Canais A2")).toHaveValue("Mono");
  });

  it("Origem abre o monitor de origem e Efeitos leva ao painel de efeitos", () => {
    render(<FilmCraftWorkspace />);
    openMixer();
    fireEvent.click(screen.getByRole("button", { name: "Origem" }));
    expect(screen.getByText("Origem ☰")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Efeitos" }));
    expect(screen.getByPlaceholderText("Pesquisar efeitos")).toBeInTheDocument();
  });

  it("Reproduzir agenda o áudio de A1 no Web Audio e o mudo da faixa zera o barramento", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", fakeMediaFetch({ duration: 30 }));
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "voz", name: "Locução", track: "A1", kind: "audio" });
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    await waitFor(() => expect(FakeAudioContext.instances[0]?.sources.length).toBe(1));
    const context = FakeAudioContext.instances[0];
    const [source] = context.sources;
    expect(source.start).toHaveBeenCalledWith(0, 0);
    expect(source.stop).toHaveBeenCalledWith(8);
    expect(fetch).toHaveBeenCalledWith("/api/v1/media/assets/voz/stream", { credentials: "include" });
    const bus = busGainOf(source);
    expect(bus.gain.value).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Silenciar A1" }));
    expect(bus.gain.value).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Ativar A1" }));
    fireEvent.click(screen.getByRole("button", { name: "Solo A2" }));
    expect(bus.gain.value).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    expect(source.stop).toHaveBeenCalledTimes(2);
  });

  it("medidores L/R refletem o analisador do master durante a reprodução", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", fakeMediaFetch());
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "som", name: "Som", track: "A1", kind: "audio" });
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    await waitFor(() => expect(FakeAudioContext.instances[0]?.analysers.length).toBe(2));
    const [left, right] = FakeAudioContext.instances[0].analysers;
    left.level = 1;
    right.level = 0;
    const meterL = container.querySelector('[data-meter-channel="L"]');
    const meterR = container.querySelector('[data-meter-channel="R"]');
    await waitFor(() => expect(meterL.style.height).toBe("100%"));
    expect(meterR.style.height).toBe("4%");
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    await waitFor(() => expect(meterL.style.height).toBe(""));
  });
});

describe("MMFilm — Programa multicamada", () => {
  it("compõe V1 e V2 empilhados (V2 por cima) e oculta camadas desligadas", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "fundo", name: "Fundo", track: "V1" });
    drop(container, { id: "pip", name: "PiP", track: "V2" });
    let videos = [...container.querySelectorAll("video")];
    expect(videos.map((video) => video.getAttribute("src"))).toEqual([
      "/api/v1/media/assets/fundo/stream",
      "/api/v1/media/assets/pip/stream",
    ]);
    expect(videos.map((video) => video.style.zIndex)).toEqual(["1", "2"]);
    expect(videos.every((video) => video.muted)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar V2" }));
    videos = [...container.querySelectorAll("video")];
    expect(videos.map((video) => video.getAttribute("src"))).toEqual(["/api/v1/media/assets/fundo/stream"]);
  });

  it("com Web Audio disponível, os vídeos do Programa ficam mudos (o som vem da mixagem)", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "cena", name: "Cena", track: "V1" });
    expect(container.querySelector("video").muted).toBe(true);
  });

  it("gaps ficam pretos: sem camada no indicador o Programa mostra só o timecode", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "cena", name: "Cena", track: "V1" });
    act(() => {
      fireEvent.pointerDown(container.querySelector("[data-timeline-ruler]"), { clientX: 20 * 12, button: 0 });
      fireEvent.pointerUp(window, { clientX: 20 * 12 });
    });
    expect(container.querySelector("video")).toBeNull();
    const program = screen.getByText("Programa ☰").closest(".flex-col");
    // Quadro preto com o timecode real do indicador (o rodapé do monitor mostra o mesmo).
    expect(within(program).getAllByText("00:00:20:00").length).toBeGreaterThan(0);
  });
});
