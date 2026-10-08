import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Workspace2Create from './Workspace2Create';

const selectedMedia = [{ id: 1, title: 'Entrevista Prefeito', icon: '🎙️', duration: 90 }];

describe('Workspace 2 creation choices', () => {
  it('organizes creation in three columns with three compact categories', () => {
    render(<Workspace2Create selectedAssets={selectedMedia} selectedIds={[1]} showSearch={false} showPreview={false} />);

    expect(screen.getByRole('region', { name: 'Tipos de criação' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roteiro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modelo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rascunho' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Opções de Roteiro' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Informações do roteiro' })).toBeInTheDocument();
    expect(screen.queryByText(/Mídias selecionadas/i)).not.toBeInTheDocument();
  });

  it('shows new and existing choices for each category, including scheduling template', () => {
    render(<Workspace2Create selectedAssets={selectedMedia} selectedIds={[1]} showSearch={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modelo' }));
    expect(screen.getByRole('button', { name: 'Novo modelo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modelos existentes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roteiro de agendamento' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rascunho' }));
    expect(screen.getByRole('button', { name: 'Novo rascunho' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rascunhos existentes' })).toBeInTheDocument();
    expect(screen.getByLabelText('Título do roteiro')).toBeInTheDocument();
  });
});
