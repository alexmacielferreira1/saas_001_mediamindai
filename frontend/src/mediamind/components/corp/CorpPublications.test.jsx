import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();
const remove = vi.fn();

vi.mock('@/api/base44Client', () => ({
  base44: { entities: { Publicacao: { list: (...a) => list(...a), delete: (...a) => remove(...a), bulkCreate: vi.fn(async () => []) } } },
}));
vi.mock('../thumbnails/ProjectThumbnails', () => ({ default: () => null }));

import CorpPublications, { publicationUrl } from './CorpPublications';

const REAL = { id: '11111111-1111-1111-1111-111111111111', titulo: 'Corte real', descricao: 'desc', plataforma: 'youtube', status: 'publicado', url: 'https://youtu.be/abc' };
const NO_URL = { id: '22222222-2222-2222-2222-222222222222', titulo: 'Sem link', descricao: '', plataforma: 'youtube', status: 'erro' };

describe('CorpPublications — controles honestos', () => {
  beforeEach(() => { list.mockReset(); remove.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('publicationUrl aceita só http(s)', () => {
    expect(publicationUrl({ url: 'https://x.com/a' })).toBe('https://x.com/a');
    expect(publicationUrl({ url: 'javascript:alert(1)' })).toBe('');
    expect(publicationUrl({})).toBe('');
  });

  it('abre e copia a URL registrada, e "Editar no canal" não mostra aviso falso', async () => {
    list.mockResolvedValue([REAL]);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CorpPublications />);
    await screen.findByRole('heading', { name: 'Corte real' });
    fireEvent.click(screen.getByRole('button', { name: /Abrir canal/ }));
    expect(open).toHaveBeenCalledWith('https://youtu.be/abc', '_blank', 'noopener,noreferrer');
    fireEvent.click(screen.getByRole('button', { name: /Copiar URL/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://youtu.be/abc'));
    expect(await screen.findByText('URL copiada para a área de transferência.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Editar no canal/ }));
    expect(screen.queryByText(/Edição do canal aberta/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações' })).toBeDisabled();
  });

  it('sem URL os controles ficam desabilitados com motivo, e "Tentar novamente" não simula fila', async () => {
    list.mockResolvedValue([NO_URL]);
    render(<CorpPublications />);
    await screen.findByRole('heading', { name: 'Sem link' });
    for (const name of [/Abrir canal/, /Copiar URL/, /Editar no canal/]) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Esta publicação ainda não tem URL externa registrada');
    }
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeDisabled();
  });

  it('Excluir pede confirmação e só chama a API após confirmar', async () => {
    list.mockResolvedValue([REAL]);
    remove.mockResolvedValue();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<CorpPublications />);
    await screen.findByRole('heading', { name: 'Corte real' });
    fireEvent.click(screen.getByRole('button', { name: /Excluir/ }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    list.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: /Excluir/ }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(REAL.id));
  });

  it('mostra o erro real quando a exclusão falha', async () => {
    list.mockResolvedValue([REAL]);
    remove.mockRejectedValue(new Error('Sem permissão'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CorpPublications />);
    await screen.findByRole('heading', { name: 'Corte real' });
    fireEvent.click(screen.getByRole('button', { name: /Excluir/ }));
    expect(await screen.findByText('Não foi possível excluir a publicação: Sem permissão.')).toBeInTheDocument();
  });

  it('exemplos sem registro salvo não podem ser excluídos', async () => {
    list.mockResolvedValue([]);
    render(<CorpPublications />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Excluir/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: /Excluir/ })).toHaveAttribute('title', 'Exemplo sem registro salvo; não há o que excluir');
  });
});
