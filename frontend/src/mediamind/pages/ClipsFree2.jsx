import { useEffect, useMemo, useState } from "react";
import { Download, FileVideo, Play, Scissors, Sparkles, Upload } from "lucide-react";

import { createClipsFree2Session } from "../../api/clipsFree2";
import { uploadMediaAsset } from "../../api/media";

const FORMAT_OPTIONS = ["9:16", "1:1", "16:9"];

function timeLabel(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

export default function ClipsFree2() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [format, setFormat] = useState("9:16");
  const [captionStyle, setCaptionStyle] = useState("destaque");
  const [phase, setPhase] = useState("source");
  const [session, setSession] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(30);
  const [caption, setCaption] = useState("Edite esta legenda antes de exportar");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const clipDuration = useMemo(() => Math.max(0, outPoint - inPoint), [inPoint, outPoint]);

  function selectFile(event) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setPhase("source");
    setSession(null);
    setDemoMode(false);
    setMessage("");
    event.target.value = "";
  }

  async function createSession() {
    if (!file || phase === "sending") return;
    setPhase("sending");
    setMessage("Enviando a mídia para uma sessão CLIPSFREE2 isolada…");
    try {
      const asset = await uploadMediaAsset(file, { origin: "clipsfree2" });
      const created = await createClipsFree2Session({ assetId: asset.id, format, captionStyle });
      setSession(created);
      const received = Array.isArray(created.candidates) ? created.candidates : [];
      setCandidates(received);
      setSelectedCandidateId(received[0]?.id || "");
      setPhase("manual_review");
      setMessage(created.message);
    } catch (error) {
      setPhase("source");
      setMessage(error?.message || "Não foi possível criar a sessão de corte.");
    }
  }

  function exportProject() {
    const payload = { version: 1, source_name: file?.name || "", format, caption_style: captionStyle, in: inPoint, out: outPoint, caption };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "clipsfree2-projeto.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function addManualCandidate() {
    const candidate = {
      id: `manual-${Date.now()}`,
      title: `Corte manual ${candidates.length + 1}`,
      start: inPoint,
      end: outPoint,
      score: null,
      rationale: "Intervalo definido manualmente. Sem pontuação automática.",
    };
    setCandidates((current) => [...current, candidate]);
    setSelectedCandidateId(candidate.id);
  }

  function selectCandidate(candidate) {
    setSelectedCandidateId(candidate.id);
    setInPoint(candidate.start);
    setOutPoint(candidate.end);
    if (candidate.captions?.[0]?.text) setCaption(candidate.captions[0].text);
  }

  function openVisualDemo() {
    const demoCandidates = [
      { id: "demo-hook", title: "Abertura que prende a atenção", start: 12, end: 43, score: 91, rationale: "Gancho direto, ideia completa e ritmo consistente.", captions: [{ text: "O ponto mais importante começa aqui." }] },
      { id: "demo-value", title: "Explicação com valor prático", start: 51, end: 86, score: 84, rationale: "Trecho didático com começo, desenvolvimento e conclusão.", captions: [{ text: "Você pode aplicar isso hoje." }] },
      { id: "demo-opinion", title: "Opinião que gera conversa", start: 94, end: 124, score: 78, rationale: "Ponto de vista claro, adequado para revisão editorial.", captions: [{ text: "Essa é a mudança que eu defendo." }] },
    ];
    setDemoMode(true);
    setFile(null);
    setPreviewUrl("");
    setDuration(132);
    setInPoint(12);
    setOutPoint(43);
    setCaption(demoCandidates[0].captions[0].text);
    setCandidates(demoCandidates);
    setSelectedCandidateId(demoCandidates[0].id);
    setSession({ id: "demo-visual", status: "demo", candidates: demoCandidates });
    setPhase("demo");
    setMessage("Modo demonstração visual: exemplos de interface, não resultados de uma mídia processada.");
  }

  return <main className="mx-auto max-w-[1480px] space-y-5 p-1 text-slate-100">
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20">
      <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300"><Scissors size={15} /> Estúdio independente</p><h1 className="mt-1 text-3xl font-black">CLIPSFREE2</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Cortes reais a partir do seu vídeo, com projeto próprio e sem reutilizar o estado do CLIPSFREE.</p></div>
      <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-200">Projeto isolado</span>
    </header>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><h2 className="flex items-center gap-2 font-bold"><FileVideo size={18} className="text-cyan-300" /> Vídeo de origem</h2>{file && <span className="max-w-[55%] truncate text-xs text-slate-400">{file.name}</span>}</div>
        {previewUrl ? <video aria-label="Prévia do CLIPSFREE2" src={previewUrl} controls className="min-h-72 w-full bg-black" onLoadedMetadata={(event) => { const value = event.currentTarget.duration; setDuration(value); setOutPoint(Math.min(30, value || 30)); }} /> : demoMode ? <div className="flex min-h-96 flex-col items-center justify-center bg-gradient-to-br from-cyan-900/50 via-slate-950 to-violet-950/40 p-8 text-center"><span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-100">Modo demonstração visual</span><div className="mt-6 grid h-44 w-28 place-items-center rounded-2xl border-4 border-slate-700 bg-slate-900 shadow-2xl"><Play size={34} className="text-cyan-300" /></div><strong className="mt-5">Prévia ilustrativa 9:16</strong><span className="mt-2 max-w-md text-sm text-slate-400">A área de player, cortes e legendas está sendo demonstrada; nenhum vídeo foi enviado ou processado.</span></div> : <label className="flex min-h-96 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-700 bg-slate-950/50 p-8 text-center hover:border-cyan-400"><Upload size={36} className="text-cyan-300" /><strong>Escolha o vídeo para cortar</strong><span className="max-w-md text-sm text-slate-500">MP4, MOV ou WebM. Você verá a prévia local antes de enviar para a sessão.</span><span className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Selecionar vídeo</span><input aria-label="Vídeo para cortar" type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={selectFile} /></label>}
        {previewUrl && <label className="flex cursor-pointer items-center gap-2 border-t border-slate-800 px-5 py-3 text-sm font-semibold text-cyan-200"><Upload size={15} /> Trocar vídeo<input aria-label="Vídeo para cortar" type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={selectFile} /></label>}
      </div>

      <aside className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5"><h2 className="flex items-center gap-2 font-bold"><Sparkles size={18} className="text-cyan-300" /> Configuração</h2><div className="mt-5 space-y-5"><fieldset><legend className="text-xs font-bold uppercase tracking-wide text-slate-500">Formato</legend><div className="mt-2 grid grid-cols-3 gap-2">{FORMAT_OPTIONS.map((item) => <button key={item} type="button" aria-pressed={format === item} onClick={() => setFormat(item)} className={`rounded-xl border px-2 py-2 text-sm font-bold ${format === item ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-700 text-slate-300"}`}>{item}</button>)}</div></fieldset><label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Estilo de legenda<select aria-label="Estilo de legenda" value={captionStyle} onChange={(event) => setCaptionStyle(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"><option value="destaque">Destaque por palavra</option><option value="limpo">Limpo</option><option value="documental">Documental</option></select></label><button type="button" disabled={!file || phase === "sending"} onClick={createSession} className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{phase === "sending" ? "Criando sessão…" : "Criar sessão de corte"}</button><button type="button" onClick={openVisualDemo} className="w-full rounded-xl border border-cyan-300/50 px-4 py-3 text-sm font-black text-cyan-100">Abrir demonstração visual</button><p className="text-xs leading-relaxed text-slate-500">A análise automática só será exibida quando houver um provedor de transcrição configurado. Sem ele, este projeto abre para corte manual.</p></div></aside>
    </section>

    {message && <p role="status" className={`rounded-2xl border px-4 py-3 text-sm ${phase === "manual_review" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-rose-400/30 bg-rose-400/10 text-rose-100"}`}>{message}</p>}

        {session && <section className="rounded-3xl border border-cyan-400/25 bg-slate-950/80 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Revisão do corte</p><h2 className="mt-1 text-xl font-black">Defina o intervalo e a legenda</h2><p className="mt-1 text-sm text-slate-400">Sessão {session.id.slice(0, 8)} · {format} · fonte com {timeLabel(duration)}</p></div><button type="button" onClick={exportProject} className="flex items-center gap-2 rounded-xl border border-cyan-300/40 px-3 py-2 text-sm font-bold text-cyan-100"><Download size={16} /> Salvar projeto JSON</button></div><div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Cortes sugeridos</h2><p className="text-xs text-slate-500">Sugestões automáticas aparecem somente quando forem baseadas na transcrição real.</p></div><button type="button" onClick={addManualCandidate} className="rounded-xl bg-cyan-300 px-3 py-2 text-sm font-black text-slate-950">Adicionar corte manual</button></div>{candidates.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">Nenhum corte automático disponível. Crie o primeiro intervalo manualmente.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{candidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => selectCandidate(candidate)} className={`rounded-xl border p-3 text-left ${selectedCandidateId === candidate.id ? "border-cyan-300 bg-cyan-300/10" : "border-slate-700 bg-slate-950"}`}><div className="flex items-start justify-between gap-2"><strong>{candidate.title || candidate.quote || "Trecho sugerido"}</strong><span className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-cyan-200">{candidate.score == null ? "Manual" : `${candidate.score}%`}</span></div><p className="mt-2 text-xs text-slate-400">{timeLabel(candidate.start)} — {timeLabel(candidate.end)}</p><p className="mt-2 text-xs leading-relaxed text-slate-500">{candidate.rationale || candidate.notes || "Sem justificativa disponível."}</p></button>)}</div>}</div><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-semibold">Entrada do corte<input aria-label="Entrada do corte" type="number" min="0" max={outPoint} step="0.1" value={inPoint} onChange={(event) => setInPoint(Math.min(Number(event.target.value), outPoint))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" /></label><label className="text-sm font-semibold">Saída do corte<input aria-label="Saída do corte" type="number" min={inPoint} max={duration || undefined} step="0.1" value={outPoint} onChange={(event) => setOutPoint(Math.max(Number(event.target.value), inPoint))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2" /></label><div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Duração selecionada</p><p className="mt-1 text-2xl font-black text-cyan-200">{timeLabel(clipDuration)}</p></div></div><label className="mt-4 block text-sm font-semibold">Legenda<textarea aria-label="Legenda do corte" value={caption} onChange={(event) => setCaption(event.target.value)} rows="3" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm" /></label><p className="mt-3 text-xs text-slate-500">Exportação MP4 e legendas temporizadas serão habilitadas quando o renderizador e a transcrição reais estiverem configurados. O JSON salvo preserva este intervalo e a legenda para retomar.</p></section>}
  </main>;
}
