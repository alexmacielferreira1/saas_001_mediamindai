import { useWorkDraftState } from "../../lib/workProtection";
import { safeSourceUrl } from "../../lib/creativeToolDocuments";
import StudioProjectBar from "./StudioProjectBar";
import { useEffect, useRef, useState } from "react";
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
export default function ExistingWorkflowTool({ toolId, incomingText = null }) {
  const clips = toolId === "auto-clips",
    speech = toolId === "speech-montage";
  const [text, setText] = useWorkDraftState("components/ai-tools/ExistingWorkflowTool.jsx:text", ""),
    [scenes, setScenes] = useWorkDraftState("components/ai-tools/ExistingWorkflowTool.jsx:scenes", []),
    [format, setFormat] = useState("9:16"),
    [count, setCount] = useState("3"),
    [message, setMessage] = useState(""),
    [source, setSource] = useState(null),
    [marked, setMarked] = useState([]);
  const [sourceLink, setSourceLink] = useState(""),
    [duration, setDuration] = useState(30),
    [captions, setCaptions] = useState(true),
    [sourceFiles, setSourceFiles] = useState([]);
  const sourceUrls = useRef(new Set());
  useEffect(
    () => () => sourceUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  useEffect(() => {
    if (toolId !== "video-studio" || !incomingText?.revision || !incomingText.text) return;
    const nextScenes = makeScenes(incomingText.text).slice(0, 300);
    setText(incomingText.text);
    setScenes(nextScenes);
    setMessage(
      nextScenes.length === 300
        ? "Roteiro enviado do pipeline. As primeiras 300 cenas estão na prévia editável."
        : "Roteiro enviado do pipeline e cenas criadas para a prévia editável.",
    );
  }, [toolId, incomingText?.revision, incomingText?.text, setText, setScenes]);
  const lines = text.split(/\n+/).filter((s) => s.trim());

  function build() {
    if (!text.trim()) {
      setMessage("Cole sua transcrição ou carregue um exemplo para começar.");
      return;
    }
    setScenes(
      makeScenes(text)
        .slice(0, clips ? Number(count) : 100)
        .map((scene, i) => ({
          ...scene,
          duration: clips ? duration : scene.duration,
          ...(sourceFiles[i]
            ? {
                media: sourceFiles[i].url,
                mediaType: "video",
                mediaName: sourceFiles[i].name,
              }
            : {}),
        })),
    );
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
      <StudioProjectBar
        tool={toolId}
        value={{
          text,
          scenes,
          format,
          count,
          source,
          marked,
          sourceLink,
          duration,
          captions,
          sourceFiles,
        }}
        onLoad={(v) => {
          setText(v.text || "");
          setScenes(Array.isArray(v.scenes) ? v.scenes : []);
          setFormat(v.format || "9:16");
          setCount(v.count || "3");
          setSource(v.source || null);
          setMarked(Array.isArray(v.marked) ? v.marked : []);
          setSourceLink(v.sourceLink || "");
          setDuration(Number(v.duration) || 30);
          setCaptions(v.captions !== false);
          setSourceFiles(Array.isArray(v.sourceFiles) ? v.sourceFiles : []);
        }}
      />
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
                <option>1:1</option>
              </select>
            </Field>
            <Field label="Link da fonte (opcional)">
              <input
                className={inputClass}
                value={sourceLink}
                onChange={(e) => setSourceLink(e.target.value)}
                placeholder="https://youtube.com/..."
              />
              {safeSourceUrl(sourceLink) && (
                <a
                  className="block text-xs text-sky-300"
                  href={safeSourceUrl(sourceLink)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir fonte para consulta ↗
                </a>
              )}
              <p className="text-xs text-slate-500">
                O link fica como referência; o vídeo precisa ser enviado como
                arquivo. Não há download automático nesta tela.
              </p>
            </Field>
            <Field label="Vídeos de origem em lote">
              <input
                type="file"
                multiple
                accept="video/*"
                onChange={(e) => {
                  const files = [...e.target.files]
                    .filter((file) => file.type.startsWith("video/"))
                    .map((file) => {
                      const url = URL.createObjectURL(file);
                      sourceUrls.current.add(url);
                      return { id: crypto.randomUUID(), name: file.name, url };
                    });
                  setSourceFiles((list) => [...list, ...files]);
                  e.target.value = "";
                }}
              />
              {sourceFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 text-xs text-slate-300"
                >
                  <span className="flex-1 truncate">{file.name}</span>
                  <Button onClick={() => setSource(file.url)}>Ver</Button>
                  <Button
                    onClick={() =>
                      setSourceFiles((list) =>
                        list.filter((f) => f.id !== file.id),
                      )
                    }
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </Field>
            {clips && (
              <Field label="Duração inicial de cada trecho (s)">
                <input
                  type="number"
                  min="5"
                  max="300"
                  className={inputClass}
                  value={duration}
                  onChange={(e) =>
                    setDuration(
                      Math.max(5, Math.min(300, Number(e.target.value) || 5)),
                    )
                  }
                />
              </Field>
            )}
            <label className="flex gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={captions}
                onChange={(e) => setCaptions(e.target.checked)}
              />
              Mostrar legendas na prévia
            </label>
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
                    const url = URL.createObjectURL(f);
                    sourceUrls.current.add(url);
                    setSource(url);
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
              Cole sua transcrição para editar o storyboard. Transcrição
              automática e exportação de vídeo disponíveis em breve.
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
            showText={captions}
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
