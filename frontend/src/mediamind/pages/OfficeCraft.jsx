import { useWorkDraftState, useWorkStorageKey } from "../lib/workProtection";
import { useEffect, useMemo, useState } from "react";
import { Bold, FilePlus2, Italic, LayoutTemplate, Plus, Redo2, Save, Underline, Undo2 } from "lucide-react";

const apps = ["WordCraft", "GridCraft", "DeckCraft"];
const columns = ["A", "B", "C", "D", "E", "F"];

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function WordCraft() {
  const storageKey = useWorkStorageKey("mm-office-word");
  const [document, setDocument] = useWorkDraftState("pages/OfficeCraft.jsx:document", () => readLocal(storageKey, "Título do documento\n\nComece a escrever aqui."));
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(document)), [document, storageKey]);
  const words = document.trim() ? document.trim().split(/\s+/).length : 0;
  return <div className="flex min-h-[680px] flex-col bg-[#e8e8e8] text-[#242424]">
    <div className="flex h-10 items-center gap-2 border-b border-[#c8c8c8] bg-white px-4"><button title="Desfazer"><Undo2 size={16}/></button><button title="Refazer"><Redo2 size={16}/></button><span className="mx-2 h-5 w-px bg-slate-300"/><button className="rounded bg-[#185abd] px-3 py-1 text-xs text-white"><Save size={14} className="mr-1 inline"/>Salvar</button><span className="ml-auto text-xs text-slate-500">Salvo neste dispositivo</span></div>
    <div className="border-b border-[#c8c8c8] bg-white"><div className="flex gap-6 px-5 pt-2 text-xs">{["Arquivo","Início","Inserir","Layout","Referências","Revisão","Exibir"].map((x,i)=><button key={x} className={i===1?"border-b-2 border-[#185abd] pb-2 text-[#185abd]":"pb-2"}>{x}</button>)}</div><div className="flex h-20 items-center gap-3 border-t px-5"><select aria-label="Fonte" className="h-8 w-40 border bg-white px-2 text-xs"><option>Aptos</option><option>Arial</option><option>Georgia</option></select><select aria-label="Tamanho da fonte" className="h-8 w-16 border bg-white px-2 text-xs"><option>11</option><option>14</option><option>18</option></select><span className="h-10 w-px bg-slate-300"/><button title="Negrito" className="p-2"><Bold size={17}/></button><button title="Itálico" className="p-2"><Italic size={17}/></button><button title="Sublinhado" className="p-2"><Underline size={17}/></button><span className="h-10 w-px bg-slate-300"/><button className="rounded border px-3 py-2 text-xs">Normal</button><button className="rounded border px-3 py-2 text-xs font-bold">Título 1</button></div></div>
    <div className="flex flex-1 justify-center overflow-auto p-8"><textarea aria-label="Documento WordCraft" value={document} onChange={(e)=>setDocument(e.target.value)} className="min-h-[700px] w-[720px] resize-none bg-white px-20 py-16 text-[15px] leading-7 shadow-xl outline-none"/></div>
    <div className="flex h-7 items-center bg-white px-4 text-[11px] text-slate-500"><span>Página 1 de 1</span><span className="ml-5">{words} palavras</span><span className="ml-auto">100%</span></div>
  </div>;
}

function GridCraft() {
  const storageKey = useWorkStorageKey("mm-office-grid");
  const [cells, setCells] = useWorkDraftState("pages/OfficeCraft.jsx:cells", () => readLocal(storageKey, {}));
  const [selected, setSelected] = useWorkDraftState("pages/OfficeCraft.jsx:selected", "A1");
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(cells)), [cells, storageKey]);
  const rows = useMemo(() => Array.from({length: 18}, (_,i)=>i+1), []);
  return <div className="min-h-[680px] bg-white text-[#202020]">
    <div className="flex h-10 items-center gap-3 bg-[#217346] px-4 text-xs text-white"><b>GridCraft</b><button><FilePlus2 size={15}/></button><button><Save size={15}/></button><span className="ml-auto">Pasta de trabalho local</span></div>
    <div className="border-b"><div className="flex gap-6 px-5 pt-2 text-xs">{["Arquivo","Página Inicial","Inserir","Layout da Página","Fórmulas","Dados","Revisão","Exibir"].map((x,i)=><button key={x} className={i===1?"border-b-2 border-[#217346] pb-2":"pb-2"}>{x}</button>)}</div><div className="flex h-16 items-center gap-2 border-t px-4"><button className="rounded border px-3 py-2 text-xs">Colar</button><button className="p-2"><Bold size={16}/></button><button className="p-2"><Italic size={16}/></button><button className="rounded border px-3 py-2 text-xs">Moeda</button><button className="rounded border px-3 py-2 text-xs">%</button></div></div>
    <div className="flex h-9 items-center border-b bg-[#fafafa] px-3 text-xs"><span className="w-16 font-semibold">{selected}</span><span className="mr-2 text-slate-400">ƒx</span><input aria-label="Barra de fórmulas" value={cells[selected]||""} onChange={(e)=>setCells({...cells,[selected]:e.target.value})} className="flex-1 border-l bg-transparent px-3 outline-none"/></div>
    <div className="overflow-auto"><table className="border-collapse text-xs"><thead><tr><th className="sticky left-0 h-7 w-10 border bg-[#f1f1f1]"/>{columns.map(c=><th key={c} className="h-7 min-w-36 border bg-[#f1f1f1] font-normal">{c}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row}><th className="sticky left-0 border bg-[#f1f1f1] font-normal">{row}</th>{columns.map(col=>{const key=`${col}${row}`;return <td key={key} className={`border ${selected===key?"outline outline-2 outline-[#217346]":""}`}><input aria-label={`Célula ${key}`} value={cells[key]||""} onFocus={()=>setSelected(key)} onChange={(e)=>setCells({...cells,[key]:e.target.value})} className="h-7 w-36 bg-transparent px-2 outline-none"/></td>;})}</tr>)}</tbody></table></div>
    <div className="flex h-8 items-center border-t bg-[#f4f4f4] px-3 text-xs"><button className="mr-3 text-lg">＋</button><button className="h-full border-b-2 border-[#217346] px-5">Planilha1</button></div>
  </div>;
}

function DeckCraft() {
  const storageKey = useWorkStorageKey("mm-office-deck");
  const [slides, setSlides] = useWorkDraftState("pages/OfficeCraft.jsx:slides", () => readLocal(storageKey, [{id:1,title:"Título da apresentação",body:"Clique para adicionar um subtítulo"}]));
  const [active, setActive] = useState(0);
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(slides)), [slides, storageKey]);
  const patch = (data) => setSlides(slides.map((s,i)=>i===active?{...s,...data}:s));
  const add = () => { setSlides([...slides,{id:Date.now(),title:"Novo slide",body:"Adicione seu conteúdo"}]); setActive(slides.length); };
  return <div className="flex min-h-[680px] flex-col bg-[#e9e9e9] text-[#252525]">
    <div className="flex h-10 items-center gap-3 bg-[#b7472a] px-4 text-xs text-white"><b>DeckCraft</b><button><Save size={15}/></button><span className="ml-auto">Apresentação local</span></div>
    <div className="border-b bg-white"><div className="flex gap-6 px-5 pt-2 text-xs">{["Arquivo","Início","Inserir","Design","Transições","Animações","Apresentação","Revisão","Exibir"].map((x,i)=><button key={x} className={i===1?"border-b-2 border-[#b7472a] pb-2":"pb-2"}>{x}</button>)}</div><div className="flex h-20 items-center gap-3 border-t px-4"><button aria-label="Novo slide" onClick={add} className="flex items-center gap-2 rounded border px-3 py-2 text-xs"><Plus size={16}/>Novo slide</button><button className="flex items-center gap-2 rounded border px-3 py-2 text-xs"><LayoutTemplate size={16}/>Layout</button><span className="h-10 w-px bg-slate-300"/><button><Bold size={17}/></button><button><Italic size={17}/></button></div></div>
    <div className="grid flex-1 grid-cols-[190px_1fr]"><aside className="overflow-auto border-r bg-white p-3">{slides.map((slide,i)=><button key={slide.id} aria-label={`Slide ${i+1}`} onClick={()=>setActive(i)} className={`mb-3 block w-full rounded p-2 text-left ${i===active?"bg-orange-100 outline outline-2 outline-[#b7472a]":""}`}><span className="mr-2 text-[10px]">{i+1}</span><span className="inline-flex aspect-video w-32 items-center justify-center border bg-white p-2 text-center text-[9px]">{slide.title}</span></button>)}</aside>
      <main className="flex items-center justify-center p-8"><div className="aspect-video w-full max-w-4xl bg-white p-20 shadow-xl"><input aria-label="Título do slide" value={slides[active]?.title||""} onChange={(e)=>patch({title:e.target.value})} className="w-full border border-dashed border-slate-300 p-4 text-center text-4xl font-semibold outline-none"/><textarea aria-label="Conteúdo do slide" value={slides[active]?.body||""} onChange={(e)=>patch({body:e.target.value})} className="mt-10 h-28 w-full resize-none border border-dashed border-slate-300 p-4 text-center text-xl outline-none"/></div></main></div>
    <div className="h-7 bg-white px-4 py-1 text-[11px] text-slate-500">Slide {active+1} de {slides.length}<span className="float-right">100%</span></div>
  </div>;
}

export default function OfficeCraft() {
  const [app, setApp] = useState("WordCraft");
  return <section className="overflow-hidden rounded-xl border border-slate-300 shadow-2xl"><header className="flex h-12 items-center bg-[#24262a] px-4 text-white"><b className="mr-8">Ferramentas Office</b><div role="tablist" aria-label="Aplicativos Office" className="flex h-full">{apps.map(name=><button key={name} role="tab" aria-selected={app===name} onClick={()=>setApp(name)} className={`px-6 text-sm ${app===name?"border-b-2 border-white bg-white/10":"text-slate-300"}`}>{name}</button>)}</div></header>{app==="WordCraft"?<WordCraft/>:app==="GridCraft"?<GridCraft/>:<DeckCraft/>}</section>;
}
