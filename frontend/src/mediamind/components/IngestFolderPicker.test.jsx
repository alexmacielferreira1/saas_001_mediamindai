import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getIngestSource } = vi.hoisted(() => ({ getIngestSource: vi.fn() }));
vi.mock('../../api/ingest', () => ({ getIngestSource: (...args) => getIngestSource(...args) }));

import IngestFolderPicker from './IngestFolderPicker';

const SOURCE = {
  source_folder: 'D:\\Entrada\\empresa',
  truncated: false,
  files: [
    { path: 'Pauta/entrevista.mp4', size: 5 * 1024 * 1024, asset_type: 'video', imported_asset_id: null },
    { path: 'trilha.wav', size: 2048, asset_type: 'audio', imported_asset_id: null },
    { path: 'foto.jpg', size: 1024, asset_type: 'image', imported_asset_id: 'asset-9' },
  ],
};

function Picker(props) {
  const [selected, setSelected] = useState([]);
  return <><IngestFolderPicker selected={selected} onChange={setSelected} {...props} /><output>{selected.join(',')}</output></>;
}

describe('IngestFolderPicker', () => {
  beforeEach(() => getIngestSource.mockReset());

  it('lista a pasta do servidor, marca o que já está no acervo e seleciona os novos', async () => {
    getIngestSource.mockResolvedValue(SOURCE);
    render(<Picker />);
    expect(await screen.findByText('Pauta/entrevista.mp4')).toBeInTheDocument();
    expect(screen.getByText('D:\\Entrada\\empresa')).toBeInTheDocument();
    expect(screen.getByLabelText('Incluir foto.jpg')).toBeDisabled();
    expect(screen.getByText('No acervo')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Incluir trilha.wav'));
    expect(screen.getByRole('status')).toHaveTextContent('trilha.wav');
    fireEvent.click(screen.getByLabelText('Incluir trilha.wav'));
    expect(screen.getByRole('status')).toHaveTextContent('');

    fireEvent.click(screen.getByRole('button', { name: 'Selecionar novos' }));
    expect(screen.getByRole('status')).toHaveTextContent('Pauta/entrevista.mp4,trilha.wav');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('explica pasta não configurada e lê de novo ao atualizar', async () => {
    getIngestSource.mockRejectedValueOnce(new Error('Pasta de referência não configurada no servidor (INGEST_SOURCE_ROOT).'));
    getIngestSource.mockResolvedValueOnce({ ...SOURCE, files: [], truncated: false });
    render(<Picker />);
    expect(await screen.findByRole('alert')).toHaveTextContent('INGEST_SOURCE_ROOT');
    fireEvent.click(screen.getByLabelText('Atualizar a pasta de referência'));
    expect(await screen.findByText(/A pasta está vazia/)).toBeInTheDocument();
    expect(getIngestSource).toHaveBeenCalledTimes(2);
  });

  it('avisa quando a lista foi cortada e usa mensagem padrão sem texto de erro', async () => {
    getIngestSource.mockResolvedValueOnce({ ...SOURCE, truncated: true });
    const { unmount } = render(<Picker />);
    expect(await screen.findByText('Mostrando os primeiros 3 arquivos da pasta.')).toBeInTheDocument();
    unmount();
    getIngestSource.mockRejectedValueOnce({});
    render(<Picker />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível ler a pasta de referência.');
  });
});
