import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { exportMediaClip } = vi.hoisted(() => ({ exportMediaClip: vi.fn() }));
const engine = vi.hoisted(() => ({
  listCandidates: vi.fn(), updateCandidate: vi.fn(), ensureTranscription: vi.fn(), runAnalysis: vi.fn(),
  promoteCandidate: vi.fn(), getAsset: vi.fn(), createVersion: vi.fn(), listVersions: vi.fn(() => Promise.resolve([])), setCurrentVersion: vi.fn(),
}));
vi.mock('../../../../api/media', () => ({ exportMediaClip, resolveMediaUrl: (url) => url, listMediaAssets: vi.fn(() => Promise.resolve([])), uploadMediaAsset: vi.fn() }));
vi.mock('../../../auth', () => ({ useAuth: () => ({ user: {} }) }));
vi.mock('../../../lib/empresaContext', () => ({ useEmpresa: () => ({ current: 'tenant', isGlobal: false }) }));
vi.mock('../../../lib/clipEngineService', () => engine);

import ClipLegendasPanel from './ClipLegendasPanel';
import ClipPlayer from './ClipPlayer';
import ClipReimportPanel from './ClipReimportPanel';
import ClipCandidatesPanel from './ClipCandidatesPanel';

const evidence = [
  { text: 'Vacinas', start: 1, end: 1.5 },
  { text: 'protegem', start: 1.5, end: 2.2 },
  { text: 'todos', start: 2.2, end: 2.8 },
];
const analysisCandidate = { id: 'cand-1', quote: 'Vacinas protegem todos', start: 1, end: 20, score: 72, dimensions: { hook: 20, flow: 18, value: 19, shareability: 15 }, evidence };

function Panel({ initial }) {
  const [clip, setClip] = useState({ id: 'clip-a', in_ms: 0, out_ms: 30000, viral: [], legendas: [], cortes_audio: [], cortes_video: [], ...initial });
  return <><ClipLegendasPanel clip={clip} onChange={(patch) => setClip((c) => ({ ...c, ...patch }))} seekTo={() => {}} onSalvar={() => {}} /><output data-testid="state">{JSON.stringify(clip)}</output></>;
}
const state = () => JSON.parse(screen.getByTestId('state').textContent);

describe('legendas do CLIPSFREE', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates captions from the real word timing of the session analysis', () => {
    render(<Panel initial={{ analysis_candidates: [analysisCandidate] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar legendas' }));
    const [cue] = state().legendas;
    expect(cue).toMatchObject({ start_ms: 1000, end_ms: 2800, texto: 'Vacinas protegem todos' });
    expect(cue.palavras).toHaveLength(3);
    expect(screen.getByText(/3 palavra\(s\) com tempo real/)).toBeInTheDocument();
  });

  it('splits without duplicating text and merges back with the next caption', () => {
    render(<Panel initial={{ legendas: [{ id: 'c1', start_ms: 0, end_ms: 4000, texto: 'um dois tres quatro' }] }} />);
    fireEvent.click(screen.getByTitle('Dividir'));
    expect(state().legendas.map((c) => c.texto)).toEqual(['um dois', 'tres quatro']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Unir com a próxima' })[0]);
    expect(state().legendas).toEqual([expect.objectContaining({ start_ms: 0, end_ms: 4000, texto: 'um dois tres quatro' })]);
  });

  it('applies a style template to every caption and stores appearance settings', () => {
    render(<Panel initial={{ legendas: [{ id: 'a', start_ms: 0, end_ms: 1000, texto: 'A' }, { id: 'b', start_ms: 1000, end_ms: 2000, texto: 'B' }] }} />);
    fireEvent.change(screen.getByLabelText('Modelo de legenda'), { target: { value: 'karaoke' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar modelo a todas' }));
    fireEvent.change(screen.getByLabelText('Máximo de caracteres por linha'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('Palavras em destaque'), { target: { value: 'vacina' } });
    const current = state();
    expect(current.legenda_estilo).toBe('karaoke');
    expect(current.legendas.every((c) => c.estilo === 'karaoke')).toBe(true);
    expect(current.legenda_config).toMatchObject({ maxChars: 18, keywords: 'vacina' });
  });

  it('imports SRT relative to IN and reports invalid files', async () => {
    render(<Panel initial={{ in_ms: 5000 }} />);
    const input = screen.getByLabelText('Importar legendas SRT ou VTT');
    const srt = new File(['1\n00:00:01,000 --> 00:00:02,500\nOlá\n'], 'a.srt', { type: 'text/plain' });
    srt.text = () => Promise.resolve('1\n00:00:01,000 --> 00:00:02,500\nOlá\n');
    fireEvent.change(input, { target: { files: [srt] } });
    await waitFor(() => expect(state().legendas).toEqual([expect.objectContaining({ start_ms: 6000, end_ms: 7500, texto: 'Olá' })]));
    const bad = new File(['x'], 'b.srt');
    bad.text = () => Promise.resolve('sem tempos');
    fireEvent.change(input, { target: { files: [bad] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Nenhuma legenda válida');
  });

  it('flags invalid timing and the vertical safe area without blocking edits', () => {
    render(<Panel initial={{ formato: '9:16', legendas: [{ id: 'a', start_ms: 3000, end_ms: 1000, texto: 'Oi' }] }} />);
    const check = screen.getByLabelText('Verificação das legendas');
    expect(check).toHaveTextContent('o fim precisa ser posterior ao início');
    expect(check).toHaveTextContent('vertical 9:16');
  });

  it('keeps word timing when only spelling changes', () => {
    render(<Panel initial={{ analysis_candidates: [analysisCandidate] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar legendas' }));
    fireEvent.change(screen.getByLabelText('Texto da legenda'), { target: { value: 'Vacinas protegem todas' } });
    expect(state().legendas[0].palavras.map((w) => w.text)).toEqual(['Vacinas', 'protegem', 'todas']);
  });
});

describe('prévia do player', () => {
  it('highlights the active timed word with the karaoke template', () => {
    const captions = [{ id: 'c', start_ms: 0, end_ms: 3000, texto: 'Vacinas protegem', estilo: 'karaoke', palavras: [{ text: 'Vacinas', start_ms: 0, end_ms: 1000 }, { text: 'protegem', start_ms: 1000, end_ms: 3000 }] }];
    const { container } = render(<ClipPlayer source_url="/v.mp4" captions={captions} />);
    const video = container.querySelector('video');
    video.currentTime = 1.5;
    fireEvent.timeUpdate(video);
    const preview = screen.getByLabelText('Legenda em prévia');
    expect(within(preview).getByText('PROTEGEM')).toHaveAttribute('data-active-word', 'true');
    expect(within(preview).getByText('VACINAS')).not.toHaveAttribute('data-active-word');
  });

  it('keeps the original preview without settings and offers the framing guide only with a format', () => {
    const { rerender, container } = render(<ClipPlayer source_url="/v.mp4" captions={[{ id: 'c', start_ms: 0, end_ms: 1000, texto: 'Texto simples' }]} />);
    fireEvent.timeUpdate(container.querySelector('video'));
    expect(screen.getByLabelText('Legenda em prévia')).toHaveTextContent('Texto simples');
    expect(screen.queryByRole('button', { name: /Guia/ })).not.toBeInTheDocument();
    rerender(<ClipPlayer source_url="/v.mp4" format="9:16" focusX={0.2} />);
    fireEvent.click(screen.getByRole('button', { name: /Guia 9:16 e área segura/ }));
    expect(screen.getByLabelText('Guia de enquadramento 9:16')).toBeInTheDocument();
    expect(container.querySelector('video').style.objectPosition).toBe('20% 50%');
  });
});

describe('exportação com legendas e formato', () => {
  it('sends burn-in, aspect and internal cuts to the real exporter', async () => {
    exportMediaClip.mockResolvedValue({ blob: new Blob(['mp4']), filename: 'corte.mp4' });
    URL.createObjectURL = vi.fn(() => 'blob:mp4');
    URL.revokeObjectURL = vi.fn();
    const clip = { id: 'clip-x', source_asset_id: 'asset-1', formato: '9:16', in_ms: 1000, out_ms: 6000, legendas: [{ id: 'l', start_ms: 2000, end_ms: 3000, texto: 'Oi' }], cgs: [], cortes_video: [{ start_ms: 4000, end_ms: 5000 }] };
    render(<ClipReimportPanel clip={clip} onChange={vi.fn()} onProsseguir={vi.fn()} />);
    expect(screen.getByLabelText('Formato do MP4')).toHaveValue('9:16');
    fireEvent.click(screen.getByRole('button', { name: 'Gerar MP4 do trecho' }));
    await waitFor(() => expect(exportMediaClip).toHaveBeenCalled());
    const { properties } = exportMediaClip.mock.calls[0][0];
    expect(properties.clip_render).toMatchObject({ aspect: '9:16', captions: [{ start: 1, end: 2, text: 'Oi' }], skip: [{ start: 3, end: 4 }] });
    expect(await screen.findByRole('link', { name: 'Baixar MP4 gerado' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Gravar legendas no vídeo'));
    expect(screen.queryByRole('link', { name: 'Baixar MP4 gerado' })).not.toBeInTheDocument();
  });

  it('shows the real error and no download when the export fails', async () => {
    exportMediaClip.mockRejectedValueOnce(new Error('Não foi possível exportar este clipe.'));
    render(<ClipReimportPanel clip={{ id: 'clip-y', source_asset_id: 'a', in_ms: 0, out_ms: 2000, legendas: [], cgs: [] }} onChange={vi.fn()} onProsseguir={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar MP4 do trecho' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível exportar');
    expect(screen.queryByRole('link', { name: 'Baixar MP4 gerado' })).not.toBeInTheDocument();
  });
});

describe('candidatos no editor', () => {
  it('uses the session analysis with its score breakdown instead of external services', async () => {
    const onChange = vi.fn();
    render(<ClipCandidatesPanel clip={{ source_asset_id: 'asset-1', in_ms: 0, out_ms: 30000, analysis_candidates: [analysisCandidate] }} onChange={onChange} seekTo={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Detalhes da nota 72/ }));
    expect(screen.getByText('20/25')).toBeInTheDocument();
    expect(engine.listCandidates).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Promover a Clip/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Melhorar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar como IN/OUT' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ in_ms: 1000, out_ms: 20000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    expect(onChange).toHaveBeenCalledWith({ viral: [expect.objectContaining({ id: 'cand-1', texto: 'Vacinas protegem todos', evidence })] });
  });

  it('never replaces a failed load or analysis with demonstration candidates', async () => {
    engine.listCandidates.mockRejectedValueOnce(new Error('offline'));
    render(<ClipCandidatesPanel clip={{ source_asset_id: 'asset-2', in_ms: 0, out_ms: 30000 }} onChange={vi.fn()} seekTo={vi.fn()} />);
    expect(await screen.findByText(/Não foi possível carregar os candidatos/)).toBeInTheDocument();
    engine.getAsset.mockRejectedValueOnce(new Error('sem IA'));
    fireEvent.click(screen.getByRole('button', { name: 'Processar IA' }));
    expect(await screen.findByText(/nenhum candidato foi gerado/)).toBeInTheDocument();
    expect(screen.queryByText(/Melhorar a mobilidade/)).not.toBeInTheDocument();
  });
});
