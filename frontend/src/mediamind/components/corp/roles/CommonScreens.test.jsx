import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { COMMON_IDS, CommonScreen } from './CommonScreens';

describe('common role screens', () => {
  it('exposes Workspace 2 without replacing the original Workspace', () => {
    render(<MemoryRouter><CommonScreen active="workspace2" /></MemoryRouter>);

    expect(COMMON_IDS).toContain('workspace');
    expect(COMMON_IDS).toContain('workspace2');
    expect(screen.getByRole('heading', { name: 'Workspace 2' })).toBeInTheDocument();
  });
});
