import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { COMMON_IDS, CommonScreen } from './CommonScreens';

describe('common role screens', () => {
  it('exposes only the advanced Workspace under the canonical identifier', () => {
    render(<MemoryRouter><CommonScreen active="workspace" /></MemoryRouter>);

    expect(COMMON_IDS).toContain('workspace');
    expect(COMMON_IDS).not.toContain('workspace2');
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
  });

  it('keeps the former workspace2 identifier as an alias of the advanced Workspace', () => {
    render(<MemoryRouter><CommonScreen active="workspace2" /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
  });
});
