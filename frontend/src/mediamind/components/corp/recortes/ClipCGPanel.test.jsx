import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClipCGPanel from './ClipCGPanel';

describe('camadas de texto', () => {
  it('changes the time range and order of existing layers', () => {
    const cgs = [
      { id: 'one', tipo: 'titulo', titulo: 'Primeira', start_ms: 0, end_ms: 4000 },
      { id: 'two', tipo: 'credito', titulo: 'Segunda', start_ms: 1000, end_ms: 5000 },
    ];
    const onChange = vi.fn();
    render(<ClipCGPanel clip={{ id: 'layer-test', in_ms: 0, cgs }} onChange={onChange} seekTo={vi.fn()} onAvancar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Início da camada Primeira (ms)'), { target: { value: '500' } });
    expect(onChange).toHaveBeenLastCalledWith({ cgs: [{ ...cgs[0], start_ms: 500 }, cgs[1]] });
    fireEvent.click(screen.getByRole('button', { name: 'Mover camada Segunda para cima' }));
    expect(onChange).toHaveBeenLastCalledWith({ cgs: [cgs[1], cgs[0]] });
  });
});
