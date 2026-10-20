import { describe, expect, it } from 'vitest';
import {
  applyCaptionText, buildCaptionsFromWords, buildClipRenderOptions, captionIssues, captionsToSrt, captionsToVtt,
  mergeCaptions, parseSubtitles, splitCaption, transcriptWordsFromCandidates, wrapCaptionText,
} from './captionTools';

const words = [
  { text: 'A', start_ms: 0, end_ms: 300 },
  { text: 'vacinação', start_ms: 300, end_ms: 900 },
  { text: 'protege', start_ms: 900, end_ms: 1400 },
  { text: 'toda', start_ms: 2500, end_ms: 2800 },
  { text: 'comunidade', start_ms: 2800, end_ms: 3500 },
];

describe('captionTools', () => {
  it('wraps by characters and keeps manual line breaks', () => {
    expect(wrapCaptionText('um dois tres quatro cinco', 9)).toEqual(['um dois', 'tres', 'quatro', 'cinco']);
    expect(wrapCaptionText('linha um\nlinha dois', 40)).toEqual(['linha um', 'linha dois']);
  });

  it('builds captions only from real timed words and breaks on pauses', () => {
    const cues = buildCaptionsFromWords(words, { maxWords: 6, pauseMs: 700 });
    expect(cues.map((cue) => cue.texto)).toEqual(['A vacinação protege', 'toda comunidade']);
    expect(cues[0]).toMatchObject({ start_ms: 0, end_ms: 1400, origem: 'transcricao' });
    expect(cues[1].palavras).toHaveLength(2);
  });

  it('reads backend evidence in seconds, limited to IN/OUT and without duplicates', () => {
    const evidence = [{ text: 'Oi', start: 1, end: 1.5 }, { text: 'fora', start: 9, end: 9.5 }];
    expect(transcriptWordsFromCandidates([{ evidence }, { evidence }], 0, 5000)).toEqual([{ text: 'Oi', start_ms: 1000, end_ms: 1500 }]);
  });

  it('splits text between halves instead of duplicating it', () => {
    const [left, right] = splitCaption({ id: 'a', start_ms: 0, end_ms: 4000, texto: 'um dois tres quatro' }, undefined, 'b');
    expect(left).toMatchObject({ end_ms: 2000, texto: 'um dois' });
    expect(right).toMatchObject({ id: 'b', start_ms: 2000, texto: 'tres quatro' });
    const cue = buildCaptionsFromWords(words.slice(0, 3))[0];
    const [first, second] = splitCaption(cue, 950, 'c');
    expect(first.texto).toBe('A vacinação');
    expect(second).toMatchObject({ start_ms: 900, texto: 'protege' });
  });

  it('merges neighbours and keeps word timing only when both have it', () => {
    const merged = mergeCaptions({ id: 'a', start_ms: 0, end_ms: 1000, texto: 'Olá', palavras: [words[0]] }, { id: 'b', start_ms: 1000, end_ms: 2000, texto: 'mundo', palavras: [] });
    expect(merged).toMatchObject({ id: 'a', start_ms: 0, end_ms: 2000, texto: 'Olá mundo', palavras: [] });
  });

  it('keeps word timing on text edits only when the word count is unchanged', () => {
    const cue = buildCaptionsFromWords(words.slice(0, 3))[0];
    expect(applyCaptionText(cue, 'A vacina protege').palavras.map((w) => w.text)).toEqual(['A', 'vacina', 'protege']);
    expect(applyCaptionText(cue, 'Vacina protege').palavras).toEqual([]);
  });

  it('reports timing, overlap, reading speed and vertical safe-area issues', () => {
    const issues = captionIssues([
      { id: 'a', start_ms: 0, end_ms: 1000, texto: 'texto muito longo para ser lido em apenas um segundo' },
      { id: 'b', start_ms: 900, end_ms: 800, texto: 'x' },
    ], { inMs: 0, outMs: 5000, format: '9:16' });
    const kinds = issues.map((issue) => issue.tipo);
    expect(kinds).toEqual(expect.arrayContaining(['tempo', 'sobreposicao', 'leitura', 'area-segura']));
  });

  it('exports SRT and VTT relative to IN and imports them back', () => {
    const captions = [{ id: 'a', start_ms: 11000, end_ms: 13500, texto: 'Olá mundo', posicao: 'top' }];
    const srt = captionsToSrt(captions, { inMs: 10000 });
    expect(srt).toBe('1\n00:00:01,000 --> 00:00:03,500\nOlá mundo');
    const vtt = captionsToVtt(captions, { inMs: 10000 });
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:01.000 --> 00:00:03.500 line:10%');
    expect(parseSubtitles(srt, { inMs: 10000 })[0]).toMatchObject({ start_ms: 11000, end_ms: 13500, texto: 'Olá mundo', origem: 'importada' });
    expect(parseSubtitles(vtt, { inMs: 10000 })[0]).toMatchObject({ start_ms: 11000, end_ms: 13500 });
    expect(() => parseSubtitles('nada aqui')).toThrow(/Nenhuma legenda/);
  });

  it('adds emojis only when requested', () => {
    expect(captionsToSrt([{ start_ms: 0, end_ms: 1000, texto: 'dica de dinheiro' }], { settings: { emojis: true } })).toContain('dica 👉 de dinheiro 💰');
  });

  it('builds render options only for requested features, relative to IN', () => {
    expect(buildClipRenderOptions({ in_ms: 0, out_ms: 5000, legendas: [] })).toBeNull();
    const clip = {
      in_ms: 10000, out_ms: 20000, reenquadramento: 'fill', foco_x: 0.3, legenda_estilo: 'karaoke',
      legenda_config: { keywords: 'Vacina, saúde', maxChars: 20 },
      legendas: [
        { start_ms: 11000, end_ms: 12000, texto: 'Vacina salva', posicao: 'center', palavras: [{ text: 'Vacina', start_ms: 11000, end_ms: 11500 }, { text: 'salva', start_ms: 11500, end_ms: 12000 }] },
        { start_ms: 30000, end_ms: 31000, texto: 'fora do corte' },
        { start_ms: 12000, end_ms: 12500, texto: '   ' },
      ],
      cgs: [{ tipo: 'titulo', titulo: 'Gancho', start_ms: 10000, end_ms: 13000 }, { tipo: 'imagem', titulo: 'logo', start_ms: 10000, end_ms: 13000 }],
      cortes_video: [{ start_ms: 15000, end_ms: 16000 }],
    };
    const options = buildClipRenderOptions(clip, { aspect: '9:16', burnCaptions: true, burnTitles: true, applyCuts: true });
    expect(options).toMatchObject({
      aspect: '9:16', fit: 'fill', focus_x: 0.3,
      captions: [{ start: 1, end: 2, text: 'Vacina salva', position: 'center', words: [{ text: 'Vacina', start: 1, end: 1.5 }, { text: 'salva', start: 1.5, end: 2 }] }],
      titles: [{ start: 0, end: 3, text: 'Gancho' }],
      skip: [{ start: 5, end: 6 }],
    });
    expect(options.caption_style).toMatchObject({ karaoke: true, uppercase: true, max_chars: 20, keywords: ['vacina', 'saúde'] });
  });
});
