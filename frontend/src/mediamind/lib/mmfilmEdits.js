// Edições puras da timeline do MMFilm: cortes, partes de clipe e remoção de trechos com ripple.
// Usadas pelo editor e pelas ferramentas de um clique do MCP (cada função devolve uma nova lista de clipes).

export const EPSILON = 1e-6;
export const speedFactor = (clip) => (clip.speed || 100) / 100;
export const clipEnd = (clip) => clip.start + clip.duration;

// Curvas de valores no tempo local do clipe: [[tempo, valor, suavização?], ...] em ordem de tempo.
// A suavização vale para o trecho que começa naquela chave: "linear" (padrão), "ease" ou "hold".
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2);
export function keyValueAt(keys, time, fallback = 0) {
  if (!Array.isArray(keys) || !keys.length) return fallback;
  if (time <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (time >= last[0]) return last[1];
  const index = keys.findIndex((key) => key[0] > time) - 1;
  const [t0, v0, ease] = keys[index];
  const [t1, v1] = keys[index + 1];
  if (ease === "hold" || t1 - t0 <= EPSILON) return v0;
  const x = (time - t0) / (t1 - t0);
  return v0 + (v1 - v0) * (ease === "ease" ? easeInOut(x) : x);
}

// Recorta uma curva para [from, to] e a desloca para começar em zero, preservando o valor nas bordas.
export function sliceKeys(keys, from, to) {
  if (!Array.isArray(keys) || !keys.length) return keys;
  const inside = keys.filter((key) => key[0] > from + EPSILON && key[0] < to - EPSILON);
  const boundary = (time) => {
    const index = keys.findIndex((key) => key[0] > time) - 1;
    const ease = index >= 0 ? keys[index][2] : undefined;
    return ease ? [time, keyValueAt(keys, time), ease] : [time, keyValueAt(keys, time)];
  };
  return [boundary(from), ...inside, boundary(to)].map(([time, ...rest]) => [time - from, ...rest]);
}

function sliceCurves(clip, from, to) {
  const next = {};
  if (clip.motion) {
    next.motion = Object.fromEntries(
      Object.entries(clip.motion).map(([property, keys]) => [property, sliceKeys(keys, from, to)]),
    );
  }
  if (clip.gainKeys) next.gainKeys = sliceKeys(clip.gainKeys, from, to);
  return next;
}

// Parte esquerda de um corte: mesmo id, mesma origem, termina em `at`.
export function leftPart(clip, at) {
  const offset = at - clip.start;
  return {
    ...clip,
    duration: offset,
    keyframes: (clip.keyframes || []).filter((time) => time < offset - EPSILON),
    ...sliceCurves(clip, 0, offset),
  };
}

// Parte direita de um corte: começa em `at` e avança a origem pelo trecho consumido (respeitando a velocidade).
// Vínculo vídeo+áudio (`linkId`): ao cortar, as partes direitas do par ganham um vínculo novo derivado do
// original e do ponto de corte — iguais para os dois lados do par, sem ligar as partes esquerdas às direitas.
export const linkRoot = (linkId) => String(linkId).split("@")[0];
const splitLinkId = (linkId, at) => `${linkRoot(linkId)}@${Math.round(at * 1000)}`;
export function rightPart(clip, at, id = crypto.randomUUID()) {
  const offset = at - clip.start;
  return {
    ...clip,
    id,
    linkId: clip.linkId ? splitLinkId(clip.linkId, at) : clip.linkId,
    start: at,
    duration: clipEnd(clip) - at,
    sourceIn: (clip.sourceIn || 0) + offset * speedFactor(clip),
    keyframes: (clip.keyframes || [])
      .filter((time) => time > offset + EPSILON)
      .map((time) => time - offset),
    transition: undefined,
    ...sliceCurves(clip, offset, clip.duration),
  };
}

// Insere (empurra o que vem depois) ou sobrescreve (apara o que estiver embaixo) um clipe na faixa.
export function placeClip(clips, item, mode) {
  const start = item.start;
  const end = clipEnd(item);
  const next = clips.flatMap((clip) => {
    if (clip.track !== item.track) return [clip];
    if (mode === "insert") {
      if (clip.start >= start - EPSILON)
        return [{ ...clip, start: clip.start + item.duration }];
      if (clipEnd(clip) > start + EPSILON) {
        const right = rightPart(clip, start);
        return [
          leftPart(clip, start),
          { ...right, start: right.start + item.duration },
        ];
      }
      return [clip];
    }
    if (clip.start >= end - EPSILON || clipEnd(clip) <= start + EPSILON)
      return [clip];
    const pieces = [];
    if (clip.start < start - EPSILON) pieces.push(leftPart(clip, start));
    if (clipEnd(clip) > end + EPSILON)
      pieces.push(rightPart(clip, end, pieces.length ? undefined : clip.id));
    return pieces;
  });
  return [...next, item];
}

/**
 * Coloca vários itens (ex.: o par vídeo + áudio) como no Premiere: "overwrite" apara/divide o que estiver
 * embaixo em cada faixa; "insert" divide no ponto e empurra o resto da faixa.
 */
export function overwriteItems(clips, items, mode = "overwrite") {
  if (!items.length) return clips;
  return items.reduce((list, item) => placeClip(list, item, mode), clips);
}

/**
 * Move (ou duplica) um grupo de clipes: o grupo sai da posição antiga antes de ser colocado, então nunca
 * corta a si mesmo. `tracks` troca a faixa de clipes específicos; o início nunca passa do zero.
 */
export function moveClips(clips, ids, { delta = 0, tracks = {}, duplicate = false } = {}, mode = "overwrite") {
  const group = clips.filter((clip) => ids.includes(clip.id));
  if (!group.length) return clips;
  const applied = Math.max(delta, -Math.min(...group.map((clip) => clip.start)));
  let moved = group.map((clip) => ({ ...clip, start: clip.start + applied, track: tracks[clip.id] || clip.track }));
  if (duplicate) {
    const links = new Map();
    moved = moved.map((clip) => {
      let linkId = clip.linkId;
      if (linkId) {
        if (!links.has(linkId)) links.set(linkId, crypto.randomUUID());
        linkId = links.get(linkId);
      }
      return { ...clip, id: crypto.randomUUID(), linkId };
    });
  }
  const rest = duplicate ? clips : clips.filter((clip) => !ids.includes(clip.id));
  return overwriteItems(rest, moved, mode);
}

/** Pares [id, id] de clipes que ocupam o mesmo trecho da mesma faixa (deve ser sempre vazio). */
export function trackOverlaps(clips) {
  const pairs = [];
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  sorted.forEach((clip, index) => {
    for (const other of sorted.slice(index + 1)) {
      if (other.start >= clipEnd(clip) - EPSILON) break;
      if (other.track === clip.track) pairs.push([clip.id, other.id]);
    }
  });
  return pairs;
}

/** Junta trechos [início, fim] sobrepostos ou encostados e descarta os vazios. */
export function mergeRanges(ranges) {
  const sorted = ranges
    .filter(([start, end]) => end - start > EPSILON)
    .map(([start, end]) => [start, end])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  sorted.forEach((range) => {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1] + EPSILON) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  });
  return merged;
}

/** Converte um tempo da timeline para depois da remoção dos trechos (o que caía dentro vai para o início do corte). */
export function timeAfterRemoval(time, ranges) {
  let removed = 0;
  for (const [start, end] of ranges) {
    if (time <= start + EPSILON) break;
    removed += Math.min(time, end) - start;
  }
  return time - removed;
}

/**
 * Remove trechos da timeline e fecha os buracos (ripple), como "remover silêncios".
 * Faixas bloqueadas ou protegidas (ex.: música) ficam intactas e no lugar.
 */
export function removeRanges(clips, ranges, { skipTrack = () => false } = {}) {
  const cuts = mergeRanges(ranges);
  if (!cuts.length) return clips;
  return clips.flatMap((clip) => {
    if (skipTrack(clip.track)) return [clip];
    const end = clipEnd(clip);
    const kept = [];
    let cursor = clip.start;
    cuts.forEach(([start, stop]) => {
      if (stop <= cursor + EPSILON || start >= end - EPSILON) return;
      if (start > cursor + EPSILON) kept.push([cursor, Math.min(start, end)]);
      cursor = Math.max(cursor, stop);
    });
    if (cursor < end - EPSILON) kept.push([cursor, end]);
    if (kept.length === 1 && Math.abs(kept[0][0] - clip.start) < EPSILON && Math.abs(kept[0][1] - end) < EPSILON) {
      const moved = timeAfterRemoval(clip.start, cuts);
      return [Math.abs(moved - clip.start) < EPSILON ? clip : { ...clip, start: moved }];
    }
    return kept.map(([from, to], index) => {
      let piece = clip;
      if (from > clip.start + EPSILON) piece = rightPart(piece, from, index === 0 ? clip.id : undefined);
      else if (index > 0) piece = { ...piece, id: crypto.randomUUID() };
      if (to < end - EPSILON) piece = leftPart(piece, to);
      return { ...piece, start: timeAfterRemoval(from, cuts) };
    });
  });
}

/** Divide (navalha) todos os clipes elegíveis em cada um dos tempos, sem apagar nada. */
export function splitAtTimes(clips, times, { skipTrack = () => false } = {}) {
  const ordered = [...new Set(times)].sort((a, b) => a - b);
  return ordered.reduce(
    (list, time) =>
      list.flatMap((clip) =>
        !skipTrack(clip.track) && time > clip.start + EPSILON && time < clipEnd(clip) - EPSILON
          ? [leftPart(clip, time), rightPart(clip, time)]
          : [clip],
      ),
    clips,
  );
}
