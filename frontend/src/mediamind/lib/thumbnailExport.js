import html2canvas from 'html2canvas';

export async function exportThumbnailElement(element, { width, height, filename }) {
  if (!element) throw new Error('Preview indisponível para exportação.');
  await document.fonts?.ready;
  const measuredWidth = element.getBoundingClientRect().width || width;
  const scale = width / measuredWidth;
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    useCORS: true,
    allowTaint: false,
    logging: false,
    scale,
    width: measuredWidth,
    height: height / scale,
  });
  const anchor = document.createElement('a');
  anchor.href = canvas.toDataURL('image/png', 1);
  anchor.download = filename;
  anchor.click();
  anchor.remove?.();
}
