import { useMemo, useState } from "react";
import {
  Circle,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderPlus,
  Grid3X3,
  Layers3,
  MousePointer2,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  Square,
  Star,
  Type,
  Upload,
  WandSparkles,
} from "lucide-react";

const PRESETS = {
  photocraft: {
    title: "Editor de imagem em camadas",
    tools: [
      "Mover",
      "Letreiro",
      "Laço",
      "Seleção rápida",
      "Recorte",
      "Pincel",
      "Clone",
      "Borracha",
      "Gradiente",
      "Caneta",
      "Texto",
      "Forma",
    ],
    bottom: "Histórico, canais e caminhos",
  },
  vectorcraft: {
    title: "Prancheta vetorial",
    tools: [
      "Seleção",
      "Seleção direta",
      "Caneta",
      "Curvatura",
      "Texto",
      "Forma",
      "Construtor",
      "Gradiente",
      "Malha",
      "Perspectiva",
      "Símbolos",
      "Prancheta",
    ],
    bottom: "Pranchetas, símbolos e exportação",
  },
  effectcraft: {
    title: "Composição",
    tools: [
      "Seleção",
      "Mão",
      "Zoom",
      "Rotação",
      "Câmera",
      "Pan atrás",
      "Forma",
      "Caneta",
      "Texto",
      "Pincel",
      "Clone",
      "Puppet",
    ],
    bottom: "Timeline, keyframes e editor de gráficos",
  },
  lightcraft: {
    title: "Revelação",
    tools: [
      "Biblioteca",
      "Revelação",
      "Comparar",
      "Recorte",
      "Correção",
      "Máscaras",
      "Pessoas",
      "Mapa",
      "Imprimir",
    ],
    bottom: "Filmstrip, avaliações e coleções",
  },
  pdfcraft: {
    title: "Documento PDF",
    tools: [
      "Leitura",
      "Seleção",
      "Localizar",
      "Editar",
      "Comentar",
      "Formulários",
      "Assinar",
      "Organizar",
      "Combinar",
      "Proteger",
    ],
    bottom: "Páginas, marcadores e anexos",
  },
  designcraft: {
    title: "Diagramação e publicação",
    tools: [
      "Seleção",
      "Seleção direta",
      "Página",
      "Lacuna",
      "Texto",
      "Quadro",
      "Caneta",
      "Lápis",
      "Linha",
      "Forma",
      "Tesoura",
      "Gradiente",
      "Conta-gotas",
      "Mão",
      "Zoom",
    ],
    bottom: "Páginas espelhadas e páginas-mestre",
  },
  "craft-libs": {
    title: "Biblioteca compartilhada",
    tools: ["Todos", "Imagens", "Vídeos", "Áudio", "Componentes"],
    bottom: "Coleções e marcas",
  },
};

export default function CreativeWorkspace({
  tool,
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const preset = PRESETS[tool.id];
  const [activeTool, setActiveTool] = useState(preset.tools[0]);
  const [layers, setLayers] = useState([
    { id: "adjustments", name: "Ajustes", visible: true },
    { id: "content", name: "Conteúdo principal", visible: true },
    { id: "background", name: "Fundo", visible: true },
  ]);
  const [objects, setObjects] = useState([]);
  const [adjustments, setAdjustments] = useState({
    exposure: 0,
    contrast: 100,
    saturation: 100,
    blur: 0,
    rotation: 0,
    scale: 100,
    opacity: 100,
  });
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [view, setView] = useState("properties");
  const imageStyle = useMemo(
    () => ({
      filter: `brightness(${100 + adjustments.exposure}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) blur(${adjustments.blur}px)`,
      transform: `rotate(${adjustments.rotation}deg) scale(${adjustments.scale / 100})`,
      opacity: adjustments.opacity / 100,
    }),
    [adjustments],
  );

  function updateAdjustment(key, value) {
    setAdjustments((old) => ({ ...old, [key]: Number(value) }));
  }
  function addObject(kind) {
    setObjects((old) => [
      ...old,
      { id: crypto.randomUUID(), kind, name: `${kind} ${old.length + 1}` },
    ]);
  }
  function toggleLayer(id) {
    setLayers((old) =>
      old.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    );
  }
  function saveProject() {
    const data = JSON.stringify(
      {
        editor: tool.id,
        assets: assets.map(({ name, type }) => ({ name, type })),
        adjustments,
        layers,
        objects,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tool.id}-projeto.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const isPhoto = tool.id === "photocraft" || tool.id === "lightcraft";
  const isVector = tool.id === "vectorcraft" || tool.id === "designcraft";
  const isEffects = tool.id === "effectcraft";
  const isPdf = tool.id === "pdfcraft";
  const isLibrary = tool.id === "craft-libs";

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-black text-white">{tool.label}</h1>
          <p className="text-xs text-slate-400">
            {preset.title} · workspace isolado
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveProject}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"
          >
            <Save className="mr-2 inline" size={14} />
            Salvar projeto
          </button>
          <label className="cursor-pointer rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950">
            <Upload className="mr-2 inline" size={14} />
            Importar
            <input
              hidden
              multiple
              type="file"
              accept={tool.accept}
              onChange={(event) => onOpenFiles(event.target.files)}
            />
          </label>
        </div>
      </header>

      <div className="flex overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 p-1">
        {preset.tools.map((item) => (
          <button
            key={item}
            onClick={() => setActiveTool(item)}
            className={`min-w-24 rounded-md px-3 py-2 text-xs ${activeTool === item ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500" : "text-slate-400"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid min-h-[650px] gap-3 xl:grid-cols-[245px_minmax(520px,1fr)_285px]">
        <aside className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 p-3">
            <h2 className="text-xs font-bold text-white">
              {isLibrary ? "Ativos da biblioteca" : "Arquivos do projeto"}
            </h2>
            <FolderPlus size={15} className="text-cyan-300" />
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => onSelect(asset)}
                className={`group relative overflow-hidden rounded-lg border bg-slate-950 text-left ${selected?.id === asset.id ? "border-cyan-400" : "border-slate-700"}`}
              >
                <AssetPreview asset={asset} />
                <p className="truncate p-2 text-[10px] text-slate-300">
                  {asset.name}
                </p>
                {isLibrary && (
                  <Star
                    onClick={(event) => {
                      event.stopPropagation();
                      setFavoriteIds((old) =>
                        old.includes(asset.id)
                          ? old.filter((id) => id !== asset.id)
                          : [...old, asset.id],
                      );
                    }}
                    size={13}
                    className={`absolute right-1 top-1 ${favoriteIds.includes(asset.id) ? "fill-amber-400 text-amber-400" : "text-white"}`}
                  />
                )}
              </button>
            ))}
          </div>
          {!assets.length && (
            <label className="m-3 grid cursor-pointer place-items-center rounded-xl border border-dashed border-slate-600 p-8 text-center text-xs text-slate-500">
              <Plus className="mb-2 text-cyan-300" />
              Adicionar arquivos
              <input
                hidden
                multiple
                type="file"
                accept={tool.accept}
                onChange={(event) => onOpenFiles(event.target.files)}
              />
            </label>
          )}
          {!isLibrary && (
            <div className="border-t border-slate-800 p-3">
              <h3 className="mb-2 text-[10px] font-bold uppercase text-slate-500">
                Camadas
              </h3>
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className="mb-1 flex w-full items-center gap-2 rounded border border-slate-800 px-2 py-2 text-left text-xs text-slate-300"
                >
                  {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  <Layers3 size={13} />
                  {layer.name}
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#101720]">
          <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
            <MousePointer2 size={14} className="text-cyan-300" />
            <b className="text-slate-200">{activeTool}</b>
            <span className="ml-auto">
              {selected?.name || "Nenhum arquivo selecionado"}
            </span>
          </div>
          <div className="relative grid flex-1 place-items-center overflow-auto bg-[linear-gradient(45deg,#151e28_25%,transparent_25%),linear-gradient(-45deg,#151e28_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#151e28_75%),linear-gradient(-45deg,transparent_75%,#151e28_75%)] bg-[size:24px_24px] p-8">
            {isLibrary ? (
              <LibraryBoard assets={assets} onSelect={onSelect} />
            ) : selected ? (
              <Canvas asset={selected} style={imageStyle} isPdf={isPdf} />
            ) : (
              <EmptyCanvas title={preset.title} />
            )}
            {isVector &&
              objects.map((object, index) => (
                <div
                  key={object.id}
                  className="absolute rounded border-2 border-cyan-400/80 bg-cyan-400/10 p-3 text-xs text-cyan-100"
                  style={{
                    left: `${28 + index * 7}%`,
                    top: `${30 + index * 8}%`,
                  }}
                >
                  {object.kind === "Texto" ? "Novo texto" : object.kind}
                </div>
              ))}
          </div>
          <div className="border-t border-slate-800 bg-slate-950/70 p-3">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
              <span>{preset.bottom}</span>
              <span>
                {assets.length} ativos · {objects.length} elementos
              </span>
            </div>
            {isEffects ? (
              <EffectTimeline assets={assets} />
            ) : isPdf ? (
              <PageStrip assets={assets} onSelect={onSelect} />
            ) : (
              <AssetStrip
                assets={assets}
                onSelect={onSelect}
                selected={selected}
              />
            )}
          </div>
        </main>

        <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="mb-4 flex border-b border-slate-700">
            <button
              onClick={() => setView("properties")}
              className={`px-3 py-2 text-xs ${view === "properties" ? "border-b-2 border-cyan-400 text-cyan-300" : "text-slate-400"}`}
            >
              Propriedades
            </button>
            <button
              onClick={() => setView("layers")}
              className={`px-3 py-2 text-xs ${view === "layers" ? "border-b-2 border-cyan-400 text-cyan-300" : "text-slate-400"}`}
            >
              Recursos
            </button>
          </div>
          {view === "layers" ? (
            <ResourcePanel tool={tool} />
          ) : (
            <>
              {(isPhoto || isEffects) && (
                <AdjustmentPanel
                  values={adjustments}
                  update={updateAdjustment}
                />
              )}
              {isVector && (
                <div className="space-y-2">
                  <PanelTitle>Adicionar elemento</PanelTitle>
                  <Action icon={Type} onClick={() => addObject("Texto")}>
                    Texto
                  </Action>
                  <Action icon={Square} onClick={() => addObject("Retângulo")}>
                    Retângulo
                  </Action>
                  <Action icon={Circle} onClick={() => addObject("Elipse")}>
                    Elipse
                  </Action>
                  <Action icon={PenTool} onClick={() => addObject("Traçado")}>
                    Traçado
                  </Action>
                </div>
              )}
              {isPdf && <PdfPanel selected={selected} />}
              {isLibrary && (
                <LibraryPanel
                  count={assets.length}
                  favorites={favoriteIds.length}
                />
              )}
              {!isLibrary && (
                <div className="mt-4 border-t border-slate-800 pt-4">
                  <ResourcePanel tool={tool} />
                </div>
              )}
              <button
                onClick={() =>
                  setAdjustments({
                    exposure: 0,
                    contrast: 100,
                    saturation: 100,
                    blur: 0,
                    rotation: 0,
                    scale: 100,
                    opacity: 100,
                  })
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 py-2 text-xs text-slate-300"
              >
                <RotateCcw size={14} />
                Restaurar ajustes
              </button>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function AssetPreview({ asset }) {
  return (
    <div className="grid h-16 place-items-center bg-black/40">
      {asset.type.startsWith("image") ? (
        <img src={asset.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <FileText size={22} className="text-cyan-300" />
      )}
    </div>
  );
}
function Canvas({ asset, style, isPdf }) {
  if (isPdf || asset.type === "application/pdf")
    return (
      <iframe
        title={asset.name}
        src={asset.url}
        className="h-full min-h-[480px] w-full rounded bg-white"
      />
    );
  if (asset.type.startsWith("image"))
    return (
      <img
        src={asset.url}
        alt={asset.name}
        style={style}
        className="max-h-[530px] max-w-full object-contain shadow-2xl transition"
      />
    );
  if (asset.type.startsWith("video"))
    return (
      <video controls src={asset.url} className="max-h-[530px] max-w-full" />
    );
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-12 text-center text-white">
      <FileText className="mx-auto mb-3 text-cyan-300" size={44} />
      {asset.name}
    </div>
  );
}
function EmptyCanvas({ title }) {
  return (
    <div className="max-w-sm text-center">
      <WandSparkles className="mx-auto text-cyan-400" size={52} />
      <p className="mt-4 text-xl font-bold text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-500">
        Importe um arquivo ou crie um elemento para começar.
      </p>
    </div>
  );
}
function AdjustmentPanel({ values, update }) {
  return (
    <div className="space-y-3">
      <PanelTitle>Luz, cor e transformação</PanelTitle>
      {[
        ["Exposição", "exposure", -80, 80],
        ["Contraste", "contrast", 0, 200],
        ["Saturação", "saturation", 0, 200],
        ["Desfoque", "blur", 0, 12],
        ["Rotação", "rotation", -180, 180],
        ["Escala", "scale", 20, 180],
        ["Opacidade", "opacity", 0, 100],
      ].map(([label, key, min, max]) => (
        <label key={key} className="block text-xs text-slate-400">
          <span className="flex justify-between">
            <span>{label}</span>
            <span>{values[key]}</span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            value={values[key]}
            onChange={(event) => update(key, event.target.value)}
            className="mt-1 w-full accent-cyan-400"
          />
        </label>
      ))}
    </div>
  );
}
function ResourcePanel({ tool }) {
  return (
    <div>
      <PanelTitle>Painéis de {tool.label}</PanelTitle>
      {tool.panels.map((panel) => (
        <div
          key={panel}
          className="mb-2 rounded-lg border border-slate-800 p-3 text-xs text-slate-300"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
function PdfPanel({ selected }) {
  return (
    <div className="space-y-2">
      <PanelTitle>Ferramentas do documento</PanelTitle>
      <Action icon={Type}>Adicionar texto</Action>
      <Action icon={PenTool}>Comentar</Action>
      <Action icon={Grid3X3}>Organizar páginas</Action>
      <Action icon={Download}>Exportar cópia</Action>
      <p className="pt-2 text-[10px] text-slate-500">
        {selected ? selected.name : "Abra um PDF para visualizar e organizar."}
      </p>
    </div>
  );
}
function LibraryPanel({ count, favorites }) {
  return (
    <div className="space-y-2">
      <PanelTitle>Resumo da biblioteca</PanelTitle>
      <p className="rounded-lg border border-cyan-900 bg-cyan-950/20 p-3 text-xs text-cyan-200">
        Biblioteca comum dos sete editores gráficos.
      </p>
      <div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
        {count} ativos compartilhados
      </div>
      <div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
        {favorites} favoritos
      </div>
      <Action icon={Plus}>Nova coleção</Action>
    </div>
  );
}
function LibraryBoard({ assets, onSelect }) {
  return assets.length ? (
    <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-4">
      {assets.map((asset) => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset)}
          className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-left"
        >
          <AssetPreview asset={asset} />
          <p className="truncate p-3 text-xs text-slate-300">{asset.name}</p>
        </button>
      ))}
    </div>
  ) : (
    <EmptyCanvas title="Craft Libs" />
  );
}
function AssetStrip({ assets, selected, onSelect }) {
  return (
    <div className="flex h-16 gap-2 overflow-x-auto">
      {assets.map((asset) => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset)}
          className={`min-w-24 rounded border px-2 text-[10px] ${selected?.id === asset.id ? "border-cyan-400 text-cyan-300" : "border-slate-700 text-slate-400"}`}
        >
          {asset.name}
        </button>
      ))}
    </div>
  );
}
function PageStrip({ assets, onSelect }) {
  return (
    <div className="flex h-20 gap-2 overflow-x-auto">
      {assets.map((asset, index) => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset)}
          className="grid min-w-16 place-items-center rounded border border-slate-700 bg-white text-xs font-bold text-slate-900"
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}
function EffectTimeline({ assets }) {
  return (
    <div className="space-y-1">
      {["Vídeo", "Efeitos", "Áudio"].map((track, index) => (
        <div key={track} className="flex h-8 items-center gap-2">
          <span className="w-12 text-[10px] text-slate-500">{track}</span>
          <div
            className={`h-6 rounded ${index === 0 ? "w-2/3 bg-indigo-500/60" : index === 1 ? "w-1/2 bg-cyan-500/60" : "w-3/4 bg-emerald-500/60"}`}
          >
            <span className="px-2 text-[9px] text-white">
              {assets[0]?.name || "Composição"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
function PanelTitle({ children }) {
  return <h3 className="mb-3 text-xs font-bold text-white">{children}</h3>;
}
function Action({ icon: Icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-500"
    >
      <Icon size={14} className="text-cyan-300" />
      {children}
    </button>
  );
}
