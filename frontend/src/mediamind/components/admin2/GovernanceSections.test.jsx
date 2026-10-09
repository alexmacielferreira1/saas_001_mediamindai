import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormsSection, ImportsSection, RecordsSection, RegistrySection, SecuritySection } from './GovernanceSections';

describe('GovernanceSections', () => {
  it('changes_form_schema_in_the_same_screen', () => {
    render(<FormsSection />);
    fireEvent.click(screen.getByRole('button', { name: /Autorização de imagem/i }));
    expect(screen.getByRole('heading', { name: 'Autorização de imagem' })).toBeVisible();
    expect(screen.getByLabelText('Uso autorizado')).toBeDisabled();
    expect(screen.queryByLabelText('Empresa')).not.toBeInTheDocument();
  });

  it('opens_import_error_detail_without_hiding_the_preview', () => {
    render(<ImportsSection />);
    fireEvent.click(screen.getByRole('button', { name: /Inspecionar erro da linha 12/i }));
    expect(screen.getByText('usuarios_setembro.xlsx')).toBeVisible();
    expect(screen.getAllByRole('heading', { name: 'Erro da linha 12' })[0]).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nova importação' })).toBeDisabled();
  });

  it('inspects_security_rules_without_fake_mutation', () => {
    render(<SecuritySection users={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Bloqueio por tentativas/i }));
    expect(screen.getAllByRole('heading', { name: 'Bloqueio por tentativas' })[0]).toBeVisible();
    expect(screen.getByRole('button', { name: 'Alterar política' })).toBeDisabled();
  });

  it('navigates_registry_hierarchy_locally', () => {
    render(<RegistrySection />);
    fireEvent.click(screen.getByRole('button', { name: 'Administração' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tela Usuários' }));
    expect(screen.getAllByRole('heading', { name: 'Usuários' })[0]).toBeVisible();
    expect(screen.getByText('Lista e detalhe contextual')).toBeVisible();
  });

  it('opens_record_fields_and_keeps_honest_empty_state', () => {
    render(<RecordsSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Definição de formulário' }));
    expect(screen.getAllByRole('heading', { name: 'Campos de Definição de formulário' })[0]).toBeVisible();
    expect(screen.getByText(/catálogo ainda não possui registros persistidos/i)).toBeVisible();
  });
});
