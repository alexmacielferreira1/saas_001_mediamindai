import { describe, expect, it } from 'vitest';
import { AI_TOOLS, getAITool } from './aiToolsRegistry';

describe('aiToolsRegistry', () => {
  it('exposes the eleven requested tools with stable unique ids', () => {
    expect(AI_TOOLS.map((tool) => tool.id)).toEqual([
      'thumbnails', 'carousel', 'frames', 'auto-clips', 'video-studio',
      'speech-montage', 'sales-videos', 'affiliate-videos', 'trend-radar',
      'animated-videos', 'ai-dubbing',
    ]);
    expect(new Set(AI_TOOLS.map((tool) => tool.id))).toHaveLength(11);
  });

  it('distinguishes native, integrated and planned entry points', () => {
    expect(getAITool('thumbnails')).toMatchObject({ status: 'available', href: '/thumbnails' });
    expect(getAITool('carousel')).toMatchObject({ status: 'available' });
    expect(AI_TOOLS.filter((tool) => tool.status === 'integrated').map((tool) => tool.id)).toEqual([
      'auto-clips', 'video-studio', 'speech-montage',
    ]);
    expect(AI_TOOLS.filter((tool) => tool.status === 'planned')).toHaveLength(4);
  });
});
