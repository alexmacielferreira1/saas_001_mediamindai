import { useWorkDraftState } from "../../lib/workProtection";
import { useEffect, useState } from "react";
import { Box, Film, Image, Library, Plus, Sparkles, Upload, WandSparkles, Workflow } from "lucide-react";
import { generateImage, getImageGenerationStatus } from "../../../api/generation";

const configs = {
  "image-generator": { title: "Criar imagem", action: "Gerar imagem", icon: Image, placeholder: "Uma fotografia cinematográfica de...", models: ["Flux Pro", "Nano Studio", "Imagen"], resolutions: ["1K", "2K", "4K"] },
  "video-generator": { title: "Criar vídeo", action: "Gerar vídeo", icon: Film, placeholder: "Uma câmera atravessa lentamente...", models: ["Motion 2", "Kling", "Veo"], resolutions: ["720p", "1080p", "4K"], video: true },
  "object-generator": { title: "Criar objeto 3D", action: "Gerar objeto 3D", icon: Box, placeholder: "Uma cadeira modernista em madeira...", models: ["Hunyuan 3D", "Mesh Studio"], resolutions: ["Rápida", "Detalhada", "Produção"], object: true },
  "world-generator": { title: "Criar mundo 3D", action: "Gerar mundo 3D", icon: Workflow, placeholder: "Uma cidade futurista chuvosa ao anoitecer...", models: ["Marble", "World Studio"], resolutions: ["Prévia", "Navegável", "Alta fidelidade"], world: true },
};

export default function GenerativeStudio({ type }) {
  const config = configs[type]; const Icon = config.icon; const isImage = type === "image-generator";
  const [prompt, setPrompt] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:prompt" + ":" + type, ""); const [model, setModel] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:model" + ":" + type, config.models[0]);
  const [resolution, setResolution] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:resolution" + ":" + type, config.resolutions[0]); const [aspect, setAspect] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:aspect" + ":" + type, "1:1");
  const [count, setCount] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:count" + ":" + type, 1); const [duration, setDuration] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:duration" + ":" + type, 5); const [audio, setAudio] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:audio" + ":" + type, false);
  const [references, setReferences] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:references" + ":" + type, []); const [provider, setProvider] = useState({ configured: false, loading: isImage });
  const [images, setImages] = useWorkDraftState("components/ai-tools/GenerativeStudio.jsx:images" + ":" + type, []); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isImage) return undefined;
    let active = true;
    getImageGenerationStatus().then((status) => {
      if (active) setProvider({ ...status, loading: false });
    }).catch((error) => { if (active) { setProvider({ configured: false, loading: false }); setMessage(error.message); } });
    return () => { active = false; };
  }, [isImage]);
  useEffect(() => () => references.forEach((item) => URL.revokeObjectURL(item.url)), [references]);

  function attach(files) { setReferences((items) => [...items, ...[...files].map((file) => ({ name: file.name, url: URL.createObjectURL(file) }))]); }
  async function runGeneration() {
    setBusy(true); setMessage("");
    try { const result = await generateImage({ prompt: prompt.trim(), aspect, count }); setImages(result.images); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  const canGenerate = isImage && provider.configured && prompt.trim() && !busy;

  return <div className="min-h-[650px] overflow-hidden rounded-xl border border-slate-800 bg-[#0c0d12] text-slate-200"><div className="grid min-h-[650px] grid-cols-[190px_minmax(0,1fr)_260px]">
    <aside className="border-r border-slate-800 bg-[#111218] p-3"><div className="mb-6 flex items-center gap-2 text-sm font-black text-white"><WandSparkles className="text-fuchsia-400" size={20} /> MM Create</div>{[{ icon: Sparkles, text: "Criar" }, { icon: Library, text: "Biblioteca" }, { icon: Upload, text: "Uploads" }].map(({ icon: ItemIcon, text }, index) => <button key={text} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${index === 0 ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-slate-400 hover:bg-slate-800"}`}><ItemIcon size={15} />{text}</button>)}</aside>
    <main className="flex min-w-0 flex-col p-6"><div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-fuchsia-400">Criar com IA</p><h2 className="mt-1 text-3xl font-black text-white">{config.title}</h2><p className="mt-2 text-sm text-slate-400">Combine instruções e referências em um fluxo preparado para produção.</p></div><Icon size={32} className="text-fuchsia-400" /></div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#08090d]">{images.length ? <div className="grid h-full w-full gap-2 p-3" style={{ gridTemplateColumns: `repeat(${Math.min(images.length, 2)}, minmax(0, 1fr))` }}>{images.map((image, index) => <img key={`${image.url}-${index}`} src={image.url} alt={`Geração ${index + 1}`} className="h-full min-h-0 w-full rounded-xl object-contain" />)}</div> : <div className="text-center text-slate-600"><Icon className="mx-auto mb-3" size={58} strokeWidth={1} /><p>{config.object ? "O objeto gerado aparecerá aqui" : config.world ? "O mundo navegável aparecerá aqui" : "Suas gerações aparecerão aqui"}</p></div>}</div>
      <div className="mt-4 rounded-2xl border border-slate-700 bg-[#15161d] p-3"><div className="flex gap-3"><label className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-xl border border-dashed border-slate-600"><Plus size={18} /><input aria-label="Adicionar referência" type="file" multiple accept="image/*,video/*" onChange={(event) => attach(event.target.files)} className="sr-only" /></label><textarea aria-label={isImage ? "Descreva a imagem" : `Descreva: ${config.title}`} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={config.placeholder} className="min-h-12 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-white outline-none" /></div><div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3"><select aria-label="Modelo de geração" value={model} onChange={(event) => setModel(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs">{config.models.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Proporção da geração" value={aspect} onChange={(event) => setAspect(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs"><option>1:1</option><option>16:9</option><option>9:16</option><option>4:3</option></select><select aria-label="Resolução da geração" value={resolution} onChange={(event) => setResolution(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs">{config.resolutions.map((item) => <option key={item}>{item}</option>)}</select><button onClick={runGeneration} disabled={!canGenerate} className="ml-auto rounded-xl bg-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{busy ? "Gerando…" : config.action}</button></div></div>
    </main>
    <aside className="border-l border-slate-800 bg-[#111218] p-4"><h3 className="mb-4 font-bold text-white">Configurações</h3><label className="mb-4 block text-xs">Quantidade <span className="float-right text-fuchsia-300">{count}</span><input aria-label="Quantidade de resultados" type="range" min="1" max="4" value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-500" /></label>{config.video && <><label className="mb-4 block text-xs">Duração <span className="float-right text-fuchsia-300">{duration}s</span><input aria-label="Duração do vídeo" type="range" min="2" max="15" value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-500" /></label><label className="mb-4 flex items-center justify-between text-xs">Gerar áudio<input aria-label="Gerar áudio" type="checkbox" checked={audio} onChange={(event) => setAudio(event.target.checked)} /></label><div className="mb-4 grid grid-cols-2 gap-2"><button className="rounded border border-dashed border-slate-700 py-5 text-[10px] text-slate-500">Quadro inicial</button><button className="rounded border border-dashed border-slate-700 py-5 text-[10px] text-slate-500">Quadro final</button></div></>}
      {isImage && <div className={`mt-6 rounded-xl border p-3 text-xs ${provider.configured ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-200" : "border-amber-500/25 bg-amber-500/5 text-amber-200"}`}><strong className="block">{provider.configured ? `Provedor conectado: ${provider.provider}` : "Provedor de geração não configurado"}</strong><span className="mt-1 block opacity-70">{provider.configured ? `Modelo da empresa: ${provider.model}` : "A empresa ainda não possui uma API de IA configurada."}</span><a href="/configuracoes/ia" className="mt-3 inline-block rounded border border-current px-2 py-1">Abrir configuração geral de IA</a></div>}
      {message && <p role="status" className="mt-3 text-xs text-amber-200">{message}</p>}
    </aside>
  </div></div>;
}
