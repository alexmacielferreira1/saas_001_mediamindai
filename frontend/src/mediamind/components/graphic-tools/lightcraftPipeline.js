// Pipeline de revelação do MMLight (reimplementação própria em JS; o comportamento
// dos controles segue a referência LightCraft, Apache-2.0). Opera sobre ImageData
// e é usado tanto na prévia (resolução reduzida) quanto na exportação (resolução total).

export const DEFAULT_ADJUST = Object.freeze({
  exposição: 0,
  contraste: 0,
  realces: 0,
  sombras: 0,
  brancos: 0,
  pretos: 0,
  textura: 0,
  claridade: 0,
  saturação: 0,
});

export const ADJUST_KEYS = Object.keys(DEFAULT_ADJUST);
export const MASK_SIZE = 48;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const toLinear = new Float32Array(256);
for (let i = 0; i < 256; i += 1) {
  const c = i / 255;
  toLinear[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const toSrgb = (l) => {
  const c = l <= 0 ? 0 : l >= 1 ? 1 : l;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
};

/** Desfoque de caixa separável (2 passagens ≈ gaussiano) sobre um canal float. */
export function boxBlur(src, width, height, radius) {
  const r = Math.max(1, Math.round(radius));
  let a = Float32Array.from(src);
  const b = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      let sum = 0;
      for (let x = -r; x <= r; x += 1) sum += a[row + Math.min(width - 1, Math.max(0, x))];
      for (let x = 0; x < width; x += 1) {
        b[row + x] = sum / (2 * r + 1);
        sum += a[row + Math.min(width - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let y = -r; y <= r; y += 1) sum += b[Math.min(height - 1, Math.max(0, y)) * width + x];
      for (let y = 0; y < height; y += 1) {
        a[y * width + x] = sum / (2 * r + 1);
        sum += b[Math.min(height - 1, y + r + 1) * width + x] - b[Math.max(0, y - r) * width + x];
      }
    }
  }
  return a;
}

/** Peso (0..1) de uma máscara local na posição normalizada (u, v). */
export function maskWeight(mask, u, v) {
  if (!mask) return 0;
  if (mask.type === "linear") {
    // Gradiente linear: efeito total no topo, desaparece até o meio da foto.
    const start = mask.start ?? 0.1;
    const end = mask.end ?? 0.55;
    return 1 - smooth(start, end, v);
  }
  if (mask.type === "radial") {
    const dx = (u - (mask.cx ?? 0.5)) / (mask.rx ?? 0.32);
    const dy = (v - (mask.cy ?? 0.5)) / (mask.ry ?? 0.38);
    const d = Math.sqrt(dx * dx + dy * dy);
    return 1 - smooth(0.6, 1, d);
  }
  if (mask.type === "brush" && Array.isArray(mask.grid)) {
    const gx = Math.min(MASK_SIZE - 1, Math.floor(u * MASK_SIZE));
    const gy = Math.min(MASK_SIZE - 1, Math.floor(v * MASK_SIZE));
    return clamp01(mask.grid[gy * MASK_SIZE + gx] || 0);
  }
  return 0;
}

/** Pinta uma pincelada suave na grade da máscara de pincel. */
export function paintBrush(grid, u, v, radius = 3, strength = 0.6) {
  const next = Array.isArray(grid) && grid.length === MASK_SIZE * MASK_SIZE
    ? [...grid]
    : new Array(MASK_SIZE * MASK_SIZE).fill(0);
  const cx = u * MASK_SIZE;
  const cy = v * MASK_SIZE;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if (x < 0 || y < 0 || x >= MASK_SIZE || y >= MASK_SIZE) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
      if (d > 1) continue;
      const i = y * MASK_SIZE + x;
      next[i] = Math.min(1, next[i] + strength * (1 - d * d));
    }
  }
  return next;
}

const PROFILES = {
  "Adobe Color": { saturation: 1, contrast: 1 },
  "Camera Standard": { saturation: 1.1, contrast: 1.06 },
  Monocromático: { saturation: 0, contrast: 1.04 },
};

export function isNeutral(adjust, masks = [], profile = "Adobe Color") {
  return (
    profile === "Adobe Color" &&
    ADJUST_KEYS.every((key) => !adjust?.[key]) &&
    masks.every((mask) => ADJUST_KEYS.every((key) => !mask.adjust?.[key]))
  );
}

/**
 * Aplica a revelação a um ImageData (modifica `image.data` e devolve `image`).
 * Ordem: exposição (linear) → contraste → realces/sombras/brancos/pretos →
 * textura/claridade (contraste local) → saturação/perfil.
 */
export function developImageData(image, adjust = DEFAULT_ADJUST, { masks = [], profile = "Adobe Color" } = {}) {
  const { data, width, height } = image;
  const count = width * height;
  const prof = PROFILES[profile] || PROFILES["Adobe Color"];
  const activeMasks = masks.filter((mask) => ADJUST_KEYS.some((key) => mask.adjust?.[key]));
  const paramAt = (key, weights) => {
    let value = adjust[key] || 0;
    for (let m = 0; m < activeMasks.length; m += 1) value += (activeMasks[m].adjust[key] || 0) * weights[m];
    return value / 100;
  };
  const weightsFor = (i) => {
    if (!activeMasks.length) return [];
    const u = ((i % width) + 0.5) / width;
    const v = (Math.floor(i / width) + 0.5) / height;
    return activeMasks.map((mask) => maskWeight(mask, u, v));
  };
  const needsLocal = ["textura", "claridade"].some(
    (key) => adjust[key] || activeMasks.some((mask) => mask.adjust[key]),
  );
  const rgb = new Float32Array(count * 3);
  const lum = needsLocal ? new Float32Array(count) : null;
  const weightCache = activeMasks.length ? new Array(count) : null;
  for (let i = 0; i < count; i += 1) {
    const w = weightsFor(i);
    if (weightCache) weightCache[i] = w;
    const gain = 2 ** (paramAt("exposição", w) * 2);
    const contrast = (1 + paramAt("contraste", w)) * prof.contrast;
    const hi = paramAt("realces", w);
    const sh = paramAt("sombras", w);
    const wh = paramAt("brancos", w);
    const bl = paramAt("pretos", w);
    let r = toSrgb(toLinear[data[i * 4]] * gain);
    let g = toSrgb(toLinear[data[i * 4 + 1]] * gain);
    let b = toSrgb(toLinear[data[i * 4 + 2]] * gain);
    r = (r - 0.5) * contrast + 0.5;
    g = (g - 0.5) * contrast + 0.5;
    b = (b - 0.5) * contrast + 0.5;
    const l = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const delta =
      hi * 0.3 * smooth(0.45, 1, l) +
      sh * 0.3 * (1 - smooth(0, 0.55, l)) +
      wh * 0.18 * smooth(0.7, 1, l) +
      bl * 0.18 * (1 - smooth(0, 0.3, l));
    r += delta;
    g += delta;
    b += delta;
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
    if (lum) lum[i] = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }
  let fine = null;
  let coarse = null;
  if (lum) {
    fine = boxBlur(lum, width, height, Math.max(1, Math.min(width, height) / 300));
    coarse = boxBlur(lum, width, height, Math.max(2, Math.min(width, height) / 40));
  }
  for (let i = 0; i < count; i += 1) {
    const w = weightCache ? weightCache[i] : [];
    let r = rgb[i * 3];
    let g = rgb[i * 3 + 1];
    let b = rgb[i * 3 + 2];
    if (lum) {
      const l = lum[i];
      const texture = paramAt("textura", w);
      const clarity = paramAt("claridade", w);
      const delta =
        texture * 1.2 * (l - fine[i]) +
        clarity * 0.9 * (l - coarse[i]) * (1 - Math.abs(2 * l - 1));
      r += delta;
      g += delta;
      b += delta;
    }
    const saturation = Math.max(0, (1 + paramAt("saturação", w)) * prof.saturation);
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data[i * 4] = Math.round(clamp01(gray + (r - gray) * saturation) * 255);
    data[i * 4 + 1] = Math.round(clamp01(gray + (g - gray) * saturation) * 255);
    data[i * 4 + 2] = Math.round(clamp01(gray + (b - gray) * saturation) * 255);
  }
  return image;
}

/** Ajuste automático simples baseado na luminância média e na amplitude. */
export function autoAdjust(image) {
  const { data } = image;
  const pixels = data.length / 4;
  let sum = 0;
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < pixels; i += 1) {
    const l = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    sum += l;
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  const mean = pixels ? sum / pixels : 0.5;
  const round = (v) => Math.max(-100, Math.min(100, Math.round(v)));
  return {
    ...DEFAULT_ADJUST,
    exposição: round(Math.log2(0.46 / Math.max(0.02, mean)) * 35),
    contraste: round((0.85 - (hi - lo)) * 40),
    realces: round(hi > 0.95 ? -25 : 0),
    sombras: round(lo < 0.05 ? 20 : 0),
    brancos: round((1 - hi) * 60),
    pretos: round(-lo * 60),
  };
}
