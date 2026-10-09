import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ClipNetworkFormatsPanel from './ClipNetworkFormatsPanel';

describe('ClipNetworkFormatsPanel', () => {
  it('stores channel and editorial changes before final review', () => {
    const onChange = vi.fn();
    const onProsseguir = vi.fn();
    render(<ClipNetworkFormatsPanel clip={{ titulo: 'Corte teste', networks: ['youtube'] }} onChange={onChange} onProsseguir={onProsseguir} />);

    fireEvent.click(screen.getByRole('button', { name: /instagram/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ networks: ['youtube', 'instagram'] }));
    fireEvent.click(screen.getByRole('button', { name: /avançar para revisão final/i }));
    expect(onProsseguir).toHaveBeenCalled();
  });
});
