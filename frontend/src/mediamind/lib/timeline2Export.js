/**
 * Honest description of what the backend sequence export (POST /media/exports/timeline)
 * renders today: only the main video track (`v1`, or the first video track), cut by
 * IN/OUT, with each clip's own embedded audio and speed, scaled to 1280×720.
 * Everything else in the Timeline 2 document is preview-only and listed as such.
 */
export function getExportMainTrack(document) {
  const tracks = document?.tracks || [];
  return tracks.find((track) => track.id === 'v1') || tracks.find((track) => track.kind === 'video') || null;
}

const overlapsRange = (clip, inPoint, outPoint) => {
  const start = Math.max(0, Number(inPoint) || 0);
  const end = outPoint == null ? Number.POSITIVE_INFINITY : Number(outPoint);
  return clip.start < end && clip.start + clip.duration > start;
};

export function describeTimelineExport(document) {
  const main = getExportMainTrack(document);
  const inRange = (clip) => overlapsRange(clip, document?.inPoint, document?.outPoint);
  const mainClips = (main?.clips || []).filter(inRange);
  const included = mainClips.filter((clip) => clip.assetId);
  const withoutAsset = mainClips.filter((clip) => !clip.assetId);
  const otherTracks = (document?.tracks || []).filter((track) => track !== main && (track.clips || []).some(inRange));
  const omitted = [];
  if (withoutAsset.length) omitted.push(`${withoutAsset.length} clipe(s) da trilha principal sem mídia no Acervo`);
  otherTracks.forEach((track) => {
    const count = track.clips.filter(inRange).length;
    omitted.push(`${track.name} (${track.id}): ${count} clipe(s) não entram no arquivo`);
  });
  const effects = new Set();
  included.forEach((clip) => {
    const properties = clip.properties || {};
    if (Number(properties.opacity ?? 100) !== 100 || Number(properties.scale ?? 100) !== 100 || Number(properties.rotation || 0) || Number(properties.x || 0) || Number(properties.y || 0)) effects.add('transformações (posição, escala, rotação, opacidade)');
    if (['brightness', 'contrast', 'saturation'].some((key) => Number(properties[key] ?? 100) !== 100) || Number(properties.blur || 0)) effects.add('filtros de cor e desfoque');
    if (Number(properties.fadeIn || 0) || Number(properties.fadeOut || 0)) effects.add('fades de entrada e saída');
    if (Number(properties.volume || 0)) effects.add('ajuste de volume do clipe');
    if (clip.transitionIn) effects.add('transições');
    if (clip.keyframes && Object.values(clip.keyframes).some((list) => list?.length)) effects.add('keyframes');
  });
  if (main?.muted) effects.add('silenciar a trilha principal');
  return {
    mainTrack: main,
    includedCount: included.length,
    canExport: included.length > 0,
    included: [
      `Trilha ${main ? `${main.name} (${main.id})` : 'principal inexistente'}: ${included.length} clipe(s) do Acervo, na ordem e com as lacunas da timeline`,
      'Cortes, IN/OUT da sequência e velocidade de cada clipe',
      'Áudio original embutido em cada vídeo da trilha principal',
      'Resolução 1280×720 (MP4 H.264/AAC)',
    ],
    omitted,
    previewOnly: [...effects],
  };
}
