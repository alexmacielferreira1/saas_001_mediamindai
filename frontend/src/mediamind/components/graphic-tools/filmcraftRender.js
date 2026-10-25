// Composição do Programa (V1–V3) e exportação real em WebM no navegador.
// Adaptado de OpenCut (MIT) — ver THIRD_PARTY_NOTICES.md (scene-builder: faixas desenhadas de baixo para cima;
// scene-exporter: laço de quadros com progresso e cancelamento). Sem dependências: canvas.captureStream +
// MediaRecorder gravam o canvas e a mixagem do Web Audio em tempo real.
import { clipMediaTime } from "../../lib/mmfilmTimeline";
import { animatedClip } from "../../lib/mmfilmMotion";
import { effectiveVisual } from "../../lib/mmfilmMotionPresets";
import { colorValue, drawLookOverlays, lookFilter, transitionProgress, transitionState, transitionWindows } from "../../lib/mmfilmLooks";
import { drawAnimatedText, textAnimationState } from "../../lib/mmfilmTextAnimation";
import { FilmcraftAudioEngine, audioContextClass, planAudioSegments } from "./filmcraftAudio";

export const SEQUENCE_WIDTH = 1920;
export const SEQUENCE_HEIGHT = 1080;
export const SEQUENCE_FPS = 29.97;
const TITLE_TYPE = "text/title";
const VIDEO_TRACK_ORDER = ["V1", "V2", "V3"];

export const EXPORT_PRESETS = {
  "Corresponder à origem – Alta taxa de bits": { width: 1920, height: 1080 },
  "YouTube 1080p Full HD": { width: 1920, height: 1080 },
  "Instagram 1080×1350": { width: 1080, height: 1350 },
  "TikTok 1080×1920": { width: 1080, height: 1920 },
};
export const presetSize = (preset) => EXPORT_PRESETS[preset] || EXPORT_PRESETS["Corresponder à origem – Alta taxa de bits"];

/** Camadas visíveis no tempo `time`, da mais baixa (V1) para a mais alta (V3). */
export function programLayers(clips = [], time = 0, trackState = {}) {
  return clips
    .map((clip, order) => ({ clip, order }))
    .filter(
      ({ clip }) =>
        VIDEO_TRACK_ORDER.includes(clip.track) &&
        clip.enabled !== false &&
        trackState?.[clip.track]?.visible !== false &&
        !clip.type?.startsWith("audio") &&
        time >= clip.start &&
        time < clip.start + clip.duration,
    )
    .sort(
      (a, b) =>
        VIDEO_TRACK_ORDER.indexOf(a.clip.track) - VIDEO_TRACK_ORDER.indexOf(b.clip.track) || a.order - b.order,
    )
    .map(({ clip }) => clip);
}

/** Fim do conteúdo exportável (camadas de vídeo visíveis ou clipes com áudio). */
export function timelineEnd(clips = [], trackState = {}) {
  return clips
    .filter((clip) =>
      clip.track?.startsWith("A")
        ? clip.enabled !== false
        : clip.enabled !== false && trackState?.[clip.track]?.visible !== false,
    )
    .reduce((end, clip) => Math.max(end, clip.start + clip.duration), 0);
}

export function exportRange({ clips, trackState, interval = "Sequência inteira", markIn = 0, markOut = 0 }) {
  if (interval === "Entrada/Saída" && markOut > markIn) return { start: markIn, end: markOut };
  return { start: 0, end: timelineEnd(clips, trackState) };
}

/** Retângulo da mídia dentro do quadro: "Ajustar ao quadro" (contain) ou "Preencher" (cover). */
export function fitRect(sourceWidth, sourceHeight, width, height, fit = "Ajustar ao quadro") {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) return { x: 0, y: 0, width, height };
  const ratio =
    fit === "Preencher"
      ? Math.max(width / sourceWidth, height / sourceHeight)
      : Math.min(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * ratio;
  const h = sourceHeight * ratio;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

// Com a Correção básica do Lumetri desligada (`colorBypass.basic`), os campos voltam ao neutro.
export const layerFilter = (clip) =>
  `brightness(${100 + colorValue(clip, "exposure")}%) contrast(${colorValue(clip, "contrast")}%) saturate(${colorValue(clip, "saturation")}%)`;

/** Transformação de uma camada no quadro de saída. Posição e ponto de ancoragem estão em pixels da sequência 1920×1080. */
export function layerTransform(clip, width, height) {
  const sx = width / SEQUENCE_WIDTH;
  const sy = height / SEQUENCE_HEIGHT;
  return {
    originX: (clip.anchorX ?? SEQUENCE_WIDTH / 2) * sx,
    originY: (clip.anchorY ?? SEQUENCE_HEIGHT / 2) * sy,
    translateX: (clip.x ?? 0) * sx,
    translateY: (clip.y ?? 0) * sy,
    rotation: ((clip.rotation ?? 0) * Math.PI) / 180,
    scale: (clip.scale ?? 100) / 100,
    opacity: Math.max(0, Math.min(1, (clip.opacity ?? 100) / 100)),
    crop: {
      left: ((clip.cropLeft ?? 0) / 100) * width,
      top: ((clip.cropTop ?? 0) / 100) * height,
      right: ((clip.cropRight ?? 0) / 100) * width,
      bottom: ((clip.cropBottom ?? 0) / 100) * height,
    },
  };
}

function sourceSize(element) {
  return {
    width: element?.videoWidth || element?.naturalWidth || element?.width || 0,
    height: element?.videoHeight || element?.naturalHeight || element?.height || 0,
  };
}

/**
 * Composição do Programa no tempo `time`: as camadas de `programLayers` com os efeitos das ferramentas em `_fx`
 * (movimento, canais extras dos motion presets, transição e cor de mergulho). Durante uma transição, os dois
 * clipes do corte entram (o que sai embaixo); fora dela, o resultado é o mesmo de `programLayers`.
 */
export function programComposition(clips = [], time = 0, trackState = {}) {
  const base = programLayers(clips, time, trackState);
  const visible = clips.filter(
    (clip) => VIDEO_TRACK_ORDER.includes(clip.track) && trackState?.[clip.track]?.visible !== false && !clip.type?.startsWith("audio"),
  );
  const windows = clips.some((clip) => clip.transition) ? transitionWindows(visible).filter((window) => time >= window.from && time < window.to) : [];
  const entry = (clip, extra = {}) => ({ ...animatedClip(clip, time), _fx: { visual: effectiveVisual(clip, time), ...extra } });
  const result = [];
  base.forEach((clip) => {
    const window = windows.find((item) => item.outgoingId === clip.id || item.incomingId === clip.id);
    if (!window) {
      result.push(entry(clip));
      return;
    }
    if (result.some((item) => item._fx.window === window)) return;
    const outgoing = clips.find((item) => item.id === window.outgoingId);
    const incoming = clips.find((item) => item.id === window.incomingId);
    const state = transitionState(window.transition, transitionProgress(window, time));
    result.push(entry(outgoing, { window, transition: state.outgoing }), entry(incoming, { window, transition: state.incoming, overlay: state.overlay }));
  });
  return result;
}

const fxOf = (layer) => layer._fx || { visual: { opacityFactor: 1, blur: 0, scaleX: 1, glitch: 0 } };

function drawLayerContent(context, clip, { sources, width, height, fit, time }) {
  if (clip.type === TITLE_TYPE && clip.textAnimation && time !== undefined) {
    const style = clip.captionStyle;
    const scale = height / SEQUENCE_HEIGHT;
    const state = textAnimationState(clip.textAnimation, style?.uppercase ? String(clip.text || clip.name || "").toUpperCase() : clip.text || clip.name || "", time - clip.start, clip.duration);
    drawAnimatedText(
      context,
      clip.text || clip.name || "",
      state,
      width,
      height,
      style
        ? {
            fontSize: Math.round((style.size || 64) * scale),
            fontFamily: `"${style.font || "Inter"}", Inter, Arial, sans-serif`,
            fontWeight: style.weight || 800,
            color: style.fill || "#fff",
            y: style.position === "top" ? height * 0.12 : style.position === "bottom" ? height * 0.85 : height / 2,
          }
        : {},
    );
    return;
  }
  if (clip.type === TITLE_TYPE && clip.captionStyle) drawStyledText(context, clip.text || clip.name || "", clip.captionStyle, width, height);
  else if (clip.type === TITLE_TYPE) drawTitle(context, clip.text || clip.name || "", width, height);
  else {
    const element = sources.get(clip.id);
    const size = sourceSize(element);
    if (element && size.width && size.height) {
      const rect = fitRect(size.width, size.height, width, height, fit);
      context.drawImage(element, rect.x, rect.y, rect.width, rect.height);
    }
  }
}

/** Desenha um quadro do Programa: fundo preto (buracos ficam pretos) e camadas de baixo para cima. */
export function drawProgramFrame(context, { layers, composition, sources = new Map(), width, height, fit = "Ajustar ao quadro", time }) {
  context.save();
  context.globalAlpha = 1;
  context.filter = "none";
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.restore();
  const sx = width / SEQUENCE_WIDTH;
  const sy = height / SEQUENCE_HEIGHT;
  (composition || layers).forEach((layer) => {
    // Movimentos das ferramentas (zoom, shake, pan…) avaliados no instante do quadro.
    const clip = composition || time === undefined ? layer : animatedClip(layer, time);
    const { visual, transition, overlay } = composition ? fxOf(layer) : { visual: time === undefined ? fxOf({}).visual : effectiveVisual(layer, time) };
    const transform = layerTransform(clip, width, height);
    context.save();
    context.globalAlpha = transform.opacity * visual.opacityFactor * (transition?.opacity ?? 1);
    const blur = visual.blur + (transition?.blur || 0);
    context.filter = blur > 0 ? `${lookFilter(clip)} blur(${Math.round(blur * sx * 100) / 100}px)` : lookFilter(clip);
    if (transition) {
      context.translate(width / 2 + transition.dx * sx, height / 2 + transition.dy * sy);
      if (transition.scale !== 1) context.scale(transition.scale, transition.scale);
      context.translate(-width / 2, -height / 2);
      if (transition.clip) {
        context.beginPath();
        if (transition.clip.shape === "circle") context.arc(transition.clip.cx * sx, transition.clip.cy * sy, transition.clip.r * sx, 0, Math.PI * 2);
        else context.rect(transition.clip.x * sx, transition.clip.y * sy, transition.clip.width * sx, transition.clip.height * sy);
        context.clip();
      }
    }
    context.translate(transform.originX + transform.translateX, transform.originY + transform.translateY);
    context.rotate(transform.rotation);
    context.scale(transform.scale * visual.scaleX, transform.scale);
    context.translate(-transform.originX, -transform.originY);
    const { crop } = transform;
    context.beginPath();
    context.rect(crop.left, crop.top, Math.max(0, width - crop.left - crop.right), Math.max(0, height - crop.top - crop.bottom));
    context.clip();
    drawLayerContent(context, clip, { sources, width, height, fit, time });
    const glitch = Math.max(visual.glitch, transition?.glitch || 0);
    if (glitch > 0) {
      // Glitch: cópias deslocadas em modo de mistura "lighter" (separação de cor aproximada).
      context.globalCompositeOperation = "lighter";
      context.globalAlpha *= 0.35 * glitch;
      context.translate(14 * glitch * sx, 0);
      drawLayerContent(context, clip, { sources, width, height, fit, time });
      context.translate(-28 * glitch * sx, 0);
      drawLayerContent(context, clip, { sources, width, height, fit, time });
    }
    context.restore();
    if (clip.look || clip.temperature || clip.tint) {
      context.save();
      drawLookOverlays(context, clip, width, height);
      context.restore();
    }
    if (overlay && overlay.alpha > 0) {
      context.save();
      context.globalAlpha = overlay.alpha;
      context.filter = "none";
      context.fillStyle = overlay.color;
      context.fillRect(0, 0, width, height);
      context.restore();
    }
  });
}

function drawTitle(context, text, width, height) {
  const lines = String(text).split("\n");
  const size = Math.round(Math.min(width, height * (16 / 9)) * 0.035);
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `bold ${size}px sans-serif`;
  const lineHeight = size * 1.25;
  const top = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => context.fillText(line, width / 2, top + index * lineHeight));
}

/**
 * Legenda/título com estilo de template (fonte, peso, tamanho em px de 1080p, preenchimento, contorno, caixa,
 * alinhamento e posição), escalado para o tamanho do quadro.
 */
export function drawStyledText(context, text, style, width, height) {
  const scale = height / SEQUENCE_HEIGHT;
  const size = Math.max(8, Math.round((style.size || 64) * scale));
  const lines = String(style.uppercase ? String(text).toUpperCase() : text).split("\n");
  const lineHeight = size * 1.15;
  context.font = `${style.weight || 800} ${size}px "${style.font || "Inter"}", Inter, Arial, sans-serif`;
  context.textBaseline = "middle";
  const align = style.align || "center";
  context.textAlign = align;
  const margin = width * 0.05;
  const x = align === "left" ? margin : align === "right" ? width - margin : width / 2;
  const block = lines.length * lineHeight;
  const top = style.position === "top" ? height * 0.08 : style.position === "center" ? height / 2 - block / 2 : height * 0.92 - block;
  lines.forEach((line, index) => {
    const y = top + lineHeight * (index + 0.5);
    if (style.box) {
      const measured = context.measureText?.(line)?.width ?? line.length * size * 0.6;
      const pad = size * 0.3;
      const left = align === "left" ? x - pad : align === "right" ? x - measured - pad : x - measured / 2 - pad;
      context.fillStyle = style.boxColor || "#000000B3";
      context.fillRect(left, y - lineHeight / 2, measured + pad * 2, lineHeight);
    }
    if (style.strokeWidth > 0) {
      context.lineWidth = style.strokeWidth * scale * 2;
      context.strokeStyle = style.stroke || "#000";
      context.lineJoin = "round";
      context.strokeText(line, x, y);
    }
    context.fillStyle = style.fill || "#fff";
    context.fillText(line, x, y);
  });
}

export function exportSupport(scope = globalThis) {
  const Recorder = scope?.MediaRecorder;
  const canvasProto = scope?.HTMLCanvasElement?.prototype;
  if (typeof Recorder !== "function") return { supported: false, reason: "MediaRecorder indisponível" };
  if (!canvasProto || typeof canvasProto.captureStream !== "function")
    return { supported: false, reason: "captureStream do canvas indisponível" };
  if (typeof scope?.MediaStream !== "function") return { supported: false, reason: "MediaStream indisponível" };
  return { supported: true, reason: "", audio: Boolean(audioContextClass(scope)), mimeType: pickWebmMimeType(Recorder) };
}

export function pickWebmMimeType(Recorder) {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  if (typeof Recorder?.isTypeSupported !== "function") return "video/webm";
  return candidates.find((type) => Recorder.isTypeSupported(type)) || "video/webm";
}

export function exportFileName(name) {
  const base = String(name || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\.(webm|mp4|mov)$/i, "")
    .trim();
  return `${base || "mmfilm-exportacao"}.webm`;
}

export const parseKbps = (label) => (Number.parseInt(String(label), 10) || 192) * 1000;
export const mbpsToBps = (mbps) => Math.round(Math.max(0.1, Number(mbps) || 0) * 1_000_000);
export function estimateSizeMB({ videoMbps, audioKbps = 0, seconds }) {
  const bits = (Math.max(0, Number(videoMbps) || 0) * 1_000_000 + Math.max(0, audioKbps) * 1000) * Math.max(0, seconds);
  return bits / 8 / 1_000_000;
}

function abortError() {
  const error = new Error("Exportação cancelada");
  error.name = "AbortError";
  return error;
}

function waitFor(element, events, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(message)), timeoutMs);
    const handlers = {};
    const finish = (error) => {
      clearTimeout(timer);
      Object.entries(handlers).forEach(([name, handler]) => element.removeEventListener(name, handler));
      if (error) reject(error);
      else resolve();
    };
    events.forEach((name) => {
      handlers[name] = () => finish();
      element.addEventListener(name, handlers[name]);
    });
    handlers.error = () => finish(new Error(message));
    element.addEventListener("error", handlers.error);
  });
}

function isCrossOrigin(url) {
  try {
    return new URL(url, globalThis.location?.href).origin !== globalThis.location?.origin;
  } catch {
    return false;
  }
}

async function loadVisualSources(clips, range) {
  const sources = new Map();
  const visual = clips.filter(
    (clip) =>
      VIDEO_TRACK_ORDER.includes(clip.track) &&
      clip.type !== TITLE_TYPE &&
      !clip.type?.startsWith("audio") &&
      clip.start < range.end &&
      clip.start + clip.duration > range.start,
  );
  const offline = visual.find((clip) => clip.offline || !clip.url);
  if (offline) throw new Error(`mídia offline “${offline.name}” — religue antes de exportar`);
  await Promise.all(
    visual.map(async (clip) => {
      if (clip.type?.startsWith("image")) {
        const image = new Image();
        if (isCrossOrigin(clip.url)) image.crossOrigin = "use-credentials";
        image.src = clip.url;
        await (image.decode ? image.decode() : waitFor(image, ["load"], 15000, `imagem ${clip.name}`));
        sources.set(clip.id, image);
        return;
      }
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      if (isCrossOrigin(clip.url)) video.crossOrigin = "use-credentials";
      video.src = clip.url;
      await waitFor(video, ["loadeddata"], 20000, `não foi possível carregar “${clip.name}”`);
      video.currentTime = clipMediaTime(clip, Math.max(range.start, clip.start));
      await waitFor(video, ["seeked"], 10000, `não foi possível posicionar “${clip.name}”`).catch(() => {});
      sources.set(clip.id, video);
    }),
  );
  return sources;
}

function syncVideos(clips, sources, layers, time, playing = true) {
  const active = new Set(layers.map((clip) => clip.id));
  clips.forEach((clip) => {
    const video = sources.get(clip.id);
    if (!video || typeof video.play !== "function") return;
    if (!active.has(clip.id) || !playing) {
      if (!video.paused) video.pause();
      return;
    }
    const target = clipMediaTime(clip, time);
    if (Math.abs(video.currentTime - target) > 0.25) video.currentTime = target;
    video.playbackRate = Math.max(0.25, Math.min(4, (clip.speed || 100) / 100));
    if (video.paused) video.play().catch(() => {});
  });
}

/**
 * Renderiza a timeline em tempo real num canvas e grava canvas + mixagem com MediaRecorder (WebM).
 * Resolve com o Blob gerado; rejeita com AbortError se `signal` for abortado.
 */
export async function renderTimelineToWebm({
  clips,
  trackState,
  mixer,
  range,
  width = SEQUENCE_WIDTH,
  height = SEQUENCE_HEIGHT,
  fps = SEQUENCE_FPS,
  videoBitsPerSecond,
  audioBitsPerSecond,
  includeAudio = true,
  sampleRate = 48000,
  bitrateMode,
  fit = "Ajustar ao quadro",
  onProgress = () => {},
  onWarning = () => {},
  signal,
}) {
  const support = exportSupport();
  if (!support.supported) throw new Error(support.reason);
  if (!(range.end > range.start)) throw new Error("a sequência está vazia — nada para exportar");
  if (signal?.aborted) throw abortError();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2D indisponível");
  const sources = await loadVisualSources(clips, range);
  const cleanups = [
    () =>
      sources.forEach((element) => {
        if (typeof element.pause === "function") element.pause();
        element.removeAttribute?.("src");
      }),
  ];
  try {
    if (signal?.aborted) throw abortError();
    const canvasStream = canvas.captureStream(0);
    const videoTrack = canvasStream.getVideoTracks()[0];
    cleanups.push(() => canvasStream.getTracks().forEach((track) => track.stop()));
    let engine = null;
    let audioTracks = [];
    // Nunca exportar mudo em silêncio: havendo som na sequência, qualquer perda vira aviso explícito.
    const audible = includeAudio ? planAudioSegments({ clips, trackState, from: range.start, until: range.end }) : [];
    if (audible.length && !support.audio) onWarning("o arquivo saiu sem áudio: este navegador não tem Web Audio");
    if (includeAudio && support.audio) {
      let streamDestination = null;
      const AudioContextClass = audioContextClass();
      engine = new FilmcraftAudioEngine({
        createContext: () => new AudioContextClass({ sampleRate }),
        allowDirect: false,
        toDestination: (audioContext) => {
          streamDestination = audioContext.createMediaStreamDestination();
          return streamDestination;
        },
      });
      engine.ensure();
      engine.setMix({ trackState, mixer });
      await engine.preload(planAudioSegments({ clips, trackState, from: range.start, until: range.end }));
      audioTracks = streamDestination?.stream.getAudioTracks() || [];
      cleanups.push(() => engine.dispose());
      if (audible.length && !audioTracks.length) onWarning("o arquivo saiu sem áudio: o navegador não entregou a faixa de som para a gravação");
    }
    if (signal?.aborted) throw abortError();
    const stream = new MediaStream([videoTrack, ...audioTracks]);
    const mimeType = support.mimeType;
    const options = { mimeType, videoBitsPerSecond };
    if (audioTracks.length && audioBitsPerSecond) options.audioBitsPerSecond = audioBitsPerSecond;
    if (bitrateMode) options.bitrateMode = bitrateMode;
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = (event) => reject(event.error || new Error("falha do MediaRecorder"));
    });
    const draw = (time) => {
      const composition = programComposition(clips, time, trackState);
      syncVideos(clips, sources, composition, time);
      drawProgramFrame(context, { composition, sources, width, height, fit, time });
      videoTrack?.requestFrame?.();
    };
    draw(range.start);
    recorder.start(250);
    if (engine) await engine.play({ clips, trackState, from: range.start, until: range.end });
    const startedAt = performance.now();
    const duration = range.end - range.start;
    const outcome = await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(timer);
          resolve("aborted");
          return;
        }
        const elapsed = (performance.now() - startedAt) / 1000;
        if (elapsed >= duration) {
          clearInterval(timer);
          onProgress(1);
          resolve("done");
          return;
        }
        draw(range.start + elapsed);
        onProgress(elapsed / duration);
      }, 1000 / fps);
    });
    const silent = engine ? [...engine.issues.values()].filter((issue) => issue.level === "error") : [];
    if (silent.length) onWarning(`o arquivo saiu sem o som de ${silent.length} mídia(s): ${silent[0].message}`);
    engine?.stop();
    syncVideos(clips, sources, [], range.end, false);
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    if (outcome === "aborted") throw abortError();
    if (!chunks.length) throw new Error("o MediaRecorder não produziu dados");
    return new Blob(chunks, { type: mimeType.split(";")[0] });
  } finally {
    cleanups.reverse().forEach((cleanup) => {
      try {
        cleanup();
      } catch {
        // limpeza best-effort
      }
    });
  }
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
