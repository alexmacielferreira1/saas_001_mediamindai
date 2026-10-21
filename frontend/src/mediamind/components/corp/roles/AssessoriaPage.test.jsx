import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../api/httpClient';

const { hookState } = vi.hoisted(() => ({ hookState: { current: null } }));

vi.mock('../../../lib/corpAssessoria', () => ({ useAssessoria: () => hookState.current }));
vi.mock('../RoleInicio', () => ({ default: () => <div>Início da assessoria</div> }));
vi.mock('../PendenciasHub', () => ({ default: () => null }));

import AssessoriaPage from './AssessoriaPage';

const base = { releases: [], clippings: [], jornalistas: [], mencoes: [], loading: false, error: null, forbidden: false, reload: vi.fn() };

describe('AssessoriaPage', () => {
  beforeEach(() => { hookState.current = { ...base }; });

  it('mostra "Sem acesso a esta área" com a mensagem do servidor no 403', () => {
    hookState.current = {
      ...base,
      forbidden: true,
      error: new ApiError({ status: 403, code: 'SCREEN_ACCESS_DENIED', message: 'Esta tela não está liberada para você.' }),
    };
    render(<AssessoriaPage />);
    expect(screen.getByText('Sem acesso a esta área')).toBeInTheDocument();
    expect(screen.getByText('Esta tela não está liberada para você.')).toBeInTheDocument();
    expect(screen.queryByText('Início da assessoria')).toBeNull();
    expect(screen.queryByText('Não foi possível sincronizar todos os dados da assessoria.')).toBeNull();
  });

  it('usa texto padrão quando o 403 não traz código conhecido', () => {
    hookState.current = { ...base, forbidden: true, error: new ApiError({ status: 403, code: 'PERMISSION_DENIED', message: 'x' }) };
    render(<AssessoriaPage />);
    expect(screen.getByText('O acesso à Assessoria não está liberado para você nesta empresa.')).toBeInTheDocument();
  });

  it('mantém o aviso de sincronização para falhas comuns', () => {
    hookState.current = { ...base, error: new Error('offline') };
    render(<AssessoriaPage />);
    expect(screen.getByText('Não foi possível sincronizar todos os dados da assessoria.')).toBeInTheDocument();
    expect(screen.getByText('Início da assessoria')).toBeInTheDocument();
    expect(screen.queryByText('Sem acesso a esta área')).toBeNull();
  });
});
