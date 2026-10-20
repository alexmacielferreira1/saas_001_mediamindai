import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";
import { FakeAudioContext, fakeMediaFetch } from "./filmcraftTestAudio";
import { clearAudioBufferCache } from "./filmcraftAudio";
import { currentMCPActions } from "../../lib/mcpActions";

const PX = 12;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  localStorage.clear();
  FakeAudioContext.instances = [];
  clearAudioBufferCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lane(container, track = "V1") {
  return container.querySelector(`[data-track-id="${track}"]`);
}
function clipsOn(container, track = "V1") {
  return [...lane(container, track).children].filter((node) => node.tagName === "BUTTON");
}
function drop(container, { id, name, duration = 12, track = "V1" }) {
  const payload = { id, name, kind: "video", src: `/api/v1/media/assets/${id}/stream`, duration, mimeType: "video/mp4" };
  fireEvent.drop(lane(container, track), {
    clientX: 0,
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
}

// Áudio real de teste a 1 kHz: fala (0,5) em 0–3 s e 6–12 s, silêncio (0,001) em 3–6 s.
class SpeechAudioContext extends FakeAudioContext {
  decodeAudioData() {
    const rate = 1000;
    const data = new Float32Array(12 * rate).map((_, index) => (index >= 3 * rate && index < 6 * rate ? 0.001 : index % 2 ? 0.5 : -0.5));
    return Promise.resolve({ duration: 12, length: data.length, sampleRate: rate, numberOfChannels: 1, getChannelData: () => data });
  }
}

describe("MMFilm · ferramentas de um clique do MCP", () => {
  it("registra a grade só enquanto está ativo e aplica movimento no clipe selecionado com desfazer", async () => {
    const { container, rerender } = render(<FilmCraftWorkspace active />);
    const provider = currentMCPActions();
    expect(provider).toMatchObject({ source: "mmfilm", label: "MMFilm" });
    expect(provider.catalogue().tools.map((tool) => tool.id)).toContain("silence.remove");
    expect(provider.canUndo()).toBe(false);
    expect(provider.undo()).toBe(false);

    const empty = await act(() => provider.apply("motion.punch", {}));
    expect(empty).toEqual({ ok: false, summary: expect.stringMatching(/Selecione um ou mais clipes/) });

    drop(container, { id: "take-1", name: "Entrevista" });
    await waitFor(() => expect(clipsOn(container)).toHaveLength(1));
    fireEvent.click(clipsOn(container)[0]);
    const preview = await act(() => provider.analyze("silence.remove", { analysisTracks: [] }));
    expect(preview.ok).toBe(false);

    const result = await act(() => provider.apply("motion.punch", { intensity: 5 }));
    expect(result).toMatchObject({ ok: true, count: 1, summary: "Punch in aplicado em 1 clipe(s)" });
    expect(result.clips).toBeUndefined();
    expect(screen.getByText("MCP · Punch in aplicado em 1 clipe(s)")).toBeInTheDocument();
    const video = container.querySelector("video");
    expect(video.style.transform).toContain("scale(1.15)");
    expect(provider.canUndo()).toBe(true);
    act(() => {
      expect(provider.undo()).toBe(true);
    });
    await waitFor(() => expect(container.querySelector("video").style.transform).toContain("scale(1)"));

    rerender(<FilmCraftWorkspace active={false} />);
    expect(currentMCPActions()).toBeNull();
  });

  it("remove o silêncio real do áudio, fecha o buraco e dá prévia sem alterar", async () => {
    vi.stubGlobal("AudioContext", SpeechAudioContext);
    vi.stubGlobal("fetch", fakeMediaFetch({ duration: 12 }));
    const { container } = render(<FilmCraftWorkspace active />);
    drop(container, { id: "take-1", name: "Entrevista" });
    await waitFor(() => expect(clipsOn(container)).toHaveLength(1));
    const provider = currentMCPActions();

    const preview = await act(() => provider.analyze("silence.remove", {}));
    expect(preview.ok).toBe(true);
    expect(preview.summary).toMatch(/^Prévia \(nada foi alterado\): 1 silêncio\(s\)/);
    expect(clipsOn(container)).toHaveLength(1);

    const applied = await act(() => provider.apply("silence.remove", {}));
    expect(applied.summary).toMatch(/^1 silêncio\(s\) · −2,73 s/);
    await waitFor(() => expect(clipsOn(container)).toHaveLength(2));
    // O clipe (8 s na timeline) perde 3,15–5,88 s: a segunda parte encosta na primeira, em 3,15 s.
    const [first, second] = clipsOn(container).map((node) => [Number.parseFloat(node.style.left) / PX, Number.parseFloat(node.style.width) / PX]);
    expect(first[0]).toBeCloseTo(0, 2);
    expect(second[0]).toBeCloseTo(3.15, 2);
  });

  it("lê a duração real do arquivo importado e abre a Origem com IN/OUT no arquivo inteiro", async () => {
    const created = [];
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag, options) => {
      const element = original(tag, options);
      if (tag === "audio" || tag === "video") created.push(element);
      return element;
    });
    const { container } = render(<FilmCraftWorkspace active />);
    fireEvent.change(container.querySelector('input[accept="video/*,audio/*,image/*"]'), {
      target: {
        files: [
          new File(["a"], "Entrevista.wav", { type: "audio/wav" }),
          new File(["v"], "Broll.mp4", { type: "video/mp4" }),
          new File(["i"], "Foto.png", { type: "image/png" }),
        ],
      },
    });
    const [audio, video] = created.filter((element) => element.preload === "metadata");
    expect(audio.tagName).toBe("AUDIO");
    expect(video.tagName).toBe("VIDEO");
    expect(screen.getByText("Duração: 8.0 s")).toBeInTheDocument();
    Object.defineProperty(video, "duration", { value: Number.NaN });
    act(() => video.onloadedmetadata());
    Object.defineProperty(audio, "duration", { value: 734.5 });
    act(() => audio.onloadedmetadata());
    expect(screen.getByText("Duração: 734.5 s")).toBeInTheDocument();
    expect(container.querySelector('input[type="number"][max="734.5"]')).toHaveValue(734.5);
  });

  it("estende a timeline além de 60 s conforme o conteúdo", async () => {
    const created = [];
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag, options) => {
      const element = original(tag, options);
      if (tag === "video") created.push(element);
      return element;
    });
    const { container } = render(<FilmCraftWorkspace active />);
    const ruler = () => [...container.querySelector("[data-timeline-ruler]").children];
    expect(ruler()).toHaveLength(13);
    fireEvent.change(container.querySelector('input[accept="video/*,audio/*,image/*"]'), {
      target: { files: [new File(["v"], "Longo.mp4", { type: "video/mp4" })] },
    });
    const probe = created.find((element) => element.preload === "metadata");
    Object.defineProperty(probe, "duration", { value: 75 });
    act(() => probe.onloadedmetadata());
    fireEvent.click(screen.getByRole("button", { name: /Longo\.mp4/ }));
    fireEvent.click(screen.getByRole("button", { name: "Inserir" }));
    await waitFor(() => expect(clipsOn(container)).toHaveLength(1));
    expect(ruler()).toHaveLength(18);
    expect(screen.getByRole("button", { name: "01:25" })).toBeInTheDocument();
  });
  it("explica quando o navegador não tem Web Audio para analisar", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const { container } = render(<FilmCraftWorkspace active />);
    drop(container, { id: "take-1", name: "Entrevista" });
    await waitFor(() => expect(clipsOn(container)).toHaveLength(1));
    await expect(currentMCPActions().apply("silence.remove", {})).rejects.toThrow(/não tem Web Audio/);
  });
});
