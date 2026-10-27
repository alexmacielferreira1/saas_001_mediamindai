// Motor de áudio do MMFilm: mixagem das faixas A1–A3 (e do áudio dos clipes de vídeo) com Web Audio.
// Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md (AudioManager: âncora relógio de áudio ↔ timeline,
// agendamento com compensação de início atrasado, decodificação com cache por fonte e picos de forma de onda).
// Semântica de mixer (fader em dB com mínimo = silêncio, pan −100..100, solo exclusivo) segue o FilmCraft (Apache-2.0).
import { keyValueAt, linkRoot } from "../../lib/mmfilmEdits";

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
 * em faixas V visíveis — exceto quando o som do vídeo já está numa faixa A: pelo vínculo (`linkId`, criado ao
 * soltar o vídeo com o áudio) em qualquer posição/estado, ou — em clipes antigos sem vínculo — pelo mesmo
 * recurso no mesmo início.
 */
export function audioClipsForMix(clips = [], trackState = {}) {
  const audio = clips.filter((clip) => AUDIO_TRACKS.includes(clip.track) && hasAudibleMedia(clip));
  const linkedAudio = new Set(
    clips.filter((clip) => AUDIO_TRACKS.includes(clip.track) && clip.linkId).map((clip) => linkRoot(clip.linkId)),
  );
  const video = clips.filter(
    (clip) =>
      clip.track?.startsWith("V") &&
      trackState?.[clip.track]?.visible !== false &&
      clip.type?.startsWith("video") &&
      hasAudibleMedia(clip) &&
      !(clip.linkId && linkedAudio.has(linkRoot(clip.linkId))) &&
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
        clipStart: clip.start,
        gainKeys: clip.gainKeys?.length ? clip.gainKeys : undefined,
      },
    ];
  });
}

/**
 * Curva de volume do clipe (ex.: ducking, em dB no tempo local) agendada no AudioParam entre `when` e `stopAt`.
 * Sem curva ou sem automação no navegador, o ganho fica fixo.
 */
export function scheduleGainCurve(param, segment, anchor, when, stopAt) {
  const keys = segment.gainKeys;
  if (!keys?.length || typeof param.setValueAtTime !== "function" || typeof param.linearRampToValueAtTime !== "function") return;
  const rate = anchor.rate || 1;
  const localAt = (contextTime) => anchor.timelineTime + (contextTime - anchor.contextTime) * rate - segment.clipStart;
  const contextAt = (local) => anchor.contextTime + (segment.clipStart + local - anchor.timelineTime) / rate;
  const from = localAt(when);
  const until = localAt(stopAt);
  param.setValueAtTime(segment.gain * dbToGain(keyValueAt(keys, from)), when);
  keys
    .filter(([time]) => time > from && time < until)
    .forEach(([time, db]) => param.linearRampToValueAtTime(segment.gain * dbToGain(db), contextAt(time)));
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

// Acima disso o arquivo não é baixado inteiro para decodificar: o som vai direto por um elemento de mídia.
export const MAX_DECODE_BYTES = 150 * 1024 * 1024;
const bufferCache = new Map();
const bufferFailures = new Map();
const readyBuffers = new Map();
/**
 * Decodifica (uma vez por URL) o áudio de um arquivo de mídia. Sucesso fica em cache; falha resolve `null`
 * e sai do cache (a próxima chamada tenta de novo). O motivo fica em `audioBufferFailure(url)`.
 */
export function loadAudioBuffer(context, url, fetcher = globalThis.fetch, { maxBytes = MAX_DECODE_BYTES } = {}) {
  if (!bufferCache.has(url)) {
    const pending = (async () => {
      let response;
      try {
        response = await fetcher(url, { credentials: "include" });
      } catch (error) {
        // fetch rejeitado = sem resposta do servidor (rede, CORS, servidor fora do ar), não é problema de formato.
        throw Object.assign(new Error(error?.message || "sem conexão com o servidor"), { kind: "network" });
      }
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { kind: "http", status: response.status });
      const size = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(size) && size > maxBytes) {
        response.body?.cancel?.()?.catch?.(() => {});
        throw Object.assign(new Error("arquivo grande demais para decodificar inteiro"), { kind: "large" });
      }
      const data = await response.arrayBuffer();
      if (data?.byteLength > maxBytes) throw Object.assign(new Error("arquivo grande demais para decodificar inteiro"), { kind: "large" });
      return await context.decodeAudioData(data);
    })().then(
      (buffer) => {
        bufferFailures.delete(url);
        readyBuffers.set(url, buffer);
        return buffer;
      },
      (error) => {
        bufferFailures.set(url, {
          kind: error?.kind || "decode",
          message: error?.message || "falha ao decodificar",
          ...(error?.status !== undefined ? { status: error.status } : {}),
        });
        if (bufferCache.get(url) === pending) bufferCache.delete(url);
        return null;
      },
    );
    bufferCache.set(url, pending);
  }
  return bufferCache.get(url);
}
/** Buffer já decodificado (síncrono) ou undefined. */
export const readyAudioBuffer = (url) => readyBuffers.get(url);
/** Motivo da última falha ao decodificar a URL: { kind: "http" | "network" | "large" | "decode", message, status? }. */
export const audioBufferFailure = (url) => bufferFailures.get(url);
export function clearAudioBufferCache() {
  bufferCache.clear();
  bufferFailures.clear();
  readyBuffers.clear();
}

const PLAN_B_RETRY_MS = 30000;
// Plano B: o elemento de mídia só recebe o arquivo (src) até 3 s antes do trecho começar.
const ELEMENT_PRELOAD_MS = 3000;
const DRIFT_LIMIT = 0.25;
const clampRate = (rate) => clamp(rate, 0.0625, 16);
// Mídia de outro domínio (API em outro host) precisa de CORS com credenciais para o Web Audio ouvir o som.
function needsCors(url, scope = globalThis) {
  if (!/^https?:/i.test(url)) return false;
  try {
    return new URL(url).origin !== scope.location?.origin;
  } catch {
    return false;
  }
}
const wallClock = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000;
function defaultMediaElement() {
  return globalThis.document?.createElement?.("audio") ?? null;
}

export class FilmcraftAudioEngine {
  constructor({
    createContext,
    toDestination,
    fetcher,
    onDecodeError,
    onAudioIssue,
    createMediaElement = defaultMediaElement,
    bufferWaitMs = 400,
    resumeWaitMs = 300,
    startTimeoutMs = 8000,
    maxDecodeBytes = MAX_DECODE_BYTES,
    allowDirect = true,
  } = {}) {
    this.allowDirect = allowDirect;
    this.resumeWaitMs = resumeWaitMs;
    this.startTimeoutMs = startTimeoutMs;
    this.createContext = createContext;
    this.toDestination = toDestination;
    this.fetcher = fetcher;
    this.onDecodeError = onDecodeError;
    this.onAudioIssue = onAudioIssue;
    this.createMediaElement = createMediaElement;
    this.bufferWaitMs = bufferWaitMs;
    this.maxDecodeBytes = maxDecodeBytes;
    this.context = null;
    this.session = 0;
    this.anchor = null;
    this.nodes = new Set();
    this.mix = { trackState: {}, mixer: emptyMixer() };
    this.reported = new Set();
    // Situação do som por URL: "fallback" (tocando por elemento de mídia) ou "error" (não tocou).
    this.issues = new Map();
    this.elementOnly = new Set();
    this.failedAt = new Map();
  }

  /**
   * Chamado de forma síncrona no clique de Reproduzir: cria o AudioContext e o retoma dentro do gesto do
   * usuário (Safari/tablets deixam o contexto "suspended" se o resume vier depois, num efeito assíncrono).
   */
  unlock() {
    const context = this.ensure();
    if (context?.state === "suspended") context.resume?.()?.catch?.(() => {});
    return context;
  }

  report(url, issue) {
    const previous = this.issues.get(url);
    if (previous?.level === issue.level && previous?.message === issue.message) return;
    if (previous?.level === "error" && issue.level === "fallback") return;
    this.issues.set(url, issue);
    this.onAudioIssue?.(url, issue);
  }

  /** O som da URL tocou de verdade: um erro anterior (ex.: tentativa bloqueada) não fica grudado no clipe. */
  clearError(url) {
    if (this.issues.get(url)?.level !== "error") return;
    this.issues.delete(url);
    this.onAudioIssue?.(url, null);
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
    this.nodes.forEach((entry) => {
      if (entry.direct) this.applyDirectVolume(entry);
    });
  }

  /** Volume de um elemento de som direto (sem Web Audio): clipe × curva no tempo atual × faixa × master. */
  applyDirectVolume(entry) {
    const segment = entry.direct;
    const { trackState, mixer } = this.mix;
    let curve = 1;
    if (segment.gainKeys?.length && this.anchor) {
      const timeline = this.anchor.timelineTime + (this.now() - this.anchor.contextTime) * (this.anchor.rate || 1);
      curve = dbToGain(keyValueAt(segment.gainKeys, timeline - segment.clipStart));
    }
    entry.element.volume = clamp(segment.gain * curve * trackGain({ trackState, mixer, track: segment.bus }) * masterGain(mixer), 0, 1);
  }

  get playing() {
    return Boolean(this.anchor);
  }

  /** Tempo atual da timeline segundo o relógio de áudio (null se parado). */
  currentTime() {
    if (!this.anchor || !this.context) return null;
    return this.anchor.timelineTime + (this.now() - this.anchor.contextTime) * this.anchor.rate;
  }

  async preload(segments) {
    const context = this.ensure();
    if (!context) return;
    await Promise.all([...new Set(segments.map((segment) => segment.url))].map((url) => this.buffer(url)));
  }

  /** Decodificação já falhou (ou o arquivo é grande): não tenta de novo agora, vai direto pelo elemento. */
  skipDecode(url) {
    if (this.elementOnly.has(url)) return true;
    const at = this.failedAt.get(url);
    return at !== undefined && Date.now() - at < PLAN_B_RETRY_MS;
  }

  async buffer(url) {
    const buffer = await loadAudioBuffer(this.context, url, this.fetcher || globalThis.fetch, { maxBytes: this.maxDecodeBytes });
    if (buffer) {
      this.failedAt.delete(url);
      if (this.issues.delete(url)) this.onAudioIssue?.(url, null);
      return buffer;
    }
    const failure = audioBufferFailure(url);
    if (failure?.kind === "large") this.elementOnly.add(url);
    else this.failedAt.set(url, Date.now());
    if (!this.reported.has(url)) {
      this.reported.add(url);
      this.onDecodeError?.(url, failure);
    }
    return null;
  }

  /** Buffer pronto a tempo (até `bufferWaitMs`) ou null — nesse caso o trecho começa pelo elemento de mídia. */
  async bufferInTime(url) {
    const ready = readyAudioBuffer(url);
    if (ready) return ready;
    if (this.skipDecode(url)) return null;
    const loading = this.buffer(url);
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), this.bufferWaitMs);
    });
    const buffer = await Promise.race([loading, timeout]);
    clearTimeout(timer);
    return buffer;
  }

  /** Começa a tocar a timeline a partir de `from`. Retorna false se o navegador não tem Web Audio. */
  async play({ clips, trackState, from = 0, until = Infinity, rate = 1 }) {
    const context = this.ensure();
    if (!context) return false;
    this.stop();
    const session = ++this.session;
    const segments = planAudioSegments({ clips, trackState, from, until, rate });
    this.anchor = { contextTime: context.currentTime, timelineTime: from, rate, clock: "context" };
    if (context.state !== "running") {
      // resume() pode nunca resolver (contexto criado fora de um gesto no Safari/tablet): espera pouco.
      let timer;
      await Promise.race([
        Promise.resolve(context.resume?.()).catch(() => {}),
        new Promise((resolve) => {
          timer = setTimeout(resolve, this.resumeWaitMs);
        }),
      ]);
      clearTimeout(timer);
      if (session !== this.session) return true;
    }
    if (context.state === "running") this.anchor = { contextTime: context.currentTime, timelineTime: from, rate, clock: "context" };
    else {
      // Contexto parado: o relógio do Web Audio não anda. O indicador segue o relógio da página e o som
      // vai direto pelos elementos de mídia (sem passar pelo mixer), em vez de ficar mudo sem explicação.
      this.anchor = { contextTime: wallClock(), timelineTime: from, rate, clock: "wall" };
      if (!this.allowDirect) {
        // Exportação: som direto sairia nas caixas e não na gravação — informa em vez de gravar mudo.
        segments.forEach((segment) => this.report(segment.url, { level: "error", message: "o navegador manteve o áudio pausado" }));
        return true;
      }
      segments.forEach((segment) => this.scheduleElement(segment, { direct: true }));
      return true;
    }
    await Promise.all(
      segments.map(async (segment) => {
        const buffer = await this.bufferInTime(segment.url);
        if (session !== this.session) return;
        if (buffer) this.schedule(segment, buffer);
        else this.scheduleElement(segment);
      }),
    );
    return true;
  }

  /** Relógio da âncora: o do AudioContext ou, com o contexto parado, o da página. */
  now() {
    return this.anchor?.clock === "wall" ? wallClock() : this.context.currentTime;
  }

  /** Conecta fonte → ganho do clipe (com curva) → pan do clipe → barramento da faixa. */
  connectSegment(source, segment, when, stopAt) {
    const context = this.context;
    const gain = context.createGain();
    gain.gain.value = segment.gain;
    scheduleGainCurve(gain.gain, segment, this.anchor, when, stopAt);
    const pan = context.createStereoPanner ? context.createStereoPanner() : null;
    source.connect(gain);
    if (pan) {
      pan.pan.value = segment.pan;
      gain.connect(pan);
      pan.connect(this.buses[segment.bus].input);
    } else gain.connect(this.buses[segment.bus].input);
    return { gain, pan };
  }

  /**
   * Plano B: toca o trecho por um elemento de mídia (sem decodificar o arquivo inteiro) ligado ao mesmo
   * barramento da faixa — mudo, solo, volume e fader continuam valendo. Posição e velocidade seguem a âncora.
   */
  scheduleElement(segment, { direct = false } = {}) {
    const context = this.context;
    const url = segment.url;
    const decodeFailure = audioBufferFailure(url);
    const fail = (message) => this.report(url, { level: "error", message });
    if (!direct && typeof context.createMediaElementSource !== "function") {
      fail("este navegador não toca o som desta mídia (sem decodificação nem reprodução direta)");
      return;
    }
    const element = this.createMediaElement?.();
    if (!element) {
      fail("não foi possível criar o reprodutor de áudio");
      return;
    }
    const { when, stopAt } = segmentContextTimes(segment, this.anchor, this.now());
    if (stopAt <= when) return;
    if (!direct && needsCors(url)) element.crossOrigin = "use-credentials";
    // O arquivo só começa a baixar pouco antes da hora de tocar (não todos os trechos da timeline de uma vez).
    let loaded = false;
    const load = () => {
      if (loaded || !this.nodes.has(entry)) return;
      loaded = true;
      element.preload = "auto";
      element.src = url;
    };
    let entry;
    if (direct) {
      // Sem Web Audio ativo: volume do clipe (com curva) × faixa (mudo/solo/fader) × master, limitado a 100 %,
      // atualizado ao mexer no mixer e a cada timeupdate. Pan não existe aqui (só com Web Audio).
      entry = { element, node: null, timers: [], direct: segment };
      this.applyDirectVolume(entry);
    } else {
      let source;
      try {
        source = context.createMediaElementSource(element);
      } catch (error) {
        fail(`o som não pôde ser ligado ao mixer (${error?.message || "erro"})`);
        return;
      }
      entry = { element, node: source, ...this.connectSegment(source, segment, when, stopAt), timers: [] };
    }
    this.nodes.add(entry);
    const rate = clampRate(segment.playbackRate);
    // Posição esperada da mídia agora, pelo relógio da âncora (sem deriva entre som e imagem).
    const expected = () => segmentContextTimes(segment, this.anchor, this.now()).offset;
    let playing = false;
    const begin = () => {
      if (!this.nodes.has(entry)) return;
      load();
      element.playbackRate = rate;
      element.currentTime = Math.max(0, expected());
      const started = element.play?.();
      const ok = () => {
        // Trecho já parado (stop/busca) antes do play() resolver: nada a informar.
        if (!this.nodes.has(entry)) return;
        playing = true;
        this.clearError(url);
        if (direct)
          this.report(url, {
            level: "fallback",
            message: "o navegador manteve o áudio do editor pausado; som direto do arquivo (volume, mudo e solo valem; pan e canais não)",
          });
        else if (decodeFailure || this.skipDecode(url))
          this.report(url, {
            level: "fallback",
            message:
              decodeFailure?.kind === "large"
                ? "arquivo grande: som tocado direto do arquivo (sem forma de onda)"
                : "som tocado direto do arquivo (a decodificação falhou)",
          });
      };
      const refused = (error) => {
        // pause() durante o play() pendente rejeita com AbortError: é parada normal, não bloqueio.
        if (!this.nodes.has(entry) || error?.name === "AbortError") return;
        fail(`o navegador não deixou tocar o som (${error?.message || error?.name || "bloqueado"})`);
      };
      if (started?.then) started.then(ok, refused);
      else ok();
      // Nunca silêncio sem explicação: se o arquivo não começar a tocar em alguns segundos, avisa.
      entry.timers.push(
        setTimeout(() => {
          if (this.nodes.has(entry) && !playing) fail("o arquivo demorou demais para começar a tocar (rede lenta ou mídia inacessível)");
        }, this.startTimeoutMs),
      );
    };
    element.addEventListener?.("playing", () => {
      playing = true;
    });
    element.addEventListener?.("error", () => {
      if (this.nodes.has(entry)) fail("o arquivo não pôde ser lido para tocar o som");
    });
    element.addEventListener?.("timeupdate", () => {
      if (!this.nodes.has(entry) || element.paused) return;
      if (direct) this.applyDirectVolume(entry);
      const target = expected();
      if (Math.abs(element.currentTime - target) > DRIFT_LIMIT * rate) element.currentTime = target;
    });
    const delay = (when - this.now()) * 1000;
    const lead = delay - ELEMENT_PRELOAD_MS;
    if (lead > 1) entry.timers.push(setTimeout(load, lead));
    else load();
    if (delay > 1) entry.timers.push(setTimeout(begin, delay));
    else begin();
    // Fim do trecho: solta o elemento (para de baixar e sai da lista de nós ativos).
    entry.timers.push(
      setTimeout(() => {
        this.releaseElement(entry);
        this.nodes.delete(entry);
      }, (stopAt - this.now()) * 1000),
    );
  }

  releaseElement(entry) {
    entry.timers.forEach((timer) => clearTimeout(timer));
    entry.element.pause?.();
    entry.element.removeAttribute?.("src");
    entry.element.load?.();
    disconnect(entry);
  }

  schedule(segment, buffer) {
    const context = this.context;
    const { when, offset, stopAt } = segmentContextTimes(segment, this.anchor, context.currentTime);
    if (offset >= buffer.duration || stopAt <= when) return;
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = segment.playbackRate;
    const { gain, pan } = this.connectSegment(node, segment, when, stopAt);
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
    const entries = [...this.nodes];
    // Sai da lista antes de pausar: a rejeição do play() pendente (AbortError) já encontra o trecho encerrado.
    this.nodes.clear();
    entries.forEach((entry) => {
      if (entry.element) this.releaseElement(entry);
      else {
        try {
          entry.node.stop();
        } catch {
          // nó já encerrado
        }
        disconnect(entry);
      }
    });
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
