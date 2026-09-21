import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RoteiroMediaSelector from './RoteiroMediaSelector';

describe('RoteiroMediaSelector', () => {
  it('confirms the selected time range instead of adding the whole media', () => {
    const onConfirm = vi.fn();
    render(<RoteiroMediaSelector asset={{ id: 7, title: 'Mobilidade urbana', duration: 501 }} onCancel={() => {}} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Deixa inicial'), { target: { value: '00:01:14' } });
    fireEvent.change(screen.getByLabelText('Deixa final'), { target: { value: '00:01:42' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao roteiro/i }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      id: 7,
      clipIn: '00:01:14',
      clipOut: '00:01:42',
    }));
  });
});
