import { useWorkDraftState } from "../../lib/workProtection";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Field,
  Panel,
  StudioHeader,
  Notice,
  inputClass,
  readImage,
  downloadBlob,
} from "./StudioUI";
import StudioProjectBar from "./StudioProjectBar";
import {
  SOCIAL_FORMATS,
  getSocialFormat,
  socialFormatLabel,
} from "../../lib/socialFormats";
const defaults = {
  name: "",
  handle: "",
  headline: "",
  color: "#0ea5e9",
  fit: "contain",
  trim: 0,
  originalAudio: true,
  template: "Barras",
  overlay: "",
  logo: "",
  format: "9:16",
};
export default function FramesStudio() {
  const [settings, setSettings] = useState(defaults),
    [videos, setVideos] = useWorkDraftState("components/ai-tools/FramesStudio.jsx:videos", []),
    [selected, setSelected] = useWorkDraftState("components/ai-tools/FramesStudio.jsx:selected", 0),
    [message, setMessage] = useState("");
  const video = useRef(null);
  const current = videos[selected];
  const format = getSocialFormat(settings.format);
  const urls = useRef(new Set());
  useEffect(
    () => () => urls.current.forEach((u) => URL.revokeObjectURL(u)),
    [],
  );
  useEffect(() => {
    const player = video.current;
    if (player && Number.isFinite(player.duration))
      player.currentTime = Math.min(
        settings.trim,
        Math.max(0, player.duration - 0.1),
      );
  }, [settings.trim]);
  const patch = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  function addFiles(files) {
    const next = [...files]
      .filter((f) => f.type.startsWith("video/"))
      .map((f) => {
        const url = URL.createObjectURL(f);
        urls.current.add(url);
        return { id: crypto.randomUUID(), name: f.name, url };
      });
    setVideos((list) => [...list, ...next]);
    if (!next.length) setMessage("Escolha arquivos de vídeo.");
  }
  async function uploadImage(file, key) {
    try {
      patch(key, await readImage(file));
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function exportFrame() {
    try {
      const source = video.current;
      if (!source || source.readyState < 2)
        throw new Error("Aguarde o vídeo carregar e escolha o quadro.");
      const c = document.createElement("canvas");
      c.width = format.width;
      c.height = format.height;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, c.width, c.height);
      const topHeight = Math.round(c.height * 0.11);
      const bottomHeight = Math.round(c.height * 0.135);
      const area = {
        x: 0,
        y: topHeight,
        w: c.width,
        h: c.height - topHeight - bottomHeight,
      };
      const scale =
        settings.fit === "cover"
          ? Math.max(area.w / source.videoWidth, area.h / source.videoHeight)
          : Math.min(area.w / source.videoWidth, area.h / source.videoHeight);
      const w = source.videoWidth * scale,
        h = source.videoHeight * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(area.x, area.y, area.w, area.h);
      ctx.clip();
      if (settings.fit === "blur") {
        const bgScale = Math.max(
          area.w / source.videoWidth,
          area.h / source.videoHeight,
        );
        ctx.filter = "blur(25px)";
        ctx.drawImage(
          source,
          (c.width - source.videoWidth * bgScale) / 2,
          area.y + (area.h - source.videoHeight * bgScale) / 2,
          source.videoWidth * bgScale,
          source.videoHeight * bgScale,
        );
        ctx.filter = "none";
      }
      ctx.drawImage(
        source,
        (c.width - w) / 2,
        area.y + (area.h - h) / 2,
        w,
        h,
      );
      ctx.restore();
      ctx.fillStyle = settings.color;
      ctx.fillRect(0, 0, c.width, topHeight);
      ctx.fillRect(0, c.height - bottomHeight, c.width, bottomHeight);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(24, Math.round(c.width * 0.048))}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(
        settings.headline || settings.name,
        c.width / 2,
        topHeight * 0.65,
        c.width * 0.9,
      );
      ctx.font = `bold ${Math.max(22, Math.round(c.width * 0.044))}px Arial`;
      ctx.fillText(
        settings.name,
        c.width / 2,
        c.height - bottomHeight * 0.55,
        c.width * 0.88,
      );
      ctx.font = `${Math.max(18, Math.round(c.width * 0.033))}px Arial`;
      ctx.fillText(
        settings.handle,
        c.width / 2,
        c.height - bottomHeight * 0.25,
        c.width * 0.88,
      );
      const drawImage = async (url, x, y, w, h) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        ctx.drawImage(img, x, y, w, h);
      };
      if (settings.logo) {
        const logoSize = Math.round(Math.min(c.width, bottomHeight) * 0.42);
        await drawImage(
          settings.logo,
          Math.round(c.width * 0.04),
          c.height - bottomHeight + (bottomHeight - logoSize) / 2,
          logoSize,
          logoSize,
        );
      }
      if (settings.template === "PNG próprio" && settings.overlay)
        await drawImage(settings.overlay, 0, 0, c.width, c.height);
      const blob = await new Promise((resolve) =>
        c.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Não foi possível gerar o quadro.");
      downloadBlob(
        blob,
        `mediamind-moldura-${format.id.replace(":", "x")}.png`,
      );
      setMessage(
        "Quadro PNG exportado. A aplicação da moldura ao vídeo inteiro ainda precisa do motor de renderização.",
      );
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <section className="space-y-5">
      <StudioHeader
        title="Estúdio de Molduras"
        description="Prepare a identidade da página, selecione vários vídeos e confira como a moldura aparece em cada corte."
      />
      <StudioProjectBar
        tool="frames"
        value={{ settings, videos }}
        onLoad={(v) => {
          setSettings({ ...defaults, ...v.settings });
          setVideos(Array.isArray(v.videos) ? v.videos : []);
          setSelected(0);
        }}
      />
      <Notice>{message}</Notice>
      <div
        data-studio-layout="frames"
        className="grid items-start gap-4 xl:grid-cols-[300px_minmax(420px,1fr)_290px]"
      >
        <aside className="space-y-4">
          <Panel title="Sua página" number="01">
            {[
              ["name", "Nome da página"],
              ["handle", "@ da página"],
              ["headline", "Chamada no topo"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className={inputClass}
                  value={settings[key]}
                  onChange={(e) => patch(key, e.target.value)}
                />
              </Field>
            ))}
            <Field label="Cor da moldura">
              <input
                type="color"
                value={settings.color}
                onChange={(e) => patch("color", e.target.value)}
              />
            </Field>
            <Field label="Logo da página">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadImage(e.target.files[0], "logo")}
              />
            </Field>
          </Panel>
          <Panel title="Moldura" number="02">
            <Field label="Formato da moldura">
              <select
                aria-label="Formato da moldura"
                className={inputClass}
                value={settings.format}
                onChange={(e) => patch("format", e.target.value)}
              >
                {SOCIAL_FORMATS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {socialFormatLabel(item.id)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {["Barras", "PNG próprio"].map((t) => (
                <Button
                  key={t}
                  primary={settings.template === t}
                  onClick={() => patch("template", t)}
                >
                  {t}
                </Button>
              ))}
            </div>
            {settings.template === "PNG próprio" && (
              <Field label="PNG com centro transparente">
                <input
                  type="file"
                  accept="image/png"
                  onChange={(e) => uploadImage(e.target.files[0], "overlay")}
                />
              </Field>
            )}
          </Panel>
          <Panel title="Vídeos do lote" number="03">
            <div
              className="rounded-xl border border-dashed border-slate-600 p-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
            >
              <input
                aria-label="Vídeos do lote"
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <p className="mt-2 text-xs text-slate-500">
                Arraste ou selecione vários vídeos.
              </p>
            </div>
          </Panel>
        </aside>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[linear-gradient(45deg,#0b1220_25%,transparent_25%),linear-gradient(-45deg,#0b1220_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#0b1220_75%),linear-gradient(-45deg,transparent_75%,#0b1220_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] p-5">
            <div
              data-testid="frame-preview"
              className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-slate-700 bg-black ${format.width > format.height ? "max-w-[760px]" : format.width === format.height ? "max-w-[520px]" : "max-w-[360px]"}`}
              style={{ aspectRatio: `${format.width} / ${format.height}` }}
            >
              <div
                className="absolute inset-x-0 top-0 flex h-[11%] items-center justify-center px-4 text-center text-lg font-bold text-white"
                style={{ background: settings.color }}
              >
                {settings.headline || settings.name || "Sua chamada"}
              </div>
              <div className="absolute inset-x-0 bottom-[13.5%] top-[11%] overflow-hidden">
                {settings.fit === "blur" && current && (
                  <video
                    src={current.url}
                    muted
                    className="absolute h-full w-full scale-110 object-cover blur-lg opacity-70"
                  />
                )}
                {current ? (
                  <video
                    key={current.id}
                    ref={video}
                    src={current.url}
                    controls
                    muted={!settings.originalAudio}
                    playsInline
                    onLoadedMetadata={(e) => {
                      const max = Math.max(0, e.currentTarget.duration - 0.1);
                      e.currentTarget.currentTime = Math.min(
                        settings.trim,
                        max,
                      );
                    }}
                    className={`relative h-full w-full ${settings.fit === "cover" ? "object-cover" : "object-contain"}`}
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-slate-500">
                    Envie um vídeo para conferir
                  </div>
                )}
              </div>
              <div
                className="absolute inset-x-0 bottom-0 flex h-[13.5%] items-center justify-center gap-3 p-4 text-white"
                style={{ background: settings.color }}
              >
                {settings.logo && (
                  <img
                    src={settings.logo}
                    alt="Logo"
                    className="h-12 w-12 object-contain"
                  />
                )}
                <div className="text-center">
                  <strong>{settings.name || "Sua página"}</strong>
                  <p className="text-xs">{settings.handle}</p>
                </div>
              </div>
              {settings.template === "PNG próprio" && settings.overlay && (
                <img
                  src={settings.overlay}
                  alt="Moldura personalizada"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              )}
            </div>
          </div>
          <Panel title={`Fila de vídeos · ${videos.length}`}>
            {videos.map((v, i) => (
              <div
                key={v.id}
                className="flex items-center gap-2 text-sm text-slate-300"
              >
                <Button primary={i === selected} onClick={() => setSelected(i)}>
                  {i + 1}. {v.name}
                </Button>
                <Button
                  onClick={() => {
                    setVideos((list) => list.filter((x) => x.id !== v.id));
                    setSelected(0);
                  }}
                >
                  Remover
                </Button>
              </div>
            ))}
            <Button disabled={!videos.length} onClick={exportFrame}>
              Baixar quadro da prévia · PNG
            </Button>
            <p className="text-xs text-slate-500">
              O projeto e as mídias podem ser salvos. Exportação de vídeos em
              lote ainda depende do motor de renderização; o PNG é um quadro da
              prévia.
            </p>
          </Panel>
        </div>
        <aside className="space-y-4">
          <Panel title="Camadas">
            {[
              "Logo do canal",
              "Título do programa",
              "Legenda",
              "Nome do entrevistado",
              "Moldura",
              "Vídeo original",
            ].map((layer, index) => (
              <div
                key={layer}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${index === 4 ? "border-sky-400 bg-sky-950/40 text-sky-200" : "border-slate-800 text-slate-300"}`}
              >
                <span>{layer}</span>
                <span aria-hidden="true">{index < 2 ? "▣" : "◉"}</span>
              </div>
            ))}
          </Panel>
          <Panel title="Propriedades">
            <Field label="Como o vídeo entra">
              <select
                className={inputClass}
                value={settings.fit}
                onChange={(e) => patch("fit", e.target.value)}
              >
                <option value="contain">Inteiro + barras pretas</option>
                <option value="cover">Preencher e cortar sobras</option>
                <option value="blur">Inteiro + fundo desfocado</option>
              </select>
            </Field>
            <Field label={`Cortar início · ${settings.trim}s`}>
              <input
                aria-label="Cortar início (segundos)"
                className="w-full accent-sky-400"
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={settings.trim}
                onChange={(e) => patch("trim", Number(e.target.value))}
              />
            </Field>
            <label className="flex gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={settings.originalAudio}
                onChange={(e) => patch("originalAudio", e.target.checked)}
              />
              Som original na prévia
            </label>
            <Button primary disabled={!videos.length} onClick={exportFrame}>
              Exportar moldura PNG
            </Button>
          </Panel>
        </aside>
      </div>
    </section>
  );
}
