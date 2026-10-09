import StudioProjectBar from "./StudioProjectBar";
import { useState } from "react";
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
export default function ChannelStudio() {
  const [brief, setBrief] = useState({
      niche: "Educação e conhecimento",
      theme: "",
      language: "Português (Brasil)",
      duration: "60",
      format: "16:9",
      strategy: "Mídia própria",
      tone: "Explicativo",
    }),
    [script, setScript] = useState(""),
    [scenes, setScenes] = useState([]),
    [message, setMessage] = useState("");
  return (
    <section className="space-y-5">
      <StudioHeader
        title="Vídeos para Canais"
        description="Planeje seu próximo vídeo com um briefing organizado, roteiro revisável e storyboard visual."
      >
        <ExportDraft
          value={{
            tool: "channel-studio",
            brief,
            script,
            scenes: scenes.map(({ media: _media, ...s }) => s),
          }}
          name="mediamind-canal.json"
        />
      </StudioHeader>
      <StudioProjectBar tool="channel-studio" value={{ brief, script, scenes }} onLoad={(v) => { setBrief((b) => ({ ...b, ...v.brief })); setScript(v.script || ""); setScenes(Array.isArray(v.scenes) ? v.scenes : []); }} />
      <Notice>{message}</Notice>
      <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
        <Panel title="Briefing do vídeo">
          {[
            ["niche", "Nicho do canal"],
            ["theme", "Tema do vídeo"],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <input
                className={inputClass}
                value={brief[k]}
                onChange={(e) =>
                  setBrief((b) => ({ ...b, [k]: e.target.value }))
                }
              />
            </Field>
          ))}
          {[
            [
              "language",
              "Idioma",
              ["Português (Brasil)", "Inglês", "Espanhol"],
            ],
            ["format", "Formato", ["16:9", "9:16"]],
            ["duration", "Duração planejada", ["60", "120", "300", "600"]],
            [
              "strategy",
              "Estratégia de mídia",
              ["Mídia própria", "Acervo autorizado", "Ilustrações"],
            ],
            [
              "tone",
              "Tom da narração",
              ["Explicativo", "Documental", "Conversacional"],
            ],
          ].map(([k, l, opts]) => (
            <Field key={k} label={l}>
              <select
                className={inputClass}
                value={brief[k]}
                onChange={(e) =>
                  setBrief((b) => ({ ...b, [k]: e.target.value }))
                }
              >
                {opts.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          ))}
          <Button
            onClick={() => {
              setScript(
                `Neste vídeo, vamos explorar ${brief.theme || "um tema importante"}.\nPrimeiro, entenda o contexto e a pergunta principal.\nDepois, apresente um exemplo concreto e fontes verificáveis.\nFinalize com os pontos mais úteis e o próximo passo.`,
              );
              setMessage(
                "Estrutura de demonstração carregada. Escreva os fatos e exemplos do seu vídeo.",
              );
            }}
          >
            Usar estrutura de exemplo
          </Button>
        </Panel>
        <div className="space-y-4">
          <Panel title="Roteiro do canal">
            <textarea
              className={inputClass}
              rows={6}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Escreva ou cole seu roteiro…"
            />
            <Button
              primary
              disabled={!script.trim()}
              onClick={() => {
                const list = makeScenes(script);
                setScenes(
                  list.map((s) => ({
                    ...s,
                    duration: Math.max(
                      1,
                      Math.round(Number(brief.duration) / list.length),
                    ),
                  })),
                );
                setMessage(
                  "Storyboard criado. As durações iniciais são editáveis na timeline.",
                );
              }}
            >
              Preparar storyboard
            </Button>
          </Panel>
          <VideoWorkspace
            scenes={scenes}
            setScenes={setScenes}
            format={brief.format}
          />
        </div>
      </div>
    </section>
  );
}

