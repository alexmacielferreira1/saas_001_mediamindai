import { describe, expect, it } from 'vitest';
import { removeConnectedBackground } from './thumbnailImage';

describe('thumbnail person cutout', () => {
  it('removes only background connected to the image edges', () => {
    const pixels = new Uint8ClampedArray([
      10,10,10,255, 10,10,10,255, 10,10,10,255,
      10,10,10,255, 220,180,150,255, 10,10,10,255,
      10,10,10,255, 10,10,10,255, 10,10,10,255,
    ]);
    const result = removeConnectedBackground(pixels, 3, 3, 30);
    expect(result[3]).toBe(0);
    expect(result[(4 * 4) + 3]).toBe(255);
  });
});
