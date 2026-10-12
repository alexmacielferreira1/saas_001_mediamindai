import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useMemo, useRef, useState } from "react";
import {
  Circle,
  Crosshair,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Blend,
  Brush,
  ChevronDown,
  ChevronRight,
  History,
  Hexagon,
  Hand,
  Layers3,
  Lasso,
  Library,
  Lock,
  MousePointer2,
  MoveDiagonal2,
  MoreHorizontal,
  PenTool,
  Pipette,
  Plus,
  Save,
  ScanSearch,
  Square,
  Trash2,
  Type,
  Upload,
  RotateCcw,
  RotateCw,
  Scissors,
  Sparkles,
  Spline,
  TextCursorInput,
  WandSparkles,
  ZoomIn,
} from "lucide-react";

// VectorCraft 0.7.0: barra Basic, na mesma ordem e com os mesmos atalhos
// de crates/ui-egui/src/toolbar.rs. Cada entrada representa o primeiro item
// visível de um slot; as alternativas pertencem ao menu expansível do slot.
const TOOL_GROUPS = [
  {
    label: "Seleção",
    slots: [
      [["V", "Seleção", MousePointer2]],
      [["A", "Seleção direta", MousePointer2], [null, "Seleção de grupo", MousePointer2]],
      [["Q", "Laço", Lasso], ["Y", "Varinha mágica", WandSparkles]],
    ],
  },
  {
    label: "Formas",
    slots: [
      [
        ["M", "Retângulo", Square], [null, "Retângulo arredondado", Square],
        [null, "Estrela", Sparkles], ["\\", "Segmento de linha", Spline],
        [null, "Arco", Spline], [null, "Espiral", RotateCw],
        [null, "Grade retangular", Crosshair], [null, "Grade polar", Crosshair],
        [null, "Clarão", Sparkles],
      ],
      [["L", "Elipse", Circle]],
      [[null, "Polígono", Hexagon]],
      [["Shift+N", "Modelador", Sparkles]],
    ],
  },
  {
    label: "Desenhar",
    slots: [
      [["N", "Lápis", PenTool], [null, "Suavizar", Spline], [null, "Borracha de caminho", Eraser], [null, "Unir", Spline]],
      [
        ["Shift+E", "Borracha", Eraser], ["C", "Tesoura", Scissors], [null, "Faca", Scissors],
        [null, "Corte espelhado", Scissors], [null, "Corte em linha", Scissors], [null, "Corte retangular", Scissors],
      ],
      [["B", "Pincel", Brush], ["Shift+B", "Pincel de manchas", Brush]],
      [["P", "Caneta", PenTool], ["+", "Adicionar ponto de ancoragem", PenTool], ["-", "Excluir ponto de ancoragem", PenTool], ["Shift+C", "Ponto de ancoragem", PenTool]],
      [["Shift+~", "Curvatura", Spline]],
    ],
  },
  {
    label: "Modificar",
    slots: [
      [
        ["Shift+W", "Largura", MoveDiagonal2], ["Shift+R", "Deformar", Spline], [null, "Redemoinho", RotateCw],
        [null, "Contrair", MoveDiagonal2], [null, "Inflar", MoveDiagonal2], [null, "Recortar", Spline],
        [null, "Cristalizar", Sparkles], [null, "Enrugar", Spline],
      ],
      [
        ["R", "Girar", RotateCw], ["O", "Refletir", RotateCcw], ["S", "Escala", MoveDiagonal2],
        [null, "Inclinar", MoveDiagonal2], [null, "Remodelar", Spline], ["E", "Transformação livre", MoveDiagonal2],
        [null, "Distorção de marionete", MoveDiagonal2],
      ],
      [
        ["Shift+M", "Construtor de formas", Blend], ["K", "Balde de pintura ao vivo", Brush],
        ["Shift+L", "Seleção de pintura ao vivo", MousePointer2], ["W", "Mesclagem", Blend],
      ],
    ],
  },
  {
    label: "Texto",
    slots: [
      [[null, "Texto em área", TextCursorInput], [null, "Texto em um caminho", Type], [null, "Texto vertical em área", TextCursorInput], [null, "Texto vertical em um caminho", Type]],
      [["T", "Texto", Type], [null, "Texto vertical", Type], ["Shift+T", "Texto de toque", Type]],
    ],
  },
  {
    label: "Navegar",
    slots: [
      [["Z", "Zoom", ZoomIn]],
      [["H", "Mão", Hand], [null, "Divisão de impressão", Crosshair]],
      [["Shift+H", "Girar visualização", RotateCcw]],
    ],
  },
  {
    label: "Cor",
    slots: [
      [["G", "Gradiente", Crosshair], ["U", "Malha", Crosshair]],
      [["I", "Conta-gotas", Pipette], [null, "Medida", MoveDiagonal2]],
    ],
  },
];

function toolTitle(shortcut, name) {
  return shortcut ? `${name} (${shortcut})` : name;
}

const ICON_ROOT = "/vectorcraft-icons";

// Mesma ordem, agrupamento e iconografia da coluna de painéis do VectorCraft desktop.
const RIGHT_PANEL_TOOLS = [
  ["Cor", "palette"], ["Guia de cores", "dc-color-guide", true],
  ["Amostras", "swatch-book"], ["Pincéis", "paintbrush"], ["Símbolos", "spray-can"], ["Opções de padrão", "grid-3x3", true],
  ["Traçado", "dc-stroke"], ["Gradiente", "dc-gradient"], ["Transparência", "dc-transparency", true],
  ["Aparência", "dc-appearance"], ["Estilos gráficos", "dc-graphic-styles", true],
  ["Pranchetas", "dc-artboards", true],
  ["Transformar", "dc-transform-panel"], ["Alinhar", "dc-align"], ["Pathfinder", "dc-pathfinder", true],
  ["Texto", "type"], ["Parágrafo", "pilcrow", true],
  ["Histórico", "history"], ["Ações", "dc-actions"], ["Informações", "info"], ["Navegador", "map"],
];

function ReferenceIcon({ name, size = 20, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        mask: `url(${ICON_ROOT}/${name}.svg) center / contain no-repeat`,
        WebkitMask: `url(${ICON_ROOT}/${name}.svg) center / contain no-repeat`,
      }}
    />
  );
}

export default function VectorCraftWorkspace({
  assets,
  selected,
  onSelect,
  onOpenFiles,
}) {
  const [tool, setTool] = useGraphicDraftState("VectorCraftWorkspace.jsx:tool", "Seleção");
  const [slotTools, setSlotTools] = useGraphicDraftState("VectorCraftWorkspace.jsx:slotTools", {});
  const [openToolGroup, setOpenToolGroup] = useGraphicDraftState("VectorCraftWorkspace.jsx:openToolGroup", null);
  const [workspace, setWorkspace] = useGraphicDraftState("VectorCraftWorkspace.jsx:workspace", "Essenciais clássicos");
  const [rightPanel, setRightPanel] = useGraphicDraftState("VectorCraftWorkspace.jsx:rightPanel", "Propriedades");
  const [appearanceOpen, setAppearanceOpen] = useGraphicDraftState("VectorCraftWorkspace.jsx:appearanceOpen", true);
  const [zoom, setZoom] = useGraphicDraftState("VectorCraftWorkspace.jsx:zoom", 72);
  const [selectedObject, setSelectedObject] = useGraphicDraftState("VectorCraftWorkspace.jsx:selectedObject", "title");
  const [objects, setObjects] = useGraphicDraftState("VectorCraftWorkspace.jsx:objects", [
    {
      id: "title",
      name: "Título principal",
      kind: "Texto",
      text: "DESIGN\nVETORIAL",
      color: "#082f49",
      visible: true,
      locked: false,
      x: 112,
      y: 150,
      w: 390,
      h: 120,
    },
    {
      id: "circle",
      name: "Forma circular",
      kind: "Elipse",
      color: "#22d3ee",
      visible: true,
      locked: false,
      x: 530,
      y: 170,
      w: 185,
      h: 185,
    },
    {
      id: "wave",
      name: "Onda vetorial",
      kind: "Traçado",
      color: "#6366f1",
      visible: true,
      locked: false,
      x: 95,
      y: 390,
      w: 630,
      h: 150,
    },
    {
      id: "path-cyan",
      name: "<Traçado ciano>",
      kind: "Traçado",
      color: "#22d3ee",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 240, h: 80,
    },
    {
      id: "path-magenta",
      name: "<Traçado magenta>",
      kind: "Traçado",
      color: "#ec4899",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 240, h: 80,
    },
    {
      id: "radial-repeat",
      name: "<Repetição radial>",
      kind: "Repetição",
      color: "#f59e0b",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 180, h: 180,
    },
    {
      id: "gradient-mesh",
      name: "Malha de degradê",
      kind: "Malha",
      color: "#06b6d4",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 180, h: 180,
    },
    {
      id: "mesh-pink",
      name: "<Malha rosa>",
      kind: "Malha",
      color: "#f472b6",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 120, h: 120,
    },
    {
      id: "mesh-violet",
      name: "<Malha violeta>",
      kind: "Malha",
      color: "#8b5cf6",
      visible: true,
      locked: false,
      panelOnly: true,
      x: 0, y: 0, w: 120, h: 120,
    },
    {
      id: "background",
      name: "Fundo",
      kind: "Retângulo",
      color: "#f8fafc",
      visible: true,
      locked: true,
      x: 0,
      y: 0,
      w: 820,
      h: 620,
    },
  ]);
  const [fill, setFill] = useGraphicDraftState("VectorCraftWorkspace.jsx:fill", "#22d3ee");
  const [stroke, setStroke] = useGraphicDraftState("VectorCraftWorkspace.jsx:stroke", "#0f172a");
  const transformRef = useRef(null);
  const drawingRef = useRef(null);
  const active = objects.find((object) => object.id === selectedObject);
  const ordered = useMemo(() => [...objects].reverse(), [objects]);

  function addObject(kind) {
    const id = crypto.randomUUID();
    setObjects((old) => [
      {
        id,
        name: `${kind} ${old.length}`,
        kind,
        color: fill,
        visible: true,
        locked: false,
        x: 220,
        y: 220,
        w: 180,
        h: kind === "Texto" ? 60 : 140,
      },
      ...old,
    ]);
    setSelectedObject(id);
  }
  function insertObject(kind, x, y, w, h, drawingTool = null) {
    const id = crypto.randomUUID();
    const next = {
      id,
      name: `${kind} ${objects.length}`,
      kind,
      color: fill,
      stroke,
      strokeWidth: kind === "Traçado" ? 6 : 0,
      drawingTool,
      text: kind === "Texto" ? "TEXTO" : undefined,
      visible: true,
      locked: false,
      x,
      y,
      w,
      h,
    };
    setObjects((old) => [next, ...old]);
    setSelectedObject(id);
    return id;
  }
  function startDrawing(event) {
    const definitionByTool = {
      Retângulo: { kind: "Retângulo" },
      Elipse: { kind: "Elipse" },
      Polígono: { kind: "Forma" },
      Modelador: { kind: "Traçado", drawingTool: "Modelador" },
      Texto: { kind: "Texto" },
      "Texto em área": { kind: "Texto" },
      Caneta: { kind: "Traçado", drawingTool: "Caneta" },
      Pincel: { kind: "Traçado", drawingTool: "Pincel" },
      Lápis: { kind: "Traçado", drawingTool: "Lápis" },
      Curvatura: { kind: "Traçado", drawingTool: "Curvatura" },
    };
    const definition = definitionByTool[tool];
    if (!definition) return;
    const { kind, drawingTool } = definition;
    event.preventDefault();
    event.stopPropagation();
    const artboard = event.currentTarget.getBoundingClientRect();
    const scale = zoom / 100;
    const startX = Math.max(0, Math.min(820, (event.clientX - artboard.left) / scale));
    const startY = Math.max(0, Math.min(620, (event.clientY - artboard.top) / scale));
    const id = insertObject(
      kind,
      Math.round(startX),
      Math.round(startY),
      1,
      1,
      drawingTool,
    );
    drawingRef.current = { id, kind, startX, startY, moved: false };
    const onMove = (moveEvent) => {
      const drawing = drawingRef.current;
      if (!drawing) return;
      const currentX = Math.max(0, Math.min(820, (moveEvent.clientX - artboard.left) / scale));
      const currentY = Math.max(0, Math.min(620, (moveEvent.clientY - artboard.top) / scale));
      const width = Math.abs(currentX - drawing.startX);
      const height = Math.abs(currentY - drawing.startY);
      drawing.moved = width > 4 || height > 4;
      patchObjectValues(drawing.id, {
        x: Math.round(Math.min(drawing.startX, currentX)),
        y: Math.round(Math.min(drawing.startY, currentY)),
        w: Math.max(4, Math.round(width)),
        h: Math.max(4, Math.round(height)),
      });
    };
    const onUp = () => {
      const drawing = drawingRef.current;
      if (drawing && !drawing.moved) {
        patchObjectValues(drawing.id, {
          w: drawing.kind === "Traçado" ? 180 : drawing.kind === "Texto" ? 220 : 140,
          h: drawing.kind === "Traçado" ? 90 : drawing.kind === "Texto" ? 64 : 140,
        });
      }
      drawingRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  function toggle(id, key) {
    setObjects((old) =>
      old.map((object) =>
        object.id === id ? { ...object, [key]: !object[key] } : object,
      ),
    );
  }
  function patchObject(key, value) {
    setObjects((old) =>
      old.map((object) =>
        object.id === selectedObject ? { ...object, [key]: value } : object,
      ),
    );
  }
  function patchObjectValues(id, values) {
    setObjects((old) =>
      old.map((object) => (object.id === id ? { ...object, ...values } : object)),
    );
  }
  function startTransform(event, object, mode) {
    if (object.locked) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedObject(object.id);
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    const centerX = bounds ? bounds.left + bounds.width / 2 : event.clientX;
    const centerY = bounds ? bounds.top + bounds.height / 2 : event.clientY;
    transformRef.current = {
      id: object.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      object: { ...object },
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    };
    const onMove = (moveEvent) => {
      const transform = transformRef.current;
      if (!transform) return;
      const scale = zoom / 100;
      const dx = (moveEvent.clientX - transform.startX) / scale;
      const dy = (moveEvent.clientY - transform.startY) / scale;
      const source = transform.object;
      if (transform.mode === "move") {
        patchObjectValues(transform.id, {
          x: Math.round(source.x + dx),
          y: Math.round(source.y + dy),
        });
        return;
      }
      if (transform.mode === "rotate") {
        const angle = Math.atan2(
          moveEvent.clientY - transform.centerY,
          moveEvent.clientX - transform.centerX,
        );
        patchObjectValues(transform.id, {
          rotation: Math.round((source.rotation ?? 0) + ((angle - transform.startAngle) * 180) / Math.PI),
        });
        return;
      }
      const direction = transform.mode.replace("resize-", "");
      const next = { x: source.x, y: source.y, w: source.w, h: source.h };
      if (direction.includes("e")) next.w = Math.max(24, Math.round(source.w + dx));
      if (direction.includes("s")) next.h = Math.max(24, Math.round(source.h + dy));
      if (direction.includes("w")) {
        next.w = Math.max(24, Math.round(source.w - dx));
        next.x = Math.round(source.x + source.w - next.w);
      }
      if (direction.includes("n")) {
        next.h = Math.max(24, Math.round(source.h - dy));
        next.y = Math.round(source.y + source.h - next.h);
      }
      patchObjectValues(transform.id, next);
    };
    const onUp = () => {
      transformRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  function removeSelectedObject() {
    if (!selectedObject) return;
    setObjects((current) => {
      const remaining = current.filter((object) => object.id !== selectedObject);
      setSelectedObject(remaining[0]?.id ?? null);
      return remaining;
    });
  }

  function handleObjectPointerDown(event, object) {
    if (tool === "Borracha") {
      event.preventDefault();
      event.stopPropagation();
      if (!object.locked) {
        setObjects((current) => current.filter((item) => item.id !== object.id));
        setSelectedObject(null);
      }
      return;
    }
    if (["Seleção", "Seleção direta", "Laço"].includes(tool)) {
      startTransform(event, object, "move");
    }
  }

  return (
    <section className="space-y-2 bg-[#151515] text-slate-200">
      <header className="flex items-center gap-3 border-b border-slate-700 pb-2">
        <div>
          <h1 className="text-xl font-bold text-white">MMVector</h1>
          <p className="text-[10px] text-slate-500">
            Documento sem título · CMYK · 300 ppi
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="rounded border border-slate-700 px-3 py-2 text-xs">
            <Save size={14} className="mr-1 inline" />
            Salvar
          </button>
          <label className="cursor-pointer rounded border border-slate-700 px-3 py-2 text-xs">
            <Upload size={14} className="mr-1 inline" />
            Colocar
            <input
              hidden
              multiple
              type="file"
              accept="image/*,.svg,.pdf"
              onChange={(e) => onOpenFiles(e.target.files)}
            />
          </label>
          <button className="rounded bg-orange-400 px-3 py-2 text-xs font-bold text-slate-950">
            <Download size={14} className="mr-1 inline" />
            Exportar
          </button>
        </div>
      </header>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 pb-1 text-[11px]">
        {[
          "Arquivo",
          "Editar",
          "Objeto",
          "Texto",
          "Selecionar",
          "Efeito",
          "Exibir",
          "Janela",
          "Ajuda",
        ].map((item) => (
          <button
            key={item}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
          >
            {item}
          </button>
        ))}
        <span className="mx-auto" />
        <select
          aria-label="Área de trabalho do MMVector"
          value={workspace}
          onChange={(event) => setWorkspace(event.target.value)}
          className="rounded border border-slate-700 bg-[#202020] px-3 py-1 text-[10px] text-slate-300"
        >
          {[
            "Essenciais clássicos",
            "Essenciais",
            "Layout",
            "Pintura",
            "Tipografia",
            "Traçado",
            "Web",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="grid min-h-[720px] grid-cols-[56px_minmax(600px,1fr)_44px_330px] gap-px bg-[#111]">
        <aside className="flex max-h-[720px] flex-col items-center overflow-x-hidden overflow-y-auto rounded border border-slate-800 bg-[#303030] px-1 py-1">
          <button className="mb-1 w-full text-left text-lg text-slate-400" title="Recolher ferramentas">«</button>
          {TOOL_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 w-full">
              <p className="mb-1 w-full truncate text-center text-[9px] text-slate-300">{group.label}</p>
              <div className="grid grid-cols-1 gap-1">
                {group.slots.map((slot, slotIndex) => {
                  const slotKey = `${group.label}-${slotIndex}`;
                  const shown = slot.find(([, name]) => name === slotTools[slotKey]) ?? slot[0];
                  const [shortcut, name, Icon] = shown;
                  return (
                    <div key={slotKey} className="relative">
                      <button
                        aria-label={toolTitle(shortcut, name)}
                        title={toolTitle(shortcut, name)}
                        onClick={() => { setTool(name); setOpenToolGroup(null); }}
                        className={`grid h-8 w-full place-items-center rounded ${tool === name ? "bg-[#202020] text-white" : "text-slate-300 hover:bg-[#414141]"}`}
                      >
                        <Icon size={18} strokeWidth={1.7} />
                      </button>
                      {slot.length > 1 && (
                        <button
                          aria-label={`Abrir grupo de ${name}`}
                          title={`Outras ferramentas de ${name}`}
                          onClick={() => setOpenToolGroup((current) => current === slotKey ? null : slotKey)}
                          className="absolute bottom-0 right-0 z-10 h-3 w-3 border-b-[6px] border-l-[6px] border-b-slate-300 border-l-transparent"
                        />
                      )}
                      {openToolGroup === slotKey && (
                        <div className="mt-1 grid gap-1 border-y border-[#555] bg-[#242424] py-1" role="menu" aria-label={`Grupo de ${name}`}>
                          {slot.map(([optionShortcut, optionName, OptionIcon]) => (
                            <button
                              key={optionName}
                              aria-label={toolTitle(optionShortcut, optionName)}
                              title={toolTitle(optionShortcut, optionName)}
                              onClick={() => {
                                setSlotTools((current) => ({ ...current, [slotKey]: optionName }));
                                setTool(optionName);
                                setOpenToolGroup(null);
                              }}
                              className={`grid h-8 place-items-center rounded ${tool === optionName ? "bg-[#202020] text-white" : "text-slate-300 hover:bg-[#414141]"}`}
                            >
                              <OptionIcon size={17} strokeWidth={1.7} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <label title="Preenchimento e traçado" className="relative mb-3 h-10 w-10">
            <input
              type="color"
              value={fill}
              onChange={(e) => setFill(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer"
            />
            <span
              className="pointer-events-none absolute -bottom-1 -right-1 h-7 w-7 border-2 border-white"
              style={{ background: stroke }}
            />
          </label>
          <div className="mb-2 flex gap-1">
            <button title="Cor sólida" className="h-4 w-4 bg-white" />
            <button title="Gradiente" className="h-4 w-4 bg-gradient-to-r from-white to-black" />
            <button title="Sem cor" className="relative h-4 w-4 border border-white after:absolute after:left-1/2 after:top-[-2px] after:h-5 after:w-px after:-rotate-45 after:bg-red-500" />
          </div>
          <button title="Modos de desenho" className="mb-1 grid h-8 w-9 place-items-center rounded hover:bg-[#414141]">
            <ScanSearch size={18} />
          </button>
          <button title="Mais ferramentas" className="grid h-8 w-9 place-items-center rounded hover:bg-[#414141]">
            <MoreHorizontal size={20} />
          </button>
        </aside>
        <main className="flex min-w-0 flex-col rounded border border-slate-800 bg-[#2a2a2a]">
          <div className="flex items-center gap-3 border-b border-slate-700 px-3 py-2 text-[10px]">
            <b>{tool}</b>
            <span>X 0 px</span>
            <span>Y 0 px</span>
            <span>L 820 px</span>
            <span>A 620 px</span>
            <span className="ml-auto">Prancheta 1</span>
          </div>
          <div
            className="relative flex-1 overflow-auto p-12"
            onClick={() => setSelectedObject(null)}
          >
            <div
              className="relative mx-auto overflow-hidden bg-white shadow-2xl"
              aria-label="Prancheta vetorial"
              onPointerDownCapture={startDrawing}
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 820,
                height: 620,
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
            >
              {ordered.map(
                (object) =>
                  object.visible && !object.panelOnly && (
                    <button
                      key={object.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedObject(object.id);
                      }}
                      className={`absolute ${selectedObject === object.id ? "outline outline-2 outline-orange-400" : ""}`}
                      onPointerDown={(event) => handleObjectPointerDown(event, object)}
                      aria-label={`${object.name} na prancheta`}
                      style={{
                        left: object.x,
                        top: object.y,
                        width: object.w,
                        height: object.h,
                        opacity: (object.opacity ?? 100) / 100,
                        transform: `rotate(${object.rotation ?? 0}deg)`,
                        borderRadius:
                          object.kind === "Elipse"
                            ? "50%"
                            : object.cornerRadius ?? 0,
                        clipPath:
                          object.kind === "Forma"
                            ? "polygon(50% 0%, 100% 100%, 0% 100%)"
                            : undefined,
                        boxShadow:
                          object.kind !== "Traçado" && object.strokeWidth
                            ? `inset 0 0 0 ${object.strokeWidth}px ${object.stroke || stroke}`
                            : undefined,
                        background:
                          object.kind === "Traçado" || object.kind === "Texto"
                            ? "transparent"
                            : object.color,
                        color: object.kind === "Texto" ? object.color : "white",
                        zIndex:
                          object.kind === "Retângulo" &&
                          object.id === "background"
                            ? 0
                            : 2,
                      }}
                    >
                      {object.kind === "Texto" && (
                        <span className="block whitespace-pre-line text-left text-5xl font-black leading-none">
                          {object.text || object.name}
                        </span>
                      )}
                      {object.kind === "Traçado" && (
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                          <path
                            d={
                              object.drawingTool === "Caneta"
                                ? "M4 92 L34 18 L58 72 L96 8"
                                : object.drawingTool === "Lápis"
                                  ? "M2 70 L14 38 L25 76 L38 28 L51 67 L65 34 L79 73 L98 24"
                                  : object.drawingTool === "Pincel"
                                    ? "M2 76 C20 8 43 96 62 34 S85 82 98 18"
                                    : object.drawingTool === "Curvatura"
                                      ? "M2 82 C18 12 42 12 50 55 C59 96 82 92 98 18"
                                      : "M0 67 C19 0 38 100 57 30 S83 80 100 13"
                            }
                            fill="none"
                            stroke={object.stroke || object.color}
                            strokeWidth={object.drawingTool === "Pincel" ? 12 : object.strokeWidth || 6}
                            strokeLinecap={object.drawingTool === "Pincel" ? "round" : "butt"}
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                      )}
                      {selectedObject === object.id && (
                        <>
                          {[
                            ["nw", "-left-2 -top-2 cursor-nwse-resize"],
                            ["n", "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize"],
                            ["ne", "-right-2 -top-2 cursor-nesw-resize"],
                            ["e", "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize"],
                            ["se", "-bottom-2 -right-2 cursor-nwse-resize"],
                            ["s", "-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize"],
                            ["sw", "-bottom-2 -left-2 cursor-nesw-resize"],
                            ["w", "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize"],
                          ].map(([direction, position]) => (
                            <i
                              key={direction}
                              role="button"
                              tabIndex="0"
                              aria-label={`Redimensionar ${object.name} ${direction}`}
                              onPointerDown={(event) => startTransform(event, object, `resize-${direction}`)}
                              className={`absolute z-20 h-4 w-4 bg-white outline outline-2 outline-orange-400 ${position}`}
                            />
                          ))}
                          <span className="pointer-events-none absolute -top-9 left-1/2 h-7 w-px -translate-x-1/2 bg-orange-400" />
                          <i
                            role="button"
                            tabIndex="0"
                            aria-label={`Girar ${object.name}`}
                            onPointerDown={(event) => startTransform(event, object, "rotate")}
                            className="absolute -top-12 left-1/2 z-20 h-5 w-5 -translate-x-1/2 cursor-grab rounded-full border-2 border-orange-400 bg-white"
                          />
                        </>
                      )}
                    </button>
                  ),
              )}
            </div>
            {appearanceOpen && active && (
              <section
                aria-label="Aparência flutuante"
                className="absolute right-5 top-5 w-72 rounded border border-[#4b4b4b] bg-[#333] shadow-2xl"
              >
                <header className="flex items-center border-b border-[#4b4b4b] px-3 py-2 text-xs font-bold">
                  <span>Aparência</span>
                  <button
                    onClick={() => setAppearanceOpen(false)}
                    className="ml-auto text-slate-400"
                  >
                    ×
                  </button>
                </header>
                <div className="p-3 text-[10px]">
                  <div className="flex items-center gap-3 border-b border-[#4b4b4b] py-2">
                    <span
                      className="h-8 w-8 border border-slate-500"
                      style={{ background: active.color }}
                    />
                    <strong>{active.kind}</strong>
                  </div>
                  <div className="flex items-center gap-2 border-b border-[#4b4b4b] py-2">
                    <Eye size={13} />
                    <span>Preenchimento</span>
                    <input
                      aria-label="Cor da aparência"
                      type="color"
                      value={active.color}
                      onChange={(event) =>
                        patchObject("color", event.target.value)
                      }
                      className="ml-auto h-7 w-9"
                    />
                  </div>
                  <div className="flex items-center gap-2 border-b border-[#4b4b4b] py-2">
                    <Eye size={13} />
                    <ChevronDown size={12} />
                    <span>Brilho externo</span>
                    <b className="ml-auto italic">fx</b>
                  </div>
                  <label className="mt-2 grid grid-cols-[1fr_90px] items-center gap-2">
                    Desfoque{" "}
                    <input
                      type="number"
                      defaultValue="22"
                      className="bg-[#252525] p-1 text-right"
                    />
                  </label>
                  <label className="mt-2 grid grid-cols-[1fr_90px] items-center gap-2">
                    Modo{" "}
                    <select className="bg-[#252525] p-1">
                      <option>Tela</option>
                      <option>Normal</option>
                      <option>Multiplicação</option>
                    </select>
                  </label>
                  <label className="mt-2 grid grid-cols-[1fr_90px] items-center gap-2">
                    Opacidade{" "}
                    <input
                      type="number"
                      defaultValue="95"
                      className="bg-[#252525] p-1 text-right"
                    />
                  </label>
                </div>
              </section>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-slate-700 p-2 text-[10px]">
            <button
              onClick={() => setSelectedObject(null)}
              className="rounded border border-slate-700 px-2 py-1"
            >
              Prancheta 1
            </button>
            <button
              onClick={() => addObject("Prancheta")}
              className="rounded border border-slate-700 p-1"
            >
              <Plus size={13} />
            </button>
            <input
              type="range"
              min="25"
              max="150"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
              className="ml-auto accent-orange-400"
            />
            <span>{zoom}%</span>
          </div>
        </main>
        <nav
          aria-label="Painéis do MMVector"
          className="flex flex-col items-center gap-1 border border-slate-800 bg-[#242424] py-2"
        >
          {RIGHT_PANEL_TOOLS.map(([name, icon, divider]) => (
            <div key={name} className={divider ? "mb-1 border-b border-[#3b3b3b] pb-1" : ""}>
              <button
                title={name}
                aria-label={name}
                onClick={() => setRightPanel(name)}
                className={`grid h-9 w-9 place-items-center rounded ${rightPanel === name ? "bg-[#151515] text-[#dedede]" : "text-[#b8b8b8] hover:bg-[#383838] hover:text-white"}`}
              >
                <ReferenceIcon name={icon} size={20} />
              </button>
            </div>
          ))}
        </nav>
        <aside className="overflow-auto border border-slate-800 bg-[#303030]">
          <div className="flex border-b border-[#4b4b4b] bg-[#353535]">
            {["Propriedades", "Camadas", "Bibliotecas"].map((name) => (
              <button
                key={name}
                onClick={() => setRightPanel(name)}
                className={`flex-1 px-2 py-3 text-xs font-semibold ${rightPanel === name ? "bg-[#414141] text-white" : "text-slate-400"}`}
              >
                {name}
              </button>
            ))}
          </div>
          {rightPanel === "Camadas" ? (
            <LayersPanel
              objects={objects}
              selectedObject={selectedObject}
              setSelectedObject={setSelectedObject}
              toggle={toggle}
              addObject={addObject}
              removeSelectedObject={removeSelectedObject}
            />
          ) : rightPanel === "Bibliotecas" ? (
            <LibrariesPanel
              assets={assets}
              selected={selected}
              onSelect={onSelect}
            />
          ) : rightPanel === "Traçado" ? (
            <StrokePanel active={active} patchObject={patchObject} />
          ) : !["Propriedades", "Camadas", "Bibliotecas"].includes(rightPanel) ? (
            <AuxiliaryPanel name={rightPanel} />
          ) : active ? (
            <ObjectProperties
              active={active}
              fill={fill}
              stroke={stroke}
              setFill={setFill}
              setStroke={setStroke}
              patchObject={patchObject}
              addObject={addObject}
            />
          ) : (
            <DocumentProperties />
          )}
        </aside>
      </div>
    </section>
  );
}

function StrokePanel({ active, patchObject }) {
  const [dashed, setDashed] = useState(false);
  const [cap, setCap] = useState("butt");
  const [corner, setCorner] = useState("miter");
  const [alignment, setAlignment] = useState("centro");
  const [dashAlignment, setDashAlignment] = useState("corners");
  const [arrowLinked, setArrowLinked] = useState(true);
  const [arrowAlignment, setArrowAlignment] = useState("extend");
  return (
    <div className="p-3 text-[11px] text-[#d7d7d7]">
      <div className="mb-4 flex items-center border-b border-[#555] pb-3">
        <h3 className="text-sm font-semibold">Traçado</h3>
        <button className="ml-auto">☰</button><button className="ml-3">»</button>
      </div>
      <label className="mb-3 flex items-center gap-3">
        <span className="w-20 text-right">Peso:</span>
        <input type="number" min="0" step="0.25" value={active?.strokeWidth ?? 1} onChange={(event) => patchObject("strokeWidth", Number(event.target.value))} className="w-28 rounded border border-[#555] bg-[#383838] px-3 py-2" />
        <span>pt</span><ChevronDown size={14} />
      </label>
      <ControlChoices label="Extremidade:" value={cap} setValue={setCap} items={[["butt","dc-cap-butt","Extremidade reta"],["round","dc-cap-round","Extremidade redonda"],["square","dc-cap-square","Extremidade projetada"]]} />
      <div className="flex items-center gap-2">
        <ControlChoices label="Canto:" value={corner} setValue={setCorner} items={[["miter","dc-join-miter","Junção em esquadria"],["round","dc-join-round","Junção redonda"],["bevel","dc-join-bevel","Junção chanfrada"]]} />
        <label className="mb-3 flex items-center gap-1"><span>Limite:</span><input defaultValue="10" className="w-14 rounded border border-[#555] bg-[#383838] px-2 py-2" /><span>x</span></label>
      </div>
      <ControlChoices label="Alinhar traçado:" value={alignment} setValue={setAlignment} items={[["centro","dc-stroke-center","Alinhar traçado ao centro"],["dentro","dc-stroke-inside","Alinhar traçado para dentro"],["fora","dc-stroke-outside","Alinhar traçado para fora"]]} />
      <section className="mt-4 border-t border-[#555] pt-4">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={dashed} onChange={(event) => setDashed(event.target.checked)} /> Linha tracejada</label>
          <span className="ml-auto flex gap-1">
            {[['exact','dc-dash-exact','Comprimentos exatos'],['corners','dc-dash-align','Ajustar aos cantos e extremidades']].map(([key, icon, title]) => <button key={key} disabled={!dashed} title={title} onClick={() => setDashAlignment(key)} className={`grid h-7 w-7 place-items-center rounded disabled:opacity-25 ${dashAlignment === key ? 'bg-[#222] text-white' : 'text-[#aaa]'}`}><ReferenceIcon name={icon} size={18} /></button>)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1">
          {["Traço", "Lacuna", "Traço", "Lacuna", "Traço", "Lacuna"].map((label, index) => <label key={index} className="text-center text-[9px] text-slate-400"><input disabled={!dashed} defaultValue={index === 0 ? 12 : ""} className="mb-1 w-full rounded border border-[#555] bg-[#383838] p-2 disabled:opacity-30" />{label}</label>)}
        </div>
      </section>
      <section className="mt-4 border-t border-[#555] pt-4">
        <label className="mb-3 grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2"><span>Pontas de seta:</span><select className="bg-[#383838] p-2"><option>Nenhuma</option><option>Triângulo</option><option>Círculo</option><option>Losango</option></select><select className="bg-[#383838] p-2"><option>Nenhuma</option><option>Triângulo</option><option>Círculo</option><option>Losango</option></select><button title="Trocar pontas"><ReferenceIcon name="arrow-left-right" size={18} /></button></label>
        <label className="mb-3 grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2"><span>Escala:</span><input defaultValue="100%" className="min-w-0 bg-[#383838] p-2" /><input defaultValue="100%" className="min-w-0 bg-[#383838] p-2" /><button title="Vincular escalas" onClick={() => setArrowLinked(!arrowLinked)} className={arrowLinked ? 'text-white' : 'text-[#777]'}>↗</button></label>
        <ControlChoices label="Alinhar:" value={arrowAlignment} setValue={setArrowAlignment} items={[["extend","dc-arrow-extend","A ponta ultrapassa o ponto final"],["tip","dc-arrow-tip","Ponta sobre o ponto final"]]} />
        <label className="grid grid-cols-[90px_1fr_auto_auto] items-center gap-2"><span>Perfil:</span><select className="bg-[#383838] p-2"><option>Uniforme</option><option>Largura 1</option><option>Largura 2</option><option>Largura 3</option></select><button title="Inverter ao longo"><ReferenceIcon name="flip-horizontal-2" size={17} /></button><button title="Inverter transversalmente"><ReferenceIcon name="flip-vertical-2" size={17} /></button></label>
      </section>
    </div>
  );
}

function ControlChoices({ label, value, setValue, items }) {
  return <div className="mb-3 flex items-center gap-2"><span className="w-20 shrink-0 text-right">{label}</span>{items.map(([key, icon, title]) => <button key={key} onClick={() => setValue(key)} className={`grid h-8 w-8 place-items-center rounded ${value === key ? "bg-[#222] text-white" : "text-slate-400 hover:bg-[#444]"}`} title={title}><ReferenceIcon name={icon} size={20} /></button>)}</div>;
}

function AuxiliaryPanel({ name }) {
  const [mode, setMode] = useState("Normal");
  const [opacity, setOpacity] = useState(100);
  const [historyStep, setHistoryStep] = useState(3);
  const shell = (content) => <div className="p-3 text-[11px] text-[#d6d6d6]"><div className="mb-3 flex items-center border-b border-[#555] pb-3"><h3 className="text-sm font-semibold">{name}</h3><button className="ml-auto">☰</button><button className="ml-3">»</button></div>{content}</div>;
  const field = "rounded border border-[#555] bg-[#383838] px-2 py-2 outline-none";

  if (name === "Cor") return shell(<><div className="mb-3 h-28 rounded border border-[#555] bg-[linear-gradient(90deg,#fff0,#fff),linear-gradient(#f00,#000)]" /><div className="grid grid-cols-[1fr_70px] gap-2"><div className="space-y-2">{[["R",15],["G",47],["B",73]].map(([label, value]) => <label key={label} className="grid grid-cols-[18px_1fr_42px] items-center gap-2"><span>{label}</span><input type="range" defaultValue={value} className="accent-white"/><input defaultValue={value} className={field}/></label>)}</div><div className="rounded border border-[#666] bg-[#0f2f49]" /></div><label className="mt-3 flex items-center gap-2"><span className="w-8">#</span><input defaultValue="0F2F49" className={`${field} flex-1`} /></label></>);
  if (name === "Guia de cores") return shell(<><select className={`${field} mb-3 w-full`}><option>Regras de harmonia</option><option>Complementar</option><option>Análoga</option><option>Tríade</option></select><div className="grid grid-cols-5 gap-1">{["#082f49","#0e7490","#22d3ee","#f59e0b","#f97316"].map(color => <button key={color} title={color} className="h-12 border border-[#777]" style={{background:color}} />)}</div><button className="mt-3 w-full rounded border border-[#666] p-2">Salvar cores como amostras</button></>);
  if (name === "Amostras") return shell(<><input placeholder="Localizar" className={`${field} mb-3 w-full italic`} /><div className="grid grid-cols-7 gap-1">{["#000000","#ffffff","#ef4444","#f59e0b","#facc15","#22c55e","#06b6d4","#3b82f6","#6366f1","#a855f7","#ec4899","#78716c","#94a3b8","transparent"].map((color,index) => <button key={`${color}-${index}`} className="aspect-square border border-[#777]" style={{background:color === 'transparent' ? 'linear-gradient(135deg,#fff 45%,#e11d48 46%,#e11d48 54%,#fff 55%)' : color}} />)}</div><PanelFooter labels={["Bibliotecas","Grupo","Nova amostra","Excluir"]}/></>);
  if (name === "Pincéis" || name === "Símbolos" || name === "Estilos gráficos") return shell(<><div className="grid grid-cols-4 gap-2">{Array.from({length:12},(_,index)=><button key={index} className="grid aspect-square place-items-center rounded border border-[#5a5a5a] bg-[#414141] text-xl">{name === 'Pincéis' ? ['╱','〰','≈','⌁'][index%4] : name === 'Símbolos' ? ['◆','✦','●','✿'][index%4] : ['A','B','C','D'][index%4]}</button>)}</div><PanelFooter labels={["Biblioteca","Novo","Opções","Excluir"]}/></>);
  if (name === "Opções de padrão") return shell(<><label className="mb-3 grid gap-1">Nome<input defaultValue="Novo padrão" className={field}/></label><label className="mb-3 grid gap-1">Tipo de bloco<select className={field}><option>Grade</option><option>Tijolo por linha</option><option>Hexagonal</option></select></label><div className="grid grid-cols-2 gap-2"><label>Largura<input defaultValue="100 px" className={`${field} mt-1 w-full`}/></label><label>Altura<input defaultValue="100 px" className={`${field} mt-1 w-full`}/></label></div><label className="mt-3 flex gap-2"><input type="checkbox"/> Dimensionar bloco à arte</label><label className="mt-2 flex gap-2"><input type="checkbox" defaultChecked/> Mover bloco com arte</label></>);
  if (name === "Gradiente") return shell(<><div className="mb-3 flex gap-2"><button className="rounded bg-[#222] px-3 py-2">Linear</button><button className="rounded px-3 py-2 hover:bg-[#444]">Radial</button><button className="rounded px-3 py-2 hover:bg-[#444]">Forma livre</button></div><div className="h-9 rounded border border-[#666] bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500"/><div className="mt-1 flex justify-between"><button>▼</button><button>▼</button><button>▼</button></div><div className="mt-4 grid grid-cols-2 gap-2"><label>Ângulo<input defaultValue="0°" className={`${field} mt-1 w-full`}/></label><label>Proporção<input defaultValue="100%" className={`${field} mt-1 w-full`}/></label><label>Opacidade<input defaultValue="100%" className={`${field} mt-1 w-full`}/></label><label>Local<input defaultValue="0%" className={`${field} mt-1 w-full`}/></label></div></>);
  if (name === "Transparência") return shell(<><div className="grid grid-cols-[1fr_90px] gap-2"><select value={mode} onChange={event=>setMode(event.target.value)} className={field}>{["Normal","Multiplicação","Tela","Sobrepor","Luz suave","Diferença"].map(item=><option key={item}>{item}</option>)}</select><label className={`${field} flex items-center gap-1`}><input value={opacity} onChange={event=>setOpacity(event.target.value)} className="min-w-0 flex-1 bg-transparent"/>%</label></div><div className="my-4 grid grid-cols-2 gap-2"><div className="grid h-20 place-items-center border border-[#555]">Miniatura</div><div className="grid h-20 place-items-center border border-[#555]">Máscara</div></div><div className="grid grid-cols-2 gap-2"><button className="rounded border border-[#666] p-2">Criar máscara</button><button className="rounded border border-[#666] p-2">Liberar</button></div><label className="mt-3 flex gap-2"><input type="checkbox"/> Recortar</label><label className="mt-2 flex gap-2"><input type="checkbox"/> Inverter máscara</label></>);
  if (name === "Aparência") return shell(<><p className="mb-3 font-semibold">{`Texto`}</p>{[["Preenchimento","#082f49"],["Traçado","#0f172a"],["Opacidade","100%"]].map(([label,value])=><button key={label} className="flex w-full items-center gap-3 border-b border-[#555] py-3 text-left"><Eye size={14}/><span className="h-6 w-6 border border-[#777]" style={{background:value.startsWith('#')?value:'transparent'}}/><span>{label}</span><span className="ml-auto text-[#aaa]">{value}</span></button>)}<PanelFooter labels={["Novo preenchimento","Novo traçado","fx","Limpar"]}/></>);
  if (name === "Pranchetas") return shell(<><div className="space-y-1">{["Prancheta 1","Prancheta 2"].map((item,index)=><button key={item} className={`flex w-full items-center gap-2 border px-3 py-2 text-left ${index===0?'border-[#58a6ff] bg-[#43566b]':'border-[#555]'}`}><span>{index+1}</span><span>{item}</span><span className="ml-auto">☐</span></button>)}</div><PanelFooter labels={["Reorganizar","Nova","Excluir"]}/></>);
  if (name === "Transformar") return shell(<><div className="grid grid-cols-2 gap-2">{[["X","112 pt"],["Y","150 pt"],["L","390 pt"],["A","120 pt"],["Rotação","0°"],["Inclinação","0°"]].map(([label,value])=><label key={label} className="grid grid-cols-[auto_1fr] items-center gap-2"><span>{label}:</span><input defaultValue={value} className={field}/></label>)}</div><label className="mt-4 flex gap-2"><input type="checkbox" defaultChecked/> Transformar objetos</label><label className="mt-2 flex gap-2"><input type="checkbox" defaultChecked/> Transformar padrões</label><button className="mt-4 w-full rounded border border-[#666] p-2">Transformar cada...</button></>);
  if (name === "Alinhar") return shell(<><PanelIconGrid names={["dc-al-left","dc-al-hcenter","dc-al-right","dc-al-top","dc-al-vcenter","dc-al-bottom"]}/><h4 className="mb-2 mt-5 font-semibold">Distribuir objetos</h4><PanelIconGrid names={["dc-dist-left","dc-dist-hcenter","dc-dist-right","dc-dist-top","dc-dist-vcenter","dc-dist-bottom"]}/><label className="mt-5 grid gap-1">Alinhar a:<select className={field}><option>Alinhar à seleção</option><option>Alinhar à prancheta</option><option>Alinhar ao objeto-chave</option></select></label></>);
  if (name === "Pathfinder") return shell(<><h4 className="mb-2 font-semibold">Modos de forma</h4><PanelIconGrid names={["dc-pf-unite","dc-pf-minus-front","dc-pf-intersect","dc-pf-exclude"]}/><button className="mt-3 rounded border border-[#666] px-3 py-2">Expandir</button><h4 className="mb-2 mt-5 font-semibold">Pathfinders</h4><PanelIconGrid names={["dc-pf-divide","dc-pf-trim","dc-pf-merge","dc-pf-crop","dc-pf-outline","dc-pf-minus-back"]}/></>);
  if (name === "Texto") return shell(<><label className="grid gap-1">Família da fonte<select className={field}><option>Source Sans 3</option><option>Inter</option><option>Arial</option></select></label><label className="mt-2 grid gap-1">Estilo<select className={field}><option>Regular</option><option>Semibold</option><option>Bold</option></select></label><div className="mt-3 grid grid-cols-2 gap-2">{[["Tamanho","132 pt"],["Entrelinha","158,4 pt"],["Kerning","Automático"],["Tracking","60"],["Escala H","100%"],["Escala V","100%"]].map(([label,value])=><label key={label}>{label}<input defaultValue={value} className={`${field} mt-1 w-full`}/></label>)}</div></>);
  if (name === "Parágrafo") return shell(<><div className="mb-4 flex justify-between">{["≡","≣","≡","☷","☰","☷"].map((icon,index)=><button key={index} className="grid h-8 w-8 place-items-center rounded hover:bg-[#444]">{icon}</button>)}</div>{["Recuo esquerdo","Recuo direito","Primeira linha","Espaço antes","Espaço depois"].map(label=><label key={label} className="mb-2 grid grid-cols-[1fr_90px] items-center gap-2"><span>{label}</span><input defaultValue="0 pt" className={field}/></label>)}<label className="mt-3 flex gap-2"><input type="checkbox" defaultChecked/> Hifenizar</label></>);
  if (name === "Histórico") return shell(<><div className="space-y-1">{["Abrir documento","Selecionar objeto","Mover","Alterar preenchimento","Aplicar traçado","Editar gradiente"].map((item,index)=><button key={item} onClick={()=>setHistoryStep(index)} className={`flex w-full items-center gap-2 px-2 py-2 text-left ${index===historyStep?'bg-[#43566b]':''}`}><ReferenceIcon name="history" size={14}/>{item}</button>)}</div><PanelFooter labels={["Novo instantâneo","Excluir histórico"]}/></>);
  if (name === "Ações") return shell(<><div className="space-y-1">{["Ações padrão","Salvar para Web","Redimensionar","Converter em CMYK"].map((item,index)=><button key={item} className="flex w-full items-center gap-2 border-b border-[#555] px-2 py-2 text-left"><span>{index===0?'⌄':'▷'}</span>{item}</button>)}</div><PanelFooter labels={["Parar","Gravar","Executar","Nova ação","Excluir"]}/></>);
  if (name === "Informações") return shell(<div className="grid grid-cols-2 gap-x-5 gap-y-3">{[["X","112 pt"],["Y","150 pt"],["L","390 pt"],["A","120 pt"],["R","8"],["G","47"],["B","73"],["Opacidade","100%"]].map(([label,value])=><div key={label} className="flex justify-between border-b border-[#555] pb-1"><span className="text-[#aaa]">{label}</span><strong>{value}</strong></div>)}</div>);
  if (name === "Navegador") return shell(<><div className="relative aspect-[4/3] overflow-hidden border border-[#666] bg-white"><div className="absolute inset-[18%] bg-gradient-to-br from-cyan-400 to-violet-600"/><div className="absolute inset-[12%] border-2 border-red-500"/></div><div className="mt-3 flex items-center gap-2"><button>−</button><input type="range" defaultValue="72" className="flex-1"/><button>+</button><input defaultValue="72%" className={`${field} w-16`}/></div></>);
  return shell(<p className="text-[#aaa]">Painel disponível na área de trabalho.</p>);
}

function PanelFooter({ labels }) {
  return <div className="mt-5 flex items-center justify-end gap-1 border-t border-[#555] pt-3">{labels.map(label=><button key={label} title={label} className="grid h-8 min-w-8 place-items-center rounded border border-[#555] px-2 hover:bg-[#444]">{label.length > 2 ? label.slice(0,2) : label}</button>)}</div>;
}

function PanelIconGrid({ names }) {
  return <div className="grid grid-cols-6 gap-2">{names.map(name=><button key={name} title={name} className="grid h-9 place-items-center rounded border border-transparent text-[#bbb] hover:border-[#666] hover:bg-[#444] hover:text-white"><ReferenceIcon name={name} size={22}/></button>)}</div>;
}

function ObjectProperties({ active, fill, stroke, setFill, setStroke, patchObject, addObject }) {
  const fields = [
    ["X", "x", active.x], ["L", "w", active.w],
    ["Y", "y", active.y], ["A", "h", active.h],
  ];

  return (
    <div className="p-4 text-[11px]">
      <p className="mb-4 text-slate-400">{active.kind}</p>
      <div className="mb-4 grid grid-cols-3 gap-2" aria-label="Adicionar elemento">
        <button onClick={() => addObject("Texto")} className="rounded border border-[#666] px-2 py-2">+ Texto</button>
        <button onClick={() => addObject("Retângulo")} className="rounded border border-[#666] px-2 py-2">+ Retângulo</button>
        <button onClick={() => addObject("Elipse")} className="rounded border border-[#666] px-2 py-2">+ Elipse</button>
      </div>
      <h3 className="mb-3 text-sm font-semibold">Transformar</h3>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([label, key, value]) => (
          <label key={key} className="flex items-center rounded border border-[#555] bg-[#383838] px-2 py-2">
            <span className="text-slate-400">{label}:</span>
            <input aria-label={label} value={value} onChange={(event) => patchObject(key, Number(event.target.value))} className="min-w-0 flex-1 bg-transparent text-right outline-none" />
            <span className="ml-1 text-slate-400">pt</span>
          </label>
        ))}
      </div>
      {active.kind === "Texto" && (
        <label className="mt-3 grid gap-1">
          Conteúdo do texto
          <textarea
            aria-label="Conteúdo do texto"
            value={active.text || ""}
            onChange={(event) => patchObject("text", event.target.value)}
            rows="3"
            className="resize-y rounded border border-[#555] bg-[#383838] px-3 py-2"
          />
        </label>
      )}
      <div className="mt-2 flex items-center gap-2">
        <label className="flex flex-1 items-center rounded border border-[#555] bg-[#383838] px-2 py-2">
          <RotateCcw size={13} className="mr-2" />
          <input aria-label="Rotação" value={active.rotation ?? 0} onChange={(event) => patchObject("rotation", Number(event.target.value))} className="w-full bg-transparent outline-none" />°
        </label>
        <button title="Inverter verticalmente" className="rounded px-3 py-2 hover:bg-[#444]">↕</button>
        <button title="Inverter horizontalmente" className="rounded px-3 py-2 hover:bg-[#444]">↔</button>
      </div>
      {(active.kind === "Retângulo" || active.kind === "Forma") && (
        <label className="mt-3 flex items-center gap-3">
          <span>Raio dos cantos:</span>
          <input
            aria-label="Raio dos cantos"
            type="number"
            min="0"
            value={active.cornerRadius ?? 0}
            onChange={(event) => patchObject("cornerRadius", Number(event.target.value))}
            className="w-24 rounded border border-[#555] bg-[#383838] px-3 py-2"
          />
          <span>pt</span>
        </label>
      )}

      <PropertySection title="Aparência">
        <label className="mb-3 flex items-center gap-3">
          <input type="color" value={active.color || fill} onChange={(event) => { setFill(event.target.value); patchObject("color", event.target.value); }} />
          <span className="mr-auto">Preenchimento</span>
          <ChevronDown size={14} />
        </label>
        <label className="mb-2 flex items-center gap-3">
          <input type="color" value={active.stroke || stroke} onChange={(event) => { setStroke(event.target.value); patchObject("stroke", event.target.value); }} />
          <span className="underline">Traçado</span>
          <span className="ml-auto flex flex-col border border-[#555] text-[8px]"><button className="px-1">▲</button><button className="border-t border-[#555] px-1">▼</button></span>
          <input aria-label="Espessura do traçado" type="number" min="0" value={active.strokeWidth ?? 0} onChange={(event) => patchObject("strokeWidth", Number(event.target.value))} className="w-14 rounded border border-[#555] bg-[#383838] px-2 py-1" />
          <span>pt</span>
          <ChevronDown size={14} />
        </label>
        <label className="flex items-center gap-3">
          <span>Opacidade</span>
          <input aria-label="Opacidade" type="number" min="0" max="100" value={active.opacity ?? 100} onChange={(event) => patchObject("opacity", Number(event.target.value))} className="ml-auto w-20 rounded border border-[#555] bg-[#383838] px-2 py-1" />%
          <button title="Mais opções">•••</button>
        </label>
        <button className="mt-3 rounded border border-[#666] px-4 py-2 text-base">fx</button>
      </PropertySection>

      <PropertySection title="Alinhar">
        <div className="flex justify-between text-lg text-slate-300">
          {["⊢", "↔", "⊣", "⊤", "↕", "⊥"].map((symbol, index) => <button key={index} title="Alinhar" className="rounded px-2 py-1 hover:bg-[#444]">{symbol}</button>)}
        </div>
      </PropertySection>

      <PropertySection title="Ações rápidas">
        <div className="grid grid-cols-2 gap-2">
          {[
            active.kind === "Retângulo" || active.kind === "Forma" ? "Expandir forma" : "Expandir objeto",
            "Recolorir",
            "Deslocar caminho",
            "Simplificar",
            "Organizar: trazer para frente",
          ].map((action) => <button key={action} className="truncate rounded border border-[#666] px-2 py-2" title={action}>{action}</button>)}
          <button onClick={() => patchObject("locked", !active.locked)} className="rounded border border-[#666] py-2">{active.locked ? "Desbloquear" : "Bloquear"}</button>
        </div>
      </PropertySection>
    </div>
  );
}

function DocumentProperties() {
  const [units, setUnits] = useState("Pixels");
  const [snapPoint, setSnapPoint] = useState(true);
  const [snapGrid, setSnapGrid] = useState(false);
  const [scaleEffects, setScaleEffects] = useState(true);

  return (
    <div className="p-4 text-[11px]">
      <p className="mb-4 text-slate-400">Documento</p>
      <h3 className="mb-3 text-sm font-semibold">Documento</h3>
      <label className="mb-3 flex items-center gap-3 text-slate-300">
        <span className="w-16">Unidades</span>
        <select value={units} onChange={(event) => setUnits(event.target.value)} className="flex-1 rounded border border-[#555] bg-[#3b3b3b] px-3 py-2">
          <option>Pixels</option>
          <option>Pontos</option>
          <option>Milímetros</option>
          <option>Centímetros</option>
          <option>Polegadas</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button className="rounded border border-[#666] py-2">Configurar documento</button>
        <button className="rounded border border-[#666] py-2">Editar pranchetas</button>
      </div>

      <PropertySection title="Réguas e grades">
        <div className="flex gap-3">
          <button title="Réguas" className="rounded bg-[#282828] px-3 py-2 text-base">⌑</button>
          <button title="Grade" className="rounded bg-[#282828] px-3 py-2 text-base">▦</button>
          <button title="Limites" className="rounded bg-[#282828] px-3 py-2 text-base">▧</button>
        </div>
      </PropertySection>

      <PropertySection title="Guias">
        <div className="flex gap-3">
          <button className="rounded bg-[#252525] px-3 py-2 text-base">▦</button>
          <button className="rounded bg-[#252525] px-3 py-2 text-base">✧</button>
        </div>
      </PropertySection>

      <PropertySection title="Opções de encaixe">
        <label className="mb-2 flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={snapPoint} onChange={(event) => setSnapPoint(event.target.checked)} />
          Encaixar no ponto
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={snapGrid} onChange={(event) => setSnapGrid(event.target.checked)} />
          Encaixar na grade
        </label>
      </PropertySection>

      <PropertySection title="Preferências">
        <label className="mb-3 flex items-center justify-between gap-3">
          Incremento do teclado
          <input aria-label="Incremento do teclado" defaultValue="1 px" className="w-24 rounded border border-[#555] bg-[#3b3b3b] px-3 py-2" />
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={scaleEffects} onChange={(event) => setScaleEffects(event.target.checked)} />
          Dimensionar traçados e efeitos
        </label>
      </PropertySection>

      <PropertySection title="Ações rápidas">
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded border border-[#666] py-2">Configurar documento</button>
          <button className="rounded border border-[#666] py-2">Preferências</button>
        </div>
      </PropertySection>
    </div>
  );
}

function PropertySection({ title, children }) {
  return (
    <section className="mt-5 border-t border-[#494949] pt-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function LayersPanel({
  objects,
  selectedObject,
  setSelectedObject,
  toggle,
  addObject,
  removeSelectedObject,
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [groupExpanded, setGroupExpanded] = useState(true);
  const filteredObjects = objects.filter((object) =>
    `${object.name} ${object.kind}`.toLowerCase().includes(query.toLowerCase()),
  );
  const groupedIds = new Set(["circle", "wave", "path-cyan", "path-magenta"]);
  const groupChildren = filteredObjects.filter((object) => groupedIds.has(object.id));
  const rootObjects = filteredObjects.filter((object) => !groupedIds.has(object.id));

  return (
    <div className="text-[10px]">
      <input
        aria-label="Pesquisar camadas"
        placeholder="Pesquisar tudo"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="m-3 w-[calc(100%-24px)] border border-[#555] bg-[#252525] px-3 py-2 outline-none focus:border-orange-400"
      />
      <div className="flex items-center gap-2 border-y border-[#555] bg-[#49627a] px-2 py-2 text-white">
        <Eye size={13} />
        <button
          aria-label={expanded ? "Recolher Camada 1" : "Expandir Camada 1"}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <span className="h-5 w-5 border border-slate-300 bg-gradient-to-br from-fuchsia-500 to-cyan-400" />
        <strong>Camada 1</strong>
        <span className="ml-auto h-3 w-3 rounded-full border border-white" />
      </div>
      {expanded && (
        <>
          {rootObjects.slice(0, 1).map((object) => (
            <LayerRow key={object.id} object={object} depth={1} {...{ selectedObject, setSelectedObject, toggle }} />
          ))}
          {(groupChildren.length > 0 || !query) && (
            <>
              <div className="flex items-center gap-2 border-b border-[#454545] py-2 pl-8 pr-2 hover:bg-[#3b3b3b]">
                <Eye size={13} />
                <button aria-label={groupExpanded ? "Recolher Grupo de recorte" : "Expandir Grupo de recorte"} onClick={() => setGroupExpanded((value) => !value)}>
                  {groupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <span className="h-6 w-6 border border-slate-500 bg-gradient-to-br from-cyan-400 via-fuchsia-400 to-indigo-500" />
                <span className="min-w-0 flex-1 truncate">&lt;Grupo de recorte&gt;</span>
                <span className="h-3 w-3 rounded-full border border-slate-300" />
              </div>
              {groupExpanded && groupChildren.map((object) => (
                <LayerRow key={object.id} object={object} depth={2} {...{ selectedObject, setSelectedObject, toggle }} />
              ))}
            </>
          )}
          {rootObjects.slice(1).map((object) => (
            <LayerRow key={object.id} object={object} depth={1} {...{ selectedObject, setSelectedObject, toggle }} />
          ))}
        </>
      )}
      <footer className="mt-auto flex items-center gap-3 border-t border-[#555] p-3">
        <span className="mr-auto text-slate-400">1 camada</span>
        <button title="Localizar objeto">⌕</button>
        <button title="Nova subcamada">▦</button>
        <button onClick={() => addObject("Forma")} title="Novo objeto">
          <Plus size={14} />
        </button>
        <button onClick={() => addObject("Camada")} title="Nova camada">
          <Layers3 size={14} />
        </button>
        <button
          onClick={removeSelectedObject}
          disabled={!selectedObject}
          title="Excluir objeto selecionado"
          className="disabled:opacity-30"
        >
          <Trash2 size={14} />
        </button>
      </footer>
    </div>
  );
}

function LayerRow({ object, depth, selectedObject, setSelectedObject, toggle }) {
  return (
    <div
      onClick={() => setSelectedObject(object.id)}
      className={`flex cursor-default items-center gap-2 border-b border-[#454545] py-2 pr-2 ${selectedObject === object.id ? "bg-[#506b84] text-white" : "hover:bg-[#3b3b3b]"}`}
      style={{ paddingLeft: `${20 + depth * 14}px` }}
    >
      <button aria-label={`${object.visible ? "Ocultar" : "Mostrar"} ${object.name}`} onClick={(event) => { event.stopPropagation(); toggle(object.id, "visible"); }}>
        {object.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <ChevronRight size={12} className="text-slate-400" />
      <span className="h-6 w-6 shrink-0 border border-slate-500" style={{ background: object.color }} />
      <span className="min-w-0 flex-1 truncate">{object.name}</span>
      <button aria-label={`${object.locked ? "Desbloquear" : "Bloquear"} ${object.name}`} onClick={(event) => { event.stopPropagation(); toggle(object.id, "locked"); }} className={object.locked ? "text-amber-300" : "text-transparent hover:text-slate-400"}>
        <Lock size={12} />
      </button>
      <span className={`h-3 w-3 rounded-full border ${selectedObject === object.id ? "border-orange-300 bg-orange-300" : "border-slate-300"}`} />
    </div>
  );
}

function LibrariesPanel({ assets, selected, onSelect }) {
  return (
    <div className="p-3 text-[10px]">
      <input
        aria-label="Pesquisar bibliotecas"
        placeholder="Pesquisar bibliotecas"
        className="mb-3 w-full border border-[#555] bg-[#252525] px-3 py-2"
      />
      <h3 className="mb-2 font-bold">MM Library</h3>
      {assets.length ? (
        assets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={`mb-1 flex w-full items-center gap-2 border p-2 text-left ${selected?.id === asset.id ? "border-orange-400" : "border-[#555]"}`}
          >
            <span className="h-7 w-7 bg-[#222]" />
            <span className="truncate">{asset.name}</span>
          </button>
        ))
      ) : (
        <p className="border border-dashed border-[#555] p-5 text-center text-slate-400">
          Importe ativos ou abra a MM Library.
        </p>
      )}
    </div>
  );
}
