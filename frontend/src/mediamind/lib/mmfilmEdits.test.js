import { describe, expect, it } from "vitest";
import {
  keyValueAt,
  leftPart,
  linkRoot,
  mergeRanges,
  placeClip,
  removeRanges,
  rightPart,
  sliceKeys,
  splitAtTimes,
  timeAfterRemoval,
} from "./mmfilmEdits";

const clip = (id, track, start, duration, extra = {}) => ({ id, track, start, duration, sourceIn: 0, speed: 100, keyframes: [], ...extra });

describe("curvas de valores", () => {
  it("interpola linear, suave e em degrau e segura as pontas", () => {
    const keys = [[0, 0], [2, 10, "ease"], [4, 20, "hold"], [6, 30]];
    expect(keyValueAt(undefined, 1, 7)).toBe(7);
    expect(keyValueAt(keys, -1)).toBe(0);
    expect(keyValueAt(keys, 1)).toBe(5);
    expect(keyValueAt(keys, 2.5)).toBeCloseTo(11.25);
    expect(keyValueAt(keys, 3.5)).toBeCloseTo(18.75);
    expect(keyValueAt(keys, 5)).toBe(20);
    expect(keyValueAt(keys, 9)).toBe(30);
    expect(keyValueAt([[1, 4], [1, 9]], 1)).toBe(4);
  });

  it("recorta a curva preservando o valor nas bordas e a suavização do trecho", () => {
    expect(sliceKeys(undefined, 0, 1)).toBeUndefined();
    expect(sliceKeys([[0, 0], [4, 8]], 1, 3)).toEqual([[0, 2], [2, 6]]);
    expect(sliceKeys([[0, 0, "ease"], [2, 4], [4, 8]], 1, 4)).toEqual([[0, 2, "ease"], [1, 4], [3, 8]]);
  });
});

describe("partes de um corte", () => {
  it("divide quadros-chave, movimento e curva de volume nas duas partes", () => {
    const original = clip("a", "V1", 10, 4, {
      keyframes: [1, 3],
      transition: "Dissolver",
      speed: 200,
      motion: { scale: [[0, 1], [4, 2]] },
      gainKeys: [[0, 0], [4, -12]],
    });
    const left = leftPart(original, 12);
    const right = rightPart(original, 12, "b");
    expect(left).toMatchObject({ id: "a", duration: 2, keyframes: [1], motion: { scale: [[0, 1], [2, 1.5]] }, gainKeys: [[0, 0], [2, -6]] });
    expect(right).toMatchObject({ id: "b", start: 12, duration: 2, sourceIn: 4, keyframes: [1], transition: undefined });
    expect(right.motion.scale).toEqual([[0, 1.5], [2, 2]]);
    expect(right.gainKeys).toEqual([[0, -6], [2, -12]]);
    expect(rightPart(clip("c", "V1", 0, 2), 1).id).toEqual(expect.any(String));
  });

  it("o corte de um par vinculado gera um novo vínculo comum às partes direitas", () => {
    const video = clip("v", "V1", 0, 8, { linkId: "L" });
    const audio = clip("a", "A1", 0, 8, { linkId: "L" });
    expect(leftPart(video, 3).linkId).toBe("L");
    const [rightVideo, rightAudio] = [rightPart(video, 3), rightPart(audio, 3)];
    expect(rightVideo.linkId).not.toBe("L");
    expect(rightVideo.linkId).toBe(rightAudio.linkId);
    expect(linkRoot(rightVideo.linkId)).toBe("L");
    expect(rightPart(rightVideo, 5).linkId).toBe(rightPart(rightAudio, 5).linkId);
    expect(linkRoot(rightPart(rightVideo, 5).linkId)).toBe("L");
    expect(rightPart(clip("s", "V1", 0, 2), 1).linkId).toBeUndefined();
  });

  it("insere empurrando e sobrescreve aparando como antes", () => {
    const base = [clip("a", "V1", 0, 4), clip("x", "A1", 0, 4)];
    const inserted = placeClip(base, clip("n", "V1", 2, 1), "insert");
    expect(inserted.filter((item) => item.track === "V1").map(({ id, start, duration }) => [id, start, duration])).toEqual([
      ["a", 0, 2],
      [expect.any(String), 3, 2],
      ["n", 2, 1],
    ]);
    const after = placeClip([clip("a", "V1", 5, 2)], clip("n", "V1", 2, 1), "insert");
    expect(after[0].start).toBe(6);
    const before = placeClip([clip("a", "V1", 0, 1)], clip("n", "V1", 2, 1), "insert");
    expect(before[0]).toMatchObject({ id: "a", start: 0 });
    const over = placeClip([clip("a", "V1", 0, 6), clip("b", "V1", 8, 1)], clip("n", "V1", 2, 1), "overwrite");
    expect(over.map(({ id, start, duration }) => [id, start, duration])).toEqual([
      ["a", 0, 2],
      [expect.any(String), 3, 3],
      ["b", 8, 1],
      ["n", 2, 1],
    ]);
    const inside = placeClip([clip("a", "V1", 2, 1)], clip("n", "V1", 1, 4), "overwrite");
    expect(inside.map((item) => item.id)).toEqual(["n"]);
    const tail = placeClip([clip("a", "V1", 2, 4)], clip("n", "V1", 1, 2), "overwrite");
    expect(tail[0]).toMatchObject({ id: "a", start: 3, duration: 3 });
  });
});

describe("remoção de trechos com ripple", () => {
  it("junta trechos e converte tempos para depois da remoção", () => {
    expect(mergeRanges([[5, 6], [1, 2], [1.5, 3], [4, 4]])).toEqual([[1, 3], [5, 6]]);
    const ranges = [[1, 3], [5, 6]];
    expect(timeAfterRemoval(0.5, ranges)).toBe(0.5);
    expect(timeAfterRemoval(2, ranges)).toBe(1);
    expect(timeAfterRemoval(4, ranges)).toBe(2);
    expect(timeAfterRemoval(8, ranges)).toBe(5);
  });

  it("apaga os trechos em todas as faixas, fecha buracos e respeita faixas protegidas", () => {
    const clips = [
      clip("v", "V1", 0, 10, { motion: { scale: [[0, 1], [10, 2]] } }),
      clip("late", "V2", 7, 2),
      clip("gone", "V3", 1.5, 1),
      clip("music", "A2", 0, 10),
    ];
    const result = removeRanges(clips, [[1, 3], [5, 6]], { skipTrack: (track) => track === "A2" });
    const v1 = result.filter((item) => item.track === "V1");
    expect(v1.map(({ id, start, duration, sourceIn }) => [id, start, duration, sourceIn])).toEqual([
      ["v", 0, 1, 0],
      [expect.any(String), 1, 2, 3],
      [expect.any(String), 3, 4, 6],
    ]);
    expect(v1[2].motion.scale[0][1]).toBeCloseTo(1.6);
    expect(result.find((item) => item.id === "late").start).toBe(4);
    expect(result.some((item) => item.id === "gone")).toBe(false);
    expect(result.find((item) => item.id === "music")).toBe(clips[3]);
    expect(removeRanges(clips, [])).toBe(clips);
    const untouched = clip("u", "V1", 0, 1);
    expect(removeRanges([untouched], [[2, 3]])[0]).toBe(untouched);
  });

  it("começo removido mantém o id original na primeira parte", () => {
    const result = removeRanges([clip("a", "V1", 0, 5)], [[0, 2]]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "a", start: 0, duration: 3, sourceIn: 2 });
  });

  it("navalha em vários tempos sem apagar nada, pulando faixas protegidas", () => {
    const result = splitAtTimes([clip("a", "V1", 0, 6), clip("m", "A2", 0, 6)], [4, 2, 2, 9], { skipTrack: (track) => track === "A2" });
    expect(result.filter((item) => item.track === "V1").map(({ start, duration }) => [start, duration])).toEqual([
      [0, 2],
      [2, 2],
      [4, 2],
    ]);
    expect(result.filter((item) => item.track === "A2")).toHaveLength(1);
    expect(splitAtTimes([clip("a", "V1", 0, 2)], [1])).toHaveLength(2);
  });
});
