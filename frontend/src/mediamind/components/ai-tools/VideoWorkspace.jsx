import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Film,
  Upload,
  Volume2,
} from "lucide-react";
import { Button, Field, Panel, inputClass } from "./StudioUI";
export function makeScenes(text) {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({
      id: crypto.randomUUID(),
      text,
      duration: 5,
      color: ["#082f49", "#312e81", "#134e4a", "#7f1d1d"][i % 4],
      media: null,
      mediaType: null,
    }));
}
export default function VideoWorkspace({
  scenes,
  setScenes,
  format = "9:16",
  accent = "#38bdf8",
  label = "PRÉVIA DO STORYBOARD",
  showText = true,
}) {
  const [selected, setSelected] = useState(0),
    [playing, setPlaying] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const mediaUrls = useRef(new Set());
  const stageVideo = useRef(null);
  const narrationRef = useRef(null), musicRef = useRef(null);
  const [uploadNotice, setUploadNotice] = useState('');
  const audio = scenes[0]?.audioTrack || {};
  const current = scenes[Math.min(selected, Math.max(0, scenes.length - 1))];
  const total = scenes.reduce((s, c) => s + Number(c.duration), 0);
  useEffect(() => {
    setSelected((i) => Math.min(i, Math.max(0, scenes.length - 1)));
    setElapsed(0);
    setPlaying(false);
  }, [scenes.length]);
  useEffect(() => {
    if (!playing || !current) return;
    const timer = setInterval(() => setElapsed((t) => t + 0.1), 100);
    return () => clearInterval(timer);
  }, [playing, current]);
  useEffect(() => {
    if (!playing || !current || elapsed < Number(current.duration)) return;
    if (selected < scenes.length - 1) {
      setSelected((i) => i + 1);
      setElapsed(0);
    } else {
      setPlaying(false);
      setElapsed(0);
      setSelected(0);
    }
  }, [elapsed, playing, current, selected, scenes.length]);
  useEffect(() => {
    const v = stageVideo.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, selected, current?.media]);
  useEffect(
    () => () => mediaUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  useEffect(() => {
    for (const [node, volume] of [[narrationRef.current, 1], [musicRef.current, (audio.volume ?? 20) / 100]]) {
      if (!node) continue;
      node.volume = volume;
      if (playing) node.play().catch(() => {}); else node.pause();
    }
  }, [playing, audio.narration, audio.music, audio.volume]);
  function patchAudio(key, value) { setScenes((list) => list.map((scene, i) => i === 0 ? { ...scene, audioTrack: { ...scene.audioTrack, [key]: value } } : scene)); }
  function attachAudio(file, key) { if (!file?.type.startsWith('audio/')) return; const url = URL.createObjectURL(file); mediaUrls.current.add(url); patchAudio(key, url); }
  function uploadMany(files) {
    const valid = [...files].filter((file) => /^(image|video)\//.test(file.type));
    if (!valid.length) { setUploadNotice('Escolha imagens ou vídeos.'); return; }
    const media = valid.map((file) => { const url = URL.createObjectURL(file); mediaUrls.current.add(url); return { media: url, mediaType: file.type.startsWith('video') ? 'video' : 'image', mediaName: file.name }; });
    setScenes((list) => {
      const result = [...list];
      media.forEach((item, index) => { const i = selected + index; if (result[i]) result[i] = { ...result[i], ...item }; else result.push({ ...makeScenes(item.mediaName)[0], ...item }); });
      return result;
    });
    setUploadNotice(`${media.length} mídias distribuídas nas cenas a partir da seleção atual.`);
  }
  function patch(key, value) {
    setScenes((list) =>
      list.map((s, i) => (i === selected ? { ...s, [key]: value } : s)),
    );
  }
  function upload(file) {
    if (!file || !/^(image|video)\//.test(file.type)) return;
    const url = URL.createObjectURL(file);
    mediaUrls.current.add(url);
    setScenes((list) =>
      list.map((s, i) =>
        i === selected
          ? {
              ...s,
              media: url,
              mediaType: file.type.startsWith("video") ? "video" : "image",
            }
          : s,
      ),
    );
  }
  function move(direction) {
    const next = selected + direction;
    if (next < 0 || next >= scenes.length) return;
    setScenes((list) => {
      const result = [...list];
      [result[selected], result[next]] = [result[next], result[selected]];
      return result;
    });
    setSelected(next);
  }
  return (
    <div className="space-y-4">
      <Panel title="Mídias, narração e música">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-dashed border-slate-600 p-4" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); uploadMany(event.dataTransfer.files); }}><label className="text-sm text-sky-300">Enviar imagens / vídeos em lote<input aria-label="Mídias em lote" className="mt-2 block w-full text-xs" type="file" multiple accept="image/*,video/*" onChange={(event) => { uploadMany(event.target.files); event.target.value = ''; }} /></label><p className="mt-2 text-xs text-slate-500">Arquivos são distribuídos a partir da cena selecionada. Você pode reordenar depois.</p></div>
          <Field label="Arquivo de narração"><input type="file" accept="audio/*" disabled={!scenes.length} onChange={(event) => attachAudio(event.target.files[0], 'narration')} />{audio.narration && <><audio ref={narrationRef} controls src={audio.narration} className="w-full" /><Button onClick={() => patchAudio('narration', null)}>Remover narração</Button></>}</Field>
          <Field label="Música de fundo"><input type="file" accept="audio/*" disabled={!scenes.length} onChange={(event) => attachAudio(event.target.files[0], 'music')} />{audio.music && <><audio ref={musicRef} controls loop src={audio.music} className="w-full" /><label className="block text-xs">Volume · {audio.volume ?? 20}%<input aria-label="Volume da música" className="w-full" type="range" min="0" max="100" value={audio.volume ?? 20} onChange={(event) => patchAudio('volume', +event.target.value)} /></label><Button onClick={() => patchAudio('music', null)}>Remover música</Button></>}</Field>
        </div>{uploadNotice && <p role="status" className="text-xs text-sky-300">{uploadNotice}</p>}
      </Panel>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="rounded-2xl border border-slate-800 bg-black/40 p-4">
          <div className="mb-4 flex justify-between text-[10px] font-bold tracking-widest text-slate-500">
            <span>{label}</span>
            <span>
              {format} · {Math.round(total)}s
            </span>
          </div>
          <div
            className={`relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-xl ${format === "9:16" ? "aspect-[9/16] max-w-[280px]" : format === "1:1" ? "aspect-square max-w-[480px]" : "aspect-video"}`}
            style={{
              background: `radial-gradient(ellipse at top right,${accent}44,${current?.color || "#0f172a"} 70%)`,
            }}
          >
            {current?.mediaType === "video" ? (
              <video
                ref={stageVideo}
                key={current.media}
                src={current.media}
                muted
                playsInline
                loop
                className={`absolute inset-0 h-full w-full ${current?.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
              />
            ) : current?.media ? (
              <img
                src={current.media}
                alt="Mídia da cena"
                className={`absolute inset-0 h-full w-full ${current?.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <Film size={120} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[9px] font-bold tracking-widest text-white">
              MEDIAMIND
            </div>
            <div className={`relative w-full p-6 ${current?.captionPosition === 'top' ? 'self-start pt-12' : current?.captionPosition === 'center' ? 'self-center' : 'mt-auto pb-12'}`}>
              <div
                className="mb-4 h-1 w-10 rounded"
                style={{ background: accent }}
              />
              <p className={`whitespace-pre-wrap break-words font-black leading-tight ${current?.captionStyle === 'Impacto' ? 'text-yellow-300' : 'text-white'} ${current?.captionStyle === 'Caixa' ? 'rounded-lg bg-black/70 p-3' : ''}`} style={{ fontSize: `${current?.captionSize || 20}px` }}>
                {showText
                  ? current?.text || "Crie suas cenas para começar"
                  : ""}
              </p>
              <p className="mt-5 text-[10px] uppercase tracking-widest text-white/50">
                Cena {scenes.length ? selected + 1 : 0} de {scenes.length}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button
              disabled={!scenes.length}
              onClick={() => {
                if (!playing) {
                  setElapsed(0);
                }
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-800">
              <div
                className="h-full bg-sky-400"
                style={{
                  width: current
                    ? `${Math.min(100, (elapsed / Number(current.duration)) * 100)}%`
                    : "0%",
                }}
              />
            </div>
            <span className="text-xs tabular-nums text-slate-500">
              {elapsed.toFixed(1)}s
            </span>
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            Prévia visual das cenas. Exportação MP4 disponível em breve.
          </p>
        </div>
        <Panel title="Inspector da cena">
          {current ? (
            <>
              <Field label="Texto / legenda">
                <textarea
                  rows={5}
                  className={inputClass}
                  value={current.text}
                  onChange={(e) => patch("text", e.target.value)}
                />
              </Field>
              <Field label="Duração (segundos)">
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  max="600"
                  value={current.duration}
                  onChange={(e) =>
                    patch(
                      "duration",
                      Math.max(1, Math.min(600, Number(e.target.value) || 1)),
                    )
                  }
                />
              </Field>
              <Field label="Enquadramento da mídia"><select className={inputClass} value={current.fit || 'cover'} onChange={(e) => patch('fit', e.target.value)}><option value="cover">Preencher e cortar sobras</option><option value="contain">Mostrar mídia inteira</option></select></Field>
              <Field label="Estilo da legenda"><select className={inputClass} value={current.captionStyle || 'Clássica'} onChange={(e) => patch('captionStyle', e.target.value)}>{['Clássica', 'Impacto', 'Caixa'].map((style) => <option key={style}>{style}</option>)}</select></Field>
              <Field label="Posição da legenda"><select className={inputClass} value={current.captionPosition || 'bottom'} onChange={(e) => patch('captionPosition', e.target.value)}><option value="bottom">Inferior</option><option value="center">Centro</option><option value="top">Superior</option></select></Field>
              <Field label="Tamanho da legenda na prévia"><input type="range" min="12" max="42" value={current.captionSize || 20} onChange={(e) => patch('captionSize', +e.target.value)} /></Field>
              <Field label="Cor de fundo">
                <input
                  type="color"
                  value={current.color}
                  onChange={(e) => patch("color", e.target.value)}
                  className="h-10 w-full cursor-pointer rounded"
                />
              </Field>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 p-3 text-xs text-sky-300">
                <Upload size={15} />
                Imagem ou vídeo
                <input
                  type="file"
                  hidden
                  accept="image/*,video/*"
                  onChange={(e) => upload(e.target.files[0])}
                />
              </label>
              {current.media && (
                <Button
                  onClick={() => {
                    patch("media", null);
                    patch("mediaType", null);
                  }}
                >
                  Remover mídia
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  aria-label="Mover cena para esquerda"
                  disabled={selected === 0}
                  onClick={() => move(-1)}
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  aria-label="Mover cena para direita"
                  disabled={selected === scenes.length - 1}
                  onClick={() => move(1)}
                >
                  <ChevronRight size={14} />
                </Button>
                <Button
                  aria-label="Excluir cena"
                  onClick={() =>
                    setScenes((list) => list.filter((_, i) => i !== selected))
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Adicione uma cena ou organize seu roteiro.
            </p>
          )}
        </Panel>
      </div>
      <Panel title="Timeline">
        <div className="mb-3 flex gap-6 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Film size={12} />
            CENAS
          </span>
          <span className="flex items-center gap-1">
            <Volume2 size={12} />
            NARRAÇÃO / MÍDIA
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setSelected(i);
                setElapsed(0);
                setPlaying(false);
              }}
              className={`relative min-w-[130px] max-w-[180px] rounded-xl border p-3 text-left ${selected === i ? "border-sky-400" : "border-slate-700"}`}
              style={{ background: s.color }}
            >
              <span className="text-[9px] font-bold text-white/50">
                {String(i + 1).padStart(2, "0")} · {s.duration}s
              </span>
              <p className="mt-3 line-clamp-2 text-xs font-semibold text-white">
                {s.text}
              </p>
              {s.media && (
                <span className="mt-2 block text-[9px] text-white/50">
                  Mídia vinculada
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => {
              setScenes((list) => [...list, ...makeScenes("Nova cena")]);
              setSelected(scenes.length);
            }}
            className="flex min-w-[100px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 text-xs text-slate-500"
          >
            <Plus size={18} />
            Adicionar
          </button>
        </div>
      </Panel>
    </div>
  );
}

