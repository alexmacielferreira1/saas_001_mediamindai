import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextDetailLayout, SelectableItem, UnavailableAction } from './ContextDetailLayout';

describe('ContextDetailLayout', () => {
  it('keeps_master_visible_when_detail_fails', () => {
    render(
      <ContextDetailLayout
        master={<div>Lista de usuários</div>}
        detail={<div role="alert">Não foi possível carregar o detalhe.</div>}
        detailTitle="Detalhe do usuário"
        isOpen
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Lista de usuários')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o detalhe.');
  });

  it('marks_selected_item_for_assistive_technology', () => {
    render(<SelectableItem selected onSelect={() => {}}>Perfil Editor</SelectableItem>);

    expect(screen.getByRole('button', { name: 'Perfil Editor' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('restores_focus_when_mobile_detail_closes', () => {
    const originRef = createRef();
    const onClose = vi.fn();
    render(
      <>
        <button ref={originRef} type="button">Usuário selecionado</button>
        <ContextDetailLayout
          master={<div>Lista</div>}
          detail={<div>Conteúdo</div>}
          detailTitle="Detalhe"
          isOpen
          onClose={onClose}
          originRef={originRef}
        />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(originRef.current).toHaveFocus();
  });

  it('disables_unavailable_action_with_visible_reason', () => {
    render(<UnavailableAction reason="A integração ainda não possui endpoint.">Criar integração</UnavailableAction>);

    expect(screen.getByRole('button', { name: 'Criar integração' })).toBeDisabled();
    expect(screen.getByText('A integração ainda não possui endpoint.')).toBeVisible();
  });
});
