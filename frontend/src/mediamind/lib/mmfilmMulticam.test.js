import { describe, expect, it } from "vitest";
import {
  BLEED_MARGIN_DB,
  PACE_MIN_SHOT,
  applyMulticam,
  planMulticam,
  speakerActivity,
} from "./mmfilmMulticam";

const WINDOW = 0.01;
const SPEECH_DB = -6;
const BLEED_DB = -26; // a voz de uma pessoa chega 20 dB mais baixa no microfone da outra
const ROOM_DB = -60;

// Envelopes de dois microfones a partir de um roteiro [[quem, início, fim]], quem = "a" | "b" | "both".
function microphones(script, total) {
  const count = Math.round(total / WINDOW);
  const a = new Float32Array(count).fill(ROOM_DB);
  const b = new Float32Array(count).fill(ROOM_DB);
  script.forEach(([who, start, end]) => {
    for (let w = Math.round(start / WINDOW); w < Math.round(end / WINDOW); w += 1) {
      if (who !== "b") {
        a[w] = SPEECH_DB;
        b[w] = Math.max(b[w], BLEED_DB);
      }
      if (who !== "a") {
        b[w] = SPEECH_DB;
        a[w] = Math.max(a[w], BLEED_DB);
      }
    }
  });
  const envelope = (db) => ({ from: 0, windowSeconds: WINDOW, db });
  return [
    { personId: "a", envelope: envelope(a) },
    { personId: "b", envelope: envelope(b) },
  ];
}

// Atividade direta a partir de um roteiro [[estado, início, fim]]; o resto é "none".
function activityOf(script, total) {
  const states = new Array(Math.round(total / WINDOW)).fill("none");
  script.forEach(([state, start, end]) => states.fill(state, Math.round(start / WINDOW), Math.round(end / WINDOW)));
  return { from: 0, windowSeconds: WINDOW, states };
}

const people = [
  { id: "a", cameraTrack: "V1" },
  { id: "b", cameraTrack: "V2" },
];
const shot = (start, end, track) => ({ start, end, track });

describe("speakerActivity", () => {
  it("separa quem fala, os dois juntos e o silêncio, ignorando o vazamento entre microfones", () => {
    const activity = speakerActivity(
      microphones(
        [
          ["a", 0, 5],
          ["b", 5, 10],
          ["both", 10, 12],
        ],
        14,
      ),
    );
    expect(activity.from).toBe(0);
    expect(activity.windowSeconds).toBe(WINDOW);
    expect(activity.states).toHaveLength(1400);
    expect([activity.states[100], activity.states[700], activity.states[1100], activity.states[1300]]).toEqual([
      "a",
      "b",
      "both",
      "none",
    ]);
  });

  it("sem a margem sobre o vazamento, a voz captada no outro microfone viraria fala", () => {
    const mics = microphones([["a", 0, 5]], 8);
    expect(BLEED_MARGIN_DB).toBe(6);
    expect(speakerActivity(mics, { margin: -30 }).states[100]).toBe("both");
    expect(speakerActivity(mics).states[100]).toBe("a");
  });

  it("um microfone mudo não atrapalha e a lista vazia não tem atividade", () => {
    const mics = microphones(
      [
        ["a", 0, 5],
        ["b", 5, 10],
      ],
      12,
    );
    const silent = { personId: "c", envelope: { from: 0, windowSeconds: WINDOW, db: new Float32Array(1200).fill(ROOM_DB) } };
    const states = speakerActivity([...mics, silent]).states;
    expect([states[100], states[700], states[1100]]).toEqual(["a", "b", "none"]);
    expect(speakerActivity([]).states).toEqual([]);
  });
});

describe("planMulticam", () => {
  it("troca a câmera 0,2 s antes de cada pessoa começar a falar", () => {
    const activity = activityOf(
      [
        ["a", 0, 10],
        ["b", 10, 20],
        ["a", 20, 30],
      ],
      30,
    );
    expect(planMulticam({ activity, people })).toEqual([shot(0, 9.8, "V1"), shot(9.8, 19.8, "V2"), shot(19.8, 30, "V1")]);
    expect(planMulticam({ activity, people, leadIn: 0.5 })[1]).toEqual(shot(9.5, 19.5, "V2"));
  });

  it("respostas curtas não trocam a câmera, conforme o plano mínimo do ritmo", () => {
    expect(PACE_MIN_SHOT).toEqual({ calmo: 3, normal: 2, rapido: 1.2 });
    const answer = (length) =>
      activityOf(
        [
          ["a", 0, 10],
          ["b", 10, 10 + length],
          ["a", 10 + length, 20],
        ],
        20,
      );
    expect(planMulticam({ activity: answer(1), people, pace: "rapido" })).toEqual([shot(0, 20, "V1")]);
    expect(planMulticam({ activity: answer(1.5), people })).toEqual([shot(0, 20, "V1")]);
    expect(planMulticam({ activity: answer(1.5), people, pace: "rapido" })).toEqual([
      shot(0, 9.8, "V1"),
      shot(9.8, 11.3, "V2"),
      shot(11.3, 20, "V1"),
    ]);
    expect(planMulticam({ activity: answer(2.5), people, pace: "calmo" })).toEqual([shot(0, 20, "V1")]);
    expect(planMulticam({ activity: answer(2.5), people, pace: "outro" })).toHaveLength(3);
  });

  it("nenhum plano fica menor que o mínimo do ritmo", () => {
    const script = [];
    let time = 0;
    [0.4, 2.2, 1.3, 3.1, 0.8, 1.9, 4, 1.25, 2.6, 0.3, 5].forEach((length, index) => {
      script.push([index % 2 ? "b" : "a", time, time + length]);
      time += length + (index % 3 === 0 ? 0.5 : 0);
    });
    const activity = activityOf(script, time);
    Object.entries(PACE_MIN_SHOT).forEach(([pace, minShot]) => {
      const shots = planMulticam({ activity, people, pace, wideTrack: "V3", varyWithWide: true });
      expect(shots[0].start).toBe(0);
      expect(shots[shots.length - 1].end).toBeCloseTo(time, 6);
      shots.forEach((item, index) => {
        expect(item.end - item.start).toBeGreaterThanOrEqual(minShot - 1e-6);
        if (index) expect(item.start).toBe(shots[index - 1].end);
      });
    });
  });

  it("não troca quando o último plano ficaria menor que o mínimo", () => {
    const activity = activityOf(
      [
        ["a", 0, 10],
        ["b", 10, 12],
      ],
      12,
    );
    expect(planMulticam({ activity, people, leadIn: -1 })).toEqual([shot(0, 12, "V1")]);
  });

  it("duas pessoas juntas vão para a geral; sem geral, mantém a câmera atual; silêncio mantém", () => {
    const activity = activityOf(
      [
        ["a", 0, 10],
        ["both", 10, 13],
        ["b", 16, 25],
      ],
      25,
    );
    expect(planMulticam({ activity, people, wideTrack: "V3" })).toEqual([
      shot(0, 9.8, "V1"),
      shot(9.8, 15.8, "V3"),
      shot(15.8, 25, "V2"),
    ]);
    expect(planMulticam({ activity, people })).toEqual([shot(0, 15.8, "V1"), shot(15.8, 25, "V2")]);
  });

  it("varia com a geral em falas longas (a cada ~8 s) e não divide a própria geral", () => {
    const monologue = activityOf([["a", 0, 30]], 30);
    expect(planMulticam({ activity: monologue, people, wideTrack: "V3", varyWithWide: true })).toEqual([
      shot(0, 8, "V1"),
      shot(8, 10, "V3"),
      shot(10, 18, "V1"),
      shot(18, 20, "V3"),
      shot(20, 30, "V1"),
    ]);
    expect(planMulticam({ activity: monologue, people, wideTrack: "V3", varyWithWide: true, pace: "calmo" })[1]).toEqual(
      shot(8, 11, "V3"),
    );
    expect(planMulticam({ activity: monologue, people, varyWithWide: true })).toEqual([shot(0, 30, "V1")]);
    const laughing = activityOf([["both", 0, 30]], 30);
    expect(planMulticam({ activity: laughing, people, wideTrack: "V3", varyWithWide: true })).toEqual([shot(0, 30, "V3")]);
  });

  it("sem fala usa a primeira pessoa e ignora estados desconhecidos ou atividade vazia", () => {
    const quiet = activityOf([["x", 2, 9]], 10);
    expect(planMulticam({ activity: quiet, people })).toEqual([shot(0, 10, "V1")]);
    expect(planMulticam({ activity: { from: 0, windowSeconds: WINDOW, states: [] }, people })).toEqual([]);
    expect(planMulticam({ activity: quiet, people: [] })).toEqual([]);
  });
});

describe("applyMulticam", () => {
  const camera = (id, track, start = 0, duration = 30) => ({
    id,
    track,
    start,
    duration,
    sourceIn: 0,
    speed: 100,
    volume: 100,
    enabled: true,
    url: `blob:${id}`,
    type: "video/mp4",
  });
  const clips = [
    camera("cam-a", "V1"),
    camera("cam-b", "V2"),
    camera("wide", "V3"),
    { ...camera("mic", "A1"), type: "audio/wav" },
    camera("later", "V1", 40, 10),
  ];
  const shots = [shot(0, 9.8, "V1"), shot(9.8, 19.8, "V2"), shot(19.8, 30, "V1")];

  it("divide as câmeras nas trocas e desativa os pedaços fora do ar sem apagar nada", () => {
    const next = applyMulticam(clips, shots, { cameraTracks: ["V1", "V2", "V3"] });
    const pieces = (track) =>
      next.filter((item) => item.track === track && item.start < 30).map((item) => [item.start, item.start + item.duration, item.enabled]);
    expect(pieces("V1")).toEqual([
      [0, 9.8, true],
      [9.8, 19.8, false],
      [19.8, 30, true],
    ]);
    expect(pieces("V2")).toEqual([
      [0, 9.8, false],
      [9.8, 19.8, true],
      [19.8, 30, false],
    ]);
    expect(pieces("V3")).toEqual([
      [0, 9.8, false],
      [9.8, 19.8, false],
      [19.8, 30, false],
    ]);
    ["V1", "V2", "V3"].forEach((track) => {
      const covered = next.filter((item) => item.track === track && item.start < 30).reduce((sum, item) => sum + item.duration, 0);
      expect(covered).toBeCloseTo(30, 9);
    });
    expect(next.find((item) => item.id === "mic")).toBe(clips[3]);
    expect(next.find((item) => item.id === "later")).toBe(clips[4]);
    expect(clips[0].enabled).toBe(true);
  });

  it("sem lista de câmeras usa as faixas presentes nos planos", () => {
    const next = applyMulticam(clips, shots);
    expect(next.find((item) => item.id === "wide")).toBe(clips[2]);
    expect(next.filter((item) => item.track === "V2")).toHaveLength(3);
  });
});
