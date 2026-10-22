let segmenterPromise;
let queue = Promise.resolve();
async function getSegmenter() {
  if (!segmenterPromise)
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import(
        "@mediapipe/tasks-vision"
      );
      const files = await FilesetResolver.forVisionTasks(
        `${import.meta.env.BASE_URL}vision/wasm`,
      );
      return ImageSegmenter.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            `${import.meta.env.BASE_URL}models/selfie_segmenter.tflite`,
        },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    })().catch((error) => {
      segmenterPromise = undefined;
      throw error;
    });
  return segmenterPromise;
}
export function applyPersonMask(pixels, mask) {
  for (let i = 0; i < mask.length; i++)
    pixels[i * 4 + 3] = Math.round(
      pixels[i * 4 + 3] * Math.max(0, Math.min(1, (mask[i] - 0.12) / 0.76)),
    );
  return pixels;
}
/**
 * Máscara de pessoa (probabilidade 0–1 por pixel) de uma imagem já desenhada num canvas.
 * Usa o mesmo modelo local e a mesma fila de removePersonBackground.
 */
export function segmentPersonCanvas(canvas) {
  const run = async () => {
    try {
      const model = await getSegmenter();
      let found;
      model.segment(canvas, (result) => {
        const masks = result.confidenceMasks || [];
        const mask = masks[masks.length === 1 ? 0 : 1];
        if (mask) found = { values: Float32Array.from(mask.getAsFloat32Array()), width: mask.width, height: mask.height };
      });
      if (!found) throw new Error("Não foi possível identificar a pessoa.");
      return found;
    } catch (error) {
      throw new Error(`Não foi possível remover o fundo. ${error.message || "Verifique sua conexão e tente novamente."}`);
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

export async function removePersonBackground(file) {
  const run = async () => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      img.src = url;
      await img.decode();
      const ratio = Math.min(
        1,
        1600 / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Seu navegador não disponibilizou o processamento de imagem.");
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      const model = await getSegmenter();
      model.segment(canvas, (result) => {
        const masks = result.confidenceMasks || [];
        // Selfie model has one mask: probability of a person (rather than two category masks).
        const mask = masks[masks.length === 1 ? 0 : 1];
        if (!mask) throw new Error("Não foi possível identificar a pessoa.");
        const values = mask.getAsFloat32Array();
        const mc = document.createElement("canvas");
        mc.width = mask.width;
        mc.height = mask.height;
        const cx = mc.getContext("2d");
        if (!cx) throw new Error("Falha ao preparar a máscara de recorte.");
        const data = cx.createImageData(mc.width, mc.height);
        for (let i = 0; i < values.length; i++) data.data[i * 4 + 3] = 255;
        applyPersonMask(data.data, values);
        let foreground = 0;
        for (let i = 0; i < values.length; i++)
          if (data.data[i * 4 + 3] > 128) foreground++;
        if (foreground < values.length * 0.005)
          throw new Error(
            "Nenhuma pessoa identificada. Use um retrato mais próximo e nítido.",
          );
        cx.putImageData(data, 0, 0);
        context.globalCompositeOperation = "destination-in";
        context.drawImage(mc, 0, 0, canvas.width, canvas.height);
        context.globalCompositeOperation = "source-over";
      });
      return await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Falha ao criar PNG."))),
          "image/png",
        ),
      );
    } catch (error) {
      throw new Error(
        `Não foi possível remover o fundo. ${error.message || "Verifique sua conexão e tente novamente."}`,
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

