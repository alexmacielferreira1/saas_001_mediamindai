import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FilmcraftAudioEngine,
  audioClipsForMix,
  clearAudioBufferCache,
  clipVolumeToDb,
  computePeaks,
  dbToClipVolume,
  dbToGain,
  dbToMeterFraction,
  emptyMixer,
  gainToDb,
  masterGain,
  planAudioSegments,
  scheduleGainCurve,
  segmentContextTimes,
  trackGain,
} from "./filmcraftAudio";
import { FakeAudioContext, fakeMediaFetch } from "./filmcraftTestAudio";

const clip = (values) => ({
  id: values.id || "c1",
  track: "A1",
  type: "audio/mpeg",
  url: `blob:${values.id || "c1"}`,
  start: 0,
  duration: 4,
  sourceIn: 0,
  speed: 100,
  volume: 100,
  ...values,
});

beforeEach(() => {
  clearAudioBufferCache();
  FakeAudioContext.instances = [];
});

describe("mixer — ganhos", () => {
  it("fader em dB: mínimo é silêncio, 0 dB é unitário, +6 dB ≈ 2×", () => {
    expect(dbToGain(-60)).toBe(0);
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(6)).toBeCloseTo(1.995, 2);
    expect(dbToGain(40)).toBeCloseTo(dbToGain(12));
    expect(gainToDb(0)).toBe(-60);
    expect(gainToDb(0.5)).toBeCloseTo(-6, 0);
  });

  it("volume do clipe (%) ↔ dB do Mixer de clipe", () => {
    expect(clipVolumeToDb(100)).toBe(0);
    expect(dbToClipVolume(-6)).toBe(50);
    expect(dbToClipVolume(12)).toBe(200);
    expect(dbToClipVolume(-60)).toBe(0);
  });

  it("mudo e solo exclusivo por faixa; barramento de vídeo cala quando há solo", () => {
    const mixer = { ...emptyMixer(), A2: { volumeDb: -6, pan: 0, channels: "Estéreo" } };
    expect(trackGain({ trackState: { A1: { muted: true } }, mixer, track: "A1" })).toBe(0);
    expect(trackGain({ trackState: {}, mixer, track: "A2" })).toBeCloseTo(0.501, 2);
    const solo = { A2: { solo: true } };
    expect(trackGain({ trackState: solo, mixer, track: "A1" })).toBe(0);
    expect(trackGain({ trackState: solo, mixer, track: "A2" })).toBeGreaterThan(0);
    expect(trackGain({ trackState: solo, mixer, track: "V" })).toBe(0);
    expect(trackGain({ trackState: {}, mixer, track: "V" })).toBe(1);
  });

  it("master: mudo do Mix zera a saída", () => {
    expect(masterGain(emptyMixer())).toBe(1);
    expect(masterGain({ Mix: { muted: true, volumeDb: 0 } })).toBe(0);
  });
});

describe("agendamento de trechos", () => {
  it("respeita entrada na origem, velocidade e início no meio do clipe", () => {
    const [segment] = planAudioSegments({
      clips: [clip({ start: 2, duration: 4, sourceIn: 1.5, speed: 200, volume: 50, pan: -40 })],
      from: 3,
    });
    expect(segment).toMatchObject({
      timelineStart: 3,
      timelineEnd: 6,
      sourceOffset: 3.5,
      playbackRate: 2,
      gain: 0.5,
      pan: -0.4,
      bus: "A1",
    });
  });

  it("ignora clipes desabilitados, offline, títulos e já terminados", () => {
    const segments = planAudioSegments({
      clips: [
        clip({ id: "off", enabled: false }),
        clip({ id: "offline", offline: true }),
        clip({ id: "title", type: "text/title" }),
        clip({ id: "past", start: 0, duration: 1 }),
        clip({ id: "ok", start: 5, duration: 1 }),
      ],
      from: 2,
    });
    expect(segments.map((item) => item.clipId)).toEqual(["ok"]);
  });

  it("som de vídeo em V entra no barramento de vídeo, sem duplicar o par vinculado em A", () => {
    const clips = [
      clip({ id: "v", track: "V1", type: "video/mp4", assetId: "x" }),
      clip({ id: "a", track: "A1", type: "video/mp4", assetId: "x" }),
      clip({ id: "v2", track: "V2", type: "video/mp4", assetId: "y" }),
      clip({ id: "hidden", track: "V3", type: "video/mp4", assetId: "z" }),
    ];
    const ids = audioClipsForMix(clips, { V3: { visible: false } }).map((item) => item.id);
    expect(ids).toEqual(["a", "v2"]);
    expect(planAudioSegments({ clips, trackState: {} }).find((item) => item.clipId === "v2").bus).toBe("V");
  });

  it("vídeo vinculado (linkId) cede o som ao clipe de áudio do par, mesmo deslocado ou mudo", () => {
    const clips = [
      clip({ id: "v", track: "V1", type: "video/mp4", assetId: "x", linkId: "L1" }),
      clip({ id: "a", track: "A1", type: "video/mp4", assetId: "x", linkId: "L1", start: 3, enabled: false }),
      clip({ id: "solo", track: "V2", type: "video/mp4", assetId: "y", linkId: "L2" }),
    ];
    // O par L1 está deslocado e o áudio desabilitado: o vídeo continua sem som (não duplica nem “ressuscita”).
    // L2 perdeu o clipe de áudio: o vídeo volta a tocar o som próprio.
    expect(audioClipsForMix(clips, {}).map((item) => item.id)).toEqual(["solo"]);
  });

  it("leva o início do clipe e a curva de volume (ducking) para o trecho", () => {
    const keys = [[0, -6], [1, 0]];
    const [withKeys, withoutKeys, emptyKeys] = planAudioSegments({
      clips: [clip({ id: "a", start: 2, gainKeys: keys }), clip({ id: "b", start: 3 }), clip({ id: "c", start: 4, gainKeys: [] })],
      from: 2.5,
    });
    expect(withKeys).toMatchObject({ clipStart: 2, gainKeys: keys, timelineStart: 2.5 });
    expect(withoutKeys.clipStart).toBe(3);
    expect(withoutKeys.gainKeys).toBeUndefined();
    expect(emptyKeys.gainKeys).toBeUndefined();
  });

  it("velocidade de reprodução negativa não toca áudio", () => {
    expect(planAudioSegments({ clips: [clip({})], rate: -1 })).toEqual([]);
  });

  it("início atrasado avança a origem (compensação do OpenCut)", () => {
    const segment = { timelineStart: 1, timelineEnd: 3, sourceOffset: 0, playbackRate: 1 };
    expect(segmentContextTimes(segment, { contextTime: 10, timelineTime: 0, rate: 1 }, 10)).toEqual({ when: 11, offset: 0, stopAt: 13 });
    const late = segmentContextTimes(segment, { contextTime: 10, timelineTime: 0, rate: 1 }, 11.5);
    expect(late.when).toBe(11.5);
    expect(late.offset).toBeCloseTo(0.5);
    expect(late.stopAt).toBe(13);
  });
});

describe("curva de volume agendada", () => {
  const automatedParam = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const segment = { gain: 0.5, clipStart: 10, gainKeys: [[0, 0], [1, -12], [2, -12], [3, 0]] };

  it("sem curva ou sem automação no navegador o ganho fica fixo", () => {
    const param = automatedParam();
    scheduleGainCurve(param, { gain: 1, clipStart: 0 }, { contextTime: 0, timelineTime: 0 }, 0, 1);
    scheduleGainCurve(param, { gain: 1, clipStart: 0, gainKeys: [] }, { contextTime: 0, timelineTime: 0 }, 0, 1);
    expect(param.setValueAtTime).not.toHaveBeenCalled();
    expect(param.linearRampToValueAtTime).not.toHaveBeenCalled();
    expect(() => scheduleGainCurve({ value: 1 }, segment, { contextTime: 0, timelineTime: 0 }, 0, 1)).not.toThrow();
    const onlySet = { setValueAtTime: vi.fn() };
    scheduleGainCurve(onlySet, segment, { contextTime: 0, timelineTime: 0 }, 0, 1);
    expect(onlySet.setValueAtTime).not.toHaveBeenCalled();
  });

  it("parte do valor da curva em `when` e faz rampas até as chaves dentro da janela", () => {
    const param = automatedParam();
    scheduleGainCurve(param, segment, { contextTime: 100, timelineTime: 10 }, 100.5, 102.5);
    expect(param.setValueAtTime).toHaveBeenCalledTimes(1);
    expect(param.setValueAtTime.mock.calls[0][0]).toBeCloseTo(0.5 * dbToGain(-6));
    expect(param.setValueAtTime.mock.calls[0][1]).toBe(100.5);
    expect(param.linearRampToValueAtTime.mock.calls).toEqual([
      [0.5 * dbToGain(-12), 101],
      [0.5 * dbToGain(-12), 102],
    ]);
  });

  it("respeita a velocidade da âncora ao converter o tempo local", () => {
    const param = automatedParam();
    scheduleGainCurve(param, segment, { contextTime: 100, timelineTime: 10, rate: 2 }, 100, 101);
    expect(param.setValueAtTime).toHaveBeenCalledWith(0.5, 100);
    expect(param.linearRampToValueAtTime.mock.calls).toEqual([[0.5 * dbToGain(-12), 100.5]]);
  });
});

describe("medidores e forma de onda", () => {
  it("dB → altura na escala 0/−6/−12/−24/−36/−48/−60", () => {
    expect(dbToMeterFraction(0)).toBe(1);
    expect(dbToMeterFraction(-6)).toBeCloseTo(5 / 6);
    expect(dbToMeterFraction(-30)).toBeCloseTo(0.4167, 3);
    expect(dbToMeterFraction(-Infinity)).toBe(0);
  });

  it("picos por balde consideram todos os canais", () => {
    const buffer = {
      length: 4,
      numberOfChannels: 2,
      getChannelData: (channel) => (channel ? Float32Array.from([0, 0, -0.9, 0.1]) : Float32Array.from([0.5, -0.2, 0.1, 0])),
    };
    expect(computePeaks(buffer, 2).map((value) => Number(value.toFixed(2)))).toEqual([0.5, 0.9]);
  });
});

describe("motor Web Audio", () => {
  function engine(options = {}) {
    return new FilmcraftAudioEngine({ createContext: () => new FakeAudioContext(), fetcher: fakeMediaFetch(), ...options });
  }

  it("agenda cada trecho com start(quando, origem) e stop no fim do clipe", async () => {
    const audio = engine();
    await audio.play({ clips: [clip({ start: 1, duration: 2, sourceIn: 3 })], from: 0 });
    const context = FakeAudioContext.instances[0];
    const [source] = context.sources;
    expect(source.start).toHaveBeenCalledWith(1, 3);
    expect(source.stop).toHaveBeenCalledWith(3);
    expect(audio.currentTime()).toBe(0);
    context.currentTime = 2;
    expect(audio.currentTime()).toBe(2);
    audio.stop();
    expect(audio.currentTime()).toBeNull();
    expect(source.stop).toHaveBeenCalledTimes(2);
  });

  it("aplica fader, pan, mono e solo nos barramentos ao vivo", () => {
    const audio = engine();
    audio.ensure();
    const bus = audio.buses.A1;
    audio.setMix({ trackState: {}, mixer: { ...emptyMixer(), A1: { volumeDb: -6, pan: 50, channels: "Mono" } } });
    expect(bus.gain.gain.value).toBeCloseTo(0.501, 2);
    expect(bus.pan.pan.value).toBe(0.5);
    expect(bus.input.channelCount).toBe(1);
    audio.setMix({ trackState: { A2: { solo: true } }, mixer: emptyMixer() });
    expect(bus.gain.gain.value).toBe(0);
    expect(audio.buses.A2.gain.gain.value).toBe(1);
  });

  it("decodificação que falha avisa uma vez e não agenda nada", async () => {
    const onDecodeError = vi.fn();
    const audio = engine({ fetcher: fakeMediaFetch({ fail: ["blob:bad"] }), onDecodeError });
    await audio.play({ clips: [clip({ id: "bad" })], from: 0 });
    await audio.play({ clips: [clip({ id: "bad" })], from: 0 });
    expect(FakeAudioContext.instances[0].sources).toHaveLength(0);
    expect(onDecodeError).toHaveBeenCalledTimes(1);
  });

  it("níveis L/R vêm dos analisadores do master", () => {
    const audio = engine();
    audio.ensure();
    const [left, right] = FakeAudioContext.instances[0].analysers;
    left.level = 1;
    right.level = 0.5;
    const [l, r] = audio.levels();
    expect(l).toBe(1);
    expect(r).toBeCloseTo(dbToMeterFraction(20 * Math.log10(0.5)));
  });

  it("sem Web Audio no navegador, play informa indisponível", async () => {
    const audio = new FilmcraftAudioEngine();
    expect(await audio.play({ clips: [clip({})], from: 0 })).toBe(false);
  });
});
