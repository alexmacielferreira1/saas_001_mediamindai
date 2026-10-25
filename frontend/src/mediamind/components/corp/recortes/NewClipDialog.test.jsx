import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAssets = vi.fn();
vi.mock('../../../lib/clipEngineService', () => ({
  listAssets: (...args) => listAssets(...args),
  getAsset: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../lib/empresaContext', () => ({ useEmpresa: () => ({ current: 'tenant-1', isGlobal: false }) }));

import NewClipDialog from './NewClipDialog';

describe('NewClipDialog — mídia real do Acervo (achado 13)', () => {
  beforeEach(() => { listAssets.mockReset(); localStorage.removeItem('mm_demo_session_v1'); });

  it('lista mídias enviadas sem empresa_id e grava a URL de reprodução real', async () => {
    listAssets.mockResolvedValue([
      { id: 'a-1', title: 'Entrevista enviada', asset_type: 'video', sha256: 'abc', mime_type: 'video/mp4', duration: 12.5 },
      { id: 'd-1', title: 'Pauta', asset_type: 'document' },
    ]);
    const onCreated = vi.fn();
    render(<NewClipDialog open onClose={() => {}} onCreated={onCreated} />);

    fireEvent.click(await screen.findByText('Entrevista enviada'));
    expect(listAssets).toHaveBeenCalledWith({});
    expect(screen.queryByText('Pauta')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Processar$/ }));

    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      source_asset_id: 'a-1',
      source_url: '/api/v1/media/assets/a-1/stream',
      duration_ms: 12500,
      out_ms: 12500,
    }));
  });
});
