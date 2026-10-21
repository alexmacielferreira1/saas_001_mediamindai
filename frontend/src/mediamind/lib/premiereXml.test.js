import { describe, expect, it } from 'vitest';
import { gerarXmlPremiere, gerarXmlPremiereClip, resolveRate } from './premiereXml';

describe('resolveRate', () => {
  it('maps NTSC rates to integer timebase with the NTSC flag', () => {
    expect(resolveRate(29.97)).toMatchObject({ timebase: 30, ntsc: true });
    expect(resolveRate(29.97).fps).toBeCloseTo(30000 / 1001, 6);
    expect(resolveRate(23.976)).toMatchObject({ timebase: 24, ntsc: true });
    expect(resolveRate(59.94)).toMatchObject({ timebase: 60, ntsc: true });
  });

  it('keeps integer rates and falls back to 25 fps only when absent or invalid', () => {
    expect(resolveRate(30)).toEqual({ timebase: 30, ntsc: false, fps: 30 });
    expect(resolveRate(50)).toEqual({ timebase: 50, ntsc: false, fps: 50 });
    expect(resolveRate(undefined)).toEqual({ timebase: 25, ntsc: false, fps: 25 });
    expect(resolveRate('abc')).toEqual({ timebase: 25, ntsc: false, fps: 25 });
  });
});

describe('gerarXmlPremiere', () => {
  it('uses the media fps, resolution and duration instead of fixed 25 fps / 1080p', () => {
    const xml = gerarXmlPremiere({ titulo: 'EP 1', materiais: [{ nome: 'cam1.mov', fps: 29.97, width: 3840, height: 2160, duracao: 10 }] });
    expect(xml).toContain('<timebase>30</timebase><ntsc>TRUE</ntsc>');
    expect(xml).toContain('<width>3840</width><height>2160</height>');
    expect(xml).not.toContain('<timebase>25</timebase>');
    expect(xml).not.toContain('<width>1920</width>');
    // 10 s em 29.97 = 300 quadros (arredondado).
    expect(xml).toContain('<out>300</out>');
  });

  it('prefers the project rate for the sequence and lays clips one after another', () => {
    const xml = gerarXmlPremiere({ titulo: 'Seq', fps: 50, width: 1280, height: 720, materiais: [{ nome: 'a.mp4', duracao: 2 }, { nome: 'b.mp4', duracao: 1 }] });
    expect(xml).toMatch(/<sequence id="seq-1">\s*<name>Seq<\/name>\s*<rate><timebase>50<\/timebase><ntsc>FALSE<\/ntsc><\/rate>/);
    expect(xml).toContain('<width>1280</width><height>720</height>');
    expect(xml).toMatch(/<clipitem id="clip-2">[\s\S]*?<start>100<\/start>\s*<end>150<\/end>/);
  });

  it('keeps the documented defaults when nothing is known about the media', () => {
    const xml = gerarXmlPremiere({ titulo: 'X', materiais: [{ nome: 'a&b.mp4' }] });
    expect(xml).toContain('<timebase>25</timebase><ntsc>FALSE</ntsc>');
    expect(xml).toContain('<width>1920</width><height>1080</height>');
    expect(xml).toContain('<out>3600</out>');
    expect(xml).toContain('a&amp;b.mp4');
  });
});

describe('gerarXmlPremiereClip', () => {
  it('computes IN/OUT frames and timecode at the source rate', () => {
    const xml = gerarXmlPremiereClip({ titulo: 'Corte', source_url: 'http://x/master.mp4', in_ms: 10000, out_ms: 20000, source_fps: 29.97, source_width: 1080, source_height: 1920 });
    expect(xml).toContain('<timebase>30</timebase><ntsc>TRUE</ntsc>');
    expect(xml).toContain('<width>1080</width><height>1920</height>');
    expect(xml).toContain('<in>300</in>');
    expect(xml).toContain('<out>599</out>');
    expect(xml).toContain('<string>00:00:10:00</string>');
  });

  it('accepts explicit options and falls back to 25 fps', () => {
    expect(gerarXmlPremiereClip({ in_ms: 0, out_ms: 1000 }, { fps: 24 })).toContain('<timebase>24</timebase><ntsc>FALSE</ntsc>');
    const fallback = gerarXmlPremiereClip({ in_ms: 0, out_ms: 1000 });
    expect(fallback).toContain('<timebase>25</timebase>');
    expect(fallback).toContain('<out>25</out>');
  });
});
