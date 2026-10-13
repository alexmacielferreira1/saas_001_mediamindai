import { describe, expect, it } from "vitest";
import {
  clipMediaTime,
  clipsInsideMarquee,
  timelineTimeFromPointer,
} from "./mmfilmTimeline";

describe("MMFilm timeline gestures", () => {
  it("converts a dragged pointer into a bounded timeline time", () => {
    expect(timelineTimeFromPointer(260, 100, 10, 60)).toBe(16);
    expect(timelineTimeFromPointer(20, 100, 10, 60)).toBe(0);
    expect(timelineTimeFromPointer(900, 100, 10, 60)).toBe(60);
  });

  it("selects every clip intersecting a marquee across tracks", () => {
    const clips = [
      { id: "v1", track: "V1", start: 2, duration: 4 },
      { id: "v2", track: "V2", start: 6, duration: 2 },
      { id: "a1", track: "A1", start: 3, duration: 2 },
    ];
    expect(
      clipsInsideMarquee(clips, {
        startTime: 1,
        endTime: 7,
        startTrack: "V2",
        endTrack: "A1",
      }),
    ).toEqual(["v1", "v2", "a1"]);
  });

  it("maps the sequence playhead to the clip source time and speed", () => {
    expect(
      clipMediaTime({ start: 10, sourceIn: 2, duration: 8, speed: 150 }, 12),
    ).toBe(5);
  });
});
