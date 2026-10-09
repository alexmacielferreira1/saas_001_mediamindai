import { useMemo, useState } from "react";

export default function PromoVideoStudio({ affiliate = false }) {
  const [notice, setNotice] = useState("");
  const [brief, setBrief] = useState({
    name: "",
    price: "",
    benefit: "",
    duration: "25",
    format: "9:16",
    caption: "automatic",
    music: "low",
    hook: "",
  });
  const [choice, setChoice] = useState(0);
  const scripts = useMemo(() => {
    const name = brief.name || (affiliate ? "este produto" : "esta campanha");
    const benefit =
      brief.benefit || "resolve uma necessidade real de forma simples";
    const price = brief.price ? ` por ${brief.price}` : "";
    return [
      `${brief.hook || "Olha isso."} ${name} ${benefit}${price}. Confira os detalhes antes de decidir.`,
      `Se você procura uma solução prática, conheça ${name}. ${benefit}${price}. Saiba mais.`,
      `O destaque de ${name} é simples: ${benefit}. Veja as condições${price} e escolha com informação.`,
    ];
  }, [affiliate, brief]);
  const [edited, setEdited] = useState("");
  const script = edited || scripts[choice];
  function patch(field, value) {
    setBrief((current) => ({ ...current, [field]: value }));
    setEdited("");
  }
  function sendToTimeline() {
    const duration = Number(brief.duration);
    const sentences = script.split(/(?<=[.!?])\s+/).filter(Boolean);
    const sceneDuration = Math.max(2, duration / Math.max(1, sentences.length));
    setNotice(
      `Projeto montado nesta ferramenta com ${sentences.length} cenas de ${sceneDuration.toFixed(1)}s.`,
    );
  }
  const input =
    "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white";
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-white">
          {affiliate ? "Vídeos Afiliados" : "Vídeos de Vendas"}
        </h2>
        <p className="text-sm text-slate-400">
          Briefing factual → três roteiros → revisão → Timeline MediaMind.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <label className="text-xs text-slate-400">
            {affiliate ? "Produto" : "Produto, serviço ou campanha"}
            <input
              aria-label="Nome do produto"
              className={input}
              value={brief.name}
              onChange={(e) => patch("name", e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-400">
            Preço ou condição confirmada
            <input
              aria-label="Preço"
              className={input}
              value={brief.price}
              onChange={(e) => patch("price", e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-400">
            Benefício confirmado
            <textarea
              aria-label="Benefício"
              className={input}
              rows={3}
              value={brief.benefit}
              onChange={(e) => patch("benefit", e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-400">
            Gancho inicial
            <input
              aria-label="Gancho"
              className={input}
              value={brief.hook}
              onChange={(e) => patch("hook", e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Duração
              <select
                className={input}
                value={brief.duration}
                onChange={(e) => patch("duration", e.target.value)}
              >
                <option value="15">15 segundos</option>
                <option value="25">25 segundos</option>
                <option value="35">35 segundos</option>
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Formato
              <select
                className={input}
                value={brief.format}
                onChange={(e) => patch("format", e.target.value)}
              >
                <option>9:16</option>
                <option>1:1</option>
                <option>16:9</option>
              </select>
            </label>
          </div>
        </div>
        <div className="space-y-3">
          {scripts.map((item, index) => (
            <button
              key={item}
              onClick={() => {
                setChoice(index);
                setEdited("");
              }}
              className={`w-full rounded-xl border p-3 text-left text-sm ${choice === index ? "border-sky-400 bg-sky-950/40" : "border-slate-800 bg-slate-900"}`}
            >
              <b>Roteiro {index + 1}</b>
              <span className="mt-1 block text-slate-400">{item}</span>
            </button>
          ))}
          <textarea
            aria-label="Roteiro final"
            rows={7}
            className={input}
            value={script}
            onChange={(e) => setEdited(e.target.value)}
          />
          <button
            onClick={sendToTimeline}
            className="w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-slate-950"
          >
            Criar cenas na Timeline
          </button>
        </div>
      </div>
    </section>
  );
}
