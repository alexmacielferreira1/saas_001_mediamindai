import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DraggableStageCard, StageDragArea } from './StageDragList';

describe('stage movement controls', () => {
  it('offers accessible previous and next actions', async () => {
    const onMove = vi.fn().mockResolvedValue({ ok: true, project: { etapa: 'aguardando_aprovacao' } });
    render(<StageDragArea onMove={onMove}><DraggableStageCard id="p1" etapa="em_edicao">Projeto</DraggableStageCard></StageDragArea>);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para Aguardando aprovação' }));
    expect(onMove).toHaveBeenCalledWith('p1', 1);
    expect(screen.getByRole('button', { name: 'Voltar para Material para editar' })).toBeEnabled();
  });
});
