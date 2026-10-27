import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";
import { FakeAudioContext, fakeMediaFetch } from "./filmcraftTestAudio";
import { MAX_DECODE_BYTES, clearAudioBufferCache } from "./filmcraftAudio";
import { currentMCPActions } from "../../lib/mcpActions";
import { analysisAudioFailure, loadAnalysisAudio } from "../../lib/analysisAudio";

vi.mock("../../lib/analysisAudio", () => ({ loadAnalysisAudio: vi.fn(), analysisAudioFailure: vi.fn() }));

const SRC = "/api/v1/media/assets/take-1/stream";

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  localStorage.clear();
  FakeAudioContext.instances = [];
  clearAudioBufferCache();
  loadAnalysisAudio.mockReset();
  analysisAudioFailure.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lane(container) {
  return container.querySelector('[data-track-id="V1"]');
}
async function setup() {
  const view = render(<FilmCraftWorkspace active />);
  const payload = { id: "take-1", name: "Entrevista", kind: "video", src: SRC, duration: 12, mimeType: "video/mp4" };
  fireEvent.drop(lane(view.container), {
    clientX: 0,
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
  await waitFor(() => expect([...lane(view.container).children].filter((node) => node.tagName === "BUTTON")).toHaveLength(1));
  return currentMCPActions();
}

// Buffer de análise como o da leitura em pedaços: mono a 1 kHz, fala em 0–3 s e 6–12 s, silêncio em 3–6 s.
function analysisBuffer() {
  const rate = 1000;
  const data = new Float32Array(12 * rate).map((_, index) => (index >= 3 * rate && index < 6 * rate ? 0.001 : index % 2 ? 0.5 : -0.5));
  return { duration: 12, length: data.length, sampleRate: rate, numberOfChannels: 1, getChannelData: () => data, analysisOnly: true };
}

describe("MMFilm · áudio grande lido em pedaços", () => {
  it("analisa arquivo acima do limite do decodificador lendo em pedaços", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", fakeMediaFetch({ duration: 12, sizes: { [SRC]: String(MAX_DECODE_BYTES + 1) } }));
    loadAnalysisAudio.mockResolvedValue(analysisBuffer());
    const provider = await setup();

    const preview = await act(() => provider.analyze("silence.remove", {}));
    expect(preview.ok).toBe(true);
    expect(preview.summary).toMatch(/^Prévia \(nada foi alterado\): 1 silêncio\(s\)/);
    expect(loadAnalysisAudio).toHaveBeenCalledWith(SRC, expect.objectContaining({ onProgress: expect.any(Function) }));
  });

  it("explica o motivo quando a leitura em pedaços também falha", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", fakeMediaFetch({ duration: 12, sizes: { [SRC]: String(MAX_DECODE_BYTES + 1) } }));
    loadAnalysisAudio.mockResolvedValue(null);
    analysisAudioFailure.mockReturnValue({ kind: "no-audio" });
    const provider = await setup();

    const preview = await act(() => provider.analyze("silence.remove", {}));
    expect(preview.ok).toBe(false);
    expect(preview.summary).toMatch(/não tem faixa de áudio/);
  });

  it("não tenta ler em pedaços um arquivo que o servidor não tem (404)", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 404, headers: { get: () => null }, body: { cancel: vi.fn() } })));
    const provider = await setup();

    const preview = await act(() => provider.analyze("silence.remove", {}));
    expect(preview.ok).toBe(false);
    expect(preview.summary).toMatch(/não está mais no servidor \(404\)/);
    expect(loadAnalysisAudio).not.toHaveBeenCalled();
  });
});
