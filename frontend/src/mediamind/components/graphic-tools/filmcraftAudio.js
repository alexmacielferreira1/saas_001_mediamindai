// Motor de áudio do MMFilm: mixagem das faixas A1–A3 (e do áudio dos clipes de vídeo) com Web Audio.
// Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md (AudioManager: âncora relógio de áudio ↔ timeline,
// agendamento com compensação de início atrasado, decodificação com cache por fonte e picos de forma de onda).
// Semântica de mixer (fader em dB com mínimo = silêncio, pan −100..100, solo exclusivo) segue o FilmCraft (Apache-2.0).

export const AUDIO_TRACKS = ["A1", "A2", "A3"];
export const MIXER_STRIPS = [...AUDIO_TRACKS, "Mix"];
export const FADER_MIN_DB = -60;
export const FADER_MAX_DB = 12;
const TITLE_TYPE = "text/title";
const VIDEO_BUS = "V";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const defaultStrip = () => ({ volumeDb: 0, pan: 0, channels: "Estéreo", muted: false });
export const emptyMixer = () => Object.fromEntries(MIXER_STRIPS.map((id) => [id, defaultStrip()]));
export function mixerStrip(mixer, id) {
  return { ...defaultStrip(), ...(mixer?.[id] || {}) };
}

/** Fader em dB → ganho linear. O mínimo do fader (−60 dB) é silêncio absoluto. */
export function dbToGain(db) {
  const value = Number(db);
  if (!Number.isFinite(value) || value <= FADER_MIN_DB) return 0;
  return 10 ** (Math.min(FADER_MAX_DB, value) / 20);
}
export function gainToDb(gain) {
  const value = Number(gain);
  if (!(value > 0)) return FADER_MIN_DB;
  return clamp(Math.round(20 * Math.log10(value) * 10) / 10, FADER_MIN_DB, FADER_MAX_DB);
}
/** Volume do clipe (0–200 %, como no painel de propriedades) ↔ dB do Mixer de clipe. */
export const clipVolumeToDb = (volume = 100) => gainToDb((volume ?? 100) / 100);
export const dbToClipVolume = (db) => Math.round(Math.min(200, dbToGain(db) * 100));
export const panValue = (pan) => clamp((Number(pan) || 0) / 100, -1, 1);

/** Ganho do barramento de uma faixa considerando mudo, solo e fader. */
export function trackGain({ trackState, mixer, track }) {
  const anySolo = AUDIO_TRACKS.some((id) => trackState?.[id]?.solo);
  if (!AUDIO_TRACKS.includes(track)) return anySolo ? 0 : 1;
  const state = trackState?.[track] || {};
  if (state.muted || (anySolo && !state.solo)) return 0;
  return dbToGain(mixerStrip(mixer, track).volumeDb);
}
export function masterGain(mixer) {
  const strip = mixerStrip(mixer, "Mix");
  return strip.muted ? 0 : dbToGain(strip.volumeDb);
}

function hasAudibleMedia(clip) {
  return (
    clip.enabled !== false &&
    !clip.offline &&
    Boolean(clip.url) &&
    clip.type !== TITLE_TYPE &&
    (clip.type?.startsWith("audio") || clip.type?.startsWith("video"))
  );
}

/**
 * Clipes que entram na mixagem: tudo que é áudio/vídeo habilitado em A1–A3 e o som dos clipes de vídeo
 * em faixas V visíveis — exceto quando o mesmo recurso já está vinculado (mesmo início) numa faixa A.
 */
export function audioClipsForMix(clips = [], trackState = {}) {
  const audio = clips.filter((clip) => AUDIO_TRACKS.includes(clip.track) && hasAudibleMedia(clip));
  const video = clips.filter(
    (clip) =>
      clip.track?.startsWith("V") &&
      trackState?.[clip.track]?.visible !== false &&
      clip.type?.startsWith("video") &&
      hasAudibleMedia(clip) &&
      !audio.some(
        (item) => item.assetId && item.assetId === clip.assetId && Math.abs(item.start - clip.start) < 0.002,
      ),
  );
  return [...audio, ...video];
}

/** Trechos de mídia a tocar a partir de `from` (tempo da timeline), respeitando entrada na origem e velocidade. */
export function planAudioSegments({ clips, trackState, from = 0, until = Infinity, rate = 1 }) {
  if (!(rate > 0)) return [];
  return audioClipsForMix(clips, trackState).flatMap((clip) => {
    const start = Math.max(from, clip.start);
    const end = Math.min(until, clip.start + clip.duration);
    if (end <= start + 1e-6) return [];
    const speed = (clip.speed || 100) / 100;
    return [
      {
        clipId: clip.id,
        track: clip.track,
        bus: AUDIO_TRACKS.includes(clip.track) ? clip.track : VIDEO_BUS,
        url: clip.url,
        timelineStart: start,
        timelineEnd: end,
        sourceOffset: (clip.sourceIn || 0) + (start - clip.start) * speed,
        playbackRate: speed * rate,
        gain: (clip.volume ?? 100) / 100,
        pan: panValue(clip.pan),
      },
    ];
  });
}

/**
 * Converte um trecho em horários do AudioContext. Se o horário já passou (decodificação demorou),
 * começa agora avançando a origem — como o AudioManager do OpenCut.
 */
export function segmentContextTimes(segment, anchor, now) {
  const rate = anchor.rate || 1;
  let when = anchor.contextTime + (segment.timelineStart - anchor.timelineTime) / rate;
  const stopAt = anchor.contextTime + (segment.timelineEnd - anchor.timelineTime) / rate;
  let offset = segment.sourceOffset;
  if (when < now) {
    offset += (now - when) * segment.playbackRate;
    when = now;
  }
  return { when, offset, stopAt };
}

// Escala dos medidores do MMFilm: marcas 0, −6, −12, −24, −36, −48, −60 dB igualmente espaçadas.
const METER_TICKS = [0, -6, -12, -24, -36, -48, -60];
export function dbToMeterFraction(db) {
  if (!Number.isFinite(db) || db <= -60) return 0;
  if (db >= 0) return 1;
  const index = METER_TICKS.findIndex((tick) => db >= tick);
  const upper = METER_TICKS[index - 1];
  const lower = METER_TICKS[index];
  const step = 1 / (METER_TICKS.length - 1);
  const top = 1 - (index - 1) * step;
  return top - ((upper - db) / (upper - lower)) * step;
}
export function peakLevel(samples) {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) peak = Math.max(peak, Math.abs(samples[index]));
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

/** Picos por balde para forma de onda (adaptado de OpenCut `collectPeakRange`). */
export function computePeaks(buffer, count, startSample = 0, endSample = buffer?.length ?? 0) {
  const peaks = new Array(Math.max(0, count)).fill(0);
  if (!buffer || !count) return peaks;
  const range = Math.max(0, endSample - startSample);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let bucket = 0; bucket < count; bucket += 1) {
      const from = startSample + Math.floor((bucket * range) / count);
      const to = startSample + Math.floor(((bucket + 1) * range) / count);
      for (let index = from; index < to; index += 1) peaks[bucket] = Math.max(peaks[bucket], Math.abs(data[index] || 0));
    }
  }
  return peaks;
}

export function audioContextClass(scope = globalThis) {
  return scope?.AudioContext || scope?.webkitAudioContext;
}
export const isAudioSupported = (scope = globalThis) => Boolean(audioContextClass(scope));

const bufferCache = new Map();
/** Decodifica (uma vez por URL) o áudio de um arquivo de mídia. Falhas resolvem `null` e ficam em cache. */
export function loadAudioBuffer(context, url, fetcher = globalThis.fetch) {
  if (!bufferCache.has(url)) {
    bufferCache.set(
      url,
      (async () => {
        const response = await fetcher(url, { credentials: "include" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        return await context.decodeAudioData(data);
      })().catch(() => null),
    );
  }
  return bufferCache.get(url);
}
export function clearAudioBufferCache() {
  bufferCache.clear();
}

export class FilmcraftAudioEngine {
  constructor({ createContext, toDestination, fetcher, onDecodeError } = {}) {
    this.createContext = createContext;
    this.toDestination = toDestination;
    this.fetcher = fetcher;
    this.onDecodeError = onDecodeError;
    this.context = null;
    this.session = 0;
    this.anchor = null;
    this.nodes = new Set();
    this.mix = { trackState: {}, mixer: emptyMixer() };
    this.reported = new Set();
  }

  ensure() {
    if (this.context) return this.context;
    const AudioContextClass = audioContextClass();
    if (!this.createContext && !AudioContextClass) return null;
    const context = this.createContext ? this.createContext() : new AudioContextClass();
    this.context = context;
    this.master = context.createGain();
    this.masterPan = context.createStereoPanner ? context.createStereoPanner() : null;
    if (this.masterPan) this.master.connect(this.masterPan);
    this.output = this.masterPan || this.master;
    this.destination = this.toDestination ? this.toDestination(context) : context.destination;
    this.output.connect(this.destination);
    if (context.createChannelSplitter && context.createAnalyser) {
      const splitter = context.createChannelSplitter(2);
      this.analysers = [context.createAnalyser(), context.createAnalyser()];
      this.output.connect(splitter);
      this.analysers.forEach((analyser, channel) => {
        analyser.fftSize = 1024;
        splitter.connect(analyser, channel);
      });
    }
    this.buses = Object.fromEntries(
      [...AUDIO_TRACKS, VIDEO_BUS].map((id) => {
        const input = context.createGain();
        const gain = context.createGain();
        const pan = context.createStereoPanner ? context.createStereoPanner() : null;
        input.connect(gain);
        if (pan) {
          gain.connect(pan);
          pan.connect(this.master);
        } else gain.connect(this.master);
        return [id, { input, gain, pan }];
      }),
    );
    this.applyMix();
    return context;
  }

  setMix({ trackState, mixer }) {
    this.mix = { trackState: trackState || {}, mixer: mixer || emptyMixer() };
    this.applyMix();
  }

  applyMix() {
    if (!this.context) return;
    const { trackState, mixer } = this.mix;
    Object.entries(this.buses).forEach(([id, bus]) => {
      bus.gain.gain.value = trackGain({ trackState, mixer, track: id });
      const strip = mixerStrip(mixer, id);
      if (bus.pan) bus.pan.pan.value = AUDIO_TRACKS.includes(id) ? panValue(strip.pan) : 0;
      setChannels(bus.input, AUDIO_TRACKS.includes(id) ? strip.channels : "Estéreo");
    });
    const master = mixerStrip(mixer, "Mix");
    this.master.gain.value = masterGain(mixer);
    if (this.masterPan) this.masterPan.pan.value = panValue(master.pan);
    setChannels(this.master, master.channels);
  }

  get playing() {
    return Boolean(this.anchor);
  }

  /** Tempo atual da timeline segundo o relógio de áudio (null se parado). */
  currentTime() {
    if (!this.anchor || !this.context) return null;
    return this.anchor.timelineTime + (this.context.currentTime - this.anchor.contextTime) * this.anchor.rate;
  }

  async preload(segments) {
    const context = this.ensure();
    if (!context) return;
    await Promise.all([...new Set(segments.map((segment) => segment.url))].map((url) => this.buffer(url)));
  }

  async buffer(url) {
    const buffer = await loadAudioBuffer(this.context, url, this.fetcher || globalThis.fetch);
    if (!buffer && !this.reported.has(url)) {
      this.reported.add(url);
      this.onDecodeError?.(url);
    }
    return buffer;
  }

  /** Começa a tocar a timeline a partir de `from`. Retorna false se o navegador não tem Web Audio. */
  async play({ clips, trackState, from = 0, until = Infinity, rate = 1 }) {
    const context = this.ensure();
    if (!context) return false;
    this.stop();
    const session = ++this.session;
    const segments = planAudioSegments({ clips, trackState, from, until, rate });
    this.anchor = { contextTime: context.currentTime, timelineTime: from, rate };
    if (context.state === "suspended") {
      await context.resume?.().catch(() => {});
      if (session !== this.session) return true;
      this.anchor = { contextTime: context.currentTime, timelineTime: from, rate };
    }
    await Promise.all(
      segments.map(async (segment) => {
        const buffer = await this.buffer(segment.url);
        if (!buffer || session !== this.session) return;
        this.schedule(segment, buffer);
      }),
    );
    return true;
  }

  schedule(segment, buffer) {
    const context = this.context;
    const { when, offset, stopAt } = segmentContextTimes(segment, this.anchor, context.currentTime);
    if (offset >= buffer.duration || stopAt <= when) return;
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = segment.playbackRate;
    const gain = context.createGain();
    gain.gain.value = segment.gain;
    const pan = context.createStereoPanner ? context.createStereoPanner() : null;
    node.connect(gain);
    if (pan) {
      pan.pan.value = segment.pan;
      gain.connect(pan);
      pan.connect(this.buses[segment.bus].input);
    } else gain.connect(this.buses[segment.bus].input);
    node.start(when, Math.max(0, offset));
    node.stop(stopAt);
    const entry = { node, gain, pan };
    this.nodes.add(entry);
    node.onended = () => {
      disconnect(entry);
      this.nodes.delete(entry);
    };
  }

  stop() {
    this.session += 1;
    this.anchor = null;
    this.nodes.forEach((entry) => {
      try {
        entry.node.stop();
      } catch {
        // nó já encerrado
      }
      disconnect(entry);
    });
    this.nodes.clear();
  }

  /** Níveis L/R (0–1 na escala dos medidores) lidos dos AnalyserNodes do master. */
  levels() {
    if (!this.analysers) return [0, 0];
    return this.analysers.map((analyser) => {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return dbToMeterFraction(peakLevel(samples));
    });
  }

  dispose() {
    this.stop();
    const context = this.context;
    this.context = null;
    this.analysers = null;
    if (context?.close) context.close().catch?.(() => {});
  }
}

function setChannels(node, channels) {
  if (channels === "Mono") {
    node.channelCountMode = "explicit";
    node.channelCount = 1;
  } else {
    node.channelCountMode = "max";
    node.channelCount = 2;
  }
}
function disconnect(entry) {
  [entry.node, entry.gain, entry.pan].forEach((node) => node?.disconnect?.());
}
