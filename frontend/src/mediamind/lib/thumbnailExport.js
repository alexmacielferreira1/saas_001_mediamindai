export async function thumbnailBlob(element, { width, height }) {
  const canvas = element?.querySelector?.('canvas');
  if (!canvas) throw new Error('Preview indisponível para exportação.');
  // Rendering failures propagate: never download an old or incomplete preview.
  await canvas.thumbnailReady;
  if (canvas.dataset.renderStatus !== 'ready' || canvas.width !== width || canvas.height !== height) throw new Error('A composição ainda não está pronta para exportação.');
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG.')), 'image/png'));
}
export async function exportThumbnailElement(element, options) {
  const blob = await thumbnailBlob(element, options);
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = options.filename; anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob;
}
