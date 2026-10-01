import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMediaAssetsMock = vi.fn();
vi.mock('../../api/media', () => ({ listMediaAssets: (...args) => listMediaAssetsMock(...args) }));
vi.mock('../../api/scripts', () => ({ listScripts: vi.fn().mockResolvedValue([]), createScript: vi.fn(), updateScript: vi.fn() }));
import Roteiro2 from './Roteiro2';

describe('Roteiro 2 preview', () => {
  beforeEach(() => {
    listMediaAssetsMock.mockResolvedValue([{ id: 'asset-1', title: 'Entrevista real', program_name: 'Jornal local', duration: 125, asset_type: 'video', status: 'indexed' }]);
  });

  it('keeps the preview distinct from Workspace 2 and connects the archive', async () => {
    render(<Roteiro2 />);
    expect(screen.getByRole('heading', { name: 'Roteiro 2' })).toBeInTheDocument();
    expect(screen.getByText('Prévia paralela')).toBeInTheDocument();
    expect((await screen.findAllByText('Entrevista real')).length).toBeGreaterThan(0);
    expect(screen.getByText('Mídias do acervo para roteiros')).toBeInTheDocument();
    expect(screen.getAllByText('Jornal local').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Novo roteiro 2' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Importar' })).toBeEnabled();
  });
});
