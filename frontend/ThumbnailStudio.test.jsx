import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const projects = [{
  id: 54, programa: 'Sala de Prescrição', episodio: 'EP054',
  titulo: 'A trajetória do Preto na medicina', descricao: 'Contexto editorial',
  pauta: 'Resumo do roteiro', convidado_nome: 'Dr. Paulo Souza', convidado_cg: 'Médico',
  apresentadores: [{ nome: 'Dra. Ana Ribeiro', cg: 'Apresentadora' }],
}];

vi.mock('../lib/producaoStore', () => ({ useProducaoProjetos: () => projects, mergePersistedProject: vi.fn() }));
vi.mock('@/api/media', () => ({
  resolveMediaUrl: (url) => url, uploadMediaAsset: vi.fn().mockResolvedValue({ id: 'asset-new', stream_url: '/asset.png' }),
  listMediaAssets: vi.fn().mockResolvedValue([
    { id: 'img-1', title: 'Foto do episódio', asset_type: 'image', stream_url: '/foto.jpg', project_id: '54' },
  ]),
}));
vi.mock('@/api/base44Client', () => ({
  base44: { entities: { ProducaoProjeto: { list: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) }, Person: { list: vi.fn().mockResolvedValue([{ id: 'guest-2', name: 'Outra convidada' }]), create: vi.fn().mockResolvedValue({ id: 'person-new' }) }, CreativeDocument: { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockImplementation(async (data) => ({ ...data, id: 'saved-thumb' })) }, Script: { list: vi.fn().mockResolvedValue([]) } } },
}));
vi.mock('../lib/thumbnailExport', () => ({ exportThumbnailElement: vi.fn().mockResolvedValue(undefined), thumbnailBlob: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })) }));
vi.mock('../lib/thumbnailRenderer', () => ({ renderThumbnail: vi.fn().mockResolvedValue([]), thumbnailLayers: () => [] }));
vi.mock('../components/thumbnails/ThumbnailAISettings', () => ({ default: () => null }));
vi.mock('../lib/thumbnailImage', () => ({ createLocalCutout: vi.fn().mockResolvedValue('blob:foto-recortada') }));

import { exportThumbnailElement } from '../lib/thumbnailExport';
import ThumbnailStudio from './ThumbnailStudio';

function renderPage() {
  return render(<MemoryRouter><ThumbnailStudio /></MemoryRouter>);
}

describe('Criar Thumbs', () => {
  beforeEach(() => {
    exportThumbnailElement.mockClear();
    URL.createObjectURL = vi.fn(() => 'blob:foto-enviada');
  });

  it('opens on Padrão SIMERS and exposes all functional modes', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Criar Thumbs' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Padrão SIMERS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Usar Referência' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Criação Livre' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Outros Templates' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Projeto')).toHaveValue('54'));
  });

  it('loads production data into editable local fields and does not mutate the project', async () => {
    renderPage();
    const title = await screen.findByLabelText('Chamada da thumb');
    expect(title).toHaveValue('A trajetória do Preto na medicina');
    fireEvent.change(title, { target: { value: 'Chamada alterada na thumb' } });
    expect(title).toHaveValue('Chamada alterada na thumb');
    expect(projects[0].titulo).toBe('A trajetória do Preto na medicina');
    expect(screen.getByText('Dados carregados do MediaMind')).toBeInTheDocument();
    expect(screen.getByText('Foto do episódio')).toBeInTheDocument();
  });

  it('opens the pattern guide and exports both selected formats', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Ver guia do padrão' }));
    expect(screen.getByRole('dialog', { name: 'Guia do padrão SIMERS' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar guia' }));

    fireEvent.click(screen.getByRole('button', { name: 'Baixar imagens selecionadas' }));
    await waitFor(() => expect(exportThumbnailElement).toHaveBeenCalledTimes(2));
  });

  it('switches to reference and free creation without showing dead template actions', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Usar Referência' }));
    expect(screen.getByLabelText('Imagem de referência')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Criação Livre' }));
    expect(screen.getByLabelText('Orientação da composição')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Outros Templates' }));
    expect(screen.getByText('Nenhum outro template funcional cadastrado')).toBeInTheDocument();
  });

  it('starts a new thumb from the program and keeps the source content optional', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Nova thumb' }));
    expect(screen.getByRole('dialog', { name: 'Escolher programa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Minuto Simers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pediatricos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Corações e Mentes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No Front' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sala de Prescrição' }));

    expect(screen.getByLabelText('Programa')).toHaveValue('Sala de Prescrição');
    expect(screen.getByLabelText('Projeto')).toHaveValue('');
    expect(screen.getByLabelText('Chamada da thumb')).toHaveValue('');
    expect(screen.getByText('Criação nova')).toBeInTheDocument();
    expect(screen.getByTestId('thumbnail-canvas-horizontal')).toHaveStyle({ background: '#B4CC00' });
  });

  it('keeps several independent thumbs that can be collapsed and resumed', async () => {
    renderPage();
    const title = await screen.findByLabelText('Chamada da thumb');
    fireEvent.change(title, { target: { value: 'Primeira capa editada' } });

    fireEvent.click(screen.getByRole('button', { name: 'Nova thumb' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anamnese' }));

    expect(screen.getByRole('region', { name: 'Thumbs em criação' })).toHaveTextContent('2');
    expect(screen.getByLabelText('Programa')).toHaveValue('Anamnese');
    expect(screen.getByRole('button', { name: 'Expandir Primeira capa editada' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Primeira capa editada' }));
    expect(screen.getByLabelText('Chamada da thumb')).toHaveValue('Primeira capa editada');
    expect(screen.getByLabelText('Programa')).toHaveValue('Sala de Prescrição');

    fireEvent.click(screen.getByRole('button', { name: 'Recolher Primeira capa editada' }));
    expect(screen.queryByRole('tab', { name: 'Padrão SIMERS' })).not.toBeInTheDocument();
  });

  it('adds a person directly from an uploaded photo and applies the local cutout', async () => {
    renderPage();
    const file = new File(['foto'], 'convidada.png', { type: 'image/png' });

    fireEvent.change(screen.getByLabelText('Adicionar pessoa com foto'), { target: { files: [file] } });

    expect(screen.getByDisplayValue('Convidada')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Comparar com foto original')).toBeInTheDocument());
  });
  it('adds another registered interviewee and keeps the single title field', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Selecionar entrevistado')).toHaveTextContent('Outra convidada'));
    fireEvent.change(screen.getByLabelText('Selecionar entrevistado'), { target: { value: 'guest-2' } });
    expect(screen.getByLabelText('Nome de Outra convidada')).toBeInTheDocument();
    expect(screen.queryByLabelText('Título principal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sugerir a partir do título' })).not.toBeInTheDocument();
  });
  it('restores visuals without deleting interviewees or the edited headline', async () => {
    renderPage(); fireEvent.change(screen.getByLabelText('Chamada da thumb'), { target: { value: 'Minha chamada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar ambos' }));
    expect(screen.getByLabelText('Chamada da thumb')).toHaveValue('Minha chamada');
    expect(screen.getByLabelText('Nome de Dr. Paulo Souza')).toBeInTheDocument();
  });

});
