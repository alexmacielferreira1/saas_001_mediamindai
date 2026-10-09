import { useEffect, useState } from "react";
import { Scissors, Film, ListPlus, Upload } from "lucide-react";
import VideoWorkspace, { makeScenes } from "./VideoWorkspace";
import {
  Button,
  Field,
  Panel,
  StudioHeader,
  Notice,
  ExportDraft,
  inputClass,
} from "./StudioUI";
const demo =
  "Toda boa história começa com uma pergunta.\nComo transformar informação em uma mensagem que conecta?\nComece pelo que seu público precisa entender.\nEscolha uma ideia e mostre um exemplo concreto.\nRevise, simplifique e publique com intenção.";
export default function ExistingWorkflowTool({ toolId }) {
  const clips = toolId === "auto-clips",
    speech = toolId === "speech-montage";
  const [text, setText] = useState(""),
    [scenes, setScenes] = useState([]),
    [format, setFormat] = useState("9:16"),
    [count, setCount] = useState("3"),
    [message, setMessage] = useState(""),
    [source, setSource] = useState(null),
    [marked, setMarked] = useState([]);
  const lines = text.split(/\n+/).filter((s) => s.trim());
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );
  function build() {
    if (!text.trim()) {
      setMessage("Cole sua transcrição ou carregue um exemplo para começar.");
      return;
    }
    setScenes(makeScenes(text).slice(0, clips ? Number(count) : 100));
    setMessage(
      clips
        ? "Seleção inicial criada por ordem da transcrição. Revise os trechos: não há análise automática de relevância ou timestamps nesta prévia."
        : "Cenas criadas. Edite o texto e a duração de cada uma.",
    );
  }
  return (
    <section className="space-y-5">
      <StudioHeader
        title={
          clips
            ? "Cortes Automáticos"
            : speech
              ? "Montagem por Falas"
              : "Vídeo Studio"
        }
        description={
          clips
            ? "Prepare uma seleção editorial, revise seus trechos e visualize o resultado em formato social."
            : speech
              ? "Escolha falas, ordene a narrativa e monte um storyboard com controle de cada cena."
              : "Transforme um roteiro em cenas, organize mídia e refine a narrativa na timeline."
        }
      >
        <ExportDraft
          value={{
            tool: toolId,
            format,
            transcript: text,
            scenes: scenes.map(({ media, ...s }) => ({
              ...s,
              media: media ? "Reanexar arquivo local" : null,
            })),
          }}
        />
      </StudioHeader>
      <Notice>{message}</Notice>
      <div className="grid items-start gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel
            title={clips ? "Fonte e seleção" : "Roteiro e briefing"}
            number="01"
          >
            <Field label="Formato de saída">
              <select
                className={inputClass}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option>9:16</option>
                <option>16:9</option>
              </select>
            </Field>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 p-4 text-xs text-sky-300">
              <Upload size={16} />
              Carregar vídeo de referência
              <input
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) {
                    if (source) URL.revokeObjectURL(source);
                    setSource(URL.createObjectURL(f));
                  }
                }}
              />
            </label>
            {source && (
              <video controls src={source} className="w-full rounded-xl" />
            )}
            <Field
              label={speech ? "Falas (uma por linha)" : "Roteiro / transcrição"}
            >
              <textarea
                className={inputClass}
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole o texto aqui…"
              />
            </Field>
            {clips && (
              <Field label="Quantidade de trechos">
                <select
                  className={inputClass}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                >
                  {["3", "5", "8", "10"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            )}
            <Button
              onClick={() => {
                setText(demo);
                setMessage("Exemplo de demonstração carregado.");
              }}
            >
              Carregar exemplo
            </Button>
            {!speech && (
              <Button primary onClick={build}>
                {clips ? <Scissors size={15} /> : <Film size={15} />}Criar
                seleção editável
              </Button>
            )}
            <p className="text-xs leading-relaxed text-slate-500">
              Cole sua transcrição para editar o storyboard. Transcrição automática e exportação de vídeo disponíveis em breve.
            </p>
          </Panel>
          {speech && (
            <Panel title="Biblioteca de falas" number="02">
              {lines.map((line, i) => (
                <label
                  key={`${i}-${line}`}
                  className="flex gap-3 rounded-xl border border-slate-700 p-3 text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={marked.includes(i)}
                    onChange={(e) =>
                      setMarked((items) =>
                        e.target.checked
                          ? [...items, i]
                          : items.filter((n) => n !== i),
                      )
                    }
                  />
                  <span>{line}</span>
                </label>
              ))}
              <Button
                primary
                disabled={!marked.length}
                onClick={() => {
                  setScenes(
                    makeScenes(
                      marked
                        .filter((i) => lines[i])
                        .map((i) => lines[i])
                        .join("\n"),
                    ),
                  );
                  setMessage("Falas selecionadas adicionadas à timeline.");
                }}
              >
                <ListPlus size={16} />
                Montar sequência
              </Button>
            </Panel>
          )}
        </aside>
        <div className="space-y-5">
          <VideoWorkspace
            scenes={scenes}
            setScenes={setScenes}
            format={format}
          />
          {clips && scenes.length > 0 && (
            <Panel title="Revisão dos trechos">
              <div className="grid gap-3 md:grid-cols-2">
                {scenes.map((s, i) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-slate-700 p-4"
                  >
                    <div className="mb-2 flex justify-between text-xs text-sky-300">
                      <span>Corte {i + 1}</span>
                      <span>{s.duration}s · duração proposta</span>
                    </div>
                    <p className="text-sm text-slate-300">{s.text}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 p-4">
            <p className="text-xs text-slate-500">
              Prévia editável · seus dados não são enviados ao servidor.
            </p>
            <Button disabled>Renderizar vídeo</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
