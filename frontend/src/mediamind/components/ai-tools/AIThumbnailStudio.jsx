import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ImagePlus, Wand2, RotateCcw, Layers } from "lucide-react";
import { zipSync } from "fflate";
import { createLocalCutout } from "../../lib/thumbnailImage";
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
const themes = [
  ["Impacto", "#08152e", "#38bdf8"],
  ["Alerta", "#271011", "#fb7185"],
  ["Autoridade", "#16102b", "#a78bfa"],
];
const layouts = [
  "Texto à esquerda",
  "Texto à direita",
  "Dividido",
  "Título superior",
  "Título inferior",
  "Centralizado",
  "Editorial",
];
function wrap(ctx, text, x, y, width, lineHeight) {
  let line = "",
    lines = [];
  for (const word of text.split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  for (const [i, item] of lines.slice(0, 5).entries())
    ctx.fillText(item, x, y + i * lineHeight);
  return lines.length;
}
export function ThumbCanvas({ settings, photo, theme, onReady }) {
  const ref = useRef(null);
  const sequence = useRef(0);
  useEffect(() => {
    let active = true;
    const token = ++sequence.current;
    async function draw() {
      const c = ref.current;
      if (!c) return;
      c.dataset.ready = "false";
      const [w, h] = settings.format === "9:16" ? [720, 1280] : [1280, 720];
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, theme[1]);
      bg.addColorStop(1, "#030712");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = theme[2] + "22";
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.35, w * 0.5, 0, Math.PI * 2);
      ctx.fill();
      const load = (src) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = src;
        });
      if (settings.background) {
        try {
          const i = await load(settings.background);
          if (!active) return;
          const scale = Math.max(w / i.width, h / i.height);
          ctx.globalAlpha = 0.6;
          ctx.drawImage(
            i,
            (w - i.width * scale) / 2,
            (h - i.height * scale) / 2,
            i.width * scale,
            i.height * scale,
          );
          ctx.globalAlpha = 1;
        } catch {}
      }
      if (photo) {
        try {
          const i = await load(photo);
          if (!active || token !== sequence.current) return;
          const vertical = settings.format === "9:16";
          const sh = (h * (vertical ? 0.65 : settings.layout === 4 ? 0.82 : 1.03) * settings.scale) / 100;
          const sw = (i.width * sh) / i.height;
          let x = settings.layout === 1 ? w * 0.0 : w * 0.5;
          if (settings.layout >= 3 && settings.layout !== 6) x = (w - sw) / 2;
          const y =
            (settings.layout === 4 ? -h * 0.04 : h - sh) +
            (h * settings.y) / 100;
          ctx.save();
          ctx.filter =
            settings.filter === "PB"
              ? "grayscale(1)"
              : settings.filter === "Vibrante"
                ? "saturate(1.7) contrast(1.1)"
                : "none";
          ctx.shadowColor = theme[2];
          ctx.shadowBlur = settings.glow ? 30 : 0;
          if (settings.flip) {
            ctx.translate(x + sw + (w * settings.x) / 100, y);
            ctx.scale(-1, 1);
            ctx.drawImage(i, 0, 0, sw, sh);
          } else ctx.drawImage(i, x + (w * settings.x) / 100, y, sw, sh);
          ctx.restore();
        } catch {}
      } else {
        ctx.fillStyle = theme[2] + "55";
        ctx.beginPath();
        ctx.arc(w * 0.79, h * 0.38, h * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(w * 0.79, h * 0.9, w * 0.19, h * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (settings.layout === 2) {
        ctx.fillStyle = theme[2] + "55";
        ctx.fillRect(w * 0.48, 0, 4, h);
      }
      if (settings.layout === 5) {
        ctx.fillStyle = "#03071299";
        ctx.fillRect(0, 0, w, h);
      }
      if (settings.layout === 6) {
        ctx.fillStyle = theme[2];
        ctx.fillRect(w * 0.04, h * 0.23, 8, h * 0.48);
      }
      const vertical = settings.format === "9:16";
      const centered = settings.layout === 5;
      const titleX = centered
        ? w / 2
        : settings.layout >= 3 && settings.layout !== 6
          ? w * 0.06
          : settings.layout === 1
            ? w * 0.48
            : w * 0.06;
      ctx.textAlign = centered ? "center" : "left";
      let textY =
        h * (settings.layout === 4 ? 0.65 : settings.layout === 3 ? 0.2 : 0.31);
      const max = vertical
        ? w * 0.86
        : settings.layout >= 3 && settings.layout !== 6
          ? w * 0.87
          : w * 0.45;
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "white";
      let size = Math.round(((vertical ? 64 : 72) * settings.fontSize) / 100);
      const measureLines = () => {
        let count = 1,
          line = "";
        for (const word of settings.title.toUpperCase().split(/\s+/)) {
          const next = line ? line + " " + word : word;
          if (ctx.measureText(next).width > max && line) {
            count++;
            line = word;
          } else line = next;
        }
        return count;
      };
      ctx.font = `900 ${size}px Arial`;
      while (
        size > 28 &&
        measureLines() * size * 1.16 > h * (settings.layout === 4 ? 0.23 : 0.44)
      ) {
        size -= 2;
        ctx.font = `900 ${size}px Arial`;
      }
      const lines = wrap(
        ctx,
        settings.title.toUpperCase(),
        titleX,
        textY,
        max,
        size * 1.16,
      );
      ctx.shadowBlur = 0;
      ctx.fillStyle = theme[2];
      ctx.font = `900 ${vertical ? 34 : 38}px Arial`;
      wrap(
        ctx,
        settings.highlight.toUpperCase(),
        titleX,
        Math.min(h * 0.89, textY + Math.min(5, lines) * size * 1.16 + 18),
        max,
        44,
      );
      ctx.textAlign = "left";
      ctx.fillStyle = theme[2];
      ctx.fillRect(
        w * 0.06,
        h * 0.065,
        Math.min(w * 0.8, ctx.measureText(settings.badge).width + 40),
        52,
      );
      ctx.fillStyle = "#07111f";
      ctx.font = "bold 24px Arial";
      ctx.fillText(settings.badge.toUpperCase(), w * 0.06 + 20, h * 0.065 + 35);
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#ffffff99";
      ctx.fillText("MEDIAMIND", w * 0.06, h * 0.95);
      c.dataset.ready = "true";
      onReady?.();
    }
    draw();
    return () => {
      active = false;
    };
  }, [settings, photo, theme, onReady]);
  return (
    <canvas
      ref={ref}
      aria-label={`Prévia ${theme[0]}`}
      className="h-auto w-full rounded-xl"
    />
  );
}
export default function AIThumbnailStudio() {
  const [settings, setSettings] = useState({
    title: "O próximo nível do seu conteúdo",
    highlight: "COMEÇA AQUI",
    badge: "GUIA COMPLETO",
    format: "16:9",
    layout: 0,
    scale: 100,
    x: 0,
    y: 0,
    fontSize: 100,
    filter: "Natural",
    glow: true,
    flip: false,
    background: null,
  });
  const [original, setOriginal] = useState(null),
    [cutout, setCutout] = useState(null),
    [compare, setCompare] = useState(false),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const fileRef = useRef(null),
    version = useRef(0),
    cutoutRef = useRef(null),
    preview = useRef(null);
  useEffect(
    () => () => {
      if (cutoutRef.current) URL.revokeObjectURL(cutoutRef.current);
    },
    [],
  );
  const patch = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  async function upload(file) {
    if (!file) return;
    try {
      const data = await readImage(file);
      version.current++;
      if (cutoutRef.current) URL.revokeObjectURL(cutoutRef.current);
      cutoutRef.current = null;
      setOriginal(data);
      setCutout(null);
      setMessage(
        "Foto adicionada. Clique em remover fundo para recortar a pessoa.",
      );
    } catch (e) {
      setMessage(e.message);
    }
  }
  async function remove() {
    if (!original) return;
    setBusy(true);
    const token = version.current;
    setMessage("Preparando o recorte de pessoa no navegador…");
    try {
      const blob = await (await fetch(original)).blob();
      const url = await createLocalCutout(blob);
      if (token !== version.current) {
        URL.revokeObjectURL(url);
        return;
      }
      if (cutoutRef.current) URL.revokeObjectURL(cutoutRef.current);
      cutoutRef.current = url;
      setCutout(url);
      setCompare(false);
      setMessage("Fundo removido. Você pode comparar com a foto original.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function exportImages(all = false, type = "image/png") {
    try {
      const canvases = [...preview.current.querySelectorAll("canvas")];
      const targets = all ? canvases : [canvases[selected]];
      if (targets.some((c) => c.dataset.ready !== "true"))
        throw new Error("Aguarde a imagem terminar de carregar.");
      const files = {};
      for (const [i, c] of targets.entries()) {
        const blob = await new Promise((r) => c.toBlob(r, type, 0.94));
        if (!blob) throw new Error("Não foi possível exportar.");
        const name = `mediamind-thumb-${all ? i + 1 : selected + 1}.${type === "image/png" ? "png" : "jpg"}`;
        if (!all) downloadBlob(blob, name);
        else files[name] = new Uint8Array(await blob.arrayBuffer());
      }
      if (all)
        downloadBlob(
          new Blob([zipSync(files)], { type: "application/zip" }),
          "mediamind-thumbnails.zip",
        );
      setMessage(
        all
          ? "As três versões foram exportadas."
          : "Thumbnail exportada na resolução final.",
      );
    } catch (e) {
      setMessage(e.message);
    }
  }
  const photo = compare ? original : cutout || original;
  return (
    <section className="space-y-5">
      <StudioHeader
        title="Thumbnails IA"
        description="Crie três direções visuais, recorte sua foto e exporte uma capa pronta para publicar."
      >
        <Link
          to="/thumbnails"
          className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300"
        >
          Abrir editor de Thumbnails
        </Link>
        <Button onClick={() => exportImages(true)}>
          <Layers size={16} />
          Baixar as 3
        </Button>
      </StudioHeader>
      <Notice>{message}</Notice>
      <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel title="Foto principal" number="01">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                upload(e.dataTransfer.files[0]);
              }}
              className="rounded-xl border border-dashed border-slate-600 bg-slate-950/60 p-5 text-center"
            >
              {original ? (
                <img
                  src={original}
                  alt="Foto original"
                  className="mx-auto mb-3 h-28 max-w-full rounded-lg object-contain"
                />
              ) : (
                <ImagePlus className="mx-auto mb-3 text-sky-400" size={30} />
              )}
              <button
                onClick={() => fileRef.current.click()}
                className="text-sm font-bold text-sky-300"
              >
                Enviar ou arrastar foto
              </button>
              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG ou WebP · até 15 MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => upload(e.target.files[0])}
              />
            </div>
            <Button primary disabled={!original || busy} onClick={remove}>
              <Wand2 size={16} />
              {busy ? "Recortando…" : "Remover fundo com IA"}
            </Button>
            {cutout && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={(e) => setCompare(e.target.checked)}
                />
                Comparar com original
              </label>
            )}
            <p className="text-xs leading-relaxed text-slate-500">
              Recorte otimizado para pessoas. A primeira utilização precisa de
              internet para carregar o modelo; a foto é processada neste
              dispositivo.
            </p>
          </Panel>
          <Panel title="Texto da capa" number="02">
            {[
              ["title", "Título"],
              ["highlight", "Destaque"],
              ["badge", "Etiqueta"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className={inputClass}
                  value={settings[key]}
                  onChange={(e) => patch(key, e.target.value)}
                  maxLength={key === "title" ? 90 : 40}
                />
              </Field>
            ))}
            <Field label="Tamanho do título">
              <input
                type="range"
                min="60"
                max="125"
                value={settings.fontSize}
                onChange={(e) => patch("fontSize", +e.target.value)}
                className="w-full accent-sky-400"
              />
            </Field>
          </Panel>
        </aside>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {["16:9", "9:16"].map((f) => (
                <Button
                  key={f}
                  primary={settings.format === f}
                  onClick={() => patch("format", f)}
                >
                  {f === "16:9" ? "YouTube · 16:9" : "Reels · 9:16"}
                </Button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {settings.format === "16:9" ? "1280 × 720" : "720 × 1280"} px ·
              prévia ao vivo
            </span>
          </div>
          <div ref={preview} className="grid items-start gap-3 md:grid-cols-3">
            {themes.map((theme, i) => (
              <button
                key={theme[0]}
                onClick={() => setSelected(i)}
                className={`overflow-hidden rounded-2xl border-2 p-2 text-left ${i === selected ? "border-sky-400 bg-sky-950/40" : "border-slate-800 bg-slate-900"}`}
              >
                <ThumbCanvas settings={settings} photo={photo} theme={theme} />
                <span className="mt-3 flex justify-between px-1 pb-2 text-xs font-bold text-white">
                  {theme[0]}
                  <span className="text-slate-500">VERSÃO {i + 1}</span>
                </span>
              </button>
            ))}
          </div>
          <Panel title="Composição e acabamento" number="03">
            <div className="grid gap-2 sm:grid-cols-4">
              {layouts.map((l, i) => (
                <button
                  key={l}
                  onClick={() => patch("layout", i)}
                  className={`rounded-xl border p-3 text-xs ${settings.layout === i ? "border-sky-400 bg-sky-500/10 text-sky-200" : "border-slate-700 text-slate-400"}`}
                >
                  <div className="mb-2 h-8 rounded bg-gradient-to-r from-slate-600 to-slate-800" />
                  {l}
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["scale", "Escala da foto", 50, 180],
                ["x", "Posição horizontal", -60, 60],
                ["y", "Posição vertical", -50, 50],
              ].map(([k, l, min, max]) => (
                <Field key={k} label={`${l} · ${settings[k]}`}>
                  <input
                    type="range"
                    className="w-full accent-sky-400"
                    min={min}
                    max={max}
                    value={settings[k]}
                    onChange={(e) => patch(k, +e.target.value)}
                  />
                </Field>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Field label="Filtro">
                <select
                  className={inputClass}
                  value={settings.filter}
                  onChange={(e) => patch("filter", e.target.value)}
                >
                  {["Natural", "PB", "Vibrante"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              {[
                ["glow", "Contorno luminoso"],
                ["flip", "Espelhar foto"],
              ].map(([k, l]) => (
                <label key={k} className="flex gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={settings[k]}
                    onChange={(e) => patch(k, e.target.checked)}
                  />
                  {l}
                </label>
              ))}
              <label className="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300">
                Fundo personalizado
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    try {
                      patch("background", await readImage(e.target.files[0]));
                    } catch (err) {
                      setMessage(err.message);
                    }
                  }}
                />
              </label>
              {settings.background && (
                <Button onClick={() => patch("background", null)}>
                  <RotateCcw size={14} />
                  Limpar fundo
                </Button>
              )}
            </div>
          </Panel>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => exportImages(false, "image/jpeg")}>
              <Download size={16} />
              Baixar JPG
            </Button>
            <Button primary onClick={() => exportImages()}>
              <Download size={16} />
              Baixar PNG · versão {selected + 1}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
