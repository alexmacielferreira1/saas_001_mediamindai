import { afterEach, describe, expect, it, vi } from "vitest";
import {
  drawProgramFrame,
  estimateSizeMB,
  exportFileName,
  exportRange,
  exportSupport,
  fitRect,
  layerTransform,
  pickWebmMimeType,
  presetSize,
  programLayers,
  renderTimelineToWebm,
  timelineEnd,
} from "./filmcraftRender";
import { clearAudioBufferCache } from "./filmcraftAudio";
import { FakeAudioContext, fakeMediaFetch } from "./filmcraftTestAudio";

const clip = (values) => ({
  id: values.id,
  track: "V1",
  type: "video/mp4",
  url: `blob:${values.id}`,
  start: 0,
  duration: 5,
  ...values,
});

function fakeContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  const context = { calls };
  ["save", "restore", "fillRect", "translate", "rotate", "scale", "beginPath", "rect", "clip", "drawImage", "fillText"].forEach((name) => {
    context[name] = record(name);
  });
  return context;
}

afterEach(() => {
  clearAudioBufferCache();
  delete HTMLCanvasElement.prototype.captureStream;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("composição do Programa", () => {
  it("empilha V1 → V3 (de baixo para cima) e ignora ocultas, desabilitadas e fora do tempo", () => {
    const clips = [
      clip({ id: "top", track: "V3" }),
      clip({ id: "base", track: "V1" }),
      clip({ id: "mid", track: "V2" }),
      clip({ id: "off", track: "V2", enabled: false }),
      clip({ id: "later", track: "V1", start: 10 }),
      clip({ id: "audio", track: "A1", type: "audio/mpeg" }),
      clip({ id: "hidden", track: "V3", start: 0 }),
    ];
    const ids = programLayers(clips, 1, {}).map((item) => item.id);
    expect(ids).toEqual(["base", "mid", "top", "hidden"]);
    expect(programLayers(clips, 1, { V3: { visible: false } }).map((item) => item.id)).toEqual(["base", "mid"]);
    expect(programLayers(clips, 7, {})).toEqual([]);
  });

  it("ajusta ou preenche o quadro mantendo a proporção", () => {
    expect(fitRect(1280, 720, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(fitRect(1080, 1920, 1920, 1080)).toMatchObject({ height: 1080, width: 607.5, x: 656.25 });
    expect(fitRect(1080, 1920, 1920, 1080, "Preencher")).toMatchObject({ width: 1920, x: 0 });
  });

  it("posição e âncora em pixels da sequência são escaladas à resolução de saída", () => {
    const transform = layerTransform({ x: 192, y: -108, scale: 50, rotation: 90, opacity: 40, cropLeft: 10 }, 960, 540);
    expect(transform).toMatchObject({ translateX: 96, translateY: -54, originX: 480, originY: 270, scale: 0.5, opacity: 0.4 });
    expect(transform.rotation).toBeCloseTo(Math.PI / 2);
    expect(transform.crop.left).toBe(96);
  });

  it("desenha fundo preto e as camadas em ordem, com opacidade, filtro e título", () => {
    const context = fakeContext();
    const video = { videoWidth: 1920, videoHeight: 1080 };
    const alphas = [];
    Object.defineProperty(context, "globalAlpha", { set: (value) => alphas.push(value), get: () => 1 });
    drawProgramFrame(context, {
      layers: [clip({ id: "v", opacity: 50, exposure: 10 }), clip({ id: "t", track: "V2", type: "text/title", text: "Olá\nmundo" })],
      sources: new Map([["v", video]]),
      width: 1920,
      height: 1080,
    });
    const names = context.calls.map(([name]) => name);
    expect(context.calls.find(([name]) => name === "fillRect")).toEqual(["fillRect", 0, 0, 1920, 1080]);
    expect(names.indexOf("drawImage")).toBeLessThan(names.indexOf("fillText"));
    expect(context.calls.find(([name]) => name === "drawImage")).toEqual(["drawImage", video, 0, 0, 1920, 1080]);
    expect(context.calls.filter(([name]) => name === "fillText").map((call) => call[1])).toEqual(["Olá", "mundo"]);
    expect(alphas).toContain(0.5);
    expect(context.filter).toBe("brightness(100%) contrast(100%) saturate(100%)");
  });

  it("com `time`, aplica os movimentos do clipe no instante do quadro; sem `time`, usa os valores fixos", () => {
    const moving = clip({ id: "m", start: 2, duration: 4, scale: 100, x: 0, motion: { scale: [[0, 1], [4, 3]], x: [[0, 0], [4, 960]] } });
    const scales = (context) => context.calls.filter(([name]) => name === "scale").map((call) => call[1]);
    const translations = (context) => context.calls.filter(([name]) => name === "translate").map((call) => call[1]);
    const animated = fakeContext();
    drawProgramFrame(animated, { layers: [moving], width: 1920, height: 1080, time: 4 });
    expect(scales(animated)).toEqual([2]);
    expect(translations(animated)[0]).toBe(960 + 480);
    const fixed = fakeContext();
    drawProgramFrame(fixed, { layers: [moving], width: 1920, height: 1080 });
    expect(scales(fixed)).toEqual([1]);
    expect(translations(fixed)[0]).toBe(960);
  });

  it("buraco na timeline resulta em quadro preto", () => {
    const context = fakeContext();
    drawProgramFrame(context, { layers: [], width: 640, height: 360 });
    expect(context.calls.filter(([name]) => name === "fillRect")).toEqual([["fillRect", 0, 0, 640, 360]]);
    expect(context.fillStyle).toBe("#000");
  });
});

describe("configurações de exportação", () => {
  it("intervalo: sequência inteira até o fim do conteúdo, ou entrada/saída", () => {
    const clips = [clip({ id: "a", start: 2, duration: 3 }), clip({ id: "b", track: "A1", start: 4, duration: 4 }), clip({ id: "h", track: "V2", start: 0, duration: 20 })];
    expect(timelineEnd(clips, { V2: { visible: false } })).toBe(8);
    expect(exportRange({ clips, trackState: { V2: { visible: false } } })).toEqual({ start: 0, end: 8 });
    expect(exportRange({ clips, trackState: {}, interval: "Entrada/Saída", markIn: 1, markOut: 3 })).toEqual({ start: 1, end: 3 });
  });

  it("predefinições, nome do arquivo e tamanho estimado", () => {
    expect(presetSize("TikTok 1080×1920")).toEqual({ width: 1080, height: 1920 });
    expect(presetSize("desconhecida")).toEqual({ width: 1920, height: 1080 });
    expect(exportFileName("Sequência 01.mp4")).toBe("Sequência 01.webm");
    expect(exportFileName("a/b:c")).toBe("a-b-c.webm");
    expect(exportFileName("  ")).toBe("mmfilm-exportacao.webm");
    expect(estimateSizeMB({ videoMbps: 8, audioKbps: 0, seconds: 10 })).toBe(10);
  });

  it("detecta suporte e escolhe o melhor WebM disponível", () => {
    expect(exportSupport({}).supported).toBe(false);
    function Recorder() {}
    Recorder.isTypeSupported = (type) => type === "video/webm;codecs=vp8,opus";
    expect(pickWebmMimeType(Recorder)).toBe("video/webm;codecs=vp8,opus");
    const scope = { MediaRecorder: Recorder, MediaStream: function MediaStream() {}, HTMLCanvasElement: { prototype: { captureStream() {} } } };
    expect(exportSupport(scope)).toMatchObject({ supported: true, audio: false, mimeType: "video/webm;codecs=vp8,opus" });
    expect(exportSupport({ ...scope, HTMLCanvasElement: { prototype: {} } }).reason).toMatch(/captureStream/);
  });
});

describe("renderização WebM", () => {
  function installRecorder() {
    const frames = [];
    const track = { kind: "video", stop: vi.fn(), requestFrame: vi.fn(() => frames.push(Date.now())) };
    HTMLCanvasElement.prototype.captureStream = vi.fn(() => ({ getVideoTracks: () => [track], getTracks: () => [track] }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(/** @type {any} */ (fakeContext()));
    class Recorder {
      static isTypeSupported = () => true;
      static last = null;
      constructor(stream, options) {
        this.stream = stream;
        this.options = options;
        this.state = "inactive";
        Recorder.last = this;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["webm"], { type: "video/webm" }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", Recorder);
    vi.stubGlobal("MediaStream", function MediaStream(tracks) {
      this.tracks = tracks;
    });
    return { track, frames, Recorder };
  }

  it("grava o canvas quadro a quadro e entrega um WebM com progresso até 100%", async () => {
    const { track, Recorder } = installRecorder();
    const progress = [];
    const blob = await renderTimelineToWebm({
      clips: [clip({ id: "t", type: "text/title", text: "Fim", duration: 0.2 })],
      trackState: {},
      range: { start: 0, end: 0.2 },
      width: 640,
      height: 360,
      fps: 30,
      videoBitsPerSecond: 2_000_000,
      includeAudio: false,
      onProgress: (value) => progress.push(value),
    });
    expect(blob.type).toBe("video/webm");
    expect(blob.size).toBeGreaterThan(0);
    expect(Recorder.last.options).toMatchObject({ mimeType: "video/webm;codecs=vp9,opus", videoBitsPerSecond: 2_000_000 });
    expect(track.requestFrame.mock.calls.length).toBeGreaterThan(1);
    expect(progress.at(-1)).toBe(1);
    expect(track.stop).toHaveBeenCalled();
  });

  it("cancelamento rejeita com AbortError e não entrega arquivo", async () => {
    installRecorder();
    const controller = new AbortController();
    const promise = renderTimelineToWebm({
      clips: [clip({ id: "t", type: "text/title", text: "Fim", duration: 5 })],
      trackState: {},
      range: { start: 0, end: 5 },
      includeAudio: false,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("recusa sequência vazia e mídia offline sem gravar nada", async () => {
    const { Recorder } = installRecorder();
    Recorder.last = null;
    await expect(renderTimelineToWebm({ clips: [], trackState: {}, range: { start: 0, end: 0 } })).rejects.toThrow(/vazia/);
    await expect(
      renderTimelineToWebm({ clips: [clip({ id: "o", offline: true, url: undefined, name: "Cena" })], trackState: {}, range: { start: 0, end: 5 } }),
    ).rejects.toThrow(/offline “Cena”/);
    expect(Recorder.last).toBeNull();
  });

  it("nunca exporta mudo em silêncio: sem Web Audio avisa que saiu sem áudio", async () => {
    installRecorder();
    const onWarning = vi.fn();
    await renderTimelineToWebm({
      clips: [clip({ id: "som", track: "A1", type: "audio/mpeg", duration: 0.1 })],
      trackState: {},
      range: { start: 0, end: 0.1 },
      onWarning,
    });
    expect(onWarning).toHaveBeenCalledWith(expect.stringMatching(/sem áudio/));
  });

  it("som que não tocou nem pelo plano B vira aviso da exportação", async () => {
    installRecorder();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", fakeMediaFetch({ fail: ["blob:som"] }));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("bloqueado"));
    const onWarning = vi.fn();
    await renderTimelineToWebm({
      clips: [clip({ id: "som", track: "A1", type: "audio/mpeg", duration: 0.1 })],
      trackState: {},
      range: { start: 0, end: 0.1 },
      onWarning,
    });
    expect(onWarning).toHaveBeenCalledWith(expect.stringMatching(/sem o som/));
    expect(FakeAudioContext.instances.at(-1).elementSources).toHaveLength(1);
  });

  it("sem MediaRecorder informa o motivo", async () => {
    await expect(renderTimelineToWebm({ clips: [], trackState: {}, range: { start: 0, end: 1 } })).rejects.toThrow(/MediaRecorder/);
  });
});
