import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Login from './Login';

vi.mock('../auth', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

describe('MediaMind login', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/login');
  });

  it('offers Google login through the local backend', () => {
    render(<Login />);

    const link = screen.getByRole('link', { name: /continuar com google/i });
    expect(link).toHaveAttribute('href', '/api/v1/auth/google/start');
  });

  it('shows a Google callback error without hiding local login', () => {
    window.history.replaceState({}, '', '/login?google_error=account_not_allowed');
    render(<Login />);

    expect(screen.getByText(/conta google não autorizada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
});
