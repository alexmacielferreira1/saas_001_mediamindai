import React, { useState } from 'react';
import { act, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./ClipCandidatesPanel', () => ({ default: () => null }));
vi.mock('./ClipCGPanel', () => ({ default: () => null }));
vi.mock('./ClipReimportPanel', () => ({ default: () => null }));
vi.mock('./ClipStageResources', () => ({ default: () => null }));

import ClipPlayer from './ClipPlayer';
import ClipWorkspace from './ClipWorkspace';
import ClipLegendasPanel from './ClipLegendasPanel';

function loadVideo(container, seconds = 10) {
  const video = container.querySelector('video');
  Object.defineProperty(video, 'duration', { value: seconds, configurable: true });
  fireEvent.loadedMetadata(video);
  return video;
}
const key = (k, extra = {}) => fireEvent.keyDown(window, { key: k, ...extra });

describe('atalhos e ferramentas do player do corte', () => {
  it('handles J/K/L, frame stepping, IN/OUT and split/delete shortcuts', () => {
    const onSetIn = vi.fn(); const onSetOut = vi.fn(); const onSplitAt = vi.fn(); const onDeleteAt = vi.fn();
    const { container } = render(<ClipPlayer source_url="/clip.mp4" in_ms={1000} out_ms={8000} onSetIn={onSetIn} onSetOut={onSetOut} onSplitAt={onSplitAt} onDeleteAt={onDeleteAt} />);
    const video = loadVideo(container);
    video.play = vi.fn(() => Promise.resolve());
    Object.defineProperty(video, 'paused', { value: true, configurable: true });
    key('k');
    expect(video.play).toHaveBeenCalled();
    video.currentTime = 2;
    key('l');
    expect(video.currentTime).toBe(3);
    key('j');
    expect(video.currentTime).toBe(2);
    key('ArrowRight');
    expect(video.currentTime * 1000).toBeCloseTo(2033.33, 1);
    key('ArrowLeft', { shiftKey: true });
    expect(video.currentTime).toBe(0);
    key('End');
    expect(video.currentTime).toBe(8);
    key('Home');
    expect(video.currentTime).toBe(1);
    video.currentTime = 4;
    key('i'); key('o'); key('s'); key('Delete');
    expect(onSetIn).toHaveBeenCalledWith(4000);
    expect(onSetOut).toHaveBeenCalledWith(4000);
    expect(onSplitAt).toHaveBeenCalledWith(4000);
    expect(onDeleteAt).toHaveBeenCalledWith(4000);
  });

  it('ignores shortcuts while typing in a field', () => {
    const onSplitAt = vi.fn();
    render(<><input aria-label="campo" /><ClipPlayer source_url="/clip.mp4" onSplitAt={onSplitAt} /></>);
    fireEvent.keyDown(screen.getByLabelText('campo'), { key: 's' });
    expect(onSplitAt).not.toHaveBeenCalled();
  });

  it('lists the shortcuts in the timeline tools section', () => {
    render(<ClipPlayer source_url="/clip.mp4" />);
    fireEvent.click(screen.getByText('Ferramentas da timeline e atalhos'));
    const list = screen.getByRole('list', { name: 'Atalhos de teclado do editor' });
    expect(within(list).getByText('Dividir a legenda no cursor')).toBeInTheDocument();
    expect(within(list).getByText('Ctrl + Z')).toBeInTheDocument();
  });

  it('zooms the clip timeline, fits to IN/OUT and maps clicks to the visible window', () => {
    const { container } = render(<ClipPlayer source_url="/clip.mp4" in_ms={2000} out_ms={4000} />);
    const video = loadVideo(container);
    expect(screen.queryByRole('button', { name: 'Ver tudo' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar ao trecho' }));
    const timeline = screen.getByLabelText('Timeline do corte');
    timeline.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 });
    fireEvent.click(timeline, { clientX: 50 });
    expect(video.currentTime).toBeCloseTo(3);
    fireEvent.click(screen.getByRole('button', { name: 'Ver tudo' }));
    fireEvent.click(timeline, { clientX: 50 });
    expect(video.currentTime).toBeCloseTo(5);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom da timeline' }));
    expect(screen.getByRole('button', { name: 'Ver tudo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir zoom da timeline' }));
    expect(screen.queryByRole('button', { name: 'Ver tudo' })).not.toBeInTheDocument();
  });

  it('snaps a dropped text layer to the IN point when the magnet is on', () => {
    const onMoveLayer = vi.fn();
    const { container } = render(<ClipPlayer source_url="/clip.mp4" in_ms={5000} out_ms={9000} overlays={[{ id: 't', tipo: 'titulo', titulo: 'Chamada', start_ms: 0, end_ms: 1000 }]} onMoveLayer={onMoveLayer} />);
    loadVideo(container);
    const lane = screen.getByLabelText('Trilha de textos');
    lane.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 });
    const drop = (x) => { const event = createEvent.drop(lane, { dataTransfer: { getData: () => 't' } }); Object.defineProperty(event, 'clientX', { value: x }); fireEvent(lane, event); };
    drop(48);
    expect(onMoveLayer).toHaveBeenLastCalledWith('t', 4800, 5800);
    fireEvent.click(screen.getByRole('button', { name: /Ímã na trilha de textos/ }));
    drop(48);
    expect(onMoveLayer).toHaveBeenLastCalledWith('t', 5000, 6000);
  });

  it('says honestly that the waveform is unavailable without Web Audio and keeps preview volume local', async () => {
    const { container } = render(<ClipPlayer source_url="blob:local" />);
    const video = loadVideo(container);
    fireEvent.click(screen.getByText('Ferramentas da timeline e atalhos'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Mostrar forma de onda/ })); });
    expect(screen.getByRole('status')).toHaveTextContent('Forma de onda indisponível neste navegador.');
    expect(screen.queryByLabelText('Forma de onda do áudio')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Volume da prévia'), { target: { value: '40' } });
    expect(video.volume).toBeCloseTo(0.4);
    fireEvent.click(screen.getByRole('button', { name: /Silenciar/ }));
    expect(video.muted).toBe(true);
  });

  it('draws the waveform lane when the browser decodes the local audio', async () => {
    const original = window.OfflineAudioContext;
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue({ blob: () => Promise.resolve({ size: 4, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }) });
    window.OfflineAudioContext = class { decodeAudioData() { return Promise.resolve({ numberOfChannels: 1, duration: 10, getChannelData: () => new Float32Array([0.1, 0.9, 0.3, 0.5]) }); } };
    try {
      const { container } = render(<ClipPlayer source_url="blob:local" />);
      loadVideo(container);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Mostrar forma de onda/ })); });
      expect(screen.getByLabelText('Forma de onda do áudio').querySelectorAll('rect').length).toBeGreaterThan(0);
    } finally {
      window.OfflineAudioContext = original;
      fetchSpy.mockRestore();
    }
  });
});

function Workspace({ initial }) {
  const [clip, setClip] = useState({ id: 'w', stage: 'selecao', in_ms: 0, out_ms: 10000, duration_ms: 10000, source_url: '/clip.mp4', viral: [], cgs: [], legendas: [], cortes_audio: [], cortes_video: [], ...initial });
  return <><ClipWorkspace clip={clip} onChange={(p) => setClip((c) => ({ ...c, ...p }))} /><output data-testid="state">{JSON.stringify(clip.legendas)}</output></>;
}
const legendas = () => JSON.parse(screen.getByTestId('state').textContent);

describe('desfazer/refazer e atalhos de legenda no workspace', () => {
  it('splits and deletes the caption under the playhead with S/Delete and undoes with Ctrl+Z', () => {
    const { container } = render(<Workspace initial={{ legendas: [{ id: 'c1', start_ms: 0, end_ms: 4000, texto: 'um dois tres quatro' }] }} />);
    const video = loadVideo(container);
    video.currentTime = 2;
    fireEvent.timeUpdate(video);
    key('s');
    expect(legendas().map((c) => c.texto)).toEqual(['um dois', 'tres quatro']);
    key('Delete');
    expect(legendas().map((c) => c.texto)).toEqual(['um dois']);
    key('z', { ctrlKey: true });
    expect(legendas().map((c) => c.texto)).toEqual(['um dois', 'tres quatro']);
    key('z', { ctrlKey: true });
    expect(legendas().map((c) => c.texto)).toEqual(['um dois tres quatro']);
    key('y', { ctrlKey: true });
    expect(legendas().map((c) => c.texto)).toEqual(['um dois', 'tres quatro']);
  });

  it('shows undo/redo buttons in the captions editor and sets edges from the playhead', () => {
    const { container } = render(<Workspace initial={{ stage: 'ia', legendas: [{ id: 'c1', start_ms: 0, end_ms: 4000, texto: 'um dois' }] }} />);
    const editor = screen.getByRole('complementary', { name: 'Editor de legendas' });
    expect(within(editor).getByRole('button', { name: /Desfazer/ })).toBeDisabled();
    const video = loadVideo(container);
    video.currentTime = 1.5;
    fireEvent.timeUpdate(video);
    fireEvent.click(within(editor).getByRole('button', { name: 'Início no cursor' }));
    expect(legendas()[0].start_ms).toBe(1500);
    fireEvent.click(within(editor).getByRole('button', { name: /Desfazer/ }));
    expect(legendas()[0].start_ms).toBe(0);
    fireEvent.click(within(editor).getByRole('button', { name: /Refazer/ }));
    expect(legendas()[0].start_ms).toBe(1500);
    video.currentTime = 0.5;
    fireEvent.timeUpdate(video);
    fireEvent.click(within(editor).getByRole('button', { name: 'Fim no cursor' }));
    expect(legendas()[0].end_ms).toBe(4000);
  });
});

describe('encaixe de legendas nas palavras', () => {
  function Panel({ initial }) {
    const [clip, setClip] = useState({ id: 'p', in_ms: 0, out_ms: 30000, viral: [], legendas: [], cortes_audio: [], cortes_video: [], ...initial });
    return <><ClipLegendasPanel clip={clip} onChange={(p) => setClip((c) => ({ ...c, ...p }))} seekTo={() => {}} onSalvar={() => {}} /><output data-testid="panel">{JSON.stringify(clip.legendas)}</output></>;
  }
  it('snaps caption edges to the real word timing and reports when nothing changed', () => {
    const palavras = [{ text: 'Olá', start_ms: 1000, end_ms: 1400 }, { text: 'mundo', start_ms: 1500, end_ms: 2000 }];
    render(<Panel initial={{ legendas: [{ id: 'a', start_ms: 1150, end_ms: 2200, texto: 'Olá mundo', palavras }] }} />);
    expect(screen.queryByRole('button', { name: /Desfazer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Início no cursor' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Encaixar nos limites das palavras' }));
    expect(JSON.parse(screen.getByTestId('panel').textContent)[0]).toMatchObject({ start_ms: 1000, end_ms: 2000 });
    expect(screen.getByText('1 legenda(s) encaixada(s) nos limites das palavras.')).toHaveAttribute('role', 'status');
    fireEvent.click(screen.getByRole('button', { name: 'Encaixar nos limites das palavras' }));
    expect(screen.getByText(/Nenhuma legenda estava a até 400 ms/)).toHaveAttribute('role', 'status');
  });
});
