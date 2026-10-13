import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Camera,
  ChevronDown,
  Circle,
  Film,
  FolderPlus,
  Hand,
  Layers3,
  Lightbulb,
  MousePointer2,
  Pause,
  PenTool,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Type,
  Upload,
} from "lucide-react";

const TOOLS = [
  ["V", "Seleção", MousePointer2],
  ["H", "Mão", Hand],
  ["Q", "Forma", Square],
  ["G", "Caneta", PenTool],
  ["T", "Texto", Type],
  ["C", "Câmera", Camera],
  ["L", "Luz", Lightbulb],
];

const EFFECT_GROUPS = {
  "Animação predefinida": ["Texto · Entrada suave", "Transição · Dissolver", "Formas · Bounce"],
  "Áudio": ["Graves e agudos", "Equalizador paramétrico", "Reverberação"],
  "Desfoque e nitidez": ["Desfoque gaussiano", "Desfoque de câmera", "Máscara de nitidez"],
  "Canal": ["Definir canais", "Combinador de canais", "Remover fosco de cor"],
  "Correção de cor": ["Brilho e contraste", "Curvas", "Lumetri Color", "Tonalidade/Saturação"],
  "Distorcer": ["Turbulent Displace", "Transformar", "Ondulação", "Warp"],
  "Chaveamento": ["Keylight 1.2", "Key Cleaner", "Advanced Spill Suppressor"],
  "Gerar": ["Preenchimento", "Glow", "Gradiente de 4 cores", "Traçado"],
  "Perspectiva": ["Drop Shadow", "Bevel Alpha", "Rastreador de câmera 3D"],
  "Tempo": ["Eco", "Posterizar tempo", "Timewarp"],
  "Transição": ["Wipe linear", "Iris Wipe", "Block Dissolve"],
};

function evaluateKeyframes(frames, time, fallback) {
  if (!frames?.length) return fallback;
  const ordered = [...frames].sort((a, b) => a.time - b.time);
  if (time <= ordered[0].time) return ordered[0].value;
  if (time >= ordered.at(-1).time) return ordered.at(-1).value;
  const rightIndex = ordered.findIndex((frame) => frame.time >= time);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  if (left.interpolation === "hold") return left.value;
  let progress = (time - left.time) / (right.time - left.time);
  if (["auto-bezier", "easy-ease"].includes(left.interpolation)) {
    progress = progress * progress * (3 - 2 * progress);
  }
  return left.value + (right.value - left.value) * progress;
}

const APP_MENUS = {
  Arquivo: ["Novo projeto", "Importar mídia", "Salvar projeto", "Adicionar à fila de renderização"],
  Editar: ["Desfazer", "Refazer", "Duplicar camada", "Excluir camada"],
  Composição: ["Nova composição", "Configurações da composição", "Adicionar marcador"],
  Camada: ["Nova camada de texto", "Nova camada de forma", "Nova câmera", "Nova luz"],
  Efeito: ["Efeitos e predefinições", "Controles de efeitos", "Remover todos os efeitos"],
  Animação: ["Adicionar quadro-chave", "Editor de gráficos", "Assistente de quadro-chave"],
  Exibir: ["Ajustar composição", "100%", "Mostrar grades"],
  Janela: ["Projeto", "Controles de efeitos", "Propriedades", "Efeitos e predefinições"],
  Ajuda: ["Atalhos do MMEffect", "Sobre o MMEffect"],
};

export default function EffectCraftWorkspace({
  active = true,
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [tool, setTool] = useGraphicDraftState("EffectCraftWorkspace.jsx:tool", "Seleção");
  const [openMenu, setOpenMenu] = useState(null);
  const [workspace, setWorkspace] = useGraphicDraftState("EffectCraftWorkspace.jsx:workspace", "Padrão");
  const [viewportOffset, setViewportOffset] = useGraphicDraftState("EffectCraftWorkspace.jsx:viewportOffset", { x: 0, y: 0 });
  const [leftPanel, setLeftPanel] = useGraphicDraftState("EffectCraftWorkspace.jsx:leftPanel", "Controles de efeitos");
  const [rightTopPanel, setRightTopPanel] = useGraphicDraftState("EffectCraftWorkspace.jsx:rightTopPanel", "Informações");
  const [rightBottomPanel, setRightBottomPanel] = useGraphicDraftState("EffectCraftWorkspace.jsx:rightBottomPanel", "Propriedades");
  const [bottomPanel, setBottomPanel] = useGraphicDraftState("EffectCraftWorkspace.jsx:bottomPanel", "Timeline");
  const [graphEditor, setGraphEditor] = useGraphicDraftState("EffectCraftWorkspace.jsx:graphEditor", false);
  const [showSwitches, setShowSwitches] = useGraphicDraftState("EffectCraftWorkspace.jsx:showSwitches", true);
  const [showModes, setShowModes] = useGraphicDraftState("EffectCraftWorkspace.jsx:showModes", true);
  const [expandedLayers, setExpandedLayers] = useGraphicDraftState("EffectCraftWorkspace.jsx:expandedLayers", []);
  const [markers, setMarkers] = useGraphicDraftState("EffectCraftWorkspace.jsx:markers", [1.2, 5.8, 8.4]);
  const [propertyKeyframes, setPropertyKeyframes] = useGraphicDraftState("EffectCraftWorkspace.jsx:propertyKeyframes", {});
  const [selectedKeyframe, setSelectedKeyframe] = useGraphicDraftState("EffectCraftWorkspace.jsx:selectedKeyframe", null);
  const [canvasBox, setCanvasBox] = useGraphicDraftState("EffectCraftWorkspace.jsx:canvasBox", { x: 22, y: 34, w: 60, h: 22 });
  const [composition, setComposition] = useGraphicDraftState("EffectCraftWorkspace.jsx:composition", "EffectCraft Intro");
  const gesture = useRef(null);
  const timelineGesture = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useGraphicDraftState("EffectCraftWorkspace.jsx:playhead", 3);
  const [zoom, setZoom] = useGraphicDraftState("EffectCraftWorkspace.jsx:zoom", 100);
  const [search, setSearch] = useGraphicDraftState("EffectCraftWorkspace.jsx:search", "");
  const [openEffectGroups, setOpenEffectGroups] = useGraphicDraftState("EffectCraftWorkspace.jsx:openEffectGroups", ["Correção de cor", "Desfoque e nitidez"]);
  const [appliedEffects, setAppliedEffects] = useGraphicDraftState("EffectCraftWorkspace.jsx:appliedEffects", ["Color Range", "Transformar"]);
  const [selectedLayer, setSelectedLayer] = useGraphicDraftState("EffectCraftWorkspace.jsx:selectedLayer", "shape");
  const [editingLayer, setEditingLayer] = useState(null);
  const [layerNameDraft, setLayerNameDraft] = useGraphicDraftState("EffectCraftWorkspace.jsx:layerNameDraft", "");
  const [parentDrag, setParentDrag] = useState(null);
  const [layers, setLayers] = useGraphicDraftState("EffectCraftWorkspace.jsx:layers", [
    {
      id: "lower-third",
      name: "Lower Third",
      kind: "▰",
      color: "bg-[#8c7658]",
      visible: true,
      locked: false,
      start: 6.5,
      duration: 3.2,
    },
    {
      id: "text",
      name: "MMEffect",
      kind: "T",
      color: "bg-[#a9343c]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "tagline",
      name: "Tagline",
      kind: "T",
      color: "bg-[#8f2b32]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "accent",
      name: "Accent Line",
      kind: "★",
      color: "bg-[#536bc4]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "burst",
      name: "Tick Burst",
      kind: "★",
      color: "bg-[#5875d9]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "rings",
      name: "Orbit Rings",
      kind: "★",
      color: "bg-[#667ce2]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "shape",
      name: "Controller",
      kind: "□",
      color: "bg-[#a9343c]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
    {
      id: "background",
      name: "Background",
      kind: "■",
      color: "bg-[#a9343c]",
      visible: true,
      locked: false,
      start: 0,
      duration: 10,
    },
  ]);
  const introLayers = useRef(layers);
  const [transform, setTransform] = useGraphicDraftState("EffectCraftWorkspace.jsx:transform", {
    x: 960,
    y: 540,
    scale: 100,
    rotation: 0,
    opacity: 100,
  });

  useEffect(() => {
    if (!playing || !active) return;
    const timer = setInterval(
      () => setPlayhead((old) => (old >= 10 ? 0 : old + 0.1)),
      100,
    );
    return () => clearInterval(timer);
  }, [playing, active]);

  useEffect(() => {
    const layouts = {
      Padrão: ["Controles de efeitos", "Informações", "Propriedades", false],
      Animação: ["Efeitos e predefinições", "Pré-visualização", "Efeitos e predefinições", true],
      Standard: ["Projeto", "Pré-visualização", "Efeitos e predefinições", false],
      "Tela pequena": ["Projeto", "Pré-visualização", "Propriedades", false],
    };
    const [left, top, right, graph] = layouts[workspace];
    setLeftPanel(left);
    setRightTopPanel(top);
    setRightBottomPanel(right);
    setBottomPanel("Timeline");
    setGraphEditor(graph);
  }, [workspace]);

  const visibleEffectGroups = useMemo(() => Object.entries(EFFECT_GROUPS).map(([group, effects]) => [group, effects.filter(effect => effect.toLowerCase().includes(search.toLowerCase()))]).filter(([group, effects]) => effects.length || group.toLowerCase().includes(search.toLowerCase())), [search]);
  const activeLayer = layers.find((layer) => layer.id === selectedLayer);
  const [maskSelected, setMaskSelected] = useState(false);
  const displayTransform = useMemo(() => {
    const animated = propertyKeyframes[selectedLayer] || {};
    return Object.fromEntries(Object.entries(transform).map(([property, fallback]) => [
      property,
      evaluateKeyframes(animated[property], playhead, fallback),
    ]));
  }, [playhead, propertyKeyframes, selectedLayer, transform]);
  const timelineColumns = `18px repeat(6,18px) 22px 14px 18px 100px${showSwitches ? " repeat(8,16px)" : ""}${showModes ? " 60px 16px 80px 16px 80px" : ""}`;
  const timelinePanelWidth = 280 + (showSwitches ? 128 : 0) + (showModes ? 252 : 0);

  function beginLayerRename(layer) {
    setSelectedLayer(layer.id);
    setEditingLayer(layer.id);
    setLayerNameDraft(layer.name);
  }

  function commitLayerRename(layerId) {
    const nextName = layerNameDraft.trim();
    if (nextName) setLayerValue(layerId, "name", nextName);
    setEditingLayer(null);
  }

  function beginParentDrag(event, layerId) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setParentDrag({ layerId, x1: event.clientX, y1: event.clientY, x2: event.clientX, y2: event.clientY });
  }

  function moveParentDrag(event) {
    setParentDrag((current) => current ? { ...current, x2: event.clientX, y2: event.clientY } : current);
  }

  function finishParentDrag(targetId) {
    setParentDrag((current) => {
      if (current && current.layerId !== targetId) setLayerValue(current.layerId, "parent", targetId);
      return null;
    });
  }

  function finishParentDragAtPoint(event) {
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.("[data-parent-layer-id]");
    const targetId = target?.dataset.parentLayerId;
    if (targetId) finishParentDrag(targetId);
    else setParentDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function addLayer(kind) {
    const id = crypto.randomUUID();
    setLayers((old) => [
      {
        id,
        name: `${kind} ${old.length + 1}`,
        kind: kind === "Texto" ? "T" : "▣",
        color: "bg-fuchsia-500",
        visible: true,
        locked: false,
        start: playhead,
        duration: 4,
      },
      ...old,
    ]);
    setSelectedLayer(id);
  }

  function runMenuCommand(command) {
    setOpenMenu(null);
    if (command === "Importar mídia") document.getElementById("mmeffect-import")?.click();
    else if (command === "Adicionar à fila de renderização") setBottomPanel("Fila de renderização");
    else if (command === "Nova composição") openComposition("EffectCraft Intro");
    else if (command === "Adicionar marcador" || command === "Adicionar quadro-chave") setMarkers(old=>[...old,playhead]);
    else if (command === "Nova camada de texto") addLayer("Texto");
    else if (command === "Nova camada de forma") addLayer("Forma");
    else if (command === "Nova câmera") addLayer("Câmera");
    else if (command === "Nova luz") addLayer("Luz");
    else if (command === "Efeitos e predefinições") setRightBottomPanel("Efeitos e predefinições");
    else if (command === "Controles de efeitos") setLeftPanel("Controles de efeitos");
    else if (command === "Remover todos os efeitos") setAppliedEffects([]);
    else if (command === "Editor de gráficos") setGraphEditor(value=>!value);
    else if (command === "Projeto") setLeftPanel("Projeto");
    else if (command === "Propriedades") setRightBottomPanel("Propriedades");
    else if (command === "100%") setZoom(100);
    else if (command === "Excluir camada" && selectedLayer) setLayers(old=>old.filter(layer=>layer.id!==selectedLayer));
    else if (command === "Duplicar camada" && activeLayer) setLayers(old=>[{...activeLayer,id:crypto.randomUUID(),name:`${activeLayer.name} cópia`},...old]);
  }

  function patchLayer(id, key) {
    setLayers((old) =>
      old.map((layer) =>
        layer.id === id ? { ...layer, [key]: !layer[key] } : layer,
      ),
    );
  }

  function setLayerValue(id, key, value) {
    setLayers(old=>old.map(layer=>layer.id===id?{...layer,[key]:value}:layer));
  }

  function toggleLayerMarker(id) {
    const time = Math.round(playhead * 100) / 100;
    setLayers((old) => old.map((layer) => {
      if (layer.id !== id) return layer;
      const layerMarkers = layer.markers || [];
      const exists = layerMarkers.includes(time);
      return { ...layer, markers: exists ? layerMarkers.filter((at) => at !== time) : [...layerMarkers, time] };
    }));
  }

  function toggleLayerExpanded(id) {
    setExpandedLayers(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);
  }

  function beginTimelineGesture(event, layer, mode) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedLayer(layer.id);
    timelineGesture.current = { id: layer.id, mode, startX: event.clientX, start: layer.start, duration: layer.duration };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveTimelineGesture(event) {
    const active = timelineGesture.current;
    if (!active) return;
    const delta = (event.clientX - active.startX) / 60;
    setLayers(old=>old.map(layer=>{
      if (layer.id !== active.id) return layer;
      if (active.mode === "move") {
        const start = Math.max(0,Math.min(9.9,active.start+delta));
        return {...layer,start,duration:Math.max(.1,Math.min(active.duration,10-start))};
      }
      if (active.mode === "trim-start") {
        const start = Math.max(0,Math.min(active.start+active.duration-.1,active.start+delta));
        return {...layer,start,duration:active.duration+(active.start-start)};
      }
      return {...layer,duration:Math.max(.1,Math.min(10-active.start,active.duration+delta))};
    }));
  }

  function togglePropertyKeyframe(property) {
    if (!selectedLayer) return;
    const time = Math.round(playhead*100)/100;
    setPropertyKeyframes(old=>{
      const layerFrames = old[selectedLayer] || {};
      const frames = layerFrames[property] || [];
      const exists = frames.some(frame=>frame.time===time);
      return {...old,[selectedLayer]:{...layerFrames,[property]:exists?frames.filter(frame=>frame.time!==time):[...frames,{time,value:displayTransform[property],interpolation:"linear"}]}};
    });
  }

  function changeTransform(property, nextValue) {
    const value = Number(nextValue);
    setTransform((old) => ({ ...old, [property]: value }));
    if (!selectedLayer) return;
    const time = Math.round(playhead * 100) / 100;
    setPropertyKeyframes((old) => {
      const layerFrames = old[selectedLayer] || {};
      const frames = layerFrames[property] || [];
      if (!frames.length) return old;
      const existsAtTime = frames.some((frame) => frame.time === time);
      const nextFrames = existsAtTime
        ? frames.map((frame) => frame.time === time ? { ...frame, value } : frame)
        : [...frames, { time, value, interpolation: "linear" }];
      return {
        ...old,
        [selectedLayer]: { ...layerFrames, [property]: nextFrames },
      };
    });
  }

  function setKeyframeInterpolation(interpolation) {
    if (!selectedKeyframe) return;
    const {layerId,property,time}=selectedKeyframe;
    setPropertyKeyframes(old=>({...old,[layerId]:{...old[layerId],[property]:(old[layerId]?.[property]||[]).map(frame=>frame.time===time?{...frame,interpolation}:frame)}}));
  }

  function beginCanvasGesture(event, mode) {
    event.preventDefault();
    event.stopPropagation();
    gesture.current = { mode, startX: event.clientX, startY: event.clientY, box: canvasBox, offset: viewportOffset };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  useEffect(() => {
    function handleEditorKey(event) {
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!selectedLayer || activeLayer?.locked) return;
        event.preventDefault();
        if (maskSelected && activeLayer?.mask) {
          setLayers(old => old.map(layer => layer.id === selectedLayer ? { ...layer, mask: null } : layer));
          setMaskSelected(false);
          return;
        }
        setLayers(old => old.filter(layer => layer.id !== selectedLayer));
        setSelectedLayer(null);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        if (!activeLayer) return;
        event.preventDefault();
        const copy = { ...activeLayer, id: crypto.randomUUID(), name: `${activeLayer.name} cópia` };
        setLayers(old => [copy, ...old]);
        setSelectedLayer(copy.id);
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const shortcut = TOOLS.find(([key]) => key.toLowerCase() === event.key.toLowerCase());
        if (shortcut) { event.preventDefault(); setTool(shortcut[1]); }
        if (event.key === "Escape") setSelectedLayer(null);
      }
    }
    window.addEventListener("keydown", handleEditorKey);
    return () => window.removeEventListener("keydown", handleEditorKey);
  }, [selectedLayer, activeLayer, maskSelected, setLayers, setSelectedLayer]);

  function useActiveTool(event) {
    if (tool === "Seleção") return;
    if (tool === "Mão") {
      beginCanvasGesture(event, "pan");
      return;
    }
    if (tool === "Forma" && activeLayer && !activeLayer.locked) {
      const element = event.currentTarget.querySelector('[data-effect-layer]');
      if (!element) return;
      const bounds = element.getBoundingClientRect();
      const point = { x: (event.clientX - bounds.left) / bounds.width * 100, y: (event.clientY - bounds.top) / bounds.height * 100 };
      gesture.current = { mode: "mask", layerId: activeLayer.id, bounds, point };
      setMaskSelected(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    const layerKind = tool === "Caneta" ? "Forma" : tool;
    if (["Texto", "Forma", "Câmera", "Luz"].includes(layerKind)) addLayer(layerKind);
  }

  function placeAsset(event) {
    event.preventDefault();
    const asset = assets.find((item) => item.id === event.dataTransfer.getData("text/plain"));
    if (!asset) return;
    onSelect(asset);
    const id = crypto.randomUUID();
    setLayers((old)=>[{id,name:asset.name,kind:asset.type.startsWith("audio")?"♫":"▣",color:"bg-[#5671c7]",visible:true,locked:false,start:playhead,duration:Math.max(1,10-playhead)},...old]);
    setSelectedLayer(id);
  }

  function openComposition(name) {
    setComposition(name);
    setPlayhead(name === "3D Showcase" ? 2 : 3);
    setGraphEditor(false);
    if (name === "Particles") {
      setLayers([{id:"particles",name:"Particles",kind:"■",color:"bg-[#a9343c]",visible:true,locked:false,start:0,duration:10}]);
      setSelectedLayer("particles");
      setAppliedEffects(["CC Particle World"]);
      setLeftPanel("Controles de efeitos");
    } else if (name === "3D Showcase") {
      const names = [["caption","Caption","T"],["camera","Camera 1","⌁"],["key-light","Key Light","●"],["fill-light","Fill Light","●"],["title-3d","3D Title","T"],["card-blue","Card Blue","■"],["card-coral","Card Coral","■"],["cross-a","Cross A","■"],["cross-b","Cross B","■"],["floor","Floor","■"]];
      setLayers(names.map(([id,label,kind])=>({id,name:label,kind,color:id.includes("light")?"bg-[#e3b8c5]":"bg-[#a9343c]",visible:true,locked:false,start:0,duration:10})));
      setSelectedLayer("title-3d");
      setAppliedEffects(["Transformar"]);
      setLeftPanel("Projeto");
    } else {
      setLayers(introLayers.current);
      setSelectedLayer("text");
      setAppliedEffects(["Color Range", "Transformar"]);
    }
  }

  function moveCanvasGesture(event) {
    const active = gesture.current;
    if (!active) return;
    if (active.mode === "mask-edit") {
      const dx = (event.clientX - active.startX) / active.bounds.width * 100;
      const dy = (event.clientY - active.startY) / active.bounds.height * 100;
      const mask = { ...active.mask };
      if (active.edge === "move") { mask.left += dx; mask.right += dx; mask.top += dy; mask.bottom += dy; }
      else {
        if (active.edge.includes("w")) mask.left = Math.min(mask.right - 1, mask.left + dx);
        if (active.edge.includes("e")) mask.right = Math.max(mask.left + 1, mask.right + dx);
        if (active.edge.includes("n")) mask.top = Math.min(mask.bottom - 1, mask.top + dy);
        if (active.edge.includes("s")) mask.bottom = Math.max(mask.top + 1, mask.bottom + dy);
      }
      setLayers(old => old.map(layer => layer.id === active.layerId ? { ...layer, mask } : layer));
      return;
    }
    if (active.mode === "mask") {
      const x = (event.clientX - active.bounds.left) / active.bounds.width * 100;
      const y = (event.clientY - active.bounds.top) / active.bounds.height * 100;
      const mask = { left: Math.min(x, active.point.x), top: Math.min(y, active.point.y), right: Math.max(x, active.point.x), bottom: Math.max(y, active.point.y) };
      setLayers(old => old.map(layer => layer.id === active.layerId ? { ...layer, mask } : layer));
      return;
    }
    if (active.mode === "pan") {
      setViewportOffset({
        x: active.offset.x + event.clientX - active.startX,
        y: active.offset.y + event.clientY - active.startY,
      });
      return;
    }
    const dx = (event.clientX - active.startX) / 8;
    const dy = (event.clientY - active.startY) / 5;
    setCanvasBox(active.mode === "resize"
      ? { ...active.box, w: Math.max(18, Math.min(78, active.box.w + dx)), h: Math.max(10, Math.min(55, active.box.h + dy)) }
      : { ...active.box, x: active.box.x + dx, y: active.box.y + dy });
  }

  const compactWorkspace = workspace === "Tela pequena";
  const workspaceGrid = compactWorkspace
    ? "grid-cols-[0_minmax(0,1fr)_0] grid-rows-[minmax(340px,58%)_minmax(260px,42%)]"
    : workspace === "Animação"
      ? "grid-cols-[300px_minmax(520px,1fr)_300px] grid-rows-[minmax(300px,45%)_minmax(340px,55%)]"
      : "grid-cols-[290px_minmax(520px,1fr)_290px] grid-rows-[minmax(320px,52%)_minmax(300px,48%)]";
  const viewerCursor = tool === "Mão" ? "cursor-grab" : tool === "Texto" ? "cursor-text" : tool === "Seleção" ? "cursor-default" : "cursor-crosshair";

  return (
    <section className="h-screen min-h-[720px] overflow-hidden bg-[#1b1b1b] text-slate-200">
      <h1 className="sr-only">MMEffect</h1>
      <select aria-label="Área de trabalho do MMEffect" value={workspace} onChange={(event)=>setWorkspace(event.target.value)} className="sr-only">
        {["Padrão","Animação","Standard","Tela pequena"].map(item=><option key={item}>{item}</option>)}
      </select>
      <div className="flex h-7 items-center gap-0 overflow-x-auto border-b border-[#080808] bg-[#202020] px-1 text-[11px]">
        {Object.entries(APP_MENUS).map(([item,commands]) => (
          <div key={item} className="relative h-full shrink-0">
            <button onClick={()=>setOpenMenu(openMenu===item?null:item)} aria-expanded={openMenu===item} className={`h-full px-2 text-[#c8c8c8] hover:bg-[#343434] hover:text-white ${openMenu===item?'bg-[#343434] text-white':''}`}>{item}</button>
            {openMenu===item && <div className="absolute left-0 top-full z-50 min-w-52 border border-[#555] bg-[#292929] py-1 shadow-xl">
              {commands.map(command=><button key={command} onClick={()=>runMenuCommand(command)} className="block w-full whitespace-nowrap px-4 py-1.5 text-left text-[11px] hover:bg-[#2675df] hover:text-white">{command}</button>)}
            </div>}
          </div>
        ))}
      </div>

      <div className="flex h-9 items-center gap-0.5 overflow-x-auto border-b border-[#080808] bg-[#202020] px-1">
        <span className="mr-1 grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-blue-400 to-violet-600 text-[10px] font-black">M</span>
        {TOOLS.map(([shortcut, name, Icon]) => (
          <button
            key={name}
            title={`${name} (${shortcut})`}
            onClick={() => setTool(name)}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm ${tool === name ? "bg-[#2675df] text-white" : "text-[#bdbdbd] hover:bg-[#353535]"}`}
          >
            <Icon size={15} />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-[#555]" />
        <label className="flex items-center gap-2 px-2 text-[10px] text-slate-400"><input type="checkbox" defaultChecked className="accent-blue-500"/> Ajustar</label>
        <span className="ml-auto flex h-full items-center text-[10px]">{["Padrão","Animação","Standard","Tela pequena"].map(item=><button key={item} onClick={()=>setWorkspace(item)} className={`h-full px-3 ${workspace===item?'border-b-2 border-blue-400 text-blue-300':'text-[#aaa] hover:text-white'}`}>{item}</button>)}</span>
        <label className="ml-2 cursor-pointer rounded bg-[#5663e8] px-3 py-1 text-[10px] font-bold text-white"><Upload className="mr-1 inline" size={11}/>Importar<input id="mmeffect-import" hidden multiple type="file" accept="video/*,image/*,audio/*" onChange={(event)=>onOpenFiles(event.target.files)}/></label>
      </div>

      <div aria-label="Grade do workspace MMEffect" data-workspace={workspace} className={`grid h-[calc(100%-64px)] min-h-0 gap-px bg-[#080808] ${workspaceGrid}`}>
        <aside className={`row-span-1 flex min-h-0 flex-col overflow-hidden bg-[#202020] ${compactWorkspace ? "invisible" : ""}`}>
          <PanelTabs labels={["Projeto", "Controles de efeitos", "Efeitos e predefinições"]} active={leftPanel} onChange={setLeftPanel} />
          {leftPanel === "Projeto" ? <>
          <div className="flex items-center gap-2 border-b border-slate-800 p-2 text-[10px] text-slate-500"><FolderPlus size={13} /><span>Projeto MMEffect</span><span className="ml-auto">{assets.length} itens</span></div>
          <button onClick={()=>document.getElementById("mmeffect-import")?.click()} className="m-2 flex items-center justify-center gap-2 rounded border border-[#555] bg-[#292929] px-3 py-2 text-[10px] hover:border-blue-400 hover:bg-[#343434]"><Upload size={12}/>Importar mídia</button>
          <div className="border-b border-[#333] px-2 py-1 text-[9px] text-[#aaa]">Nome <span className="float-right">Tipo&nbsp;&nbsp;&nbsp;Tamanho</span></div>
          <div className="space-y-px p-1 text-[10px]">
            {[['3D Showcase','▣','Composição'],['EffectCraft Intro','▣','Composição'],['Particles','▣','Composição'],['Precomps','▱','Pasta'],['Solids','▱','Pasta']].map(([name,icon,type])=><button key={name} onDoubleClick={()=>type==='Composição'&&openComposition(name)} className={`grid w-full grid-cols-[18px_1fr_78px] items-center px-1 py-1 text-left hover:bg-[#353535] ${composition===name?'bg-[#3a3f46]':''}`}><span className={type==='Pasta'?'text-yellow-300':'text-violet-300'}>{icon}</span><span>{name}</span><span className="text-[#999]">{type}</span></button>)}
          </div>
          <div className="space-y-px p-1">
            {assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => onSelect(asset)}
                draggable
                onDragStart={(event)=>event.dataTransfer.setData("text/plain",asset.id)}
                className={`grid w-full grid-cols-[34px_1fr_70px] items-center gap-2 px-1 py-1 text-left ${selected?.id === asset.id ? "bg-[#315e89]" : "hover:bg-[#353535]"}`}
              >
                {asset.type.startsWith("image") ? (
                  <img
                    src={asset.url}
                    alt=""
                    className="h-7 w-8 object-cover"
                  />
                ) : (
                  <div className="grid h-7 w-8 place-items-center bg-black">
                    <Film size={13} />
                  </div>
                )}
                <span className="truncate text-[9px]">{asset.name}</span><span className="truncate text-[9px] text-[#999]">Mídia</span>
              </button>
            ))}
          </div>
          {!assets.length && (
            <p className="p-4 text-xs text-slate-500">
              Importe vídeos, imagens e áudio para o painel Projeto.
            </p>
          )}
          <div className="mt-auto border-t border-slate-800 p-2 text-[10px] text-slate-500">
            8 bpc <span className="float-right">▱　＋　⌫</span>
          </div>
          </> : leftPanel === "Controles de efeitos" ? <div className="p-3 text-[10px]">
            <div className="mb-3 flex items-center gap-2 border-b border-slate-700 pb-3"><span className="grid h-6 w-6 place-items-center rounded bg-cyan-500 text-black">{activeLayer?.kind}</span><b className="truncate">{activeLayer?.name}</b></div>
            {appliedEffects.map((effect, index) => <EffectControl key={`${effect}-${index}`} effect={effect} transform={displayTransform} onTransformChange={changeTransform} onRemove={()=>setAppliedEffects(old=>old.filter((_,i)=>i!==index))}/>) }
          </div> : <EffectsBrowser search={search} setSearch={setSearch} visibleEffectGroups={visibleEffectGroups} openEffectGroups={openEffectGroups} setOpenEffectGroups={setOpenEffectGroups} setAppliedEffects={setAppliedEffects} setLeftPanel={setLeftPanel} />}
        </aside>

        <main className="relative col-start-2 row-start-1 min-w-0 bg-[#171717]">
          <div className="flex h-full min-h-0 flex-col bg-black">
            <div className="flex items-center border-b border-slate-800 bg-[#151920] px-3 py-2 text-[10px]">
              <b>Composição: {composition}</b>
              {activeLayer && <label className="ml-3 flex items-center gap-2">Texto da camada<input aria-label="Texto da camada selecionada" disabled={activeLayer.locked} value={activeLayer.text ?? "MMEffect"} onChange={event => setLayers(old => old.map(layer => layer.id === activeLayer.id ? { ...layer, text: event.target.value } : layer))} className="w-40 bg-[#252525] px-2 py-1"/></label>}
              <span className="ml-auto text-slate-500">
                Visualização: Ativa · Resolução: Completa · 100%
              </span>
            </div>
            <div aria-label="Visualizador da composição" onPointerDown={useActiveTool} onPointerMove={moveCanvasGesture} onPointerUp={()=>{gesture.current=null}} onDragOver={(event)=>event.preventDefault()} onDrop={placeAsset} className={`relative grid flex-1 place-items-center overflow-hidden bg-[#181818] p-4 ${viewerCursor}`}>
              <div style={{transform:`translate(${viewportOffset.x}px, ${viewportOffset.y}px)`}} className={`relative aspect-video h-[88%] max-h-full max-w-[92%] overflow-hidden shadow-2xl ${composition==='Particles'?'bg-black':composition==='3D Showcase'?'bg-[linear-gradient(155deg,#080611,#15192a_58%,#07070c)]':'bg-[radial-gradient(circle_at_center,#14295c_0,#07122d_48%,#030713_100%)]'}`}>
                {selected?.type.startsWith("image") && (
                  <img
                    src={selected.url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-70"
                  />
                )}
                {composition === "Particles" && <ParticlePreview />}
                {composition === "3D Showcase" && <ThreeDPreview />}
                <div className="absolute inset-8 border border-dashed border-indigo-300/50" />
                {composition === "EffectCraft Intro" && <>
                <div
                  aria-label={`Camada ${activeLayer?.name || "EFFECTCRAFT"} na composição`}
                  data-effect-layer
                  onPointerDown={(event)=>tool === "Seleção" && beginCanvasGesture(event,"move")}
                  onPointerMove={moveCanvasGesture}
                  onPointerUp={()=>{gesture.current=null}}
                  className="absolute cursor-move select-none border border-[#55a4ff] px-6 py-4 text-center"
                  style={{left:`${canvasBox.x}%`,top:`${canvasBox.y}%`,width:`${canvasBox.w}%`,height:`${canvasBox.h}%`,transform:`translate(${(displayTransform.x-960)/19.2}%, ${(displayTransform.y-540)/10.8}%) scale(${displayTransform.scale/100}) rotate(${displayTransform.rotation}deg)`,opacity:displayTransform.opacity/100}}
                >
                  <div style={{clipPath: activeLayer?.mask ? `inset(${activeLayer.mask.top}% ${100-activeLayer.mask.right}% ${100-activeLayer.mask.bottom}% ${activeLayer.mask.left}%)` : undefined}}>
                  <span className="block text-[clamp(24px,4vw,62px)] font-black tracking-[0.04em] text-white drop-shadow-[0_0_8px_rgba(255,255,255,.7)]">
                    {activeLayer?.text ?? "MMEffect"}
                  </span>
                  <span className="text-sm tracking-[0.4em] text-cyan-300">
                    MOTION GRAPHICS · VISUAL EFFECTS · PURE RUST
                  </span>
                  </div>
                  {activeLayer?.mask && <div
                    aria-label="Máscara da camada"
                    onPointerDown={event => {
                      event.preventDefault(); event.stopPropagation();
                      if (activeLayer.locked) return;
                      setMaskSelected(true);
                      gesture.current = { mode: "mask-edit", layerId: activeLayer.id, edge: event.target.dataset.edge || "move", mask: { ...activeLayer.mask }, bounds: event.currentTarget.parentElement.getBoundingClientRect(), startX: event.clientX, startY: event.clientY };
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                    }}
                    className="absolute z-20 cursor-move border border-yellow-400"
                    style={{left:`${activeLayer.mask.left}%`,top:`${activeLayer.mask.top}%`,width:`${activeLayer.mask.right-activeLayer.mask.left}%`,height:`${activeLayer.mask.bottom-activeLayer.mask.top}%`}}
                  >
                    {[['nw',0,0],['n',50,0],['ne',100,0],['e',100,50],['se',100,100],['s',50,100],['sw',0,100],['w',0,50]].map(([edge,x,y]) => <button key={edge} data-edge={edge} aria-label={`Redimensionar máscara ${edge}`} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-yellow-400" style={{left:`${x}%`,top:`${y}%`,cursor:`${edge}-resize`}}/>)}
                    <button aria-label="Excluir máscara" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setLayers(old => old.map(layer => layer.id === activeLayer.id ? {...layer,mask:null} : layer)); setMaskSelected(false); }} className="absolute -top-7 left-0 whitespace-nowrap bg-[#252525] px-2 text-xs text-yellow-300">Excluir máscara</button>
                  </div>}
                  <i className="absolute -left-1 -top-1 h-2 w-2 bg-indigo-300" />
                  <button aria-label="Redimensionar camada" onPointerDown={(event)=>{event.stopPropagation();beginCanvasGesture(event,"resize")}} onPointerMove={moveCanvasGesture} onPointerUp={()=>{gesture.current=null}} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize bg-[#55a4ff]" />
                </div>
                <Circle
                  className="absolute right-[18%] top-[30%] text-fuchsia-400"
                  size={110}
                  strokeWidth={0.7}
                />
                <Box
                  className="absolute bottom-[18%] right-[28%] text-cyan-300"
                  size={64}
                  strokeWidth={1}
                />
                </>}
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-800 bg-[#151920] p-2 text-[10px]">
              <button
                onClick={() => setPlaying(!playing)}
                className="rounded bg-indigo-500 p-2"
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <span className="font-mono text-indigo-300">
                00:00:{String(Math.floor(playhead)).padStart(2, "0")}:00
              </span>
              <input
                type="range"
                min="25"
                max="200"
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
                className="ml-auto accent-indigo-400"
              />
              <span>{zoom}%</span>
            </div>
          </div>
        </main>

          <div className="col-span-2 col-start-1 row-start-2 overflow-hidden bg-[#11151b]">
            <div className="flex border-b border-slate-800 bg-[#181c23] text-[10px] font-semibold"><button onClick={()=>setBottomPanel("Timeline")} className={`px-3 py-2 ${bottomPanel === "Timeline" ? "border-b-2 border-blue-500 text-white" : "text-slate-500"}`}>{composition}</button><button onClick={()=>setBottomPanel("Fila de renderização")} className={`px-3 py-2 ${bottomPanel === "Fila de renderização" ? "border-b-2 border-blue-500 text-white" : "text-slate-500"}`}>Fila de renderização</button></div>
            {bottomPanel === "Timeline" ? <>
            <div className="flex items-center gap-3 border-b border-slate-800 p-2 text-[10px]">
              <b className="text-white">{composition}</b>
              <span className="font-mono text-xl text-[#33a3ff]">00:00:{String(Math.floor(playhead)).padStart(2,"0")}:00</span>
              <label className="ml-2 flex items-center gap-2 rounded-full bg-[#171b22] px-3 py-1"><Search size={12}/><input placeholder="Pesquisar" className="w-24 bg-transparent outline-none"/></label>
              <button onClick={()=>setShowSwitches(value=>!value)} aria-pressed={showSwitches} className={`ml-auto rounded px-2 py-1 ${showSwitches?'bg-[#2675df]':'bg-[#30343b]'}`}>Switches</button>
              <button onClick={()=>setShowModes(value=>!value)} aria-pressed={showModes} className={`rounded px-2 py-1 ${showModes?'bg-[#2675df]':'bg-[#30343b]'}`}>Modos</button>
              <button onClick={()=>setGraphEditor(value=>!value)} aria-pressed={graphEditor} className={`rounded border px-2 py-1 ${graphEditor?'border-blue-400 bg-blue-500/20 text-blue-200':'border-slate-700'}`}>Editor de gráficos</button>
            </div>
            <div className="relative flex h-7 text-[9px] text-slate-500" style={{paddingLeft:timelinePanelWidth}}>
              {[0, 2, 4, 6, 8, 10].map((tick) => (
                <button
                  key={tick}
                  onClick={() => setPlayhead(tick)}
                  className="flex-1 border-l border-slate-700 text-left"
                >
                  {tick}s
                </button>
              ))}
              {markers.map((at)=><button key={`comp-marker-${at}`} aria-label={`Marcador da composição em ${at.toFixed(2)}s`} onClick={()=>setPlayhead(at)} className="absolute bottom-0 z-20 h-3 w-2 -translate-x-1/2 bg-[#79a9d8] [clip-path:polygon(0_0,100%_0,50%_100%)]" style={{left:`calc(${timelinePanelWidth}px + (100% - ${timelinePanelWidth}px) * ${at/10})`}} />)}
              <input aria-label="Agulha da timeline" type="range" min="0" max="10" step="0.01" value={playhead} onChange={event=>setPlayhead(Number(event.target.value))} className="absolute bottom-0 top-0 z-10 h-full cursor-ew-resize opacity-0" style={{left:timelinePanelWidth,width:`calc(100% - ${timelinePanelWidth}px)`}}/>
            </div>
            <div className="relative">
              <div className="flex h-7 border-t border-[#3c3c3c] bg-[#242424] text-[11px] text-[#a9a9a9]">
                <div className="grid shrink-0 items-center border-r border-[#3b3b3b]" style={{width:timelinePanelWidth,gridTemplateColumns:timelineColumns}}>
                  <span/><span className="grid place-items-center"><EffectIcon name="eye"/></span><span className="grid place-items-center"><EffectIcon name="speaker"/></span><span className="grid place-items-center"><EffectIcon name="solo"/></span><span className="grid place-items-center"><EffectIcon name="lock"/></span><span className="grid place-items-center"><EffectIcon name="keyframe"/></span><span/><span className="text-center">#</span><span/>
                  <span className="px-2 text-[12px]">Layer Name</span>
                  {showSwitches && ["shy","collapse","quality","fx","frameBlend","motionBlur","adjustment","cube"].map(name=><span key={name} className="grid place-items-center"><EffectIcon name={name}/></span>)}
                  {showModes && <><span className="px-1 text-[11px]">Mode</span><span className="text-center">T</span><span className="px-1 text-[11px]">Track Matte</span><span className="grid place-items-center"><EffectIcon name="pickWhip"/></span><span className="px-1 text-[11px]">Parent &amp; Link</span></>}
                </div>
                <div className="flex-1 bg-[linear-gradient(90deg,transparent_98%,#334155_98%)] bg-[size:10%_100%]"/>
              </div>
              {layers.map((layer, index) => (
                <div
                  key={layer.id}
                  className={`flex min-h-7 flex-wrap border-t border-[#333] ${selectedLayer === layer.id ? "bg-[#454545]" : ""}`}
                >
                  <div className="grid h-7 shrink-0 items-center border-r border-[#3b3b3b] bg-[#202020] text-[10px]" style={{width:timelinePanelWidth,gridTemplateColumns:timelineColumns}}>
                    <span/>
                    <button aria-label={`${layer.visible?"Ocultar":"Mostrar"} ${layer.name}`} aria-pressed={Boolean(layer.visible)} className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${layer.visible?"text-[#bcbcbc]":"text-[#555]"}`} onClick={() => patchLayer(layer.id, "visible")}>
                      <EffectIcon name="eye" />
                    </button>
                    <button aria-label={`${layer.audioMuted?"Ativar":"Silenciar"} áudio de ${layer.name}`} aria-pressed={Boolean(layer.audioMuted)} onClick={() => patchLayer(layer.id, "audioMuted")} className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${layer.audioMuted?"text-[#555]":"text-[#bcbcbc]"}`}><EffectIcon name="speaker"/></button>
                    <button aria-label={`${layer.solo?"Desativar":"Ativar"} solo de ${layer.name}`} aria-pressed={Boolean(layer.solo)} onClick={() => patchLayer(layer.id, "solo")} className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${layer.solo?"text-[#d7d7d7]":"text-[#555]"}`}><EffectIcon name="solo"/></button>
                    <button
                      onClick={() => patchLayer(layer.id, "locked")}
                      className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${layer.locked?"text-[#bcbcbc]":"text-transparent"}`}
                    >
                      <EffectIcon name="lock" />
                    </button>
                    <button aria-label={`${(layer.markers||[]).includes(Math.round(playhead*100)/100)?"Remover":"Adicionar"} marcador de ${layer.name}`} aria-pressed={(layer.markers||[]).includes(Math.round(playhead*100)/100)} onClick={() => toggleLayerMarker(layer.id)} className={`grid h-5 place-items-center border border-[#111] bg-[#151515] ${(layer.markers||[]).length?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="keyframe"/></button>
                    <span className={`mx-auto h-4 w-4 rounded-[3px] ${layer.color}`}/>
                    <span className="text-center text-[#aaa]">{index + 1}</span>
                    <button aria-label={`${expandedLayers.includes(layer.id)?"Recolher":"Expandir"} propriedades de ${layer.name}`} onClick={()=>toggleLayerExpanded(layer.id)} className="grid place-items-center text-[#999]"><EffectIcon name={expandedLayers.includes(layer.id)?"chevronDown":"chevronRight"}/></button>
                    <span className="grid place-items-center text-[#858585]"><EffectIcon name="footage"/></span>
                    {editingLayer === layer.id ? <input
                      autoFocus
                      aria-label={`Renomear ${layer.name}`}
                      value={layerNameDraft}
                      onChange={(event)=>setLayerNameDraft(event.target.value)}
                      onBlur={()=>commitLayerRename(layer.id)}
                      onKeyDown={(event)=>{if(event.key==="Enter")commitLayerRename(layer.id);if(event.key==="Escape")setEditingLayer(null)}}
                      className="h-5 min-w-0 border border-[#4c98d8] bg-[#111] px-1.5 text-[#f0f0f0] outline-none"
                    /> : <button
                      data-parent-layer-id={layer.id}
                      onClick={() => setSelectedLayer(layer.id)}
                      onDoubleClick={() => beginLayerRename(layer)}
                      onPointerUp={() => finishParentDrag(layer.id)}
                      className="h-5 truncate border border-[#111] bg-[#2b2b2b] px-1.5 text-left text-[#d0d0d0]"
                    >
                      {layer.name}
                    </button>}
                    {showSwitches && <>
                    <button aria-label={`Camada tímida de ${layer.name}`} aria-pressed={Boolean(layer.shy)} onClick={()=>patchLayer(layer.id,"shy")} className={`grid place-items-center ${layer.shy?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="shy"/></button>
                    <button aria-label={`Recolher transformações de ${layer.name}`} aria-pressed={Boolean(layer.collapse)} onClick={()=>patchLayer(layer.id,"collapse")} className={`grid place-items-center ${layer.collapse?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="collapse"/></button>
                    <button aria-label={`Qualidade de ${layer.name}`} aria-pressed={Boolean(layer.bestQuality)} onClick={()=>patchLayer(layer.id,"bestQuality")} className={`grid place-items-center ${layer.bestQuality?"text-[#bcbcbc]":"text-[#777]"}`}><EffectIcon name="quality"/></button>
                    <button aria-label={`Efeitos de ${layer.name}`} aria-pressed={layer.effectsEnabled!==false} onClick={()=>setLayerValue(layer.id,"effectsEnabled",layer.effectsEnabled===false)} className={`grid place-items-center ${layer.effectsEnabled===false?"text-[#555]":"text-[#bcbcbc]"}`}><EffectIcon name="fx"/></button>
                    <button aria-label={`Mesclagem de quadros de ${layer.name}`} aria-pressed={Boolean(layer.frameBlend)} onClick={()=>patchLayer(layer.id,"frameBlend")} className={`grid place-items-center ${layer.frameBlend?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="frameBlend"/></button>
                    <button aria-label={`Desfoque de movimento de ${layer.name}`} aria-pressed={Boolean(layer.motionBlur)} onClick={()=>patchLayer(layer.id,"motionBlur")} className={`grid place-items-center ${layer.motionBlur?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="motionBlur"/></button>
                    <button aria-label={`Ajuste de camada de ${layer.name}`} aria-pressed={Boolean(layer.adjustment)} onClick={()=>patchLayer(layer.id,"adjustment")} className={`grid place-items-center ${layer.adjustment?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="adjustment"/></button>
                    <button aria-label={`Camada 3D de ${layer.name}`} aria-pressed={Boolean(layer.threeD)} onClick={()=>patchLayer(layer.id,"threeD")} className={`grid place-items-center ${layer.threeD?"text-[#bcbcbc]":"text-[#555]"}`}><EffectIcon name="cube"/></button>
                    </>}
                    {showModes && <>
                    <select aria-label={`Modo de mesclagem de ${layer.name}`} value={layer.blendMode||"normal"} onChange={event=>setLayerValue(layer.id,"blendMode",event.target.value)} className="mx-1 h-5 border border-[#111] bg-[#171717] px-1 text-[#d0d0d0]"><option value="normal">Normal</option><option value="multiply">Multiplicar</option><option value="screen">Tela</option><option value="overlay">Sobrepor</option><option value="add">Adicionar</option></select>
                    <span/>
                    <select aria-label={`Track matte de ${layer.name}`} value={layer.trackMatte||"none"} onChange={event=>setLayerValue(layer.id,"trackMatte",event.target.value)} className="mx-1 h-5 border border-[#111] bg-[#171717] px-1 text-[#d0d0d0]"><option value="none">No Track Matte</option><option value="alpha">Alpha Matte</option><option value="alpha-inverted">Alpha Inverted</option><option value="luma">Luma Matte</option><option value="luma-inverted">Luma Inverted</option></select>
                    <button aria-label={`Vincular ${layer.name} a outra camada`} title="Arraste até a camada que será o pai" onPointerDown={(event)=>beginParentDrag(event,layer.id)} onPointerMove={moveParentDrag} onPointerUp={finishParentDragAtPoint} className={`grid cursor-crosshair place-items-center ${parentDrag?.layerId===layer.id?"text-[#48a9ff]":"text-[#888]"}`}><EffectIcon name="pickWhip"/></button>
                    <select aria-label={`Pai de ${layer.name}`} value={layer.parent||""} onChange={event=>setLayerValue(layer.id,"parent",event.target.value)} className="mx-1 h-5 border border-[#111] bg-[#171717] px-1 text-[#d0d0d0]"><option value="">None</option>{layers.filter(candidate=>candidate.id!==layer.id).map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>
                    </>}
                  </div>
                  <div className="relative h-7 flex-1 bg-[linear-gradient(90deg,transparent_98%,#334155_98%)] bg-[size:10%_100%]">
                    {!graphEditor && <>
                    <button
                      aria-label={`Mover ${layer.name} na timeline`}
                      aria-valuetext={`Início ${layer.start.toFixed(2)}s, duração ${layer.duration.toFixed(2)}s`}
                      onPointerDown={(event)=>beginTimelineGesture(event,layer,"move")}
                      onPointerMove={moveTimelineGesture}
                      onPointerUp={()=>{timelineGesture.current=null}}
                      className={`absolute top-1 h-5 cursor-grab ${layer.color} px-2 text-left text-[9px] text-white active:cursor-grabbing`}
                      style={{
                        left: `${(layer.start / 10) * 100}%`,
                        width: `${(layer.duration / 10) * 100}%`,
                      }}
                    >
                      {layer.name}
                    </button>
                    <button aria-label={`Aparar início de ${layer.name}`} onPointerDown={(event)=>beginTimelineGesture(event,layer,"trim-start")} onPointerMove={moveTimelineGesture} onPointerUp={()=>{timelineGesture.current=null}} className="absolute top-1 z-10 h-5 w-1.5 cursor-ew-resize bg-white/75" style={{left:`${(layer.start/10)*100}%`}} />
                    <button aria-label={`Aparar fim de ${layer.name}`} onPointerDown={(event)=>beginTimelineGesture(event,layer,"trim-end")} onPointerMove={moveTimelineGesture} onPointerUp={()=>{timelineGesture.current=null}} className="absolute top-1 z-10 h-5 w-1.5 -translate-x-full cursor-ew-resize bg-white/75" style={{left:`${((layer.start+layer.duration)/10)*100}%`}} />
                    {(layer.markers||[]).map((at) => (
                      <button key={`layer-marker-${layer.id}-${at}`} aria-label={`Marcador de ${layer.name} em ${at.toFixed(2)}s`} onClick={()=>setPlayhead(at)} className="absolute top-0 z-20 h-3 w-2 -translate-x-1/2 bg-[#8eb7d8] [clip-path:polygon(0_0,100%_0,50%_100%)]" style={{ left: `${(at/10)*100}%` }} />
                    ))}
                    {Object.entries(propertyKeyframes[layer.id] || {}).flatMap(([property,frames])=>frames.map(frame=><button key={`${property}-${frame.time}`} aria-label={`Keyframe ${property} em ${frame.time.toFixed(2)}s`} data-interpolation={frame.interpolation} onClick={()=>{setPlayhead(frame.time);setSelectedKeyframe({layerId:layer.id,property,time:frame.time})}} className={`absolute top-2 z-20 h-2 w-2 rotate-45 border ${selectedKeyframe?.layerId===layer.id&&selectedKeyframe?.property===property&&selectedKeyframe?.time===frame.time?'border-white bg-blue-300':'border-sky-200 bg-sky-500'}`} style={{left:`${(frame.time/10)*100}%`}} />))}
                    </>}
                  </div>
                  {expandedLayers.includes(layer.id) && <div className="ml-8 grid w-[292px] grid-cols-1 border-l border-[#444] bg-[#1b1b1b] py-1 pl-3 text-[9px] text-[#bbb]">{[["anchor","Ponto de ancoragem"],["position","Posição"],["scale","Escala"],["rotation","Rotação"],["opacity","Opacidade"]].map(([property,label])=><button key={property} aria-label={`${label} de ${layer.name}`} onClick={()=>{setSelectedLayer(layer.id);togglePropertyKeyframe(property==="position"?"x":property)}} className="flex items-center gap-2 py-0.5 text-left"><span className="text-slate-500"><EffectIcon name="stopwatch"/></span><span>{label}</span><span className="ml-auto pr-2 text-blue-400">{property==="position"?`${displayTransform.x}, ${displayTransform.y}`:property==="anchor"?"960, 540":displayTransform[property]??100}</span></button>)}</div>}
                </div>
              ))}
              {graphEditor && <div className="absolute bottom-0 right-0 top-7 overflow-hidden bg-[#151515]/95" style={{left:timelinePanelWidth}}>
                <div className="absolute inset-0 bg-[linear-gradient(#2b2b2b_1px,transparent_1px),linear-gradient(90deg,#2b2b2b_1px,transparent_1px)] bg-[size:100%_25%,10%_100%]" />
                <div className="absolute left-2 top-2 text-[9px] text-slate-500"><span className="block">100</span><span className="mt-8 block">80</span><span className="mt-8 block">60</span><span className="mt-8 block">40</span><span className="mt-8 block">20</span></div>
                <svg className="absolute inset-x-8 bottom-8 top-2 h-[calc(100%-40px)] w-[calc(100%-48px)]" viewBox="0 0 600 220" preserveAspectRatio="none" aria-label="Curva de velocidade dos quadros-chave">
                  <path d="M20 190 C 70 190, 72 28, 150 28 S 390 28, 580 28" fill="none" stroke="#e0c342" strokeWidth="2"/>
                  <path d="M20 190 L70 190 M150 28 L235 28" fill="none" stroke="#8e7f3c" strokeWidth="1"/>
                  <rect x="16" y="186" width="8" height="8" fill="#f1d75c"/><rect x="146" y="24" width="8" height="8" fill="#f1d75c"/>
                </svg>
                <div className="absolute bottom-1 left-2 right-2 flex gap-1 overflow-x-auto text-[9px]">
                  {["Valor","Velocidade","Selecionados","Zoom automático","Ajustar","Ajustar seleção","Separar dimensões","Manter","Linear","Bézier automático","Suavização"].map((label,index)=><button key={label} onClick={()=>({"Manter":"hold","Linear":"linear","Bézier automático":"auto-bezier","Suavização":"easy-ease"}[label]&&setKeyframeInterpolation({"Manter":"hold","Linear":"linear","Bézier automático":"auto-bezier","Suavização":"easy-ease"}[label]))} className={`shrink-0 rounded px-2 py-1 ${[0,2,3].includes(index)?'bg-[#2879c7] text-white':'bg-[#292929] text-[#bbb]'}`}>{label}</button>)}
                </div>
              </div>}
              {parentDrag && <svg aria-label="Linha de vínculo de camada" className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"><path d={`M ${parentDrag.x1} ${parentDrag.y1} C ${parentDrag.x1+55} ${parentDrag.y1}, ${parentDrag.x2-55} ${parentDrag.y2}, ${parentDrag.x2} ${parentDrag.y2}`} fill="none" stroke="#48a9ff" strokeWidth="2"/><circle cx={parentDrag.x2} cy={parentDrag.y2} r="4" fill="#48a9ff"/></svg>}
              <span
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-indigo-300"
                style={{
                  left: `calc(${timelinePanelWidth}px + (100% - ${timelinePanelWidth}px) * ${playhead / 10})`,
                }}
              >
                <i className="absolute -left-1 top-0 h-2 w-2 rotate-45 bg-indigo-300" />
              </span>
            </div>
            </> : <RenderQueuePanel composition={composition} setBottomPanel={setBottomPanel} />}
          </div>

        <aside className={`col-start-3 row-span-2 row-start-1 min-h-0 overflow-auto bg-[#202020] ${compactWorkspace ? "invisible" : ""}`}>
          <PanelTabs labels={["Pré-visualização", "Informações", "Áudio"]} active={rightTopPanel} onChange={setRightTopPanel} />
          {rightTopPanel === "Pré-visualização" ? <PreviewPanel playing={playing} setPlaying={setPlaying} /> : rightTopPanel === "Informações" ? <InfoPanel transform={displayTransform} /> : <AudioPanel />}
          <PanelTabs labels={["Propriedades", "Efeitos e predefinições"]} active={rightBottomPanel} onChange={setRightBottomPanel} />
          {rightBottomPanel === "Efeitos e predefinições" ? <EffectsBrowser search={search} setSearch={setSearch} visibleEffectGroups={visibleEffectGroups} openEffectGroups={openEffectGroups} setOpenEffectGroups={setOpenEffectGroups} setAppliedEffects={setAppliedEffects} setLeftPanel={setLeftPanel} /> : <>
          <div className="border-t border-slate-800 p-3">
            <div className="mb-3 flex items-center border-b border-slate-700 pb-2"><h3 className="text-xs font-bold">Propriedades: {activeLayer?.name}</h3><span className="ml-auto">☰</span></div>
            <h4 className="mb-2 text-[10px] font-semibold">Transformação da camada <button className="float-right text-indigo-300">Redefinir</button></h4>
            <div className="border-y border-[#353535] py-1">
              {Object.entries(displayTransform).map(([key, value]) => (
                <AePropertyRow
                  key={key}
                  propertyKey={key}
                  value={value}
                  playhead={playhead}
                  keyed={(propertyKeyframes[selectedLayer]?.[key]||[]).some(frame=>frame.time===Math.round(playhead*100)/100)}
                  onToggleKeyframe={()=>togglePropertyKeyframe(key)}
                  onChange={(next)=>changeTransform(key,next)}
                />
              ))}
            </div>
            <button
              onClick={() =>
                setTransform({
                  x: 960,
                  y: 540,
                  scale: 100,
                  rotation: 0,
                  opacity: 100,
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded border border-slate-700 p-2 text-[10px]"
            >
              <RotateCcw size={12} /> Restaurar
            </button>
          </div>
          <PropertiesExtras activeLayer={activeLayer} />
          <div className="border-t border-[#383838] p-3 text-[10px]">
            <div className="mb-3 flex items-center border-b border-[#383838] pb-2"><b>Alinhar</b><span className="ml-auto text-[#999]">☰</span></div>
            <label className="mb-2 flex items-center gap-2 text-[#aaa]">Alinhar camadas a:<select className="ml-auto rounded border border-[#444] bg-[#191919] px-2 py-1 text-white"><option>Composição</option><option>Seleção</option></select></label>
            <div className="grid grid-cols-6 gap-1">
              <button aria-label="Alinhar à esquerda" onClick={()=>changeTransform("x",0)} className="rounded bg-[#292929] py-2">▏←</button>
              <button aria-label="Centralizar horizontalmente" onClick={()=>changeTransform("x",960)} className="rounded bg-[#292929] py-2">↔</button>
              <button aria-label="Alinhar à direita" onClick={()=>changeTransform("x",1920)} className="rounded bg-[#292929] py-2">→▕</button>
              <button aria-label="Alinhar ao topo" onClick={()=>changeTransform("y",0)} className="rounded bg-[#292929] py-2">▔↑</button>
              <button aria-label="Centralizar verticalmente" onClick={()=>changeTransform("y",540)} className="rounded bg-[#292929] py-2">↕</button>
              <button aria-label="Alinhar à base" onClick={()=>changeTransform("y",1080)} className="rounded bg-[#292929] py-2">↓▁</button>
            </div>
          </div>
          <div className="border-t border-[#383838] p-3 text-[10px]">
            <div className="mb-2 flex items-center border-b border-[#383838] pb-2"><b>Áudio</b><span className="ml-auto text-[#999]">☰</span></div>
            <div className="grid grid-cols-[18px_18px_1fr] gap-2"><div className="relative h-28 bg-[#111]"><i className="absolute inset-x-1 bottom-0 h-[42%] bg-gradient-to-t from-emerald-500 via-yellow-400 to-red-500"/></div><div className="relative h-28 bg-[#111]"><i className="absolute inset-x-1 bottom-0 h-[36%] bg-gradient-to-t from-emerald-500 via-yellow-400 to-red-500"/></div><div className="flex flex-col justify-between text-[#777]"><span>0</span><span>-6</span><span>-12</span><span>-24</span><span>-48</span></div></div>
          </div>
          </>}
        </aside>
      </div>
    </section>
  );
}

function ParticlePreview() {
  const particles = Array.from({ length: 34 }, (_, index) => ({
    angle: (index * 137.5) * Math.PI / 180,
    radius: 24 + ((index * 31) % 150),
    length: 12 + (index % 5) * 5,
  }));
  return <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 360" aria-label="Prévia de partículas"><g transform="translate(320 180)">{particles.map((particle,index)=>{const x=Math.cos(particle.angle)*particle.radius;const y=Math.sin(particle.angle)*particle.radius;return <line key={index} x1={x} y1={y} x2={x+Math.cos(particle.angle)*particle.length} y2={y+Math.sin(particle.angle)*particle.length} stroke={index%3===0?'#ff6a00':index%3===1?'#ffd500':'#fff500'} strokeWidth="2"/>})}<circle r="8" fill="#fff600"/></g></svg>;
}

function ThreeDPreview() {
  return <div className="absolute inset-0 overflow-hidden [perspective:700px]">
    <div className="absolute inset-x-[10%] bottom-[8%] h-[58%] origin-bottom rotate-x-[65deg] bg-[linear-gradient(#29445c55_1px,transparent_1px),linear-gradient(90deg,#29445c55_1px,transparent_1px)] bg-[size:38px_38px]" />
    <div className="absolute left-[31%] top-[26%] h-[35%] w-[16%] -skew-y-6 bg-gradient-to-br from-cyan-400 to-blue-700 shadow-xl" />
    <div className="absolute left-[45%] top-[22%] h-[37%] w-[15%] skew-y-6 bg-gradient-to-br from-orange-400 to-rose-800 shadow-xl" />
    <strong className="absolute left-[39%] top-[45%] -rotate-6 text-4xl italic text-white drop-shadow-lg">CLASSIC 3D</strong>
    <span className="absolute bottom-[9%] left-1/2 -translate-x-1/2 text-[10px] tracking-[.35em] text-slate-200">CÂMERAS · LUZES · SOMBRAS · PROFUNDIDADE DE CAMPO</span>
  </div>;
}

function AePropertyRow({ propertyKey, value, playhead, keyed, onToggleKeyframe, onChange }) {
  const label = propertyKey === "scale" ? "Escala" : propertyKey === "rotation" ? "Rotação" : propertyKey === "opacity" ? "Opacidade" : propertyKey.toUpperCase();
  const min = propertyKey === "rotation" ? -180 : 0;
  const max = propertyKey === "x" ? 1920 : propertyKey === "y" ? 1080 : propertyKey === "scale" ? 400 : propertyKey === "rotation" ? 180 : 100;
  return <div className="group grid h-7 grid-cols-[18px_minmax(58px,1fr)_64px] items-center gap-1 px-1 text-[10px] hover:bg-[#2a2a2a]">
    <button type="button" aria-label={`Criar keyframe de ${propertyKey} em ${playhead.toFixed(2)}s`} aria-pressed={keyed} onClick={onToggleKeyframe} className={`grid place-items-center ${keyed?"text-blue-400":"text-[#888] hover:text-blue-300"}`}><EffectIcon name="stopwatch"/></button>
    <span className="capitalize text-[#c5c5c5]">{label}</span>
    <input aria-label={`Valor ${label} da camada`} type="number" value={value} onChange={(event)=>onChange(Number(event.target.value))} className="h-5 w-full border-0 border-b border-transparent bg-transparent px-1 text-right text-[#3ea6ff] outline-none hover:border-[#666] focus:border-[#3ea6ff]"/>
    <input aria-label={`${label} da camada`} type="range" min={min} max={max} value={value} onChange={(event)=>onChange(Number(event.target.value))} className="col-span-3 -mt-1 h-1 w-full accent-[#3b8edb]"/>
  </div>;
}

function EffectIcon({ name, size = 12 }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round" };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" {...common}>
    {name === "eye" && <><path d="M1.5 8 4 5l4-1.2L12 5l2.5 3-2.5 3L8 12.2 4 11Z"/><circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none"/></>}
    {name === "speaker" && <><path d="M2 6h3l4-3.5v11L5 10H2Z" fill="currentColor" stroke="none"/><path d="M10 5.5c1.3 1.4 1.3 3.6 0 5M11.7 3.8c2.3 2.4 2.3 6 0 8.4"/></>}
    {name === "solo" && <><circle cx="8" cy="8" r="4.5"/><circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none"/></>}
    {name === "lock" && <><rect x="3.5" y="7" width="9" height="7"/><path d="M5 7a3 3 0 0 1 6 0"/><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none"/></>}
    {name === "keyframe" && <path d="m8 2.5 5.5 5.5L8 13.5 2.5 8Z" fill="currentColor" stroke="none"/>}
    {name === "shy" && <><circle cx="8" cy="8" r="5.8"/><circle cx="6" cy="7" r=".8" fill="currentColor" stroke="none"/><circle cx="10" cy="7" r=".8" fill="currentColor" stroke="none"/><path d="M5.7 11c1.4-1 3.2-1 4.6 0"/></>}
    {name === "collapse" && <><circle cx="8" cy="8" r="2.8"/><path d="M8 1.7v2M8 12.3v2M1.7 8h2M12.3 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4"/></>}
    {name === "quality" && <path d="m4 2.5 8 11"/>}
    {name === "fx" && <><path d="M7 3H5.6L4.6 4.2V13M3 7h4M8.5 7l4.5 6M13 7l-4.5 6"/></>}
    {name === "frameBlend" && <><rect x="2" y="4" width="7" height="7"/><rect x="7" y="5" width="7" height="7"/></>}
    {name === "motionBlur" && <><circle cx="10.5" cy="8" r="3.5"/><circle cx="7" cy="8" r="3.5"/><circle cx="4" cy="8" r="3"/></>}
    {name === "adjustment" && <><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11a5.5 5.5 0 0 1 0-11Z" fill="currentColor" stroke="none"/></>}
    {name === "cube" && <><path d="m8 2 5.5 3v6L8 14l-5.5-3V5Z"/><path d="m2.5 5 5.5 3 5.5-3M8 8v6"/></>}
    {name === "pickWhip" && <><circle cx="8" cy="8" r="5.4"/><circle cx="8" cy="8" r="2.8"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><path d="m12 3 2 2-2.7.7"/></>}
    {name === "footage" && <><rect x="2" y="3" width="12" height="10"/><path d="M5.5 3v10M10.5 3v10"/><circle cx="3.8" cy="5" r=".6" fill="currentColor" stroke="none"/><circle cx="12.2" cy="5" r=".6" fill="currentColor" stroke="none"/><circle cx="3.8" cy="8" r=".6" fill="currentColor" stroke="none"/><circle cx="12.2" cy="8" r=".6" fill="currentColor" stroke="none"/></>}
    {name === "stopwatch" && <><circle cx="8" cy="9" r="4.5"/><path d="M8 4.5V2M6 2h4M11.5 5.5l1.3-1.3M8 9V6.2"/></>}
    {name === "chevronRight" && <path d="m6 3.5 4.5 4.5L6 12.5"/>}
    {name === "chevronDown" && <path d="m3.5 6 4.5 4.5L12.5 6"/>}
  </svg>;
}

function EffectControl({ effect, transform, onTransformChange, onRemove }) {
  const colorRange = [["Fuzziness","0"],["Color Space","Lab"],["Min (L, Y, R)","0"],["Max (L, Y, R)","255"],["Min (a, U, G)","0"],["Max (a, U, G)","100"],["Min (b, V, B)","128"],["Max (b, V, B)","255"]];
  const particles = [["Birth Rate","0.50"],["Longevity (sec)","1.00"],["Position X","0.00"],["Position Y","0.00"],["Position Z","0.00"],["Radius X","0.025"],["Radius Y","0.025"],["Radius Z","0.025"],["Animation","Explosive"],["Velocity","1.00"],["Inherit Velocity %","0.0"],["Gravity","0.500"],["Resistance","0.00"],["Extra","1.00"],["Extra Angle","360.0°"]];
  const fields = effect === "Color Range" ? colorRange : effect === "CC Particle World" ? particles : null;
  const [open, setOpen] = useState(true);
  const [values, setValues] = useGraphicDraftState(`effect:control:${effect}`, ()=>Object.fromEntries((fields||[]).map(([label,value])=>[label,value])));
  const rangeFor = (label) => {
    const normalized = label.toLowerCase();
    if (normalized.includes("angle") || normalized.includes("rotation")) return [-360, 360];
    if (["x", "y"].includes(normalized) || normalized.includes("position")) return [-1920, 1920];
    if (normalized.includes("max") || normalized.includes("min")) return [0, 255];
    if (normalized.includes("opacity") || normalized.includes("scale") || normalized.includes("strength")) return [0, normalized.includes("scale") ? 400 : 100];
    return [0, 10];
  };
  return <section className="mb-2 border-b border-[#3a3a3a] pb-2">
    <div className="flex h-7 items-center gap-1 bg-[#34476c] px-1">
      <button aria-label={`${open?"Recolher":"Expandir"} ${effect}`} aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="grid w-4 place-items-center text-[#ddd]"><EffectIcon name={open?"chevronDown":"chevronRight"}/></button><EffectIcon name="fx"/><b className="truncate">{effect}</b><button className="ml-auto text-[#bbb]">Redefinir</button><button aria-label={`Remover ${effect}`} onClick={onRemove} className="relative h-4 w-4 before:absolute before:left-1/2 before:top-0 before:h-4 before:w-px before:rotate-45 before:bg-current after:absolute after:left-1/2 after:top-0 after:h-4 after:w-px after:-rotate-45 after:bg-current"/>
    </div>
    {open && (fields ? <div className="py-1">{fields.map(([label,initial])=>{const value=values[label]??initial;const isChoice=label.includes("Space")||label==="Animation";const [min,max]=rangeFor(label);return <div key={label} className="group grid min-h-7 grid-cols-[18px_minmax(82px,1fr)_58px_64px] items-center gap-1 px-1 text-[10px] hover:bg-[#292929]"><span className="text-[#888]"><EffectIcon name="stopwatch"/></span><span className="truncate text-[#c6c6c6]">{label}</span>{isChoice?<select aria-label={`Valor de ${label}`} value={value} onChange={event=>setValues(old=>({...old,[label]:event.target.value}))} className="col-span-2 h-5 border border-[#444] bg-[#191919] px-1"><option>{value}</option></select>:<><input aria-label={`Valor de ${label}`} type="number" value={String(value).replace("°","")} step="any" onChange={event=>setValues(old=>({...old,[label]:event.target.value}))} className="h-5 border-0 bg-transparent px-1 text-right text-[#3ea6ff] outline-none hover:bg-[#171717]"/><input aria-label={`${label} deslizante`} type="range" min={min} max={max} step="any" value={String(value).replace("°","")} onChange={event=>setValues(old=>({...old,[label]:event.target.value}))} className="h-1 w-full accent-[#3b8edb]"/></>}</div>})}</div> : Object.entries(transform).map(([key,value])=>{const [min,max]=rangeFor(key);return <label key={key} className="grid h-7 grid-cols-[18px_1fr_58px_64px] items-center gap-1 px-1 capitalize hover:bg-[#292929]"><span className="text-[#888]"><EffectIcon name="stopwatch"/></span><span>{key}</span><input aria-label={`Valor de ${key} no efeito`} type="number" value={value} onChange={event=>onTransformChange(key,event.target.value)} className="h-5 border-0 bg-transparent px-1 text-right text-[#3ea6ff] outline-none"/><input aria-label={`${key} do efeito deslizante`} type="range" min={min} max={max} value={value} onChange={event=>onTransformChange(key,event.target.value)} className="h-1 w-full accent-[#3b8edb]"/></label>}))}
  </section>;
}

function EffectsBrowser({ search, setSearch, visibleEffectGroups, openEffectGroups, setOpenEffectGroups, setAppliedEffects, setLeftPanel }) {
  return <div className="p-3"><label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-2 py-1.5"><Search size={13}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Pesquisar efeitos e predefinições" className="min-w-0 flex-1 bg-transparent text-xs outline-none"/></label><div className="mt-2 space-y-1">{visibleEffectGroups.map(([group,effects])=>{const open=openEffectGroups.includes(group)||search;return <section key={group}><button onClick={()=>setOpenEffectGroups(old=>old.includes(group)?old.filter(item=>item!==group):[...old,group])} className="flex w-full items-center gap-2 px-1 py-1.5 text-left text-[10px] font-semibold hover:bg-slate-800"><span>{open?'⌄':'›'}</span><span className="text-amber-300">▱</span>{group}<span className="ml-auto text-slate-600">{effects.length}</span></button>{open&&<div className="ml-4 border-l border-slate-700 pl-2">{effects.map(effect=><button key={effect} onDoubleClick={()=>{setAppliedEffects(old=>old.includes(effect)?old:[...old,effect]);setLeftPanel('Controles de efeitos')}} className="block w-full rounded px-2 py-1.5 text-left text-[10px] hover:bg-indigo-500/20">fx&nbsp; {effect}</button>)}</div>}</section>})}</div><p className="mt-3 text-[9px] text-slate-500">Clique duas vezes para aplicar à camada selecionada.</p></div>;
}

function PreviewPanel({ playing, setPlaying }) {
  return <div className="p-3 text-[10px]"><div className="mb-4 flex items-center justify-center gap-5"><button>◀◀</button><button>◀</button><button onClick={()=>setPlaying(!playing)} className="grid h-8 w-8 place-items-center rounded hover:bg-slate-800">{playing?<Pause size={15}/>:<Play size={15}/>}</button><button>▶</button><button>▶▶</button></div><dl className="grid grid-cols-[110px_1fr] gap-y-2 text-slate-400"><dt>Atalho</dt><dd className="text-slate-200">Barra de espaço</dd><dt>Repetir</dt><dd><input type="checkbox" defaultChecked/></dd><dt>Intervalo</dt><dd className="text-slate-200">Área de trabalho</dd><dt>Reproduzir de</dt><dd className="text-slate-200">Tempo atual</dd><dt>Taxa de quadros</dt><dd className="text-slate-200">29,97</dd><dt>Resolução</dt><dd className="text-slate-200">Automática</dd></dl><div className="mt-4 h-1.5 overflow-hidden rounded bg-slate-900"><div className="h-full w-1/3 bg-emerald-500"/></div><p className="mt-2 text-slate-500">36 / 300 quadros em cache</p></div>;
}

function InfoPanel({ transform }) {
  return <div className="grid grid-cols-2 gap-2 p-3 text-[10px]">{Object.entries(transform).map(([key,value])=><div key={key} className="border-b border-slate-700 pb-2"><span className="block capitalize text-slate-500">{key}</span><b>{value}</b></div>)}</div>;
}

function AudioPanel() {
  return <div className="p-3 text-[10px]"><div className="mb-3 flex h-28 items-end gap-2">{[45,72,88,64,38,80,55,92,66,41].map((height,index)=><span key={index} className="flex-1 bg-gradient-to-t from-emerald-500 via-amber-400 to-red-500" style={{height:`${height}%`}}/>)}</div><div className="flex justify-between text-slate-500"><span>-48 dB</span><span>-12</span><span>0 dB</span></div></div>;
}

function PropertiesExtras({ activeLayer }) {
  if (activeLayer?.kind !== "T") return <div className="border-t border-slate-800 p-3 text-[10px]"><h4 className="mb-2 font-semibold">Opções da camada</h4><label className="flex gap-2"><input type="checkbox" defaultChecked/> Desfoque de movimento</label><label className="mt-2 flex gap-2"><input type="checkbox"/> Camada 3D</label></div>;
  return <div className="border-t border-slate-800 p-3 text-[10px]"><h4 className="mb-2 font-semibold">Texto</h4><select className="mb-2 w-full rounded border border-slate-700 bg-[#0d1015] p-2"><option>Inter</option><option>Source Sans 3</option></select><select className="mb-3 w-full rounded border border-slate-700 bg-[#0d1015] p-2"><option>Bold</option><option>Regular</option></select><div className="grid grid-cols-2 gap-2"><label>Tamanho<input defaultValue="148 px" className="mt-1 w-full rounded border border-slate-700 bg-[#0d1015] p-2"/></label><label>Entrelinha<input defaultValue="Auto" className="mt-1 w-full rounded border border-slate-700 bg-[#0d1015] p-2"/></label></div><h4 className="mb-2 mt-4 font-semibold">Parágrafo</h4><div className="flex justify-between">{['≡','≣','≡','☷','☰'].map((item,index)=><button key={index} className="h-8 w-8 rounded hover:bg-slate-800">{item}</button>)}</div><button className="mt-4 rounded border border-slate-700 px-3 py-2">+ Adicionar animador</button></div>;
}

function RenderQueuePanel({ composition, setBottomPanel }) {
  const [queued, setQueued] = useState(true);
  return <div className="flex h-[288px] flex-col text-[10px]"><div className="flex items-center gap-2 border-b border-slate-800 p-2"><button onClick={()=>setQueued(!queued)} className={`h-4 w-4 rounded border ${queued?'border-emerald-400 bg-emerald-500':'border-slate-600'}`}/><b>{composition}</b><span className="rounded bg-[#3d4655] px-2 py-0.5">Configuração pronta</span><button onClick={()=>setBottomPanel('Timeline')} className="ml-auto text-slate-400">Voltar à Timeline</button></div><div className="grid grid-cols-[140px_1fr] gap-y-2 p-4"><span className="text-slate-500">Configurações de renderização:</span><button className="text-left text-blue-400 underline">Melhores configurações</button><span className="text-slate-500">Módulo de saída:</span><button className="text-left text-blue-400 underline">Alta qualidade · H.264</button><span className="text-slate-500">Saída para:</span><button className="truncate text-left text-blue-400 underline">C:\Users\Alex\{composition}.mp4</button><span className="text-slate-500">Ação pós-renderização:</span><select className="w-48 rounded border border-slate-700 bg-[#0d1015] px-2 py-1"><option>Nenhuma</option><option>Importar</option><option>Importar e substituir uso</option></select></div><div className="mt-auto flex items-center border-t border-slate-800 p-3"><span className="text-amber-300">Renderizador do MMEffect ainda não conectado ao backend.</span><button disabled className="ml-auto rounded bg-[#2675df] px-5 py-2 font-semibold text-white opacity-40">Renderizar</button></div></div>;
}

function PanelTabs({ labels, active = labels[0], onChange }) {
  return (
    <div className="flex border-b border-slate-800">
      {labels.map((label) => (
        <button
          key={label}
          onClick={() => onChange?.(label)}
          aria-pressed={active === label}
          className={`flex-1 px-2 py-2 text-[10px] font-bold ${active === label ? "border-b-2 border-indigo-400 text-indigo-300" : "text-slate-500"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
