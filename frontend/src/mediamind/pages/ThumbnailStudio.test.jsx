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
    expect(screen.queryByRole('heading', { name: 'Thumbs' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Padrão SIMERS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Usar Referência' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Criação Livre' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Meus modelos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Outros' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Projeto')).toHaveValue('54'));
  });

  it('exposes the reference-layout workspace actions in the top bar', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Projeto')).toHaveValue('54'));
    expect(screen.getByRole('button', { name: 'Salvar versão' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Baixar (2)' }));
    await waitFor(() => expect(exportThumbnailElement).toHaveBeenCalledTimes(2));
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
    fireEvent.click(screen.getByRole('button', { name: /Guia Padrão SIMERS/ }));
    expect(screen.getByRole('dialog', { name: 'Guia do padrão SIMERS' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar guia' }));

    fireEvent.click(screen.getByRole('button', { name: 'Baixar (2)' }));
    await waitFor(() => expect(exportThumbnailElement).toHaveBeenCalledTimes(2));
  });

  it('switches to reference and free creation without showing dead template actions', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Usar Referência' }));
    expect(screen.getByLabelText('Imagem de referência')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Criação Livre' }));
    expect(screen.getByLabelText('Orientação da composição')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Meus modelos' }));
    expect(screen.getByText('Nenhum outro template funcional cadastrado')).toBeInTheDocument();
  });

  it('starts a new thumb from the program and keeps the source content optional', async () => {
    renderPage();
    expect(screen.queryByRole('button', { name: 'Nova thumb' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra arte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo Sala de Prescrição' }));

    expect(screen.getByLabelText('Programa')).toHaveValue('Sala de Prescrição');
    expect(screen.getByLabelText('Projeto')).toHaveValue('');
    expect(screen.getByLabelText('Chamada da thumb')).toHaveValue('');
    expect(screen.getByText('Criação nova')).toBeInTheDocument();
    expect(screen.getAllByTestId('thumbnail-canvas-horizontal').some((canvas) => canvas.style.background === 'rgb(180, 204, 0)')).toBe(true);
  });

  it('keeps several independent thumbs in horizontal tabs', async () => {
    renderPage();
    const title = await screen.findByLabelText('Chamada da thumb');
    fireEvent.change(title, { target: { value: 'Primeira capa editada' } });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra arte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo Anamnese' }));

    expect(screen.getByRole('tablist', { name: 'Artes abertas' }).querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(screen.getByLabelText('Programa')).toHaveValue('Anamnese');
    expect(screen.getByRole('tab', { name: 'Abrir Primeira capa editada' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Abrir Primeira capa editada' }));
    expect(screen.getByLabelText('Chamada da thumb')).toHaveValue('Primeira capa editada');
    expect(screen.getByLabelText('Programa')).toHaveValue('Sala de Prescrição');
  });

  it('creates a blank art and replaces the thumb with an editable 4:5 art model', async () => {
    renderPage();
    await screen.findByLabelText('Chamada da thumb');
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra arte' }));
    expect(screen.getByLabelText('Chamada da arte')).toHaveValue('');
    expect(screen.queryByLabelText('Programa')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Artes individuais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo Lima institucional' }));
    expect(screen.getByLabelText('Chamada da arte')).toHaveValue('Médicos aprovam Convenção Coletiva de Trabalho com o Sindiberf');
    expect(screen.getByLabelText('Descrição / contexto')).toHaveValue('');
    expect(screen.getByText('Retrato 1080×1350')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Arte em edição' }).querySelector('[data-testid="thumbnail-canvas-vertical"]')).toBeInTheDocument();
    expect(screen.queryByLabelText('Programa')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Modelo')).toHaveValue('Lima institucional');
    expect(screen.getByRole('tab', { name: /Abrir Médicos aprovam/ })).toBeInTheDocument();
  });

  it('shows visual SIMERS model thumbnails that apply the selected program', () => {
    renderPage();
    expect(screen.getByRole('region', { name: 'Modelos SIMERS para thumbs' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo Anamnese' }));
    expect(screen.getByLabelText('Programa')).toHaveValue('Anamnese');
  });

  it('separates thumbs, individual arts and carousels in the same SIMERS gallery', () => {
    renderPage();
    const categories = screen.getByRole('tablist', { name: 'Categorias de modelos SIMERS' });
    expect(categories.querySelectorAll('[role="tab"]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('tab', { name: 'Artes individuais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo Lima institucional' }));
    expect(screen.getByLabelText('Modelo')).toHaveValue('Lima institucional');
    expect(screen.getByRole('button', { name: 'Restaurar padrão' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Carrosséis' }));
    expect(screen.getByRole('button', { name: 'Aplicar modelo Giro da Semana' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo Giro da Semana' }));
    expect(screen.getByLabelText('Título do slide')).toHaveValue('GIRO DE NOTÍCIAS DA SEMANA');
    expect(screen.getByText('Artes deste trabalho (5)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Artes individuais' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo Turquesa institucional' }));
    expect(screen.queryByLabelText('Título do slide')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Chamada da arte')).toHaveValue('Simers se reúne com diretoria do Hospital Estrela para tratar do atendimento psiquiátrico');

    fireEvent.click(screen.getByRole('tab', { name: 'Thumbs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo Anamnese' }));
    expect(screen.getByLabelText('Programa')).toHaveValue('Anamnese');
    expect(screen.queryByLabelText('Modelo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Horizontal' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Vertical' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('allows adding another SIMERS model category', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '+ Categoria' }));
    fireEvent.change(screen.getByLabelText('Nome da nova categoria'), { target: { value: 'Campanhas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByRole('tab', { name: 'Campanhas' })).toHaveAttribute('aria-selected', 'true');
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
