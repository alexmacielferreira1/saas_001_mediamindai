// Ferramentas de câmeras do MMFilm para o MCP: sincronizar pela forma de onda e corte multicâmera por microfone.
import { LayoutGrid, RefreshCcw } from "lucide-react";
import { timelineEnvelope } from "../../lib/mmfilmAudioAnalysis";
import { clipEnd } from "../../lib/mmfilmEdits";
import { applyMulticam, planMulticam, speakerActivity } from "../../lib/mmfilmMulticam";
import { applySync, planSync } from "../../lib/mmfilmSync";

const STATUS = { referencia: "Referência", sincronizado: "Sincronizado", cadeia: "Em cadeia", sem_som_comum: "Não achou o mesmo som" };
const signed = (value) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(3).replace(".", ",")} s`;

// Clipe de áudio vinculado ao mesmo arquivo e no mesmo ponto (ex.: V1 + A1 do mesmo vídeo) anda junto.
function partnersOf(clips, clip) {
  return clips.filter(
    (other) => other.id !== clip.id && other.assetId && other.assetId === clip.assetId && Math.abs(other.start - clip.start) < 0.002,
  );
}

async function syncSources(state, params, env, kit) {
  const pool = params.onlySelected && state.selectedIds.length ? state.clips.filter((clip) => state.selectedIds.includes(clip.id)) : state.clips;
  const clips = kit.soundClips({ ...state, clips: pool }, ["V1", "V2", "V3", "A1", "A2", "A3"]).filter((clip) => !clip.sfx && !kit.lockedTrack(state, clip.track));
  if (clips.length < 2) throw new kit.ToolError("Coloque pelo menos duas fontes com som na timeline (câmeras e/ou áudio externo), em qualquer posição.");
  const buffers = await env.loadBuffers(clips);
  const sources = clips.filter((clip) => buffers.get(clip.url)).map((clip) => ({ id: clip.id, name: clip.name || clip.id, clip, buffer: buffers.get(clip.url) }));
  if (sources.length < 2) throw new kit.ToolError("Não foi possível ler o som de pelo menos duas fontes.");
  return sources;
}

async function synchronize(state, params, env, kit) {
  const sources = await syncSources(state, params, env, kit);
  const plan = planSync(sources, { referenceId: params.reference === "auto" ? undefined : params.reference });
  const synced = plan.filter((entry) => entry.status === "sincronizado" || entry.status === "cadeia");
  const items = plan.map((entry) => {
    const clip = sources.find((source) => source.id === entry.id).clip;
    return {
      id: entry.id,
      time: clip.start,
      timecode: `${clip.track}`,
      label: `${entry.name} · ${entry.status === "referencia" ? "referência" : signed(entry.offset)}${entry.confidence && entry.status !== "referencia" ? ` · confiança ${entry.confidence}` : ""}`,
      badge: STATUS[entry.status],
      selected: entry.status === "sincronizado" || entry.status === "cadeia",
    };
  });
  const chosenIds = params.selectedItems || synced.map((entry) => entry.id);
  const chosen = plan.filter((entry) => chosenIds.includes(entry.id) && entry.status !== "referencia" && entry.status !== "sem_som_comum");
  // Clipes vinculados (vídeo + áudio do mesmo arquivo) recebem o mesmo deslocamento.
  const withPartners = chosen.flatMap((entry) => {
    const clip = state.clips.find((item) => item.id === entry.id);
    return [entry, ...partnersOf(state.clips, clip).filter((partner) => !plan.some((other) => other.id === partner.id)).map((partner) => ({ ...entry, id: partner.id }))];
  });
  const base = {
    headline: { count: `${synced.length + 1}/${plan.length}`, text: "fontes sincronizadas com a referência" },
    items,
  };
  if (!chosen.length) return { ok: true, count: 0, ...base, summary: "Nenhuma fonte para mover: todas já estão alinhadas ou sem som em comum." };
  return {
    ok: true,
    count: chosen.length,
    clips: applySync(state.clips, withPartners, { muteCameraAudio: params.muteCameras }),
    ...base,
    summary: `${chosen.length} fonte(s) alinhada(s) à referência${params.muteCameras ? " · áudio das câmeras desligado" : ""}`,
  };
}

const PEOPLE = [1, 2, 3, 4];

async function multicam(state, params, env, kit) {
  const people = PEOPLE.map((number) => ({ id: `p${number}`, number, mic: params[`mic${number}`], cameraTrack: params[`cam${number}`] })).filter(
    (person) => person.mic !== "none" && person.cameraTrack !== "none",
  );
  if (people.length < 2) throw new kit.ToolError("Configure pelo menos 2 pessoas, cada uma com microfone e câmera.");
  const cameras = [...new Set([...people.map((person) => person.cameraTrack), ...(params.wide !== "none" ? [params.wide] : [])])];
  const locked = cameras.find((track) => kit.lockedTrack(state, track));
  if (locked) throw new kit.ToolError(`A faixa de câmera ${locked} está bloqueada.`);
  const end = state.clips.reduce((value, clip) => Math.max(value, clipEnd(clip)), 0);
  const envelopes = [];
  for (const person of people) {
    const clips = kit.soundClips(state, [person.mic]).filter((clip) => !clip.sfx);
    if (!clips.length) throw new kit.ToolError(`Pessoa ${person.number}: não há som na trilha ${person.mic}.`);
    const buffers = await env.loadBuffers(clips);
    envelopes.push({ personId: person.id, envelope: timelineEnvelope({ clips, buffers, from: 0, to: end, useVolume: false }) });
  }
  const activity = speakerActivity(envelopes, { sensitivity: params.sensitivity });
  const shots = planMulticam({
    activity,
    people: people.map((person) => ({ id: person.id, cameraTrack: person.cameraTrack })),
    wideTrack: params.wide === "none" ? null : params.wide,
    pace: params.pace,
    varyWithWide: params.vary,
  });
  if (!shots.length) return { ok: true, count: 0, summary: "Ninguém falando nas trilhas dos microfones." };
  const name = (track) => (track === params.wide ? "Geral" : `Pessoa ${people.find((person) => person.cameraTrack === track)?.number}`);
  return {
    ok: true,
    count: shots.length,
    clips: applyMulticam(state.clips, shots, { cameraTracks: cameras }),
    headline: { count: shots.length, text: `plano(s) · ritmo ${params.pace}` },
    summary: `${Math.max(0, shots.length - 1)} troca(s) de câmera · planos fora do ar ficam desativados (nada é apagado)`,
    details: shots.slice(0, 40).map((shot) => `${kit.timecode(shot.start)} → ${kit.timecode(shot.end)} · ${name(shot.track)} (${shot.track})`),
  };
}

export function mmfilmCameraTools(kit, state) {
  const sourceOptions = kit
    .soundClips(state, ["V1", "V2", "V3", "A1", "A2", "A3"])
    .filter((clip) => !clip.sfx)
    .map((clip) => [clip.id, `${clip.track} · ${clip.name || clip.id}`]);
  const micOptions = [["none", "Nenhum"], ...kit.ALL_TRACKS];
  const camOptions = [["none", "Nenhuma"], ...kit.VIDEO_TRACKS];
  return [
    {
      id: "sync.waveform",
      tab: "sincronizar",
      label: "Sincronizar pela forma de onda",
      icon: RefreshCcw,
      description: "Alinha câmeras, lapela, gravador e celular pelo som: vídeo no quadro exato e áudio na amostra.",
      how: "Compara os ataques sonoros de cada fonte com a referência (correlação a cada 10 ms, refinada a ~1 ms). A confiança mostra o quanto o melhor encaixe se destaca. Fontes sem som em comum com a referência são alinhadas por outra fonte já sincronizada (cadeia). Clipes de vídeo e áudio do mesmo arquivo andam juntos.",
      params: [
        { key: "onlySelected", label: "Usar só os clipes selecionados", type: "toggle", default: false, description: "Sem nada selecionado, usa todos os clipes da sequência.", section: "Sincronizar pela forma de onda" },
        { key: "muteCameras", label: "Desativar o áudio das câmeras", type: "toggle", default: false, description: "Com áudio externo (gravador, lapela), fica só ele ligado.", section: "Sincronizar pela forma de onda" },
        { key: "reference", label: "Referência", type: "select", default: "auto", options: [["auto", "Automática (gravador/áudio mais longo)"], ...sourceOptions], section: "Sincronizar pela forma de onda" },
      ],
      applyLabel: "Sincronizar",
      run: (current, params, env) => synchronize(current, params, env, kit),
    },
    {
      id: "multicam.cut",
      tab: "multicamera",
      label: "Corte multicâmera",
      icon: LayoutGrid,
      description: "Para cada pessoa, a trilha do microfone dela e a câmera que mostra ela: corta para quem está falando.",
      how: "Mede quem fala a cada 10 ms comparando cada microfone com o próprio nível (o vazamento de uma voz no microfone da outra não conta). Troca 0,2 s antes da fala, respostas curtas não trocam a câmera, duas pessoas juntas vão para a geral e o silêncio mantém o plano. As câmeras precisam estar sincronizadas, uma em cada trilha de vídeo.",
      params: [
        ...PEOPLE.flatMap((number) => [
          { key: `mic${number}`, label: `Pessoa ${number} · microfone`, type: "select", default: number === 1 ? "A1" : number === 2 ? "A2" : "none", options: micOptions, section: "Pessoas" },
          { key: `cam${number}`, label: `Pessoa ${number} · câmera`, type: "select", default: number === 1 ? "V1" : number === 2 ? "V2" : "none", options: camOptions, section: "Pessoas" },
        ]),
        { key: "wide", label: "Câmera geral", type: "select", default: "none", options: [["none", "Nenhuma (fica em quem falou por último)"], ...kit.VIDEO_TRACKS], section: "Corte", description: "Usada quando duas pessoas falam juntas ou riem." },
        { key: "pace", label: "Ritmo dos cortes", type: "chips", default: "normal", options: [["calmo", "Calmo"], ["normal", "Normal"], ["rapido", "Rápido"]], section: "Corte", help: "Plano mínimo de 3 s, 2 s ou 1,2 s." },
        { key: "vary", label: "Variar com a câmera geral", type: "toggle", default: false, section: "Corte", description: "Em falas longas, mostra a geral por alguns segundos (a cada ~8 s)." },
        { key: "sensitivity", label: "Sensibilidade", type: "range", min: 1, max: 10, step: 1, default: 5, section: "Corte" },
      ],
      confirm: "Cortar as câmeras conforme quem fala? Os planos fora do ar ficam desativados (nada é apagado) e o Desfazer volta tudo.",
      applyLabel: "Cortar câmeras",
      run: (current, params, env) => multicam(current, params, env, kit),
    },
  ];
}
