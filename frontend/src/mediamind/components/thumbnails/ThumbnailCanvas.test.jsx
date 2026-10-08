import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createThumbnailDraft } from '../../lib/thumbnailStudio';
import ThumbnailCanvas from './ThumbnailCanvas';

describe('SIMERS thumbnail composition', () => {
  it('renders the approved institutional structure instead of a generic badge layout', () => {
    const draft = createThumbnailDraft({
      id: 50,
      programa: 'Prontuário Jurídico',
      episodio: '50',
      titulo: 'Novas escolas e a qualidade',
      headline: 'NOVAS ESCOLAS: E A QUALIDADE?',
      convidado_nome: 'Gabriel Larré',
    });
    draft.people[0].photo = '/gabriel.png';

    render(<ThumbnailCanvas draft={draft} format="horizontal" />);

    expect(screen.getByRole('img', { name: 'Canal Simers' })).toHaveAttribute('src', '/brand/canal-simers-white.png');
    expect(screen.getByText('Prontuário Jurídico')).toBeInTheDocument();
    expect(screen.getByText('PRONTUÁRIO JURÍDICO • EP. 050')).toBeInTheDocument();
    expect(screen.getByTestId('simers-wave-pattern')).toBeInTheDocument();
    expect(screen.getByAltText('Gabriel Larré').style.filter).toContain('grayscale(1)');
    expect(screen.getByAltText('Gabriel Larré')).toHaveAttribute('data-cutout-style', 'white-outline');
  });

  it('uses the approved lime portrait outline for Ética na Mesa', () => {
    const draft = createThumbnailDraft({ programa: 'Ética na Mesa', convidado_nome: 'Convidada' });
    draft.people[0].photo = '/pessoa.png';
    render(<ThumbnailCanvas draft={draft} format="horizontal" />);
    expect(screen.getByAltText('Convidada')).toHaveAttribute('data-cutout-style', 'lime-outline');
    expect(screen.getByAltText('Convidada').style.filter).toContain('#C8E65B');
  });
});
