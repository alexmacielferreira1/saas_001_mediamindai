import { describe, expect, it } from 'vitest';

import {
  CAROUSEL_SCHEMA_VERSION,
  carouselExportName,
  createCarouselDocument,
  parseCarouselImport,
  reorderCarouselSlides,
  validateCarouselDocument,
} from './carouselDocument';

describe('carouselDocument', () => {
  it('creates an independent empty draft without invented project content', () => {
    const draft = createCarouselDocument();

    expect(draft).toMatchObject({
      schema_version: 1,
      project_id: null,
      title: 'Carrossel sem título',
      format: '4:5',
      requested_slide_count: 8,
      slides: [],
      caption: '',
      hashtags: [],
      references: [],
    });
    expect(draft.id).toEqual(expect.any(String));
    expect(CAROUSEL_SCHEMA_VERSION).toBe(1);
  });

  it('inherits only explicit project context and keeps source references', () => {
    const project = { id: 'project-7', titulo: 'Saúde em pauta', programa: 'Vida', roteiro: 'Texto-base' };
    const draft = createCarouselDocument({ project });

    expect(draft.project_id).toBe('project-7');
    expect(draft.title).toBe('Saúde em pauta');
    expect(draft.briefing.source).toBe('project');
    expect(draft.references).toEqual([{ type: 'project', id: 'project-7', label: 'Saúde em pauta' }]);
    expect(draft).not.toHaveProperty('roteiro');
  });

  it('imports cover, content and cta while converting emphasis into structured runs', () => {
    const current = createCarouselDocument();
    const raw = JSON.stringify({
      tema: 'Organização do acervo',
      slides: [
        { tipo: 'capa', titulo: 'Seu *acervo* está seguro?', texto: '', badge: 'Guia' },
        { tipo: 'conteudo', titulo: 'Organize', texto: 'Comece pelo *inventário*.' },
        { tipo: 'cta', titulo: 'Salve este post', texto: 'Compartilhe com a equipe.', acao: 'Salvar' },
      ],
      legenda: 'Organize hoje.',
      hashtags: ['#acervo', 'mediamind'],
    });

    const { document, warnings } = parseCarouselImport(raw, current);

    expect(warnings).toEqual(['Foram importados 3 slides; o briefing solicita 8.']);
    expect(document.title).toBe('Organização do acervo');
    expect(document.slides.map((slide) => slide.type)).toEqual(['cover', 'content', 'cta']);
    expect(document.slides[0].title_runs).toEqual([
      { text: 'Seu ', emphasis: false },
      { text: 'acervo', emphasis: true },
      { text: ' está seguro?', emphasis: false },
    ]);
    expect(document.slides[1].body_runs).toEqual([
      { text: 'Comece pelo ', emphasis: false },
      { text: 'inventário', emphasis: true },
      { text: '.', emphasis: false },
    ]);
    expect(document.hashtags).toEqual(['#acervo', '#mediamind']);
  });

  it.each([
    ['invalid JSON', '{', 'JSON inválido'],
    ['unknown root field', JSON.stringify({ slides: [], segredo: true }), 'Campo não reconhecido: segredo'],
    ['unknown slide type', JSON.stringify({ slides: [{ tipo: 'enquete', titulo: 'X', texto: 'Y' }] }), 'Tipo de slide não reconhecido: enquete'],
  ])('rejects %s without mutating the current document', (_label, raw, message) => {
    const current = createCarouselDocument();
    const snapshot = structuredClone(current);

    expect(() => parseCarouselImport(raw, current)).toThrow(message);
    expect(current).toEqual(snapshot);
  });

  it('reports invalid formats and missing slide fields with precise paths', () => {
    const draft = createCarouselDocument();
    draft.format = 'story';
    draft.slides = [{ id: 's1', type: 'content', title: '', body: '' }];

    expect(validateCarouselDocument(draft)).toEqual([
      { path: 'format', message: 'Formato deve ser 4:5 ou 1:1.' },
      { path: 'slides[0].title', message: 'Título do slide é obrigatório.' },
    ]);
  });

  it('reorders slides without mutating the original document', () => {
    const draft = createCarouselDocument();
    draft.slides = [
      { id: 'a', type: 'cover', title: 'A' },
      { id: 'b', type: 'content', title: 'B' },
      { id: 'c', type: 'cta', title: 'C' },
    ];

    const reordered = reorderCarouselSlides(draft, 2, 0);

    expect(reordered.slides.map((slide) => slide.id)).toEqual(['c', 'a', 'b']);
    expect(draft.slides.map((slide) => slide.id)).toEqual(['a', 'b', 'c']);
  });

  it('builds stable sanitized export names', () => {
    expect(carouselExportName(0, { type: 'cover', title: 'Olá, Saúde!' })).toBe('01-capa.png');
    expect(carouselExportName(11, { type: 'content', title: 'Ação & prevenção' })).toBe('12-acao-prevencao.png');
  });
});
