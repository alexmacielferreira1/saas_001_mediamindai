import { useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";
import {
  Button,
  Field,
  Panel,
  StudioHeader,
  Notice,
  ExportDraft,
  inputClass,
} from "./StudioUI";
const tags = [
  "Apresentação",
  "Ideia",
  "Conquista",
  "Dúvida",
  "Trabalho",
  "Conexão",
];
export default function AnimatedStudio() {
  const [text, setText] = useState(
      "Uma ideia pode mudar o seu próximo passo.\nComece pequeno e avance todos os dias.\nCompartilhe o que você aprendeu.",
    ),
    [scenes, setScenes] = useState([]),
    [selected, setSelected] = useState(0),
    [playing, setPlaying] = useState(false),
    [tick, setTick] = useState(0),
    [format, setFormat] = useState("9:16"),
    [color, setColor] = useState("#38bdf8"),
    [fps, setFps] = useState("24");
  const current = scenes[selected];
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000 / Number(fps));
    return () => clearInterval(t);
  }, [playing, fps]);
  useEffect(() => {
    if (playing && tick > Number(fps) * 4) {
      setTick(0);
      if (selected < scenes.length - 1) setSelected((n) => n + 1);
      else setPlaying(false);
    }
  }, [tick, playing, fps, selected, scenes.length]);
  function patch(k, v) {
    setScenes((list) =>
      list.map((s, i) => (i === selected ? { ...s, [k]: v } : s)),
    );
  }
  return (
    <section className="space-y-5">
      <StudioHeader
        title="Vídeos Animados"
        description="Transforme frases em cenas ilustradas, personalize a direção visual e revise a sequência."
      >
        <ExportDraft
          value={{ tool: "animated-videos", format, color, fps, scenes }}
          name="mediamind-animacao.json"
        />
      </StudioHeader>
      <div className="grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel title="Roteiro por cenas" number="01">
            <Field label="Uma frase por linha">
              <textarea
                className={inputClass}
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
            <Button
              primary
              onClick={() => {
                setScenes(
                  text
                    .split("\n")
                    .filter((t) => t.trim())
                    .map((text, i) => ({
                      id: crypto.randomUUID(),
                      text,
                      tag: tags[i % tags.length],
                    })),
                );
                setSelected(0);
                setPlaying(false);
              }}
            >
              Organizar cenas
            </Button>
          </Panel>
          <Panel title="Estilo e movimento" number="02">
            <Field label="Formato">
              <select
                className={inputClass}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option>9:16</option>
                <option>16:9</option>
              </select>
            </Field>
            <Field label="Cor principal">
              <input
                className="h-10 w-full"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </Field>
            <Field label="Quadros da prévia">
              <select
                className={inputClass}
                value={fps}
                onChange={(e) => setFps(e.target.value)}
              >
                <option value="12">12 FPS</option>
                <option value="24">24 FPS</option>
              </select>
            </Field>
          </Panel>
          {current && (
            <Panel title="Cena selecionada">
              <textarea
                className={inputClass}
                rows={4}
                value={current.text}
                onChange={(e) => patch("text", e.target.value)}
              />
              <Field label="Direção da ilustração">
                <select
                  className={inputClass}
                  value={current.tag}
                  onChange={(e) => patch("tag", e.target.value)}
                >
                  {tags.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </Panel>
          )}
        </aside>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <div
              className={`relative mx-auto flex w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-[#f5f2e9] p-8 ${format === "9:16" ? "aspect-[9/16] max-w-[330px]" : "aspect-video"}`}
            >
              <span className="absolute left-6 top-6 text-[10px] font-bold tracking-widest text-slate-400">
                MEDIAMIND · ANIMATED
              </span>
              <svg
                viewBox="0 0 240 220"
                className="w-56 max-w-full"
                aria-label="Ilustração animada de personagem"
              >
                <circle cx="120" cy="110" r="85" fill={color} opacity=".12" />
                <g
                  transform={`translate(0 ${playing ? Math.sin((tick / Number(fps)) * 3) * 5 : 0})`}
                  stroke="#0f172a"
                  strokeWidth="7"
                  strokeLinecap="round"
                  fill="none"
                >
                  <circle cx="120" cy="65" r="25" fill="#fff" />
                  <path d="M120 92v63m0-45-40 32m40-32 40-32m-40 77-30 43m30-43 30 43" />
                  <path d="M109 60h1m20 0h1m-18 15q8 7 16 0" strokeWidth="3" />
                </g>
                <circle cx="177" cy="58" r="20" fill={color} />
                <text
                  x="177"
                  y="65"
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="23"
                >
                  {current?.tag === "Dúvida"
                    ? "?"
                    : current?.tag === "Conquista"
                      ? "★"
                      : current?.tag === "Ideia"
                        ? "!"
                        : "+"}
                </text>
              </svg>
              <p className="mt-6 text-center text-xl font-black leading-tight text-slate-900">
                {current?.text || "Organize seu roteiro para começar"}
              </p>
              <span className="mt-5 text-[10px] uppercase tracking-widest text-slate-500">
                {current?.tag || "Prévia ilustrada"}
              </span>
            </div>
            <div className="mt-4 flex justify-center">
              <Button
                disabled={!scenes.length}
                onClick={() => {
                  setTick(0);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}Reproduzir
                prévia
              </Button>
            </div>
          </div>
          <Panel title="Sequência de cenas">
            <div className="grid gap-3 sm:grid-cols-3">
              {scenes.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelected(i);
                    setPlaying(false);
                    setTick(0);
                  }}
                  className={`rounded-xl border p-4 text-left ${selected === i ? "border-sky-400 bg-sky-500/10" : "border-slate-700"}`}
                >
                  <span className="text-[10px] text-sky-300">
                    CENA {i + 1} · {s.tag}
                  </span>
                  <p className="mt-2 text-xs text-slate-300">{s.text}</p>
                </button>
              ))}
            </div>
          </Panel>
          <Notice>
            Prévia ilustrada e projeto editável. Geração de ilustrações por IA,
            narração e exportação MP4 disponíveis em breve.
          </Notice>
        </div>
      </div>
    </section>
  );
}
