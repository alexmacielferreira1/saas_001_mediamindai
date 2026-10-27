// Motivo real quando o áudio de uma mídia não abre (caso do site publicado: /stream respondeu 404 porque o
// arquivo sumiu do disco). O carregador registra o motivo por URL e as ferramentas citam a mídia e o motivo.
import { afterEach, describe, expect, it, vi } from "vitest";
import { audioBufferFailure, clearAudioBufferCache, loadAudioBuffer } from "./filmcraftAudio";
import { audioFailureReason, runMMFilmTool, unreadableAudioMessage } from "./mmfilmMcpTools";

afterEach(() => clearAudioBufferCache());

const decodingContext = { decodeAudioData: vi.fn(async (data) => (data.bad ? Promise.reject(new Error("EncodingError")) : { duration: 1 })) };
const respond = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, arrayBuffer: async () => body });

describe("loadAudioBuffer registra o motivo da falha", () => {
  it("HTTP 404 guarda o status", async () => {
    expect(await loadAudioBuffer(decodingContext, "/api/v1/media/assets/x/stream", async () => respond(404))).toBeNull();
    expect(audioBufferFailure("/api/v1/media/assets/x/stream")).toEqual({ kind: "http", message: "HTTP 404", status: 404 });
  });

  it("erro de rede (fetch rejeitado) não é confundido com formato", async () => {
    expect(await loadAudioBuffer(decodingContext, "u-rede", async () => Promise.reject(new TypeError("Failed to fetch")))).toBeNull();
    expect(audioBufferFailure("u-rede")).toEqual({ kind: "network", message: "Failed to fetch" });
  });

  it("erro de decodificação vira 'decode'", async () => {
    expect(await loadAudioBuffer(decodingContext, "u-formato", async () => respond(200, { bad: true }))).toBeNull();
    expect(audioBufferFailure("u-formato")).toEqual({ kind: "decode", message: "EncodingError" });
  });
});

describe("mensagem das ferramentas com o motivo e o nome da mídia", () => {
  it("cada motivo tem um texto próprio", () => {
    expect(audioFailureReason({ kind: "http", status: 404 })).toBe("o arquivo não está mais no servidor (404). Envie a mídia de novo pelo Ingest.");
    expect(audioFailureReason({ kind: "http", status: 410 })).toMatch(/não está mais no servidor \(410\)/);
    expect(audioFailureReason({ kind: "http", status: 500 })).toBe("o servidor respondeu 500.");
    expect(audioFailureReason({ kind: "http" })).toBe("o servidor respondeu com erro.");
    expect(audioFailureReason({ kind: "network" })).toBe("sem conexão com o servidor.");
    expect(audioFailureReason({ kind: "decode" })).toBe("formato sem áudio ou não suportado.");
    expect(audioFailureReason({ kind: "large" })).toMatch(/grande demais/);
    expect(audioFailureReason(undefined)).toBeNull();
  });

  it("sem motivo registrado mantém a mensagem genérica; com mais mídias, informa quantas", () => {
    const clips = [{ url: "a", name: "A" }, { url: "b", name: "B" }, { url: "b", name: "B2" }];
    expect(unreadableAudioMessage(clips, new Map())).toBe("Não foi possível ler o áudio das mídias (formato sem áudio ou mídia indisponível).");
    const buffers = Object.assign(new Map(), { failures: new Map([["a", { kind: "network" }], ["b", { kind: "decode" }]]) });
    expect(unreadableAudioMessage(clips, buffers)).toBe("Não foi possível ler o áudio de “A”: sem conexão com o servidor. (outra(s) 1 mídia(s) também não abriram.)");
    expect(unreadableAudioMessage([{ url: "a" }], buffers)).toBe("Não foi possível ler o áudio de “mídia”: sem conexão com o servidor.");
  });

  // Ambiente igual ao do FilmCraftWorkspace: Map de buffers com `failures` por URL.
  const failingEnv = (failure) => ({
    loadBuffers: async (clips) => Object.assign(new Map(), { failures: new Map(clips.map((clip) => [clip.url, failure])) }),
  });
  const clip = (id, track, extra = {}) => ({ id, name: id, track, type: track.startsWith("A") ? "audio/wav" : "video/mp4", url: `/stream/${id}`, start: 0, duration: 5, sourceIn: 0, speed: 100, volume: 100, ...extra });
  const state = (clips) => ({ clips, markers: [], selectedIds: [], trackState: {}, media: [], playhead: 0 });

  it("Remover silêncios com /stream 404 cita a mídia e pede novo envio (nada muda)", async () => {
    const result = await runMMFilmTool("silence.remove", state([clip("Entrevista Prefeito", "A1")]), {}, failingEnv({ kind: "http", status: 404 }));
    expect(result).toEqual({
      ok: false,
      summary: "Não foi possível ler o áudio de “Entrevista Prefeito”: o arquivo não está mais no servidor (404). Envie a mídia de novo pelo Ingest.",
    });
  });

  it("decodificação e rede também aparecem com o motivo certo", async () => {
    const one = state([clip("Narração", "A1")]);
    expect((await runMMFilmTool("cuts.pauses", one, {}, failingEnv({ kind: "decode" }))).summary).toBe(
      "Não foi possível ler o áudio de “Narração”: formato sem áudio ou não suportado.",
    );
    expect((await runMMFilmTool("silence.remove", one, {}, failingEnv({ kind: "network" }))).summary).toBe(
      "Não foi possível ler o áudio de “Narração”: sem conexão com o servidor.",
    );
  });

  it("Normalizar, Sincronizar e Multicâmera explicam o motivo", async () => {
    const two = state([clip("Cam A", "V1"), clip("Gravador", "A1"), clip("Lapela 2", "A2"), clip("Cam B", "V2")]);
    const env = failingEnv({ kind: "http", status: 404 });
    const normalize = await runMMFilmTool("audio.normalize", two, {}, env);
    expect(normalize.ok).toBe(false);
    expect(normalize.summary).toMatch(/^Não foi possível ler o áudio de “(Cam A|Gravador)”: o arquivo não está mais no servidor \(404\)/);
    const sync = await runMMFilmTool("sync.waveform", two, {}, env);
    expect(sync.ok).toBe(false);
    expect(sync.summary).toMatch(/^Não foi possível ler o som de pelo menos duas fontes\. Não foi possível ler o áudio de “.+”: o arquivo não está mais no servidor \(404\)/);
    const multicam = await runMMFilmTool("multicam.cut", two, {}, env);
    expect(multicam).toEqual({ ok: false, summary: "Pessoa 1 (A1): Não foi possível ler o áudio de “Gravador”: o arquivo não está mais no servidor (404). Envie a mídia de novo pelo Ingest." });
  });

  it("Normalizar sem motivo registrado continua informando que nada pôde ser medido", async () => {
    const result = await runMMFilmTool("audio.normalize", state([clip("Voz", "A1")]), {}, { loadBuffers: async () => new Map() });
    expect(result).toMatchObject({ ok: true, count: 0, summary: "Nenhum clipe pôde ser medido." });
  });
});
