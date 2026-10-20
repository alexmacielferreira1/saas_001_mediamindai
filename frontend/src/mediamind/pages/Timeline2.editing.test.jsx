import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Timeline2 from './Timeline2';
import { addMediaClip, createTimeline2Document } from '../lib/timeline2Model';

const mediaApi = vi.hoisted(() => ({
  listMediaAssets: vi.fn(),
  uploadMediaAsset: vi.fn(),
  exportMediaClip: vi.fn(),
  exportTimeline: vi.fn(),
}));

vi.mock('../../api/media', () => ({
  ...mediaApi,
  mediaStreamUrl: (asset) => asset.stream_url,
}));

const assets = [
  { id: 'asset-a', filename: 'entrevista.mp4', title: 'Entrevista real', asset_type: 'video', duration: 20, stream_url: '/a.mp4' },
  { id: 'asset-b', filename: 'trilha.mp3', title: 'Trilha sonora', asset_type: 'audio', duration: 30, stream_url: '/b.mp3' },
];

const saved = (id = 'editing-project') => JSON.parse(localStorage.getItem(`mm_timeline2_project:${id}`));
const clipsOn = (trackId) => within(screen.getByTestId(`timeline2-track-${trackId}`).querySelector('[data-track-canvas]')).queryAllByRole('button');

function renderDraft(build) {
  const draft = build(createTimeline2Document({ id: 'editing-project' }));
  localStorage.setItem('mm_workspace2_timeline2_draft', JSON.stringify(draft));
  return render(<Timeline2 />);
}

const twoClips = (document) => addMediaClip(addMediaClip(document, { id: 'asset-a', clipId: 'c1', name: 'Primeiro', kind: 'video', duration: 4, src: '/a.mp4' }, { trackId: 'v1', start: 0 }), { id: 'asset-a', clipId: 'c2', name: 'Segundo', kind: 'video', duration: 4, src: '/a.mp4' }, { trackId: 'v1', start: 4 });

describe('Timeline 2 editing features adapted from OpenCut', () => {
  beforeEach(() => {
    localStorage.clear();
    mediaApi.listMediaAssets.mockReset().mockResolvedValue(assets);
  });

  it('multi-selects with shift-click and ripple deletes the selection when Ripple is on', () => {
    renderDraft((document) => addMediaClip(twoClips(document), { id: 'asset-a', clipId: 'c3', name: 'Terceiro', kind: 'video', duration: 2, src: '/a.mp4' }, { trackId: 'v1', start: 8 }));
    const [first, second] = clipsOn('v1');
    fireEvent.click(first);
    fireEvent.click(second, { shiftKey: true });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/2 clipes selecionados/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ativar ripple ao excluir' }));
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(clipsOn('v1')).toHaveLength(1);
    expect(saved().tracks.find((track) => track.id === 'v1').clips[0]).toMatchObject({ id: 'c3', start: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(clipsOn('v1')).toHaveLength(3);
  });

  it('copies and pastes the selection at the playhead with toolbar buttons and shortcuts', () => {
    renderDraft(twoClips);
    fireEvent.click(clipsOn('v1')[0]);
    expect(screen.getByRole('button', { name: 'Colar no playhead' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar seleção' }));
    fireEvent.keyDown(window, { key: 'End' });
    fireEvent.click(screen.getByRole('button', { name: 'Colar no playhead' }));
    expect(clipsOn('v1')).toHaveLength(3);
    expect(screen.getByLabelText('Posição do clipe')).toHaveValue(8);
    fireEvent.keyDown(window, { key: 'End' });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    expect(clipsOn('v1')).toHaveLength(4);
  });

  it('selects every clip with Ctrl+A and clears with Escape', () => {
    renderDraft(twoClips);
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(clipsOn('v1').every((clip) => clip.getAttribute('aria-pressed') === 'true')).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(clipsOn('v1').some((clip) => clip.getAttribute('aria-pressed') === 'true')).toBe(false);
  });

  it('selects clips by shift-dragging a marquee over the tracks', () => {
    renderDraft(twoClips);
    const canvas = screen.getByTestId('timeline2-track-v1').querySelector('[data-track-canvas]');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1200 });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => canvas) });
    fireEvent.pointerDown(canvas, { clientX: 120, clientY: 10, shiftKey: true, pointerId: 4 });
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 10, pointerId: 4 });
    expect(screen.getByTestId('timeline2-marquee')).toBeInTheDocument();
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 10, pointerId: 4 });
    const [first, second] = clipsOn('v1');
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('2 clipe(s) selecionado(s) por área.');
  });

  it('splits all clips under the playhead with S when nothing is selected', () => {
    renderDraft((document) => addMediaClip(twoClips(document), { id: 'asset-b', clipId: 'm1', name: 'Música', kind: 'audio', duration: 8, src: '/b.mp3' }, { trackId: 'a2', start: 0 }));
    fireEvent.change(screen.getByLabelText('Playhead'), { target: { value: '2' } });
    fireEvent.keyDown(window, { key: 's' });
    expect(clipsOn('v1')).toHaveLength(3);
    expect(clipsOn('a2')).toHaveLength(2);
  });

  it('extracts the IN/OUT interval from unlocked tracks', () => {
    renderDraft((document) => ({ ...twoClips(document), inPoint: 1, outPoint: 3 }));
    fireEvent.click(screen.getByRole('button', { name: 'Extrair intervalo IN/OUT' }));
    const v1 = saved().tracks.find((track) => track.id === 'v1').clips;
    expect(v1.map((clip) => [clip.start, clip.duration])).toEqual([[0, 1], [1, 1], [2, 4]]);
    expect(screen.getByTestId('timeline-in-point')).toHaveTextContent('—');
  });

  it('renames, reorders and mutes tracks from the track header', () => {
    renderDraft(twoClips);
    fireEvent.click(screen.getByRole('button', { name: 'Renomear B-roll e apoio' }));
    const input = screen.getByLabelText('Nome da trilha v2');
    fireEvent.change(input, { target: { value: 'Câmera 2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(screen.getByRole('button', { name: 'Renomear Câmera 2' })).toBeInTheDocument();

    const rows = () => Array.from(document.querySelectorAll('[data-track-id]')).map((row) => row.dataset.trackId);
    expect(rows()).toEqual(['t1', 'v2', 'v1', 'a1', 'a2']);
    fireEvent.click(screen.getByRole('button', { name: 'Descer Câmera 2' }));
    expect(rows()).toEqual(['t1', 'v1', 'v2', 'a1', 'a2']);
    expect(screen.getByRole('button', { name: 'Descer Câmera 2' })).toBeDisabled();
    expect(screen.getByTestId('preview-layer-c1').dataset.layer).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Silenciar Vídeo principal' }));
    expect(screen.getByTestId('preview-layer-c1').muted).toBe(true);
  });

  it('uses the project frame rate for timecode and frame stepping', () => {
    renderDraft(twoClips);
    fireEvent.change(screen.getByLabelText('Taxa de quadros do projeto'), { target: { value: '25' } });
    expect(screen.getByText(/· 25 fps/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo quadro' }));
    expect(Number(screen.getByLabelText('Playhead').value)).toBeCloseTo(0.04, 5);
    fireEvent.change(screen.getByLabelText('Playhead'), { target: { value: '1.5' } });
    expect(screen.getAllByText('00:00:01:12').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Quadro anterior' }));
    expect(Number(screen.getByLabelText('Playhead').value)).toBeCloseTo(1.44, 5);
  });

  it('shows color effects and fades in the preview', () => {
    renderDraft(twoClips);
    fireEvent.click(clipsOn('v1')[0]);
    fireEvent.change(screen.getByLabelText('Saturação'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Desfoque'), { target: { value: '4' } });
    expect(screen.getByTestId('preview-layer-c1').style.filter).toBe('saturate(0) blur(4px)');
    fireEvent.change(screen.getByLabelText('Fade de entrada'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Playhead'), { target: { value: '1' } });
    expect(screen.getByTestId('preview-layer-c1').style.opacity).toBe('0.5');
  });

  it('applies a crossfade between adjacent clips and shows both layers during it', () => {
    renderDraft(twoClips);
    fireEvent.click(clipsOn('v1')[0]);
    expect(screen.getByText(/Encoste este clipe ao anterior/)).toBeInTheDocument();
    fireEvent.click(clipsOn('v1')[1]);
    fireEvent.change(screen.getByLabelText('Tipo de transição de entrada'), { target: { value: 'crossfade' } });
    expect(screen.getByTestId('transition-c2')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Playhead'), { target: { value: '4.5' } });
    expect(screen.getByTestId('preview-layer-c1')).toHaveAttribute('data-transition-role', 'outgoing');
    expect(screen.getByTestId('preview-layer-c2').style.opacity).toBe('0.5');
  });

  it('changes speed keeping the source span', () => {
    renderDraft(twoClips);
    fireEvent.click(clipsOn('v1')[1]);
    fireEvent.change(screen.getByLabelText('Velocidade'), { target: { value: '0.5' } });
    expect(saved().tracks.find((track) => track.id === 'v1').clips[1]).toMatchObject({ duration: 8, sourceOut: 4 });
  });

  it('adds text presets and stickers to the text track', () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: 'Elementos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar texto Tarja (lower third)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar sticker 🔥' }));
    const project = JSON.parse(localStorage.getItem('mm_timeline2_project:timeline2-local'));
    expect(project.tracks.find((track) => track.id === 't1').clips.map((clip) => clip.properties.text)).toEqual(['Nome · Cargo']);
    expect(project.tracks.find((track) => track.id === 't2').clips[0]).toMatchObject({ duration: 3, properties: expect.objectContaining({ text: '🔥', fontSize: 96 }) });
    expect(screen.getByRole('status')).toHaveTextContent('Sticker 🔥 adicionado no playhead em Texto 2.');
  });

  it('filters the media library by search text', async () => {
    render(<Timeline2 />);
    fireEvent.click(screen.getByRole('button', { name: /Acervo/i }));
    await screen.findByRole('button', { name: 'Adicionar Entrevista real' });
    fireEvent.change(screen.getByLabelText('Pesquisar na biblioteca'), { target: { value: 'trilha' } });
    expect(screen.queryByRole('button', { name: 'Adicionar Entrevista real' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar Trilha sonora' })).toBeInTheDocument();
  });

  it('refuses a drop on an incompatible track with a clear message instead of a false success', () => {
    render(<Timeline2 />);
    const canvas = screen.getByTestId('timeline2-track-a1').querySelector('[data-track-canvas]');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1200 });
    const drop = createEvent.drop(canvas, { dataTransfer: { getData: (type) => (type === 'application/x-timeline2-media' ? JSON.stringify({ id: 'asset-a', name: 'Entrevista real', kind: 'video', duration: 20, src: '/a.mp4' }) : '') } });
    Object.defineProperty(drop, 'clientX', { value: 100 });
    fireEvent(canvas, drop);
    expect(screen.getByRole('status')).toHaveTextContent('Solte este item em uma trilha de vídeo.');
    expect(clipsOn('a1')).toHaveLength(0);
  });

  it('explains what the sequence export contains and opens the shortcuts list', () => {
    renderDraft((document) => addMediaClip(twoClips(document), { id: 'asset-b', clipId: 'm1', name: 'Música', kind: 'audio', duration: 8, src: '/b.mp3' }, { trackId: 'a2', start: 0 }));
    fireEvent.click(screen.getByRole('button', { name: 'O que entra no MP4' }));
    const panel = screen.getByRole('region', { name: 'Conteúdo da exportação da sequência' });
    expect(panel).toHaveTextContent('2 clipe(s) do Acervo');
    expect(panel).toHaveTextContent('Trilha e efeitos (a2): 1 clipe(s) não entram no arquivo');
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Atalhos de teclado da Timeline 2' })).toHaveTextContent('Ctrl + C / Ctrl + V');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar atalhos' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fits the zoom to the sequence length', () => {
    renderDraft((document) => addMediaClip(document, { id: 'asset-a', clipId: 'long', name: 'Longo', kind: 'video', duration: 600, src: '/a.mp4' }, { trackId: 'v1', start: 0 }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar zoom à sequência' }));
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});
