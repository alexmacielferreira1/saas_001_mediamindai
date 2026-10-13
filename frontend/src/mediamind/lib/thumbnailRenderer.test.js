import { describe, expect, it } from 'vitest';
import { calculateImagePlacement, thumbnailLayers } from './thumbnailRenderer';

describe('thumbnail portrait placement', () => {
  it('keeps the complete cutout and scales it without cropping the source', () => {
    expect(calculateImagePlacement(
      { width: 1000, height: 2200 },
      { w: 600, h: 800 },
      { zoom: 1, offsetX: 0, offsetY: 0 },
    )).toEqual({ sourceX: 0, sourceY: 0, sourceWidth: 1000, sourceHeight: 2200, x: 118, y: 0, width: 364, height: 800 });
  });

  it('allows moving and reducing the complete cutout', () => {
    expect(calculateImagePlacement(
      { width: 1000, height: 2000 },
      { w: 600, h: 800 },
      { zoom: 0.5, offsetX: -20, offsetY: 25 },
    )).toEqual({ sourceX: 0, sourceY: 0, sourceWidth: 1000, sourceHeight: 2000, x: 80, y: 600, width: 200, height: 400 });
  });
});

describe('program identity layers', () => {
  it('keeps a visible editable program title when no logo file exists', () => {
    const layers = thumbnailLayers({
      pieceType: 'thumb', program: 'Pediatrando', programLogo: '', channelLogo: '',
      people: [], layouts: {}, highlight: 'Intestino e cérebro: qual a relação?',
    }, 'horizontal');

    expect(layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'program', type: 'program-title', label: 'Nome do programa' }),
    ]));
  });

  it('uses the official image layer when the program logo exists', () => {
    const layers = thumbnailLayers({
      pieceType: 'thumb', program: 'Anamnese', programLogo: '/brand/programs/Anamnese.png', channelLogo: '',
      people: [], layouts: {}, highlight: 'Ciência, ensino e inovação',
    }, 'vertical');

    expect(layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'program', type: 'image', url: '/brand/programs/Anamnese.png' }),
    ]));
  });
});

describe('creative art composition', () => {
  it('uses editable art layers instead of the old thumb or a flattened reference image', () => {
    const layers = thumbnailLayers({
      pieceType: 'single',
      program: '',
      people: [],
      layouts: {},
      highlight: 'Título editável',
      title: '',
      description: 'Texto editável',
      artReferenceUrl: '/reference/arte-unica-lima.png',
    }, 'vertical');

    expect(layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'art-photo', type: 'art-background', url: '/reference/arte-unica-lima.png' }),
      expect.objectContaining({ id: 'headline', type: 'text' }),
      expect.objectContaining({ id: 'body', type: 'text' }),
    ]));
    expect(layers.some((layer) => ['template', 'program', 'meta'].includes(layer.id))).toBe(false);
  });

  it('keeps carousel pages in the creative renderer instead of thumb layers', () => {
    const layers = thumbnailLayers({
      pieceType: 'carousel', program: '', people: [], layouts: {},
      highlight: 'Giro de notícias da semana', title: '', description: '03 a 09 de outubro',
    }, 'vertical');

    expect(layers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'headline', type: 'text', y: 14 }),
      expect.objectContaining({ id: 'body', type: 'text', y: 62 }),
      expect.objectContaining({ id: 'channel', type: 'simers-wordmark', label: 'Logo SIMERS' }),
    ]));
    expect(layers.some((layer) => ['program', 'meta'].includes(layer.id))).toBe(false);
  });
});
