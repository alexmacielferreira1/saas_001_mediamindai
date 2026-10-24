// AudioContext mínimo para testes (jsdom não tem Web Audio): registra nós, ganhos e agendamentos.
import { vi } from "vitest";

function param(value) {
  return { value };
}
function node(kind, extra = {}) {
  return {
    kind,
    connections: [],
    connect: vi.fn(function connect(target) {
      this.connections.push(target);
      return target;
    }),
    disconnect: vi.fn(),
    ...extra,
  };
}

export class FakeAudioContext {
  static instances = [];
  constructor(options = {}) {
    this.options = options;
    this.currentTime = 0;
    this.state = "running";
    this.destination = node("destination");
    this.gains = [];
    this.panners = [];
    this.sources = [];
    this.analysers = [];
    this.elementSources = [];
    FakeAudioContext.instances.push(this);
  }
  createGain() {
    const gain = node("gain", { gain: param(1), channelCount: 2, channelCountMode: "max" });
    this.gains.push(gain);
    return gain;
  }
  createStereoPanner() {
    const panner = node("panner", { pan: param(0) });
    this.panners.push(panner);
    return panner;
  }
  createChannelSplitter() {
    return node("splitter");
  }
  createAnalyser() {
    const analyser = node("analyser", {
      fftSize: 1024,
      level: 0,
      getFloatTimeDomainData(samples) {
        samples.fill(this.level);
      },
    });
    this.analysers.push(analyser);
    return analyser;
  }
  createMediaStreamDestination() {
    return node("stream", { stream: { getAudioTracks: () => [{ kind: "audio", stop: vi.fn() }] } });
  }
  createBufferSource() {
    const source = node("source", {
      buffer: null,
      playbackRate: param(1),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    });
    this.sources.push(source);
    return source;
  }
  createMediaElementSource(element) {
    const source = node("media-element", { mediaElement: element });
    this.elementSources.push(source);
    return source;
  }
  decodeAudioData(data) {
    if (data?.fail) return Promise.reject(new Error("sem áudio"));
    return Promise.resolve({ duration: data?.duration ?? 10, length: 480000, numberOfChannels: 2, getChannelData: () => new Float32Array(4) });
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

/** fetch falso: devolve um "arquivo" cuja decodificação resulta num buffer da duração indicada (ou falha). */
export function fakeMediaFetch({ duration = 10, fail = [], sizes = {} } = {}) {
  return vi.fn((url) =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: (name) => (name.toLowerCase() === "content-length" && sizes[url] ? String(sizes[url]) : null) },
      body: { cancel: vi.fn(() => Promise.resolve()) },
      arrayBuffer: vi.fn(() => Promise.resolve({ duration, fail: fail.includes(url) })),
    }),
  );
}

/** Elemento de mídia falso (plano B do áudio): registra src, posição, velocidade, play e pause. */
// Como no navegador: pause() com um play() ainda pendente rejeita esse play() com AbortError.
// `deferPlay` deixa o play() pendente até `element.finishPlay()`.
export function fakeMediaElement({ rejectPlay = null, deferPlay = false } = {}) {
  const listeners = {};
  let pending = null;
  const element = {
    src: "",
    crossOrigin: null,
    preload: "",
    currentTime: 0,
    playbackRate: 1,
    paused: true,
    play: vi.fn(() => {
      if (rejectPlay) return Promise.reject(rejectPlay);
      if (deferPlay)
        return new Promise((resolve, reject) => {
          pending = { resolve, reject };
        });
      element.paused = false;
      return Promise.resolve();
    }),
    finishPlay() {
      element.paused = false;
      pending?.resolve();
      pending = null;
    },
    pause: vi.fn(() => {
      element.paused = true;
      if (pending) {
        pending.reject(Object.assign(new Error("The play() request was interrupted by a call to pause()."), { name: "AbortError" }));
        pending = null;
      }
    }),
    load: vi.fn(),
    removeAttribute: vi.fn((name) => {
      if (name === "src") element.src = "";
    }),
    addEventListener: vi.fn((type, handler) => {
      (listeners[type] ||= []).push(handler);
    }),
    removeEventListener: vi.fn(),
    emit(type, event = {}) {
      (listeners[type] || []).forEach((handler) => handler(event));
    },
  };
  fakeMediaElement.created.push(element);
  return element;
}
fakeMediaElement.created = [];
