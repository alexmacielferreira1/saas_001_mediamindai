import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Workspace2 from './Workspace2';

vi.mock('../../api/media', () => ({
  listMediaAssets: vi.fn().mockResolvedValue([]),
  mediaStreamUrl: (asset) => asset.stream_url,
  uploadMediaAsset: vi.fn(),
  exportMediaClip: vi.fn(),
  exportTimeline: vi.fn(),
}));

function CurrentPath() {
  const location = useLocation();
  return <output aria-label="Rota atual">{location.pathname}</output>;
}

describe('Workspace 2 integrated editing flow', () => {
  beforeEach(() => localStorage.clear());

  it('opens Timeline as step 4 without leaving Workspace 2', () => {
    render(<MemoryRouter initialEntries={['/corp?tab=producao&sub=workspace2']}><Workspace2 /><CurrentPath /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /4\s*timeline/i }));

    expect(screen.getByRole('heading', { name: 'Timeline 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('Rota atual')).toHaveTextContent('/corp');
    expect(localStorage.getItem('mm_workspace2_timeline2_draft')).toContain('tracks');
  });

  it('opens the centralized export surface as step 5', () => {
    localStorage.setItem('mm_timeline2_project:workspace2-draft', JSON.stringify({
      id: 'workspace2-draft', name: 'Persistido', duration: 4, fps: 30, markers: [],
      tracks: [{ id: 'v1', kind: 'video', name: 'Vídeo', clips: [{ id: 'persisted-clip', kind: 'video', name: 'Corte persistido', duration: 4, start: 0 }] }],
    }));
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /5\s*exportação/i }));

    expect(screen.getByRole('heading', { name: 'Central de exportação' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar projeto no MediaMind' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar projeto MediaMind' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar XML Premiere / DaVinci' })).toBeInTheDocument();
    expect(screen.getByText(/1 clipes em 1 trilhas/i)).toBeInTheDocument();
  });
});
