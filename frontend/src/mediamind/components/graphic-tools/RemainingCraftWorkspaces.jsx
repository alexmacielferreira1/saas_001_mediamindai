import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  FolderPlus,
  Grid3X3,
  Image,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Upload,
} from "lucide-react";
import {
  DEFAULT_ADJUST,
  autoAdjust,
  developImageData,
  paintBrush,
} from "./lightcraftPipeline";
import { readPdfInfo } from "./pdfcraftParse";

const LIGHT_KEY = "RemainingCraftWorkspaces.jsx:light";
const CATALOG = [
  "Todas as fotografias",
  "Coleção rápida",
  "Importação anterior",
  "Fotos sinalizadas",
  "Cinco estrelas",
];
const FOLDERS = ["2026", "Fronteiras da Saúde", "Eventos", "Institucional"];
const COLLECTIONS = ["Selecionadas", "Publicação", "Retratos", "SIMERS"];
const COLOR_LABELS = ["", "Vermelho", "Amarelo", "Verde", "Azul", "Roxo"];
const COLOR_CLASS = {
  Vermelho: "text-red-400",
  Amarelo: "text-amber-300",
  Verde: "text-emerald-400",
  Azul: "text-sky-400",
  Roxo: "text-violet-400",
};
const MASK_TYPES = { Linear: "linear", Radial: "radial", Pincel: "brush" };
const PREVIEW_MAX = 900;
const isImage = (asset) => Boolean(asset?.type?.startsWith("image"));

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem não decodificável"));
    img.src = url;
  });
}

function readPixels(img, maxSide) {
  const width0 = img.naturalWidth || img.width;
  const height0 = img.naturalHeight || img.height;
  const scale = maxSide ? Math.min(1, maxSide / Math.max(width0, height0)) : 1;
  const width = Math.max(1, Math.round(width0 * scale));
  const height = Math.max(1, Math.round(height0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador");
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, ctx, image: ctx.getImageData(0, 0, width, height) };
}

function copyImageData(ctx, source) {
  const out = ctx.createImageData(source.width, source.height);
  out.data.set(source.data);
  return out;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function LightCraftWorkspace({
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [module, setModule] = useGraphicDraftState("RemainingCraftWorkspaces.jsx:module", "Revelação");
  const [adjust, setAdjust] = useGraphicDraftState("RemainingCraftWorkspaces.jsx:adjust", {
    exposição: 0,
    contraste: 0,
    realces: -18,
    sombras: 24,
    brancos: 5,
    pretos: -8,
    textura: 10,
    claridade: 8,
    saturação: 4,
  });
  const [photos, setPhotos] = useGraphicDraftState(`${LIGHT_KEY}:photos`, {});
  const [albums, setAlbums] = useGraphicDraftState(`${LIGHT_KEY}:albums`, {});
  const [lastImport, setLastImport] = useGraphicDraftState(`${LIGHT_KEY}:lastImport`, []);
  const [filter, setFilter] = useGraphicDraftState(`${LIGHT_KEY}:filter`, "Todas as fotografias");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("after");
  const [activeMask, setActiveMask] = useState(null);
  const [picked, setPicked] = useState([]);
  const [status, setStatus] = useState("");
  const [decoded, setDecoded] = useState(null);
  const canvasRef = useRef(null);
  const pendingImport = useRef(null);
  const painting = useRef(false);

  const images = assets.filter(isImage);
  const source = isImage(selected) ? selected : images[0];
  const meta = (source && photos[source.id]) || {};
  const photoAdjust = meta.adjust || adjust;
  const profile = meta.profile || "Adobe Color";
  const masks = meta.masks || [];
  const editingMask = masks.find((mask) => mask.id === activeMask) || null;
  const shownAdjust = editingMask ? { ...DEFAULT_ADJUST, ...editingMask.adjust } : photoAdjust;
  const rating = meta.rating || 0;

  function updatePhoto(id, change) {
    setPhotos((old) => ({ ...old, [id]: { ...(old[id] || {}), ...change(old[id] || {}) } }));
  }
  function inEntry(asset, entry) {
    const info = photos[asset.id] || {};
    if (entry === "Todas as fotografias") return true;
    if (entry === "Importação anterior") return lastImport.includes(asset.id);
    if (entry === "Fotos sinalizadas") return Boolean(info.flag);
    if (entry === "Cinco estrelas") return info.rating === 5;
    return (albums[entry] || []).includes(asset.id);
  }
  const visible = images.filter(
    (asset) =>
      inEntry(asset, filter) &&
      (!query.trim() || asset.name.toLowerCase().includes(query.trim().toLowerCase())),
  );

  useEffect(() => {
    if (!pendingImport.current) return;
    const before = pendingImport.current;
    const added = assets.filter((asset) => !before.has(asset.id)).map((asset) => asset.id);
    if (added.length) {
      setLastImport(added);
      pendingImport.current = null;
    }
  }, [assets, setLastImport]);

  useEffect(() => {
    setActiveMask(null);
    if (!source?.url) {
      setDecoded(null);
      return undefined;
    }
    let alive = true;
    loadImage(source.url)
      .then((img) => {
        if (!alive) return;
        const { image } = readPixels(img, PREVIEW_MAX);
        setDecoded({ url: source.url, image });
      })
      .catch(() => {
        if (!alive) return;
        setDecoded(null);
        setStatus("Não foi possível decodificar esta foto no navegador (RAW exige conversão prévia para JPG/PNG/TIFF).");
      });
    return () => {
      alive = false;
    };
  }, [source?.url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decoded || decoded.url !== source?.url) return;
    canvas.width = decoded.image.width;
    canvas.height = decoded.image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const out = copyImageData(ctx, decoded.image);
    developImageData(out, photoAdjust, { masks, profile });
    ctx.putImageData(out, 0, 0);
  });

  useEffect(() => {
    if (module !== "Apresentação" || visible.length < 2) return undefined;
    const timer = setInterval(() => {
      const index = visible.findIndex((asset) => asset.id === source?.id);
      onSelect(visible[(index + 1) % visible.length]);
    }, 3000);
    return () => clearInterval(timer);
  });

  function setAdjustValue(key, value) {
    if (!source) {
      setAdjust((old) => ({ ...old, [key]: value }));
      return;
    }
    if (editingMask) {
      updatePhoto(source.id, (info) => ({
        masks: (info.masks || []).map((mask) =>
          mask.id === editingMask.id ? { ...mask, adjust: { ...mask.adjust, [key]: value } } : mask,
        ),
      }));
      return;
    }
    updatePhoto(source.id, (info) => ({ adjust: { ...(info.adjust || adjust), [key]: value } }));
  }

  function needPhoto() {
    if (source) return false;
    setStatus("Importe ou selecione uma fotografia primeiro.");
    return true;
  }

  function rate(n) {
    if (needPhoto()) return;
    updatePhoto(source.id, (info) => ({ rating: info.rating === n ? 0 : n }));
  }

  function toggleFlag() {
    if (needPhoto()) return;
    updatePhoto(source.id, (info) => ({ flag: !info.flag }));
  }

  function cycleColor() {
    if (needPhoto()) return;
    updatePhoto(source.id, (info) => ({
      color: COLOR_LABELS[(COLOR_LABELS.indexOf(info.color || "") + 1) % COLOR_LABELS.length],
    }));
  }

  function clickThumb(event, asset) {
    if (event.ctrlKey || event.metaKey) {
      setPicked((old) => (old.includes(asset.id) ? old.filter((id) => id !== asset.id) : [...old, asset.id]));
      return;
    }
    if (event.shiftKey && source) {
      const list = visible.map((item) => item.id);
      const a = list.indexOf(source.id);
      const b = list.indexOf(asset.id);
      if (a >= 0 && b >= 0) {
        setPicked(list.slice(Math.min(a, b), Math.max(a, b) + 1));
        return;
      }
    }
    setPicked([]);
    onSelect(asset);
  }

  function dragIds(event) {
    try {
      const ids = JSON.parse(event.dataTransfer.getData("application/x-mmlight-photos") || "[]");
      return Array.isArray(ids) ? ids.filter((id) => images.some((asset) => asset.id === id)) : [];
    } catch {
      return [];
    }
  }

  function dropOn(event, entry) {
    event.preventDefault();
    const ids = dragIds(event);
    if (!ids.length) return;
    if (entry === "Fotos sinalizadas") {
      ids.forEach((id) => updatePhoto(id, () => ({ flag: true })));
    } else if (entry === "Cinco estrelas") {
      ids.forEach((id) => updatePhoto(id, () => ({ rating: 5 })));
    } else if (entry === "Todas as fotografias" || entry === "Importação anterior") {
      setStatus(`"${entry}" é uma coleção automática.`);
      return;
    } else {
      setAlbums((old) => ({ ...old, [entry]: [...new Set([...(old[entry] || []), ...ids])] }));
    }
    setStatus(`${ids.length} foto(s) adicionada(s) a "${entry}".`);
  }

  function count(entry) {
    return images.filter((asset) => inEntry(asset, entry)).length;
  }

  function sync() {
    if (needPhoto()) return;
    const targets = picked.filter((id) => id !== source.id);
    if (!targets.length) {
      setStatus("Selecione outras fotos na tira (Ctrl+clique ou Shift+clique) para sincronizar.");
      return;
    }
    setPhotos((old) => {
      const next = { ...old };
      targets.forEach((id) => {
        next[id] = {
          ...(old[id] || {}),
          adjust: { ...photoAdjust },
          profile,
          masks: masks.map((mask) => ({ ...mask, adjust: { ...mask.adjust } })),
        };
      });
      return next;
    });
    setStatus(`Ajustes sincronizados com ${targets.length} foto(s).`);
  }

  function chooseMask(label) {
    if (needPhoto()) return;
    const type = MASK_TYPES[label];
    if (!type) {
      setStatus(`Máscara "${label}" requer segmentação por IA, ainda não disponível no navegador. Use Linear, Radial ou Pincel.`);
      return;
    }
    const existing = masks.find((mask) => mask.type === type);
    if (existing) {
      const leaving = activeMask === existing.id;
      setActiveMask(leaving ? null : existing.id);
      setStatus(leaving ? "Editando ajustes globais." : `Editando máscara ${label}. Clique direito remove a máscara.`);
      return;
    }
    const mask = { id: `${type}-${Date.now()}`, type, adjust: { ...DEFAULT_ADJUST }, ...(type === "brush" ? { grid: [] } : {}) };
    updatePhoto(source.id, (info) => ({ masks: [...(info.masks || []), mask] }));
    setActiveMask(mask.id);
    setStatus(
      type === "brush"
        ? "Máscara Pincel criada: pinte sobre a foto e ajuste os controles."
        : `Máscara ${label} criada: os controles agora ajustam apenas a área da máscara.`,
    );
  }

  function removeMask(event, label) {
    event.preventDefault();
    if (!source) return;
    const existing = masks.find((mask) => mask.type === MASK_TYPES[label]);
    if (!existing) return;
    updatePhoto(source.id, (info) => ({ masks: (info.masks || []).filter((mask) => mask.id !== existing.id) }));
    if (activeMask === existing.id) setActiveMask(null);
    setStatus(`Máscara ${label} removida.`);
  }

  function paint(event) {
    if (!painting.current || editingMask?.type !== "brush" || !source) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const u = (event.clientX - rect.left) / (rect.width || 1);
    const v = (event.clientY - rect.top) / (rect.height || 1);
    if (u < 0 || v < 0 || u > 1 || v > 1) return;
    updatePhoto(source.id, (info) => ({
      masks: (info.masks || []).map((mask) =>
        mask.id === editingMask.id ? { ...mask, grid: paintBrush(mask.grid, u, v) } : mask,
      ),
    }));
  }

  function auto() {
    if (needPhoto()) return;
    if (!decoded) {
      setStatus("Aguarde a foto carregar para o ajuste automático.");
      return;
    }
    updatePhoto(source.id, () => ({ adjust: autoAdjust(decoded.image) }));
    setActiveMask(null);
    setStatus("Ajuste automático aplicado.");
  }

  async function renderFull() {
    const img = await loadImage(source.url);
    const { canvas, ctx, image } = readPixels(img, 0);
    developImageData(image, photoAdjust, { masks, profile });
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  async function exportPhoto() {
    if (needPhoto()) return;
    setStatus("Exportando…");
    try {
      const canvas = await renderFull();
      const png = source.type === "image/png";
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, png ? "image/png" : "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Falha ao codificar");
      const base = source.name.replace(/\.[^.]+$/, "") || "foto";
      const name = `${base}-editada.${png ? "png" : "jpg"}`;
      downloadBlob(blob, name);
      setStatus(`Exportado: ${name}`);
    } catch {
      setStatus("Não foi possível exportar esta foto (formato não decodificável no navegador).");
    }
  }

  async function printPhoto() {
    if (needPhoto()) return;
    try {
      const canvas = await renderFull();
      const win = window.open("", "_blank");
      if (!win) {
        setStatus("O navegador bloqueou a janela de impressão. Permita pop-ups para imprimir.");
        return;
      }
      win.document.title = source.name;
      const img = win.document.createElement("img");
      img.style.maxWidth = "100%";
      img.onload = () => win.print();
      img.src = canvas.toDataURL("image/jpeg", 0.95);
      win.document.body.appendChild(img);
      setStatus("Janela de impressão aberta.");
    } catch {
      setStatus("Não foi possível preparar a impressão desta foto.");
    }
  }

  function chooseModule(item) {
    setModule(item);
    setStatus(
      item === "Mapa"
        ? "Mapa: o MMLight ainda não lê coordenadas GPS (EXIF) das fotos."
        : item === "Livro"
          ? "Livro: diagramação de livros ainda não disponível no MMLight; use o MMDesign."
          : item === "Apresentação"
            ? `Apresentação: ${visible.length} foto(s), troca a cada 3 s.`
            : "",
    );
    if (item === "Imprimir") printPhoto();
  }

  const preview = (
    <canvas
      ref={canvasRef}
      aria-label="Prévia revelada"
      onPointerDown={(event) => {
        painting.current = true;
        paint(event);
      }}
      onPointerMove={paint}
      onPointerUp={() => {
        painting.current = false;
      }}
      onPointerLeave={() => {
        painting.current = false;
      }}
      className={`max-h-[560px] max-w-full shadow-2xl ${editingMask?.type === "brush" ? "cursor-crosshair" : ""}`}
    />
  );
  const original = (
    <img
      src={source?.url}
      alt="Original"
      className="max-h-[560px] max-w-full shadow-2xl"
    />
  );

  return (
    <section className="space-y-2 bg-[#17191c] text-slate-200">
      <header className="flex items-center border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold">LightCraft</h1>
          <p className="text-[10px] text-slate-500">
            Catálogo MediaMind · revelação RAW não destrutiva
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <label className="cursor-pointer rounded border border-slate-700 px-3 py-2 text-xs">
            <Upload size={14} className="mr-1 inline" />
            Importar fotos
            <input
              hidden
              multiple
              type="file"
              accept="image/*,.dng,.raw,.cr2,.nef,.arw"
              onChange={(e) => {
                pendingImport.current = new Set(assets.map((asset) => asset.id));
                onOpenFiles(e.target.files);
              }}
            />
          </label>
          <button
            onClick={exportPhoto}
            className="rounded bg-teal-400 px-3 py-2 text-xs font-bold text-slate-950"
          >
            <Download size={14} className="mr-1 inline" />
            Exportar
          </button>
        </div>
      </header>
      <nav className="flex justify-end gap-1 border-b border-slate-800 pb-1">
        {[
          "Biblioteca",
          "Revelação",
          "Mapa",
          "Livro",
          "Apresentação",
          "Imprimir",
        ].map((item) => (
          <button
            key={item}
            onClick={() => chooseModule(item)}
            className={`rounded px-3 py-1.5 text-xs ${module === item ? "bg-teal-500/20 text-teal-300" : "text-slate-500"}`}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="grid min-h-[720px] grid-cols-[235px_minmax(650px,1fr)_285px] gap-2">
        <aside className="rounded border border-slate-800 bg-[#202327] p-2">
          <label className="flex items-center gap-2 rounded border border-slate-700 bg-[#111317] p-2">
            <Search size={13} />
            <input
              placeholder="Pesquisar no catálogo"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 bg-transparent text-xs outline-none"
            />
          </label>
          <h3 className="mt-4 text-xs font-bold">Catálogo</h3>
          {CATALOG.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => dropOn(e, item)}
              aria-pressed={filter === item}
              aria-label={`${item} (${count(item)})`}
              className={`mt-1 flex w-full justify-between rounded px-2 py-1.5 text-left text-[10px] hover:bg-slate-700 ${filter === item ? "bg-slate-700" : ""}`}
            >
              <span>{item}</span>
              <span>{count(item)}</span>
            </button>
          ))}
          <h3 className="mt-4 text-xs font-bold">Pastas</h3>
          {FOLDERS.map(
            (item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => dropOn(e, item)}
                aria-pressed={filter === item}
                aria-label={`Pasta ${item}`}
                title="Arraste fotos da tira para adicionar"
                className={`mt-1 block w-full rounded px-2 py-1 text-left text-[10px] ${filter === item ? "bg-slate-700" : ""}`}
              >
                ▸ {item}
              </button>
            ),
          )}
          <h3 className="mt-4 text-xs font-bold">Coleções</h3>
          {COLLECTIONS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => dropOn(e, item)}
              aria-pressed={filter === item}
              aria-label={`Coleção ${item}`}
              title="Arraste fotos da tira para adicionar"
              className={`mt-1 block w-full rounded px-2 py-1 text-left text-[10px] ${filter === item ? "bg-slate-700" : ""}`}
            >
              ▸ {item}
            </button>
          ))}
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-800 bg-[#101214]">
          <div className="flex items-center gap-2 border-b border-slate-800 p-2 text-[10px]">
            <button onClick={() => setView("before")} className={view === "before" ? "text-teal-300" : ""}>Antes</button>
            <button onClick={() => setView("after")} className={view === "after" ? "text-teal-300" : ""}>Depois</button>
            <button onClick={() => setView("compare")} className={view === "compare" ? "text-teal-300" : ""}>Comparar Y|Y</button>
            {status && (
              <span role="status" className="truncate text-teal-300">
                {status}
              </span>
            )}
            <span className="ml-auto">
              Ajustar: <button onClick={auto} title="Ajuste automático de tom">Automático</button> · Perfil: {profile}
              {editingMask ? " · Máscara ativa" : ""}
            </span>
          </div>
          <div className="grid flex-1 place-items-center p-8">
            {module === "Biblioteca" ? (
              <div className="grid w-full grid-cols-4 gap-2 self-start">
                {visible.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={(e) => clickThumb(e, asset)}
                    onDoubleClick={() => {
                      onSelect(asset);
                      setModule("Revelação");
                    }}
                    className={`aspect-square overflow-hidden rounded border ${source?.id === asset.id ? "border-teal-400" : picked.includes(asset.id) ? "border-teal-700" : "border-slate-700"}`}
                  >
                    <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                  </button>
                ))}
                {!visible.length && (
                  <p className="col-span-4 text-center text-sm text-slate-500">
                    Nenhuma foto neste filtro.
                  </p>
                )}
              </div>
            ) : source ? (
              view === "before" ? (
                original
              ) : view === "compare" ? (
                <div className="flex w-full items-center justify-center gap-2 [&>*]:max-w-[49%]">
                  {original}
                  {preview}
                </div>
              ) : (
                preview
              )
            ) : (
              <div className="text-center">
                <Image size={70} className="mx-auto text-teal-400" />
                <h2 className="mt-3 text-xl font-bold">Revelação RAW</h2>
                <p className="text-sm text-slate-500">
                  Importe uma fotografia para começar.
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-slate-800 p-2">
            <div className="mb-2 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rate(n)} aria-label={`${n} estrela(s)`}>
                  <Star
                    size={15}
                    className={
                      n <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-600"
                    }
                  />
                </button>
              ))}
              <span className="ml-3 text-[10px] text-slate-500">
                <button onClick={toggleFlag} aria-pressed={Boolean(meta.flag)} className={meta.flag ? "text-teal-300" : ""}>Bandeira</button>
                {" · "}
                <button onClick={cycleColor} title={meta.color || "Sem rótulo de cor"} className={COLOR_CLASS[meta.color] || ""}>Cor</button>
                {" · "}
                <button onClick={() => !needPhoto() && updatePhoto(source.id, () => ({ rating: 0 }))} title="Remover avaliação">Avaliação</button>
              </span>
            </div>
            <div className="flex h-20 gap-2 overflow-x-auto">
              {visible.map((asset) => (
                <button
                  key={asset.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData(
                      "application/x-mmlight-photos",
                      JSON.stringify([...new Set([asset.id, ...picked])]),
                    )
                  }
                  onClick={(e) => clickThumb(e, asset)}
                  aria-label={asset.name}
                  className={`min-w-24 overflow-hidden rounded border ${source?.id === asset.id ? "border-teal-400" : picked.includes(asset.id) ? "border-teal-700" : "border-slate-700"}`}
                >
                  <img
                    src={asset.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </main>
        <aside className="overflow-auto rounded border border-slate-800 bg-[#202327] p-3">
          <div className="mb-3 h-24 rounded bg-[linear-gradient(90deg,#111_0%,#ddd_35%,#555_50%,#eee_75%,#222_100%)] opacity-80" />
          <h3 className="mb-2 text-xs font-bold">Histograma RGB</h3>
          <select
            aria-label="Perfil"
            value={profile}
            onChange={(e) => {
              if (needPhoto()) return;
              updatePhoto(source.id, () => ({ profile: e.target.value }));
            }}
            className="mb-3 w-full rounded border border-slate-700 bg-[#111317] p-2 text-xs"
          >
            <option value="Adobe Color">Perfil: Adobe Color</option>
            <option value="Camera Standard">Camera Standard</option>
            <option value="Monocromático">Monocromático</option>
          </select>
          {Object.entries(shownAdjust).map(([key, value]) => (
            <label
              key={key}
              className="mb-2 block text-[10px] capitalize text-slate-500"
            >
              <span className="flex justify-between">
                <span>{key}</span>
                <span>{value}</span>
              </span>
              <input
                type="range"
                min="-100"
                max="100"
                value={value}
                onChange={(e) => setAdjustValue(key, +e.target.value)}
                className="w-full accent-teal-400"
              />
            </label>
          ))}
          <h3 className="mt-4 text-xs font-bold">Máscaras</h3>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {["Assunto", "Céu", "Pessoas", "Pincel", "Linear", "Radial"].map(
              (item) => {
                const mask = masks.find((m) => m.type === MASK_TYPES[item]);
                return (
                  <button
                    key={item}
                    onClick={() => chooseMask(item)}
                    onContextMenu={(e) => removeMask(e, item)}
                    aria-pressed={Boolean(mask && mask.id === activeMask)}
                    className={`rounded border p-2 text-[9px] ${mask && mask.id === activeMask ? "border-teal-400 text-teal-300" : mask ? "border-teal-700" : "border-slate-700"}`}
                  >
                    {item}
                  </button>
                );
              },
            )}
          </div>
          <button
            onClick={sync}
            className="mt-3 w-full rounded bg-teal-400 p-2 text-xs font-bold text-slate-950"
          >
            Sincronizar ajustes
          </button>
        </aside>
      </div>
    </section>
  );
}

const PDF_KEY = "RemainingCraftWorkspaces.jsx:pdf";
const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200, 300, 400];
const isPdf = (asset) =>
  asset?.type === "application/pdf" || /\.pdf$/i.test(asset?.name || "");
const UNAVAILABLE = "requer um mecanismo de edição de PDF (pdf-lib/pdf.js), que não está instalado no MediaMind. Nenhuma alteração foi feita.";
const DRAG_TOOLS = ["Realçar", "Sublinhar", "Riscar", "Desenhar"];

function annotationView(item) {
  const base = { position: "absolute", left: `${item.x}%`, top: `${item.y}%` };
  const size = { width: `${item.w}%`, height: `${item.h}%` };
  if (item.type === "Realçar") return { ...base, ...size, background: "rgba(250,204,21,.38)" };
  if (item.type === "Sublinhar") return { ...base, ...size, borderBottom: "2px solid #2563eb" };
  if (item.type === "Riscar")
    return { ...base, ...size, background: "linear-gradient(transparent 46%, #dc2626 46%, #dc2626 54%, transparent 54%)" };
  return base;
}

export function PdfCraftWorkspace({ assets, selected, onSelect, onOpenFiles }) {
  const [mode, setMode] = useGraphicDraftState("RemainingCraftWorkspaces.jsx:mode", "Editar");
  const [annotations, setAnnotations] = useGraphicDraftState(`${PDF_KEY}:annotations`, {});
  const [sideTab, setSideTab] = useState("Miniaturas");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  const [info, setInfo] = useState(null);
  const [tool, setTool] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [status, setStatus] = useState("");
  const source =
    selected || assets.find((asset) => asset.type === "application/pdf");
  const docKey = source?.id || "";
  const items = (docKey && annotations[docKey]) || [];
  const shown = items.filter((item) => !item.page || item.page === page);

  useEffect(() => {
    setPage(1);
    setTool(null);
    setInfo(null);
    if (!source?.url || !isPdf(source)) return undefined;
    let alive = true;
    readPdfInfo(source.url)
      .then((result) => alive && setInfo(result))
      .catch(() => alive && setInfo({ valid: false, pages: 0, outline: [] }));
    return () => {
      alive = false;
    };
  }, [source?.url]);

  function addAnnotation(item) {
    setAnnotations((old) => ({
      ...old,
      [docKey]: [...(old[docKey] || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, page, ...item }],
    }));
  }
  function removeAnnotation(id) {
    setAnnotations((old) => ({ ...old, [docKey]: (old[docKey] || []).filter((item) => item.id !== id) }));
    setStatus("Anotação removida.");
  }

  function needDoc() {
    if (source) return false;
    setStatus("Abra um PDF primeiro.");
    return true;
  }
  function ask(message, fallback = "") {
    const value = window.prompt(message, fallback);
    return value && value.trim() ? value.trim() : null;
  }
  function arm(name, payload) {
    setTool({ name, ...payload });
    setStatus(
      DRAG_TOOLS.includes(name)
        ? `${name}: arraste sobre o documento. Duplo clique numa anotação a remove.`
        : `${name}: clique no documento para posicionar.`,
    );
  }
  function unavailable(item) {
    setTool(null);
    setStatus(`"${item}" ${UNAVAILABLE}`);
  }

  function rotate(delta) {
    setRotation((old) => (old + delta + 360) % 360);
    setStatus("Rotação aplicada à visualização (não é gravada no arquivo).");
  }
  function changeZoom(direction) {
    setZoom((old) => {
      const index = ZOOM_STEPS.indexOf(old);
      return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction))];
    });
  }

  function editTool(item) {
    if (needDoc()) return;
    if (item === "Adicionar texto") {
      const text = ask("Texto a adicionar:");
      if (text) arm(item, { kind: "text", text });
    } else if (item === "Adicionar imagem") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp,image/gif";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => arm(item, { kind: "image", src: reader.result, name: file.name });
        reader.readAsDataURL(file);
      };
      input.click();
    } else if (item === "Criar link") {
      const url = ask("Endereço do link (https://…):", "https://");
      if (!url) return;
      if (!/^https?:\/\/[^\s]+$/i.test(url)) {
        setStatus("Link inválido: use um endereço http:// ou https://.");
        return;
      }
      arm(item, { kind: "link", url, text: ask("Texto do link:", url) || url });
    } else if (item === "Cabeçalho e rodapé") {
      const text = ask("Texto do cabeçalho e rodapé:");
      if (!text) return;
      addAnnotation({ type: "headerfooter", text, page: 0 });
      setStatus("Cabeçalho e rodapé adicionados (camada de anotação).");
    } else if (item === "Marca d'água") {
      const text = ask("Texto da marca d'água:", "CONFIDENCIAL");
      if (!text) return;
      addAnnotation({ type: "watermark", text, page: 0 });
      setStatus("Marca d'água adicionada (camada de anotação).");
    } else unavailable(item);
  }

  function commentTool(item) {
    if (needDoc()) return;
    if (item === "Nota") {
      const text = ask("Texto da nota:");
      if (text) arm(item, { kind: "note", text });
    } else if (item === "Carimbo") {
      const text = ask("Texto do carimbo:", "APROVADO");
      if (text) arm(item, { kind: "stamp", text: text.toUpperCase() });
    } else arm(item, { kind: "drag" });
  }

  function signTool(item) {
    if (needDoc()) return;
    if (item === "Solicitar assinaturas") {
      setStatus("Solicitar assinaturas requer um serviço de assinatura e envio de e-mail, não configurado no MediaMind.");
      return;
    }
    const text = ask(item === "Adicionar iniciais" ? "Suas iniciais:" : "Nome para a assinatura:");
    if (text) arm(item, { kind: "signature", text });
  }

  async function saveCopy() {
    if (needDoc()) return;
    try {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error("indisponível");
      const blob = await response.blob();
      const base = source.name.replace(/\.pdf$/i, "") || "documento";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${base} - cópia.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus(
        items.length
          ? `Cópia salva. As ${items.length} anotação(ões) ficam no rascunho do MMPDF; gravá-las dentro do PDF ${UNAVAILABLE.replace(" Nenhuma alteração foi feita.", "")}`
          : "Cópia do PDF salva.",
      );
    } catch {
      setStatus("Não foi possível ler o arquivo para salvar a cópia.");
    }
  }

  function point(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / (rect.width || 1)) * 100;
    const y = ((event.clientY - rect.top) / (rect.height || 1)) * 100;
    return [Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y))];
  }
  function overlayDown(event) {
    if (!tool) return;
    const [x, y] = point(event);
    if (DRAG_TOOLS.includes(tool.name)) {
      setDrawing({ type: tool.name, start: [x, y], points: [[x, y]] });
      return;
    }
    const { name: _name, kind, ...payload } = tool;
    addAnnotation({ type: kind, x, y, ...payload });
    setStatus(`${tool.name} adicionado. Duplo clique na anotação a remove.`);
    setTool(null);
  }
  function overlayMove(event) {
    if (!drawing) return;
    const p = point(event);
    setDrawing((old) => ({ ...old, points: [...old.points, p] }));
  }
  function overlayUp() {
    if (!drawing) return;
    const pts = drawing.points;
    if (drawing.type === "Desenhar") {
      if (pts.length > 1) addAnnotation({ type: "draw", points: pts });
    } else {
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const w = Math.max(...xs) - x;
      const h = Math.max(...ys) - y;
      if (w > 0.5) addAnnotation({ type: drawing.type, x, y, w, h: Math.max(h, 2) });
    }
    setDrawing(null);
  }

  const pageCount = info?.pages || Math.max(1, assets.length);
  const frameSrc = source && isPdf(source) ? `${source.url}#page=${page}` : source?.url;

  const layer = (
    <div
      data-testid="pdf-annotation-layer"
      onPointerDown={overlayDown}
      onPointerMove={overlayMove}
      onPointerUp={overlayUp}
      className="absolute inset-0"
      style={{ pointerEvents: tool ? "auto" : "none", cursor: tool ? "crosshair" : undefined }}
    >
      {shown.map((item) => {
        const common = {
          "data-annotation": item.type,
          onDoubleClick: () => removeAnnotation(item.id),
          style: { ...annotationView(item), pointerEvents: "auto" },
        };
        if (item.type === "headerfooter")
          return (
            <div key={item.id} data-annotation="headerfooter" onDoubleClick={() => removeAnnotation(item.id)} style={{ pointerEvents: "auto" }}>
              <p className="absolute left-0 right-0 top-2 text-center text-[11px] text-slate-700">{item.text}</p>
              <p className="absolute bottom-2 left-0 right-0 text-center text-[11px] text-slate-700">{item.text}</p>
            </div>
          );
        if (item.type === "watermark")
          return (
            <div key={item.id} data-annotation="watermark" onDoubleClick={() => removeAnnotation(item.id)} className="absolute inset-0 grid place-items-center overflow-hidden" style={{ pointerEvents: "auto" }}>
              <span className="-rotate-45 select-none text-6xl font-black text-red-500/25">{item.text}</span>
            </div>
          );
        if (item.type === "draw")
          return (
            <svg key={item.id} data-annotation="draw" onDoubleClick={() => removeAnnotation(item.id)} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
              <polyline points={item.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#dc2626" strokeWidth="0.5" style={{ pointerEvents: "stroke" }} />
            </svg>
          );
        if (item.type === "image")
          return <img {...common} key={item.id} src={item.src} alt={item.name || "Imagem"} style={{ ...common.style, width: "25%" }} />;
        if (item.type === "link")
          return (
            <a {...common} key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline">
              {item.text}
            </a>
          );
        if (item.type === "note")
          return <div {...common} key={item.id} className="max-w-[30%] rounded bg-yellow-200 p-1 text-[10px] text-slate-900 shadow">{item.text}</div>;
        if (item.type === "stamp")
          return <div {...common} key={item.id} className="rounded border-2 border-red-600 px-2 text-sm font-black text-red-600">{item.text}</div>;
        if (item.type === "signature")
          return <div {...common} key={item.id} className="font-serif text-xl italic text-blue-900">{item.text}</div>;
        if (item.type === "text")
          return <div {...common} key={item.id} className="text-sm text-slate-900">{item.text}</div>;
        return <div {...common} key={item.id} />;
      })}
      {drawing && drawing.type === "Desenhar" && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline points={drawing.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#dc2626" strokeWidth="0.5" />
        </svg>
      )}
    </div>
  );

  return (
    <section className="space-y-2 bg-[#f4f5f7] text-slate-800 dark:bg-[#17191c] dark:text-slate-200">
      <header className="flex items-center border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold">PDFCraft</h1>
          <p className="text-[10px] text-slate-500">
            Leitura, edição, organização e assinatura de documentos
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <label className="cursor-pointer rounded border border-slate-600 px-3 py-2 text-xs">
            <FolderPlus size={14} className="mr-1 inline" />
            Abrir PDF
            <input
              hidden
              multiple
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <button onClick={saveCopy} className="rounded bg-red-500 px-3 py-2 text-xs font-bold text-white">
            <Download size={14} className="mr-1 inline" />
            Salvar cópia
          </button>
        </div>
      </header>
      <div className="flex gap-1 overflow-x-auto rounded border border-slate-700 bg-[#22252a] p-1">
        {[
          ["Editar", FileText],
          ["Comentar", SlidersHorizontal],
          ["Organizar", Grid3X3],
          ["Preencher e assinar", FileSignature],
          ["Proteger", ShieldCheck],
          ["Exportar", Download],
        ].map(([name, Icon]) => (
          <button
            key={name}
            onClick={() => {
              setMode(name);
              setTool(null);
            }}
            className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${mode === name ? "bg-red-500 text-white" : "text-slate-400"}`}
          >
            <Icon size={14} />
            {name}
          </button>
        ))}
      </div>
      <div className="grid min-h-[720px] grid-cols-[220px_minmax(650px,1fr)_290px] gap-2">
        <aside className="rounded border border-slate-700 bg-[#22252a] text-slate-200">
          <div className="flex border-b border-slate-700">
            {["Miniaturas", "Marcadores"].map((name) => (
              <button
                key={name}
                onClick={() => setSideTab(name)}
                className={`flex-1 p-2 text-[10px] ${sideTab === name ? "border-b-2 border-red-400 text-red-300" : "text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {sideTab === "Miniaturas" ? (
            <div className="space-y-2 p-3">
              {assets.map((asset, index) => (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset)}
                  className={`flex w-full items-center gap-2 rounded border p-2 text-left text-[10px] ${selected?.id === asset.id ? "border-red-400" : "border-slate-700"}`}
                >
                  <span className="grid h-16 w-12 place-items-center bg-white font-bold text-slate-900">
                    {index + 1}
                  </span>
                  <span className="truncate">{asset.name}</span>
                </button>
              ))}
              {!assets.length &&
                [1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setStatus("Abra um PDF para ver as miniaturas do documento.")}
                    className="mx-auto grid h-28 w-20 place-items-center border bg-white text-xs font-bold text-slate-800"
                  >
                    {n}
                  </button>
                ))}
            </div>
          ) : (
            <div className="space-y-1 p-3 text-[10px]">
              {info?.outline?.length ? (
                info.outline.map((item, index) => (
                  <button
                    key={`${item.title}-${index}`}
                    onClick={() => {
                      if (item.page) {
                        setPage(item.page);
                        setStatus(`Marcador: ${item.title} (página ${item.page}).`);
                      } else setStatus(`Marcador "${item.title}" sem destino legível.`);
                    }}
                    className="block w-full truncate rounded px-2 py-1 text-left hover:bg-slate-700"
                  >
                    ▸ {item.title}
                  </button>
                ))
              ) : (
                <p className="text-slate-500">
                  {source
                    ? "Nenhum marcador legível neste PDF (marcadores em objetos comprimidos exigem pdf.js)."
                    : "Abra um PDF para ver os marcadores."}
                </p>
              )}
            </div>
          )}
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-700 bg-[#3b3d42]">
          <div className="flex items-center gap-2 border-b border-slate-700 bg-[#22252a] p-2 text-[10px] text-slate-300">
            <button onClick={() => changeZoom(-1)} aria-label="Reduzir zoom">−</button>
            <span>{zoom}%</span>
            <button onClick={() => changeZoom(1)} aria-label="Aumentar zoom">+</button>
            <span className="mx-auto">
              Página {page} de {pageCount}
            </span>
            <button onClick={() => rotate(-90)} aria-label="Girar à esquerda">↶</button>
            <button onClick={() => rotate(90)} aria-label="Girar à direita">↷</button>
          </div>
          <div className="grid flex-1 place-items-center overflow-auto p-6">
            {source ? (
              <div
                data-testid="pdf-view"
                className="relative min-h-[600px]"
                style={{
                  width: `${zoom}%`,
                  minHeight: `${(600 * zoom) / 100}px`,
                  transform: rotation ? `rotate(${rotation}deg)` : undefined,
                }}
              >
                <iframe
                  key={frameSrc}
                  title={source.name}
                  src={frameSrc}
                  className="h-full min-h-[600px] w-full bg-white"
                  style={{ minHeight: `${(600 * zoom) / 100}px` }}
                />
                {layer}
              </div>
            ) : (
              <article
                className="min-h-[600px] w-[460px] bg-white p-12 text-slate-900 shadow-2xl"
                style={{
                  transform: zoom !== 100 || rotation ? `scale(${zoom / 100}) rotate(${rotation}deg)` : undefined,
                }}
              >
                <p className="text-xs font-bold uppercase tracking-[.3em] text-red-600">
                  Documento MediaMind
                </p>
                <h2 className="mt-8 text-4xl font-black">
                  Relatório institucional
                </h2>
                <p className="mt-6 leading-relaxed">
                  Abra um arquivo PDF para leitura, edição, comentários,
                  formulários, organização de páginas e assinatura.
                </p>
                <div className="mt-10 h-44 rounded bg-gradient-to-br from-red-500 to-orange-300" />
                <p className="mt-8 text-sm leading-relaxed">
                  As ferramentas permanecem isoladas nesta fase e serão
                  integradas ao acervo posteriormente.
                </p>
              </article>
            )}
          </div>
        </main>
        <aside className="overflow-auto rounded border border-slate-700 bg-[#22252a] p-3 text-slate-200">
          <h3 className="mb-3 text-sm font-bold">{mode}</h3>
          {mode === "Editar" && (
            <div className="space-y-2">
              {[
                "Adicionar texto",
                "Adicionar imagem",
                "Criar link",
                "Cabeçalho e rodapé",
                "Marca d'água",
                "Plano de fundo",
                "OCR do documento",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => editTool(item)}
                  className={`block w-full rounded border p-2 text-left text-xs ${tool?.name === item ? "border-red-400" : "border-slate-700"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Comentar" && (
            <div className="grid grid-cols-2 gap-2">
              {[
                "Nota",
                "Realçar",
                "Sublinhar",
                "Riscar",
                "Desenhar",
                "Carimbo",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => commentTool(item)}
                  className={`rounded border p-3 text-xs ${tool?.name === item ? "border-red-400" : "border-slate-700"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Organizar" && (
            <div className="space-y-2">
              {[
                "Inserir páginas",
                "Extrair",
                "Substituir",
                "Dividir",
                "Girar",
                "Excluir",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    if (needDoc()) return;
                    if (item === "Girar") rotate(90);
                    else unavailable(item);
                  }}
                  className="block w-full rounded border border-slate-700 p-2 text-left text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Preencher e assinar" && (
            <div className="space-y-2">
              {["Adicionar assinatura", "Adicionar iniciais", "Solicitar assinaturas"].map((item) => (
                <button
                  key={item}
                  onClick={() => signTool(item)}
                  className={`w-full rounded border p-2 text-xs ${tool?.name === item ? "border-red-400" : "border-slate-700"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Proteger" && (
            <div className="space-y-2">
              {[
                "Criptografar com senha",
                "Restringir edição",
                "Remover informações ocultas",
                "Sanitizar documento",
                "Certificados",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => !needDoc() && unavailable(item)}
                  className="block w-full rounded border border-slate-700 p-2 text-left text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          {mode === "Exportar" && (
            <div className="space-y-2">
              {[
                "Microsoft Word",
                "Excel",
                "PowerPoint",
                "Imagem",
                "PDF/A",
                "PDF/X",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => !needDoc() && unavailable(item)}
                  className="block w-full rounded border border-slate-700 p-2 text-left text-xs"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 rounded border border-slate-700 p-3 text-[10px] text-slate-500">
            <CheckCircle2 size={14} className="mb-1 text-emerald-400" />
            <span role="status">
              {status || "Documento local · nenhuma alteração enviada ao sistema"}
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}
