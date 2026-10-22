// Recorte de objeto por ponto (MediaPipe Interactive Segmenter · modelo magic_touch, Apache-2.0).
// O modelo e o WASM são servidos pelo próprio MediaMind (public/models e public/vision): a imagem não sai do navegador.
let segmenterPromise;
let queue = Promise.resolve();

async function getSegmenter() {
  if (!segmenterPromise)
    segmenterPromise = (async () => {
      const { FilesetResolver, InteractiveSegmenter } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}vision/wasm`);
      return InteractiveSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/magic_touch.tflite` },
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })().catch((error) => {
      segmenterPromise = undefined;
      throw error;
    });
  return segmenterPromise;
}

/**
 * Máscara (probabilidade 0–1 por pixel) do objeto que contém o ponto (x, y normalizados 0–1) num canvas.
 * Devolve { values, width, height }.
 */
export function segmentObjectCanvas(canvas, point) {
  const run = async () => {
    try {
      const model = await getSegmenter();
      let found;
      model.segment(canvas, { keypoint: { x: point.x, y: point.y } }, (result) => {
        const mask = (result.confidenceMasks || [])[0];
        if (mask) found = { values: Float32Array.from(mask.getAsFloat32Array()), width: mask.width, height: mask.height };
      });
      if (!found) throw new Error("O modelo não devolveu a máscara do objeto.");
      return found;
    } catch (error) {
      throw new Error(`Não foi possível recortar o objeto. ${error.message || "Verifique sua conexão e tente novamente."}`);
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}
