import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/ai-tools/VideoStudio', () => ({ default: () => null }));
vi.mock('../components/agency/AgencyMissionControl', () => ({ default: () => null }));

import AgenciaVideo from './AgenciaVideo';

describe('Agência de Vídeo — links', () => {
  it('aponta para o gerador de vídeo real com rótulo claro', () => {
    render(<MemoryRouter><AgenciaVideo /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Abrir Geração de Vídeo' });
    expect(link).toHaveAttribute('href', '/geracao-de-video');
    expect(screen.queryByRole('link', { name: /VIDEO_ESTUDIO/ })).not.toBeInTheDocument();
  });

  it('/publish redireciona para a fila "Para publicação" do Corp', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(app).toContain('<Route path="/publish" element={<Navigate to="/corp?tab=producao&sub=para_publicar" replace />} />');
  });
});
