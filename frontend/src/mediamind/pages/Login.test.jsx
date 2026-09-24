import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Login from './Login';

vi.mock('../auth', () => ({
  useAuth: () => ({ login: vi.fn(), loginDemo: vi.fn() }),
}));

describe('MediaMind login', () => {
  const renderLogin = () => render(<MemoryRouter><Login /></MemoryRouter>);

  beforeEach(() => {
    window.history.replaceState({}, '', '/login');
  });

  it('offers Google login through the local backend', () => {
    renderLogin();

    const link = screen.getByRole('link', { name: /continuar com google/i });
    expect(link).toHaveAttribute('href', '/api/v1/auth/google/start');
  });

  it('shows a Google callback error without hiding local login', () => {
    window.history.replaceState({}, '', '/login?google_error=account_not_allowed');
    renderLogin();

    expect(screen.getByText(/conta google não autorizada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('explains a cancelled Google login and keeps the password option', () => {
    window.history.replaceState({}, '', '/login?google_error=access_denied');
    renderLogin();

    expect(screen.getByText('Você cancelou a entrada com Google.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('explains when Google login is not configured', () => {
    window.history.replaceState({}, '', '/login?google_error=not_configured');
    renderLogin();

    expect(screen.getByText('Login Google indisponível neste ambiente.')).toBeInTheDocument();
  });
});
