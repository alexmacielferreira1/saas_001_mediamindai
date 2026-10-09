import { describe, expect, it } from 'vitest';
import { appendScriptBlock, appendTextBlock, removeScriptBlock, reorderScriptBlocks, toggleSelectedAsset } from './workspace2Model';

describe('Workspace 2 shared state', () => {
  it('adds and removes a selected asset without duplicates', () => {
    expect(toggleSelectedAsset([], 'asset-1')).toEqual(['asset-1']);
    expect(toggleSelectedAsset(['asset-1'], 'asset-1')).toEqual([]);
    expect(toggleSelectedAsset(['asset-1'], 'asset-2')).toEqual(['asset-1', 'asset-2']);
  });

  it('creates one media block and keeps the original list immutable', () => {
    const blocks = [];
    const asset = { id: 'asset-1', title: 'Entrevista', duration: 90, asset_type: 'video' };

    const next = appendScriptBlock(blocks, asset);

    expect(blocks).toEqual([]);
    expect(next).toEqual([
      expect.objectContaining({ assetId: 'asset-1', title: 'Entrevista', duration: 90, type: 'media' }),
    ]);
  });

  it('removes only the requested block', () => {
    const blocks = [{ id: 'one' }, { id: 'two' }];
    expect(removeScriptBlock(blocks, 'one')).toEqual([{ id: 'two' }]);
  });

  it('adds an editable text block with a stable title', () => {
    expect(appendTextBlock([], 'Abertura do jornal')).toEqual([
      expect.objectContaining({ type: 'text', title: 'Abertura do jornal', text: 'Abertura do jornal' }),
    ]);
  });

  it('reorders a dragged block before the drop target without mutating the source', () => {
    const blocks = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
    const reordered = reorderScriptBlocks(blocks, 'three', 'one');
    expect(reordered.map((block) => block.id)).toEqual(['three', 'one', 'two']);
    expect(blocks.map((block) => block.id)).toEqual(['one', 'two', 'three']);
  });
});
