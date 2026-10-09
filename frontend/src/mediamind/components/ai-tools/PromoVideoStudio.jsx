import StudioProjectBar from "./StudioProjectBar";
import { useEffect, useState } from "react";
import { Film, Wand2 } from "lucide-react";
import {
  Button,
  Field,
  Panel,
  StudioHeader,
  Notice,
  ExportDraft,
  inputClass,
} from "./StudioUI";
import VideoWorkspace, { makeScenes } from "./VideoWorkspace";
export default function PromoVideoStudio({ affiliate = false }) {
  const [brief, setBrief] = useState({
    name: "",
    link: "",
    price: "",
    benefit: "",
    audience: "",
    cta: "Saiba mais",
    format: "9:16",
    duration: "30",
    style: "Moderno",
    voice: "Natural",
    captions: true,
  });
  const [script, setScript] = useState(""),
    [variant, setVariant] = useState(0),
    [scenes, setScenes] = useState([]),
    [message, setMessage] = useState(""),
    [audio, setAudio] = useState(null),
    [music, setMusic] = useState(null),
    [volume, setVolume] = useState(25);
  useEffect(
    () => () => {
      if (audio) URL.revokeObjectURL(audio);
    },
    [audio],
  );
  useEffect(
    () => () => {
      if (music) URL.revokeObjectURL(music);
    },
    [music],
  );
  const patch = (k, v) => setBrief((b) => ({ ...b, [k]: v }));
  function generate(index = variant) {
    if (!brief.name.trim() || !brief.benefit.trim()) {
      setMessage(
        "Informe o produto e um benefício verdadeiro para criar o roteiro-base.",
      );
      return;
    }
    const hooks = [
      `Conheça ${brief.name}.`,
      `Quer ${brief.benefit.toLowerCase()}?`,
      `Uma nova forma de ${brief.benefit.toLowerCase()}.`,
    ];
    const text = [
      hooks[index],
      brief.benefit,
      brief.price ? `Disponível por ${brief.price}.` : "",
      `${brief.cta}.${affiliate ? " Confira as condições no link de afiliado." : ""}`,
    ]
      .filter(Boolean)
      .join("\n");
    setScript(text);
    setMessage(
      "Roteiro-base criado a partir do seu briefing. Confira fatos, preço e condições antes de publicar.",
    );
  }
  function create() {
    if (!script.trim()) {
      setMessage("Escreva ou crie um roteiro primeiro.");
      return;
    }
    const list = makeScenes(script);
    const duration = Math.max(
      1,
      Math.round(Number(brief.duration) / Math.max(1, list.length)),
    );
    setScenes(list.map((s) => ({ ...s, duration })));
    setMessage(
      "Storyboard criado. Selecione cada cena para editar texto, duração e mídia.",
    );
  }
  return (
    <section className="space-y-5">
      <StudioHeader
        title={affiliate ? "Vídeos Afiliados" : "Vídeos de Vendas"}
        description={
          affiliate
            ? "Transforme seu briefing de produto em um vídeo vertical com gancho, benefícios e chamada para ação."
            : "Apresente sua oferta com identidade visual, cenas editáveis e uma mensagem clara."
        }
      >
        <ExportDraft
          value={{
            tool: affiliate ? "affiliate" : "sales",
            brief,
            script,
            scenes: scenes.map(({ media, ...s }) => ({
              ...s,
              media: media ? "Arquivo local — reanexar ao abrir" : null,
            })),
          }}
          name="mediamind-video-promocional.json"
        />
      </StudioHeader>
      <StudioProjectBar tool={affiliate ? "affiliate-videos" : "sales-videos"} value={{ brief, script, scenes, audio, music, volume }} onLoad={(v) => { setBrief((b) => ({ ...b, ...v.brief })); setScript(v.script || ""); setScenes(Array.isArray(v.scenes) ? v.scenes : []); setAudio(v.audio || null); setMusic(v.music || null); setVolume(v.volume ?? 25); }} />
      <Notice>{message}</Notice>
      <div className="grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel title="Briefing da oferta" number="01">
            {[
              ["name", "Nome do produto / serviço"],
              ["link", affiliate ? "Link de afiliado" : "Link da oferta"],
              ["price", "Preço e condições"],
              ["benefit", "Benefício principal"],
              ["audience", "Público-alvo"],
              ["cta", "Chamada para ação"],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <input
                  className={inputClass}
                  value={brief[k]}
                  onChange={(e) => patch(k, e.target.value)}
                  placeholder={
                    k === "name"
                      ? "Ex.: Mentoria de conteúdo"
                      : k === "link"
                        ? "https://…"
                        : ""
                  }
                />
              </Field>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Formato">
                <select
                  className={inputClass}
                  value={brief.format}
                  onChange={(e) => patch("format", e.target.value)}
                >
                  <option>9:16</option>
                  <option>16:9</option>
                </select>
              </Field>
              <Field label="Duração">
                <select
                  className={inputClass}
                  value={brief.duration}
                  onChange={(e) => patch("duration", e.target.value)}
                >
                  {["15", "30", "45", "60"].map((n) => (
                    <option key={n} value={n}>
                      {n}s
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>
          <Panel title="Direção visual" number="02">
            <div className="grid grid-cols-3 gap-2">
              {["Moderno", "Editorial", "Impacto"].map((s) => (
                <button
                  key={s}
                  onClick={() => patch("style", s)}
                  className={`rounded-xl border px-2 py-3 text-xs ${brief.style === s ? "border-sky-400 bg-sky-500/10 text-sky-300" : "border-slate-700 text-slate-400"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={brief.captions}
                onChange={(e) => patch("captions", e.target.checked)}
              />
              Legendas no storyboard
            </label>
          </Panel>
          <Panel title="Áudio e trilha" number="03">
            <Field label="Narração pronta">
              <input
                type="file"
                accept="audio/*"
                className="text-xs text-slate-400"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) {
                    if (audio) URL.revokeObjectURL(audio);
                    setAudio(URL.createObjectURL(f));
                  }
                }}
              />
            </Field>
            {audio && <audio controls src={audio} className="w-full" />}
            <Field label="Trilha sonora">
              <input
                type="file"
                accept="audio/*"
                className="text-xs text-slate-400"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) {
                    if (music) URL.revokeObjectURL(music);
                    setMusic(URL.createObjectURL(f));
                  }
                }}
              />
            </Field>
            {music && (
              <audio
                controls
                src={music}
                onLoadedMetadata={(e) => {
                  e.currentTarget.volume = volume / 100;
                }}
                className="w-full"
              />
            )}
            <Field label={`Volume da trilha · ${volume}%`}>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => {
                  setVolume(+e.target.value);
                  const player = e.target
                    .closest("section")
                    .querySelectorAll("audio");
                  if (player.length)
                    player[player.length - 1].volume = +e.target.value / 100;
                }}
                className="w-full accent-sky-400"
              />
            </Field>
            <p className="text-xs text-slate-500">
              Prévia individual de áudio. Mixagem final disponível em breve.
            </p>
          </Panel>
        </aside>
        <div className="space-y-5">
          <Panel title="Roteiro e variações">
            <div className="flex flex-wrap gap-2">
              {["Direto", "Pergunta", "Benefício"].map((label, i) => (
                <Button
                  key={label}
                  primary={variant === i}
                  onClick={() => {
                    setVariant(i);
                    generate(i);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <textarea
              className={inputClass}
              rows={6}
              placeholder="Seu roteiro aparecerá aqui. Você pode escrever e editar livremente."
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generate()}>
                <Wand2 size={16} />
                Criar roteiro-base
              </Button>
              <Button primary onClick={create}>
                <Film size={16} />
                Criar cenas na Timeline
              </Button>
            </div>
          </Panel>
          <VideoWorkspace
            scenes={scenes}
            setScenes={setScenes}
            format={brief.format}
            accent={
              brief.style === "Impacto"
                ? "#fb7185"
                : brief.style === "Editorial"
                  ? "#a78bfa"
                  : "#38bdf8"
            }
            showText={brief.captions}
            label={brief.captions ? "PRÉVIA COM TEXTO" : "STORYBOARD VISUAL"}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-4">
            <p className="text-xs text-slate-500">
              Projeto editável pronto para apresentação. Exportação MP4 em breve.
            </p>
            <Button disabled>Exportar MP4</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

