import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UniversalCopilot from './UniversalCopilot';
import { listMediaAssets } from '../../../api/media';
import { registerMCPActions } from '../../lib/mcpActions';

vi.mock('../../lib/mcpApi', () => ({ listMCPTools: vi.fn().mockResolvedValue({ tools: [] }), createMCPQueue: vi.fn() }));
vi.mock('../../auth', () => ({ useAuth: () => ({ user: { role: 'editor' } }) }));
vi.mock('../../../api/httpClient', () => ({ request: vi.fn() }));
vi.mock('./CopilotAISettings', () => ({ default: () => null }));
vi.mock('../../../api/media', () => ({ listMediaAssets: vi.fn() }));
vi.mock('../../../api/admin', () => ({ listAdminUsers: vi.fn(), listAdminActivity: vi.fn() }));
vi.mock('../../../api/base44Client', () => ({ base44: { entities: new Proxy({}, { get: () => ({ list: vi.fn().mockResolvedValue([]) }) }) } }));

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="*" element={<><UniversalCopilot /><Where /></>} /></Routes>
    </MemoryRouter>,
  );
}

describe('UniversalCopilot · MCP das páginas', () => {
  beforeEach(() => {
    localStorage.setItem('mm_copilot_open', '1');
    listMediaAssets.mockResolvedValue([
      { id: '1', title: 'Aula', filename: 'aula.mp4', file_size: 9, asset_type: 'video', duration: 10 },
      { id: '2', title: 'Aula 2', filename: 'AULA.mp4', file_size: 9, asset_type: 'video', duration: 10 },
    ]);
  });
  afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('shows the icon grid on a page outside the graphic tools and runs a real check', async () => {
    renderAt('/corp?tab=produtor&sub=ingest');
    const panel = await screen.findByRole('region', { name: 'Ferramentas Ingestão' });
    expect(within(panel).getByRole('tablist', { name: 'Guias de ferramentas' })).toBeInTheDocument();
    expect(screen.queryByText('Atalhos simples desta página. Para tarefas complexas, converse com o Copiloto.')).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Possíveis duplicados' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Consultar' }));
    expect(await within(panel).findByText('aula.mp4 · 2 cópias')).toBeInTheDocument();
    // Consulta não tem o que desfazer: sem a barra "Última ação · Desfazer".
    expect(within(panel).queryByText(/Última ação/)).not.toBeInTheDocument();
  });

  it('navigates keeping the corp role and prepares Copilot requests in the chat', async () => {
    renderAt('/corp?tab=produtor&sub=overview');
    const panel = await screen.findByRole('region', { name: 'Ferramentas Início e indicadores' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Em edição' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Abrir' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/corp?tab=produtor&sub=em_edicao');

    renderAt('/corp?sub=overview');
    const second = (await screen.findAllByRole('region', { name: 'Ferramentas Início e indicadores' })).at(-1);
    fireEvent.click(within(second).getByRole('button', { name: 'Resumir pendências' }));
    fireEvent.click(within(second).getByRole('button', { name: /Preparar no chat/ }));
    expect(screen.getAllByPlaceholderText(/Converse, planeje/).at(-1).value).toContain('Resumir pendências');
  });

  it('queues a page tool and runs the queue in order', async () => {
    renderAt('/ingest');
    const panel = await screen.findByRole('region', { name: 'Ferramentas Ingestão' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Possíveis duplicados' }));
    fireEvent.click(within(panel).getByRole('button', { name: /Adicionar à fila/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Executar fila \(1\)/ }));
    expect((await screen.findAllByText(/1 encontrado/)).length).toBeGreaterThan(0);
  });

  it('gives priority to the tool that is open (graphic apps keep their own catalogue)', async () => {
    const stop = registerMCPActions({
      source: 'mmfilm', label: 'MMFilm',
      catalogue: () => ({ tabs: [], tools: [{ id: 't', tab: 'x', label: 'Ferramenta do app', description: '', params: [] }] }),
      analyze: vi.fn(), apply: vi.fn(), undo: () => false, canUndo: () => false,
    });
    renderAt('/corp?sub=ingest');
    expect(await screen.findByRole('region', { name: 'Ferramentas MMFilm' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ferramentas Ingestão' })).not.toBeInTheDocument();
    stop();
  });
});
