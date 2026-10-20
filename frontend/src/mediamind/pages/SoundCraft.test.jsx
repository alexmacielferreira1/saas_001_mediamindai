import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SoundCraft, { buildSessionFile, buildTrackChain, computePeaks, effectiveGain, encodeWav, panValue, volumeToGain } from "./SoundCraft";

const param = (value) => ({ value });
class FakeNode {
  constructor(kind) { this.kind = kind; this.connections = []; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
}
function fakeBuffer(seconds = 2, sampleRate = 100) {
  const length = seconds * sampleRate;
  const left = new Float32Array(length).map((_, i) => (i < length / 2 ? 0.5 : -1));
  return { duration: seconds, sampleRate, length, numberOfChannels: 1, getChannelData: () => left };
}
let contexts = [];
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = new FakeNode("destination"); this.sources = []; this.gains = []; this.panners = []; this.decodeAudioData = vi.fn(async (data) => { if (data.byteLength === 0) throw new Error("bad"); return fakeBuffer(); }); contexts.push(this); }
  createGain() { const node = new FakeNode("gain"); node.gain = param(1); this.gains.push(node); return node; }
  createStereoPanner() { const node = new FakeNode("panner"); node.pan = param(0); this.panners.push(node); return node; }
  createBiquadFilter() { const node = new FakeNode("biquad"); node.frequency = param(0); node.gain = param(0); node.Q = param(0); return node; }
  createDynamicsCompressor() { return new FakeNode("compressor"); }
  createBufferSource() { const node = new FakeNode("source"); node.start = vi.fn(); node.stop = vi.fn(); this.sources.push(node); return node; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
class FakeOfflineContext extends FakeAudioContext {
  constructor(channels, length, sampleRate) { super(); this.args = [channels, length, sampleRate]; }
  startRendering() { const data = new Float32Array(this.args[1]).fill(0.25); return Promise.resolve({ numberOfChannels: 2, sampleRate: this.args[2], getChannelData: () => data }); }
}

function audioFile(name = "voz.wav", bytes = 8) {
  const file = new File([new Uint8Array(bytes)], name, { type: "audio/wav" });
  if (!file.arrayBuffer) file.arrayBuffer = async () => new ArrayBuffer(bytes);
  return file;
}

function openMixer() {
  render(<SoundCraft />);
  fireEvent.click(screen.getByRole("tab", { name: "Mesa integrada" }));
}

async function importFile(file) {
  fireEvent.change(screen.getByLabelText("Importar arquivos de áudio"), { target: { files: [file] } });
  await screen.findByText(/importado\(s\) e decodificado\(s\)|Não foi possível decodificar/);
}

beforeEach(() => {
  contexts = [];
  localStorage.clear();
  window.AudioContext = FakeAudioContext;
  window.OfflineAudioContext = FakeOfflineContext;
  URL.createObjectURL = vi.fn(() => `blob:audio/${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  delete window.AudioContext; delete window.OfflineAudioContext; delete window.MediaRecorder;
  delete URL.createObjectURL; delete URL.revokeObjectURL;
  vi.useRealTimers();
});

describe("MMSom audio helpers", () => {
  it("maps volume to gain on the same dB scale as the label", () => {
    expect(volumeToGain(100)).toBe(1);
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(50)).toBeCloseTo(10 ** (-10 / 20));
    expect(panValue(-100)).toBe(-1);
    expect(panValue(250)).toBe(1);
  });

  it("applies mute and solo rules", () => {
    const tracks = [{ id: 1, volume: 100, mute: false, solo: true }, { id: 2, volume: 100, mute: false, solo: false }, { id: 3, volume: 100, mute: true, solo: true }];
    expect(effectiveGain(tracks[0], tracks)).toBe(1);
    expect(effectiveGain(tracks[1], tracks)).toBe(0);
    expect(effectiveGain(tracks[2], tracks)).toBe(0);
    expect(effectiveGain(tracks[1], [tracks[1]])).toBe(1);
  });

  it("computes waveform peaks from decoded samples", () => {
    const data = new Float32Array([0, 0.5, -0.25, 0, 0, -0.9, 0.1, 0]);
    expect(computePeaks([data], 4)).toEqual([0.5, 0.25, 0.9, 0.1]);
    expect(computePeaks([new Float32Array(0)], 3)).toEqual([0, 0, 0]);
  });

  it("encodes PCM WAV headers and samples", () => {
    const wav = new DataView(encodeWav([new Float32Array([1, -1]), new Float32Array([0, 0.5])], 44100, 24));
    const text = (offset) => String.fromCharCode(...[0, 1, 2, 3].map((i) => wav.getUint8(offset + i)));
    expect(text(0)).toBe("RIFF"); expect(text(8)).toBe("WAVE"); expect(text(36)).toBe("data");
    expect(wav.getUint16(22, true)).toBe(2);
    expect(wav.getUint32(24, true)).toBe(44100);
    expect(wav.getUint16(34, true)).toBe(24);
    expect(wav.getUint32(40, true)).toBe(12);
    expect([wav.getUint8(44), wav.getUint8(45), wav.getUint8(46)]).toEqual([0xff, 0xff, 0x7f]);
    expect([wav.getUint8(47), wav.getUint8(48), wav.getUint8(49)]).toEqual([0, 0, 0]);
    expect([wav.getUint8(50), wav.getUint8(51), wav.getUint8(52)]).toEqual([0, 0, 0x80]);
    const wav16 = new DataView(encodeWav([new Float32Array([0.5])], 8000, 16));
    expect(wav16.getInt16(44, true)).toBe(16384);
  });

  it("builds the insert chain in order", () => {
    const context = new FakeAudioContext();
    const chain = buildTrackChain(context, { pan: 50, eq: "voz", compressor: true }, 0.5, context.destination);
    expect(chain.nodes.map((node) => node.kind)).toEqual([...Array(7).fill("biquad"), "compressor", "panner", "gain"]);
    expect(chain.panner.pan.value).toBe(0.5);
    expect(chain.gain.gain.value).toBe(0.5);
    expect(chain.gain.connections).toEqual([context.destination]);
  });

  it("describes the session without leaking blob URLs", () => {
    const file = buildSessionFile([{ id: 1, name: "Voz", volume: 80, pan: 0, src: "blob:x", fileName: "voz.wav", duration: 3 }]);
    expect(file.schema).toBe("mmsom-session/v1");
    expect(JSON.stringify(file)).not.toContain("blob:");
    expect(file.tracks[0].audio.fileName).toBe("voz.wav");
  });
});

describe("MMSom mesa integrada", () => {
  it("decodes imported audio and draws real peaks", async () => {
    openMixer();
    await importFile(audioFile());
    expect(contexts[0].decodeAudioData).toHaveBeenCalled();
    expect(screen.getByDisplayValue("voz")).toBeInTheDocument();
    const clip = screen.getByTestId("clipe-voz");
    const bars = clip.querySelectorAll("i");
    expect(bars).toHaveLength(80);
    expect(bars[0].style.height).toBe("50%");
    expect(bars[79].style.height).toBe("100%");
    const stored = JSON.parse(localStorage.getItem("mm-soundcraft-session")).tracks.at(-1);
    expect(stored).toMatchObject({ name: "voz", duration: 2, fileName: "voz.wav" });
  });

  it("reports undecodable files honestly", async () => {
    openMixer();
    await importFile(audioFile("ruim.wav", 0));
    expect(screen.getByText(/Não foi possível decodificar "ruim"/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("ruim")).toBeNull();
  });

  it("plays decoded tracks through gain and pan nodes that follow mute, solo, volume and pan", async () => {
    openMixer();
    await importFile(audioFile());
    const context = contexts[0];
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reproduzir" })); });
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].start).toHaveBeenCalledWith(expect.closeTo(0.05 + 3.6, 5), 0);
    const trackGain = context.gains.at(-1);
    expect(trackGain.gain.value).toBe(1);
    fireEvent.change(screen.getByLabelText("Volume voz"), { target: { value: "50" } });
    expect(trackGain.gain.value).toBeCloseTo(volumeToGain(50));
    fireEvent.change(screen.getByLabelText("Pan voz"), { target: { value: "-40" } });
    expect(context.panners.at(-1).pan.value).toBe(-0.4);
    fireEvent.click(screen.getByRole("button", { name: "Silenciar voz" }));
    expect(trackGain.gain.value).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Silenciar voz" }));
    fireEvent.click(screen.getByRole("button", { name: "Solo Voz principal" }));
    expect(trackGain.gain.value).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(context.sources[0].stop).toHaveBeenCalled();
  });

  it("moves the playhead from the audio clock", async () => {
    openMixer();
    await importFile(audioFile());
    vi.useFakeTimers();
    const context = contexts[0];
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reproduzir" })); });
    context.currentTime = 65.05;
    await act(async () => { vi.advanceTimersByTime(60); });
    expect(screen.getByText("00:01:05")).toBeInTheDocument();
  });

  it("toggles real EQ and compressor inserts in the mix window", async () => {
    openMixer();
    fireEvent.click(screen.getByRole("tab", { name: "Mix" }));
    const mixer = screen.getByRole("region", { name: "Mesa de mixagem" });
    fireEvent.click(within(mixer).getByRole("button", { name: "EQ Voz principal" }));
    expect(within(mixer).getByText("EQ 7-Band · Voz")).toBeInTheDocument();
    fireEvent.click(within(mixer).getByRole("button", { name: "Compressor Voz principal" }));
    expect(within(mixer).getByRole("button", { name: "Compressor Voz principal" })).toHaveAttribute("aria-pressed", "true");
    const stored = JSON.parse(localStorage.getItem("mm-soundcraft-session")).tracks[0];
    expect(stored).toMatchObject({ eq: "voz", compressor: true });
  });

  it("explains a denied microphone permission", async () => {
    openMixer();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error("no"), { name: "NotAllowedError" })) } });
    window.MediaRecorder = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Gravar" }));
    expect(await screen.findByText(/Permissão de microfone negada/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gravar" })).toHaveAttribute("aria-pressed", "false");
    delete navigator.mediaDevices;
  });

  it("records from the microphone into a new track", async () => {
    openMixer();
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
    let recorder;
    window.MediaRecorder = class { constructor() { recorder = this; this.mimeType = "audio/webm"; } start() {} stop() { this.ondataavailable({ data: new Blob([new Uint8Array(4)], { type: "audio/webm" }) }); this.onstop(); } };
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gravar" })); });
    expect(screen.getByRole("button", { name: "Parar gravação" })).toHaveAttribute("aria-pressed", "true");
    expect(recorder).toBeDefined();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Parar gravação" })); });
    expect(await screen.findByDisplayValue("Gravação 1")).toBeInTheDocument();
    expect(stopTrack).toHaveBeenCalled();
    delete navigator.mediaDevices;
  });

  it("saves the session JSON and renders a WAV mixdown", async () => {
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function record() { names.push(this.download); });
    openMixer();
    await importFile(audioFile());
    await act(async () => { fireEvent.click(screen.getByTitle("Salvar sessão")); });
    await waitFor(() => expect(names).toEqual(["mmsom-sessao.json", "mmsom-mixdown.wav"]));
    expect(screen.getByText(/Sessão salva \(mmsom-sessao.json\) e mixdown exportado/)).toBeInTheDocument();
  });

  it("does not fake a mixdown when there is no audio", async () => {
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function record() { names.push(this.download); });
    openMixer();
    await act(async () => { fireEvent.click(screen.getByTitle("Salvar sessão")); });
    expect(names).toEqual(["mmsom-sessao.json"]);
    expect(screen.getByText(/nenhum mixdown foi gerado/)).toBeInTheDocument();
  });

  it("opens menubar menus with working and honestly disabled items", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    openMixer();
    fireEvent.click(screen.getByRole("button", { name: "Faixa" }));
    fireEvent.click(screen.getByRole("menuitem", { name: 'Remover "Trilha musical"' }));
    expect(screen.queryByDisplayValue("Trilha musical")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Janela" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mix" }));
    expect(screen.getByRole("region", { name: "Mesa de mixagem" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "MIDI" }));
    expect(screen.getByRole("menuitem", { name: /Sem comandos/ })).toBeDisabled();
  });

  it("reports missing Web Audio support instead of pretending to play", async () => {
    delete window.AudioContext;
    openMixer();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reproduzir" })); });
    expect(screen.getByText(/não oferece Web Audio/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproduzir" })).toBeInTheDocument();
  });
});
