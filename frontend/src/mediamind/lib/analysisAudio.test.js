import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYSIS_SAMPLE_RATE,
  MAX_ANALYSIS_SECONDS,
  analysisAudioFailure,
  clearAnalysisAudioCache,
  createDownmixer,
  loadAnalysisAudio,
} from "./analysisAudio";
import { audioFailureReason } from "../components/graphic-tools/mmfilmMcpTools";

// Pedaço de áudio no formato do AudioBuffer (o que o AudioBufferSink do mediabunny entrega).
function chunk({ seconds, rate = 48000, channels = [0.5, -0.5] }) {
  const length = Math.round(seconds * rate);
  const data = channels.map((value) => new Float32Array(length).fill(value));
  return { sampleRate: rate, length, numberOfChannels: channels.length, duration: seconds, getChannelData: (index) => data[index] };
}

function fakeMedia({ duration, parts, noAudio = false, failAt = -1 }) {
  const dispose = vi.fn();
  return {
    dispose,
    open: vi.fn(async () => ({
      dispose,
      async audio() {
        if (noAudio) return null;
        return {
          duration,
          async *buffers() {
            let timestamp = 0;
            for (const [index, part] of parts.entries()) {
              if (index === failAt) throw new Error("codec não suportado");
              yield { buffer: part, timestamp };
              timestamp += part.duration;
            }
          },
        };
      },
    })),
  };
}

afterEach(() => clearAnalysisAudioCache());

describe("leitura de áudio em pedaços para análise", () => {
  it("mistura os canais e reduz a taxa para um buffer mono leve de análise", () => {
    const mixer = createDownmixer(1);
    mixer.add(chunk({ seconds: 1, channels: [0.6, 0.2] }), 0);
    const buffer = mixer.finish();
    expect(buffer.sampleRate).toBe(ANALYSIS_SAMPLE_RATE);
    expect(buffer.numberOfChannels).toBe(1);
    expect(buffer.length).toBe(ANALYSIS_SAMPLE_RATE);
    expect(buffer.getChannelData(0)[100]).toBeCloseTo(0.4, 5);
    expect(buffer.analysisOnly).toBe(true);
  });

  it("lê arquivo longo em pedaços, mantém cada pedaço no lugar e informa o progresso", async () => {
    const media = fakeMedia({ duration: 3, parts: [chunk({ seconds: 1, channels: [0] }), chunk({ seconds: 1, channels: [1] }), chunk({ seconds: 1, channels: [0] })] });
    const progress = [];
    const buffer = await loadAnalysisAudio("/m/longo.mp4", { open: media.open, onProgress: (value) => progress.push(value) });
    const data = buffer.getChannelData(0);
    expect(buffer.duration).toBeCloseTo(3, 2);
    expect(data[Math.round(0.5 * ANALYSIS_SAMPLE_RATE)]).toBe(0);
    expect(data[Math.round(1.5 * ANALYSIS_SAMPLE_RATE)]).toBe(1);
    expect(data[Math.round(2.5 * ANALYSIS_SAMPLE_RATE)]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(media.dispose).toHaveBeenCalled();
    // Em cache: a segunda análise não lê o arquivo de novo.
    await loadAnalysisAudio("/m/longo.mp4", { open: media.open });
    expect(media.open).toHaveBeenCalledTimes(1);
  });

  it("explica mídia sem áudio, longa demais ou que falha no meio, e tenta de novo depois", async () => {
    expect(await loadAnalysisAudio("/m/mudo.mp4", { open: fakeMedia({ noAudio: true }).open })).toBeNull();
    expect(analysisAudioFailure("/m/mudo.mp4").kind).toBe("no-audio");
    expect(audioFailureReason(analysisAudioFailure("/m/mudo.mp4"))).toBe("a mídia não tem faixa de áudio.");

    expect(await loadAnalysisAudio("/m/longo-demais.mp4", { open: fakeMedia({ duration: MAX_ANALYSIS_SECONDS + 1, parts: [] }).open })).toBeNull();
    expect(audioFailureReason(analysisAudioFailure("/m/longo-demais.mp4"))).toMatch(/mais de 4 h/);

    const broken = fakeMedia({ duration: 2, parts: [chunk({ seconds: 1 }), chunk({ seconds: 1 })], failAt: 1 });
    expect(await loadAnalysisAudio("/m/quebrado.mp4", { open: broken.open })).toBeNull();
    expect(analysisAudioFailure("/m/quebrado.mp4")).toEqual({ kind: "decode", message: "codec não suportado" });
    expect(broken.dispose).toHaveBeenCalled();
    // Falha não fica em cache: a próxima tentativa lê de novo.
    await loadAnalysisAudio("/m/quebrado.mp4", { open: broken.open });
    expect(broken.open).toHaveBeenCalledTimes(2);

    expect(await loadAnalysisAudio("/m/sem-duracao.mp4", { open: fakeMedia({ duration: 0, parts: [] }).open })).toBeNull();
    expect(analysisAudioFailure("/m/sem-duracao.mp4").kind).toBe("decode");
  });

  it("informa arquivo ausente como erro HTTP, não como problema de codec", async () => {
    const open = vi.fn(async () => {
      throw new Error("Error fetching http://localhost/api/v1/assets/9/content: 404 Not Found");
    });
    expect(await loadAnalysisAudio("/m/sumiu.mp4", { open })).toBeNull();
    expect(analysisAudioFailure("/m/sumiu.mp4")).toMatchObject({ kind: "http", status: 404 });
    expect(audioFailureReason(analysisAudioFailure("/m/sumiu.mp4"))).toMatch(/não está mais no servidor \(404\)/);
  });

  it("recusa decodificação vazia em vez de devolver silêncio como se fosse áudio", async () => {
    const empty = fakeMedia({ duration: 5, parts: [] });
    expect(await loadAnalysisAudio("/m/vazio.mp4", { open: empty.open })).toBeNull();
    expect(analysisAudioFailure("/m/vazio.mp4").message).toMatch(/nenhuma amostra/);
  });
});
