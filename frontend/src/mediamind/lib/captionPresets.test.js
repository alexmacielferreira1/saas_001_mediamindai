import { describe, expect, it } from 'vitest';
import { CAPTION_PRESETS, captionPresetToProperties, getCaptionPreset } from './captionPresets';

describe('caption preset library', () => {
  it('includes every AI Edita Legendas Pro v2 style plus MediaMind originals', () => {
    const aiEdita = CAPTION_PRESETS.filter((preset) => preset.source === 'AI Edita Legendas Pro v2');
    const mediaMind = CAPTION_PRESETS.filter((preset) => preset.source === 'MediaMind AI');

    expect(aiEdita).toHaveLength(32);
    expect(mediaMind.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CAPTION_PRESETS.map((preset) => preset.id)).size).toBe(CAPTION_PRESETS.length);
  });

  it('turns a selected preset into editable timeline text properties', () => {
    const preset = getCaptionPreset('ai-edita-legendas-pro-v2-neon-ciano');
    const properties = captionPresetToProperties(preset, 'ENERGIA DIGITAL');

    expect(properties).toMatchObject({
      text: 'ENERGIA DIGITAL',
      caption: true,
      captionPresetId: preset.id,
      color: '#c9fbff',
      outlineColor: '#007985',
      animation: 'pulse',
    });
    expect(properties.fontSize).toBeGreaterThan(30);
  });
});
