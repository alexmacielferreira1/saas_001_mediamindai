import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Crop,
  Eye,
  EyeOff,
  Eraser,
  FolderPlus,
  Hand,
  Image as ImageIcon,
  Lasso,
  MousePointer2,
  PenTool,
  Save,
  Trash2,
  Undo2,
  Stamp,
  Type,
  Upload,
  WandSparkles,
  ZoomIn,
} from "lucide-react";

const TOOLS = [
  ["V", "Mover", MousePointer2],
  ["M", "Letreiro", CircleDashed],
  ["L", "Laço", Lasso],
  ["W", "Seleção rápida", WandSparkles],
  ["C", "Recorte", Crop],
  ["B", "Pincel", Brush],
  ["S", "Clone", Stamp],
  ["E", "Borracha", Eraser],
  ["P", "Caneta", PenTool],
  ["T", "Texto", Type],
  ["H", "Mão", Hand],
  ["Z", "Zoom", ZoomIn],
];

const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 100, rotation: 0 };
const BLEND_MODES = [
  ["normal", "Normal"],
  ["multiply", "Multiplicar"],
  ["screen", "Divisão"],
  ["overlay", "Sobrepor"],
  ["soft-light", "Luz suave"],
  ["color-dodge", "Subexposição de cores"],
];

const PHOTO_MENUS = {
  Arquivo: ["Abrir imagem", "Salvar documento", "Exportar PNG"],
  Editar: ["Desfazer", "Duplicar camada", "Transformação livre"],
  Imagem: ["Ajustes", "Tamanho da imagem", "Rotação da imagem"],
  Camada: ["Nova camada", "Nova camada de texto", "Duplicar camada", "Adicionar máscara", "Excluir camada"],
  Texto: ["Nova camada de texto"],
  Selecionar: ["Selecionar tudo", "Desmarcar", "Selecionar assunto"],
  Filtro: ["Desfoque", "Nitidez", "Camera Raw"],
  "3D": ["Nova camada 3D"],
  Exibir: ["Ajustar à tela", "100%"],
  Janela: ["Propriedades", "Ajustes", "Camadas", "Histórico"],
  Ajuda: ["Atalhos do MMPhoto", "Sobre o MMPhoto"],
};

function makeLayer(layer) {
  return { opacity: 100, blendMode: "normal", mask: false, transform: { ...DEFAULT_TRANSFORM }, ...layer };
}

export default function PhotoCraftWorkspace({
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [workspace, setWorkspace] = useGraphicDraftState("PhotoCraftWorkspace.jsx:workspace", "Essenciais");
  const [tool, setTool] = useGraphicDraftState("PhotoCraftWorkspace.jsx:tool", "Mover");
  const [openMenu, setOpenMenu] = useState(null);
  const [rightPanel, setRightPanel] = useGraphicDraftState("PhotoCraftWorkspace.jsx:rightPanel", "Propriedades");
  const [bottomPanel, setBottomPanel] = useGraphicDraftState("PhotoCraftWorkspace.jsx:bottomPanel", "Histórico");
  const [zoom, setZoom] = useGraphicDraftState("PhotoCraftWorkspace.jsx:zoom", 66.7);
  const [viewportOffset, setViewportOffset] = useGraphicDraftState("PhotoCraftWorkspace.jsx:viewportOffset", { x: 0, y: 0 });
  const [selection, setSelection] = useGraphicDraftState("PhotoCraftWorkspace.jsx:selection", null);
  const [marks, setMarks] = useGraphicDraftState("PhotoCraftWorkspace.jsx:marks", []);
  const pointerGesture = useRef(null);
  const [layers, setLayers] = useGraphicDraftState("PhotoCraftWorkspace.jsx:layers", [
    makeLayer({ id: "adjust", name: "Curvas 1", kind: "◐", visible: true, locked: false }),
    makeLayer({
      id: "subject",
      name: "Pessoa recortada",
      kind: "▧",
      visible: true,
      locked: false,
    }),
    makeLayer({
      id: "photo",
      name: "Foto original",
      kind: "▦",
      visible: true,
      locked: false,
    }),
    makeLayer({
      id: "background",
      name: "Plano de fundo",
      kind: "■",
      visible: true,
      locked: true,
    }),
  ]);
  const [activeLayer, setActiveLayer] = useGraphicDraftState("PhotoCraftWorkspace.jsx:activeLayer", "subject");
  const [history, setHistory] = useGraphicDraftState("PhotoCraftWorkspace.jsx:history", []);
  const [adjust, setAdjust] = useGraphicDraftState("PhotoCraftWorkspace.jsx:adjust", {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    temperature: 0,
    blur: 0,
  });
  const imageStyle = useMemo(
    () => ({
      filter: `brightness(${100 + adjust.exposure}%) contrast(${100 + adjust.contrast}%) saturate(${100 + adjust.saturation}%) blur(${adjust.blur}px)`,
    }),
    [adjust],
  );
  const source =
    selected || assets.find((asset) => asset.type.startsWith("image"));
  const selectedLayer = layers.find((layer) => layer.id === activeLayer) || layers[0];

  function commit(label, update) {
    setLayers((current) => {
      setHistory((entries) => [...entries, { label, layers: current, activeLayer }]);
      return typeof update === "function" ? update(current) : update;
    });
  }

  function updateLayer(id, patch, label = "Editar camada") {
    commit(label, (current) => current.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  }

  function updateTransform(key, value) {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, [key]: Number(value) } }, "Transformação livre");
  }

  function toggle(id) {
    commit("Alternar visibilidade", (old) =>
      old.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    );
  }
  function addLayer(name) {
    const id = crypto.randomUUID();
    commit(`Criar ${name.toLowerCase()}`, (old) => [
      makeLayer({
        id,
        name,
        kind: name === "Texto" ? "T" : "▧",
        visible: true,
        locked: false,
      }),
      ...old,
    ]);
    setActiveLayer(id);
  }

  function duplicateLayer() {
    if (!selectedLayer) return;
    const copy = { ...selectedLayer, id: crypto.randomUUID(), name: `${selectedLayer.name} cópia`, transform: { ...selectedLayer.transform } };
    commit("Duplicar camada", (current) => {
      const index = current.findIndex((layer) => layer.id === selectedLayer.id);
      return [...current.slice(0, index), copy, ...current.slice(index)];
    });
    setActiveLayer(copy.id);
  }

  function removeLayer() {
    if (!selectedLayer || selectedLayer.locked) return;
    commit("Excluir camada", (current) => current.filter((layer) => layer.id !== selectedLayer.id));
    const index = layers.findIndex((layer) => layer.id === selectedLayer.id);
    setActiveLayer(layers[index + 1]?.id || layers[index - 1]?.id || "");
  }

  function moveLayer(direction) {
    const index = layers.findIndex((layer) => layer.id === activeLayer);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return;
    commit("Reordenar camada", (current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setLayers(previous.layers);
    setActiveLayer(previous.activeLayer);
    setHistory((entries) => entries.slice(0, -1));
  }

  useEffect(() => {
    const layouts = {
      Essenciais: ["Propriedades", "Histórico", "Mover"],
      Fotografia: ["Ajustes", "Histórico", "Zoom"],
      Pintura: ["Propriedades", "Histórico", "Pincel"],
      "Gráfico e Web": ["Propriedades", "Caminhos", "Texto"],
      Movimento: ["Propriedades", "Histórico", "Mover"],
      "3D": ["Propriedades", "Canais", "Mover"],
    };
    const [panel, bottom, activeTool] = layouts[workspace];
    setRightPanel(panel);
    setBottomPanel(bottom);
    setTool(activeTool);
  }, [workspace]);

  function useTool(event) {
    const point = { x: event.clientX, y: event.clientY };
    if (tool === "Texto") return addLayer(`Texto ${layers.length + 1}`);
    if (tool === "Zoom") return setZoom((value) => Math.min(200, value + 25));
    if (tool === "Borracha") return setMarks((old) => old.slice(0, -1));
    if (tool === "Clone") return setMarks((old) => old.length ? [...old, { ...old.at(-1), id: crypto.randomUUID(), x: old.at(-1).x + 18 }] : old);
    if (["Pincel", "Caneta"].includes(tool)) return setMarks((old) => [...old, { id: crypto.randomUUID(), tool, ...point }]);
    if (["Letreiro", "Laço", "Seleção rápida"].includes(tool)) return setSelection({ tool, ...point });
    if (tool === "Recorte") return setSelection({ tool: "Recorte", ...point });
    pointerGesture.current = {
      tool,
      startX: event.clientX,
      startY: event.clientY,
      transform: { ...selectedLayer.transform },
      offset: { ...viewportOffset },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveTool(event) {
    const gesture = pointerGesture.current;
    if (!gesture) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (gesture.tool === "Mão") setViewportOffset({ x: gesture.offset.x + dx, y: gesture.offset.y + dy });
    if (gesture.tool === "Mover" && selectedLayer && !selectedLayer.locked) {
      setLayers((old) => old.map((layer) => layer.id === selectedLayer.id ? { ...layer, transform: { ...layer.transform, x: gesture.transform.x + dx, y: gesture.transform.y + dy } } : layer));
    }
  }

  function downloadDocument(extension) {
    const content = extension === "json" ? JSON.stringify({ layers, adjust }, null, 2) : "MMPhoto export";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: extension === "json" ? "application/json" : "text/plain" }));
    link.download = `mmphoto-documento.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function runMenuCommand(command) {
    setOpenMenu(null);
    if (command === "Abrir imagem") document.getElementById("mmphoto-open")?.click();
    else if (command === "Salvar documento") downloadDocument("json");
    else if (command === "Exportar PNG") downloadDocument("png");
    else if (command === "Desfazer") undo();
    else if (command === "Duplicar camada") duplicateLayer();
    else if (command === "Nova camada") addLayer("Camada");
    else if (command === "Nova camada de texto") addLayer(`Texto ${layers.length + 1}`);
    else if (command === "Adicionar máscara" && selectedLayer) updateLayer(selectedLayer.id, { mask: true }, "Adicionar máscara");
    else if (command === "Excluir camada") removeLayer();
    else if (command === "Ajustes") setRightPanel("Ajustes");
    else if (command === "Propriedades") setRightPanel("Propriedades");
    else if (command === "Histórico") setBottomPanel("Histórico");
    else if (command === "Selecionar tudo" || command === "Selecionar assunto") setSelection({ tool: command, x: 0, y: 0 });
    else if (command === "Desmarcar") setSelection(null);
    else if (command === "Ajustar à tela") setZoom(66.7);
    else if (command === "100%") setZoom(100);
    else if (command === "Desfoque") setAdjust((old) => ({ ...old, blur: Math.max(4, old.blur) }));
    else if (command === "Nitidez") setAdjust((old) => ({ ...old, contrast: Math.min(100, old.contrast + 10) }));
  }

  return (
    <section className="space-y-2 bg-[#171717] text-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold text-white">MMPhoto</h1>
          <p className="text-[10px] text-slate-500">
            Documento RGB/16 · perfil sRGB IEC61966-2.1
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={()=>downloadDocument("json")} className="rounded border border-slate-700 px-3 py-2 text-xs">
            <Save size={14} className="mr-1 inline" />
            Salvar PSD
          </button>
          <label className="cursor-pointer rounded bg-blue-500 px-3 py-2 text-xs font-bold">
            <Upload size={14} className="mr-1 inline" />
            Abrir imagem
            <input
              id="mmphoto-open"
              hidden
              multiple
              type="file"
              accept="image/*,.psd"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <button onClick={()=>downloadDocument("png")} className="rounded bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950">
            Exportar como
          </button>
        </div>
      </header>
      <div className="flex items-center gap-1 border-b border-slate-800 pb-1 text-[11px]">
        {Object.entries(PHOTO_MENUS).map(([item, commands]) => (
          <div key={item} className="relative">
            <button aria-expanded={openMenu === item} onClick={()=>setOpenMenu(openMenu === item ? null : item)} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800">{item}</button>
            {openMenu === item && <div className="absolute left-0 top-full z-50 min-w-48 border border-[#555] bg-[#292929] py-1 shadow-xl">{commands.map((command)=><button key={command} onClick={()=>runMenuCommand(command)} className="block w-full whitespace-nowrap px-4 py-1.5 text-left hover:bg-blue-600">{command}</button>)}</div>}
          </div>
        ))}
        <button aria-label="Desfazer" title="Desfazer (Ctrl+Z)" onClick={undo} disabled={!history.length} className="ml-2 rounded p-1.5 text-slate-300 enabled:hover:bg-slate-700 disabled:opacity-30">
          <Undo2 size={15} />
        </button>
        <select
          aria-label="Área de trabalho do MMPhoto"
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
          className="ml-auto rounded border border-slate-700 bg-[#171717] px-3 py-1 text-[10px] text-slate-300"
        >
          {[
            "Essenciais",
            "Fotografia",
            "Pintura",
            "Gráfico e Web",
            "Movimento",
            "3D",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="grid min-h-[720px] grid-cols-[54px_230px_minmax(600px,1fr)_300px] gap-2">
        <aside className="flex flex-col items-center gap-1 rounded border border-slate-800 bg-[#242424] p-1">
          {TOOLS.map(([shortcut, name, Icon]) => (
            <button
              key={name}
              title={`${name} (${shortcut})`}
              onClick={() => setTool(name)}
              className={`grid h-9 w-9 place-items-center rounded ${tool === name ? "bg-blue-500 text-white" : "text-slate-300 hover:bg-slate-700"}`}
            >
              <Icon size={17} />
            </button>
          ))}
          <span className="my-1 h-px w-8 bg-slate-700" />
          <span className="relative h-9 w-9">
            <i className="absolute left-0 top-0 h-7 w-7 border-2 border-white bg-black" />
            <i className="absolute bottom-0 right-0 h-7 w-7 border-2 border-white bg-white" />
          </span>
        </aside>
        <aside className="rounded border border-slate-800 bg-[#242424]">
          <div className="flex border-b border-slate-700">
            <button className="flex-1 border-b-2 border-blue-400 p-2 text-[10px] text-blue-300">
              Arquivos
            </button>
            <button className="flex-1 p-2 text-[10px] text-slate-500">
              Bibliotecas
            </button>
          </div>
          <label className="m-2 flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-slate-600 p-3 text-[10px]">
            <FolderPlus size={14} />
            Adicionar arquivos
            <input
              hidden
              multiple
              type="file"
              accept="image/*,.psd"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2 p-2">
            {assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => onSelect(asset)}
                className={`overflow-hidden rounded border bg-black ${selected?.id === asset.id ? "border-blue-400" : "border-slate-700"}`}
              >
                {asset.type.startsWith("image") ? (
                  <img
                    src={asset.url}
                    alt=""
                    className="h-20 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-20 place-items-center">
                    <ImageIcon />
                  </div>
                )}
                <p className="truncate p-1 text-[9px]">{asset.name}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-slate-700">
            <div className="flex">
              {["Histórico", "Canais", "Caminhos"].map((name) => (
                <button
                  key={name}
                  onClick={() => setBottomPanel(name)}
                  className={`flex-1 p-2 text-[10px] ${bottomPanel === name ? "border-b-2 border-blue-400 text-blue-300" : "text-slate-500"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="space-y-1 p-2 text-[10px] text-slate-400">
              {bottomPanel === "Histórico" ? (
                [
                  "Abrir",
                  "Duplicar camada",
                  "Seleção de assunto",
                  "Adicionar máscara",
                  "Curvas",
                ].map((item, i) => (
                  <p
                    key={item}
                    className={
                      i === 4
                        ? "rounded bg-blue-500/15 p-1 text-blue-300"
                        : "p-1"
                    }
                  >
                    ▸ {item}
                  </p>
                ))
              ) : bottomPanel === "Canais" ? (
                ["RGB", "Vermelho", "Verde", "Azul"].map((item) => (
                  <p key={item} className="p-1">
                    ◉ {item}
                  </p>
                ))
              ) : (
                <p className="p-2">Nenhum caminho salvo</p>
              )}
            </div>
          </div>
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-800 bg-[#303030]">
          <div className="flex items-center gap-3 border-b border-slate-700 bg-[#242424] px-3 py-2 text-[10px]">
            <b>{tool}</b>
            <span>Modo: Normal</span>
            <span>Opacidade: 100%</span>
            <span>Fluxo: 100%</span>
            <span className="ml-auto">{source?.name || "Sem título-1"}</span>
          </div>
          <div aria-label="Documento do MMPhoto" onPointerDown={useTool} onPointerMove={moveTool} onPointerUp={()=>{pointerGesture.current=null}} className="relative flex flex-1 items-center justify-center overflow-auto p-10">
            <div style={{transform:`translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${zoom / 66.7})`}} className="relative grid min-h-[520px] w-full max-w-3xl place-items-center overflow-hidden bg-white shadow-2xl">
              {source?.type.startsWith("image") ? (
                <img
                  src={source.url}
                  alt=""
                  style={imageStyle}
                  className="max-h-[580px] max-w-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,#fbbf24,transparent_22%),linear-gradient(135deg,#164e63,#581c87)]" />
              )}
              {layers.slice().reverse().map((layer, index) => layer.visible && layer.id !== "background" && (
                <div
                  key={layer.id}
                  aria-label={`Camada ${layer.name} no documento`}
                  onClick={() => setActiveLayer(layer.id)}
                  style={{
                    transform: `translate(${layer.transform.x}px, ${layer.transform.y}px) scale(${layer.transform.scale / 100}) rotate(${layer.transform.rotation}deg)`,
                    mixBlendMode: layer.blendMode,
                    opacity: layer.opacity / 100,
                    zIndex: index + 2,
                  }}
                  className={`absolute grid cursor-move place-items-center ${layer.id === "subject" || layer.name.includes("Pessoa") ? "h-56 w-44 rounded-[45%_45%_38%_38%] bg-gradient-to-b from-amber-200 via-orange-300 to-fuchsia-700 shadow-2xl" : layer.id === "adjust" ? "inset-0 bg-cyan-400/10" : "h-36 w-64 bg-white/20"} ${activeLayer === layer.id ? "outline outline-2 outline-blue-400" : ""}`}
                >
                  {layer.kind === "T" && <span className="text-3xl font-bold text-white">Texto</span>}
                  {layer.mask && <span aria-label={`Máscara de ${layer.name}`} className="absolute bottom-2 right-2 h-8 w-8 rounded border-2 border-white bg-gradient-to-br from-white to-black" />}
                </div>
              ))}
              {marks.map((mark)=><span key={mark.id} aria-label={`Marca de ${mark.tool}`} className={`absolute h-5 w-5 rounded-full ${mark.tool === "Caneta" ? "bg-fuchsia-500" : "bg-slate-950"}`} style={{left:`${mark.x % 90}%`,top:`${mark.y % 90}%`}} />)}
              {selection && <span aria-label={`Seleção ${selection.tool}`} className="pointer-events-none absolute inset-[15%] border border-dashed border-black" />}
              <span className="pointer-events-none absolute inset-[8%] border border-dashed border-blue-400/60" />
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-700 bg-[#242424] p-2 text-[10px]">
            <span>Doc: 18,4M/32,8M</span>
            <span>RGB/16</span>
            <input
              type="range"
              min="12"
              max="200"
              value={zoom}
              aria-label="Zoom do documento"
              onChange={(e) => setZoom(+e.target.value)}
              className="ml-auto accent-blue-400"
            />
            <span>{zoom}%</span>
          </div>
        </main>
        <aside className="overflow-auto rounded border border-slate-800 bg-[#242424]">
          <div className="flex border-b border-slate-700">
            {["Propriedades", "Ajustes"].map((name) => (
              <button
                key={name}
                onClick={() => setRightPanel(name)}
                className={`flex-1 p-2 text-[10px] ${rightPanel === name ? "border-b-2 border-blue-400 text-blue-300" : "text-slate-500"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="p-3">
            <h3 className="mb-3 text-xs font-bold">
              {rightPanel === "Ajustes"
                ? "Ajustes não destrutivos"
                : "Transformação e aparência"}
            </h3>
            {rightPanel === "Ajustes" ? (
              <div className="grid grid-cols-4 gap-2">
                {[
                  "Brilho",
                  "Níveis",
                  "Curvas",
                  "Exposição",
                  "Vibratilidade",
                  "Matiz/Sat.",
                  "Equilíbrio",
                  "P&B",
                  "Mapa grad.",
                  "Seletiva",
                  "Lookup",
                  "Inverter",
                ].map((item) => (
                  <button
                    key={item}
                    title={item}
                    className="grid aspect-square place-items-center rounded border border-slate-700 text-[8px] hover:border-blue-400"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <section className="border-b border-slate-700 pb-3">
                  <h4 className="mb-2 text-[10px] font-bold uppercase text-slate-400">Transformar</h4>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <label>X <input aria-label="Posição X da camada" type="number" value={selectedLayer?.transform.x ?? 0} onChange={(event) => updateTransform("x", event.target.value)} className="w-full rounded border border-slate-700 bg-[#171717] p-1" /></label>
                    <label>Y <input aria-label="Posição Y da camada" type="number" value={selectedLayer?.transform.y ?? 0} onChange={(event) => updateTransform("y", event.target.value)} className="w-full rounded border border-slate-700 bg-[#171717] p-1" /></label>
                    <label>Escala <input aria-label="Escala da camada" type="number" value={selectedLayer?.transform.scale ?? 100} onChange={(event) => updateTransform("scale", event.target.value)} className="w-full rounded border border-slate-700 bg-[#171717] p-1" /></label>
                    <label>Rotação <input aria-label="Rotação da camada" type="number" value={selectedLayer?.transform.rotation ?? 0} onChange={(event) => updateTransform("rotation", event.target.value)} className="w-full rounded border border-slate-700 bg-[#171717] p-1" /></label>
                  </div>
                </section>
                <label className="block text-[10px] text-slate-400">Modo
                  <select aria-label="Modo de mesclagem da camada" value={selectedLayer?.blendMode || "normal"} onChange={(event) => updateLayer(selectedLayer.id, { blendMode: event.target.value }, "Modo de mesclagem")} className="mt-1 w-full rounded border border-slate-700 bg-[#171717] p-1.5">
                    {BLEND_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-slate-400">Opacidade <input aria-label="Opacidade da camada" type="range" min="0" max="100" value={selectedLayer?.opacity ?? 100} onChange={(event) => updateLayer(selectedLayer.id, { opacity: Number(event.target.value) }, "Opacidade")} className="w-full accent-blue-400" /></label>
                <details>
                  <summary className="cursor-pointer text-[10px] font-bold text-slate-400">Ajustes da imagem</summary>
                  {Object.entries(adjust).map(([key, value]) => (
                  <label
                    key={key}
                    className="block text-[10px] capitalize text-slate-500"
                  >
                    <span className="flex justify-between">
                      <span>{key}</span>
                      <span>{value}</span>
                    </span>
                    <input
                      type="range"
                      min={key === "blur" ? 0 : -100}
                      max={key === "blur" ? 20 : 100}
                      value={value}
                      onChange={(e) =>
                        setAdjust((old) => ({ ...old, [key]: +e.target.value }))
                      }
                      className="w-full accent-blue-400"
                    />
                  </label>
                  ))}
                </details>
              </div>
            )}
          </div>
          <div className="border-t border-slate-700">
            <div className="flex">
              <button className="flex-1 border-b-2 border-blue-400 p-2 text-[10px] text-blue-300">
                Camadas
              </button>
              <button className="flex-1 p-2 text-[10px] text-slate-500">
                Canais
              </button>
              <button className="flex-1 p-2 text-[10px] text-slate-500">
                Caminhos
              </button>
            </div>
            <div data-testid="photo-layer-list">
            {layers.map((layer) => (
              <button
                key={layer.id}
                aria-label={layer.name}
                onClick={() => setActiveLayer(layer.id)}
                className={`flex w-full items-center gap-2 border-t border-slate-800 p-2 text-left text-[10px] ${activeLayer === layer.id ? "bg-blue-500/10 text-blue-200" : ""}`}
              >
                <span role="button" tabIndex={0} aria-label={`${layer.visible ? "Ocultar" : "Mostrar"} ${layer.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(layer.id);
                  }}
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </span>
                <span className="grid h-8 w-8 place-items-center rounded border border-slate-600 bg-slate-800">
                  {layer.kind}
                </span>
                <span className="truncate">{layer.name}</span>
                {layer.mask && <span aria-label={`Máscara de ${layer.name}`} className="ml-auto h-6 w-6 border border-white bg-gradient-to-br from-white to-black" />}
                {layer.locked && <span className="ml-auto">🔒</span>}
              </button>
            ))}
            </div>
            <div className="grid grid-cols-7 gap-1 p-2">
              <button
                onClick={() => addLayer("Camada")}
                className="rounded border border-slate-700 p-2 text-[10px]"
              >
                +
              </button>
              <button
                onClick={() => addLayer("Texto")}
                className="rounded border border-slate-700 p-2 text-[10px]"
              >
                T
              </button>
              <button
                aria-label="Adicionar máscara de camada"
                onClick={() => selectedLayer && updateLayer(selectedLayer.id, { mask: true }, "Adicionar máscara")}
                className="rounded border border-slate-700 p-2 text-[10px]"
              >
                ◉
              </button>
              <button className="rounded border border-slate-700 p-2 text-[10px]">
                fx
              </button>
              <button aria-label="Mover camada para cima" onClick={() => moveLayer(-1)} className="rounded border border-slate-700 p-2"><ChevronUp size={13} /></button>
              <button aria-label="Mover camada para baixo" onClick={() => moveLayer(1)} className="rounded border border-slate-700 p-2"><ChevronDown size={13} /></button>
              <button aria-label="Excluir camada" onClick={removeLayer} className="rounded border border-slate-700 p-2"><Trash2 size={13} /></button>
            </div>
            <button aria-label="Duplicar camada" onClick={duplicateLayer} className="mx-2 mb-2 w-[calc(100%-1rem)] rounded border border-slate-700 p-2 text-[10px]">Duplicar camada</button>
          </div>
          <div className="border-t border-slate-700 p-3">
            <h3 className="mb-2 text-xs font-bold">Filtros</h3>
            <div className="grid grid-cols-2 gap-1">
              {[
                "Camera Raw",
                "Liquify",
                "Desfoque",
                "Nitidez",
                "Ruído",
                "Pixelização",
                "Render",
                "Neural",
              ].map((item) => (
                <button
                  key={item}
                  className="rounded border border-slate-700 p-2 text-[9px]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
