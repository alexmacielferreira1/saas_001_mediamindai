import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createThumbnailDraft } from '../../lib/thumbnailStudio';
import ThumbnailTools from './ThumbnailTools';

describe('ThumbnailTools', () => {
  it('uses horizontal bars for portrait framing', () => {
    const onPersonChange = vi.fn();
    const draft = createThumbnailDraft();
    draft.people = [{ id: 'person-1', name: 'Convidada', visible: true, photo: 'blob:portrait', zoom: 1, offsetX: 0, offsetY: 0 }];

    render(<ThumbnailTools
      draft={draft}
      format="horizontal"
      setFormat={vi.fn()}
      selectedLayer="person:person-1"
      onSelect={vi.fn()}
      onLayoutChange={vi.fn()}
      onStyleChange={vi.fn()}
      onColorsChange={vi.fn()}
      onPersonChange={onPersonChange}
      onRestore={vi.fn()}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onSaveProjectStyle={vi.fn()}
      onLogoUpload={vi.fn()}
    />);

    const sizeBar = screen.getByLabelText('Tamanho da pessoa');
    expect(sizeBar).toHaveAttribute('type', 'range');
    fireEvent.change(sizeBar, { target: { value: '1.8' } });
    expect(onPersonChange).toHaveBeenCalledWith('person-1', { zoom: 1.8 });
    expect(screen.getByLabelText('Mover horizontalmente')).toHaveAttribute('type', 'range');
    expect(screen.getByLabelText('Mover verticalmente')).toHaveAttribute('type', 'range');
  });
});
