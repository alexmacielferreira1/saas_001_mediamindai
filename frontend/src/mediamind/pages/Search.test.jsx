import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const state = { assets: [] };
vi.mock('../lib/mamData', () => ({ useMamData: () => ({ assets: state.assets, loading: false }) }));

import SearchPage, { clipDuration } from './Search';

const VIDEO = { id: 'a1', title: 'Entrevista Prefeito', filename: 'ENTREVISTA.mov', asset_type: 'video', status: 'reviewed', duration: 60, file_size: 1000, file_url: '/api/v1/media/assets/a1/stream' };
const DOC = { id: 'a2', title: 'Pauta impressa', filename: 'PAUTA.pdf', asset_type: 'document', status: 'pending', duration: 0, file_size: 10 };

function Location() { const l = useLocation(); return <output data-testid="loc">{l.pathname}{l.search}</output>; }
function renderPage(assets, initial = '/search') {
  state.assets = assets;
  return render(<MemoryRouter initialEntries={[initial]}><Routes><Route path="*" element={<><SearchPage /><Location /></>} /></Routes></MemoryRouter>);
}

describe('Pesquisa', () => {
  it('calcula a duração real do trecho IN/OUT', () => {
    expect(clipDuration('00:01:14', '00:01:42')).toBe('00:00:28');
    expect(clipDuration('00:02:00', '00:01:00')).toBe('—');
    expect(clipDuration('abc', '00:01:00')).toBe('—');
  });

  it('Buscar filtra os resultados e registra o termo na URL', () => {
    renderPage([VIDEO, DOC]);
    fireEvent.change(screen.getByLabelText('Pesquisar no acervo'), { target: { value: 'pauta' } });
    fireEvent.click(screen.getByRole('button', { name: /^Buscar$/ }));
    expect(screen.getByText('1 resultado(s)')).toBeInTheDocument();
    expect(screen.getByTestId('loc').textContent).toContain('q=pauta');
  });

  it('roteiro e produção têm destinos distintos e o download usa o arquivo real', () => {
    renderPage([VIDEO]);
    const roteiro = screen.getByText('Adicionar ao roteiro').closest('a');
    const producao = screen.getByText('Usar na produção').closest('a');
    expect(roteiro).toHaveAttribute('href', '/corp?tab=producao&sub=roteiro&assetId=a1');
    expect(producao.getAttribute('href')).not.toBe(roteiro.getAttribute('href'));
    expect(screen.getByText('Download').closest('a')).toHaveAttribute('href', '/api/v1/media/assets/a1/stream');
    expect(screen.getByText('Revisado', { selector: 'h2 + span' })).toBeInTheDocument();
  });

  it('desabilita com motivo os controles sem ação e o download sem arquivo', () => {
    renderPage([DOC]);
    expect(screen.getByText('Download').closest('button')).toBeDisabled();
    expect(screen.getByText('Mais ações').closest('button')).toHaveAttribute('title', 'Ainda não disponível');
    for (const name of [/Filtros avançados/, /Editar informações/, /Período/, /Mais relevantes/, 'Reproduzir', 'Tela cheia']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
