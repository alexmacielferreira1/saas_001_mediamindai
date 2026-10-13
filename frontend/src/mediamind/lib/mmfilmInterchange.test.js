import { describe, expect, it } from "vitest";
import {
  createEdl,
  createFcp7Xml,
  createFcpxml,
  createFilmCraftProject,
  createMMFilmProject,
  createOtio,
  importProjectDocument,
  relinkImportedMedia,
  relinkAssetById,
} from "./mmfilmInterchange";

const project = {
  sequence: "Filme teste",
  media: [{ id: "m1", name: "Cena 01.mp4", type: "video/mp4", size: 42 }],
  clips: [
    {
      id: "c1",
      assetId: "m1",
      name: "Cena 01.mp4",
      type: "video/mp4",
      track: "V1",
      start: 2,
      duration: 5,
      speed: 100,
      enabled: true,
      keyframes: [],
    },
  ],
  markers: [3],
  trackState: { V1: { locked: false, visible: true } },
};

describe("MMFilm project interchange", () => {
  it("round-trips the native MMFilm project", () => {
    const native = createMMFilmProject(project);
    const imported = importProjectDocument(
      JSON.stringify(native),
      "filme.mmfilmproj",
    );
    expect(native.format).toBe("mediamind.mmfilm.project");
    expect(imported.sequence).toBe("Filme teste");
    expect(imported.clips).toEqual(project.clips);
    expect(imported.trackState).toEqual(project.trackState);
  });

  it("exports and imports the FilmCraft project structure", () => {
    const filmCraft = createFilmCraftProject(project);
    const imported = importProjectDocument(
      JSON.stringify(filmCraft),
      "filme.fcproj",
    );
    expect(filmCraft.format).toBe("filmcraft.project");
    expect(filmCraft.schema_version).toBe(13);
    expect(imported.sequence).toBe("Filme teste");
    expect(imported.clips[0]).toMatchObject({
      track: "V1",
      start: 2,
      duration: 5,
    });
    expect(imported.media[0].offline).toBe(true);
  });

  it("creates and reads Premiere-compatible Final Cut Pro 7 XML", () => {
    const xml = createFcp7Xml(project);
    const imported = importProjectDocument(xml, "filme.xml");
    expect(xml).toContain('<xmeml version="5">');
    expect(imported.sequence).toBe("Filme teste");
    expect(imported.clips[0]).toMatchObject({
      name: "Cena 01.mp4",
      track: "V1",
    });
  });

  it("preserves separate video/audio tracks and markers in Premiere XML", () => {
    const expanded = {
      ...project,
      markers: [3.5],
      clips: [
        ...project.clips,
        { ...project.clips[0], id: "c2", track: "V2", start: 9 },
        { ...project.clips[0], id: "c3", track: "A1", type: "audio/wav" },
      ],
    };
    const imported = importProjectDocument(
      createFcp7Xml(expanded),
      "tracks.xml",
    );
    expect(imported.clips.map((clip) => clip.track)).toEqual([
      "V1",
      "V2",
      "A1",
    ]);
    expect(imported.markers).toEqual([3.5]);
  });

  it("creates and reads Final Cut Pro XML", () => {
    const xml = createFcpxml(project);
    const imported = importProjectDocument(xml, "filme.fcpxml");
    expect(xml).toContain('<fcpxml version="1.10">');
    expect(imported.sequence).toBe("Filme teste");
    expect(imported.clips[0].duration).toBe(5);
  });

  it("preserves connected video and audio lanes in Final Cut XML", () => {
    const expanded = {
      ...project,
      clips: [
        ...project.clips,
        { ...project.clips[0], id: "c2", track: "V2", start: 9 },
        { ...project.clips[0], id: "c3", track: "A1", type: "audio/wav" },
      ],
    };
    const imported = importProjectDocument(
      createFcpxml(expanded),
      "tracks.fcpxml",
    );
    expect(imported.clips.map((clip) => clip.track)).toEqual([
      "V1",
      "V2",
      "A1",
    ]);
  });

  it("creates and reads a CMX 3600 EDL", () => {
    const edl = createEdl(project);
    const imported = importProjectDocument(edl, "filme.edl");
    expect(edl).toContain("TITLE: Filme teste");
    expect(imported.clips[0]).toMatchObject({ start: 2, duration: 5 });
  });

  it("relinks offline media and every matching timeline clip by file name", () => {
    const result = relinkImportedMedia({
      media: [{ id: "external-1", name: "Cena 01.mp4", offline: true }],
      clips: [
        { id: "clip-1", assetId: "external-1", name: "Cena 01.mp4" },
        { id: "clip-2", assetId: "other", name: "Outra.mp4" },
      ],
      linked: {
        id: "browser-1",
        name: "Cena 01.mp4",
        type: "video/mp4",
        url: "blob:linked",
        duration: 12,
      },
    });
    expect(result.media).toEqual([
      expect.objectContaining({
        id: "external-1",
        url: "blob:linked",
        offline: false,
      }),
    ]);
    expect(result.clips[0]).toEqual(
      expect.objectContaining({
        assetId: "external-1",
        url: "blob:linked",
        type: "video/mp4",
      }),
    );
    expect(result.clips[1]).toEqual({
      id: "clip-2",
      assetId: "other",
      name: "Outra.mp4",
    });
  });

  it("does not import an unmatched file during an explicit relink", () => {
    const result = relinkImportedMedia({
      media: [{ id: "offline-1", name: "Original.mov", offline: true }],
      clips: [{ id: "clip-1", assetId: "offline-1", name: "Original.mov" }],
      linked: {
        id: "new-file",
        name: "Outro.mov",
        type: "video/quicktime",
        url: "blob:other",
      },
      onlyExisting: true,
    });
    expect(result.matched).toBe(false);
    expect(result.media).toHaveLength(1);
    expect(result.media[0].offline).toBe(true);
    expect(result.clips[0]).not.toHaveProperty("url");
  });

  it("relinks one selected asset even when the replacement has another name", () => {
    const result = relinkAssetById({
      media: [
        { id: "offline-1", name: "Original.mov", offline: true },
        { id: "offline-2", name: "Outra.mov", offline: true },
      ],
      clips: [
        { id: "clip-1", assetId: "offline-1", name: "Original.mov" },
        { id: "clip-2", assetId: "offline-2", name: "Outra.mov" },
      ],
      assetId: "offline-1",
      linked: {
        id: "browser-file",
        name: "substituto.mov",
        type: "video/quicktime",
        url: "blob:replacement",
      },
    });
    expect(result.matched).toBe(true);
    expect(result.media[0]).toMatchObject({
      id: "offline-1",
      name: "Original.mov",
      linkedFileName: "substituto.mov",
      url: "blob:replacement",
      offline: false,
    });
    expect(result.media[1].offline).toBe(true);
    expect(result.clips[0]).toMatchObject({
      assetId: "offline-1",
      url: "blob:replacement",
      offline: false,
    });
    expect(result.clips[1]).not.toHaveProperty("url");
  });

  it("round-trips multiple tracks and gaps through OpenTimelineIO", () => {
    const expanded = {
      ...project,
      markers: [1.25, 8],
      clips: [
        ...project.clips,
        { ...project.clips[0], id: "c2", track: "V2", start: 9 },
        { ...project.clips[0], id: "c3", track: "A1", type: "audio/wav" },
      ],
    };
    const otio = createOtio(expanded);
    const imported = importProjectDocument(
      JSON.stringify(otio),
      "timeline.otio",
    );
    expect(otio.OTIO_SCHEMA).toBe("Timeline.1");
    expect(imported.sequence).toBe("Filme teste");
    expect(imported.clips.map((clip) => clip.track)).toEqual([
      "V1",
      "V2",
      "A1",
    ]);
    expect(imported.clips.map((clip) => clip.start)).toEqual([2, 9, 2]);
    expect(imported.markers).toEqual([1.25, 8]);
  });
});
