import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Workspace2 from './Workspace2';

describe('Workspace 2 flow', () => {
  it('opens in search and navigates through script and timeline', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Workspace 2' })).toBeInTheDocument();
    expect(screen.getByTestId('workspace2-search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Travar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2\s*roteiro/i }));
    expect(screen.getByTestId('workspace2-script')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /3\s*timeline/i }));
    expect(screen.getByTestId('workspace2-timeline')).toBeInTheDocument();
  });

  it('saves and resets the local Workspace 2 draft', () => {
    localStorage.clear();
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar projeto' }));
    expect(localStorage.getItem('mm_workspace2_draft')).toContain('selectedIds');
    expect(screen.getByRole('status')).toHaveTextContent(/salvo localmente/i);
    fireEvent.click(screen.getByRole('button', { name: 'Resetar projeto' }));
    expect(screen.getByRole('status')).toHaveTextContent(/restaurado/i);
  });
});
