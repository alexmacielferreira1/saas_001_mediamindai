import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  generateScript: vi.fn(), askAssistant: vi.fn(), resolveTasks: vi.fn(), suggestAccess: vi.fn(),
}));
vi.mock('../api/aiTools', () => api);
vi.mock('./auth', () => ({
  useAuth: () => ({ user: { name: 'Ana', role: 'admin' }, roleLabels: { admin: 'Administrador' } }),
}));

import RoteiroIAPanel from './components/RoteiroIAPanel';
import AssistenteIA from './pages/AssistenteIA';
import CorpPromptPanel from './components/corp/CorpPromptPanel';
import AcessoIAPanel from './components/corp/roles/AcessoIAPanel';
import { MOCK_USERS } from './data';
import { ROLE_CATALOG } from './lib/roleCatalog';
import { CORP_SCREENS } from './lib/corpTabs';

beforeEach(() => {
  // jsdom não implementa rolagem de elementos (o Assistente rola a conversa).
  Element.prototype.scrollTo = vi.fn();
  localStorage.clear();
  Object.values(api).forEach((mock) => mock.mockReset());
});

describe('Roteiro IA', () => {
  it('gera blocos e ajustes pela IA real e aplica no roteiro', async () => {
    api.generateScript.mockResolvedValue({
      blocos: [{ track: 't1', content: 'Abertura com a praça' }],
      ajustes: [{ tipo: 'corte', timecode: '00:00:05', descricao: 'Cortar no aplauso' }],
      transcription: 'abertura sobre a praça',
    });
    const onApply = vi.fn();
    render(<RoteiroIAPanel onApply={onApply} context={{ titulo: 'Praça' }} />);
    fireEvent.click(screen.getByText(/gerar roteiro e ajustes/i));
    fireEvent.change(screen.getByPlaceholderText(/Abertura de 30s/), { target: { value: 'Abertura' } });
    fireEvent.click(screen.getByRole('button', { name: /^Gerar$/ }));

    expect(await screen.findByText('Abertura com a praça')).toBeInTheDocument();
    expect(api.generateScript).toHaveBeenCalledWith({ prompt: 'Abertura', audioUrl: '', context: { titulo: 'Praça' } });
    expect(screen.getByText(/Áudio transcrito/)).toHaveTextContent('abertura sobre a praça');
    fireEvent.click(screen.getByRole('button', { name: /Adicionar blocos/ }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar ajustes/ }));
    expect(onApply.mock.calls[0][0][0]).toMatchObject({ type: 'text', content: 'Abertura com a praça' });
    expect(onApply.mock.calls[1][0][0].content).toBe('[EDIÇÃO corte @00:00:05] Cortar no aplauso');
  });

  it('mostra o motivo quando a IA não está configurada', async () => {
    api.generateScript.mockRejectedValue(new Error('Configure uma IA para Roteiro em Configuração de IA.'));
    render(<RoteiroIAPanel />);
    fireEvent.click(screen.getByText(/gerar roteiro e ajustes/i));
    fireEvent.click(screen.getByRole('button', { name: /^Gerar$/ }));
    expect(await screen.findByText('Escreva um prompt ou grave/envie um áudio.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Abertura de 30s/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /^Gerar$/ }));
    expect(await screen.findByText(/Falha na IA: Configure uma IA para Roteiro/)).toBeInTheDocument();
  });
});

describe('Assistente IA', () => {
  it('conversa pela IA real e mostra só as páginas devolvidas pelo servidor', async () => {
    api.askAssistant.mockResolvedValueOnce({
      reply: 'Vá para o Ingest.',
      rotas: [{ path: '/ingest', label: 'Ingest', motivo: 'enviar arquivos' }],
      confirmacao: 'Quer abrir agora?',
    }).mockRejectedValueOnce(new Error('A IA respondeu fora do formato esperado.'));
    render(<MemoryRouter><AssistenteIA /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/O que você quer fazer agora/), { target: { value: 'Como envio vídeo?' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar/ }));

    expect(await screen.findByText('Vá para o Ingest.')).toBeInTheDocument();
    expect(screen.getByText('enviar arquivos')).toBeInTheDocument();
    const body = api.askAssistant.mock.calls[0][0];
    expect(body).toMatchObject({ message: 'Como envio vídeo?', roleLabel: 'Administrador', userName: 'Ana' });
    expect(body.destinations.some((item) => item.path === '/ingest')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }));
    expect(await screen.findByText('Erro: A IA respondeu fora do formato esperado.')).toBeInTheDocument();
  });
});

describe('Prompt de pendências (Corp)', () => {
  const items = [{ id: 1, titulo: 'Revisar VT', status: 'em_andamento' }];

  it('pede sugestões à IA real e aplica a aceita', async () => {
    api.resolveTasks.mockResolvedValue({
      sugestoes: [{ pendencia_id: '1', acao: 'Concluir revisão', novo_status: 'concluido', justificativa: 'pronto' }],
    });
    const onApply = vi.fn();
    render(<CorpPromptPanel segment="edicao" items={items} onApply={onApply} />);
    fireEvent.change(screen.getByPlaceholderText(/avance tudo/), { target: { value: 'finalize' } });
    fireEvent.click(screen.getByRole('button', { name: /Resolver com IA/ }));

    expect(await screen.findByText('Revisar VT')).toBeInTheDocument();
    expect(api.resolveTasks).toHaveBeenCalledWith({ segment: 'edicao', prompt: 'finalize', audioUrl: null, pendencias: items });
    fireEvent.click(screen.getByRole('button', { name: /Aceitar/ }));
    expect(onApply).toHaveBeenCalledWith('1', 'concluido', 'Concluir revisão');
  });

  it('avisa quando não há sugestão ou a IA falha', async () => {
    api.resolveTasks.mockResolvedValueOnce({ sugestoes: [] }).mockRejectedValueOnce(new Error('IA fora do ar'));
    render(<CorpPromptPanel segment="edicao" items={items} onApply={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/avance tudo/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Resolver com IA/ }));
    expect(await screen.findByText('A IA não sugeriu ações para o pedido.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resolver com IA/ }));
    expect(await screen.findByText('IA fora do ar')).toBeInTheDocument();
  });
});

describe('Configurar acesso por IA', () => {
  it('monta a prévia pela IA real e o admin aplica', async () => {
    const role = ROLE_CATALOG[0];
    const screenId = CORP_SCREENS[0].id;
    api.suggestAccess.mockResolvedValue({ role: role.id, extraTabs: [screenId, 'inventada'], removedTabs: [] });
    render(<AcessoIAPanel />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: String(MOCK_USERS[0].id) } });
    fireEvent.change(screen.getByPlaceholderText(/nova videomaker/), { target: { value: 'acesso de produção' } });
    fireEvent.click(screen.getByRole('button', { name: /Gerar configuração/ }));

    expect(await screen.findByText('Prévia gerada pela IA')).toBeInTheDocument();
    expect(api.suggestAccess).toHaveBeenCalledWith(expect.objectContaining({ userName: MOCK_USERS[0].name, prompt: 'acesso de produção', screens: CORP_SCREENS }));
    expect(screen.queryByText(/inventada/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Aplicar ao funcionário/ }));
    expect(screen.getByText('Configuração aplicada ao funcionário.')).toBeInTheDocument();
  });

  it('mostra a falha da IA', async () => {
    api.suggestAccess.mockRejectedValue(new Error('Você não possui permissão para esta ação.'));
    render(<AcessoIAPanel />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: String(MOCK_USERS[0].id) } });
    fireEvent.change(screen.getByPlaceholderText(/nova videomaker/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Gerar configuração/ }));
    await waitFor(() => expect(screen.getByText(/Falha na IA: Você não possui permissão/)).toBeInTheDocument());
  });
});
