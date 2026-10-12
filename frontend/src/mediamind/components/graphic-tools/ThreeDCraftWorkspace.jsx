import { useGraphicDraftState } from "../../lib/graphicDrafts";
import { useMemo, useRef, useState } from "react";
import { Box, Camera, Circle, Copy, Cuboid, Eye, EyeOff, Grid3X3, Move3D, Play, Rotate3D, Scale3D, Square, Sun, Trash2, Video } from "lucide-react";

const seed = [
  { id: "camera", name: "Câmera", type: "camera", x: 36, y: 28, z: 8, rotate: 0, scale: 100, color: "#71a7ff", visible: true },
  { id: "cube", name: "Cubo", type: "cube", x: 52, y: 48, z: 0, rotate: -12, scale: 100, color: "#7c5cff", visible: true },
  { id: "light", name: "Luz principal", type: "light", x: 68, y: 22, z: 12, rotate: 0, scale: 100, color: "#ffd76a", visible: true },
];

const objectIcons = { camera: Camera, cube: Cuboid, sphere: Circle, plane: Square, light: Sun };

function interpolate(frames, time, fallback) {
  if (!frames?.length) return fallback;
  const ordered = [...frames].sort((a, b) => a.time - b.time);
  if (time <= ordered[0].time) return ordered[0].value;
  if (time >= ordered.at(-1).time) return ordered.at(-1).value;
  const rightIndex = ordered.findIndex((frame) => frame.time >= time);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  return left.value + ((right.value - left.value) * (time - left.time)) / (right.time - left.time);
}

export default function ThreeDCraftWorkspace() {
  const [objects, setObjects] = useGraphicDraftState("ThreeDCraftWorkspace.jsx:objects", seed);
  const [selectedId, setSelectedId] = useGraphicDraftState("ThreeDCraftWorkspace.jsx:selectedId", "cube");
  const [tool, setTool] = useGraphicDraftState("ThreeDCraftWorkspace.jsx:tool", "move");
  const [time, setTime] = useGraphicDraftState("ThreeDCraftWorkspace.jsx:time", 0);
  const [playing, setPlaying] = useState(false);
  const [world, setWorld] = useGraphicDraftState("ThreeDCraftWorkspace.jsx:world", { exposure: 1, grid: true, aspect: "16:9", background: "#111526" });
  const [keyframes, setKeyframes] = useGraphicDraftState("ThreeDCraftWorkspace.jsx:keyframes", {});
  const gesture = useRef(null);
  const selected = useMemo(() => objects.find((item) => item.id === selectedId), [objects, selectedId]);
  const displayedSelected = useMemo(() => {
    if (!selected) return null;
    const frames = keyframes[selected.id] || {};
    return Object.fromEntries(Object.entries(selected).map(([key, value]) => [key, typeof value === "number" ? interpolate(frames[key], time, value) : value]));
  }, [keyframes, selected, time]);
  const displayedObjects = useMemo(() => objects.map((object) => {
    const frames = keyframes[object.id] || {};
    return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, typeof value === "number" ? interpolate(frames[key], time, value) : value]));
  }), [keyframes, objects, time]);

  function update(key, value) {
    const numericValue = Number(value);
    setObjects((current) => current.map((item) => item.id === selectedId ? { ...item, [key]: numericValue } : item));
    setKeyframes((current) => {
      const objectFrames = current[selectedId] || {};
      const frames = objectFrames[key] || [];
      if (!frames.length) return current;
      const next = frames.some((frame) => frame.time === time)
        ? frames.map((frame) => frame.time === time ? { ...frame, value: numericValue } : frame)
        : [...frames, { time, value: numericValue }];
      return { ...current, [selectedId]: { ...objectFrames, [key]: next } };
    });
  }
  function toggleAnimation(key) {
    if (!selected) return;
    setKeyframes((current) => {
      const objectFrames = current[selected.id] || {};
      const frames = objectFrames[key] || [];
      const next = frames.some((frame) => frame.time === time)
        ? frames.filter((frame) => frame.time !== time)
        : [...frames, { time, value: displayedSelected[key] }];
      return { ...current, [selected.id]: { ...objectFrames, [key]: next } };
    });
  }
  function add(type) {
    const number = objects.filter((item) => item.type === type).length + 1;
    const id = `${type}-${crypto.randomUUID()}`;
    const labels = { cube: "Cubo", sphere: "Esfera", plane: "Plano", camera: "Câmera", light: "Luz" };
    setObjects((current) => [...current, { id, name: `${labels[type]} ${number}`, type, x: 50, y: 50, z: 0, rotate: 0, scale: 100, color: type === "cube" ? "#34d399" : "#38bdf8", visible: true }]);
    setSelectedId(id);
  }
  function duplicate() {
    if (!selected) return;
    const copy = { ...selected, id: crypto.randomUUID(), name: `${selected.name} cópia`, x: selected.x + 4, y: selected.y + 4 };
    setObjects((current) => [...current, copy]);
    setSelectedId(copy.id);
  }
  function remove() {
    if (!selected) return;
    setObjects((current) => current.filter((item) => item.id !== selected.id));
    setSelectedId(objects.find((item) => item.id !== selected.id)?.id || "");
  }
  function toggleVisibility(id) {
    setObjects((current) => current.map((item) => item.id === id ? { ...item, visible: !item.visible } : item));
  }
  function beginTransform(event, object) {
    event.stopPropagation();
    setSelectedId(object.id);
    gesture.current = { id: object.id, tool, startX: event.clientX, startY: event.clientY, object: { ...object } };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveTransform(event) {
    const active = gesture.current;
    if (!active) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    setObjects((current) => current.map((item) => {
      if (item.id !== active.id) return item;
      if (active.tool === "move") return { ...item, x: active.object.x + dx / 5, y: active.object.y + dy / 4 };
      if (active.tool === "rotate") return { ...item, rotate: active.object.rotate + dx };
      return { ...item, scale: Math.max(10, active.object.scale + dx) };
    }));
  }
  function togglePlayback() {
    setPlaying((value) => !value);
    setTime((value) => value >= 10 ? 0 : Math.min(10, value + 1));
  }

  return (
    <div className="overflow-hidden border border-[#333] bg-[#181818] text-[12px] text-[#c8c8c8]" aria-label="Editor MM3D">
      <div className="flex h-10 items-center justify-between border-b border-[#343434] bg-[#202020] px-3">
        <div className="flex items-center gap-5"><h2 className="text-sm font-semibold text-white">MM3D</h2><span>Arquivo</span><span>Outliner</span><span>Atalhos</span></div>
        <div className="flex items-center gap-2"><button className="rounded bg-[#303030] px-3 py-1">Construir</button><button className="rounded bg-red-600 px-3 py-1 text-white"><Video size={13} className="mr-1 inline" />Gravar</button></div>
      </div>
      <div className="grid min-h-[650px] grid-cols-[52px_220px_minmax(0,1fr)_250px]">
        <aside className="border-r border-[#343434] bg-[#202020] py-2" aria-label="Ferramentas 3D">
          {[{ id: "move", icon: Move3D, label: "Mover" }, { id: "rotate", icon: Rotate3D, label: "Rotacionar" }, { id: "scale", icon: Scale3D, label: "Escalar" }].map(({ id, icon: Icon, label }) => <button key={id} title={label} aria-pressed={tool === id} onClick={() => setTool(id)} className={`mx-2 mb-2 grid h-9 w-9 place-items-center rounded ${tool === id ? "bg-blue-600 text-white" : "hover:bg-[#343434]"}`}><Icon size={17} /></button>)}
          <div className="my-2 border-t border-[#343434]" />
          <button title="Adicionar cubo" onClick={() => add("cube")} className="mx-2 mb-2 grid h-9 w-9 place-items-center rounded hover:bg-[#343434]"><Cuboid size={17} /></button>
          <button title="Adicionar esfera" onClick={() => add("sphere")} className="mx-2 grid h-9 w-9 place-items-center rounded hover:bg-[#343434]"><Circle size={17} /></button>
          <button title="Adicionar plano" onClick={() => add("plane")} className="mx-2 mt-2 grid h-9 w-9 place-items-center rounded hover:bg-[#343434]"><Square size={17} /></button>
          <button title="Adicionar câmera" onClick={() => add("camera")} className="mx-2 mt-2 grid h-9 w-9 place-items-center rounded hover:bg-[#343434]"><Camera size={17} /></button>
          <button title="Adicionar luz" onClick={() => add("light")} className="mx-2 mt-2 grid h-9 w-9 place-items-center rounded hover:bg-[#343434]"><Sun size={17} /></button>
        </aside>
        <aside className="border-r border-[#343434] bg-[#1d1d1d]">
          <div className="border-b border-[#343434] px-3 py-3 font-semibold text-white">Cena</div>
          <div className="px-2 py-2">
            {objects.map((object) => { const Icon = objectIcons[object.type] || Box; return <div key={object.id} className={`mb-0.5 flex items-center rounded ${selectedId === object.id ? "bg-blue-600/30 text-white" : "hover:bg-[#292929]"}`}><button onClick={() => setSelectedId(object.id)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"><Icon size={14} style={{ color: object.color }} /><span className="truncate">{object.name}</span></button><button aria-label={`${object.visible ? "Ocultar" : "Mostrar"} ${object.name}`} onClick={()=>toggleVisibility(object.id)} className="p-2 text-[#aaa]">{object.visible ? <Eye size={13}/> : <EyeOff size={13}/>}</button></div>; })}
          </div>
          <div className="mt-auto flex border-t border-[#343434] p-2"><button aria-label="Duplicar objeto" onClick={duplicate} className="grid h-8 flex-1 place-items-center hover:bg-[#303030]"><Copy size={14}/></button><button aria-label="Excluir objeto" onClick={remove} className="grid h-8 flex-1 place-items-center hover:bg-[#303030]"><Trash2 size={14}/></button></div>
        </aside>
        <main className="relative min-w-0 bg-[#090a0e]" aria-label="Viewport 3D" style={{ perspective: "900px" }}>
          <div className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between border-b border-[#303030] bg-[#1e1e1e] px-3"><span>Viewport</span><div className="flex gap-2"><button onClick={() => setWorld((value) => ({ ...value, grid: !value.grid }))} className="rounded bg-[#2c2c2c] px-2 py-1"><Grid3X3 size={13} className="mr-1 inline" />Grade</button><select aria-label="Proporção do viewport" value={world.aspect} onChange={(event) => setWorld((value) => ({ ...value, aspect: event.target.value }))} className="rounded border border-[#444] bg-[#242424] px-2"><option>16:9</option><option>1:1</option><option>9:16</option></select></div></div>
          <div className="absolute inset-0 top-10 overflow-hidden" style={{ background: `radial-gradient(circle at 50% 35%, ${world.background}, #06070b 72%)`, filter: `brightness(${world.exposure})` }}>
            {world.grid && <div className="absolute bottom-[-28%] left-[-15%] h-[75%] w-[130%] origin-center rotate-x-[62deg] opacity-50" style={{ backgroundImage: "linear-gradient(#39405a 1px, transparent 1px), linear-gradient(90deg, #39405a 1px, transparent 1px)", backgroundSize: "44px 44px", transform: "rotateX(62deg)" }} />}
            {displayedObjects.filter((object) => object.visible && !["camera", "light"].includes(object.type)).map((object) => <button aria-label={`Objeto ${object.name}`} key={object.id} onPointerDown={(event)=>beginTransform(event,object)} onPointerMove={moveTransform} onPointerUp={()=>{gesture.current=null}} className={`absolute grid place-items-center border transition-shadow ${object.type === "sphere" ? "rounded-full" : object.type === "plane" ? "h-8 rounded-none" : "rounded-lg"} ${selectedId === object.id ? "border-sky-300 shadow-[0_0_0_2px_#38bdf866,0_15px_40px_#000]" : "border-white/20 shadow-xl"}`} style={{ left: `${object.x}%`, top: `${object.y}%`, width: `${Math.max(48, object.scale * .72)}px`, height: object.type === "plane" ? `${Math.max(20, object.scale * .25)}px` : `${Math.max(48, object.scale * .72)}px`, transform: `translate(-50%, -50%) translateZ(${object.z}px) rotate(${object.rotate}deg)`, background: `linear-gradient(135deg, ${object.color}, #191338)` }}><Box size={22} className="text-white/70" /></button>)}
            <div className="absolute bottom-5 left-5 rounded bg-black/60 px-2 py-1">Perspectiva · {tool === "move" ? "Mover" : tool === "rotate" ? "Rotacionar" : "Escalar"}</div>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 border-t border-[#343434] bg-[#1d1d1d] p-2">
            <div className="flex items-center gap-3"><button aria-label="Reproduzir timeline 3D" aria-pressed={playing} onClick={togglePlayback} className="grid h-7 w-7 place-items-center rounded bg-blue-600 text-white"><Play size={13} /></button><span className="font-mono text-blue-400">0:00:{String(Math.round(time)).padStart(2, "0")}</span><input aria-label="Timeline 3D" className="flex-1 accent-blue-500" type="range" min="0" max="10" step="0.1" value={time} onChange={(event) => setTime(Number(event.target.value))} /><span>0:10</span></div>
          </div>
        </main>
        <aside className="border-l border-[#343434] bg-[#202020]">
          <div className="border-b border-[#343434] px-3 py-3 font-semibold text-white">Propriedades</div>
          {selected && <div className="space-y-4 p-3"><div><p className="mb-2 font-semibold text-white">Transformar · {selected.name}</p>{[["x", "X"], ["y", "Y"], ["z", "Z"], ["rotate", "Rotação"], ["scale", "Escala"]].map(([key, label]) => <div key={key} className="mb-2 grid grid-cols-[64px_1fr_24px] items-center gap-2"><span>{label}</span><input aria-label={`${label} de ${selected.name}`} type="number" value={displayedSelected[key]} onChange={(event) => update(key, event.target.value)} className="rounded border border-[#454545] bg-[#151515] px-2 py-1 text-blue-300" /><button aria-label={`Animar ${label} de ${selected.name}`} aria-pressed={Boolean(keyframes[selected.id]?.[key]?.length)} onClick={()=>toggleAnimation(key)} className={`text-base ${keyframes[selected.id]?.[key]?.length ? "text-amber-400" : "text-[#777]"}`}>◆</button></div>)}<p className="text-[10px] text-amber-300">{Object.values(keyframes[selected.id] || {}).reduce((total, frames) => Math.max(total, frames.length), 0)} quadros-chave</p></div><div className="border-t border-[#343434] pt-3"><p className="mb-2 font-semibold text-white">Material</p><label className="flex items-center justify-between">Cor base<input aria-label={`Cor de ${selected.name}`} type="color" value={selected.color} onChange={(event)=>setObjects((current)=>current.map((item)=>item.id===selected.id?{...item,color:event.target.value}:item))}/></label></div><div className="border-t border-[#343434] pt-3"><p className="mb-2 font-semibold text-white">Mundo</p><label className="mb-2 block">Exposição · {world.exposure.toFixed(1)}<input aria-label="Exposição do mundo" type="range" min="0" max="2" step="0.1" value={world.exposure} onChange={(event) => setWorld((value) => ({ ...value, exposure: Number(event.target.value) }))} className="mt-1 w-full accent-blue-500" /></label><label className="flex items-center justify-between">Fundo<input aria-label="Cor de fundo do mundo" type="color" value={world.background} onChange={(event) => setWorld((value) => ({ ...value, background: event.target.value }))} /></label></div></div>}
        </aside>
      </div>
    </div>
  );
}
