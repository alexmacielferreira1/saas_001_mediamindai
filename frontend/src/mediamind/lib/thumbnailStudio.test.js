import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COLORS,
  SIMERS_PRESETS,
  SIMERS_PROGRAMS,
  createThumbnailDraft,
  formatEpisode,
  suggestHighlight,
  validateSimersDraft,
} from './thumbnailStudio';

describe('thumbnail studio model', () => {
  it('applies the official Sala de Prescrição colors without inventing values', () => {
    expect(SIMERS_PRESETS['Sala de Prescrição']).toEqual({
      background: '#B4CC00', text: '#003C35', accent: '#003C35', defined: true,
    });
    expect(SIMERS_PRESETS['No Front']).toMatchObject({ background: '#14AE72', text: '#FFFFFF', accent: '#063236', defined: true });
    expect(SIMERS_PRESETS['Solidariza+']).not.toHaveProperty('accent');
  });

  it('exposes the ten approved SIMERS presets', () => {
    expect(SIMERS_PROGRAMS).toEqual([
      'Prontuário Jurídico', 'Fronteiras da Saúde', 'Sala de Prescrição', 'Pediatrando',
      'Plantão do Rock', 'Ética na Mesa', 'Anamnese', 'Solidariza+',
      'Corações e Mentes', 'No Front',
    ]);
    expect(SIMERS_PRESETS).not.toHaveProperty('Pediatricos');
    expect(SIMERS_PRESETS).not.toHaveProperty('Minuto Simers');
    expect(SIMERS_PRESETS['Corações e Mentes']).toEqual({
      background: '#A11055', text: '#FFFFFF', defined: true,
    });
    expect(SIMERS_PRESETS['No Front']).toEqual({
      background: '#14AE72', text: '#FFFFFF', accent: '#063236', defined: true,
    });
  });

  it('does not lend the Anamnese blue palette to an unknown program', () => {
    expect(createThumbnailDraft({ programa: 'Programa sem padrão' }).colors).toEqual(DEFAULT_COLORS);
  });

  it('creates an editable draft from real production fields without mutating the source', () => {
    const source = {
      id: 54,
      programa: 'Sala de Prescrição',
      episodio: 'EP054',
      titulo: 'A trajetória do Preto na medicina',
      descricao: 'Contexto editorial',
      pauta: 'Resumo do roteiro',
      convidado_nome: 'Dr. Paulo Souza',
      convidado_cg: 'Médico — USP',
      apresentadores: [{ nome: 'Dra. Ana Ribeiro', cg: 'Apresentadora' }],
    };

    const draft = createThumbnailDraft(source);
    draft.title = 'Título local alterado';
    draft.people[0].showName = false;

    expect(source.titulo).toBe('A trajetória do Preto na medicina');
    expect(source.apresentadores[0]).toEqual({ nome: 'Dra. Ana Ribeiro', cg: 'Apresentadora' });
    expect(draft).toMatchObject({
      projectId: '54',
      program: 'Sala de Prescrição',
      episode: 'EP054',
      description: 'Contexto editorial',
      planning: 'Resumo do roteiro',
    });
    expect(draft.people.map((person) => person.name)).toEqual(['Dra. Ana Ribeiro', 'Dr. Paulo Souza']);
    expect(draft.people[0].showName).toBe(false);
    expect(draft.people[1].showName).toBe(true);
  });

  it('creates a local highlight and validates missing content', () => {
    expect(suggestHighlight({ title: 'Telemedicina: o futuro chegou?', description: '' }))
      .toBe('TELEMEDICINA: O FUTURO CHEGOU?');
    expect(validateSimersDraft({ program: '', title: '', people: [] })).toEqual([
      'Selecione ou informe um programa.',
      'Informe o título principal.',
    ]);
  });

  it('formats episode identifiers with the required three digits', () => {
    expect(formatEpisode('50')).toBe('EP. 050');
    expect(formatEpisode('EP054')).toBe('EP. 054');
    expect(formatEpisode('')).toBe('');
  });
});
