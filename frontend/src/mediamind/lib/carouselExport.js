import html2canvas from 'html2canvas';
import { strToU8, zipSync } from 'fflate';
import { carouselExportName } from './carouselDocument';

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.')),
    'image/png',
  ));
}

export async function buildCarouselZip(document, elements) {
  if (!elements.length || elements.length !== document.slides.length) {
    throw new Error('Todos os slides precisam estar visíveis antes da exportação.');
  }
  const files = {};
  for (const [index, element] of elements.entries()) {
    const canvas = await html2canvas(element, { backgroundColor: null, scale: 2, useCORS: true });
    const blob = await canvasToBlob(canvas);
    files[carouselExportName(index, document.slides[index])] = new Uint8Array(await blob.arrayBuffer());
  }
  files['carrossel.json'] = strToU8(JSON.stringify(document, null, 2));
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' });
}
