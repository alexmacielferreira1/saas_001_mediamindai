import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Historico2 } from './GestaoAcessos2';

const PEOPLE = [{ id: 'gestor-1', name: 'Gestora Ana' }, { id: 'u-7', name: 'Bruno Editor' }];

const NEW_ENTRY = {
  id: 'aud-new-1', action: 'membership.role_changed', entity_type: 'Membership', entity_id: 'm-1', user_id: 'gestor-1',
  details: {}, before: { role: 'editor' }, after: { role: 'reporter' }, reason: 'Troca de equipe',
  actor_role: 'admin', correlation_id: 'corr-42', target_user_id: 'u-7', created_date: '2026-10-20T13:00:00+00:00',
};
const LEGACY_ENTRY = {
  id: 'aud-old-1', action: 'user.suspended', entity_type: 'User', entity_id: 'u-7', user_id: 'gestor-1',
  details: { reason: 'Saiu da empresa' }, created_date: '2026-10-19T13:00:00+00:00',
};

function renderHistory(audit) {
  return render(<MemoryRouter><Historico2 audit={audit} people={PEOPLE} errors={{}} /></MemoryRouter>);
}

function detailValue(label) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling.textContent;
}

describe('Historico2 — detalhes da auditoria', () => {
  it('mostra antes/depois/motivo/cargo/correlação e o alvo pelo target_user_id', () => {
    renderHistory([NEW_ENTRY, LEGACY_ENTRY]);

    expect(detailValue('Antes')).toBe('role: editor');
    expect(detailValue('Depois')).toBe('role: reporter');
    expect(detailValue('Motivo')).toBe('Troca de equipe');
    expect(detailValue('Cargo do responsável')).toBe('admin');
    expect(detailValue('Correlação')).toBe('corr-42');
    expect(detailValue('Alvo')).toBe('Bruno Editor');
    expect(screen.queryByText(/Valores anteriores e novos não foram registrados/)).toBeNull();
  });

  it('mantém registros antigos legíveis (motivo em details) e avisa sem valores', () => {
    renderHistory([NEW_ENTRY, LEGACY_ENTRY]);
    fireEvent.click(screen.getAllByRole('button', { name: /suspended|Suspendeu/i })[0]);

    expect(detailValue('Motivo')).toBe('Saiu da empresa');
    expect(screen.queryByText('Antes', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('Correlação', { selector: 'dt' })).toBeNull();
    expect(screen.getByText('Valores anteriores e novos não foram registrados nesta entrada.')).toBeInTheDocument();
  });

  it('usa "Não informado" quando não há motivo', () => {
    renderHistory([{ ...LEGACY_ENTRY, details: {} }]);
    expect(detailValue('Motivo')).toBe('Não informado');
  });
});
