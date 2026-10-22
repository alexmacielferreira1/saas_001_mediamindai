import { useWorkDraftState, useWorkStorageKey } from "../lib/workProtection";
import { registerMCPActions } from "../lib/mcpActions";
import { mmsomCatalogue, runMMSomTool } from "../components/graphic-tools/mmsomMcpTools";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, FolderOpen, Pause, Play, Plus, Save, SkipBack, Square, Volume2 } from "lucide-react";

const initialTracks = [
  { id: 1, name: "Voz principal", color: "#df5f6d", volume: 78, pan: 0, mute: false, solo: false },
  { id: 2, name: "Trilha musical", color: "#55a6d8", volume: 70, pan: 0, mute: false, solo: false },
];
const db = (value) => `${((value - 100) * 0.2).toFixed(1)} dB`;

export const TIMELINE_SECONDS = 120;
export const DEFAULT_CLIP_START = 3.6; // the clip box starts at 3% of the 120 s ruler
export const SAMPLE_RATE = 44100;
export const PEAK_BUCKETS = 80;
const MAX_IMPORT_BYTES = 200 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(wav|wave|mp3|ogg|oga|opus|flac|m4a|aac|webm|aif|aiff|caf)$/i;

export const EQ_BANDS = [60, 150, 400, 1000, 2400, 6000, 12000];
export const EQ_PRESETS = {
  voz: { label: "Voz", gains: [-6, -2, 0, 2, 3, 2, 1] },
  grave: { label: "Grave", gains: [5, 3, 0, -1, 0, 0, 0] },
  brilho: { label: "Brilho", gains: [0, 0, -1, 0, 2, 4, 5] },
};
const EQ_ORDER = [undefined, "voz", "grave", "brilho"];

/** Same scale as the dB label: 100 = 0 dB, each step = 0.2 dB, 0 = silence. */
export function volumeToGain(volume) {
  const value = Number(volume) || 0;
  return value <= 0 ? 0 : 10 ** (((value - 100) * 0.2) / 20);
}

/** Mute always silences; when any track is soloed, only soloed tracks are audible. */
export function effectiveGain(track, tracks) {
  if (track.mute) return 0;
  if (tracks.some((item) => item.solo) && !track.solo) return 0;
  return volumeToGain(track.volume);
}

export const panValue = (pan) => Math.max(-1, Math.min(1, (Number(pan) || 0) / 100));

/** Max absolute amplitude per bucket across all channels (0..1). */
export function computePeaks(channels, buckets = PEAK_BUCKETS) {
  const length = channels[0]?.length || 0;
  if (!length) return Array(buckets).fill(0);
  const size = length / buckets;
  return Array.from({ length: buckets }, (_, bucket) => {
    const start = Math.floor(bucket * size);
    const end = Math.max(start + 1, Math.floor((bucket + 1) * size));
    let peak = 0;
    for (const data of channels) for (let index = start; index < end && index < length; index += 1) { const value = Math.abs(data[index]); if (value > peak) peak = value; }
    return Math.round(Math.min(1, peak) * 1000) / 1000;
  });
}

export function bufferPeaks(buffer, buckets = PEAK_BUCKETS) {
  return computePeaks(Array.from({ length: buffer.numberOfChannels || 1 }, (_, index) => buffer.getChannelData(index)), buckets);
}

/** Interleaved little-endian PCM WAV (16 or 24 bit). */
export function encodeWav(channels, sampleRate, bitDepth = 24) {
  const channelCount = channels.length;
  const frames = channels[0]?.length || 0;
  const bytes = bitDepth / 8;
  const dataSize = frames * channelCount * bytes;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channelCount * bytes, true);
  view.setUint16(32, channelCount * bytes, true); view.setUint16(34, bitDepth, true);
  text(36, "data"); view.setUint32(40, dataSize, true);
  let offset = 44;
  const max = 2 ** (bitDepth - 1) - 1;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame] || 0));
      const value = Math.round(sample < 0 ? sample * (max + 1) : sample * max);
      if (bitDepth === 16) view.setInt16(offset, value, true);
      else { view.setUint8(offset, value & 0xff); view.setUint8(offset + 1, (value >> 8) & 0xff); view.setUint8(offset + 2, (value >> 16) & 0xff); }
      offset += bytes;
    }
  }
  return buffer;
}

export function buildSessionFile(tracks) {
  return {
    schema: "mmsom-session/v1",
    savedAt: new Date().toISOString(),
    settings: { sampleRate: SAMPLE_RATE, bitDepth: 24, grid: "1/4", timelineSeconds: TIMELINE_SECONDS },
    tracks: tracks.map(({ id, name, color, volume, pan, mute, solo, start, duration, fileName, eq, compressor, src }) => ({
      id, name, color, volume, pan, mute, solo, start: start ?? DEFAULT_CLIP_START, duration: duration ?? null, eq: eq || null, compressor: Boolean(compressor),
      audio: src ? { fileName: fileName || null, storage: "rascunho local do navegador (IndexedDB)" } : null,
    })),
  };
}

export function getAudioContextClass() {
  return typeof window === "undefined" ? null : window.AudioContext || window.webkitAudioContext || null;
}

function decodeAudio(context, data) {
  return new Promise((resolve, reject) => {
    try {
      const result = context.decodeAudioData(data, resolve, reject);
      if (result && typeof result.then === "function") result.then(resolve, reject);
    } catch (error) { reject(error); }
  });
}

function readArrayBuffer(blob) {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob); });
}

/** source → [EQ 7 bandas] → [compressor] → pan → volume → destino. Works for live and offline contexts. */
export function buildTrackChain(context, track, gainValue, destination) {
  const nodes = [];
  const preset = EQ_PRESETS[track.eq];
  if (preset && context.createBiquadFilter) EQ_BANDS.forEach((frequency, index) => {
    const filter = context.createBiquadFilter();
    filter.type = index === 0 ? "lowshelf" : index === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
    filter.frequency.value = frequency; filter.gain.value = preset.gains[index]; filter.Q.value = 1;
    nodes.push(filter);
  });
  if (track.compressor && context.createDynamicsCompressor) nodes.push(context.createDynamicsCompressor());
  const panner = context.createStereoPanner ? context.createStereoPanner() : null;
  if (panner) { panner.pan.value = panValue(track.pan); nodes.push(panner); }
  const gain = context.createGain();
  gain.gain.value = gainValue;
  nodes.push(gain);
  nodes.forEach((node, index) => { if (nodes[index + 1]) node.connect(nodes[index + 1]); });
  gain.connect(destination);
  return { input: nodes[0], gain, panner, nodes };
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.rel = "noopener";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function readStoredTracks(key) {
  try { const tracks = JSON.parse(localStorage.getItem(key) || "null")?.tracks; return Array.isArray(tracks) && tracks.length ? tracks : initialTracks; } catch { return initialTracks; }
}

const insertSignature = (tracks) => tracks.map((track) => `${track.id}:${track.eq || ""}:${track.compressor ? 1 : 0}`).join("|");
let trackSeed = 0;
const newTrackId = () => `${Date.now().toString(36)}-${(trackSeed += 1)}`;
const menuItems = ["Arquivo", "Editar", "Faixa", "Clipe", "Evento", "Áudio", "MIDI", "Opções", "Configuração", "Janela", "Ajuda"];

function IntegratedSoundCraft({ active = true, mcpActive = active, onShow }) {
  const storageKey = useWorkStorageKey("mm-soundcraft-session");
  const [tracks, setTracks] = useWorkDraftState("pages/SoundCraft.jsx:tracks", () => readStoredTracks(storageKey));
  const [view, setView] = useWorkDraftState("mmsom:view", "edit"); const [playing, setPlaying] = useState(false); const [time, setTime] = useWorkDraftState("mmsom:time", 0);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [menu, setMenu] = useState(null);
  const [, setBufferVersion] = useState(0);
  const inputRef = useRef(null);
  const contextRef = useRef(null);
  const masterRef = useRef(null);
  const buffers = useRef(new Map());
  const loading = useRef(new Set());
  const voices = useRef(new Map());
  const playRef = useRef(null);
  const tracksRef = useRef(tracks); tracksRef.current = tracks;
  const timeRef = useRef(time); timeRef.current = time;
  const recorderRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify({ tracks })); } catch { setStatus("Falha ao salvar a sessão neste dispositivo — use Salvar para baixar"); } }, [tracks, storageKey]);
  const ruler = useMemo(() => Array.from({ length: 13 }, (_, index) => index * 10), []);
  function patch(id, data) { setTracks((items) => items.map((item) => item.id === id ? { ...item, ...data } : item)); }
  function addTrack(name, data = {}) { setTracks((items) => [...items, { id: newTrackId(), name: name || `Áudio ${items.length + 1}`, color: "#84c7bd", volume: 100, pan: 0, mute: false, solo: false, ...data }]); }

  const ensureContext = useCallback(() => {
    if (contextRef.current) return contextRef.current;
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return null;
    const context = new AudioContextClass({ sampleRate: SAMPLE_RATE });
    const master = context.createGain();
    master.connect(context.destination);
    contextRef.current = context; masterRef.current = master;
    return context;
  }, []);

  const stopVoices = useCallback(() => {
    voices.current.forEach(({ source, chain }) => {
      try { source.onended = null; source.stop(); } catch { /* já parado */ }
      try { source.disconnect(); chain.nodes.forEach((node) => node.disconnect()); } catch { /* sem conexão */ }
    });
    voices.current.clear();
  }, []);

  const startVoices = useCallback((from) => {
    const context = contextRef.current;
    stopVoices();
    const startAt = context.currentTime + 0.05;
    const current = tracksRef.current;
    current.forEach((track) => {
      const buffer = buffers.current.get(track.id);
      if (!buffer) return;
      const offset = from - (track.start ?? DEFAULT_CLIP_START);
      if (offset >= buffer.duration) return;
      const chain = buildTrackChain(context, track, effectiveGain(track, current), masterRef.current);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(chain.input);
      if (offset < 0) source.start(startAt - offset, 0); else source.start(startAt, offset);
      voices.current.set(track.id, { source, chain });
    });
    playRef.current = { contextStart: startAt, from, signature: insertSignature(current) };
  }, [stopVoices]);

  const pause = useCallback(() => {
    stopVoices();
    const context = contextRef.current;
    if (playRef.current && context) setTime(Math.min(TIMELINE_SECONDS, playRef.current.from + Math.max(0, context.currentTime - playRef.current.contextStart)));
    playRef.current = null;
    setPlaying(false);
  }, [setTime, stopVoices]);

  const play = useCallback(async () => {
    const context = ensureContext();
    if (!context) { setStatus("Este navegador não oferece Web Audio: a reprodução não está disponível."); return false; }
    try { await context.resume?.(); } catch { /* o navegador pode exigir novo clique */ }
    const from = timeRef.current >= TIMELINE_SECONDS ? 0 : timeRef.current;
    if (from !== timeRef.current) setTime(from);
    startVoices(from);
    setPlaying(true);
    if (![...buffers.current.keys()].some((id) => tracksRef.current.some((track) => track.id === id))) setStatus("Nenhuma faixa com áudio carregado: importe ou grave áudio para ouvir.");
    return true;
  }, [ensureContext, setTime, startVoices]);

  // Playhead follows the audio clock.
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      const context = contextRef.current;
      if (!context || !playRef.current) return;
      const now = playRef.current.from + Math.max(0, context.currentTime - playRef.current.contextStart);
      if (now >= TIMELINE_SECONDS) { stopVoices(); playRef.current = null; setPlaying(false); setTime(TIMELINE_SECONDS); if (recorderRef.current) recorderRef.current.recorder.stop(); return; }
      setTime(now);
    }, 50);
    return () => clearInterval(timer);
  }, [playing, setTime, stopVoices]);

  // Volume, pan, mute and solo act on the live graph; insert changes rebuild it.
  useEffect(() => {
    if (!playing || !playRef.current) return;
    if (playRef.current.signature !== insertSignature(tracks)) {
      const context = contextRef.current;
      startVoices(playRef.current.from + Math.max(0, context.currentTime - playRef.current.contextStart));
      return;
    }
    voices.current.forEach(({ chain }, id) => {
      const track = tracks.find((item) => item.id === id);
      if (!track) return;
      chain.gain.gain.value = effectiveGain(track, tracks);
      if (chain.panner) chain.panner.pan.value = panValue(track.pan);
    });
  }, [tracks, playing, startVoices]);

  // Restore decoded audio for tracks saved with an audio reference.
  useEffect(() => {
    tracks.forEach((track) => {
      if (!track.src || track.missing || buffers.current.has(track.id) || loading.current.has(track.id)) return;
      const context = ensureContext();
      if (!context) return;
      loading.current.add(track.id);
      fetch(track.src).then((response) => { if (!response.ok) throw new Error("indisponível"); return response.arrayBuffer(); })
        .then((data) => decodeAudio(context, data))
        .then((buffer) => { buffers.current.set(track.id, buffer); setBufferVersion((value) => value + 1); })
        .catch(() => patch(track.id, { missing: true }))
        .finally(() => loading.current.delete(track.id));
    });
  }, [tracks, ensureContext]);

  useEffect(() => () => {
    stopVoices();
    const pending = recorderRef.current;
    if (pending) { try { pending.recorder.stop(); } catch { /* já parado */ } pending.stream.getTracks().forEach((item) => item.stop()); }
    contextRef.current?.close?.().catch?.(() => {});
  }, [stopVoices]);

  useEffect(() => { if (!active && playing) pause(); }, [active, playing, pause]);

  async function addAudioTrack(blob, name, start = DEFAULT_CLIP_START) {
    const context = ensureContext();
    if (!context) { setStatus("Este navegador não oferece Web Audio: não é possível carregar áudio."); return false; }
    let buffer;
    try { buffer = await decodeAudio(context, await readArrayBuffer(blob)); }
    catch { setStatus(`Não foi possível decodificar "${name}": formato não suportado por este navegador.`); return false; }
    const id = newTrackId();
    const src = URL.createObjectURL(blob);
    buffers.current.set(id, buffer);
    setTracks((items) => [...items, { id, name, color: "#84c7bd", volume: 100, pan: 0, mute: false, solo: false, src, fileName: blob.name || `${name}.webm`, duration: buffer.duration, start, peaks: bufferPeaks(buffer) }]);
    return true;
  }

  async function importAudio(files) {
    const list = [...(files || [])];
    if (!list.length) return;
    let loaded = 0;
    for (const file of list) {
      if (!(file.type?.startsWith("audio/") || AUDIO_EXTENSIONS.test(file.name))) { setStatus(`"${file.name}" não é um arquivo de áudio.`); continue; }
      if (file.size > MAX_IMPORT_BYTES) { setStatus(`"${file.name}" tem mais de 200 MB e não foi importado.`); continue; }
      if (await addAudioTrack(file, file.name.replace(/\.[^.]+$/, ""))) loaded += 1;
    }
    if (loaded) setStatus(`${loaded} arquivo(s) de áudio importado(s) e decodificado(s)`);
  }

  async function toggleRecord() {
    if (recording) { recorderRef.current?.recorder.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") { setStatus("Gravação não suportada neste navegador."); return; }
    if (!ensureContext()) { setStatus("Este navegador não oferece Web Audio: não é possível gravar."); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (error) {
      setStatus(error?.name === "NotAllowedError" || error?.name === "SecurityError" ? "Permissão de microfone negada. Libere o microfone nas configurações do navegador para gravar." : "Microfone indisponível: nenhum dispositivo de entrada foi encontrado.");
      return;
    }
    let recorder;
    try { recorder = new window.MediaRecorder(stream); } catch { stream.getTracks().forEach((item) => item.stop()); setStatus("Não foi possível iniciar a gravação neste navegador."); return; }
    const chunks = [];
    const start = timeRef.current >= TIMELINE_SECONDS ? 0 : timeRef.current;
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((item) => item.stop());
      recorderRef.current = null; setRecording(false);
      if (playRef.current) pause();
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      if (!blob.size) { setStatus("Nenhum áudio foi captado pelo microfone."); return; }
      const count = tracksRef.current.filter((track) => /^Gravação \d+$/.test(track.name)).length + 1;
      if (await addAudioTrack(blob, `Gravação ${count}`, start)) setStatus(`Gravação ${count} adicionada como nova faixa`);
    };
    recorderRef.current = { recorder, stream };
    if (start !== timeRef.current) setTime(start);
    recorder.start();
    setRecording(true);
    setStatus("Gravando do microfone… clique em Gravar novamente para parar");
    if (!playRef.current) await play();
  }

  async function renderMixdown() {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error("Exportação de mixdown não suportada neste navegador.");
    const current = tracksRef.current;
    const audible = current.filter((track) => buffers.current.get(track.id) && effectiveGain(track, current) > 0);
    if (!audible.length) throw new Error("Nada para exportar: nenhuma faixa audível com áudio carregado.");
    const end = Math.max(...audible.map((track) => (track.start ?? DEFAULT_CLIP_START) + buffers.current.get(track.id).duration));
    const offline = new Offline(2, Math.max(1, Math.ceil(end * SAMPLE_RATE)), SAMPLE_RATE);
    audible.forEach((track) => {
      const chain = buildTrackChain(offline, track, effectiveGain(track, current), offline.destination);
      const source = offline.createBufferSource();
      source.buffer = buffers.current.get(track.id);
      source.connect(chain.input);
      source.start(track.start ?? DEFAULT_CLIP_START);
    });
    const rendered = await new Promise((resolve, reject) => {
      offline.oncomplete = (event) => resolve(event.renderedBuffer);
      const result = offline.startRendering();
      if (result?.then) result.then(resolve, reject);
    });
    const left = rendered.getChannelData(0);
    const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
    return new Blob([encodeWav([left, right], rendered.sampleRate, 24)], { type: "audio/wav" });
  }

  async function exportMixdown() {
    try { downloadBlob("mmsom-mixdown.wav", await renderMixdown()); setStatus("Mixdown exportado: mmsom-mixdown.wav (44,1 kHz · 24 bit)"); return true; }
    catch (error) { setStatus(error?.message || "Falha ao exportar o mixdown."); return false; }
  }

  async function saveSession() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ tracks }));
      downloadBlob("mmsom-sessao.json", new Blob([JSON.stringify(buildSessionFile(tracks), null, 2)], { type: "application/json" }));
    } catch { setStatus("Falha ao salvar a sessão neste navegador."); return; }
    if (!tracks.some((track) => buffers.current.has(track.id))) { setStatus("Sessão salva (mmsom-sessao.json). Sem áudio carregado, nenhum mixdown foi gerado."); return; }
    try { downloadBlob("mmsom-mixdown.wav", await renderMixdown()); setStatus("Sessão salva (mmsom-sessao.json) e mixdown exportado (mmsom-mixdown.wav)"); }
    catch (error) { setStatus(`Sessão salva (mmsom-sessao.json). Mixdown não gerado: ${error?.message || "falha na renderização"}`); }
  }

  function seek(value) {
    const next = Math.max(0, Math.min(TIMELINE_SECONDS, value));
    setTime(next);
    if (playRef.current) startVoices(next);
  }

  function removeTrack(track) {
    if (!window.confirm(`Remover a faixa "${track.name}"?`)) return;
    const voice = voices.current.get(track.id);
    if (voice) { try { voice.source.stop(); } catch { /* já parado */ } voices.current.delete(track.id); }
    buffers.current.delete(track.id);
    setTracks((items) => items.filter((item) => item.id !== track.id));
  }

  // Ferramentas de um clique do MCP (grade de ícones no Copiloto). A mesa não tem histórico próprio:
  // o MCP guarda as faixas anteriores a cada aplicação e só desfaz se ninguém mexeu nelas depois.
  const mcpHistory = useRef([]);
  const showRef = useRef(onShow);
  showRef.current = onShow;
  useEffect(() => {
    if (!mcpActive) return undefined;
    const strip = ({ tracks: _tracks, ...result }) => result;
    return registerMCPActions({
      source: "mmsom",
      label: "MMSom",
      catalogue: () => mmsomCatalogue({ tracks: tracksRef.current }),
      analyze: async (toolId, params) => {
        const result = runMMSomTool(toolId, { tracks: tracksRef.current }, params);
        return strip(result.ok ? { ...result, summary: `Prévia (nada foi alterado): ${result.summary}` } : result);
      },
      apply: async (toolId, params) => {
        const result = runMMSomTool(toolId, { tracks: tracksRef.current }, params);
        if (result.ok) {
          mcpHistory.current.push({ before: tracksRef.current, after: result.tracks });
          tracksRef.current = result.tracks;
          setTracks(result.tracks);
          setStatus(`MCP · ${result.summary}`);
          // Com o "MMSOM completo" (iframe) aberto, mostra a mesa para o resultado ficar à vista.
          showRef.current?.();
        }
        return strip(result);
      },
      undo: () => {
        const last = mcpHistory.current.at(-1);
        if (!last) return false;
        if (tracksRef.current !== last.after) {
          mcpHistory.current = [];
          setStatus("As faixas mudaram depois da ação do MCP: desfazer cancelado para não perder suas alterações.");
          return false;
        }
        mcpHistory.current.pop();
        tracksRef.current = last.before;
        setTracks(last.before);
        setStatus("MCP · Última ação desfeita.");
        return true;
      },
      canUndo: () => mcpHistory.current.length > 0,
    });
  }, [mcpActive]);

  const togglePlay = () => { if (playing) pause(); else play(); };
  const stop = () => { if (recording) recorderRef.current?.recorder.stop(); pause(); setTime(0); };

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const target = event.target;
      if (target?.closest?.("input, textarea, select, button, [contenteditable='true'], iframe")) return;
      event.preventDefault();
      if (playRef.current) pause(); else play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, pause, play]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(null); };
    const escape = (event) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [menu]);

  const unavailable = [{ label: "Sem comandos disponíveis nesta versão", disabled: true }];
  const menus = {
    Arquivo: [{ label: "Importar áudio…", run: () => inputRef.current?.click() }, { label: "Salvar sessão (JSON + mixdown WAV)", run: saveSession }, { label: "Exportar mixdown (WAV)", run: exportMixdown }],
    Editar: [{ label: "Limpar todos os solos", run: () => setTracks((items) => items.map((item) => ({ ...item, solo: false }))) }, { label: "Limpar todos os mutes", run: () => setTracks((items) => items.map((item) => ({ ...item, mute: false }))) }],
    Faixa: [{ label: "Nova faixa", run: () => addTrack() }, ...tracks.map((track) => ({ label: `Remover "${track.name}"`, run: () => removeTrack(track) }))],
    Clipe: unavailable, Evento: unavailable, MIDI: unavailable, Opções: unavailable, Configuração: unavailable,
    Áudio: [{ label: playing ? "Pausar (Espaço)" : "Reproduzir (Espaço)", run: togglePlay }, { label: "Parar", run: stop }, { label: "Voltar ao início", run: () => seek(0) }, { label: recording ? "Parar gravação" : "Gravar do microfone", run: toggleRecord }],
    Janela: [{ label: "Edit", run: () => setView("edit") }, { label: "Mix", run: () => setView("mix") }],
    Ajuda: [{ label: "Espaço reproduz/pausa · clique na régua para posicionar · formatos: os suportados pelo navegador (WAV, MP3, OGG, FLAC…)", disabled: true }],
  };
  const clipLabel = (track) => track.src ? (track.missing ? " · áudio indisponível, importe novamente" : buffers.current.has(track.id) ? "" : " · carregando áudio…") : " · sem áudio";
  const insertClass = (on) => on ? "text-teal-300" : "";

  return <section className="overflow-hidden rounded-xl border border-[#34373c] bg-[#18191c] text-[#d9dde2] shadow-2xl">
    <header className="border-b border-black bg-[#24262a]"><div ref={menuRef} className="flex h-8 items-center gap-5 px-3 text-[11px]"><b className="text-teal-300">MMSOM</b>{menuItems.map((item) => <span key={item} className="relative"><button aria-haspopup="menu" aria-expanded={menu === item} onClick={() => setMenu(menu === item ? null : item)}>{item}</button>{menu === item && <span role="menu" aria-label={item} className="absolute left-0 top-full z-30 mt-1 flex w-64 flex-col rounded border border-black bg-[#2c2e33] py-1 shadow-xl">{menus[item].map((entry) => <button key={entry.label} role="menuitem" disabled={entry.disabled} onClick={() => { setMenu(null); entry.run?.(); }} className={`px-3 py-1.5 text-left ${entry.disabled ? "text-slate-500" : "hover:bg-[#3a3d43]"}`}>{entry.label}</button>)}</span>}</span>)}</div>
      <div className="flex items-center gap-1 border-t border-[#36383d] px-3 py-2"><button className="tool" onClick={() => inputRef.current?.click()} title="Importar áudio"><FolderOpen size={15}/></button><button className="tool" onClick={() => addTrack()} aria-label="Nova faixa"><Plus size={15}/></button><button className="tool" title="Salvar sessão" onClick={saveSession}><Save size={15}/></button><span className="mx-2 h-5 w-px bg-[#45474c]"/><button className="tool" title="Voltar ao início" onClick={() => seek(0)}><SkipBack size={15}/></button><button className="tool" onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproduzir"}>{playing ? <Pause size={15}/> : <Play size={15}/>}</button><button className="tool" title="Parar" onClick={stop}><Square size={14}/></button><button className="tool text-red-400" title={recording ? "Parar gravação" : "Gravar"} aria-label={recording ? "Parar gravação" : "Gravar"} aria-pressed={recording} onClick={toggleRecord}><Circle size={14} fill="currentColor"/></button><strong className="ml-3 font-mono text-lg text-teal-300">00:{String(Math.floor(time / 60)).padStart(2,"0")}:{String(Math.floor(time % 60)).padStart(2,"0")}</strong><span className="ml-auto text-[10px] text-slate-400">44.1 kHz · 24 bit · Grid 1/4</span><input ref={inputRef} className="hidden" type="file" accept="audio/*" multiple aria-label="Importar arquivos de áudio" onChange={(event) => { importAudio(event.target.files); event.target.value = ""; }}/></div>
      <div role="tablist" aria-label="Janelas MMSOM" className="flex border-t border-[#36383d] px-3"><button role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")} className={`px-5 py-2 text-xs ${view === "edit" ? "border-b-2 border-teal-400 bg-[#303237]" : "text-slate-400"}`}>Edit</button><button role="tab" aria-selected={view === "mix"} onClick={() => setView("mix")} className={`px-5 py-2 text-xs ${view === "mix" ? "border-b-2 border-teal-400 bg-[#303237]" : "text-slate-400"}`}>Mix</button></div></header>
    {view === "edit" ? <div className="grid min-h-[610px] grid-cols-[260px_minmax(0,1fr)]"><aside className="border-r border-black bg-[#202226]"><div className="grid h-8 grid-cols-[1fr_30px_30px] items-center border-b border-[#3a3c41] px-3 text-[10px] uppercase text-slate-500"><span>Faixas</span><span>M</span><span>S</span></div>{tracks.map((track) => <div key={track.id} className="grid h-64 grid-cols-[1fr_30px_30px] border-b border-[#101114] bg-[#27292d] p-2"><div><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{background: track.color}}/><input value={track.name} onChange={(event) => patch(track.id,{name:event.target.value})} className="min-w-0 bg-transparent text-xs font-bold outline-none"/></div><label className="mt-5 block text-[10px] text-slate-400">Volume <span className="float-right">{db(track.volume)}</span><input aria-label={`Volume ${track.name}`} type="range" min="0" max="100" value={track.volume} onChange={(event) => patch(track.id,{volume:Number(event.target.value)})} className="mt-2 w-full accent-teal-400"/></label><label className="mt-3 block text-[10px] text-slate-400">Pan <input aria-label={`Pan ${track.name}`} type="range" min="-100" max="100" value={track.pan} onChange={(event)=>patch(track.id,{pan:Number(event.target.value)})} className="mt-2 w-full accent-teal-400"/></label></div><button aria-label={`Silenciar ${track.name}`} aria-pressed={track.mute} onClick={()=>patch(track.id,{mute:!track.mute})} className={`mt-1 h-6 rounded text-[10px] ${track.mute?"bg-amber-500 text-black":"bg-[#151619]"}`}>M</button><button aria-label={`Solo ${track.name}`} aria-pressed={track.solo} onClick={()=>patch(track.id,{solo:!track.solo})} className={`mt-1 h-6 rounded text-[10px] ${track.solo?"bg-yellow-300 text-black":"bg-[#151619]"}`}>S</button></div>)}</aside><div className="relative overflow-hidden bg-[#15171a]"><div aria-label="Régua da linha do tempo" title="Clique para posicionar o cursor" onClick={(event) => { const box = event.currentTarget.getBoundingClientRect(); if (box.width) seek(((event.clientX - box.left) / box.width) * TIMELINE_SECONDS); }} className="flex h-8 border-b border-[#3a3c41] bg-[#222429] text-[9px] text-slate-500">{ruler.map((tick)=><span key={tick} className="flex-1 border-l border-[#3c3f45] px-1">{tick}s</span>)}</div><div className="absolute inset-y-8 w-px bg-red-400" style={{left:`${(time/120)*100}%`}}/>{tracks.map((track)=>{ const start = track.start ?? DEFAULT_CLIP_START; const left = (start / TIMELINE_SECONDS) * 100; const width = track.duration ? Math.max(0.5, Math.min(100 - left, (track.duration / TIMELINE_SECONDS) * 100)) : 72; const peaks = track.peaks?.length ? track.peaks : null; return <div key={track.id} className="relative h-64 border-b border-[#313338]" style={{backgroundImage:"linear-gradient(90deg,#292c31 1px,transparent 1px)",backgroundSize:"8.33% 100%"}}><div data-testid={`clipe-${track.name}`} className="absolute top-5 h-40 overflow-hidden rounded border" style={{left:`${left}%`,width:`${width}%`,background:`${track.color}44`,borderColor:track.color}}><div className="flex h-full items-center gap-[2px] px-2 opacity-80">{(peaks || Array(PEAK_BUCKETS).fill(0)).map((peak,i)=><i key={i} className="w-0.5" style={{height:`${Math.max(2, peak * 100)}%`,background:track.color}}/>)}</div><span className="absolute left-2 top-1 text-[10px]">{track.name}{clipLabel(track)}</span></div></div>; })}</div></div> : <div role="region" aria-label="Mesa de mixagem" className="flex min-h-[610px] items-stretch gap-px overflow-x-auto bg-black p-4">{tracks.map((track)=><div key={track.id} className="flex w-36 shrink-0 flex-col items-center border border-[#3b3d42] bg-[#25272b] p-3"><input value={track.name} onChange={(event)=>patch(track.id,{name:event.target.value})} className="w-full bg-transparent text-center text-xs font-bold outline-none"/><div className="mt-3 h-28 w-full rounded border border-[#444] bg-[#17181b] p-2 text-[9px] text-slate-500"><p>INSERT A</p><p className="mt-3"><button aria-label={`EQ ${track.name}`} title="Clique para alternar o preset de EQ (desligado, Voz, Grave, Brilho)" onClick={() => patch(track.id, { eq: EQ_ORDER[(EQ_ORDER.indexOf(track.eq) + 1) % EQ_ORDER.length] })} className={`text-left ${insertClass(track.eq)}`}>EQ 7-Band{track.eq ? ` · ${EQ_PRESETS[track.eq].label}` : ""}</button></p><p className="mt-2"><button aria-label={`Compressor ${track.name}`} aria-pressed={Boolean(track.compressor)} onClick={() => patch(track.id, { compressor: !track.compressor })} className={`text-left ${insertClass(track.compressor)}`}>Compressor{track.compressor ? " · ligado" : ""}</button></p><p className="mt-4" aria-disabled="true" title="Envio auxiliar ainda não disponível">SEND A</p></div><label className="mt-3 text-[10px]">PAN<input aria-label={`Pan ${track.name}`} type="range" min="-100" max="100" value={track.pan} onChange={(event)=>patch(track.id,{pan:Number(event.target.value)})} className="w-full accent-teal-400"/></label><div className="my-3 flex h-56 gap-2"><input aria-label={`Volume ${track.name}`} type="range" orient="vertical" min="0" max="100" value={track.volume} onChange={(event)=>patch(track.id,{volume:Number(event.target.value)})} className="h-full w-8 accent-teal-400 [writing-mode:vertical-lr] [direction:rtl]"/><div className="h-full w-2 bg-gradient-to-t from-emerald-500 via-yellow-400 to-red-500 opacity-70"/></div><div className="flex gap-1"><button aria-label={`Silenciar ${track.name}`} aria-pressed={track.mute} onClick={()=>patch(track.id,{mute:!track.mute})} className="rounded bg-[#151619] px-2 py-1 text-[10px]">M</button><button aria-label={`Solo ${track.name}`} aria-pressed={track.solo} onClick={()=>patch(track.id,{solo:!track.solo})} className="rounded bg-[#151619] px-2 py-1 text-[10px]">S</button></div><span className="mt-2 text-[10px]">{db(track.volume)}</span></div>)}</div>}
    <footer className="flex h-7 items-center gap-4 border-t border-black bg-[#25272b] px-3 text-[10px] text-slate-500"><Volume2 size={12}/><span role="status">{status || "Sessão local · alterações salvas automaticamente"}</span> <span className="ml-auto">{tracks.length} faixas</span></footer>
  </section>;
}

export default function SoundCraft({ active = true }) {
  const [experience, setExperience] = useWorkDraftState("mmsom:experience", "complete");
  return <section className="overflow-hidden rounded-xl border border-[#34373c] bg-[#18191c] shadow-2xl">
    <div className="flex h-10 items-center border-b border-black bg-[#24262a] px-3 text-xs text-[#d9dde2]">
      <img src="/soundcraft-runtime/ai.storyteller.soundcraft-4f86cc0f1d19c49f.png" alt="" className="mr-2 h-6 w-6 rounded"/>
      <strong>MMSOM 0.5</strong>
      <div role="tablist" aria-label="Experiência MMSOM" className="ml-6 flex h-full">
        <button role="tab" aria-selected={experience === "complete"} onClick={() => setExperience("complete")} className={`px-4 ${experience === "complete" ? "border-b-2 border-teal-400 bg-white/5" : "text-slate-400"}`}>MMSOM completo</button>
        <button role="tab" aria-selected={experience === "integrated"} onClick={() => setExperience("integrated")} className={`px-4 ${experience === "integrated" ? "border-b-2 border-teal-400 bg-white/5" : "text-slate-400"}`}>Mesa integrada</button>
      </div>
      <span className="ml-auto text-[10px] text-slate-400">Projeto local · áudio processado no navegador</span>
    </div>
    <div hidden={experience !== "complete"}><iframe title="MMSOM completo" src="/soundcraft-runtime/index.html" allow="autoplay; microphone; clipboard-read; clipboard-write" className="h-[calc(100vh-11rem)] min-h-[720px] w-full border-0 bg-[#1e1f22]"/></div>
    <div hidden={experience !== "integrated"}><IntegratedSoundCraft active={experience === "integrated"} mcpActive={active} onShow={() => setExperience("integrated")} /></div>
  </section>;
}
