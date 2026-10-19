import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const { exportMediaClip } = vi.hoisted(() => ({ exportMediaClip: vi.fn() }));
vi.mock('../../../../api/media', () => ({ exportMediaClip }));
vi.mock('../../../auth', () => ({ useAuth: () => ({ user: {} }) }));
vi.mock('../../../lib/empresaContext', () => ({ useEmpresa: () => ({ current: 'tenant', isGlobal: false }) }));
vi.mock('../../../lib/clipEngineService', () => ({ createVersion: vi.fn(), listVersions: vi.fn().mockResolvedValue([]), setCurrentVersion: vi.fn() }));
import ClipReimportPanel from './ClipReimportPanel';

describe('exportação do corte', () => {
  it('requests a real MP4 for the selected interval and makes it available to download', async () => {
    exportMediaClip.mockResolvedValue({ blob: new Blob(['mp4'], { type: 'video/mp4' }), filename: 'corte.mp4' });
    URL.createObjectURL = vi.fn(() => 'blob:exportado');
    URL.revokeObjectURL = vi.fn();
    render(<ClipReimportPanel clip={{ id: 'clip-test', source_asset_id: 'asset-1', in_ms: 2000, out_ms: 8000, legendas: [], cgs: [] }} onChange={vi.fn()} onProsseguir={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar MP4 do trecho' }));
    await waitFor(() => expect(exportMediaClip).toHaveBeenCalledWith({ asset_id: 'asset-1', source_in: 2, duration: 6, properties: {} }));
    expect(await screen.findByRole('link', { name: 'Baixar MP4 gerado' })).toHaveAttribute('href', 'blob:exportado');
  });
  it('uploads the chosen source when an asset is not yet available before exporting', async () => {
    exportMediaClip.mockClear().mockResolvedValue({ blob: new Blob(['mp4']), filename: 'corte.mp4' });
    const onEnsureAsset = vi.fn().mockResolvedValue('asset-uploaded');
    render(<ClipReimportPanel clip={{ id: 'clip-test', in_ms: 0, out_ms: 3000, legendas: [], cgs: [] }} onEnsureAsset={onEnsureAsset} onChange={vi.fn()} onProsseguir={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gerar MP4 do trecho' }));
    await waitFor(() => expect(exportMediaClip).toHaveBeenCalledWith({ asset_id: 'asset-uploaded', source_in: 0, duration: 3, properties: {} }));
  });
});
