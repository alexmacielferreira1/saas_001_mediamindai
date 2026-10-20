import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';
import { MediaMindThemeProvider, THEME_STORAGE_KEY } from '../lib/theme';

function mockSystemTheme(prefersLight) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('light') ? prefersLight : !prefersLight,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

function renderToggle() {
  return render(
    <MediaMindThemeProvider>
      <ThemeToggle />
    </MediaMindThemeProvider>,
  );
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
    mockSystemTheme(false);
  });

  it('usa o tema escuro atual como padrão sem preferência salva', () => {
    renderToggle();
    expect(screen.getByRole('radio', { name: 'Tema Escuro' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    // color-scheme alteraria sliders e selects nativos do tema escuro original.
    expect(document.documentElement.style.colorScheme).toBe('');
  });

  it('oferece as três opções no grupo acessível', () => {
    renderToggle();
    const group = screen.getByRole('radiogroup', { name: 'Tema da interface' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((el) => el.getAttribute('aria-label'))).toEqual([
      'Tema Claro',
      'Tema Escuro',
      'Tema Sistema',
    ]);
  });

  it('aplica e persiste o tema claro', () => {
    renderToggle();
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Tema Claro' })));
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByRole('radio', { name: 'Tema Claro' })).toHaveAttribute('aria-checked', 'true');
  });

  it('segue o sistema operacional na opção Sistema', () => {
    mockSystemTheme(true);
    renderToggle();
    act(() => fireEvent.click(screen.getByRole('radio', { name: 'Tema Sistema' })));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement).toHaveClass('light');
  });

  it('mostra o escuro como ativo mesmo fora do provedor de tema', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: 'Tema Escuro' })).toHaveAttribute('aria-checked', 'true');
  });

  it('restaura a preferência salva ao abrir', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderToggle();
    expect(screen.getByRole('radio', { name: 'Tema Claro' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('light');
  });
});
