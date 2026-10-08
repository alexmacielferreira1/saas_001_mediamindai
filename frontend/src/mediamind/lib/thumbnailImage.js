function colorDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function removeConnectedBackground(data, width, height, tolerance = 48) {
  const output = new Uint8ClampedArray(data);
  const visited = new Uint8Array(width * height);
  const queue = [];
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const background = corners.reduce((sum, [x, y]) => {
    const offset = (y * width + x) * 4;
    return [sum[0] + data[offset], sum[1] + data[offset + 1], sum[2] + data[offset + 2]];
  }, [0, 0, 0]).map((value) => value / corners.length);

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (colorDistance([data[offset], data[offset + 1], data[offset + 2]], background) > tolerance) return;
    visited[index] = 1;
    queue.push(index);
  }

  for (let x = 0; x < width; x += 1) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y += 1) { enqueue(0, y); enqueue(width - 1, y); }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    output[index * 4 + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1);
  }
  return output;
}

export async function createLocalCutout(file) {
  const blob = await removeThumbnailBackground(file);
  return URL.createObjectURL(blob);
}
import { removeThumbnailBackground } from '@/api/media';
