import { strToU8, zipSync } from 'fflate';

const clamp = (value) => Math.max(0, Math.min(1, value));

export async function renderBackgroundFrame(time, durationMs, colors = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar os quadros da animação.');
  const progress = Math.min(clamp(time / 600), clamp((durationMs - time) / 600));
  const x = 134, y = 702, width = 1652, height = 240;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width * progress, height);
  ctx.clip();
  ctx.fillStyle = colors.cor_barra || '#ffcc00';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = colors.cor_painel || '#ffffff';
  ctx.fillRect(x + 18, y + 18, width - 36, height - 36);
  ctx.restore();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível gerar um quadro PNG.');
  return new Uint8Array(await blob.arrayBuffer());
}

export async function buildGraphicPackage({ durationMs = 5000, fps = 30, colors = {}, renderFrame = renderBackgroundFrame } = {}) {
  const frames = Math.ceil(durationMs * fps / 1000);
  if (!Number.isFinite(frames) || frames < 1 || frames > 900) throw new Error('Duração ou frequência de quadros inválida.');
  const files = {};
  for (let i = 0; i < frames; i += 1) {
    files[`png-sem-texto/gc_${String(i).padStart(4, '0')}.png`] = await renderFrame(i * 1000 / fps, durationMs, colors);
  }
  files['LEIA-ME.txt'] = strToU8(`GC barra editorial — reconstrução aproximada pelas imagens de referência.\nSequência PNG sem texto: 1920x1080, ${fps} quadros por segundo, com transparência.\nImporte a sequência de imagens no After Effects e adicione o texto separadamente.\nNão contém projeto .aep nem arquivo importável do ArtCraft ou MMEffects.\n`);
  return zipSync(files, { level: 0 });
}

export async function downloadGraphicPackage(colors = {}) {
  const zip = await buildGraphicPackage({ colors });
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gc-barra-editorial-png.zip';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
