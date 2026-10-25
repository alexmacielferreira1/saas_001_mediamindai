import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Workspace2 from './Workspace2';

const mediaApi = vi.hoisted(() => ({
  listMediaAssets: vi.fn(),
  uploadMediaAsset: vi.fn(),
}));

vi.mock('../../api/media', () => ({
  ...mediaApi,
  mediaStreamUrl: (asset) => asset.stream_url,
}));

describe('Workspace 2 flow', () => {
  beforeEach(() => {
    localStorage.clear();
    mediaApi.listMediaAssets.mockReset().mockResolvedValue([]);
    mediaApi.uploadMediaAsset.mockReset();
  });
  it('uses the MMFilm controls without the duplicate Workspace toolbar', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', {name:/3\s*Timeline/i}));
    fireEvent.click(screen.getByRole('tab', {name:'MMFilm · prévia'}));
    expect(screen.queryByRole('button',{name:'Importar mídias',exact:true})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Layouts',exact:true})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Travar',exact:true})).not.toBeInTheDocument();
    expect(screen.getByLabelText('Importar mídia', {exact:true})).toHaveAttribute('type', 'file');
  });
  it('goes from media selection to the simplified creation screen and then the editor', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    expect(screen.getByRole('region', { name: 'Tipos de criação' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome do arquivo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir pesquisa lateral' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Últimos rascunhos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Modelos sugeridos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roteiro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roteiros existentes' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Criar roteiro/i }));

    expect(screen.getByTestId('workspace2-script')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Pesquisa persistente do Workspace' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Roteiro editável' })).toBeInTheDocument();
  }, 10000);

  it('shows an error with retry (no demo data) when the archive fails outside the demo session', async () => {
    mediaApi.listMediaAssets.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{ id: 'real-1', title: 'Mídia real', asset_type: 'video', duration: 8, stream_url: '/real.mp4' }]);
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    expect(await screen.findByText('Não foi possível carregar o Acervo: offline')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /2\s*Montar roteiro/i }));
    expect(screen.queryByText('Entrevista Prefeito')).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: /Abertura — Apresentador/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect((await screen.findAllByText('Mídia real')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Não foi possível carregar o Acervo:/)).not.toBeInTheDocument();
  });

  it('shows demonstrative media and numbered script blocks when the archive is unavailable (demo session only)', async () => {
    localStorage.setItem('mm_demo_session_v1', JSON.stringify({ id: 'demo' }));
    mediaApi.listMediaAssets.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /2\s*Montar roteiro/i }));

    expect((await screen.findAllByText('Entrevista Prefeito')).length).toBeGreaterThan(0);
    expect(screen.getByRole('article', { name: /Bloco 1:/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Detalhes do bloco 1/i })).toBeInTheDocument();
  });
  it('keeps the media search in a sliding left drawer across Roteiro and Timeline', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.queryByTestId('workspace2-search')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar mídias' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Travar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2\s*montar roteiro/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pesquisa lateral' }));
    fireEvent.change(screen.getByLabelText('Nome do arquivo'), { target: { value: 'enchente' } });
    expect(screen.getByLabelText('Nome do arquivo')).toHaveValue('enchente');
    expect(screen.getByTestId('workspace-stage-shell').style.gridTemplateColumns).toContain('300px');
    fireEvent.click(screen.getByRole('button', { name: 'Recolher pesquisa lateral' }));

    expect(screen.getByTestId('workspace2-script')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pesquisa lateral' }));
    expect(screen.getByLabelText('Nome do arquivo')).toHaveValue('enchente');

    fireEvent.click(screen.getByRole('button', { name: /3\s*timeline/i }));
    expect(localStorage.getItem('mm_workspace2_timeline2_draft')).toContain('tracks');
    expect(screen.getByLabelText('Nome do arquivo')).toHaveValue('enchente');
  }, 15000);

  it('keeps search outside the steps and opens it as a drawer that pushes content', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Pesquisa' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nome do arquivo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /2\s*Montar roteiro/i }));
    expect(screen.getByRole('button', { name: 'Abrir pesquisa lateral' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pesquisa lateral' }));
    expect(screen.getByRole('complementary', { name: 'Pesquisa persistente do Workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts in Criar because Pesquisa is now an exclusive menu page', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    expect(screen.getByTestId('workspace2-create')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1\s*Informações iniciais/i })).toBeInTheDocument();
  });

  it('makes search results draggable to the active Workspace area', async () => {
    mediaApi.listMediaAssets.mockResolvedValueOnce([{ id: 'real-1', title: 'Entrevista real', filename: 'entrevista.mp4', asset_type: 'video', duration: 12, stream_url: '/real.mp4' }]);
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /2\s*Montar roteiro/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pesquisa lateral' }));
    const result = (await screen.findAllByRole('button', { name: /^Visualizar /i }))[0];
    expect(result.closest('[draggable="true"]')).toBeTruthy();
  });

  it('does not duplicate a selected-media strip outside the side drawer', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    for (const step of [/1\s*Informações iniciais/i, /2\s*Montar roteiro/i, /3\s*Timeline/i, /4\s*Exportar/i]) {
      fireEvent.click(screen.getByRole('button', { name: step }));
      expect(screen.queryByRole('region', { name: 'Mídias selecionadas persistentes' })).not.toBeInTheDocument();
    }

    expect(screen.queryByText(/Mídias selecionadas para Roteiro e Timeline/)).not.toBeInTheDocument();
  }, 10000);

  it('saves and resets the local Workspace 2 draft', () => {
    localStorage.clear();
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar projeto' }));
    expect(localStorage.getItem('mm_workspace2_draft')).toContain('selectedIds');
    expect(screen.getByRole('status')).toHaveTextContent(/salvo localmente/i);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Resetar projeto' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/salvo localmente/i);
    expect(localStorage.getItem('mm_workspace2_draft')).toContain('selectedIds');
    fireEvent.click(screen.getByRole('button', { name: 'Resetar projeto' }));
    expect(screen.getByRole('status')).toHaveTextContent(/restaurado/i);
    confirm.mockRestore();
  });

  it('labels the deferred save action honestly', () => {
    localStorage.clear();
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Salvar e continuar depois/ })).toBeInTheDocument();
    expect(screen.queryByText(/Salvar e não continuar/)).not.toBeInTheDocument();
  });

  it('prepares the shared project and opens Timeline 2', () => {
    localStorage.clear();
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /3\s*timeline/i }));

    const saved = JSON.parse(localStorage.getItem('mm_workspace2_timeline2_draft'));
    expect(saved.name).toBe('Jornal 12h - 15/05/2026');
    expect(saved.tracks).toHaveLength(5);
  });

  it('switches between Timeline and export using the main steps', () => {
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /3\s*Timeline/i }));

    expect(screen.getByRole('tab', { name: 'Timeline atual', selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /4\s*Exportar/i }));
    expect(screen.getByTestId('workspace2-export')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /3\s*Timeline/i }));
    expect(screen.getByRole('tab', { name: 'Timeline atual', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Timeline 2' })).toBeInTheDocument();
  }, 10000);

  it('shows an expandable upload receipt with file, storage, protocol and SHA-256', async () => {
    mediaApi.uploadMediaAsset.mockResolvedValue({
      id: '51acbd30-7da0-4f58-b7b5-651f8af72af1', filename: 'entrevista final.mp4',
      title: 'Entrevista final', asset_type: 'video', mime_type: 'video/mp4', file_size: 123456,
      sha256: 'c986372cb64bb5d854d6d97a58e6a893564850db144f18b23daea00fcb72d5a5',
      stream_url: '/api/v1/media/assets/51acbd30-7da0-4f58-b7b5-651f8af72af1/stream',
      created_date: '2026-09-29T21:37:00Z', media_status: 'uploaded',
    });
    render(<MemoryRouter><Workspace2 /></MemoryRouter>);

    const file = new File(['conteudo-real'], 'entrevista final.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('Importar mídias'), { target: { files: [file] } });

    expect(await screen.findByText('Upload confirmado')).toBeInTheDocument();
    expect(screen.getByText('entrevista final.mp4')).toBeInTheDocument();
    expect(screen.getByText(/MM-51ACBD30-C986372C/)).toBeInTheDocument();
    expect(screen.getByText(/c986372cb64bb5d/)).toBeInTheDocument();
    expect(screen.getByText(/Armazenamento local persistente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar comprovantes de upload' }));
    expect(screen.queryByText('entrevista final.mp4')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar comprovantes de upload' })).toBeInTheDocument();
  });

  it("opens the media from the /workspace?assetId= deep link (and the ?asset= alias)", async () => {
    mediaApi.listMediaAssets.mockResolvedValue([
      { id: "a", title: "Primeira", asset_type: "video", stream_url: "/a" },
      { id: "b", title: "Entrevista do link", asset_type: "video", stream_url: "/b" },
    ]);
    const { unmount } = render(<MemoryRouter initialEntries={["/workspace?assetId=b"]}><Workspace2 /></MemoryRouter>);
    expect(await screen.findByText("Mídia aberta pelo link: Entrevista do link")).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("mm_workspace_media_selection") || "[]")).toContain("b"));
    unmount();
    localStorage.clear();

    render(<MemoryRouter initialEntries={["/workspace?asset=a"]}><Workspace2 /></MemoryRouter>);
    expect(await screen.findByText("Mídia aberta pelo link: Primeira")).toBeInTheDocument();
  });

  it("tells the user when the linked media is not in this company archive", async () => {
    mediaApi.listMediaAssets.mockResolvedValue([{ id: "a", title: "Primeira", asset_type: "video" }]);
    render(<MemoryRouter initialEntries={["/workspace?assetId=zzz"]}><Workspace2 /></MemoryRouter>);
    expect(await screen.findByText("A mídia do link não foi encontrada no Acervo desta empresa.")).toBeInTheDocument();
  });
});
