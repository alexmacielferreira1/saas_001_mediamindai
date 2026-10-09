import { useMemo, useState } from "react";
const split = (v) =>
  String(v || "")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
const cls =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white";
function Clips() {
  const [text, setText] = useState(""),
    [n, setN] = useState(3),
    [items, setItems] = useState([]);
  return (
    <>
      <h2 className="text-2xl font-bold">Cortes Automáticos</h2>
      <p className="text-slate-400">
        Analise e revise candidatos dentro desta ferramenta.
      </p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <textarea
            aria-label="Transcrição de origem"
            rows={12}
            className={cls}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole a transcrição..."
          />
          <input
            aria-label="Quantidade de clipes"
            type="number"
            min="1"
            max="20"
            className={`${cls} mt-2`}
            value={n}
            onChange={(e) => setN(+e.target.value)}
          />
          <button
            className="mt-2 w-full rounded-xl bg-sky-500 py-3 font-bold text-slate-950"
            onClick={() =>
              setItems(
                split(text)
                  .slice(0, n)
                  .map((t, i) => ({
                    t,
                    start: i * 30,
                    end:
                      i * 30 +
                      Math.min(75, Math.max(25, t.split(/\s+/).length * 2.5)),
                  })),
              )
            }
          >
            Analisar candidatos
          </button>
        </div>
        <div className="space-y-3">
          {items.map((x, i) => (
            <article
              key={i}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <b>
                Candidato {i + 1} · {x.start}s–{x.end}s
              </b>
              <p className="mt-2 text-sm text-slate-300">{x.t}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
function Studio() {
  const [text, setText] = useState(""),
    [scenes, setScenes] = useState([]);
  return (
    <>
      <h2 className="text-2xl font-bold">Vídeo Studio</h2>
      <p className="text-slate-400">
        Transforme roteiro em cenas editáveis sem sair da central.
      </p>
      <textarea
        aria-label="Roteiro do vídeo"
        rows={8}
        className={`${cls} mt-5`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Cada frase ou linha vira uma cena."
      />
      <button
        className="mt-2 rounded-xl bg-sky-500 px-5 py-3 font-bold text-slate-950"
        onClick={() =>
          setScenes(split(text).map((t, i) => ({ t, d: 5, id: i })))
        }
      >
        Criar cenas
      </button>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {scenes.map((s, i) => (
          <article
            key={s.id}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <b>Cena {i + 1}</b>
            <textarea
              className={`${cls} mt-2`}
              value={s.t}
              onChange={(e) =>
                setScenes((c) =>
                  c.map((x) =>
                    x.id === s.id ? { ...x, t: e.target.value } : x,
                  ),
                )
              }
            />
            <label className="mt-2 block text-xs text-slate-400">
              Duração
              <input
                type="number"
                className={cls}
                value={s.d}
                onChange={(e) =>
                  setScenes((c) =>
                    c.map((x) =>
                      x.id === s.id ? { ...x, d: +e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
          </article>
        ))}
      </div>
    </>
  );
}
function Speech() {
  const [text, setText] = useState(""),
    [seq, setSeq] = useState([]);
  const lines = useMemo(() => split(text), [text]);
  return (
    <>
      <h2 className="text-2xl font-bold">Montagem por Falas</h2>
      <p className="text-slate-400">Selecione falas na ordem editorial.</p>
      <textarea
        aria-label="Falas transcritas"
        rows={7}
        className={`${cls} mt-5`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Uma fala por linha..."
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {lines.map((x, i) => (
            <button
              key={i}
              onClick={() => setSeq((s) => [...s, x])}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-left text-sm"
            >
              ＋ {x}
            </button>
          ))}
        </div>
        <ol className="space-y-2">
          {seq.map((x, i) => (
            <li
              key={`${x}-${i}`}
              className="rounded-xl border border-sky-900 bg-sky-950/30 p-3 text-sm"
            >
              <b>{i + 1}.</b> {x}
              <button
                onClick={() => setSeq((s) => s.filter((_, j) => j !== i))}
                className="float-right text-red-300"
              >
                remover
              </button>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
export default function ExistingWorkflowTool({ toolId }) {
  return (
    <section className="mx-auto max-w-5xl py-4">
      {toolId === "auto-clips" ? (
        <Clips />
      ) : toolId === "video-studio" ? (
        <Studio />
      ) : (
        <Speech />
      )}
    </section>
  );
}
