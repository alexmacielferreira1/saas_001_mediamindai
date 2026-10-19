import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ listCandidates: vi.fn(), updateCandidate: vi.fn() }));
vi.mock('../../../lib/empresaContext', () => ({ useEmpresa: () => ({ current: 'empresa-1', isGlobal: false }) }));
vi.mock('../../../lib/clipEngineService', () => ({
  ...api, ensureTranscription: vi.fn(), runAnalysis: vi.fn(), promoteCandidate: vi.fn(), getAsset: vi.fn(),
}));

import ClipCandidatesPanel from './ClipCandidatesPanel';
import ClipLegendasPanel from './ClipLegendasPanel';

function Workspace() {
  const [clip, setClip] = useState({ source_asset_id: 'asset-1', in_ms: 0, out_ms: 30000, viral: [], legendas: [], cortes_audio: [], cortes_video: [] });
  const change = (patch) => setClip((current) => ({ ...current, ...patch }));
  return <><ClipCandidatesPanel clip={clip} onChange={change} seekTo={() => {}} onAvancar={() => {}} /><ClipLegendasPanel clip={clip} onChange={change} seekTo={() => {}} onSalvar={() => {}} /></>;
}

describe('seleção de candidatos para legendas', () => {
  beforeEach(() => {
    api.listCandidates.mockResolvedValue([{ id: 'cut-1', title: 'Entrevista', start_ms: 1000, end_ms: 5000, overall_score: 85, rank: 1, selected: false, transcript: 'Uma fala verdadeira.' }]);
    api.updateCandidate.mockResolvedValue({});
  });

  it('makes the newly selected transcript available for captions and removes it when deselected', async () => {
    render(<Workspace />);
    const select = await screen.findByRole('button', { name: 'Selecionar' });
    expect(screen.getByRole('button', { name: 'Gerar legendas' })).toBeDisabled();
    fireEvent.click(select);
    expect(await screen.findByRole('button', { name: 'Selecionado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar legendas' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionado' }));
    expect(await screen.findByRole('button', { name: 'Selecionar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar legendas' })).toBeDisabled();
  });

  it('removes a rejected selection from captions immediately', async () => {
    render(<Workspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Selecionar' }));
    const selected = await screen.findByRole('button', { name: 'Selecionado' });
    const card = selected.closest('div.rounded-lg');
    fireEvent.click(within(card).getByTitle('Rejeitar'));
    expect(screen.getByRole('button', { name: 'Gerar legendas' })).toBeDisabled();
  });

  it('does not use the AI summary as a spoken transcript for captions', async () => {
    api.listCandidates.mockResolvedValueOnce([{ id: 'cut-2', title: 'Sem transcrição', start_ms: 1000, end_ms: 5000, overall_score: 70, rank: 1, selected: false, summary: 'Resumo editorial do trecho.' }]);
    render(<Workspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Selecionar' }));
    expect(await screen.findByRole('button', { name: 'Selecionado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar legendas' })).toBeDisabled();
  });

  it('generates an editable caption from the selected spoken text', async () => {
    render(<Workspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Selecionar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar legendas' }));
    expect(screen.getByDisplayValue('Uma fala verdadeira.')).toBeInTheDocument();
  });
});
