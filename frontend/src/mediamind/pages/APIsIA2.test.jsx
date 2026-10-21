import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { id: 'adm', name: 'Alex', role: 'admin' } }));

vi.mock('../../api/httpClient', async (importOriginal) => ({ ...(await importOriginal()), request: requestMock }));
vi.mock('../auth', () => ({ useAuth: () => auth }));

import APIsIA2 from './APIsIA2';
import { connectionKind, connectionStatus } from '../components/acessos2/IA2';
import { ApiError } from '../../api/httpClient';

const EMPTY = {
  totals: { calls: 0, ok: 0, errors: 0, priced_usd: 0, unpriced_calls: 0 },
  groups: { models: [], features: [], users: [], days: [] },
  events: [],
  policy: { monthly_limit_usd: 0, prices: [] },
  connections: { connections: [] },
};

const FULL = {
  totals: { calls: 4, ok: 3, errors: 1, priced_usd: 12.5, unpriced_calls: 1 },
  groups: { features: [{ name: 'ai/copilot/chat', calls: 3, errors: 1, cost_usd: 10, unpriced: 0 }, { name: 'ai/generation/image', calls: 1, errors: 0, cost_usd: 2.5, unpriced: 1 }] },
  events: [
    { id: 'e1', at: '2026-10-20T10:00:00Z', feature: 'ai/copilot/chat', provider: 'openai', model: 'gpt-x', status: 'ok', cost_usd: 1.25 },
    { id: 'e2', at: '2026-10-20T11:00:00Z', feature: 'ai/generation/image', provider: 'openai', model: 'img', status: 'error', cost_usd: null },
  ],
  policy: { monthly_limit_usd: 50, prices: [] },
  connections: { connections: [
    { id: 'c1', name: 'OpenAI principal', provider: 'openai', model: 'gpt-x', base_url: 'https://api.openai.com', enabled: true, key_configured: false },
    { id: 'c2', name: 'Ollama local', provider: 'ollama', model: 'llama3', base_url: 'http://localhost:11434', enabled: true, key_configured: false },
  ] },
  coverage: { other_modules: 'Ainda não instrumentados.' },
};

function renderAt(path = '/telas2/apis-ia') {
  return render(<MemoryRouter initialEntries={[path]}><APIsIA2 /></MemoryRouter>);
}

describe('APIs e IA 2 (Telas 2)', () => {
  beforeEach(() => {
    requestMock.mockReset();
    auth.user = { id: 'adm', name: 'Alex', role: 'admin' };
  });

  it('visão geral vazia não inventa números', async () => {
    requestMock.mockResolvedValue(EMPTY);
    renderAt();
    expect(await screen.findByText('Sem chamadas registradas no período')).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledWith('/ai/usage/report?days=30');
    expect(screen.getByText('Sem limite')).toBeInTheDocument();
    expect(screen.getByText('Nenhum provedor configurado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver recomendações/ })).toHaveAttribute('title', 'Ainda não disponível');
    expect(screen.getAllByRole('link', { name: 'Configure em Configurações de IA' })[0]).toHaveAttribute('href', '/configuracoes/ia');
  });

  it('visão geral com dados reais e troca de período', async () => {
    requestMock.mockResolvedValue(FULL);
    renderAt();
    expect(await screen.findByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('Credencial ausente em OpenAI principal')).toBeInTheDocument();
    expect(screen.getByText('1 chamada(s) sem preço cadastrado')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '7' } });
    expect(await screen.findByText('75.0%')).toBeInTheDocument();
    expect(requestMock).toHaveBeenLastCalledWith('/ai/usage/report?days=7');
    fireEvent.click(screen.getByRole('button', { name: /Atualizar/ }));
    expect(requestMock).toHaveBeenCalledTimes(3);
  });

  it('mostra erro do servidor sem dados de exemplo', async () => {
    requestMock.mockRejectedValue(new ApiError({ status: 403, message: 'negado' }));
    renderAt();
    expect(await screen.findByText(/Sem permissão para consultar estes dados/)).toBeInTheDocument();
    expect(screen.getByText('Dados reais indisponíveis')).toBeInTheDocument();
  });

  it('provedores em somente leitura com gravação desabilitada', async () => {
    requestMock.mockResolvedValue(FULL);
    renderAt('/telas2/apis-ia?tab=provedores');
    expect(await screen.findByText('OpenAI principal')).toBeInTheDocument();
    expect(screen.getByText('Selecione um provedor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver OpenAI principal' }));
    expect(screen.getByDisplayValue('Não cadastrada')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('title', 'Configure em Configurações de IA');
    expect(screen.getByRole('button', { name: /Testar conexão/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Novo provedor/ })).toHaveAttribute('href', '/configuracoes/ia');
    fireEvent.change(screen.getByLabelText('Buscar provedor'), { target: { value: 'llama' } });
    expect(screen.queryByText('OpenAI principal')).not.toBeInTheDocument();
  });

  it('provedores vazio', async () => {
    requestMock.mockResolvedValue(EMPTY);
    renderAt('/telas2/apis-ia?tab=provedores');
    expect(await screen.findByText('Nenhum provedor cadastrado')).toBeInTheDocument();
  });

  it('consumo com dados reais e repetições não medidas', async () => {
    requestMock.mockResolvedValue(FULL);
    renderAt('/telas2/apis-ia?tab=consumo');
    expect(await screen.findByText('Falhou')).toBeInTheDocument();
    expect(screen.getByText('Sem preço')).toBeInTheDocument();
    expect(screen.getByText('Ainda não medido pelo servidor')).toBeInTheDocument();
    expect(screen.getByText('Ainda não instrumentados.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simular impacto' })).toBeDisabled();
  });

  it('consumo vazio', async () => {
    requestMock.mockResolvedValue(EMPTY);
    renderAt('/telas2/apis-ia?tab=consumo');
    expect(await screen.findByText('Nenhuma chamada no período')).toBeInTheDocument();
    expect(screen.getByText('Sem chamadas registradas')).toBeInTheDocument();
  });

  it('não chama o servidor para quem não é administrador', () => {
    auth.user = { id: 'e', name: 'Editor', role: 'editor' };
    renderAt();
    expect(screen.getByText(/Acesso restrito a administradores/)).toBeInTheDocument();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('troca de abas', async () => {
    requestMock.mockResolvedValue(EMPTY);
    renderAt();
    await screen.findByText('Sem chamadas registradas no período');
    fireEvent.click(screen.getByRole('tab', { name: /Consumo/ }));
    expect(await screen.findByText('Nenhuma chamada no período')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Visão geral/ }));
    expect(screen.getByRole('tab', { name: /Visão geral/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('dados parciais do servidor sem quebrar a tela', async () => {
    requestMock.mockResolvedValue({
      totals: { calls: 2 },
      groups: { features: [{ name: 'sem-contagem', errors: 0, cost_usd: 0 }, { name: 'com', calls: 2, errors: 0, cost_usd: 0 }] },
      connections: { connections: [{ id: 'c9', provider: 'ollama', enabled: true, key_configured: true }] },
    });
    renderAt();
    expect(await screen.findByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('sem-contagem')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Provedores/ }));
    fireEvent.click(await screen.findByRole('button', { name: /^Ver/ }));
    expect(screen.getByDisplayValue('•••••••••••••••• (cadastrada)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Local')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('conexão sem provedor informado', async () => {
    requestMock.mockResolvedValue({ ...EMPTY, connections: { connections: [{ id: 'c0', name: 'Sem provedor', enabled: true, key_configured: false }] } });
    renderAt('/telas2/apis-ia?tab=provedores');
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Sem provedor' }));
    expect(screen.getByDisplayValue('API externa')).toBeInTheDocument();
  });

  it('usuário sem papel não consulta o servidor', () => {
    auth.user = null;
    renderAt();
    expect(screen.getByText(/Acesso restrito a administradores/)).toBeInTheDocument();
  });

  it('classifica conexões', () => {
    expect(connectionKind({ base_url: 'http://127.0.0.1:1' })).toBe('Local');
    expect(connectionStatus({ enabled: false })).toEqual(['Desativada', 'error']);
    expect(connectionStatus({ enabled: true, key_configured: true, base_url: 'https://x' })).toEqual(['Configurado', 'success']);
  });
});
