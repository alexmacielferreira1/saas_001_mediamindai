// Corte multicâmera automático do MMFilm (podcast): quem fala em cada janela de 10 ms, planos por ritmo
// e aplicação na timeline dividindo as câmeras e desativando (sem apagar) o que fica fora do ar.
import { autoThreshold } from "./mmfilmAudioAnalysis";
import { EPSILON, splitAtTimes } from "./mmfilmEdits";

/** Duração mínima de um plano (segundos) por ritmo. Falas mais curtas que isso não trocam a câmera. */
export const PACE_MIN_SHOT = { calmo: 3, normal: 2, rapido: 1.2 };
/** Margem sobre o vazamento estimado dos outros microfones para um microfone contar como fala. */
export const BLEED_MARGIN_DB = 6;
/** Microfone cuja fala (percentil 90) não passa 10 dB do ruído de fundo (percentil 10) é tratado como mudo. */
export const MIN_SPEECH_RANGE_DB = 10;
/** "Variar com a câmera geral": a cada WIDE_EVERY s de fala longa, mostra a geral por WIDE_LENGTH s. */
export const WIDE_EVERY = 8;
export const WIDE_LENGTH = 2;

const round = (time) => Math.round(time * 1000) / 1000;

function median(values) {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/**
 * Atividade por janela. `envelopes` = [{ personId, envelope }] com envelopes de `timelineEnvelope`
 * (mesmo `from` e `windowSeconds`, um por microfone).
 *
 * Vazamento (bleed): para cada par de microfones (i, j) estima-se quanto a voz de j chega mais baixa no
 * microfone i — a mediana de db_j − db_i nas janelas em que j está acima do próprio limiar e mais alto que i.
 * O microfone i só conta como fala quando está acima do próprio limiar (autoThreshold) E pelo menos
 * `margin` dB (6) acima do vazamento previsto dos outros (db_j − atenuação). Assim a voz de uma pessoa
 * captada no microfone da outra não vira fala. Microfones sem fala própria (MIN_SPEECH_RANGE_DB) nunca ficam ativos. Limitação: supõe que cada pessoa soa mais alto no próprio microfone.
 *
 * Devolve { from, windowSeconds, states } com states[w] = personId | "both" | "none".
 */
export function speakerActivity(envelopes, { sensitivity = 5, margin = BLEED_MARGIN_DB } = {}) {
  if (!envelopes.length) return { from: 0, windowSeconds: 0.01, states: [] };
  const { from, windowSeconds } = envelopes[0].envelope;
  const length = Math.min(...envelopes.map(({ envelope }) => envelope.db.length));
  const mics = envelopes.map(({ personId, envelope }) => {
    const db = envelope.db.subarray(0, length);
    const { threshold, floor, speech } = autoThreshold(db, sensitivity);
    return { personId, db, threshold, speaks: speech - floor >= MIN_SPEECH_RANGE_DB };
  });
  const attenuation = mics.map((mic, i) =>
    mics.map((other, j) => {
      if (i === j) return Infinity;
      const gaps = [];
      for (let w = 0; w < length; w += 1) {
        if (other.db[w] >= other.threshold && other.db[w] > mic.db[w]) gaps.push(other.db[w] - mic.db[w]);
      }
      return gaps.length ? median(gaps) : Infinity;
    }),
  );
  const states = new Array(length);
  for (let w = 0; w < length; w += 1) {
    const active = mics.filter((mic, i) => {
      const bleed = Math.max(...mics.map((other, j) => other.db[w] - attenuation[i][j]));
      return mic.speaks && mic.db[w] >= mic.threshold && mic.db[w] >= bleed + margin;
    });
    states[w] = active.length > 1 ? "both" : active.length ? active[0].personId : "none";
  }
  return { from, windowSeconds, states };
}

// Trechos contínuos de fala por estado; silêncios ("none") no meio da fala da mesma pessoa não a interrompem.
function turnsOf({ from, windowSeconds, states }) {
  const turns = [];
  states.forEach((state, index) => {
    if (state === "none") return;
    const start = round(from + index * windowSeconds);
    const end = round(from + (index + 1) * windowSeconds);
    const last = turns[turns.length - 1];
    if (last && last.state === state) last.end = end;
    else turns.push({ state, start, end });
  });
  return turns;
}

/**
 * Planos de câmera: troca `leadIn` s antes de a pessoa começar a falar; falas mais curtas que o plano
 * mínimo do ritmo não trocam; duas pessoas juntas → câmera geral (sem geral, mantém a atual); silêncio
 * mantém a atual. Nenhum plano fica menor que o mínimo (a troca espera, e não troca perto do fim).
 * Com `varyWithWide`, planos longos de uma pessoa ganham a geral por alguns segundos a cada ~8 s.
 * Devolve [{ start, end, track }] cobrindo toda a atividade.
 */
export function planMulticam({ activity, people, wideTrack = null, pace = "normal", varyWithWide = false, leadIn = 0.2 }) {
  if (!activity.states.length || !people.length) return [];
  const minShot = PACE_MIN_SHOT[pace] || PACE_MIN_SHOT.normal;
  const from = round(activity.from);
  const end = round(activity.from + activity.states.length * activity.windowSeconds);
  const cameraOf = new Map(people.map((person) => [person.id, person.cameraTrack]));
  const events = turnsOf(activity)
    .filter((turn) => turn.end - turn.start >= minShot - EPSILON)
    .map((turn) => ({ time: round(turn.start - leadIn), track: turn.state === "both" ? wideTrack : cameraOf.get(turn.state) }))
    .filter((event) => event.track);
  let current = events.length ? events[0].track : people[0].cameraTrack;
  let shotStart = from;
  const shots = [];
  events.forEach(({ time, track }) => {
    if (track === current) return;
    const at = round(Math.max(time, shotStart + minShot));
    if (end - at < minShot - EPSILON) return;
    shots.push({ start: shotStart, end: at, track: current });
    current = track;
    shotStart = at;
  });
  shots.push({ start: shotStart, end, track: current });
  if (!varyWithWide || !wideTrack) return shots;
  const wideLength = Math.max(WIDE_LENGTH, minShot);
  return shots.flatMap((shot) => {
    if (shot.track === wideTrack) return [shot];
    const pieces = [];
    let cursor = shot.start;
    while (cursor + WIDE_EVERY + wideLength + minShot <= shot.end + EPSILON) {
      const at = round(cursor + WIDE_EVERY);
      pieces.push({ start: cursor, end: at, track: shot.track }, { start: at, end: round(at + wideLength), track: wideTrack });
      cursor = round(at + wideLength);
    }
    pieces.push({ start: cursor, end: shot.end, track: shot.track });
    return pieces;
  });
}

/**
 * Aplica os planos: divide os clipes das faixas de câmera nos pontos de troca (splitAtTimes) e marca
 * `enabled: false` nos pedaços fora do ar e `enabled: true` nos que estão no ar. Nada é apagado.
 * `cameraTracks` deve listar todas as câmeras (pessoas e geral); sem ele, usa as faixas que aparecem nos planos.
 */
export function applyMulticam(clips, shots, { cameraTracks } = {}) {
  const tracks = cameraTracks || [...new Set(shots.map((shot) => shot.track))];
  const isCamera = (track) => tracks.includes(track);
  const times = shots.slice(1).map((shot) => shot.start);
  return splitAtTimes(clips, times, { skipTrack: (track) => !isCamera(track) }).map((clip) => {
    if (!isCamera(clip.track)) return clip;
    const middle = clip.start + clip.duration / 2;
    const shot = shots.find((item) => middle >= item.start && middle < item.end);
    return shot ? { ...clip, enabled: shot.track === clip.track } : clip;
  });
}
